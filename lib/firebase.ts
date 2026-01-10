import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "mock_api_key_for_build",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "mock_auth_domain",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "mock_project_id",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "mock_storage_bucket",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "mock_sender_id",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "mock_app_id",
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "mock_measurement_id",
};

// Initialize Firebase (Server/Client safe singleton pattern)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app, 'us-central1');

let analytics: any = null;
if (typeof window !== "undefined") {
    isSupported().then((supported) => {
        if (supported) {
            analytics = getAnalytics(app);
        }
    });
}

// Connect to Emulators if on localhost
// Note: Emulator connection logic REMOVED to prevent "Client Offline" errors.
// We are forcing Live usage or Mock Service usage.
// if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
//    // connectAuthEmulator...
// }

export { app, auth, db, storage, analytics, functions };
