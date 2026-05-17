import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as nodemailer from "nodemailer";
import { defineSecret } from "firebase-functions/params";
import { db } from "./init";

const gmailEmail = defineSecret("GMAIL_EMAIL");
const gmailPassword = defineSecret("GMAIL_PASSWORD");

const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1時間

const CATEGORY_LABELS: Record<string, string> = {
    transaction_trouble: "取引トラブル",
    inappropriate: "不正・不適切報告",
    feature_request: "ご意見・ご要望",
    other: "その他",
};

export const sendContactEmail = functions
    .runWith({ secrets: [gmailEmail, gmailPassword] })
    .https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError("unauthenticated", "ログインが必要です。");
        }

        const uid = context.auth.uid;
        const userEmail = context.auth.token.email || "";
        const { category, message } = data;

        if (!category || !CATEGORY_LABELS[category]) {
            throw new functions.https.HttpsError("invalid-argument", "カテゴリを選択してください。");
        }
        if (!message || typeof message !== "string" || message.trim().length < 10) {
            throw new functions.https.HttpsError("invalid-argument", "内容を10文字以上入力してください。");
        }
        if (message.length > 2000) {
            throw new functions.https.HttpsError("invalid-argument", "メッセージは2000文字以内で入力してください。");
        }

        // レート制限: 1時間に3回まで
        const windowStart = admin.firestore.Timestamp.fromDate(new Date(Date.now() - RATE_LIMIT_WINDOW_MS));
        const recent = await db.collection("contacts")
            .where("uid", "==", uid)
            .where("createdAt", ">=", windowStart)
            .get();
        if (recent.size >= RATE_LIMIT_MAX) {
            throw new functions.https.HttpsError("resource-exhausted", "送信回数の上限です。1時間後に再度お試しください。");
        }

        // Firestore に保存
        await db.collection("contacts").add({
            uid,
            userEmail,
            category,
            message: message.trim(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            status: "open",
        });

        // 管理者メール送信
        const email = gmailEmail.value();
        const password = gmailPassword.value();
        const categoryLabel = CATEGORY_LABELS[category];

        const transport = nodemailer.createTransport({
            service: "gmail",
            auth: { user: email, pass: password },
        });

        await transport.sendMail({
            from: `"Musalink" <${email}>`,
            to: email,
            subject: `【Musalink お問い合わせ】${categoryLabel}`,
            text: `差出人: ${userEmail}\nカテゴリ: ${categoryLabel}\n\n${message.trim()}`,
            html: `<p><b>差出人:</b> ${userEmail}<br><b>カテゴリ:</b> ${categoryLabel}</p><hr><p>${message.trim().replace(/\n/g, "<br>")}</p>`,
        });

        return { success: true };
    });
