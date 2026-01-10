import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as nodemailer from "nodemailer";

// Configure Transport (Requires "mail.email" and "mail.password" to be set via CLI)
// firebase functions:config:set mail.email="your-email@gmail.com" mail.password="app-password"
const mailTransport = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: functions.config().mail ? functions.config().mail.email : "mock_email@gmail.com",
        pass: functions.config().mail ? functions.config().mail.password : "mock_password",
    },
});

const APP_NAME = "Musashino Link";

// Helper: Send Email
async function sendEmail(to: string, subject: string, text: string) {
    if (!functions.config().mail) {
        console.log(`[MOCK EMAIL] To: ${to}, Subject: ${subject}, Body: ${text}`);
        return;
    }

    const mailOptions = {
        from: `${APP_NAME} <noreply@firebase.com>`,
        to: to,
        subject: subject,
        text: text,
    };

    try {
        await mailTransport.sendMail(mailOptions);
        console.log(`Email sent to ${to}`);
    } catch (error) {
        console.error("Error sending email:", error);
    }
}

// Trigger: Notify Seller on Buying Request
export const notifyOnRequestCreated = functions.firestore
    .document("transactions/{transactionId}")
    .onCreate(async (snap, context) => {
        const tx = snap.data();
        if (tx.status !== "request_sent") return;

        // Get Seller Email
        const sellerId = tx.seller_id;
        const sellerDoc = await admin.firestore().collection("users").doc(sellerId).get();
        const seller = sellerDoc.data();

        if (!seller || !seller.university_email) {
            console.log("Seller email not found, skipping notification.");
            return;
        }

        // Get Item Name
        const itemDoc = await admin.firestore().collection("items").doc(tx.item_id).get();
        const item = itemDoc.data();
        const itemName = item ? item.title : "商品";

        const subject = `【${APP_NAME}】出品した商品にリクエストが届きました！`;
        const body = `${seller.display_name} さん\n\n` +
            `あなたの出品「${itemName}」に購入リクエストが届きました。\n` +
            `アプリを開いて、取引画面から承認してください。\n\n` +
            `アプリを開く: https://musalink.vercel.app/transactions`;

        await sendEmail(seller.university_email, subject, body);
    });

// Trigger: Notify on New Chat Message
export const notifyOnMessageCreated = functions.firestore
    .document("conversations/{conversationId}/messages/{messageId}")
    .onCreate(async (snap, context) => {
        const message = snap.data();
        const conversationId = context.params.conversationId;

        // Get Conversation to find participants
        const convDoc = await admin.firestore().collection("conversations").doc(conversationId).get();
        const conversation = convDoc.data();

        if (!conversation) return;

        // Determine Recipient (The one who didn't send the message)
        const recipientId = conversation.participants.find((uid: string) => uid !== message.senderId);
        if (!recipientId) return;

        const recipientDoc = await admin.firestore().collection("users").doc(recipientId).get();
        const recipient = recipientDoc.data();

        if (!recipient || !recipient.university_email) return;

        const subject = `【${APP_NAME}】新着メッセージがあります`;
        const body = `${recipient.display_name} さん\n\n` +
            `取引相手から新しいメッセージが届きました。\n\n` +
            `"${message.text}"\n\n` +
            `返信する: https://musalink.vercel.app/transactions`;

        await sendEmail(recipient.university_email, subject, body);
    });
