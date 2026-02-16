import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as nodemailer from "nodemailer";

const db = admin.firestore();

// 1. Configure Transport
// We use functions.config() to store sensitive credentials safely.
// Run: firebase functions:config:set gmail.email="your@gmail.com" gmail.password="app-password"
const gmailEmail = functions.config().gmail?.email;
const gmailPassword = functions.config().gmail?.password;

const mailTransport = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: gmailEmail,
        pass: gmailPassword,
    },
});

// Helper: Send Email
async function sendEmail(to: string, subject: string, text: string, html?: string) {
    if (!gmailEmail || !gmailPassword) {
        console.warn("Skipping Email: 'gmail.email' or 'gmail.password' config is missing.");
        return;
    }

    const mailOptions = {
        from: `"Musalink" <${gmailEmail}>`,
        to: to,
        subject: subject,
        text: text,
        html: html || text.replace(/\n/g, '<br>')
    };

    try {
        await mailTransport.sendMail(mailOptions);
        console.log(`Email sent to ${to}`);
    } catch (error) {
        console.error("Email send failed:", error);
    }
}

// Top Level Export
// 1. On Transaction Created -> Notify Seller
export const onTransactionCreated = functions.firestore
    .document('transactions/{transactionId}')
    .onCreate(async (snap: functions.firestore.QueryDocumentSnapshot, context: functions.EventContext) => {
        const tx = snap.data();
        const sellerId = tx.seller_id;
        // const buyerId = tx.buyer_id; // Unused for now

        // Fetch Seller Email
        const sellerDoc = await db.collection("users").doc(sellerId).get();
        if (!sellerDoc.exists) return;
        const seller = sellerDoc.data()!;
        const sellerEmail = seller.university_email || seller.email;

        if (!sellerEmail) {
            console.log(`Seller ${sellerId} has no email, skipping notification.`);
            return;
        }

        // Fetch Item Title
        const itemDoc = await db.collection("items").doc(tx.item_id).get();
        const itemTitle = itemDoc.exists ? itemDoc.data()!.title : "商品";

        const subject = `【Musalink】商品「${itemTitle}」が購入されました！`;
        const text = `${seller.display_name}様\n\nあなたの出品した「${itemTitle}」に購入リクエストが入りました！\n\nアプリを開いて確認・承認してください。\nhttps://musa-link.web.app/transactions/detail?id=${context.params.transactionId}`;

        // 1. Create In-App Notification
        await db.collection("users").doc(sellerId).collection("notifications").add({
            type: "transaction_created",
            title: "商品が購入されました",
            body: itemTitle,
            link: `/transactions/detail?id=${context.params.transactionId}`,
            createdAt: admin.firestore.Timestamp.now(),
            read: false
        });

        // 2. Send Email
        await sendEmail(sellerEmail, subject, text);
    });

// 2. On Message Created -> Notify Recipient
export const onMessageCreated = functions.firestore
    .document('conversations/{conversationId}/messages/{messageId}')
    .onCreate(async (snap: functions.firestore.QueryDocumentSnapshot, context: functions.EventContext) => {
        const msg = snap.data();
        const senderId = msg.senderId;
        const conversationId = context.params.conversationId;

        // Fetch Conversation to find Participants
        const convDoc = await db.collection("conversations").doc(conversationId).get();
        if (!convDoc.exists) return; // Should not happen
        const conv = convDoc.data()!;

        // Determine Recipient
        // conv.participants is array [uid1, uid2]
        const participants = conv.participants || [];
        const recipientId = participants.find((uid: string) => uid !== senderId);

        if (!recipientId) return;

        // Fetch Recipient Email
        const recipientDoc = await db.collection("users").doc(recipientId).get();
        if (!recipientDoc.exists) return;
        const recipient = recipientDoc.data()!;
        const recipientEmail = recipient.university_email || recipient.email;

        // Rate Limit / Spam Prevention Logic?
        // Check local "Do Not Disturb"? (Skipped for MVP)

        const msgPreview = (msg.text || '(メディア)').substring(0, 50);
        const subject = `【Musalink】新着メッセージが届きました`;
        const text = `${recipient.display_name}様\n\n取引相手からメッセージが届きました。\n\n「${msgPreview}${(msg.text || '').length > 50 ? '...' : ''}」\n\n返信はこちら:\nhttps://musa-link.web.app/transactions/detail?id=${conversationId}#chat`;

        // 1. Create In-App Notification
        await db.collection("users").doc(recipientId).collection("notifications").add({
            type: "message_received",
            title: "新着メッセージ",
            body: (msg.text || '(メディア)').substring(0, 30),
            link: `/transactions/detail?id=${conversationId}#chat`,
            createdAt: admin.firestore.Timestamp.now(),
            read: false
        });

        // 2. Send Email
        if (recipientEmail) {
            await sendEmail(recipientEmail, subject, text);
        }
    });

// 3. On Transaction Updated -> Notify Status Changes
export const onTransactionUpdated = functions.firestore
    .document('transactions/{transactionId}')
    .onUpdate(async (change, context) => {
        const before = change.before.data();
        const after = change.after.data();
        const transactionId = context.params.transactionId;

        const statusBefore = before.status;
        const statusAfter = after.status;

        if (statusBefore === statusAfter) return; // No status change

        // 1. Request Approved (request_sent -> approved) -> Notify Buyer
        if (statusBefore === 'request_sent' && statusAfter === 'approved') {
            const buyerId = after.buyer_id;
            const buyerDoc = await db.collection("users").doc(buyerId).get();
            if (!buyerDoc.exists) return;
            const buyer = buyerDoc.data()!;
            const buyerEmail = buyer.university_email || buyer.email;

            // Fetch Item Title
            const itemDoc = await db.collection("items").doc(after.item_id).get();
            const itemTitle = itemDoc.exists ? itemDoc.data()!.title : "商品";

            const subject = `【Musalink】購入リクエストが承認されました！`;
            const text = `${buyer.display_name}様\n\n「${itemTitle}」の購入リクエストが承認されました。\n\n以下のリンクから支払いを完了させてください。\nhttps://musa-link.web.app/transactions/detail?id=${transactionId}`;

            // In-App
            await db.collection("users").doc(buyerId).collection("notifications").add({
                type: "transaction_updated",
                title: "リクエスト承認",
                body: `「${itemTitle}」が承認されました。支払いに進んでください。`,
                link: `/transactions/detail?id=${transactionId}`,
                createdAt: admin.firestore.Timestamp.now(),
                read: false
            });

            // Email
            if (buyerEmail) {
                await sendEmail(buyerEmail, subject, text);
            }
        }

        // 2. Transaction Completed / Paid (any -> completed) -> Notify Seller (Payment Received)
        // Note: 'completed' in this system means Payment is triggers unlock.
        if (statusBefore !== 'completed' && statusAfter === 'completed') {
            const sellerId = after.seller_id;
            const sellerDoc = await db.collection("users").doc(sellerId).get();
            if (!sellerDoc.exists) return;
            const seller = sellerDoc.data()!;
            const sellerEmail = seller.university_email || seller.email;

            // Fetch Item Title
            const itemDoc = await db.collection("items").doc(after.item_id).get();
            const itemTitle = itemDoc.exists ? itemDoc.data()!.title : "商品";

            const subject = `【Musalink】支払いが完了しました（${itemTitle}）`;
            const text = `${seller.display_name}様\n\n「${itemTitle}」の支払いが完了し、取引が成立しました。\n\n購入者と連絡を取り、商品の受け渡しを行ってください。\nhttps://musa-link.web.app/transactions/detail?id=${transactionId}`;

            // In-App
            await db.collection("users").doc(sellerId).collection("notifications").add({
                type: "transaction_updated",
                title: "支払い完了",
                body: `「${itemTitle}」の支払いが完了しました。受け渡しを行ってください。`,
                link: `/transactions/detail?id=${transactionId}`,
                createdAt: admin.firestore.Timestamp.now(),
                read: false
            });

            // Email
            if (sellerEmail) {
                await sendEmail(sellerEmail, subject, text);
            }
        }
    });
