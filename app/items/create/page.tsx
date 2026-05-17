"use client"

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { OnboardingModal } from "@/components/auth/OnboardingModal";
import { ItemForm } from '@/components/items/ItemForm';

type BlockingReason = 'unauthenticated' | 'unverified' | 'payout_missing' | null;

export default function CreateListingPage() {
    const { user, userData: authUserData, login } = useAuth();
    const router = useRouter();

    const [blockingReason, setBlockingReason] = useState<BlockingReason>(null);
    const [currentUser, setCurrentUser] = useState<any>(null);

    useEffect(() => {
        if (!user) {
            setBlockingReason('unauthenticated');
            setCurrentUser(null);
            return;
        }

        if (!authUserData) {
            // まだ AuthContext がロード中 — ローディング表示で待つ
            return;
        }

        if (!authUserData.is_verified && !authUserData.is_demo) {
            setBlockingReason('unverified');
            setCurrentUser(authUserData);
            return;
        }

        if (!authUserData.charges_enabled && !authUserData.is_demo) {
            setBlockingReason('payout_missing');
            setCurrentUser(authUserData);
            return;
        }

        setBlockingReason(null);
        setCurrentUser(authUserData);
    }, [user, authUserData]);

    if (blockingReason === 'unauthenticated') {
        return (
            <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
                <Card className="max-w-md w-full shadow-lg border-slate-200">
                    <CardHeader className="bg-white rounded-t-lg">
                        <CardTitle className="text-slate-800 text-center">ログインが必要です</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4 text-center">
                        <p className="text-slate-600">
                            出品するには、まずログインしてください。<br />
                            (武蔵野大学のGoogleアカウントが必要です)
                        </p>
                        <Button
                            className="w-full font-bold bg-violet-600 text-white"
                            onClick={login}
                        >
                            Googleでログイン
                        </Button>
                        <Link href="/items">
                            <Button variant="ghost" className="w-full mt-2">戻る</Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!currentUser) {
        return <div className="min-h-screen flex items-center justify-center text-slate-500">読み込み中...</div>;
    }

    if (blockingReason === 'unverified') {
        return (
            <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
                <Card className="max-w-md w-full shadow-lg border-violet-100">
                    <CardHeader className="bg-violet-50 rounded-t-lg">
                        <CardTitle className="text-violet-800 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-violet-600" />
                            本人確認が必要です
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        <p className="text-slate-600 leading-relaxed">
                            安全な取引のため、出品を行うには大学メールアドレスによる本人確認が必要です。
                        </p>
                        <Button className="w-full font-bold" onClick={() => router.push('/verify')}>
                            本人確認ページへ進む
                        </Button>
                        <Link href="/items">
                            <Button variant="ghost" className="w-full mt-2">戻る</Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (blockingReason === 'payout_missing') {
        return (
            <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
                <Card className="max-w-md w-full shadow-lg border-violet-100">
                    <CardHeader className="bg-violet-50 rounded-t-lg">
                        <CardTitle className="text-violet-800 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-violet-600" />
                            口座設定が必要です
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        <p className="text-slate-600 leading-relaxed">
                            出品を行うには、売上金を受け取るための口座設定（Stripe Connect）が必要です。<br />
                            テスト環境（Sandbox）の場合は、スキップボタンでテスト情報を自動入力して設定を完了させてください。
                        </p>
                        <Button className="w-full font-bold" onClick={() => router.push('/seller/payout')}>
                            口座設定ページへ進む
                        </Button>
                        <Link href="/items">
                            <Button variant="ghost" className="w-full mt-2">戻る</Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 py-6 px-4 pb-20 md:py-10">
            <OnboardingModal />
            <div className="max-w-2xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-xl md:text-2xl font-bold text-slate-800">商品を出品する</h1>
                    <Link href="/items">
                        <Button variant="ghost" size="sm">キャンセル</Button>
                    </Link>
                </div>

                <ItemForm
                    currentUser={currentUser}
                    userUid={user!.uid}
                    onSuccess={() => router.push('/items')}
                />
            </div>
        </div>
    );
}
