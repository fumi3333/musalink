// 本人確認 (Identity Verification) — server-side write of is_verified / trust_score / ratings.
//
// 経緯 (2026-05-17): field-lockdown でクライアントから is_verified を書けなくなったため
// Auth Token から email を取得 → @stu.musashino-u.ac.jp 検証 → 学籍番号抽出 → サーバー側で書き込み

import * as functions from "firebase-functions";
import { admin, db } from "./init";
import { handleCallableError } from "./errorUtils";

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
        throw new functions.https.HttpsError(
            'permission-denied',
            '武蔵野大学の学生メール (@stu.musashino-u.ac.jp) でログインしてください。'
        );
    }

    const studentId = match[1];

    try {
        const userRef = db.collection('users').doc(uid);
        const privateRef = userRef.collection('private_data').doc('profile');

        const userSnap = await userRef.get();
        const isFirstVerify = !userSnap.exists || !userSnap.data()?.is_verified;

        const publicUpdate: any = {
            id: uid,
            is_verified: true,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        // 初回 verify 時のみ trust_score / ratings を初期化（共にサーバー専用 lockdown フィールド）
        if (isFirstVerify) {
            publicUpdate.trust_score = 5.0;
            publicUpdate.ratings = { count: 0, sum: 0 };
        }

        const batch = db.batch();
        batch.set(userRef, publicUpdate, { merge: true });
        batch.set(privateRef, {
            student_id: studentId,
            university_email: email,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        await batch.commit();

        console.log(`[verifyUserIdentity] User ${uid} verified with student_id ${studentId} (firstVerify: ${isFirstVerify})`);
        return { success: true, student_id: studentId };
    } catch (e) {
        return handleCallableError(e, "verifyUserIdentity");
    }
});
