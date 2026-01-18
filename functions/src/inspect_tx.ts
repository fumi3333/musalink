import * as admin from 'firebase-admin';

// Initialize with application default credentials
admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'musa-link'
});

const db = admin.firestore();

async function inspect(txId: string) {
    try {
        console.log(`Fetching transaction ${txId}...`);
        const doc = await db.collection('transactions').doc(txId).get();
        if (!doc.exists) {
            console.log("No such transaction!");
        } else {
            console.log("Transaction Data:", JSON.stringify(doc.data(), null, 2));
        }
    } catch (e) {
        console.error("Error fetching transaction:", e);
    }
}

// Transaction ID obtained from browser verification
inspect('FvPmFe1kuM5Ld1Iz20zK');
