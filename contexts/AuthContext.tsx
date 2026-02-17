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
                // [Debug/Guest Handling] Check FIRST before domain enforcement
                if (firebaseUser.isAnonymous) {
                     console.log("Debug/Guest Login Active");
                     setUser(firebaseUser);
                     setUserData({
                         id: firebaseUser.uid,
                         display_name: "テスト用 買い手",
                         email: "guest_buyer@demo.local",
                         universityId: "musashino",
                         grade: "B2",
                         departmentId: "工学部",
                         student_id: "guest123",
                         is_demo: true,
                         trust_score: 50,
                         coin_balance: 10000
                     });
                     setLoading(false);
                     return;
                }

                // [Security Check] Strict Domain Enforcement
                const email = firebaseUser.email || "";
                if (!email.endsWith("@stu.musashino-u.ac.jp") && !email.endsWith("@musashino-u.ac.jp")) {
                    console.warn(`[Auth] Blocked unauthorized domain: ${email}`);
                    await signOut(auth);
                    setUser(null);
                    setUserData(null);
                    setError("武蔵野大学のアカウント(@stu.musashino-u.ac.jp)のみ利用可能です");
                    toast.error("武蔵野大学のアカウントのみ利用可能です", { duration: 5000 });
                    setLoading(false);
                    return;
                }

                setUser(firebaseUser);
                
                // Real Google Users logic starts here
                try {
                        const userRef = doc(db, "users", firebaseUser.uid);
                        const privateRef = doc(db, "users", firebaseUser.uid, "private_data", "profile");

                        // Parallel Fetch: Public Profile + Private Data
                        const [userSnap, privateSnap] = await Promise.all([
                            getDoc(userRef),
                            getDoc(privateRef)
                        ]);

                        let finalUserData: any = {};

                        if (userSnap.exists()) {
                            finalUserData = { ...userSnap.data(), id: firebaseUser.uid };
                        }
                        
                        // Merge Private Data (e.g. Email, Stripe ID, Real Name)
                        if (privateSnap.exists()) {
                            finalUserData = { ...finalUserData, ...privateSnap.data() };
                        }
                        // Ensure id is always set (document id is not in .data())
                        finalUserData.id = firebaseUser.uid;

                        if (userSnap.exists() || privateSnap.exists()) {
                            setUserData(finalUserData);

                            // [Data Strategy] Auto-populate Grade/Dept/Email
                            // We now store Email in PRIVATE data for security, but allow it in Public if needed? 
                            // Actually rules say Public is readable by all auth users. Email should be PRIVATE.
                            
                            const email = firebaseUser.email || "";
                            const universityId = getUniversityFromEmail(email);

                            // Strict Domain Enforcement
                            if (!universityId) {
                                console.warn("Blocked unsupported domain:", email);
                                await signOut(auth);
                                setUser(null);
                                setUserData(null);
                                toast.error("この大学のメールアドレスは現在対応していません（武蔵野大学のみ）");
                                setLoading(false);
                                return;
                            }

                            // updates logic
                            // We split updates: Public vs Private
                            const publicUpdates: any = {};
                            const privateUpdates: any = {};

                            if (!finalUserData.universityId) publicUpdates.universityId = universityId;
                            
                            // Grade Calculation
                            if (!finalUserData.grade) {
                                const derivedGrade = calculateGrade(email);
                                if (derivedGrade !== "不明") publicUpdates.grade = derivedGrade;
                            }
                            if (!finalUserData.departmentId) publicUpdates.departmentId = "不明";
                            
                            // Private: Ensure email is sync
                            if (finalUserData.email !== email) privateUpdates.email = email;

                            // Apply Updates
                            if (Object.keys(publicUpdates).length > 0) {
                                await setDoc(userRef, publicUpdates, { merge: true });
                                finalUserData = { ...finalUserData, ...publicUpdates };
                            }

                            if (Object.keys(privateUpdates).length > 0) {
                                await setDoc(privateRef, privateUpdates, { merge: true });
                                finalUserData = { ...finalUserData, ...privateUpdates };
                            }
                            
                            setUserData(finalUserData);

                        } else {
                            // First time login - Create Skeleton
                            // ... (Logic omitted for brevity, but should respect split)
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
            // Force account selection for users with multiple accounts (esp. on mobile)
            provider.setCustomParameters({
                prompt: 'select_account'
            });
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
            } else if (e.code === 'auth/cancelled-popup-request') {
                // 複数回クリックや別ポップアップでキャンセルされた場合
                toast.info("ログインがキャンセルされました。もう一度お試しください");
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
            const { signInAnonymously } = await import('firebase/auth');
            await signInAnonymously(auth);
            toast.success("テスト用アカウントでログインしました");
        } catch (e: any) {
            console.error(e);
            toast.error("デモログインエラー: " + e.message);
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
        throw new Error("useAuth は AuthProvider 内で使用してください");
    }
    return context;
}

// Helper: Extract Grade from Student ID in Email
// Format: s25xxxx@... -> Entry 2025 -> Current 2026(Jan) -> Acad 2025 -> Grade 1
function calculateGrade(email: string): string {
    if (!email) return "不明";
    const match = email.match(/^s(\d{2})/);
    if (!match) return "不明";

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
    return "その他";
}

// [Multi-Tenancy] Identify University from Email Domain
function getUniversityFromEmail(email: string): string | null {
    if (!email) return null;
    
    // 1. Musashino University
    if (email.endsWith("@stu.musashino-u.ac.jp") || email.endsWith("@musashino-u.ac.jp")) {
        return "musashino";
    }

    // 2. Future Expansions (Commented out but ready)
    // if (email.endsWith("@keio.jp")) return "keio";
    // if (email.endsWith("@waseda.jp")) return "waseda";

    return null; // Unsupported domain
}
