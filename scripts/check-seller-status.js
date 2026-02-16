const admin = require('firebase-admin');
const serviceAccount = require('../functions/serviceAccountKey.json'); // Adjust path if needed, or use default

// ローカルエミュレータに接続する場合
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: "musa-link",
        // credential: admin.credential.cert(serviceAccount) // If using production
    });
}

const db = admin.firestore();

async function checkSeller() {
    console.log("Checking Test Seller status...");
    const email = 'test-seller@musashino-u.ac.jp';

    try {
        // 1. Get UID from Auth
        // Note: In emulator, we might need to list users if getUserByEmail fails/is not seeded the same way.
        // But let's try.
        let uid;
        try {
            const userRecord = await admin.auth().getUserByEmail(email);
            uid = userRecord.uid;
            console.log(`Found Auth User: ${email} -> ${uid}`);
        } catch (e) {
            console.log(`Auth User not found by email: ${e.message}`);
            // Fallback: search in users collection directly if email is stored there?
            // Existing app stores email in users collection? Let's verify.
        }

        if (!uid) {
            console.log("Listing all users to find seller...");
            const listUsersResult = await admin.auth().listUsers(100);
            listUsersResult.users.forEach(userRecord => {
                if (userRecord.email === email) {
                    uid = userRecord.uid;
                    console.log(`Found User in list: ${uid}`);
                }
            });
        }

        if (!uid) {
            console.error("Test Seller UID not found!");
            return;
        }

        // 2. Check Firestore
        const docRef = db.collection('users').doc(uid);
        const doc = await docRef.get();

        if (!doc.exists) {
            console.error("Firestore Document not found for UID:", uid);
            return;
        }

        const data = doc.data();
        console.log("Firestore Data:", {
            stripe_connect_id: data.stripe_connect_id,
            charges_enabled: data.charges_enabled,
            student_id: data.student_id
        });

        // 3. Fix if needed
        if (!data.charges_enabled || !data.stripe_connect_id) {
            console.log(">>> Fixing Seller Status...");
            await docRef.update({
                stripe_connect_id: data.stripe_connect_id || `acct_mock_${uid}`,
                charges_enabled: true
            });
            console.log(">>> Fixed: charges_enabled = true");
        } else {
            console.log(">>> Status is OK.");
        }

    } catch (error) {
        console.error("Error:", error);
    }
}

checkSeller();
