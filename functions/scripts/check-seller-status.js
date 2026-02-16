const admin = require('firebase-admin');

// ローカルエミュレータ設定 (本番接続のためコメントアウト)
// process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
// process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
// process.env.GCLOUD_PROJECT = 'musa-link';

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: "musa-link"
    });
}

const db = admin.firestore();

async function checkSeller() {
    console.log("Checking Test Seller status...");
    const email = 'test-seller@musashino-u.ac.jp';

    try {
        let uid;
        // Try to list users to find the seller
        const listUsersResult = await admin.auth().listUsers(100);
        listUsersResult.users.forEach(userRecord => {
            if (userRecord.email === email) {
                uid = userRecord.uid;
                console.log(`Found User in list: ${uid}`);
            }
        });

        if (!uid) {
            console.error("Test Seller UID not found! (Is Emulator Auth seeded?)");
            // If checking fails, maybe we can assume the structured ID if seeded
            // uid = 'test-seller'; 
            return;
        }

        const docRef = db.collection('users').doc(uid);
        const doc = await docRef.get();

        if (!doc.exists) {
            console.error("Firestore User Document not found for UID:", uid);
            return;
        }

        const data = doc.data();
        console.log(`User [${uid}] Status:`);
        console.log(`- stripe_connect_id: ${data.stripe_connect_id}`);
        console.log(`- charges_enabled: ${data.charges_enabled}`);

        if (!data.charges_enabled || !data.stripe_connect_id) {
            console.log(">>> FIXING STATUS...");
            await docRef.update({
                stripe_connect_id: data.stripe_connect_id || `acct_mock_${uid}`,
                charges_enabled: true,
                updatedAt: admin.firestore.Timestamp.now()
            });
            console.log(">>> FIXED: charges_enabled = true");
        } else {
            console.log(">>> STATUS OK.");
        }

    } catch (error) {
        console.error("Error:", error);
    }
}

checkSeller();
