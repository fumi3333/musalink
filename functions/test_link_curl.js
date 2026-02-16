
const { httpsCallable } = require('firebase/functions');
const { initializeApp } = require('firebase/app');
const { getFunctions, connectFunctionsEmulator } = require('firebase/functions');

// Firebase Config (Public info is enough for functions)
const firebaseConfig = {
    apiKey: "dummy", 
    authDomain: "musa-link.firebaseapp.com",
    projectId: "musa-link",
    storageBucket: "musa-link.firebasestorage.app",
    messagingSenderId: "348422736780",
    appId: "1:348422736780:web:1234567890abcdef"
};

const app = initializeApp(firebaseConfig);
const functions = getFunctions(app, 'us-central1');

// Note: Ensure we are calling the PRODUCTION endpoint, not emulator
// connectFunctionsEmulator(functions, 'localhost', 5001); 

async function testCall() {
    // Manually construct the fetch call because firebase SDK might need auth or polyfills in node
    const fetch = require('node-fetch');
    const url = "https://us-central1-musa-link.cloudfunctions.net/createStripeAccountLink";
    
    // We need to simulate the "data" structure of onCall
    const body = {
        data: {
            accountId: "acct_1Sn1ToGh1ifwJu9c" // The "Broken" Account ID
        }
    };

    console.log("Calling", url);
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        
        const text = await res.text();
        console.log("Status:", res.status);
        console.log("Body:", text);
    } catch (e) {
        console.error(e);
    }
}

testCall();
