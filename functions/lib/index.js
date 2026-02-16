"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminCancelTransaction = exports.stripeWebhook = exports.rateUser = exports.cancelTransaction = exports.unlockTransaction = exports.capturePayment = exports.createPaymentIntent = exports.cancelStaleTransactions = exports.syncStripeStatus = exports.createStripeLoginLink = exports.executeStripeConnect = void 0;
// Load Environment Variables
require('dotenv').config();
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const stripe_1 = require("stripe");
const config_1 = require("./config");
// Debug Env
// console.log("Stripe Key Configured:", !!functions.config().stripe);
const config = functions.config();
const stripeSecret = ((_a = config.stripe) === null || _a === void 0 ? void 0 : _a.secret) || process.env.STRIPE_SECRET_KEY;
if (!stripeSecret) {
    console.warn("Stripe Config is missing! Run: firebase functions:config:set stripe.secret='sk_test_...' or set STRIPE_SECRET_KEY in functions/.env");
}
const stripe = new stripe_1.default(stripeSecret || "dummy_key_check_env", {
    apiVersion: "2024-06-20",
});
admin.initializeApp();
const db = admin.firestore();
const zod_1 = require("zod");
const utils_1 = require("./utils");
const errorUtils_1 = require("./errorUtils");
// [New] Create Stripe Connect Account
const CreateAccountSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    returnUrl: zod_1.z.string().url().optional(),
    refreshUrl: zod_1.z.string().url().optional(),
});
const CreatePaymentIntentSchema = zod_1.z.object({
    transactionId: zod_1.z.string().min(1),
});
const CapturePaymentSchema = zod_1.z.object({
    transactionId: zod_1.z.string().min(1),
});
const UnlockTransactionSchema = zod_1.z.object({
    transactionId: zod_1.z.string().min(1),
});
const CancelTransactionSchema = zod_1.z.object({
    transactionId: zod_1.z.string().min(1),
    reason: zod_1.z.string().optional(),
});
const RateUserSchema = zod_1.z.object({
    transactionId: zod_1.z.string().min(1),
    score: zod_1.z.number().min(1).max(5),
    role: zod_1.z.enum(['buyer', 'seller']).optional(),
});
// Manual CORS Helper
// Manual CORS Helper
const applyCors = (req, res) => {
    const origin = req.headers.origin;
    if (origin && config_1.allowedOrigins.includes(origin)) {
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
exports.executeStripeConnect = functions.https.onRequest(async (req, res) => {
    var _a, _b;
    if (applyCors(req, res))
        return;
    // 1. Auth Check
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).send('Unauthorized');
        return;
    }
    const idToken = authHeader.split('Bearer ')[1];
    let userId;
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken, true);
        userId = decodedToken.uid;
    }
    catch (error) {
        if (error.code === 'auth/id-token-revoked') {
            res.status(401).send('Token has been revoked. Please re-authenticate.');
        }
        else {
            res.status(401).send('Invalid Token');
        }
        return;
    }
    try {
        // 2. Extract Data
        const body = CreateAccountSchema.parse(req.body);
        const { email, returnUrl, refreshUrl } = body;
        // Check if user already has a Stripe Connect account
        const privateDoc = await db.collection('users').doc(userId).collection('private_data').doc('profile').get();
        const existingStripeId = privateDoc.exists ? (_a = privateDoc.data()) === null || _a === void 0 ? void 0 : _a.stripe_connect_id : null;
        let accountId;
        if (existingStripeId) {
            // Already has an account - reuse it (generate new onboarding link)
            console.log(`[Stripe Connect] User ${userId} already has account ${existingStripeId}, generating new link`);
            accountId = existingStripeId;
        }
        else {
            // 3. Create new Account
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
        const appUrl = ((_b = functions.config().app) === null || _b === void 0 ? void 0 : _b.url) || "http://localhost:3000";
        const itemsUrl = `${appUrl}/seller/payout`;
        const accountLink = await stripe.accountLinks.create({
            account: accountId,
            refresh_url: refreshUrl || itemsUrl,
            return_url: returnUrl || itemsUrl,
            type: 'account_onboarding',
        });
        res.status(200).json({ url: accountLink.url });
    }
    catch (e) {
        (0, errorUtils_1.handleError)(res, e, "executeStripeConnect");
    }
});
exports.createStripeLoginLink = functions.https.onCall(async (data, context) => {
    var _a;
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
        const stripeConnectId = (_a = profileSnap.data()) === null || _a === void 0 ? void 0 : _a.stripe_connect_id;
        if (!stripeConnectId) {
            throw new functions.https.HttpsError('failed-precondition', 'Stripe ID missing in profile.');
        }
        // 3. Create Link
        const link = await stripe.accounts.createLoginLink(stripeConnectId);
        return { url: link.url };
    }
    catch (e) {
        return (0, errorUtils_1.handleCallableError)(e, "createStripeLoginLink");
    }
});
// Stripe Connect ステータスを手動同期する関数
// Webhook が届かない場合やページ復帰時にフロントから呼ばれる
exports.syncStripeStatus = functions.https.onCall(async (data, context) => {
    var _a;
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
        const stripeConnectId = (_a = privateSnap.data()) === null || _a === void 0 ? void 0 : _a.stripe_connect_id;
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
            updatedAt: admin.firestore.Timestamp.now()
        }, { merge: true });
        batch.set(privateRef, {
            stripe_connect_id: stripeConnectId,
            charges_enabled: chargesEnabled,
            updatedAt: admin.firestore.Timestamp.now()
        }, { merge: true });
        await batch.commit();
        console.log(`[syncStripeStatus] User ${userId} → charges_enabled: ${chargesEnabled}`);
        return { status: chargesEnabled ? 'active' : 'pending', charges_enabled: chargesEnabled };
    }
    catch (e) {
        return (0, errorUtils_1.handleCallableError)(e, "syncStripeStatus");
    }
});
// 24時間反応がない取引を自動キャンセルする定時実行関数
// 実行頻度: 60分ごと
// 24時間反応がない取引を自動キャンセルする定時実行関数
// 実行頻度: 60分ごと
exports.cancelStaleTransactions = functions.pubsub.schedule("every 60 minutes").onRun(async (context) => {
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
                }
                else {
                    console.warn(`[Stripe] PI ${tx.payment_intent_id} status is ${pi.status}, skipping cancel.`);
                }
            }
            catch (stripeError) {
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
const constants_1 = require("./constants");
// ... existing code ...
// Helper function to process unlock (shared by direct call and webhook)
async function processUnlock(transactionId, userId, paymentIntentId, t) {
    const txRef = db.collection("transactions").doc(transactionId);
    const txDoc = await t.get(txRef);
    if (!txDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Transaction not found.');
    }
    const tx = txDoc.data();
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
    // Get Seller info for Unlock（個人情報は private_data のみから取得）
    const sellerPrivateRef = db.collection("users").doc(tx.seller_id).collection("private_data").doc("profile");
    const sellerPrivateDoc = await t.get(sellerPrivateRef);
    let studentId = "private";
    let universityEmail = "private";
    if (sellerPrivateDoc.exists) {
        const privateData = sellerPrivateDoc.data();
        studentId = privateData.student_id || privateData.email || studentId;
        universityEmail = privateData.university_email || privateData.email || universityEmail;
    }
    // 2. Unlock & Update Transaction
    t.update(txRef, {
        status: 'completed',
        fee_amount: constants_1.SYSTEM_FEE,
        unlocked_assets: {
            student_id: studentId,
            university_email: universityEmail,
            unlockedAt: admin.firestore.Timestamp.now()
        },
        updatedAt: admin.firestore.Timestamp.now()
    });
    // Deduct coin logic is REMOVED/SKIPPED for Direct Stripe Payment
    // We only unlock.
    return { success: true, message: "Transaction unlocked." };
}
// [Phase 11] Create Payment Intent (Platform-Held / Hybrid)
// onRequest + Manual Auth (via API Route Proxy)
exports.createPaymentIntent = functions.https.onRequest(async (req, res) => {
    if (applyCors(req, res))
        return;
    // 1. Method Check
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }
    // 2. Auth Check (Manual)
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).send('Unauthorized: Missing or invalid token');
        return;
    }
    const idToken = authHeader.split('Bearer ')[1];
    let userId;
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken, true);
        userId = decodedToken.uid;
    }
    catch (error) {
        console.error("Auth Error:", error);
        if (error.code === 'auth/id-token-revoked') {
            res.status(401).send('Unauthorized: Token has been revoked');
        }
        else {
            res.status(401).send('Unauthorized: Invalid token');
        }
        return;
    }
    // 3. Data Extraction
    let transactionId;
    try {
        const body = CreatePaymentIntentSchema.parse(req.body);
        transactionId = body.transactionId;
    }
    catch (e) {
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
        const tx = txDoc.data();
        const sellerDoc = await db.collection('users').doc(tx.seller_id).get();
        if (!sellerDoc.exists) {
            res.status(404).json({ error: "Seller not found" });
            return;
        }
        const seller = sellerDoc.data();
        if (!seller.stripe_connect_id || !seller.charges_enabled) {
            res.status(400).json({ error: "Seller is not ready to receive payments." });
            return;
        }
        const itemDoc = await db.collection('items').doc(tx.item_id).get();
        const item = itemDoc.data();
        const amount = item.price;
        const fee = (0, utils_1.calculateFee)(amount);
        // [Beta Strategy] Check if Seller is Mock
        const isMockSeller = seller.stripe_connect_id.startsWith('acct_mock_');
        const paymentIntentData = {
            amount: amount,
            currency: 'jpy',
            automatic_payment_methods: { enabled: true },
            capture_method: 'manual',
            metadata: {
                transactionId: transactionId,
                userId: userId, // Use userId from authenticated token
            },
        };
        if (isMockSeller) {
            console.log(`[Beta] Payment for Mock Seller ${seller.stripe_connect_id}. Money held by Platform.`);
            // DO NOT set transfer_data. Funds stay in Platform Account.
        }
        else {
            // Real Connect Logic
            paymentIntentData.transfer_data = {
                destination: seller.stripe_connect_id,
            };
            paymentIntentData.application_fee_amount = fee;
        }
        const idempotencyKey = `pi_create_${transactionId}`;
        const paymentIntent = await stripe.paymentIntents.create(paymentIntentData, {
            idempotencyKey
        });
        await db.collection("transactions").doc(transactionId).update({
            payment_intent_id: paymentIntent.id,
            updatedAt: admin.firestore.Timestamp.now()
        });
        // Standard JSON Response
        res.status(200).json({
            clientSecret: paymentIntent.client_secret,
        });
    }
    catch (error) {
        (0, errorUtils_1.handleError)(res, error, "createPaymentIntent");
    }
});
// [Phase 13] Capture Payment (QR Scan)
exports.capturePayment = functions.https.onCall(async (data, context) => {
    // 1. Auth Check (Must be logged in)
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }
    const callerId = context.auth.uid;
    let transactionId;
    try {
        const params = CapturePaymentSchema.parse(data);
        transactionId = params.transactionId;
    }
    catch (e) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid parameters', e.errors);
    }
    return db.runTransaction(async (t) => {
        const txRef = db.collection("transactions").doc(transactionId);
        const txDoc = await t.get(txRef);
        if (!txDoc.exists)
            throw new functions.https.HttpsError('not-found', "Transaction not found");
        const tx = txDoc.data();
        // 2. Authorization Check (Buyer Only - Inverted Flow)
        // The Buyer scans the Seller's QR to confirm receipt and trigger the payment capture.
        if (tx.buyer_id !== callerId) {
            throw new functions.https.HttpsError('permission-denied', "Only the buyer can capture/confirm receipt.");
        }
        // Check if status is payment_pending (Auth done)
        if (tx.status !== 'payment_pending') {
            // If already completed, return success (idempotency)
            if (tx.status === 'completed')
                return { success: true };
            throw new functions.https.HttpsError('failed-precondition', "Transaction not in pending state.");
        }
        const paymentIntentId = tx.payment_intent_id;
        if (!paymentIntentId)
            throw new functions.https.HttpsError('failed-precondition', "No payment link found.");
        try {
            // CAPTURE
            // Use tx.buyer_id + timestamp logic isn't perfect for idempotency if retrying same request.
            // Best is to use transaction ID. capture is 1-to-1 with paymentintent usually.
            const idempotencyKey = `pi_capture_${transactionId}`;
            const capturedInfo = await stripe.paymentIntents.capture(paymentIntentId, {}, {
                idempotencyKey
            });
            if (capturedInfo.status === 'succeeded') {
                // Update Transaction（個人情報は private_data のみから取得）
                const sellerPrivateRef = db.collection("users").doc(tx.seller_id).collection("private_data").doc("profile");
                const sellerPrivateDoc = await t.get(sellerPrivateRef);
                let studentId = "private";
                let universityEmail = "private";
                if (sellerPrivateDoc.exists) {
                    const privateData = sellerPrivateDoc.data();
                    studentId = privateData.student_id || privateData.email || studentId;
                    universityEmail = privateData.university_email || privateData.email || universityEmail;
                }
                t.update(txRef, {
                    status: 'completed',
                    unlocked_assets: {
                        student_id: studentId,
                        university_email: universityEmail,
                        unlockedAt: admin.firestore.Timestamp.now()
                    },
                    updatedAt: admin.firestore.Timestamp.now()
                });
                return { success: true };
            }
            else {
                throw new Error("Capture failed status: " + capturedInfo.status);
            }
        }
        catch (e) {
            // Use handleCallableError, but inside transaction we might need to re-throw specific way?
            // Actually handleCallableError throws HttpsError, which aborts transaction properly.
            return (0, errorUtils_1.handleCallableError)(e, "capturePayment");
        }
    });
});
// [Phase 14] Unlock Transaction (Fallback / Manual)
// onRequest + Manual Auth (via API Route Proxy)
exports.unlockTransaction = functions.https.onRequest(async (req, res) => {
    if (applyCors(req, res))
        return;
    // 1. Method Check
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }
    // 2. Auth Check (Manual)
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).send('Unauthorized: Missing or invalid token');
        return;
    }
    const idToken = authHeader.split('Bearer ')[1];
    let callerId;
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken, true);
        callerId = decodedToken.uid;
    }
    catch (error) {
        console.error("Unlock Auth Error:", error);
        if (error.code === 'auth/id-token-revoked') {
            res.status(401).send('Unauthorized: Token has been revoked');
        }
        else {
            res.status(401).send('Unauthorized: Invalid token');
        }
        return;
    }
    // 3. Data Extraction (No 'data' wrapper)
    let transactionId;
    try {
        const body = UnlockTransactionSchema.parse(req.body);
        transactionId = body.transactionId;
    }
    catch (e) {
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
        const tx = txDoc.data();
        // Security: Check if caller is involved in transaction?
        // Security: Check if caller is involved in transaction?
        if (tx.buyer_id !== callerId && tx.seller_id !== callerId) {
            console.warn(`Unlock attempt by unrelated user: ${callerId} for tx: ${transactionId}`);
            res.status(403).json({ error: 'Permission denied: You are not a participant in this transaction.' });
            return;
        }
        // Update status to 'completed'
        await txRef.update({
            status: 'completed',
            unlockedAt: admin.firestore.Timestamp.now()
        });
        res.status(200).json({ success: true, message: 'Transaction unlocked' });
    }
    catch (error) {
        (0, errorUtils_1.handleError)(res, error, "unlockTransaction");
    }
});
// [New] Cancel Transaction & Refund/Release
exports.cancelTransaction = functions.https.onCall(async (data, context) => {
    // 1. Auth Check
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }
    const callerId = context.auth.uid;
    let transactionId;
    let reason;
    try {
        const params = CancelTransactionSchema.parse(data);
        transactionId = params.transactionId;
        reason = params.reason;
    }
    catch (e) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid parameters', e.errors);
    }
    try {
        await db.runTransaction(async (t) => {
            var _a, _b;
            const txRef = db.collection("transactions").doc(transactionId);
            const txDoc = await t.get(txRef);
            if (!txDoc.exists)
                throw new functions.https.HttpsError('not-found', "Transaction not found");
            const tx = txDoc.data();
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
                    }
                    else if (pi.status === 'succeeded') {
                        // Captured -> Refund
                        const idempotencyKey = `pi_refund_${transactionId}`;
                        console.log(`Refunding ${piId}`);
                        await stripe.refunds.create({
                            payment_intent: piId,
                            reason: 'requested_by_customer' // or 'fraudulent', 'duplicate'
                        }, { idempotencyKey });
                    }
                }
                catch (stripeError) {
                    console.error("Stripe Cancel Error:", stripeError);
                    // Check for "already canceled" or similar safe errors
                    if (!((_a = stripeError.message) === null || _a === void 0 ? void 0 : _a.includes('canceled')) && !((_b = stripeError.message) === null || _b === void 0 ? void 0 : _b.includes('redundant'))) {
                        (0, errorUtils_1.handleCallableError)(stripeError, "cancelTransaction-Stripe");
                    }
                }
            }
            // 4. Update Firestore
            // Transaction -> cancelled
            t.update(txRef, {
                status: 'cancelled',
                cancel_reason: reason || "User requested",
                cancelledBy: callerId,
                cancelledAt: admin.firestore.Timestamp.now()
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
    }
    catch (e) {
        return (0, errorUtils_1.handleCallableError)(e, "cancelTransaction");
    }
});
// [New] Rate User
exports.rateUser = functions.https.onCall(async (data, context) => {
    // 1. Auth Check
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
    }
    const uid = context.auth.uid;
    let transactionId;
    let score;
    let role;
    try {
        const params = RateUserSchema.parse(data);
        transactionId = params.transactionId;
        score = params.score;
        role = params.role;
    }
    catch (e) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid parameters', e.errors);
    }
    try {
        const txRef = admin.firestore().collection('transactions').doc(transactionId);
        const txSnap = await txRef.get();
        if (!txSnap.exists)
            throw new functions.https.HttpsError('not-found', 'Transaction not found');
        const tx = txSnap.data();
        // 2. Permission Check: user must be buyer or seller
        let isBuyer = tx.buyer_id === uid;
        let isSeller = tx.seller_id === uid;
        if (!isBuyer && !isSeller) {
            throw new functions.https.HttpsError('permission-denied', 'Not a participant');
        }
        // [Debug/Self-Trade Fix] If User is BOTH (Self-Trade/Debug), rely on 'role' param if valid
        if (isBuyer && isSeller && role) {
            if (role === 'buyer')
                isSeller = false;
            else if (role === 'seller')
                isBuyer = false;
        }
        // Normal Case: If role is provided, verify it matches
        else if (role) {
            if (role === 'buyer' && !isBuyer)
                throw new functions.https.HttpsError('permission-denied', 'Role mismatch: claimed buyer but is not buyer');
            if (role === 'seller' && !isSeller)
                throw new functions.https.HttpsError('permission-denied', 'Role mismatch: claimed seller but is not seller');
            // Enforce single role operation
            if (role === 'buyer')
                isSeller = false;
            if (role === 'seller')
                isBuyer = false;
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
            const userData = userDoc.exists ? userDoc.data() : {};
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
    }
    catch (error) {
        return (0, errorUtils_1.handleCallableError)(error, "rateUser");
    }
});
// [New] Stripe Webhook
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = functions.config().stripe ? functions.config().stripe.webhook_secret : "";
    let event;
    try {
        if (!sig || !endpointSecret)
            throw new Error("Missing signature or secret");
        event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
    }
    catch (err) {
        console.error(`Webhook Error: ${err.message}`);
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }
    // Handle Connect Account Updates (capability_updated etc)
    if (event.type === 'account.updated') {
        const account = event.data.object;
        if (account.charges_enabled) {
            try {
                // 1. Lookup User ID
                const mapDoc = await db.collection('stripe_accounts').doc(account.id).get();
                if (mapDoc.exists) {
                    const userId = mapDoc.data().userId;
                    // 2. Update both Public and Private profiles
                    const userRef = db.collection('users').doc(userId);
                    const privateProfileRef = userRef.collection('private_data').doc('profile');
                    const batch = db.batch();
                    batch.set(userRef, {
                        stripe_connect_id: account.id,
                        charges_enabled: true,
                        updatedAt: admin.firestore.Timestamp.now()
                    }, { merge: true });
                    batch.set(privateProfileRef, {
                        stripe_connect_id: account.id,
                        charges_enabled: true,
                        updatedAt: admin.firestore.Timestamp.now()
                    }, { merge: true });
                    await batch.commit();
                    console.log(`User ${userId} charges enabled via Connect (Webhook). Updated both public & private.`);
                }
                else {
                    console.warn(`Stripe ID ${account.id} not found in lookup map.`);
                }
            }
            catch (e) {
                console.error("Webhook Account Update Error", e);
            }
        }
    }
    if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object;
        const transactionId = paymentIntent.metadata.transactionId;
        const userId = paymentIntent.metadata.userId;
        if (transactionId && userId) {
            console.log(`Webhook Processing: Unlock ${transactionId} for ${userId}`);
            try {
                await db.runTransaction(async (t) => {
                    await processUnlock(transactionId, userId, paymentIntent.id, t);
                });
                console.log('Webhook: Successfully Unlocked');
            }
            catch (e) {
                console.error("Webhook Unlock Failed", e);
                // Return 500 so Stripe retries
                res.status(500).send("Unlock Failed");
                return;
            }
        }
    }
});
// [Security] Blocking Function (Requires Identity Platform)
// To enable: Upgrade to Blaze Plan, Enable Identity Platform, and deploy this function.
/*
export const beforeSignIn = functions.auth.user().beforeSignIn((user, context) => {
    const allowedDomains = ['@stu.musashino-u.ac.jp', '@musashino-u.ac.jp'];
    if (user.email && !allowedDomains.some(d => user.email?.endsWith(d)) && user.email !== 'demo@musashino-u.ac.jp') {
        throw new functions.auth.HttpsError('invalid-argument', 'Unauthorized email domain.');
    }
});
*/
// [Admin] Force Cancel Transaction
exports.adminCancelTransaction = functions.https.onCall(async (data, context) => {
    var _a;
    // 1. Admin Check
    // In production, verify custom claim: context.auth?.token.admin === true
    // For MVP, check specific email or just allow if authenticated (since only Admin UI calls it? No, insecure)
    // We'll use the hardcoded email check for now to match firestore.rules
    const email = (_a = context.auth) === null || _a === void 0 ? void 0 : _a.token.email;
    if (email !== "admin@musashino-u.ac.jp" && email !== "fumi_admin@musashino-u.ac.jp") {
        throw new functions.https.HttpsError('permission-denied', 'Admin only.');
    }
    const { transactionId, reason } = data;
    if (!transactionId)
        throw new functions.https.HttpsError('invalid-argument', 'Missing transactionId');
    try {
        await db.runTransaction(async (t) => {
            const txRef = db.collection('transactions').doc(transactionId);
            const txDoc = await t.get(txRef);
            if (!txDoc.exists)
                throw new functions.https.HttpsError('not-found', 'Transaction not found');
            const tx = txDoc.data();
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
                    }
                    else if (pi.status === 'succeeded') {
                        await stripe.refunds.create({ payment_intent: tx.payment_intent_id });
                        stripeAction = "refunded";
                    }
                    else {
                        console.warn(`Stripe PI status is ${pi.status}, skipping action.`);
                    }
                }
                catch (stripeError) {
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
    }
    catch (e) {
        console.error("Admin Cancel Error", e);
        throw new functions.https.HttpsError('internal', e.message);
    }
});
// [Anti-Abuse] Rate Limiter Helper
async function checkRateLimit(userId, action, limit, windowSeconds) {
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
// [Debug] Fix Seller Status Manually
exports.fixSellerStatus = functions.https.onRequest(async (req, res) => {
    const email = req.query.email;
    if (!email) {
        res.status(400).send("Missing email query param");
        return;
    }
    try {
        const userRecord = await admin.auth().getUserByEmail(email);
        const uid = userRecord.uid;
        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();
        if (!userDoc.exists) {
            res.status(404).send(`User doc not found for ${email} (${uid})`);
            return;
        }
        const data = userDoc.data();
        await userRef.update({
            stripe_connect_id: data.stripe_connect_id || `acct_mock_${uid}`,
            charges_enabled: true,
            updatedAt: admin.firestore.Timestamp.now()
        });
        res.status(200).send(`Fixed seller status for ${email} (${uid}). Charges enabled.`);
    }
    catch (error) {
        console.error("Fix Seller Error", error);
        res.status(500).send(error.message);
    }
});
// [Phase 2] Notifications
__exportStar(require("./notifications"), exports);
//# sourceMappingURL=index.js.map