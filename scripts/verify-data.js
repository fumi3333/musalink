
const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

// Initialize Firebase Admin (Using Service Account for Full Access)
if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch (error) {
        console.log("Service Account not found, trying default app...");
        admin.initializeApp();
    }
}

const db = admin.firestore();

async function verifyLatestTransaction() {
    console.log("=== Verifying Latest Transaction Data ===");

    // Fetch most recent transaction
    const snapshot = await db.collection("transactions")
        .orderBy("createdAt", "desc")
        .limit(1)
        .get();

    if (snapshot.empty) {
        console.log("No transactions found.");
        return;
    }

    const doc = snapshot.docs[0];
    const data = doc.data();

    // Pretty Print Key Data
    console.log(`\nTransaction ID: ${doc.id}`);
    console.log(`Status: ${data.status}`);
    console.log(`Buyer: ${data.buyer_id}`);
    console.log(`Seller: ${data.seller_id}`);
    console.log(`Item: ${data.item_id} (Price: ${data.price || 'N/A'})`);  // Price might be on Item doc, check if joined or duplicated
    console.log(`Created: ${data.createdAt ? data.createdAt.toDate().toISOString() : 'N/A'}`);
    console.log(`Updated: ${data.updatedAt ? data.updatedAt.toDate().toISOString() : 'N/A'}`);
    console.log(`\n--- Full JSON Dump ---`);
    console.log(JSON.stringify(data, null, 2));

    // Also fetch associated User and Item for cross-verification
    console.log(`\n--- Associated Data Check ---`);
    try {
        const buyerDoc = await db.collection("users").doc(data.buyer_id).get();
        console.log(`Buyer Email: ${buyerDoc.exists ? buyerDoc.data().university_email : 'NOT FOUND'}`);

        const itemDoc = await db.collection("items").doc(data.item_id).get();
        console.log(`Item Title: ${itemDoc.exists ? itemDoc.data().title : 'NOT FOUND'}`);
        console.log(`Item Price: ${itemDoc.exists ? itemDoc.data().price : 'NOT FOUND'}`);
    } catch (e) {
        console.warn("Error checking associated docs", e);
    }
}

verifyLatestTransaction();
