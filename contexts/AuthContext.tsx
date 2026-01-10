"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { toast } from 'sonner';

interface AuthContextType {
    user: User | null;
    userData: any | null;
    loading: boolean;
    error: string | null;
    login: () => Promise<void>;
    logout: () => Promise<void>;
    debugLogin: (role?: 'seller' | 'buyer') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Safety timeout to prevent infinite loading
        const timeoutId = setTimeout(() => {
            setLoading(false);
        }, 2000);

        // Check for persisted debug session
        // Check for persisted debug session - REMOVED per user request to start fresh
        // session persistence removed to ensure "start from logout" state.
        const debugRole = null;
        // if (debugRole) { ... } removed

        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            clearTimeout(timeoutId);
            if (firebaseUser) {
                // ... (existing logic)
                setUser(firebaseUser);

                // Handle Anonymous / Debug Users
                if (firebaseUser.isAnonymous) {
                    const debugRole = sessionStorage.getItem('debug_user_role');

                    // Fix: If no debug role is set in session (e.g. fresh load), 
                    // but we have an anonymous user, force logout to ensure clean start.
                    if (!debugRole) {
                        console.log("Found anonymous user but no debug role. Signing out for clean start.");
                        await signOut(auth);
                        setUser(null);
                        setUserData(null);
                        setLoading(false);
                        return;
                    }

                    const role = debugRole || 'seller'; // fallback actually handled by if above
                    const isBuyer = role === 'buyer';
                    setUserData({
                        id: firebaseUser.uid, // Use REAL Anonymous UID
                        university_email: isBuyer ? "s1111111@stu.musashino-u.ac.jp" : "s2527084@stu.musashino-u.ac.jp",
                        student_id: isBuyer ? "s1111111" : "s2527084",
                        display_name: isBuyer ? "Guest Buyer" : "Guest Seller",
                        is_verified: true,
                        charges_enabled: true,
                        is_demo: true, // Flag for Rules
                        coin_balance: 10000
                    });
                } else {
                    // Real Google Users
                    try {
                        const userRef = doc(db, "users", firebaseUser.uid);
                        const userSnap = await getDoc(userRef);
                        if (userSnap.exists()) {
                            setUserData(userSnap.data());
                        }
                    } catch (e: any) {
                        console.warn("Fetch user data error:", e);
                    }
                }
            } else {
                setUser(null);
                setUserData(null);
            }
            setLoading(false);
        });

        return () => {
            unsubscribe();
            clearTimeout(timeoutId);
        }
    }, []);

    const login = async () => {
        setError(null);
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
            toast.success("ログインしました");
        } catch (e: any) {
            // Suppress the configuration error to prevent red overlay if possible, or handle gracefully
            if (e.code === 'auth/configuration-not-found') {
                const msg = "Googleログイン設定が有効になっていません (Firebase Console確認)";
                console.warn(msg); // Warn instead of Error to avoid overlay? No, error still triggers.
                setError(msg);
                // We do NOT re-throw here to prevent unhandled rejection/Next.js overlay
                return;
            }

            console.error("Login Error:", e);
            if (e.code === 'auth/configuration-not-found') {
                const msg = "Googleログイン設定が有効になっていません。Firebase Consoleで有効化してください。";
                setError(msg);
                toast.error(msg);
            } else if (e.code === 'auth/popup-closed-by-user') {
                toast.info("ログインがキャンセルされました");
            } else {
                toast.error("ログインエラー: " + e.message);
                setError(e.message);
            }
            throw e;
        }
    };

    const logout = async () => {
        try {
            sessionStorage.removeItem('debug_user_role'); // Clear debug session
            await signOut(auth);
            setUser(null);
            setUserData(null);
            toast.success("ログアウトしました");
            // Reload to clear any stale state
            window.location.reload();
        } catch (e: any) {
            toast.error("ログアウトエラー: " + e.message);
        }
    };

    const debugLogin = async (role: 'seller' | 'buyer' = 'seller') => {
        try {
            // Use Anonymous Auth for Real Security Rules
            const { signInAnonymously } = await import('firebase/auth');
            await signInAnonymously(auth);

            // Store preference to hydrate userData later
            sessionStorage.setItem('debug_user_role', role);
            toast.success(`テスト用アカウント(${role})でログインしました`);
            // onAuthStateChanged will handle the rest
        } catch (e: any) {
            console.error("Debug Login Error", e);
            toast.error("テストログインに失敗しました");
        }
    };

    return (
        <AuthContext.Provider value={{ user, userData, loading, error, login, logout, debugLogin }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
