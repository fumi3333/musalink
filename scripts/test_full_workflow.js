const { initializeApp } = require('firebase/app');
const { getAuth, signInAnonymously } = require('firebase/auth');
const { getFirestore, collection, addDoc, doc, updateDoc, setDoc } = require('firebase/firestore');
const { getFunctions, httpsCallable } = require('firebase/functions');
const fs = require('fs');
const path = require('path');

// Load .env.local
try {
    const envPath = path.resolve(__dirname, '../.env.local');
    if (fs.existsSync(envPath)) {
        const envConfig = fs.readFileSync(envPath, 'utf-8');
        envConfig.split('\n').forEach(line => {
            const cleanLine = line.trim();
            if (!cleanLine || cleanLine.startsWith('#')) return;
            const match = cleanLine.match(/^([^=]+)=(.*)$/);
            if (match) {
                process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
            }
        });
    }
} catch (e) {}

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app, 'us-central1');

async function testWorkflow() {
    try {
        console.log("1. Logging in anonymously...");
        const userCred = await signInAnonymously(auth);
        const user = userCred.user;
        console.log(`✅ Logged in as ${user.uid}`);

        console.log("1.5 Creating Mock Seller Profile...");
        await setDoc(doc(db, "users", user.uid), {
            display_name: "Test Seller",
            stripe_connect_id: "acct_1Sn1ToGh1ifwJu9c", // Real dev account or mock
            charges_enabled: true,
            is_demo: true,
        }, { merge: true });
        console.log(`✅ Seller profile created.`);

        console.log("\n2. Creating Test Item...");
        const itemRef = await addDoc(collection(db, "items"), {
            seller_id: user.uid,
            title: "Workflow Verification Item",
            description: "Testing capture payment flow",
            price: 500,
            status: "listing",
            images: [],
            category: "others",
            campus: "musashino",
            createdAt: new Date(),
        });
        console.log(`✅ Item created: ${itemRef.id}`);

        console.log("\n3. Creating Transaction...");
        const txRef = await addDoc(collection(db, "transactions"), {
            item_id: itemRef.id,
            buyer_id: user.uid,
            seller_id: user.uid,
            status: "request_sent",
            is_demo: true,
            createdAt: new Date(),
        });
        console.log(`✅ Transaction created: ${txRef.id}`);

        console.log("\n4. Approving Transaction...");
        await updateDoc(txRef, { status: "approved" });
        console.log(`✅ Transaction approved.`);

        console.log("\n5. Calling createPaymentIntent...");
        const idToken = await user.getIdToken();
        // Node.js >= 18 has native fetch
        const res = await fetch('https://us-central1-musa-link.cloudfunctions.net/createPaymentIntent', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${idToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ transactionId: txRef.id })
        });
        const data = await res.json();
        
        if (!res.ok) {
            throw new Error(`createPaymentIntent failed: ${JSON.stringify(data)}`);
        }
        console.log(`✅ createPaymentIntent success:`, data.clientSecret);

        console.log("   Mocking status to payment_pending in Firestore...");
        // After auth, frontend would set it to payment_pending
        await updateDoc(txRef, { 
            status: "payment_pending"
        });
        console.log(`✅ Transaction set to payment_pending.`);

        console.log("\n6. Calling capturePayment...");
        const capturePayment = httpsCallable(functions, 'capturePayment');
        const result = await capturePayment({ transactionId: txRef.id });
        console.log(`✅ capturePayment success:`, result.data);

        console.log("\n7. Final Status Check...");
        const { getDoc } = require('firebase/firestore');
        const finalDoc = await getDoc(txRef);
        console.log("Final Transaction Data:");
        console.log(finalDoc.data());

    } catch (e) {
        console.error("❌ Workflow test failed:", e);
    } finally {
        process.exit(0);
    }
}

testWorkflow();
