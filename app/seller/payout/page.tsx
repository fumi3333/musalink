"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { db, auth } from "@/lib/firebase"
import { addDoc, collection, serverTimestamp } from "firebase/firestore"
import { getIdToken } from "firebase/auth"
import { toast } from "sonner"
import { CheckCircle, AlertTriangle, Loader2 } from "lucide-react"
import { FUNCTIONS_BASE_URL } from "@/lib/constants"

export default function PayoutPage() {
    const { userData, loading } = useAuth();
    const [balance, setBalance] = useState(0);
    const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
    const [connectingStripe, setConnectingStripe] = useState(false);

    // Bank Account State (Mocked)
    // const [bankInfo, setBankInfo] = useState(...);

    useEffect(() => {
        if (userData) {
            setBalance(userData.coin_balance || 0);
        }
    }, [userData]);

    const handleRequestPayout = async () => {
        if (balance < 1000) {
            toast.error("振込申請は1,000円から可能です。");
            return;
        }

        // Validate (Simplified for Mock)
        // No bank info check needed as it's pre-registered mock.

        setStatus('submitting');
        try {
            // Create Payout Request
            await addDoc(collection(db, "payout_requests"), {
                userId: userData.id,
                amount: balance,
                // bankInfo removed for security/compliance. Stripe Connect handles payouts.
                status: 'pending',
                createdAt: serverTimestamp()
            });

            // Note: Ideally, we should atomically decrement balance using a Cloud Function.
            // For MVP, we just create the request and let admin handle the rest.

            setStatus('success');
            toast.success("振込申請を受け付けました。");
        } catch (e) {
            console.error(e);
            setStatus('error');
            toast.error("申請に失敗しました。");
        }
    };

    if (loading) return <div className="p-10 text-center">読み込み中...</div>;

    if (status === 'success') {
        return (
            <div className="container mx-auto p-4 max-w-md text-center py-20">
                <div className="flex justify-center mb-4">
                    <CheckCircle className="w-16 h-16 text-green-500" />
                </div>
                <h2 className="text-xl font-bold mb-2">申請完了</h2>
                <p className="text-slate-600 mb-6">
                    振込申請を受け付けました。<br />
                    通常3〜5営業日以内に指定口座へ振り込まれます。
                </p>
                <Button onClick={() => window.location.href = '/mypage'}>マイページへ戻る</Button>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 max-w-lg min-h-screen bg-slate-50">
            <h1 className="text-xl font-bold mb-6 text-slate-800">売上・振込申請</h1>

            <Card className="mb-6">
                <CardHeader>
                    <CardTitle className="text-sm text-slate-500">現在の売上残高</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold text-slate-900">
                        ¥{balance.toLocaleString()}
                    </div>
                    {balance > 0 && balance < 1000 && (
                        <p className="text-xs text-amber-600 mt-2 flex items-center">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            振込には1,000円以上の残高が必要です
                        </p>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-bold">振込先口座情報</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Stripe Connect Status */}
                    <div className="bg-white border rounded-lg p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-[#635BFF] p-2 rounded text-white">
                                <svg role="img" viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.895-1.352 2.622-1.352 1.856 0 2.846.596 3.042.73l.535-3.197C15.79.915 14.54 0 12.025 0c-3.5 0-5.748 1.86-5.748 5.062 0 2.925 1.76 4.39 4.908 5.488 2.378.83 3.018 1.54 3.018 2.493 0 1.097-1.123 1.636-2.902 1.636-2.227 0-3.352-.619-3.71-.875l-.558 3.256c.945 1.046 2.637 1.487 4.54 1.487 3.738 0 6.07-1.93 6.07-5.223 0-2.818-1.579-4.347-3.667-5.174z" /></svg>
                            </div>
                            <div>
                                <p className="font-bold text-sm text-slate-700">ストライプ連携</p>
                                {userData?.stripe_connect_id && userData?.charges_enabled ? (
                                    <p className="text-xs text-green-600 font-medium flex items-center">
                                        <CheckCircle className="w-3 h-3 mr-1" />
                                        連携済み（受取可能）
                                    </p>
                                ) : userData?.stripe_connect_id ? (
                                    <p className="text-xs text-amber-600 font-medium flex items-center">
                                        <AlertTriangle className="w-3 h-3 mr-1" />
                                        登録中（オンボーディング未完了）
                                    </p>
                                ) : (
                                    <p className="text-xs text-slate-500">
                                        未連携
                                    </p>
                                )}
                            </div>
                        </div>
                        
                        {userData?.stripe_connect_id && userData?.charges_enabled ? (
                            /* オンボーディング完了 → Stripe ダッシュボードへ */
                            <Button variant="outline" size="sm" className="text-xs h-8" onClick={async () => {
                                const { httpsCallable } = await import('firebase/functions');
                                const { functions } = await import('@/lib/firebase');
                                toast.info("ダッシュボードを開いています...");
                                try {
                                    const createLink = httpsCallable(functions, 'createStripeLoginLink');
                                    const res = await createLink({ 
                                        accountId: userData.stripe_connect_id 
                                    }) as any;
                                    if (res.data.error) throw new Error(res.data.error);
                                    window.location.href = res.data.url;
                                } catch(e: any) { 
                                    console.error(e);
                                    toast.error("リンク作成エラー: " + e.message); 
                                }
                            }}>
                                設定
                            </Button>
                        ) : userData?.stripe_connect_id ? (
                            /* アカウントはあるがオンボーディング未完了 → 続きから */
                            <Button 
                                size="sm" 
                                className="text-xs h-8 bg-amber-500 hover:bg-amber-600 text-white"
                                disabled={connectingStripe}
                                onClick={async () => {
                                    if(!userData?.id || connectingStripe) return;
                                    setConnectingStripe(true);
                                    const targetUrl = `${FUNCTIONS_BASE_URL}/executeStripeConnect`;
                                    try {
                                        if (!auth.currentUser) throw new Error("ログインしていません。");
                                        const idToken = await getIdToken(auth.currentUser, true);
                                        const res = await fetch(targetUrl, {
                                            method: 'POST',
                                            headers: {
                                                'Authorization': `Bearer ${idToken}`,
                                                'Content-Type': 'application/json'
                                            },
                                            body: JSON.stringify({
                                                email: userData.email || userData.university_email,
                                                returnUrl: window.location.href,
                                                refreshUrl: window.location.href
                                            })
                                        });
                                        if (!res.ok) {
                                            const errorText = await res.text();
                                            let errorMsg = `サーバーエラー (${res.status})`;
                                            try { errorMsg = JSON.parse(errorText).error || errorMsg; } catch {}
                                            throw new Error(errorMsg);
                                        }
                                        const data = await res.json();
                                        if (data.url) {
                                            toast.success("登録画面へ移動します");
                                            window.location.href = data.url;
                                        } else {
                                            throw new Error("レスポンスにURLが含まれていません");
                                        }
                                    } catch(e: any) {
                                        console.error(e);
                                        let msg = e.message || "不明なエラー";
                                        if (e instanceof TypeError && e.message.includes("fetch")) {
                                            msg = "通信エラー: Cloud Functionに接続できませんでした";
                                        }
                                        toast.error(msg, { duration: 8000 });
                                    } finally {
                                        setConnectingStripe(false);
                                    }
                                }}
                            >
                                {connectingStripe ? (
                                    <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />登録中...</>
                                ) : (
                                    "登録を続ける"
                                )}
                            </Button>
                        ) : (
                            <Button 
                                size="sm" 
                                className="text-xs h-8 bg-[#635BFF] hover:bg-[#544DC8] text-white"
                                disabled={connectingStripe}
                                onClick={async () => {
                                    if(!userData?.id || connectingStripe) return;
                                    setConnectingStripe(true);
                                    const targetUrl = `${FUNCTIONS_BASE_URL}/executeStripeConnect`;
                                    console.log("[Stripe Connect] Calling:", targetUrl, "from:", window.location.origin);
                                    try {
                                        if (!auth.currentUser) {
                                            throw new Error("ログインしていません。再度ログインしてください。");
                                        }
                                        const idToken = await getIdToken(auth.currentUser, true);

                                        const res = await fetch(targetUrl, {
                                            method: 'POST',
                                            headers: {
                                                'Authorization': `Bearer ${idToken}`,
                                                'Content-Type': 'application/json'
                                            },
                                            body: JSON.stringify({
                                                email: userData.email || userData.university_email,
                                                returnUrl: window.location.href,
                                                refreshUrl: window.location.href
                                            })
                                        });

                                        if (!res.ok) {
                                            const errorText = await res.text();
                                            console.error("[Stripe Connect] Error response:", res.status, errorText);
                                            let errorMsg = `サーバーエラー (${res.status})`;
                                            try {
                                                const errorJson = JSON.parse(errorText);
                                                errorMsg = errorJson.error || errorMsg;
                                            } catch { /* text was not JSON */ }
                                            throw new Error(errorMsg);
                                        }

                                        const data = await res.json();
                                        if (data.url) {
                                            toast.success("連携画面へ移動します");
                                            window.location.href = data.url;
                                        } else {
                                            throw new Error("レスポンスにURLが含まれていません");
                                        }
                                    } catch(e: any) {
                                        console.error("[Stripe Connect] Error:", e);
                                        let userMessage = e.message || "不明なエラー";
                                        if (e instanceof TypeError && e.message.includes("fetch")) {
                                            userMessage = `通信エラー: Cloud Function (${targetUrl}) に接続できませんでした。CORSまたはネットワークの問題の可能性があります。`;
                                        }
                                        toast.error(userMessage, { duration: 8000 });
                                    } finally {
                                        setConnectingStripe(false);
                                    }
                                }}
                            >
                                {connectingStripe ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                        連携中...
                                    </>
                                ) : (
                                    "連携する"
                                )}
                            </Button>
                        )}
                    </div>


                    <div className="pt-4 border-t border-slate-100">
                        <Button
                            className="w-full bg-[#635BFF] hover:bg-[#544DC8] text-white font-bold h-12 shadow-lg shadow-indigo-200"
                            disabled={balance < 1000 || status === 'submitting'}
                            onClick={handleRequestPayout}
                        >
                            {status === 'submitting' ? '処理中...' : '売上を引き出す (即時)'}
                        </Button>
                        <p className="text-center text-xs text-slate-400 mt-3">
                            ※デモ環境のため、実際の出金は発生しません。<br />
                            (仮想的に振込完了ステータスになります)
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
