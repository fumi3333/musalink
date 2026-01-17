"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { toast } from 'sonner';

interface AuthContextType {
    user: User | null;
    userData: any | null;
    loading: boolean;
    error: string | null;
    unreadNotifications: number;
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
        }, 500);

        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            clearTimeout(timeoutId);
            if (firebaseUser) {
                setUser(firebaseUser);

                // Handle Anonymous / Debug Users
                if (firebaseUser.isAnonymous) {
                    const debugRole = localStorage.getItem('debug_user_role');

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
                        coin_balance: 10000,
                        // Enhanced Profile Data
                        departmentId: isBuyer ? 'Economics' : 'Law',
                        grade: isBuyer ? 'B4' : 'B1', // s11(Old) vs s25(New)
                        interests: ['Law', 'Economics']
                    });
                } else {
                    // Real Google Users
                    try {
                        const userRef = doc(db, "users", firebaseUser.uid);
                        const userSnap = await getDoc(userRef);

                        if (userSnap.exists()) {
                            setUserData(userSnap.data());

                            // [Data Strategy] Auto-populate Grade/Dept from Email if missing
                            const data = userSnap.data();
                            if (!data.grade || !data.departmentId) {
                                const email = firebaseUser.email || "";
                                const derivedGrade = calculateGrade(email);
                                // Default Dept to 'Unknown' or try to guess? 'Unknown' for now.

                                if (derivedGrade !== "Unknown") {
                                    // Update Firestore
                                    const updates = {
                                        grade: data.grade || derivedGrade,
                                        departmentId: data.departmentId || "Unknown", // Placeholder
                                        email: email // Ensure email is synced
                                    };

                                    await setDoc(userRef, updates, { merge: true });

                                    // Update State
                                    setUserData({ ...data, ...updates });
                                }
                            }
                        } else {
                            // First time login or document missing?
                            // Logic for creating user doc could go here if needed
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

    // --- Notifications Listener ---
    const [unreadNotifications, setUnreadNotifications] = useState(0);
    useEffect(() => {
        if (!user) {
            setUnreadNotifications(0);
            return;
        }

        const q = query(collection(db, `users/${user.uid}/notifications`), where("read", "==", false));

        const unsub = onSnapshot(q, (snapshot: any) => {
            setUnreadNotifications(snapshot.docs.length);
        });
        return () => unsub();
    }, [user]);

    const login = async () => {
        setError(null);
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
            toast.success("ログインしました");
        } catch (e: any) {
            if (e.code === 'auth/configuration-not-found') {
                const msg = "Googleログイン設定が有効になっていません (Firebase Console確認)";
                console.warn(msg);
                setError(msg);
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
            localStorage.removeItem('debug_user_role');
            await signOut(auth);
            setUser(null);
            setUserData(null);
            toast.success("ログアウトしました");
            window.location.reload();
        } catch (e: any) {
            toast.error("ログアウトエラー: " + e.message);
        }
    };

    const debugLogin = async (role: 'seller' | 'buyer' = 'seller') => {
        try {
            localStorage.setItem('debug_user_role', role);
            const { signInAnonymously } = await import('firebase/auth');
            await signInAnonymously(auth);
            toast.success(`テスト用アカウント(${role})でログインしました`);
        } catch (e: any) {
            console.error("Debug Login Error", e);
            localStorage.removeItem('debug_user_role');
            toast.error("テストログインに失敗しました");
        }
    };

    return (
        <AuthContext.Provider value={{ user, userData, loading, error, unreadNotifications, login, logout, debugLogin }}>
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

// Helper: Extract Grade from Student ID in Email
// Format: s25xxxx@... -> Entry 2025 -> Current 2026(Jan) -> Acad 2025 -> Grade 1
function calculateGrade(email: string): string {
    if (!email) return "Unknown";
    const match = email.match(/^s(\d{2})/);
    if (!match) return "Unknown";

    // s25 -> 2025
    const entryYearShort = parseInt(match[1]);
    const entryYear = 2000 + entryYearShort;

    const now = new Date();
    let currentAcadYear = now.getFullYear();
    // If before April, it's still the previous academic year
    // e.g. Jan 2026 is still 2025 academic year
    if (now.getMonth() < 3) { // 0=Jan, 1=Feb, 2=Mar
        currentAcadYear -= 1;
    }

    const gradeNum = currentAcadYear - entryYear + 1;

    if (gradeNum <= 1) return "B1";
    if (gradeNum === 2) return "B2";
    if (gradeNum === 3) return "B3";
    if (gradeNum === 4) return "B4";
    return "Other";
}
