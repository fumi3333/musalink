"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { toast } from 'sonner';

interface AuthContextType {
    user: User | null;
    userData: any | null;
    loading: boolean;
    error: string | null;
    clearError: () => void;
    unreadNotifications: number;
    login: () => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // signInWithRedirect 経由でログインしてきた場合、戻った直後のページロードで結果を回収する。
    // 成功時の onAuthStateChanged は自動で発火するので、ここでは toast 表示のみ。
    useEffect(() => {
        getRedirectResult(auth)
            .then((result) => {
                if (result?.user) {
                    toast.success("ログインしました");
                }
            })
            .catch((e: any) => {
                if (e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/cancelled-popup-request') {
                    return; // ユーザーによるキャンセルは無視
                }
                console.error("[Auth] getRedirectResult error:", e);
                setError(`ログイン後の処理でエラー: ${e?.message || '不明'}`);
            });
    }, []);

    useEffect(() => {
        // Safety timeout to prevent infinite loading
        const timeoutId = setTimeout(() => {
            setLoading(false);
        }, 500);

        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            clearTimeout(timeoutId);
            if (firebaseUser) {


                // 2026-05-18: ドメイン制限撤廃。個人 Gmail でもログイン可。
                // 在学確認は /verify ページの OTP フローで行い、is_verified + Custom Claim で管理。
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
                            
                            // universityId / grade は OTP 認証後に Cloud Function が設定するため、
                            // ログイン時点では自動補完しない。
                            const publicUpdates: any = {};
                            const privateUpdates: any = {};

                            if (!finalUserData.departmentId) publicUpdates.departmentId = "不明";

                            // Private: Ensure login email is synced
                            const loginEmail = firebaseUser.email || "";
                            if (finalUserData.email !== loginEmail) privateUpdates.email = loginEmail;

                            // 2026-05-17: is_verified / trust_score などは server-only field.
                            // クライアントから書こうとすると Firestore Rules で拒否されるため
                            // /verify ページの verifyUserIdentity Cloud Function に委譲する。

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
                            // First time login — 骨格だけ作成。
                            // universityId / grade / is_verified は /verify の OTP フローで Cloud Function が設定。
                            const newPublicData = {
                                isProfileComplete: false,
                                departmentId: "不明",
                                created_at: new Date()
                            };

                            const newPrivateData = {
                                email: firebaseUser.email || "",
                            };

                            await setDoc(userRef, newPublicData);
                            await setDoc(privateRef, newPrivateData);

                            setUserData({ ...newPublicData, ...newPrivateData, id: firebaseUser.uid });
                        }
                    } catch (e: any) {
                        console.error("Fetch user data error:", e);
                        setError("ユーザー情報の読み込みに失敗しました。ページを再読み込みしてください。");
                        toast.error("ユーザー情報の読み込みに失敗しました", {
                            description: "ページを再読み込みするか、時間をおいて再度ログインしてください。",
                            duration: 8000,
                        });
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

    const clearError = () => setError(null);

    const login = async () => {
        setError(null);

        const provider = new GoogleAuthProvider();
        // Force account selection for users with multiple accounts (esp. on mobile)
        provider.setCustomParameters({ prompt: 'select_account' });

        // popup blocked / unsupported (LINE in-app browser等) は redirect にフォールバック
        const POPUP_BLOCKED_CODES = new Set([
            'auth/popup-blocked',
            'auth/operation-not-supported-in-this-environment',
            'auth/web-storage-unsupported',
        ]);

        try {
            await signInWithPopup(auth, provider);
            toast.success("ログインしました");
        } catch (e: any) {
            // Popup ブロック等 → redirect で再試行（戻ってきたら getRedirectResult で受け取る）
            if (POPUP_BLOCKED_CODES.has(e.code)) {
                console.warn(`[Auth] Popup unavailable (${e.code}), falling back to redirect`);
                toast.info("ポップアップが開けないため、別画面でログインします…");
                try {
                    await signInWithRedirect(auth, provider);
                    return; // ページが遷移するのでここから先は到達しない
                } catch (redirectErr: any) {
                    console.error("[Auth] Redirect fallback also failed:", redirectErr);
                    const msg = "ログインに失敗しました。Safari か Chrome で開き直してください。";
                    setError(msg);
                    toast.error(msg);
                    throw redirectErr;
                }
            }

            // ユーザーによるキャンセルは静かに（toast.info のみ）
            if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') {
                toast.info("ログインがキャンセルされました");
                throw e;
            }

            // Firebase Console の Google プロバイダー未設定
            if (e.code === 'auth/configuration-not-found') {
                const msg = "Googleログイン設定が有効になっていません。Firebase Console で Google プロバイダーを有効化してください。";
                console.error("[Auth] Configuration error:", e);
                setError(msg);
                toast.error(msg);
                throw e;
            }

            // それ以外は汎用エラー
            console.error("[Auth] Login error:", e);
            const msg = `ログインエラー: ${e.message || '不明なエラー'}`;
            setError(msg);
            toast.error(msg);
            throw e;
        }
    };

    const logout = async () => {
        try {
            await signOut(auth);
            setUser(null);
            setUserData(null);
            toast.success("ログアウトしました");
            window.location.reload();
        } catch (e: any) {
            toast.error("ログアウトエラー: " + e.message);
        }
    };



    return (
        <AuthContext.Provider value={{ user, userData, loading, error, clearError, unreadNotifications, login, logout }}>
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

