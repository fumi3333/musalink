
"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db, functions } from '@/lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, CheckCircle, AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/contexts/AuthContext';

export default function PayoutSettingsPage() {
    const router = useRouter();
    const { user, userData, loading } = useAuth();
    const [setupLoading, setSetupLoading] = useState(false);

    useEffect(() => {
        if (!loading && !user) {
            router.push('/');
        }
    }, [user, loading, router]);

    const handleSetup = async () => {
        if (!user) return;
        setSetupLoading(true);

        try {
            // 1. Check if account exists, if not create one
            let accountId = userData?.stripe_connect_id;

            if (!accountId) {
                const createFn = httpsCallable(functions, 'createStripeConnectAccount');
                const result = await createFn({
                    userId: user.uid,
                    email: user.email
                });
                accountId = (result.data as any).accountId;
                toast.success("Stripeアカウントを作成しました");
            }

            // 2. Create Account Link for onboarding
            const linkFn = httpsCallable(functions, 'createStripeAccountLink');
            const linkResult = await linkFn({
                accountId: accountId,
                returnUrl: window.location.href, // Come back here
                refreshUrl: window.location.href, // Retry here
            });

            const url = (linkResult.data as any).url;
            window.location.href = url; // Redirect to Stripe

        } catch (e: any) {
            console.error(e);
            toast.error("セットアップエラー: " + e.message);
            setSetupLoading(false);
        }
    };

    if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin h-8 w-8 text-violet-600" /></div>;

    const isConnected = !!userData?.charges_enabled;

    return (
        <div className="min-h-screen bg-slate-50 py-10 px-4">
            <Card className="max-w-md mx-auto shadow-md">
                <CardHeader className="text-center bg-violet-50 border-b border-violet-100 pb-6">
                    <div className="mx-auto bg-white p-3 rounded-full w-16 h-16 flex items-center justify-center mb-4 shadow-sm">
                        <Building2 className="h-8 w-8 text-violet-600" />
                    </div>
                    <CardTitle className="text-xl font-bold text-violet-900">売上受け取り設定</CardTitle>
                    <CardDescription>
                        売上金を受け取るために銀行口座の登録が必要です。(Stripe Connect)
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">

                    {isConnected ? (
                        <div className="text-center space-y-4">
                            <div className="bg-green-50 text-green-700 p-4 rounded-lg flex items-center justify-center gap-2 border border-green-200">
                                <CheckCircle className="h-6 w-6" />
                                <span className="font-bold">口座登録済み</span>
                            </div>
                            <p className="text-sm text-slate-600">
                                設定は完了しています。<br />
                                これで出品を行うことができます。
                            </p>
                            <Button className="w-full" onClick={() => router.push('/items/create')}>
                                出品画面へ進む <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="bg-amber-50 text-amber-800 p-3 rounded-md text-sm flex gap-2 items-start border border-amber-200">
                                <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                                <div>
                                    <span className="font-bold block mb-1">本人確認書類が必要です</span>
                                    銀行口座情報と、免許証やマイナンバーカードなどの本人確認書類を手元に用意してください。
                                </div>
                            </div>

                            <Button
                                className="w-full bg-violet-600 hover:bg-violet-700 font-bold py-6 text-lg"
                                onClick={handleSetup}
                                disabled={setupLoading}
                            >
                                {setupLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "銀行口座を登録する"}
                            </Button>

                            <p className="text-xs text-center text-slate-500">
                                安全な決済システム Stripe のサイトへ移動します。
                            </p>
                        </div>
                    )}

                </CardContent>
            </Card>
        </div>
    );
}
