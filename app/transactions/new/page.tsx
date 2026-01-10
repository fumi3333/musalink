"use client"

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createTransaction, getItem } from '@/services/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { Item } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function NewTransactionContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const itemId = searchParams.get('itemId');

    const [item, setItem] = useState<Item | null>(null);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);

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
            alert("ログインしてください");
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
            alert("取引の開始に失敗しました");
        } finally {
            setCreating(false);
        }
    };

    if (!itemId) return <div className="p-10 text-center">Invalid Item ID</div>;
    if (loading) return <div className="p-10 text-center">Loading Item...</div>;
    if (!item) return <div className="p-10 text-center">Item not found</div>;

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
                    <p className="text-sm text-slate-500">
                        取引を開始すると、商品ステータスが「Matching」に変更され、手数料の支払いプロセスへ進みます。
                    </p>
                    <div className="flex gap-2">
                        <Button variant="outline" className="w-full" onClick={() => router.back()}>キャンセル</Button>
                        <Button className="w-full font-bold" onClick={handleCreateTransaction} disabled={creating}>
                            {creating ? '処理中...' : '取引開始'}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default function NewTransactionPage() {
    return (
        <Suspense fallback={<div className="p-10 text-center">Loading...</div>}>
            <NewTransactionContent />
        </Suspense>
    );
}
