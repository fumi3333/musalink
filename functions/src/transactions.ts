// Transaction lifecycle Cloud Functions:
// - cancelStaleTransactions (cron, 24h timeout)
// - unlockTransaction (fallback HTTPS, buyer-only)
// - cancelTransaction (callable, buyer/seller)
// - rateUser (callable)
// - adminCancelTransaction (callable, Custom Claim admin only)

import * as functions from "firebase-functions";
import { admin, db, stripe } from "./init";
import {
    applyCors,
    UnlockTransactionSchema,
    CancelTransactionSchema,
    RateUserSchema,
} from "./helpers";
import { handleError, handleCallableError } from "./errorUtils";

// ============================================================
// Stale transaction sweeper (hourly cron, 24h timeout)
// ============================================================
export const cancelStaleTransactions = functions.pubsub
    .schedule("every 60 minutes")
    .onRun(async (context) => {
        const now = admin.firestore.Timestamp.now();
        const cutoffTime = new admin.firestore.Timestamp(now.seconds - 24 * 60 * 60, 0);

        console.log(`Starting stale transaction cleanup at ${now.toDate().toISOString()}`);

        // Composite index required: status + updatedAt
        const snapshot = await db.collection("transactions")
            .where("status", "in", ["request_sent", "approved", "payment_pending"])
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

            // Stripe cancel for payment_pending (auth hold release)
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
                }
            }

            batch.update(doc.ref, {
                status: "cancelled",
                cancelledAt: now,
                cancel_reason: "auto_timeout_24h"
            });

            if (tx.item_id) {
                const itemRef = db.collection("items").doc(tx.item_id);
                batch.update(itemRef, {
                    status: "listing"
                });
            }

            batchCount++;

            // Firestore Batch limit is 500 ops; cap at 200 tx (2 ops each = 400)
            if (batchCount >= 200) {
                break;
            }
        }

        if (batchCount > 0) {
            await batch.commit();
            console.log(`Successfully cancelled ${batchCount} transactions.`);
        }

        return null;
    });

// ============================================================
// Unlock Transaction — buyer-only fallback HTTPS endpoint
// (Used when the callable capturePayment path fails; same effect.)
// ============================================================
export const unlockTransaction = functions.https.onRequest(async (req, res) => {
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
    let callerId;
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken, true);
        callerId = decodedToken.uid;
    } catch (error: any) {
        console.error("Unlock Auth Error:", error);
        if (error.code === 'auth/id-token-revoked') {
            res.status(401).json({ error: 'Unauthorized: Token has been revoked' });
        } else {
            res.status(401).json({ error: 'Unauthorized: Invalid token' });
        }
        return;
    }

    let transactionId: string;
    try {
        const body = UnlockTransactionSchema.parse(req.body);
        transactionId = body.transactionId;
    } catch (e: any) {
        res.status(400).json({ error: 'Invalid parameters', details: e.errors });
        return;
    }

    try {
        const txRef = db.collection('transactions').doc(transactionId);
        const txDoc = await txRef.get();

        if (!txDoc.exists) {
            res.status(404).json({ error: 'Transaction not found' });
            return;
        }

        const tx = txDoc.data()!;

        // Security (2026-05-16): Only the BUYER can unlock. Seller capturing on their own
        // is a fraud vector (capture before buyer scans QR / agrees to receive).
        if (tx.buyer_id !== callerId) {
            console.warn(`Unlock denied: caller ${callerId} is not buyer ${tx.buyer_id} (tx: ${transactionId})`);
            res.status(403).json({ error: 'Permission denied: Only the buyer can complete this transaction.' });
            return;
        }

        if (tx.payment_intent_id && tx.status === 'payment_pending') {
            try {
                await stripe.paymentIntents.capture(tx.payment_intent_id);
            } catch (stripeErr: any) {
                console.error("[unlockTransaction] Stripe Capture Failed", stripeErr);
                if (stripeErr.code !== 'payment_intent_unexpected_state') {
                    res.status(500).json({ error: `Stripe Error: ${stripeErr.message}` });
                    return;
                }
            }
        }

        const sellerPrivateRef = db.collection("users").doc(tx.seller_id).collection("private_data").doc("profile");
        const sellerPrivateDoc = await sellerPrivateRef.get();

        let studentId = "unknown";
        let universityEmail = "unknown";
        if (sellerPrivateDoc.exists) {
            const pd = sellerPrivateDoc.data()!;
            studentId = pd.student_id;
            universityEmail = pd.university_email;
        }

        const batch = db.batch();
        batch.update(txRef, {
            status: 'completed',
            unlocked_assets: {
                student_id: studentId,
                university_email: universityEmail,
                unlockedAt: admin.firestore.FieldValue.serverTimestamp()
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        if (tx.item_id) {
            batch.update(db.collection('items').doc(tx.item_id), {
                status: 'sold',
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }
        await batch.commit();

        res.status(200).json({ success: true, message: 'Transaction unlocked' });
    } catch (error) {
        handleError(res, error, "unlockTransaction");
    }
});

// ============================================================
// Cancel Transaction (buyer / seller initiated)
// Releases Stripe auth hold or issues refund based on PI status.
// ============================================================
export const cancelTransaction = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }
    const callerId = context.auth.uid;
    console.log(`[cancelTransaction] Caller: ${callerId}`);

    let transactionId: string;
    let reason: string | undefined;
    try {
        const params = CancelTransactionSchema.parse(data);
        transactionId = params.transactionId;
        reason = params.reason;
    } catch (e: any) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid parameters', e.errors);
    }

    try {
        await db.runTransaction(async (t) => {
            const txRef = db.collection("transactions").doc(transactionId);
            const txDoc = await t.get(txRef);
            if (!txDoc.exists) throw new functions.https.HttpsError('not-found', "Transaction not found");

            const tx = txDoc.data()!;

            const isBuyer = tx.buyer_id === callerId;
            const isSeller = tx.seller_id === callerId;

            if (!isBuyer && !isSeller) {
                throw new functions.https.HttpsError('permission-denied', "Not a participant.");
            }

            if (tx.status === 'cancelled') {
                throw new functions.https.HttpsError('failed-precondition', "Already cancelled.");
            }

            // Buyer cannot cancel once completed — must ask seller for refund
            if (isBuyer && tx.status === 'completed') {
                throw new functions.https.HttpsError('permission-denied', "Buyer cannot cancel completed transaction. Contact Seller for refund.");
            }

            const piId = tx.payment_intent_id;
            if (piId) {
                try {
                    const pi = await stripe.paymentIntents.retrieve(piId);

                    if (pi.status === 'requires_capture') {
                        const idempotencyKey = `pi_cancel_${transactionId}`;
                        console.log(`Canceling Auth for ${piId}`);
                        await stripe.paymentIntents.cancel(piId, { idempotencyKey });
                    } else if (pi.status === 'succeeded') {
                        const idempotencyKey = `pi_refund_${transactionId}`;
                        console.log(`Refunding ${piId}`);
                        await stripe.refunds.create({
                            payment_intent: piId,
                            reason: 'requested_by_customer'
                        }, { idempotencyKey });
                    }
                } catch (stripeError: any) {
                    console.error("Stripe Cancel Error:", stripeError);
                    if (!stripeError.message?.includes('canceled') && !stripeError.message?.includes('redundant')) {
                        handleCallableError(stripeError, "cancelTransaction-Stripe");
                    }
                }
            }

            t.update(txRef, {
                status: 'cancelled',
                cancel_reason: reason || "User requested",
                cancelledBy: callerId,
                cancelledAt: admin.firestore.FieldValue.serverTimestamp()
            });

            const itemRef = db.collection("items").doc(tx.item_id);
            const itemDoc = await t.get(itemRef);
            if (itemDoc.exists) {
                t.update(itemRef, {
                    status: 'listing'
                });
            }
        });

        return { success: true };
    } catch (e: any) {
        return handleCallableError(e, "cancelTransaction");
    }
});

// ============================================================
// Rate user (1-5 stars). Single rating per role per transaction.
// ============================================================
export const rateUser = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
    }
    const uid = context.auth.uid;

    let transactionId: string;
    let score: number;
    let role: 'buyer' | 'seller' | undefined;
    try {
        const params = RateUserSchema.parse(data);
        transactionId = params.transactionId;
        score = params.score;
        role = params.role;
    } catch (e: any) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid parameters', e.errors);
    }

    try {
        const txRef = admin.firestore().collection('transactions').doc(transactionId);
        const txSnap = await txRef.get();
        if (!txSnap.exists) throw new functions.https.HttpsError('not-found', 'Transaction not found');

        const tx = txSnap.data()!;

        let isBuyer = tx.buyer_id === uid;
        let isSeller = tx.seller_id === uid;

        if (!isBuyer && !isSeller) {
            throw new functions.https.HttpsError('permission-denied', 'Not a participant');
        }

        // Self-trade / debug: rely on role param to disambiguate
        if (isBuyer && isSeller && role) {
            if (role === 'buyer') isSeller = false;
            else if (role === 'seller') isBuyer = false;
        } else if (role) {
            if (role === 'buyer' && !isBuyer) throw new functions.https.HttpsError('permission-denied', 'Role mismatch: claimed buyer but is not buyer');
            if (role === 'seller' && !isSeller) throw new functions.https.HttpsError('permission-denied', 'Role mismatch: claimed seller but is not seller');

            if (role === 'buyer') isSeller = false;
            if (role === 'seller') isBuyer = false;
        }

        if (tx.status !== 'completed') {
            throw new functions.https.HttpsError('failed-precondition', 'Transaction must be completed');
        }

        if ((isBuyer && tx.buyer_rated) || (isSeller && tx.seller_rated)) {
            throw new functions.https.HttpsError('already-exists', 'You have already rated');
        }

        // I am Buyer → I rate Seller. I am Seller → I rate Buyer.
        const targetUserId = isBuyer ? tx.seller_id : tx.buyer_id;

        await db.runTransaction(async (t) => {
            const userRef = db.collection('users').doc(targetUserId);
            const userDoc = await t.get(userRef);

            const userData = userDoc.exists ? userDoc.data()! : {};
            const currentRatings = userData.ratings || { count: 0, total_score: 0 };

            const newCount = (currentRatings.count || 0) + 1;
            const newTotal = (currentRatings.total_score || 0) + score;
            const newTrustScore = newTotal / newCount;

            t.set(userRef, {
                ratings: {
                    count: newCount,
                    total_score: newTotal
                },
                trustScore: newTrustScore
            }, { merge: true });

            const updateField = isBuyer ? { buyer_rated: true } : { seller_rated: true };
            t.update(txRef, updateField);
        });

        return { success: true };
    } catch (error: any) {
        return handleCallableError(error, "rateUser");
    }
});

// ============================================================
// Admin force-cancel — requires Custom Claim admin === true.
// Three-phase to avoid Stripe latency stalling the Firestore Tx.
// ============================================================
export const adminCancelTransaction = functions.https.onCall(async (data, context) => {
    // Authoritative check: context.auth.token.admin === true (set via setCustomUserClaims).
    // Email allow-list removed (2026-05-16) — even a compromised admin email has no powers without the claim.
    if (context.auth?.token.admin !== true) {
        throw new functions.https.HttpsError('permission-denied', 'Admin only.');
    }

    const { transactionId, reason } = data;
    if (!transactionId) throw new functions.https.HttpsError('invalid-argument', 'Missing transactionId');

    try {
        // Phase 1: read tx outside any Firestore Transaction (Stripe might be slow)
        const txRef = db.collection('transactions').doc(transactionId);
        const initialDoc = await txRef.get();
        if (!initialDoc.exists) throw new functions.https.HttpsError('not-found', 'Transaction not found');
        const initialTx = initialDoc.data()!;

        if (initialTx.status === 'cancelled') {
            return { success: true };
        }

        // Phase 2: Stripe operation (outside any Firestore Transaction)
        let stripeAction = "none";
        if (initialTx.payment_intent_id) {
            try {
                const pi = await stripe.paymentIntents.retrieve(initialTx.payment_intent_id);
                if (pi.status === 'requires_capture') {
                    await stripe.paymentIntents.cancel(initialTx.payment_intent_id, {
                        idempotencyKey: `pi_cancel_${transactionId}`
                    });
                    stripeAction = "cancelled_auth";
                } else if (pi.status === 'succeeded') {
                    await stripe.refunds.create(
                        { payment_intent: initialTx.payment_intent_id },
                        { idempotencyKey: `pi_refund_${transactionId}` }
                    );
                    stripeAction = "refunded";
                } else {
                    console.warn(`Stripe PI status is ${pi.status}, skipping action.`);
                    stripeAction = `skipped_${pi.status}`;
                }
            } catch (stripeError: any) {
                console.error("[adminCancel] Stripe Action Failed:", stripeError);
                if (stripeError.code === 'request_timeout' || (stripeError.statusCode && stripeError.statusCode >= 500)) {
                    throw new functions.https.HttpsError('unavailable', `Stripe temporarily unavailable: ${stripeError.message}`);
                }
                throw new functions.https.HttpsError('internal', `Stripe Cancellation Failed: ${stripeError.message}`);
            }
        }

        // Phase 3: Firestore commit (Stripe already done)
        await db.runTransaction(async (t) => {
            const txDoc = await t.get(txRef);
            if (!txDoc.exists) throw new functions.https.HttpsError('not-found', 'Transaction disappeared');
            const tx = txDoc.data()!;
            if (tx.status === 'cancelled') return; // race: someone else already cancelled

            t.update(txRef, {
                status: 'cancelled',
                cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
                cancel_reason: reason || "admin_force_cancel",
                stripeActionTaken: stripeAction
            });

            if (tx.item_id) {
                const itemRef = db.collection('items').doc(tx.item_id);
                t.update(itemRef, { status: 'listing' });
            }
        });

        return { success: true };
    } catch (e: any) {
        console.error("Admin Cancel Error", e);
        if (e instanceof functions.https.HttpsError) throw e;
        throw new functions.https.HttpsError('internal', e.message);
    }
});
