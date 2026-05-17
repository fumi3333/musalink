

// Load Environment Variables
require('dotenv').config();

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import Stripe from "stripe";
import { allowedOrigins } from "./config";



// Debug Env
// console.log("Stripe Key Configured:", !!functions.config().stripe);

const config = functions.config() as any;

const stripeSecret = config.stripe?.secret || process.env.STRIPE_SECRET_KEY;

if (!stripeSecret) {
    console.warn("Stripe Config is missing! Run: firebase functions:config:set stripe.secret='sk_test_...' or set STRIPE_SECRET_KEY in functions/.env");
}

const stripe = new Stripe(stripeSecret || "dummy_key_check_env", {
    apiVersion: "2024-06-20" as any,
});

admin.initializeApp();
const db = admin.firestore();

import { z } from "zod";
import { calculateFee } from "./utils";
import { handleError, handleCallableError } from "./errorUtils";

// [New] Create Stripe Connect Account
const CreateAccountSchema = z.object({
    email: z.string().email(),
    returnUrl: z.string().url().optional(),
    refreshUrl: z.string().url().optional(),
});

const CreatePaymentIntentSchema = z.object({
    transactionId: z.string().min(1),
});

const CapturePaymentSchema = z.object({
    transactionId: z.string().min(1),
});

const UnlockTransactionSchema = z.object({
    transactionId: z.string().min(1),
});

const CancelTransactionSchema = z.object({
    transactionId: z.string().min(1),
    reason: z.string().optional(),
});

const RateUserSchema = z.object({
    transactionId: z.string().min(1),
    score: z.number().min(1).max(5),
    role: z.enum(['buyer', 'seller']).optional(),
});



// Manual CORS Helper
// Manual CORS Helper
const applyCors = (req: functions.https.Request, res: functions.Response) => {
    const origin = req.headers.origin;
    
    if (origin && allowedOrigins.includes(origin)) {
        res.set('Access-Control-Allow-Origin', origin);
    }
    
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return true; // Handled
    }
    return false; // Continue
};

export const executeStripeConnect = functions.https.onRequest(async (req, res) => {
    if (applyCors(req, res)) return;

    // 1. Auth Check
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
        // 2. Extract Data
        const body = CreateAccountSchema.parse(req.body);
        const { email, returnUrl, refreshUrl } = body;

        // Check if user already has a Stripe Connect account
        const privateDoc = await db.collection('users').doc(userId).collection('private_data').doc('profile').get();
        const existingStripeId = privateDoc.exists ? privateDoc.data()?.stripe_connect_id : null;

        let accountId: string;

        if (existingStripeId) {
            // Already has an account - reuse it (generate new onboarding link)
            console.log(`[Stripe Connect] User ${userId} already has account ${existingStripeId}, generating new link`);
            accountId = existingStripeId;
        } else {
            // 3. Create new Account
            const account = await stripe.accounts.create({
                type: 'express', 
                country: 'JP',
                email: email,
                capabilities: {
                  card_payments: {requested: true},
                  transfers: {requested: true},
                },
            });
            accountId = account.id;

            // 4. Save to Firestore (Public + Private)
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

        // 5. Create Link (works for both new and existing accounts)
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

export const createStripeLoginLink = functions.https.onCall(async (data, context) => {
    // 1. Auth Check
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }
    const userId = context.auth.uid;

    try {
        // 2. Fetch Secure Stripe ID from Private Data
        // We do NOT trust the client to send the accountId.
        const profileRef = db.collection('users').doc(userId).collection('private_data').doc('profile');
        const profileSnap = await profileRef.get();

        if (!profileSnap.exists) {
             throw new functions.https.HttpsError('not-found', 'Stripe account not linked.');
        }

        const stripeConnectId = profileSnap.data()?.stripe_connect_id;
        if (!stripeConnectId) {
             throw new functions.https.HttpsError('failed-precondition', 'Stripe ID missing in profile.');
        }

        // 3. Create Link
        const link = await stripe.accounts.createLoginLink(stripeConnectId);
        return { url: link.url };

    } catch (e) {
        return handleCallableError(e, "createStripeLoginLink");
    }
});


// Stripe Connect ステータスを手動同期する関数
// Webhook が届かない場合やページ復帰時にフロントから呼ばれる
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

        // Stripe API からアカウント状態を直接取得
        const account = await stripe.accounts.retrieve(stripeConnectId);
        const chargesEnabled = account.charges_enabled || false;

        // Firestore を更新（Public + Private 両方）
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

// 本人確認 (Identity Verification) - サーバー側で is_verified を書き込む
// 経緯: 2026-05-16 の field-lockdown 後、クライアントから is_verified を書けなくなったため
// Auth Token から email を取得 → @stu.musashino-u.ac.jp 検証 → 学籍番号抽出 → サーバー側で書き込み
export const verifyUserIdentity = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }

    const uid = context.auth.uid;
    const email = context.auth.token.email;

    if (!email) {
        throw new functions.https.HttpsError('failed-precondition', 'Email not available on auth token.');
    }

    const match = email.match(/^([a-zA-Z0-9]+)@stu\.musashino-u\.ac\.jp$/);
    if (!match) {
        throw new functions.https.HttpsError('permission-denied', '武蔵野大学の学生メール (@stu.musashino-u.ac.jp) でログインしてください。');
    }

    const studentId = match[1];

    try {
        const userRef = db.collection('users').doc(uid);
        const privateRef = userRef.collection('private_data').doc('profile');

        const batch = db.batch();
        batch.set(userRef, {
            id: uid,
            is_verified: true,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        batch.set(privateRef, {
            student_id: studentId,
            university_email: email,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        await batch.commit();

        console.log(`[verifyUserIdentity] User ${uid} verified with student_id ${studentId}`);
        return { success: true, student_id: studentId };
    } catch (e) {
        return handleCallableError(e, "verifyUserIdentity");
    }
});

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
            cancel_reason: "auto_timeout_24h"
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

        // Firestore Batch limit is 500 operations (2 ops per tx: tx + item)
        if (batchCount >= 200) {
            break; // Cap at 200 to stay under 500 ops (200 * 2 = 400)
        }
    }

    if (batchCount > 0) {
        await batch.commit();
        console.log(`Successfully cancelled ${batchCount} transactions.`);
    }

    return null;
});

// Fee calculation is handled by calculateFee from ./utils

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
    if (tx.status !== 'approved' && tx.status !== 'payment_pending') {
        throw new functions.https.HttpsError('failed-precondition', `Transaction must be in approved or payment_pending status. Current: ${tx.status}`);
    }

    // Buyer verification is implicit if payment succeeded for this transaction

    // Get Seller info for Unlock（個人情報は private_data のみから取得）
    const sellerPrivateRef = db.collection("users").doc(tx.seller_id).collection("private_data").doc("profile");
    const sellerPrivateDoc = await t.get(sellerPrivateRef);

    let studentId = "private";
    let universityEmail = "private";
    if (sellerPrivateDoc.exists) {
        const privateData = sellerPrivateDoc.data()!;
        studentId = privateData.student_id || privateData.email || studentId;
        universityEmail = privateData.university_email || privateData.email || universityEmail;
    }

    // Get item price to calculate fee
    const itemRef = db.collection("items").doc(tx.item_id);
    const itemDoc = await t.get(itemRef);
    const itemPrice = itemDoc.exists ? itemDoc.data()!.price : 0;

    // 2. Unlock & Update Transaction
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

    // 3. Mark the item as sold so it disappears from listings and stays
    // logically consistent ("matching" means still in negotiation).
    if (itemDoc.exists) {
        t.update(itemRef, {
            status: 'sold',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    }

    return { success: true, message: "Transaction unlocked." };
}

// [Phase 11] Create Payment Intent (Platform-Held / Hybrid)
// onRequest + Manual Auth (via API Route Proxy)
export const createPaymentIntent = functions.https.onRequest(async (req, res) => {
    if (applyCors(req, res)) return;

    // 1. Method Check
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }

    // 2. Auth Check (Manual)
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

    // 3. Data Extraction
    let transactionId: string;
    try {
        const body = CreatePaymentIntentSchema.parse(req.body);
        transactionId = body.transactionId;
    } catch (e: any) {
         res.status(400).json({ error: 'Invalid parameters', details: e.errors || e.message });
         return;
    }

    // Optional: Verify requestUserId matches token userId if strict check needed
    // if (requestUserId && requestUserId !== userId) { ... }

    try {
        await checkRateLimit(userId, 'createPaymentIntent', 10, 3600);

        const txDoc = await db.collection('transactions').doc(transactionId).get();
        if (!txDoc.exists) {
            res.status(404).json({ error: "Transaction not found" });
            return;
        }
        const tx = txDoc.data()!;

        // Verify caller is the buyer
        if (tx.buyer_id !== userId) {
            res.status(403).json({ error: "Only the buyer can create a payment intent." });
            return;
        }

        // Verify transaction is in correct status
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

        // Strict Check for Production/Real Users
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
            capture_method: 'manual', // <--- AUTH ONLY
            metadata: {
                transactionId: transactionId,
                userId: userId, // Use userId from authenticated token
            },
        };

        // Real Connect Logic
        paymentIntentData.transfer_data = {
            destination: seller.stripe_connect_id,
        };
        paymentIntentData.application_fee_amount = fee;

        const idempotencyKey = `pi_create_${transactionId}`;
        const paymentIntent = await stripe.paymentIntents.create(paymentIntentData, {
            idempotencyKey
        });

        await db.collection("transactions").doc(transactionId).update({
            payment_intent_id: paymentIntent.id,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Standard JSON Response
        res.status(200).json({
            clientSecret: paymentIntent.client_secret,
        });

    } catch (error) {
        handleError(res, error, "createPaymentIntent");
    }
});

// [Phase 13] Capture Payment (QR Scan)
export const capturePayment = functions.https.onCall(async (data, context) => {
    console.log("[capturePayment] INVOKED. Data:", JSON.stringify(data)); // Force Log Entry
    // [Phase 14] Capture Payment (Payment Intent)
    // 承認済み (approved) -> 支払い確定 (completed)
    try {
    // 1. Auth Check (Must be logged in)
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }
    const callerId = context.auth.uid;
    console.log(`[capturePayment] Request by ${callerId} for data:`, data);

    let transactionId: string;
    try {
        const params = CapturePaymentSchema.parse(data);
        transactionId = params.transactionId;
    } catch (e: any) {
        console.error(`[capturePayment] Validation Error:`, e);
        throw new functions.https.HttpsError('invalid-argument', 'Invalid parameters', e.errors);
    }

        // ===== Phase 1: Pre-flight (no Firestore Transaction yet) =====
        // 取引と権限を確認してから Stripe を呼ぶ。Stripe API を Firestore Tx の
        // 内側で呼ぶと、Stripe 遅延で Tx が 60s timeout に達した場合に
        // 「Stripe では capture 済み / DB は未更新」という整合性破壊が起きるため。
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

        // Idempotency: already completed → no-op success.
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

        // ===== Phase 2: Stripe Capture (outside any Firestore Transaction) =====
        try {
            await stripe.paymentIntents.capture(initialTx.payment_intent_id, {
                idempotencyKey: `pi_capture_${transactionId}`
            });
        } catch (stripeErr: any) {
            console.error("[capturePayment] Stripe Capture Failed", stripeErr);
            if (stripeErr.code === 'payment_intent_unexpected_state') {
                // Already captured or in a non-capturable state — proceed to DB sync.
                // (This is the idempotent re-run path.)
            } else if (stripeErr.code === 'request_timeout' || (stripeErr.statusCode && stripeErr.statusCode >= 500)) {
                throw new functions.https.HttpsError('unavailable', `Stripe temporarily unavailable: ${stripeErr.message}`);
            } else {
                throw new functions.https.HttpsError('aborted', `Stripe Error: ${stripeErr.message}`);
            }
        }

        // ===== Phase 3: Firestore commit (Stripe is already done) =====
        return await db.runTransaction(async (t) => {
            const txDoc = await t.get(txRef);
            if (!txDoc.exists) {
                throw new functions.https.HttpsError('not-found', "Transaction not found (post-capture)");
            }
            const tx = txDoc.data()!;

            // Idempotency at the transaction boundary too (covers webhook race).
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
        // Use 'aborted' to ensure the message is visible to the client (internal is masked in prod)
        throw new functions.https.HttpsError('aborted', `Server Crash: ${error.message || 'Unknown Error'} (Stack: ${error.stack?.substring(0, 100)})`);
    }
});

// [Phase 14] Unlock Transaction (Fallback / Manual)
// onRequest + Manual Auth (via API Route Proxy)
export const unlockTransaction = functions.https.onRequest(async (req, res) => {
    if (applyCors(req, res)) return;

    // 1. Method Check
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }

    // 2. Auth Check (Manual)
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

    // 3. Data Extraction (No 'data' wrapper)
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

        // Security (2026-05-16): Only the BUYER can unlock/complete. The seller
        // must not be able to capture funds on their own — that's a fraud vector
        // (seller could capture before buyer scans QR / agrees to receive).
        if (tx.buyer_id !== callerId) {
             console.warn(`Unlock denied: caller ${callerId} is not buyer ${tx.buyer_id} (tx: ${transactionId})`);
             res.status(403).json({ error: 'Permission denied: Only the buyer can complete this transaction.' });
             return;
        }

        // If payment intent exists and it's payment_pending, try to capture
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

        // Get Seller info for Unlock
        const sellerPrivateRef = db.collection("users").doc(tx.seller_id).collection("private_data").doc("profile");
        const sellerPrivateDoc = await sellerPrivateRef.get();
        
        let studentId = "unknown";
        let universityEmail = "unknown";
        if (sellerPrivateDoc.exists) {
            const pd = sellerPrivateDoc.data()!;
            studentId = pd.student_id;
            universityEmail = pd.university_email;
        }

        // Update status to 'completed' AND mark item as sold (in a batch for atomicity).
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

// [New] Cancel Transaction & Refund/Release
export const cancelTransaction = functions.https.onCall(async (data, context) => {
    // 1. Auth Check
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
            
            // 2. Permission Check
            // Buyer can cancel if 'request_sent' or 'approved' (before payment)
            // Seller can cancel anytime (but refund if paid)
            // Admins can cancel (context.auth.token.admin)
            
            const isBuyer = tx.buyer_id === callerId;
            const isSeller = tx.seller_id === callerId;
            
            if (!isBuyer && !isSeller) {
                throw new functions.https.HttpsError('permission-denied', "Not a participant.");
            }

            // State Check
            if (tx.status === 'cancelled') {
                throw new functions.https.HttpsError('failed-precondition', "Already cancelled.");
            }

            // Buyer Restriction: Cannot cancel if 'payment_pending' or 'completed' (Must ask Seller)
            // "payment_pending" means Auth Hold is on. Buyer "could" cancel, but better to prevent easy cancellation after commitment.
            // Let's allow Buyer to cancel 'payment_pending' ONLY IF we release hold.
            // Actually, for preventing trolls, maybe Buyer can cancel 'request_sent' and 'approved'.
            // Once 'payment_pending' (Auth), only Seller can cancel/refund? Or both?
            // Let's allow Buyer to cancel 'payment_pending' too (Release Auth) for MVP usability.
            // But if 'completed' (Captured), ONLY Seller can Refund.
            if (isBuyer && tx.status === 'completed') {
                throw new functions.https.HttpsError('permission-denied', "Buyer cannot cancel completed transaction. Contact Seller for refund.");
            }

            // 3. Stripe Processing
            const piId = tx.payment_intent_id;
            if (piId) {
                try {
                    const pi = await stripe.paymentIntents.retrieve(piId);
                    
                    if (pi.status === 'requires_capture') {
                        // Auth Hold -> Cancel Authorization
                        const idempotencyKey = `pi_cancel_${transactionId}`;
                        console.log(`Canceling Auth for ${piId}`);
                        await stripe.paymentIntents.cancel(piId, { idempotencyKey });
                    } else if (pi.status === 'succeeded') {
                        // Captured -> Refund
                        const idempotencyKey = `pi_refund_${transactionId}`;
                        console.log(`Refunding ${piId}`);
                        await stripe.refunds.create({
                            payment_intent: piId,
                            reason: 'requested_by_customer' // or 'fraudulent', 'duplicate'
                        }, { idempotencyKey });
                    }
                } catch (stripeError: any) {
                    console.error("Stripe Cancel Error:", stripeError);
                    // Check for "already canceled" or similar safe errors
                    if (!stripeError.message?.includes('canceled') && !stripeError.message?.includes('redundant')) {
                          handleCallableError(stripeError, "cancelTransaction-Stripe");
                    }
                }
            }

            // 4. Update Firestore
            // Transaction -> cancelled
            t.update(txRef, {
                status: 'cancelled',
                cancel_reason: reason || "User requested",
                cancelledBy: callerId,
                cancelledAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Item -> listing (Release item)
            // Only if item exists and matches this transaction
            const itemRef = db.collection("items").doc(tx.item_id);
            const itemDoc = await t.get(itemRef);
            if (itemDoc.exists) {
                t.update(itemRef, {
                    status: 'listing' // Back to market
                });
            }
        });

        return { success: true };

    } catch (e: any) { 
        return handleCallableError(e, "cancelTransaction");
    }
});

// [New] Rate User
export const rateUser = functions.https.onCall(async (data, context) => {
    // 1. Auth Check
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

        // 2. Permission Check: user must be buyer or seller
        let isBuyer = tx.buyer_id === uid;
        let isSeller = tx.seller_id === uid;

        if (!isBuyer && !isSeller) {
            throw new functions.https.HttpsError('permission-denied', 'Not a participant');
        }

        // [Debug/Self-Trade Fix] If User is BOTH (Self-Trade/Debug), rely on 'role' param if valid
        if (isBuyer && isSeller && role) {
            if (role === 'buyer') isSeller = false;
            else if (role === 'seller') isBuyer = false;
        }
        // Normal Case: If role is provided, verify it matches
        else if (role) {
            if (role === 'buyer' && !isBuyer) throw new functions.https.HttpsError('permission-denied', 'Role mismatch: claimed buyer but is not buyer');
            if (role === 'seller' && !isSeller) throw new functions.https.HttpsError('permission-denied', 'Role mismatch: claimed seller but is not seller');

            // Enforce single role operation
            if (role === 'buyer') isSeller = false;
            if (role === 'seller') isBuyer = false;
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
        // If I am Buyer, I rate Seller. If I am Seller, I rate Buyer.
        // In Self-Trade without Role override, this was ambiguous. Now 'isBuyer'/'isSeller' are mutually exclusive if 'role' was passed.
        const targetUserId = isBuyer ? tx.seller_id : tx.buyer_id;

        // 6. Update Target User & Transaction
        await db.runTransaction(async (t) => {
            const userRef = db.collection('users').doc(targetUserId);
            const userDoc = await t.get(userRef);

            const userData = userDoc.exists ? userDoc.data()! : {};
            const currentRatings = userData.ratings || { count: 0, total_score: 0 };

            const newCount = (currentRatings.count || 0) + 1;
            const newTotal = (currentRatings.total_score || 0) + score;
            // Calculate Trust Score (Simple Average 1-5)
            // Can be enhanced later with weights (e.g. recent transactions matter more)
            const newTrustScore = newTotal / newCount;

            // Update User
            t.set(userRef, {
                ratings: {
                    count: newCount,
                    total_score: newTotal
                },
                trustScore: newTrustScore
            }, { merge: true });

            // Mark transaction as rated
            const updateField = isBuyer ? { buyer_rated: true } : { seller_rated: true };
            t.update(txRef, updateField);
        });

        return { success: true };

    } catch (error: any) {
        return handleCallableError(error, "rateUser");
    }
});





// [New] Stripe Webhook
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

    // Handle Connect Account Updates (capability_updated etc)
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

    // Always respond 200 to acknowledge receipt (prevents Stripe infinite retries)
    res.status(200).json({ received: true });
});

// [Security] Blocking Function (Requires Identity Platform)
// To enable: Upgrade to Blaze Plan, Enable Identity Platform, and deploy this function.
/*
export const beforeSignIn = functions.auth.user().beforeSignIn((user, context) => {
    const allowedDomains = ['@stu.musashino-u.ac.jp', '@musashino-u.ac.jp'];
    if (user.email && !allowedDomains.some(d => user.email?.endsWith(d))) {
        throw new functions.auth.HttpsError('invalid-argument', 'Unauthorized email domain.');
    }
});
*/

// [Admin] Force Cancel Transaction
export const adminCancelTransaction = functions.https.onCall(async (data, context) => {
    // 1. Admin Check (2026-05-16: hardened to require Custom Claim)
    // Authoritative check: context.auth.token.admin === true (set via Admin SDK setCustomUserClaims)
    // Email-based fallback removed — even if an admin email is compromised, no admin powers without the claim.
    if (context.auth?.token.admin !== true) {
        throw new functions.https.HttpsError('permission-denied', 'Admin only.');
    }

    const { transactionId, reason } = data;
    if (!transactionId) throw new functions.https.HttpsError('invalid-argument', 'Missing transactionId');

    try {
        // ===== Phase 1: read tx without a Firestore Transaction =====
        // Stripe API は時に遅いので、Firestore Transaction の 60s ウィンドウから外す。
        const txRef = db.collection('transactions').doc(transactionId);
        const initialDoc = await txRef.get();
        if (!initialDoc.exists) throw new functions.https.HttpsError('not-found', 'Transaction not found');
        const initialTx = initialDoc.data()!;

        // Idempotency: 既に cancelled なら no-op.
        if (initialTx.status === 'cancelled') {
            return { success: true };
        }

        // ===== Phase 2: Stripe operation (outside any Firestore Transaction) =====
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
                // Stripe 側が失敗した場合、DB はそのままにして上位にエラーを返す。
                // 管理者が再試行 → idempotency key で安全。
                if (stripeError.code === 'request_timeout' || (stripeError.statusCode && stripeError.statusCode >= 500)) {
                    throw new functions.https.HttpsError('unavailable', `Stripe temporarily unavailable: ${stripeError.message}`);
                }
                throw new functions.https.HttpsError('internal', `Stripe Cancellation Failed: ${stripeError.message}`);
            }
        }

        // ===== Phase 3: Firestore commit (Stripe already done) =====
        await db.runTransaction(async (t) => {
            const txDoc = await t.get(txRef);
            if (!txDoc.exists) throw new functions.https.HttpsError('not-found', 'Transaction disappeared');
            const tx = txDoc.data()!;
            if (tx.status === 'cancelled') return; // race: someone else already cancelled.

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

// [Anti-Abuse] Rate Limiter Helper
async function checkRateLimit(userId: string, action: string, limit: number, windowSeconds: number) {
    const now = admin.firestore.Timestamp.now();
    const windowStart = new admin.firestore.Timestamp(now.seconds - windowSeconds, 0);

    const logsRef = db.collection('user_limits').doc(userId).collection('logs');

    // 1. Clean up old logs (Deferred or simple query?)
    // For MVP active strict limit, we count documents in window.
    // Index required: `userId` (parent) + `action` + `timestamp`
    const q = logsRef
        .where('action', '==', action)
        .where('timestamp', '>', windowStart);

    const snapshot = await q.get();

    if (snapshot.size >= limit) {
        throw new functions.https.HttpsError('resource-exhausted', `Rate limit exceeded for ${action}. Please try again later.`);
    }

    // 2. Add new log
    await logsRef.add({
        action: action,
        timestamp: now
    });
}

// [Admin] fixSellerStatus REMOVED (2026-05-16) - 本番にあってはいけない dev ショートカット
// この関数は `acct_mock_${uid}` というモックの Stripe Connect ID を生成して
// `charges_enabled: true` を手動セットしていた。管理者であれば任意ユーザーの
// KYC を擬似的に通せてしまうため、本番デプロイ前に削除した。
// 復旧用途で必要になった場合は、Stripe API 経由で実際の charges_enabled を
// 読み戻して反映する別関数として、admin allow-list 付きで作り直すこと。

// [Phase 2] Notifications
export * from "./notifications";
