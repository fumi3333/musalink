"use client"

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createTransaction, getItem } from '@/services/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { Item } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

function NewTransactionContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const itemId = searchParams.get('itemId');

    const [item, setItem] = useState<Item | null>(null);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [agreed, setAgreed] = useState(false); // [New] Disclaimer Check

    const { userData } = useAuth();

    useEffect(() => {
        const fetchItem = async () => {
            if (!itemId) return;
            try {
                const data = await getItem(itemId);
                setItem(data);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchItem();
    }, [itemId]);

    const handleCreateTransaction = async () => {
        if (!item) return;
        if (!userData?.id) {
            toast.error("ログインしてください");
            return;
        }
        setCreating(true);
        try {
            const transactionId = await createTransaction(item.id, userData.id, item.seller_id, {
                is_demo: !!userData.is_demo
            });
            router.push(`/transactions/detail?id=${transactionId}`);
        } catch (e) {
            console.error(e);
            toast.error("取引の開始に失敗しました: " + ((e as any).message || "不明なエラー"));
        } finally {
            setCreating(false);
        }
    };

    if (!itemId) return <div className="p-10 text-center">Invalid Item ID</div>;
    if (loading) return <div className="p-10 text-center">商品を読み込み中...</div>;
    if (!item) return <div className="p-10 text-center">Item not found</div>;

    // Logic: Block if (Buyer == Seller) AND (Not Demo User)
    const isSelfTrade = userData?.id === item.seller_id;
    const isDemoUser = !!userData?.is_demo;
    const shouldBlock = isSelfTrade && !isDemoUser;

    return (
        <div className="min-h-screen bg-slate-50 py-10 px-4 flex items-center justify-center">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>取引を開始しますか？</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="bg-slate-100 p-4 rounded-md">
                        <p className="font-bold text-lg">{item.title}</p>
                        <p className="text-slate-600">¥{item.price.toLocaleString()}</p>
                    </div>

                    {shouldBlock ? (
                        <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm font-bold border border-red-200">
                            自分の商品は購入できません
                        </div>
                    ) : (
                        <>
                            <p className="text-sm text-slate-500">
                                取引を開始すると、商品ステータスが「Matching」に変更され、手数料の支払いプロセスへ進みます。
                            </p>

                            <div className="bg-amber-50 p-3 rounded-md border border-amber-200">
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="mt-1 w-4 h-4 text-violet-600 rounded border-gray-300 focus:ring-violet-500"
                                        checked={agreed}
                                        onChange={(e) => setAgreed(e.target.checked)}
                                    />
                                    <div className="text-sm text-slate-700">
                                        <span className="font-bold text-slate-900 block mb-1">免責事項の確認</span>
                                        大学構内で発生した金銭トラブル等について、運営および大学側は一切の責任を負いません。
                                        <a href="/legal/terms" target="_blank" className="text-violet-600 hover:underline ml-1">
                                            利用規約
                                        </a>
                                        に同意します。
                                    </div>
                                </label>
                            </div>

                            <div className="flex gap-2">
                                <Button variant="outline" className="w-full" onClick={() => router.back()}>キャンセル</Button>
                                <Button
                                    className="w-full font-bold"
                                    onClick={handleCreateTransaction}
                                    disabled={creating || !agreed}
                                >
                                    {creating ? '処理中...' : '取引開始'}
                                </Button>
                            </div>

                            <div className="mt-4 pt-4 border-t border-slate-100 text-center">
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <button className="text-xs text-slate-400 hover:text-red-500 flex items-center justify-center gap-1 w-full">
                                            <AlertTriangle className="h-3 w-3" /> 問題を報告する
                                        </button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>問題を報告</DialogTitle>
                                            <DialogDescription>
                                                不適切な商品やユーザーについて報告します。
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="grid gap-4 py-4">
                                            <textarea
                                                id="report-reason-preview"
                                                className="flex min-h-[80px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                                                placeholder="問題の詳細を入力してください"
                                            />
                                            <Button onClick={async () => {
                                                const reasonEl = document.getElementById('report-reason-preview') as HTMLTextAreaElement;
                                                if (!reasonEl.value) return;
                                                try {
                                                    const { reportIssue } = await import('@/services/firestore');
                                                    await reportIssue('item', item.id, 'inappropriate_content', reasonEl.value); // Report Item
                                                    const { toast } = await import('sonner');
                                                    toast.success("報告を受け付けました");
                                                } catch (e) {
                                                    console.error(e);
                                                }
                                            }} className="bg-red-600 hover:bg-red-700 text-white w-full">
                                                送信する
                                            </Button>
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

export default function NewTransactionPage() {
    return (
        <Suspense fallback={<div className="p-10 text-center">読み込み中...</div>}>
            <NewTransactionContent />
        </Suspense>
    );
}
