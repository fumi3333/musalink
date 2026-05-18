// 本人確認 (Identity Verification)
//
// フロー (2026-05-18): 個人 Gmail でログイン後、大学メールに OTP を送って在学証明する
//   1. sendUniversityOTP   — 大学メール宛に 6 桁コードを送信
//   2. verifyUniversityOTP — コード照合 → is_verified=true + Custom Claim verified:true
//
// IDOR 防止:
//   - uid は ID Token から取得（クライアント提供値は使わない）
//   - otp_verifications/{uid} / otp_rate_limits/{uid} は Firestore Rules でクライアントアクセス禁止

import * as functions from "firebase-functions";
import { admin, db } from "./init";
import { handleCallableError } from "./errorUtils";
import { defineSecret } from "firebase-functions/params";
import * as crypto from "crypto";
import * as nodemailer from "nodemailer";

const gmailEmail = defineSecret("GMAIL_EMAIL");
const gmailPassword = defineSecret("GMAIL_PASSWORD");

// ── OTP 送信 ──────────────────────────────────────────────────────────────
// IDOR check: uid = ID Token から取得。大学ドメイン以外は弾く。レート制限 3回/時。
export const sendUniversityOTP = functions
    .runWith({ secrets: [gmailEmail, gmailPassword] })
    .https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError("unauthenticated", "ログインが必要です。");
        }

        const uid = context.auth.uid;
        const universityEmail = String(data?.universityEmail || "").trim().toLowerCase();

        if (!/^[a-zA-Z0-9._%+\-]+@stu\.musashino-u\.ac\.jp$/.test(universityEmail)) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "武蔵野大学の学生メール (@stu.musashino-u.ac.jp) を入力してください。"
            );
        }

        // レート制限: 1時間に3回まで
        const rateLimitRef = db.collection("otp_rate_limits").doc(uid);
        const rateLimitSnap = await rateLimitRef.get();
        const now = Date.now();
        const sends: number[] = rateLimitSnap.exists
            ? (rateLimitSnap.data()?.sends || []).filter((t: number) => now - t < 3_600_000)
            : [];

        if (sends.length >= 3) {
            throw new functions.https.HttpsError(
                "resource-exhausted",
                "1時間に送信できるOTPは3回までです。しばらくしてから再試行してください。"
            );
        }
        await rateLimitRef.set({ sends: [...sends, now] });

        // OTP 生成・ハッシュ化（平文は Firestore に保存しない）
        const otp = Math.floor(100_000 + Math.random() * 900_000).toString();
        const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
        const expiresAt = admin.firestore.Timestamp.fromDate(new Date(now + 15 * 60 * 1000));

        await db.collection("otp_verifications").doc(uid).set({
            otp_hash: otpHash,
            university_email: universityEmail,
            expires_at: expiresAt,
            attempts: 0,
        });

        // メール送信
        const transport = nodemailer.createTransport({
            service: "gmail",
            auth: { user: gmailEmail.value(), pass: gmailPassword.value() },
        });
        await transport.sendMail({
            from: `"Musalink" <${gmailEmail.value()}>`,
            to: universityEmail,
            subject: "【Musalink】在学確認コード",
            text: [
                "Musalinkの在学確認コードです。",
                "",
                `認証コード: ${otp}`,
                "",
                "有効期限: 15分",
                "このメールに心当たりがない場合は無視してください。",
                "",
                "Musalink — 武蔵野大学学生専用マーケットプレイス",
            ].join("\n"),
        });

        console.log(`[sendUniversityOTP] Sent OTP to ${universityEmail} for uid ${uid}`);
        return { success: true };
    });

// ── OTP 照合・認証完了 ────────────────────────────────────────────────────
// IDOR check: uid = ID Token から取得。照合成功後に Custom Claim verified:true を付与。
export const verifyUniversityOTP = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "ログインが必要です。");
    }

    const uid = context.auth.uid;
    const otp = String(data?.otp || "").trim();

    if (!/^\d{6}$/.test(otp)) {
        throw new functions.https.HttpsError("invalid-argument", "6桁の数字を入力してください。");
    }

    const otpRef = db.collection("otp_verifications").doc(uid);
    const otpSnap = await otpRef.get();

    if (!otpSnap.exists) {
        throw new functions.https.HttpsError(
            "not-found",
            "認証コードが見つかりません。再度送信してください。"
        );
    }

    const otpData = otpSnap.data()!;

    // 期限チェック
    if ((otpData.expires_at as admin.firestore.Timestamp).toDate() < new Date()) {
        await otpRef.delete();
        throw new functions.https.HttpsError(
            "deadline-exceeded",
            "認証コードの有効期限が切れました。再度送信してください。"
        );
    }

    // 試行回数チェック（5回超えたら無効化）
    if (otpData.attempts >= 5) {
        await otpRef.delete();
        throw new functions.https.HttpsError(
            "resource-exhausted",
            "試行回数が上限に達しました。再度送信してください。"
        );
    }

    await otpRef.update({ attempts: admin.firestore.FieldValue.increment(1) });

    // OTP 照合
    const inputHash = crypto.createHash("sha256").update(otp).digest("hex");
    if (inputHash !== otpData.otp_hash) {
        throw new functions.https.HttpsError("invalid-argument", "認証コードが正しくありません。");
    }

    // ── 照合成功 ──────────────────────────────────────────────────────────
    const universityEmail: string = otpData.university_email;
    const match = universityEmail.match(/^([a-zA-Z0-9]+)@stu\.musashino-u\.ac\.jp$/);
    const studentId = match ? match[1] : "";
    const grade = calculateGradeFromEmail(universityEmail);

    const userRef = db.collection("users").doc(uid);
    const privateRef = userRef.collection("private_data").doc("profile");

    const userSnap = await userRef.get();
    const isFirstVerify = !userSnap.exists || !userSnap.data()?.is_verified;

    const publicUpdate: Record<string, unknown> = {
        id: uid,
        is_verified: true,
        universityId: "musashino",
        grade,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (isFirstVerify) {
        publicUpdate.trust_score = 5.0;
        publicUpdate.ratings = { count: 0, sum: 0 };
    }

    const batch = db.batch();
    batch.set(userRef, publicUpdate, { merge: true });
    batch.set(privateRef, {
        student_id: studentId,
        university_email: universityEmail,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    await batch.commit();

    // Custom Claim を付与（既存 claim を保持しつつ verified: true を追加）
    const userRecord = await admin.auth().getUser(uid);
    const existingClaims = (userRecord.customClaims as Record<string, unknown>) || {};
    await admin.auth().setCustomUserClaims(uid, {
        ...existingClaims,
        verified: true,
        university: "musashino",
    });

    await otpRef.delete();

    console.log(`[verifyUniversityOTP] uid=${uid} verified with ${universityEmail} (firstVerify=${isFirstVerify})`);
    return { success: true, student_id: studentId };
});

// ── 旧 verifyUserIdentity (後方互換 — 大学 Google アカウントでログイン中のユーザー向け) ──
// 大学 Google アカウントが ban された後は sendUniversityOTP → verifyUniversityOTP を使う。
export const verifyUserIdentity = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
    }

    const uid = context.auth.uid;
    const email = context.auth.token.email;

    if (!email) {
        throw new functions.https.HttpsError("failed-precondition", "Email not available on auth token.");
    }

    const match = email.match(/^([a-zA-Z0-9]+)@stu\.musashino-u\.ac\.jp$/);
    if (!match) {
        throw new functions.https.HttpsError(
            "permission-denied",
            "武蔵野大学の学生メール (@stu.musashino-u.ac.jp) でログインしているか、OTP認証を使用してください。"
        );
    }

    const studentId = match[1];

    try {
        const userRef = db.collection("users").doc(uid);
        const privateRef = userRef.collection("private_data").doc("profile");

        const userSnap = await userRef.get();
        const isFirstVerify = !userSnap.exists || !userSnap.data()?.is_verified;

        const publicUpdate: Record<string, unknown> = {
            id: uid,
            is_verified: true,
            universityId: "musashino",
            grade: calculateGradeFromEmail(email),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (isFirstVerify) {
            publicUpdate.trust_score = 5.0;
            publicUpdate.ratings = { count: 0, sum: 0 };
        }

        const batch = db.batch();
        batch.set(userRef, publicUpdate, { merge: true });
        batch.set(privateRef, {
            student_id: studentId,
            university_email: email,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        await batch.commit();

        // Custom Claim を付与（既存 claim を保持）
        const userRecord = await admin.auth().getUser(uid);
        const existingClaims = (userRecord.customClaims as Record<string, unknown>) || {};
        await admin.auth().setCustomUserClaims(uid, {
            ...existingClaims,
            verified: true,
            university: "musashino",
        });

        console.log(`[verifyUserIdentity] uid=${uid} student_id=${studentId} (firstVerify=${isFirstVerify})`);
        return { success: true, student_id: studentId };
    } catch (e) {
        return handleCallableError(e, "verifyUserIdentity");
    }
});

function calculateGradeFromEmail(email: string): string {
    const match = email.match(/^s(\d{2})/i);
    if (!match) return "不明";
    const entryYear = 2000 + parseInt(match[1]);
    const now = new Date();
    let acadYear = now.getFullYear();
    if (now.getMonth() < 3) acadYear -= 1;
    const grade = acadYear - entryYear + 1;
    if (grade <= 1) return "B1";
    if (grade === 2) return "B2";
    if (grade === 3) return "B3";
    if (grade === 4) return "B4";
    return "その他";
}
