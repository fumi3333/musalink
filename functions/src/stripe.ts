// Stripe-related Cloud Functions: Connect onboarding, dashboard link, status sync,
// Payment Intent (manual capture), capture, webhook.

import * as functions from "firebase-functions";
import Stripe from "stripe";
import { admin, db, stripe } from "./init";
import {
    applyCors,
    CreateAccountSchema,
    CreatePaymentIntentSchema,
    CapturePaymentSchema,
    checkRateLimit,
    processUnlock,
} from "./helpers";
import { calculateFee } from "./utils";
import { handleError, handleCallableError } from "./errorUtils";

// ============================================================
// Stripe Connect: Express onboarding
// ============================================================
export const executeStripeConnect = functions.https.onRequest(async (req, res) => {
    if (applyCors(req, res)) return;

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    const idToken = authHeader.split('Bearer ')[1];
    let userId;
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken, true);
        userId = decodedToken.uid;
    } catch (error: any) {
        if (error.code === 'auth/id-token-revoked') {
            res.status(401).json({ error: 'Token has been revoked. Please re-authenticate.' });
        } else {
            res.status(401).json({ error: 'Invalid Token' });
        }
        return;
    }

    try {
        const body = CreateAccountSchema.parse(req.body);
        const { email, returnUrl, refreshUrl } = body;

        const privateDoc = await db.collection('users').doc(userId).collection('private_data').doc('profile').get();
        const existingStripeId = privateDoc.exists ? privateDoc.data()?.stripe_connect_id : null;

        let accountId: string;

        if (existingStripeId) {
            console.log(`[Stripe Connect] User ${userId} already has account ${existingStripeId}, generating new link`);
            accountId = existingStripeId;
        } else {
            const account = await stripe.accounts.create({
                type: 'express',
                country: 'JP',
                email: email,
                capabilities: {
                    card_payments: { requested: true },
                    transfers: { requested: true },
                },
            });
            accountId = account.id;

            const batch = db.batch();
            batch.set(db.collection('users').doc(userId), {
                stripe_connect_id: accountId,
                charges_enabled: false,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            batch.set(db.collection('users').doc(userId).collection('private_data').doc('profile'), {
                stripe_connect_id: accountId,
                charges_enabled: false,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            batch.set(db.collection('stripe_accounts').doc(accountId), {
                userId: userId,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            await batch.commit();
        }

        const appUrl = functions.config().app?.url || "http://localhost:3000";
        const itemsUrl = `${appUrl}/seller/payout`;

        const accountLink = await stripe.accountLinks.create({
            account: accountId,
            refresh_url: refreshUrl || itemsUrl,
            return_url: returnUrl || itemsUrl,
            type: 'account_onboarding',
        });

        res.status(200).json({ url: accountLink.url });
    } catch (e) {
        handleError(res, e, "executeStripeConnect");
    }
});

// ============================================================
// Stripe Connect dashboard login link
// ============================================================
export const createStripeLoginLink = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }
    const userId = context.auth.uid;

    try {
        const profileRef = db.collection('users').doc(userId).collection('private_data').doc('profile');
        const profileSnap = await profileRef.get();

        if (!profileSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'Stripe account not linked.');
        }

        const stripeConnectId = profileSnap.data()?.stripe_connect_id;
        if (!stripeConnectId) {
            throw new functions.https.HttpsError('failed-precondition', 'Stripe ID missing in profile.');
        }

        const link = await stripe.accounts.createLoginLink(stripeConnectId);
        return { url: link.url };
    } catch (e) {
        return handleCallableError(e, "createStripeLoginLink");
    }
});

// ============================================================
// Manual sync of Stripe Connect status (called on /seller/payout return)
// ============================================================
export const syncStripeStatus = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }
    const userId = context.auth.uid;

    try {
        const privateRef = db.collection('users').doc(userId).collection('private_data').doc('profile');
        const privateSnap = await privateRef.get();

        if (!privateSnap.exists) {
            return { status: 'no_account', charges_enabled: false };
        }

        const stripeConnectId = privateSnap.data()?.stripe_connect_id;
        if (!stripeConnectId) {
            return { status: 'no_account', charges_enabled: false };
        }

        const account = await stripe.accounts.retrieve(stripeConnectId);
        const chargesEnabled = account.charges_enabled || false;

        const batch = db.batch();
        batch.set(db.collection('users').doc(userId), {
            stripe_connect_id: stripeConnectId,
            charges_enabled: chargesEnabled,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        batch.set(privateRef, {
            stripe_connect_id: stripeConnectId,
            charges_enabled: chargesEnabled,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        await batch.commit();

        console.log(`[syncStripeStatus] User ${userId} → charges_enabled: ${chargesEnabled}`);
        return { status: chargesEnabled ? 'active' : 'pending', charges_enabled: chargesEnabled };
    } catch (e) {
        return handleCallableError(e, "syncStripeStatus");
    }
});

// ============================================================
// Payment Intent (manual capture) — buyer-only
// onRequest + Manual Auth (proxied through Next.js API route)
// ============================================================
export const createPaymentIntent = functions.https.onRequest(async (req, res) => {
    if (applyCors(req, res)) return;

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
        return;
    }
    const idToken = authHeader.split('Bearer ')[1];
    let userId;
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken, true);
        userId = decodedToken.uid;
    } catch (error: any) {
        console.error("Auth Error:", error);
        if (error.code === 'auth/id-token-revoked') {
            res.status(401).json({ error: 'Unauthorized: Token has been revoked' });
        } else {
            res.status(401).json({ error: 'Unauthorized: Invalid token' });
        }
        return;
    }

    let transactionId: string;
    try {
        const body = CreatePaymentIntentSchema.parse(req.body);
        transactionId = body.transactionId;
    } catch (e: any) {
        res.status(400).json({ error: 'Invalid parameters', details: e.errors || e.message });
        return;
    }

    try {
        await checkRateLimit(userId, 'createPaymentIntent', 10, 3600);

        const txDoc = await db.collection('transactions').doc(transactionId).get();
        if (!txDoc.exists) {
            res.status(404).json({ error: "Transaction not found" });
            return;
        }
        const tx = txDoc.data()!;

        if (tx.buyer_id !== userId) {
            res.status(403).json({ error: "Only the buyer can create a payment intent." });
            return;
        }

        if (tx.status !== 'approved') {
            res.status(400).json({ error: `Transaction must be in 'approved' status. Current: ${tx.status}` });
            return;
        }

        const sellerDoc = await db.collection('users').doc(tx.seller_id).get();
        if (!sellerDoc.exists) {
            res.status(404).json({ error: "Seller not found" });
            return;
        }
        const seller = sellerDoc.data()!;

        if (!seller.stripe_connect_id || !seller.charges_enabled) {
            res.status(400).json({ error: "Seller is not ready to receive payments." });
            return;
        }

        const itemDoc = await db.collection('items').doc(tx.item_id).get();
        if (!itemDoc.exists) {
            res.status(404).json({ error: "Item not found" });
            return;
        }
        const item = itemDoc.data()!;
        const amount = item.price;
        const fee = calculateFee(amount);

        const paymentIntentData: Stripe.PaymentIntentCreateParams = {
            amount: amount,
            currency: 'jpy',
            automatic_payment_methods: { enabled: true },
            capture_method: 'manual',
            metadata: {
                transactionId: transactionId,
                userId: userId,
            },
            transfer_data: {
                destination: seller.stripe_connect_id,
            },
            application_fee_amount: fee,
        };

        const paymentIntent = await stripe.paymentIntents.create(paymentIntentData, {
            idempotencyKey: `pi_create_${transactionId}`
        });

        await db.collection("transactions").doc(transactionId).update({
            payment_intent_id: paymentIntent.id,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.status(200).json({
            clientSecret: paymentIntent.client_secret,
        });
    } catch (error) {
        handleError(res, error, "createPaymentIntent");
    }
});

// ============================================================
// Capture Payment (QR Scan / buyer confirms receipt)
// Three-phase: pre-flight → Stripe capture → Firestore commit (outside any Tx)
// ============================================================
export const capturePayment = functions.https.onCall(async (data, context) => {
    console.log("[capturePayment] INVOKED. Data:", JSON.stringify(data));

    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
        }
        const callerId = context.auth.uid;

        let transactionId: string;
        try {
            const params = CapturePaymentSchema.parse(data);
            transactionId = params.transactionId;
        } catch (e: any) {
            console.error(`[capturePayment] Validation Error:`, e);
            throw new functions.https.HttpsError('invalid-argument', 'Invalid parameters', e.errors);
        }

        // Phase 1: Pre-flight (no Firestore Transaction yet) — Stripe を内側で呼ぶと 60s timeout で
        // 「Stripe capture 済み / DB 未更新」の整合性破壊が起きるためここで先に検証する。
        const txRef = db.collection("transactions").doc(transactionId);
        const initialDoc = await txRef.get();
        if (!initialDoc.exists) {
            console.error("[capturePayment] Transaction not found", transactionId);
            throw new functions.https.HttpsError('not-found', "Transaction not found");
        }
        const initialTx = initialDoc.data()!;

        if (initialTx.buyer_id !== callerId) {
            console.error(`[capturePayment] Permission Denied: Caller ${callerId} !== Buyer ${initialTx.buyer_id}`);
            throw new functions.https.HttpsError('permission-denied', "Only the buyer can capture/confirm receipt.");
        }

        if (initialTx.status === 'completed') {
            return { success: true };
        }
        if (initialTx.status !== 'payment_pending') {
            console.error(`[capturePayment] Invalid Status: ${initialTx.status}`);
            throw new functions.https.HttpsError('failed-precondition', `Status Error: ${initialTx.status} (Not pending)`);
        }
        if (!initialTx.payment_intent_id) {
            throw new functions.https.HttpsError('failed-precondition', "No payment intent found.");
        }

        // Phase 2: Stripe Capture (outside any Firestore Transaction)
        try {
            await stripe.paymentIntents.capture(initialTx.payment_intent_id, {
                idempotencyKey: `pi_capture_${transactionId}`
            });
        } catch (stripeErr: any) {
            console.error("[capturePayment] Stripe Capture Failed", stripeErr);
            if (stripeErr.code === 'payment_intent_unexpected_state') {
                // Already captured / non-capturable — idempotent re-run path
            } else if (stripeErr.code === 'request_timeout' || (stripeErr.statusCode && stripeErr.statusCode >= 500)) {
                throw new functions.https.HttpsError('unavailable', `Stripe temporarily unavailable: ${stripeErr.message}`);
            } else {
                throw new functions.https.HttpsError('aborted', `Stripe Error: ${stripeErr.message}`);
            }
        }

        // Phase 3: Firestore commit (Stripe already done)
        return await db.runTransaction(async (t) => {
            const txDoc = await t.get(txRef);
            if (!txDoc.exists) {
                throw new functions.https.HttpsError('not-found', "Transaction not found (post-capture)");
            }
            const tx = txDoc.data()!;

            if (tx.status === 'completed' && tx.unlocked_assets) {
                return { success: true, mode: 'live' };
            }

            const sellerPrivateRef = db.collection("users").doc(tx.seller_id).collection("private_data").doc("profile");
            const sellerPrivateDoc = await t.get(sellerPrivateRef);

            let studentId = "unknown";
            let universityEmail = "unknown";
            if (sellerPrivateDoc.exists) {
                const pd = sellerPrivateDoc.data()!;
                studentId = pd.student_id;
                universityEmail = pd.university_email;
            }

            const itemRef = db.collection("items").doc(tx.item_id);
            const itemDoc = await t.get(itemRef);
            const itemPrice = itemDoc.exists ? itemDoc.data()!.price : 0;
            const feeAmount = calculateFee(itemPrice);

            t.update(txRef, {
                status: 'completed',
                fee_amount: feeAmount,
                unlocked_assets: {
                    student_id: studentId,
                    university_email: universityEmail,
                    unlockedAt: admin.firestore.FieldValue.serverTimestamp()
                },
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            if (itemDoc.exists) {
                t.update(itemRef, {
                    status: 'sold',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }

            return { success: true, mode: 'live' };
        });
    } catch (error: any) {
        console.error("[capturePayment] FATAL ERROR", error);
        if (error instanceof functions.https.HttpsError) throw error;
        throw new functions.https.HttpsError('aborted', `Server Crash: ${error.message || 'Unknown Error'} (Stack: ${error.stack?.substring(0, 100)})`);
    }
});

// ============================================================
// Stripe Webhook — account.updated + payment_intent.succeeded
// ============================================================
export const stripeWebhook = functions.https.onRequest(async (req: functions.https.Request, res: functions.Response) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = functions.config().stripe ? functions.config().stripe.webhook_secret : "";

    let event;

    try {
        if (!sig || !endpointSecret) throw new Error("Missing signature or secret");
        event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
    } catch (err: any) {
        // SECURITY: Do not expose internal error details in response body (2026-05-13)
        console.error(`Webhook signature verification failed: ${err.message}`);
        res.status(400).json({ error: 'Bad Request: Invalid webhook signature' });
        return;
    }

    if (event.type === 'account.updated') {
        const account = event.data.object as Stripe.Account;
        const chargesEnabled = account.charges_enabled ?? false;
        try {
            const mapDoc = await db.collection('stripe_accounts').doc(account.id).get();
            if (mapDoc.exists) {
                const userId = mapDoc.data()!.userId;
                const userRef = db.collection('users').doc(userId);
                const privateProfileRef = userRef.collection('private_data').doc('profile');

                const batch = db.batch();
                batch.set(userRef, {
                    stripe_connect_id: account.id,
                    charges_enabled: chargesEnabled,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                batch.set(privateProfileRef, {
                    stripe_connect_id: account.id,
                    charges_enabled: chargesEnabled,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                await batch.commit();

                console.log(`User ${userId} charges_enabled=${chargesEnabled} via Webhook.`);
            } else {
                console.warn(`Stripe ID ${account.id} not found in lookup map.`);
            }
        } catch (e) {
            console.error("Webhook Account Update Error", e);
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
                res.status(500).json({ error: 'Unlock Failed' });
                return;
            }
        }
    }

    // Always 200 to acknowledge receipt (prevent Stripe retries)
    res.status(200).json({ received: true });
});
