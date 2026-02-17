"use client"

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { getTransaction, getItem, getUser, updateTransactionStatus } from '@/services/firestore';
import { Transaction, Item, User, TransactionStatus } from '@/types';
import { TransactionDetailView } from '@/components/transaction/TransactionDetailView';
import { useAuth } from '@/contexts/AuthContext';

function TransactionDetailContent() {
    const searchParams = useSearchParams();
    const transactionId = searchParams.get('id');
    const { user, userData } = useAuth(); // Get actual logged-in user

    const [transaction, setTransaction] = useState<Transaction | null>(null);
    const [item, setItem] = useState<Item | null>(null);
    const [seller, setSeller] = useState<User | null>(null);
    // const [currentUser, setCurrentUser] = useState<User | null>(null); // Removed local state
    const [clientSecret, setClientSecret] = useState<string | undefined>(undefined);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        if (!transactionId) return;
        try {
            // 1. Fetch Transaction first (needed for IDs)
            const tx = await getTransaction(transactionId);
            if (!tx) throw new Error("Transaction not found");
            setTransaction(tx);

            // 2. Fetch Item and Seller
            const [itm, sellerData] = await Promise.all([
                getItem(tx.item_id),
                getUser(tx.seller_id)
            ]);

            if (!itm) throw new Error("Item not found");
            setItem(itm);
            setSeller(sellerData);

            // Note: We don't force 'currentUser' to be the buyer anymore. 
            // We use 'userData' from useAuth().

            // 3. [Security Fix] Fetch Client Secret if Approved (needed for Payment Form)
            // Only if I am the buyer and status is 'approved'
            const isBuyer = userData?.id === tx.buyer_id;

            if (tx.status === 'approved' && isBuyer) {
                try {
                    // Next.js API Routeプロキシ経由でCloud Functionsを呼び出し（CORS回避）
                    if (userData?.id && user) {
                        const token = await user.getIdToken();
                        const response = await fetch('/api/create-payment-intent', {
                            method: 'POST',
                            headers: { 
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({
                                transactionId: tx.id,
                                userId: userData.id
                            }),
                        });
                        if (!response.ok) {
                            const errData = await response.json();
                            throw new Error(errData.error || 'Payment intent creation failed');
                        }
                        const resData = await response.json();
                        setClientSecret(resData.clientSecret);
                    }
                    }
                } catch (intentErr: any) {
                    console.error("Failed to fetch payment intent", intentErr);
                    // Show error to help debugging (especially for "Seller has no Stripe ID" vs "Demo" issues)
                    toast.error(`決済準備エラー: ${intentErr.message}`);
                }
            }

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (transactionId && userData) fetchData();
        // If userData is needed for logic? fetchData depends on userData for the clientSecret check.
        // If userData loads *after* transactionId, we should trigger.
        // Actually, if userData is missing (not logged in), we might just show loading or error?
    }, [transactionId, userData]); // Add userData dependency

    const handleStatusChange = async (newStatus: TransactionStatus) => {
        if (!transaction || !transactionId) return;

        // Optimistic Update
        setTransaction(prev => prev ? { ...prev, status: newStatus } : null);

        try {
            // DEMO MODE CHECK
            const currentUser = userData as User; // safe cast for now
            // [Fix] Robust Demo Check: Check flag OR known demo email patterns
            const isDemoUser = currentUser?.is_demo === true ||
                currentUser?.university_email?.startsWith('s2527') ||
                currentUser?.university_email?.startsWith('s11111');

            if (newStatus === 'completed') {
                if (isDemoUser) {
                    // DEMO MODE: Bypass Cloud Function / Stripe
                    // Directly update Firestore + Unlock Mock Data
                    const { updateTransactionStatus } = await import('@/services/firestore');
                    const { Timestamp } = await import('firebase/firestore');

                    await updateTransactionStatus(transactionId, 'completed', {
                        unlocked_assets: {
                            student_id: seller?.student_id || "s9999999",
                            university_email: seller?.university_email || "demo@musashino-u.ac.jp",
                            unlockedAt: Timestamp.now()
                        }
                    });
                    toast.success("決済完了！(デモモード: Stripeスキップ)");
                } else {
                    // [SECURITY] Standard Flow - API Routeプロキシ経由
                    setLoading(true);
                    const token = await user?.getIdToken();
                    const unlockRes = await fetch('/api/unlock-transaction', {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                        },
                        body: JSON.stringify({
                            transactionId: transactionId,
                            userId: currentUser?.id
                        }),
                    });
                    if (!unlockRes.ok) {
                        throw new Error('Unlock failed');
                    }
                }
            } else {
                // Other statuses (approve/reject) still use direct update for now (MVP)
                await updateTransactionStatus(transactionId, newStatus);
                toast.success("ステータスを更新しました");
            }

            // Re-fetch to see the updated state (and unlocked assets from server)
            await fetchData();

        } catch (e: any) {
            console.error("Failed to update status", e);
            toast.error(`エラーが発生しました: ${e.message || "不明なエラー"}`);
            // Revert optimism
            setTransaction(transaction); // Reset to original state
        } finally {
            setLoading(false);
        }
    };

    if (!transactionId) return <div className="p-20 text-center">無効な取引IDです</div>;
    // Don't show loading forever if userData is missing (e.g. not logged in)
    // But for now, MVP assumes auth.
    if (loading && !transaction) return <div className="p-20 text-center">取引を読み込み中...</div>;

    // Check missing data
    if (!transaction || !item || !seller) return <div className="p-20 text-center">データが見つかりません</div>;
    if (!userData) return <div className="p-20 text-center">この取引を表示するにはログインしてください</div>;

    return (
        <div className="min-h-screen bg-slate-50 py-10 px-4">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-xl font-bold mb-6 text-slate-700">取引詳細</h1>
                <TransactionDetailView
                    transaction={transaction}
                    item={item}
                    seller={seller}
                    currentUser={userData as User}
                    onStatusChange={handleStatusChange}
                    clientSecret={clientSecret}
                />
            </div>
        </div>
    );
}

export default function TransactionDetailPage() {
    return (
        <Suspense fallback={<div className="p-20 text-center">読み込み中...</div>}>
            <TransactionDetailContent />
        </Suspense>
    );
}
