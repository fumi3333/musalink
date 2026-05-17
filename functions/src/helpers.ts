// 複数の Cloud Functions で共有されるヘルパー（CORS, スキーマ, 認可, processUnlock, rate limiter）

import * as functions from "firebase-functions";
import { z } from "zod";
import { allowedOrigins } from "./config";
import { calculateFee } from "./utils";
import { admin, db } from "./init";

// ============================================================
// CORS
// ============================================================
export const applyCors = (req: functions.https.Request, res: functions.Response) => {
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

// ============================================================
// Zod schemas (callable / onRequest payload validation)
// ============================================================
export const CreateAccountSchema = z.object({
    email: z.string().email(),
    returnUrl: z.string().url().optional(),
    refreshUrl: z.string().url().optional(),
});

export const CreatePaymentIntentSchema = z.object({
    transactionId: z.string().min(1),
});

export const CapturePaymentSchema = z.object({
    transactionId: z.string().min(1),
});

export const UnlockTransactionSchema = z.object({
    transactionId: z.string().min(1),
});

export const CancelTransactionSchema = z.object({
    transactionId: z.string().min(1),
    reason: z.string().optional(),
});

export const RateUserSchema = z.object({
    transactionId: z.string().min(1),
    score: z.number().min(1).max(5),
    role: z.enum(['buyer', 'seller']).optional(),
});

// ============================================================
// processUnlock — 取引完了 + アンロックを Firestore Transaction の内側で実行
// 直接呼び出し (capturePayment) / Stripe webhook (payment_intent.succeeded) の両方から共有。
// ============================================================
export async function processUnlock(
    transactionId: string,
    userId: string,
    paymentIntentId: string,
    t: admin.firestore.Transaction
) {
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

    // Unlock & Update Transaction
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

    // Mark the item as sold so it disappears from listings and stays
    // logically consistent ("matching" means still in negotiation).
    if (itemDoc.exists) {
        t.update(itemRef, {
            status: 'sold',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    }

    return { success: true, message: "Transaction unlocked." };
}

// ============================================================
// Rate Limiter — sliding-window count via user_limits/{uid}/logs
// ============================================================
export async function checkRateLimit(
    userId: string,
    action: string,
    limit: number,
    windowSeconds: number
) {
    const now = admin.firestore.Timestamp.now();
    const windowStart = new admin.firestore.Timestamp(now.seconds - windowSeconds, 0);

    const logsRef = db.collection('user_limits').doc(userId).collection('logs');

    const q = logsRef
        .where('action', '==', action)
        .where('timestamp', '>', windowStart);

    const snapshot = await q.get();

    if (snapshot.size >= limit) {
        throw new functions.https.HttpsError('resource-exhausted', `Rate limit exceeded for ${action}. Please try again later.`);
    }

    await logsRef.add({
        action: action,
        timestamp: now
    });
}
