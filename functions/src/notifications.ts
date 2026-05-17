import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as nodemailer from "nodemailer";
import { defineSecret } from "firebase-functions/params";

const db = admin.firestore();

const gmailEmail = defineSecret("GMAIL_EMAIL");
const gmailPassword = defineSecret("GMAIL_PASSWORD");

async function sendEmail(to: string, subject: string, text: string, email: string, password: string) {
    if (!email || !password) {
        console.warn("Skipping Email: GMAIL_EMAIL or GMAIL_PASSWORD secret is missing.");
        return;
    }
    const transport = nodemailer.createTransport({
        service: "gmail",
        auth: { user: email, pass: password },
    });
    try {
        await transport.sendMail({
            from: `"Musalink" <${email}>`,
            to,
            subject,
            text,
            html: text.replace(/\n/g, "<br>"),
        });
        console.log(`Email sent to ${to}`);
    } catch (error) {
        console.error("Email send failed:", error);
    }
}

// 1. On Transaction Created -> Notify Seller
export const onTransactionCreated = functions
    .runWith({ secrets: [gmailEmail, gmailPassword] })
    .firestore.document("transactions/{transactionId}")
    .onCreate(async (snap: functions.firestore.QueryDocumentSnapshot, context: functions.EventContext) => {
        const email = gmailEmail.value();
        const password = gmailPassword.value();
        const tx = snap.data();
        const sellerId = tx.seller_id;

        const sellerDoc = await db.collection("users").doc(sellerId).get();
        if (!sellerDoc.exists) return;
        const seller = sellerDoc.data()!;
        const sellerEmail = seller.university_email || seller.email;

        if (!sellerEmail) {
            console.log(`Seller ${sellerId} has no email, skipping notification.`);
            return;
        }

        const itemDoc = await db.collection("items").doc(tx.item_id).get();
        const itemTitle = itemDoc.exists ? itemDoc.data()!.title : "商品";

        const subject = `【Musalink】商品「${itemTitle}」が購入されました！`;
        const text = `${seller.display_name}様\n\nあなたの出品した「${itemTitle}」に購入リクエストが入りました！\n\nアプリを開いて確認・承認してください。\nhttps://musa-link.web.app/transactions/detail?id=${context.params.transactionId}&openExternalBrowser=1`;

        await db.collection("users").doc(sellerId).collection("notifications").add({
            type: "transaction_created",
            title: "商品が購入されました",
            body: itemTitle,
            link: `/transactions/detail?id=${context.params.transactionId}`,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            read: false,
        });

        await sendEmail(sellerEmail, subject, text, email, password);
    });

// 2. Message Notification: REMOVED for 電気通信事業法 compliance (2026-05-16)

// 3. On Transaction Updated -> Notify Status Changes
export const onTransactionUpdated = functions
    .runWith({ secrets: [gmailEmail, gmailPassword] })
    .firestore.document("transactions/{transactionId}")
    .onUpdate(async (change, context) => {
        const email = gmailEmail.value();
        const password = gmailPassword.value();
        const before = change.before.data();
        const after = change.after.data();
        const transactionId = context.params.transactionId;

        const statusBefore = before.status;
        const statusAfter = after.status;

        if (statusBefore === statusAfter) return;

        // request_sent -> approved: Notify Buyer
        if (statusBefore === "request_sent" && statusAfter === "approved") {
            const buyerId = after.buyer_id;
            const buyerDoc = await db.collection("users").doc(buyerId).get();
            if (!buyerDoc.exists) return;
            const buyer = buyerDoc.data()!;
            const buyerEmail = buyer.university_email || buyer.email;

            const itemDoc = await db.collection("items").doc(after.item_id).get();
            const itemTitle = itemDoc.exists ? itemDoc.data()!.title : "商品";

            const subject = `【Musalink】購入リクエストが承認されました！`;
            const text = `${buyer.display_name}様\n\n「${itemTitle}」の購入リクエストが承認されました。\n\n以下のリンクから決済情報を入力し、利用枠の確保（仮押さえ）へお進みください。\n※実際の支払い確定は、対面で商品を受け取り QR コードを読み取ったタイミングで完了します。\n※24時間以内に次のステップへ進まない場合、自動的にキャンセルされます。\n\nhttps://musa-link.web.app/transactions/detail?id=${transactionId}&openExternalBrowser=1`;

            await db.collection("users").doc(buyerId).collection("notifications").add({
                type: "transaction_updated",
                title: "リクエスト承認",
                body: `「${itemTitle}」が承認されました。支払いに進んでください。`,
                link: `/transactions/detail?id=${transactionId}`,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                read: false,
            });

            if (buyerEmail) await sendEmail(buyerEmail, subject, text, email, password);
        }

        // approved -> payment_pending: Notify Seller
        if (statusBefore === "approved" && statusAfter === "payment_pending") {
            const sellerId = after.seller_id;
            const sellerDoc = await db.collection("users").doc(sellerId).get();
            if (!sellerDoc.exists) return;
            const seller = sellerDoc.data()!;
            const sellerEmail = seller.university_email || seller.email;

            const itemDoc = await db.collection("items").doc(after.item_id).get();
            const itemTitle = itemDoc.exists ? itemDoc.data()!.title : "商品";

            const subject = `【Musalink】支払いの枠確保が完了しました（${itemTitle}）`;
            const text = `${seller.display_name}様\n\n「${itemTitle}」について、購入者がクレジットカードで支払いの仮押さえ（枠確保）を行いました。\n\n取引詳細画面で受け渡し場所を確認し、キャンパス内で商品の受け渡しを行ってください。\n受け渡し時にあなたのスマホでQRコードを提示し、購入者に読み取ってもらうと売上が確定します。\n※24時間以内に受け渡しが完了しないと、取引は自動キャンセルされ、購入者のカード仮押さえも解除されます。\n\nhttps://musa-link.web.app/transactions/detail?id=${transactionId}&openExternalBrowser=1`;

            await db.collection("users").doc(sellerId).collection("notifications").add({
                type: "transaction_updated",
                title: "支払い予約完了",
                body: `「${itemTitle}」の支払い予約が完了しました。受け渡しを行ってください。`,
                link: `/transactions/detail?id=${transactionId}`,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                read: false,
            });

            if (sellerEmail) await sendEmail(sellerEmail, subject, text, email, password);
        }

        // any -> completed: Notify Both
        if (statusBefore !== "completed" && statusAfter === "completed") {
            const sellerId = after.seller_id;
            const sellerDoc = await db.collection("users").doc(sellerId).get();
            if (!sellerDoc.exists) return;
            const seller = sellerDoc.data()!;
            const sellerEmail = seller.university_email || seller.email;

            const itemDoc = await db.collection("items").doc(after.item_id).get();
            const itemTitle = itemDoc.exists ? itemDoc.data()!.title : "商品";

            const subject = `【Musalink】商品の受け渡し・売上確定が完了しました（${itemTitle}）`;
            const text = `${seller.display_name}様\n\n「${itemTitle}」の受け渡し（QR認証）が完了し、売上が確定しました！\nご利用ありがとうございました。\n\n詳細はこちら:\nhttps://musa-link.web.app/transactions/detail?id=${transactionId}&openExternalBrowser=1`;

            await db.collection("users").doc(sellerId).collection("notifications").add({
                type: "transaction_updated",
                title: "取引完了",
                body: `「${itemTitle}」の受け渡しが完了し、売上が確定しました。`,
                link: `/transactions/detail?id=${transactionId}`,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                read: false,
            });

            if (sellerEmail) await sendEmail(sellerEmail, subject, text, email, password);

            // Notify Buyer
            const buyerId = after.buyer_id;
            const buyerDoc = await db.collection("users").doc(buyerId).get();
            if (buyerDoc.exists) {
                const buyer = buyerDoc.data()!;
                const buyerEmail = buyer.university_email || buyer.email;

                const buyerSubject = `【Musalink】「${itemTitle}」の取引が完了しました`;
                const buyerText = `${buyer.display_name}様\n\n「${itemTitle}」の受け取り・支払いが完了しました！\nご利用ありがとうございました。\n\n詳細はこちら:\nhttps://musa-link.web.app/transactions/detail?id=${transactionId}&openExternalBrowser=1`;

                await db.collection("users").doc(buyerId).collection("notifications").add({
                    type: "transaction_updated",
                    title: "取引完了",
                    body: `「${itemTitle}」の受け取りが完了しました。`,
                    link: `/transactions/detail?id=${transactionId}`,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    read: false,
                });

                if (buyerEmail) await sendEmail(buyerEmail, buyerSubject, buyerText, email, password);
            }
        }

        // any -> cancelled: Notify Both
        if (statusBefore !== "cancelled" && statusAfter === "cancelled") {
            const cancelReason = after.cancel_reason || "ユーザーによるキャンセル";

            const buyerId = after.buyer_id;
            const buyerDoc = await db.collection("users").doc(buyerId).get();
            const buyer = buyerDoc.exists ? buyerDoc.data()! : null;
            const buyerEmail = buyer ? (buyer.university_email || buyer.email) : null;

            const sellerId = after.seller_id;
            const sellerDoc = await db.collection("users").doc(sellerId).get();
            const seller = sellerDoc.exists ? sellerDoc.data()! : null;
            const sellerEmail = seller ? (seller.university_email || seller.email) : null;

            const itemDoc = await db.collection("items").doc(after.item_id).get();
            const itemTitle = itemDoc.exists ? itemDoc.data()!.title : "商品";

            const subject = `【Musalink】取引がキャンセルされました（${itemTitle}）`;
            const reasonText = cancelReason === "auto_timeout_24h"
                ? "24時間以上操作が行われなかったため、自動的にキャンセルされました。"
                : "取引相手、または運営によってキャンセル処理が行われました。";

            const text = `「${itemTitle}」の取引がキャンセルされました。\n\n理由: ${reasonText}\n\n詳細はこちら:\nhttps://musa-link.web.app/transactions/detail?id=${transactionId}&openExternalBrowser=1`;

            if (buyer) {
                await db.collection("users").doc(buyerId).collection("notifications").add({
                    type: "transaction_cancelled",
                    title: "取引キャンセル",
                    body: `「${itemTitle}」の取引がキャンセルされました。`,
                    link: `/transactions/detail?id=${transactionId}`,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    read: false,
                });
                if (buyerEmail) await sendEmail(buyerEmail, subject, `購入者様\n\n${text}`, email, password);
            }

            if (seller) {
                await db.collection("users").doc(sellerId).collection("notifications").add({
                    type: "transaction_cancelled",
                    title: "取引キャンセル",
                    body: `「${itemTitle}」の取引がキャンセルされました。`,
                    link: `/transactions/detail?id=${transactionId}`,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    read: false,
                });
                if (sellerEmail) await sendEmail(sellerEmail, subject, `出品者様\n\n${text}`, email, password);
            }
        }
    });
