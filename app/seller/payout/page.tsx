"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { db } from "@/lib/firebase"
import { addDoc, collection, serverTimestamp } from "firebase/firestore"
import { toast } from "sonner"
import { CheckCircle, AlertTriangle } from "lucide-react"

export default function PayoutPage() {
    const { userData, loading } = useAuth();
    const [balance, setBalance] = useState(0);
    const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

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
                bankInfo: { // Mocked Bank Info for Audit
                    bankName: "三菱UFJ銀行",
                    branchName: "本店",
                    accountType: "ordinary",
                    accountNumber: "****1234",
                    accountHolder: "MOCK USER"
                },
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

    if (loading) return <div className="p-10 text-center">Loading...</div>;

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
                    {/* Mock Stripe Status */}
                    <div className="bg-white border rounded-lg p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-[#635BFF] p-2 rounded text-white">
                                {/* Stripe Logo Icon (approx) */}
                                <svg role="img" viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.895-1.352 2.622-1.352 1.856 0 2.846.596 3.042.73l.535-3.197C15.79.915 14.54 0 12.025 0c-3.5 0-5.748 1.86-5.748 5.062 0 2.925 1.76 4.39 4.908 5.488 2.378.83 3.018 1.54 3.018 2.493 0 1.097-1.123 1.636-2.902 1.636-2.227 0-3.352-.619-3.71-.875l-.558 3.256c.945 1.046 2.637 1.487 4.54 1.487 3.738 0 6.07-1.93 6.07-5.223 0-2.818-1.579-4.347-3.667-5.174z" /></svg>
                            </div>
                            <div>
                                <p className="font-bold text-sm text-slate-700">Stripe Connect</p>
                                <p className="text-xs text-green-600 font-medium flex items-center">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    連携済み (Connected)
                                </p>
                            </div>
                        </div>
                        <Button variant="outline" size="sm" className="text-xs h-8" disabled>
                            設定
                        </Button>
                    </div>

                    {/* Mock Bank Info */}
                    <div className="space-y-2">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">振込先口座 (Registered Bank)</p>
                        <div className="flex items-center justify-between p-3 bg-slate-100 rounded border border-slate-200">
                            <div className="flex items-center gap-2">
                                <div className="text-2xl opacity-50">🏦</div>
                                <div>
                                    <p className="text-sm font-bold text-slate-700">三菱UFJ銀行</p>
                                    <p className="text-xs text-slate-500">普通 •••• 1234</p>
                                </div>
                            </div>
                            <span className="text-xs text-slate-400">確認済み</span>
                        </div>
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
