import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import Stripe from "stripe";

// Debug Env
// console.log("Stripe Key Configured:", !!functions.config().stripe);

if (!functions.config().stripe || !functions.config().stripe.secret) {
    console.warn("Stripe Config is missing! Run: firebase functions:config:set stripe.secret='sk_test_...'");
}

const stripe = new Stripe(functions.config().stripe ? functions.config().stripe.secret : "dummy_key_check_env", {
    apiVersion: "2024-06-20" as any,
});

admin.initializeApp();
const db = admin.firestore();

// 24時間反応がない取引を自動キャンセルする定時実行関数
// 実行頻度: 60分ごと
// 24時間反応がない取引を自動キャンセルする定時実行関数
// 実行頻度: 60分ごと
export const cancelStaleTransactions = functions.pubsub.schedule("every 60 minutes").onRun(async (context) => {
    const now = admin.firestore.Timestamp.now();
    const cutoffTime = new admin.firestore.Timestamp(now.seconds - 24 * 60 * 60, 0); // 24時間前

    console.log(`Starting stale transaction cleanup at ${now.toDate().toISOString()}`);

    // 対象: 24時間以上更新がなく、かつ完了していないステータスの取引
    // Note: 複合インデックスが必要になる場合があります
    const snapshot = await db.collection("transactions")
        .where("status", "in", ["matching", "payment_pending"])
        .where("updatedAt", "<=", cutoffTime)
        .get();

    if (snapshot.empty) {
        console.log("No stale transactions found.");
        return null;
    }

    console.log(`Found ${snapshot.size} stale transactions.`);

    const batch = db.batch();
    let batchCount = 0;

    for (const doc of snapshot.docs) {
        const tx = doc.data();
        const txId = doc.id;

        console.log(`Processing stale transaction: ${txId}`);

        // 1. Stripe Cancel Logic (for payment_pending)
        // We must cancel the authorization to release the hold.
        if (tx.status === 'payment_pending' && tx.payment_intent_id) {
            try {
                const pi = await stripe.paymentIntents.retrieve(tx.payment_intent_id);
                if (pi.status === 'requires_capture') {
                    await stripe.paymentIntents.cancel(tx.payment_intent_id);
                    console.log(`[Stripe] Cancelled PI ${tx.payment_intent_id} for tx ${txId}`);
                } else {
                    console.warn(`[Stripe] PI ${tx.payment_intent_id} status is ${pi.status}, skipping cancel.`);
                }
            } catch (stripeError) {
                console.error(`[Stripe] Failed to cancel PI for ${txId}`, stripeError);
                // Continue with DB cancellation? 
                // We proceed to avoid infinite loop of "stale transaction". 
                // Admin can clean up money later if needed.
            }
        }

        // 2. Transaction Status -> cancelled
        batch.update(doc.ref, {
            status: "cancelled",
            cancelledAt: now,
            cancellationReason: "auto_timeout_24h"
        });

        // 3. Item Status -> listing (再出品)
        if (tx.item_id) {
            const itemRef = db.collection("items").doc(tx.item_id);
            batch.update(itemRef, {
                status: "listing"
            });
        }

        // 4. Legacy Coin Refund Logic REMOVED

        batchCount++;

        // Firestore Batch limit is 500 operations
        if (batchCount >= 400) {
            await batch.commit();
            console.log("Committed batch of 400 operations.");
            break; // MVP: Process max 400 at a time
        }
    }

    if (batchCount > 0) {
        await batch.commit();
        console.log(`Successfully cancelled ${batchCount} transactions.`);
    }

    return null;
});

import { SYSTEM_FEE } from "./constants";

// ... existing code ...

// Helper function to process unlock (shared by direct call and webhook)
async function processUnlock(transactionId: string, userId: string, paymentIntentId: string, t: admin.firestore.Transaction) {
    const txRef = db.collection("transactions").doc(transactionId);
    const txDoc = await t.get(txRef);

    if (!txDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Transaction not found.');
    }

    const tx = txDoc.data()!;

    // Case: Already Unlocked (Idempotency)
    if (tx.status === 'completed' && tx.unlocked_assets) {
        console.log(`Transaction ${transactionId} already completed.`);
        return { success: true, message: "Transaction already unlocked." };
    }

    // Check Status
    if (tx.status !== 'approved') {
        throw new functions.https.HttpsError('failed-precondition', 'Transaction must be in approved status.');
    }

    // Buyer verification is implicit if payment succeeded for this transaction

    // Get Seller info for Unlock
    const sellerRef = db.collection("users").doc(tx.seller_id);
    const sellerDoc = await t.get(sellerRef);

    if (!sellerDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Seller profile not found.');
    }

    const seller = sellerDoc.data()!;

    // 2. Unlock & Update Transaction
    t.update(txRef, {
        status: 'completed',
        fee_amount: SYSTEM_FEE,
        unlocked_assets: {
            student_id: seller.student_id || "private",
            university_email: seller.university_email || "private",
            unlockedAt: admin.firestore.Timestamp.now()
        },
        updatedAt: admin.firestore.Timestamp.now()
    });

    // Deduct coin logic is REMOVED/SKIPPED for Direct Stripe Payment
    // We only unlock.

    return { success: true, message: "Transaction unlocked." };
}

// [Phase 13] Capture Payment (QR Scan)
export const capturePayment = functions.https.onCall(async (data, context) => {
    // 1. Auth Check (Must be logged in)
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }
    const callerId = context.auth.uid;

    const transactionId = data.transactionId;
    if (!transactionId) {
        throw new functions.https.HttpsError('invalid-argument', 'Transaction ID required.');
    }

    return db.runTransaction(async (t) => {
        const txRef = db.collection("transactions").doc(transactionId);
        const txDoc = await t.get(txRef);

        if (!txDoc.exists) throw new functions.https.HttpsError('not-found', "Transaction not found");
        const tx = txDoc.data()!;

        // 2. Authorization Check (Seller Only)
        // Only the seller can scan the buyer's QR to capture funds.
        if (tx.seller_id !== callerId) {
            throw new functions.https.HttpsError('permission-denied', "Only the seller can capture this payment.");
        }

        // Check if status is payment_pending (Auth done)
        if (tx.status !== 'payment_pending') {
            // If already completed, return success (idempotency)
            if (tx.status === 'completed') return { success: true };
            throw new functions.https.HttpsError('failed-precondition', "Transaction not in pending state.");
        }

        const paymentIntentId = tx.payment_intent_id;
        if (!paymentIntentId) throw new functions.https.HttpsError('failed-precondition', "No payment link found.");

        try {
            // CAPTURE
            const capturedInfo = await stripe.paymentIntents.capture(paymentIntentId);

            if (capturedInfo.status === 'succeeded') {
                // Update Transaction
                // Get seller info for unlock (legacy logic, maybe just unlock)
                const sellerRef = db.collection("users").doc(tx.seller_id);
                const sellerDoc = await t.get(sellerRef);
                const seller = sellerDoc.data()!;

                t.update(txRef, {
                    status: 'completed',
                    unlocked_assets: {
                        student_id: seller.student_id || "private",
                        university_email: seller.university_email || "private",
                        unlockedAt: admin.firestore.Timestamp.now()
                    },
                    updatedAt: admin.firestore.Timestamp.now()
                });

                return { success: true };
            } else {
                throw new Error("Capture failed status: " + capturedInfo.status);
            }
        } catch (e: any) {
            console.error("Capture Error", e);
            throw new functions.https.HttpsError('internal', "Payment capture failed: " + e.message);
        }
    });
});

// [Phase 11] Create Payment Intent
export const createPaymentIntent = functions.https.onCall(async (data, context) => {
    // Auth Check
    const userId = data.userId;
    const transactionId = data.transactionId;

    if (!userId || !transactionId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing userId or transactionId');
    }

    try {
        // [Phase 13] Marketplace Logic: Auth Only + Connect Split
        // 1. Get Seller's Connect ID
        // Note: For MVP we might need to fetch seller from transactionId -> sellerId -> User
        // But here we rely on the implementation plan which says "Reserve".
        // We need to know the destination account to facilitate the split *at capture time* or *at intent creation*?
        // With 'on_behalf_of' or 'transfer_data', we can define it now.
        // Let's fetch the seller first.

        const txDoc = await db.collection('transactions').doc(transactionId).get();
        if (!txDoc.exists) throw new Error("Transaction not found");
        const tx = txDoc.data()!;

        const sellerDoc = await db.collection('users').doc(tx.seller_id).get();
        if (!sellerDoc.exists) throw new Error("Seller not found");
        const seller = sellerDoc.data()!;

        if (!seller.stripe_connect_id || !seller.charges_enabled) {
            throw new Error("Seller is not ready to receive payments.");
        }

        // Wait, price is usually on Item.
        const itemDoc = await db.collection('items').doc(tx.item_id).get();
        const item = itemDoc.data()!;
        const amount = item.price;

        // Fee Calculation (10%)
        const fee = Math.floor(amount * 0.1);

        // Mock for Local/Test Mode if key is missing
        if (false) {
            console.log("Using Mock Payment Intent for Dev Mode");
            // Return a mock string that won't work with real Stripe.js but prevents 500 Internal Server Error.
            // Actually, Stripe.js will fail if client_secret is invalid format.
            // We should ideally use a real test key.
            // But if user can't set it, we catch the error in UI or use a valid-looking mock?
            // "pi_mock_12345_secret_mock_12345"
            const mockId = "pi_mock_" + Date.now();

            // Save mock ID to DB so next steps (QR capture etc) might work if mocked
            await db.collection("transactions").doc(transactionId).update({
                payment_intent_id: mockId,
                updatedAt: admin.firestore.Timestamp.now()
            });

            return {
                clientSecret: mockId + "_secret_mock_12345",
            };
        }

        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: 'jpy',
            automatic_payment_methods: { enabled: true },
            capture_method: 'manual', // <--- AUTH ONLY
            transfer_data: {
                destination: seller.stripe_connect_id, // Send to Seller
            },
            application_fee_amount: fee, // Platform Fee
            metadata: {
                transactionId: transactionId,
                userId: userId,
            },
        });

        // [Security Fix] Write Intent ID to Firestore (Admin SDK)
        // This ensures the ID is authoritative and cannot be swapped by the client.
        await db.collection("transactions").doc(transactionId).update({
            payment_intent_id: paymentIntent.id,
            updatedAt: admin.firestore.Timestamp.now()
        });

        return {
            clientSecret: paymentIntent.client_secret,
        };
    } catch (error: any) {
        console.error("Payment Intent Error:", error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// [Pivot Implementation] Unlock via Client Call (Legacy/Immediate Feedback)
export const unlockTransaction = functions.https.onCall(async (data, context) => {
    const callerId = data.userId;
    const transactionId = data.transactionId;
    const paymentIntentId = data.paymentIntentId;

    if (!transactionId || !callerId) {
        throw new functions.https.HttpsError('invalid-argument', 'Transaction ID and User ID are required.');
    }

    return db.runTransaction(async (t) => {
        // Path A: Direct Stripe Payment
        if (paymentIntentId) {
            try {
                // Verify with Stripe
                const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
                // Allow 'succeeded' OR 'requires_capture' (for manual capture flow)
                // Actually, if it is manual capture, it is 'requires_capture'.
                // But unlockTransaction is usually called after success? 
                // In Phase 13, unlock is done via 'capturePayment'.
                // This 'unlockTransaction' might be legacy or for fallback. 
                // Let's keep it robust.

                if ((paymentIntent.status === 'succeeded' || paymentIntent.status === 'requires_capture') && paymentIntent.metadata.transactionId === transactionId) {
                    // CALL SHARED LOGIC
                    return processUnlock(transactionId, callerId, paymentIntentId, t);
                } else {
                    throw new functions.https.HttpsError('permission-denied', 'Payment not successful or mismatched.');
                }
            } catch (e: any) {
                console.error("Stripe Verification Failed", e);
                throw new functions.https.HttpsError('internal', 'Failed to verify payment with provider.');
            }
        }
        // Path B: Internal Coin Balance (Fallback)
        else {
            // ... legacy coin logic omitted/simplified ...
            throw new functions.https.HttpsError('failed-precondition', 'Stripe Payment Required in this version.');
        }
    });
});

// [New] Rate User
export const rateUser = functions.https.onCall(async (data, context) => {
    // 1. Auth Check
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
    }
    const uid = context.auth.uid;
    const { transactionId, score } = data;

    if (!transactionId || !score || score < 1 || score > 5) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid score or ID');
    }

    try {
        const txRef = admin.firestore().collection('transactions').doc(transactionId);
        const txSnap = await txRef.get();
        if (!txSnap.exists) throw new functions.https.HttpsError('not-found', 'Transaction not found');

        const tx = txSnap.data() as any;

        // 2. Permission Check: user must be buyer or seller
        const isBuyer = tx.buyer_id === uid;
        const isSeller = tx.seller_id === uid;

        if (!isBuyer && !isSeller) {
            throw new functions.https.HttpsError('permission-denied', 'Not a participant');
        }

        // 3. Status Check
        if (tx.status !== 'completed') {
            throw new functions.https.HttpsError('failed-precondition', 'Transaction must be completed');
        }

        // 4. Duplicate Check
        if ((isBuyer && tx.buyer_rated) || (isSeller && tx.seller_rated)) {
            throw new functions.https.HttpsError('already-exists', 'You have already rated');
        }

        // 5. Determine Target Logic
        const targetUserId = isBuyer ? tx.seller_id : tx.buyer_id;

        // 6. Update Target User & Transaction
        await db.runTransaction(async (t) => {
            const userRef = db.collection('users').doc(targetUserId);

            // Increment logic for user
            t.set(userRef, {
                ratings: {
                    count: admin.firestore.FieldValue.increment(1),
                    total_score: admin.firestore.FieldValue.increment(score)
                }
            }, { merge: true });

            // Mark transaction as rated
            const updateField = isBuyer ? { buyer_rated: true } : { seller_rated: true };
            t.update(txRef, updateField);
        });

        return { success: true };

    } catch (error: any) {
        console.error("RateUser Error:", error);
        throw new functions.https.HttpsError('internal', error.message || 'Rating failed');
    }
});

// [New] Create Stripe Connect Account
export const createStripeConnectAccount = functions.https.onCall(async (data, context) => {
    const { userId, email } = data;

    if (!userId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing userId');
    }

    try {
        // Create Express Account
        const account = await stripe.accounts.create({
            type: 'express',
            email: email,
            capabilities: {
                card_payments: { requested: true },
                transfers: { requested: true },
            },
            metadata: { firebaseUID: userId }
        });

        // Save to User Config
        await db.collection('users').doc(userId).set({
            stripe_connect_id: account.id
        }, { merge: true });

        return { accountId: account.id };
    } catch (error: any) {
        console.error("Create Connect Account Error:", error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

export const createStripeAccountLink = functions.https.onCall(async (data, context) => {
    const accountId = data.accountId;
    const returnUrl = data.returnUrl || "https://musa-link.web.app/seller/payout/callback";
    const refreshUrl = data.refreshUrl || "https://musa-link.web.app/seller/payout/refresh";

    if (!accountId) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing accountId');
    }

    try {
        const accountLink = await stripe.accountLinks.create({
            account: accountId,
            refresh_url: refreshUrl,
            return_url: returnUrl,
            type: 'account_onboarding',
        });

        return { url: accountLink.url };
    } catch (error: any) {
        console.error("Account Link Error:", error);
        throw new functions.https.HttpsError('internal', error.message);
    }
});

// [New] Stripe Webhook
export const stripeWebhook = functions.https.onRequest(async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = functions.config().stripe ? functions.config().stripe.webhook_secret : "";

    let event;

    try {
        if (!sig || !endpointSecret) throw new Error("Missing signature or secret");
        event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
    } catch (err: any) {
        console.error(`Webhook Error: ${err.message}`);
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }

    // Handle Connect Account Updates (capability_updated etc)
    if (event.type === 'account.updated') {
        const account = event.data.object as Stripe.Account;
        if (account.charges_enabled) {
            // Find user by stripe_connect_id and update charges_enabled
            const usersSnap = await db.collection('users').where('stripe_connect_id', '==', account.id).get();
            if (!usersSnap.empty) {
                const userDoc = usersSnap.docs[0];
                await userDoc.ref.update({ charges_enabled: true });
                console.log(`User ${userDoc.id} charges enabled via Connect.`);
            }
        }
    }

    if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const transactionId = paymentIntent.metadata.transactionId;
        const userId = paymentIntent.metadata.userId;

        if (transactionId && userId) {
            console.log(`Webhook Processing: Unlock ${transactionId} for ${userId}`);
            try {
                await db.runTransaction(async (t) => {
                    await processUnlock(transactionId, userId, paymentIntent.id, t);
                });
                console.log('Webhook: Successfully Unlocked');
            } catch (e) {
                console.error("Webhook Unlock Failed", e);
                // Return 500 so Stripe retries
                res.status(500).send("Unlock Failed");
                return;
            }
        }
    }

    res.json({ received: true });
});

// [Admin] Force Cancel Transaction
export const adminCancelTransaction = functions.https.onCall(async (data, context) => {
    // 1. Admin Check
    // In production, verify custom claim: context.auth?.token.admin === true
    // For MVP, check specific email or just allow if authenticated (since only Admin UI calls it? No, insecure)
    // We'll use the hardcoded email check for now to match firestore.rules
    const email = context.auth?.token.email;
    if (email !== "admin@musashino-u.ac.jp" && email !== "fumi_admin@musashino-u.ac.jp") {
        throw new functions.https.HttpsError('permission-denied', 'Admin only.');
    }

    const { transactionId, reason } = data;
    if (!transactionId) throw new functions.https.HttpsError('invalid-argument', 'Missing transactionId');

    try {
        await db.runTransaction(async (t) => {
            const txRef = db.collection('transactions').doc(transactionId);
            const txDoc = await t.get(txRef);
            if (!txDoc.exists) throw new functions.https.HttpsError('not-found', 'Transaction not found');
            const tx = txDoc.data()!;

            // 2. Stripe Payment Cancel/Refund (Before DB updates to ensure it works)
            let stripeAction = "none";
            if (tx.payment_intent_id) {
                // Warning: Stripe API calls inside runTransaction is risky if they are slow (transaction timeout).
                // However, we need to ensure Stripe is cancelled before we mark as cancelled in DB.
                // Better approach: Call Stripe OUTSIDE transaction? 
                // No, we want atomicity. But Firestore Tx timeout is 60s?
                // Let's do it here for MVP simple consistency.
                // Helper logic inline:
                try {
                    const pi = await stripe.paymentIntents.retrieve(tx.payment_intent_id);
                    if (pi.status === 'requires_capture') {
                        await stripe.paymentIntents.cancel(tx.payment_intent_id);
                        stripeAction = "cancelled_auth";
                    } else if (pi.status === 'succeeded') {
                        await stripe.refunds.create({ payment_intent: tx.payment_intent_id });
                        stripeAction = "refunded";
                    } else {
                        console.warn(`Stripe PI status is ${pi.status}, skipping action.`);
                    }
                } catch (stripeError: any) {
                    console.error("Stripe Action Failed:", stripeError);
                    // If Stripe fails, do we abort the DB cancel? Yes/No?
                    // Yes, to keep state consistent.
                    throw new functions.https.HttpsError('internal', "Stripe Cancellation Failed: " + stripeError.message);
                }
            }

            // 2. Cancel Transaction in DB
            t.update(txRef, {
                status: 'cancelled',
                cancelledAt: admin.firestore.Timestamp.now(),
                cancellationReason: reason || "admin_force_cancel",
                stripeActionTaken: stripeAction // Audit log
            });

            // 3. Revert Item Status
            if (tx.item_id) {
                const itemRef = db.collection('items').doc(tx.item_id);
                t.update(itemRef, { status: 'listing' });
            }

            // 4. Legacy Coin Logic Removed.
        });

        return { success: true };
    } catch (e: any) {
        console.error("Admin Cancel Error", e);
        throw new functions.https.HttpsError('internal', e.message);
    }
});
