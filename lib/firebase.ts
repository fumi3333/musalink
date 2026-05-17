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

// Analytics: gated by explicit user consent (電気通信事業法 第27条の12 対応, 2026-05-16)
// We only initialize Firebase Analytics after the user has accepted the cookie/analytics banner.
// Consent flag is stored in localStorage under 'musalink_analytics_consent' = 'granted' | 'denied'.
let analytics: any = null;
export function initAnalyticsIfConsented() {
    if (typeof window === "undefined") return;
    if (analytics) return; // already initialised
    const consent = window.localStorage.getItem("musalink_analytics_consent");
    if (consent !== "granted") return;
    isSupported().then((supported) => {
        if (supported) {
            analytics = getAnalytics(app);
        }
    });
}

if (typeof window !== "undefined") {
    // Best-effort: if user previously granted, initialise immediately on next load.
    initAnalyticsIfConsented();
}

// Connect to Emulators if on localhost
// Note: Emulator connection logic REMOVED to prevent "Client Offline" errors.
// We are forcing Live usage or Mock Service usage.
// if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
//    // connectAuthEmulator...
// }

export { app, auth, db, storage, analytics, functions };
