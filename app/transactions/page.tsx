"use client"

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Transaction, Item } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Loader2, Package, RefreshCw } from 'lucide-react';
import { getTransactionStatusLabel } from '@/lib/utils';

export default function TransactionListPage() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'transactions' | 'items'>('transactions');
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [myItems, setMyItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;

        const fetchData = async () => {
            try {
                // 1. Fetch Transactions
                const qTxBuyer = query(collection(db, "transactions"), where("buyer_id", "==", user.uid));
                const qTxSeller = query(collection(db, "transactions"), where("seller_id", "==", user.uid));

                // 2. Fetch My Items
                const qItems = query(collection(db, "items"), where("seller_id", "==", user.uid));

                const [snapTxBuyer, snapTxSeller, snapItems] = await Promise.all([
                    getDocs(qTxBuyer),
                    getDocs(qTxSeller),
                    getDocs(qItems)
                ]);

                // Process Transactions
                const txMap = new Map<string, Transaction>();
                snapTxBuyer.forEach(doc => txMap.set(doc.id, { id: doc.id, ...doc.data() } as Transaction));
                snapTxSeller.forEach(doc => txMap.set(doc.id, { id: doc.id, ...doc.data() } as Transaction));

                const txList = Array.from(txMap.values());
                // Sort by date desc (local)
                txList.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                setTransactions(txList);

                // Process Items
                const itemsList: Item[] = [];
                snapItems.forEach(doc => itemsList.push({ id: doc.id, ...doc.data() } as Item));
                // Sort by date desc (local)
                itemsList.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                setMyItems(itemsList);

            } catch (error) {
                console.error("Failed to fetch data", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user]);

    if (!user) return <div className="p-8 text-center">ログインしてください</div>;
    if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="container mx-auto px-4 py-8 max-w-2xl">
            <h1 className="text-2xl font-bold mb-6">マイページ (Activity)</h1>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 border-b border-slate-200 pb-1">
                <Button
                    variant={activeTab === 'transactions' ? 'default' : 'ghost'}
                    onClick={() => setActiveTab('transactions')}
                    className={activeTab === 'transactions' ? "bg-violet-600 hover:bg-violet-700" : "text-slate-500"}
                >
                    取引履歴 ({transactions.length})
                </Button>
                <Button
                    variant={activeTab === 'items' ? 'default' : 'ghost'}
                    onClick={() => setActiveTab('items')}
                    className={activeTab === 'items' ? "bg-violet-600 hover:bg-violet-700" : "text-slate-500"}
                >
                    出品した商品 ({myItems.length})
                </Button>
            </div>

            {/* Content: Transactions */}
            {activeTab === 'transactions' && (
                transactions.length === 0 ? (
                    <div className="text-center text-slate-500 py-12 bg-slate-50 rounded-lg">
                        取引はまだありません
                    </div>
                ) : (
                    <div className="space-y-4">
                        {transactions.map(tx => (
                            <Link href={`/transactions/detail?id=${tx.id}`} key={tx.id}>
                                <Card className="hover:bg-slate-50 transition-colors cursor-pointer border hover:border-violet-300">
                                    <CardContent className="p-4">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className={`text-xs px-2 py-1 rounded font-bold ${tx.seller_id === user.uid ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                                                }`}>
                                                {tx.seller_id === user.uid ? '出品 (Seller)' : '購入 (Buyer)'}
                                            </span>
                                            <span className="text-xs text-slate-400">
                                                {tx.createdAt?.seconds ? new Date(tx.createdAt.seconds * 1000).toLocaleDateString() : ''}
                                            </span>
                                        </div>
                                        <h3 className="font-bold text-slate-800">
                                            取引 #{tx.id.substring(0, 6)}...
                                        </h3>
                                        <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
                                            ステータス:
                                            <span className={`font-mono px-2 py-0.5 rounded text-xs border ${tx.status === 'completed' ? 'bg-green-50 text-green-700 border-green-200' :
                                                tx.status === 'payment_pending' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                    'bg-slate-100'
                                                }`}>
                                                {getTransactionStatusLabel(tx.status)}
                                            </span>
                                        </p>
                                    </CardContent>
                                </Card>
                            </Link>
                        ))}
                    </div>
                )
            )}

            {/* Content: My Items */}
            {activeTab === 'items' && (
                myItems.length === 0 ? (
                    <div className="text-center text-slate-500 py-12 bg-slate-50 rounded-lg">
                        出品した商品はまだありません
                    </div>
                ) : (
                    <div className="space-y-4">
                        {myItems.map(item => {
                            // Find related transaction to link to detail page
                            const relatedTx = transactions.find(t => t.item_id === item.id);

                            // Determine Link Target
                            let linkHref = '#';
                            if (item.status === 'listing') {
                                // For MVP, listing items link to nothing (or edit mock?)
                                // Ideally: /items/${item.id} but page doesn't exist yet.
                                // Let's disable click or point to homepage/search? 
                                // Actually, let's point to /items/create (which might handle edit in future) or just #
                                linkHref = '#';
                            } else if ((item.status === 'matching' || item.status === 'sold') && relatedTx) {
                                linkHref = `/transactions/detail?id=${relatedTx.id}`;
                            }

                            return (
                                <div key={item.id} className="relative group">
                                    <Card className={`transition-colors border ${linkHref !== '#' ? 'hover:bg-slate-50 hover:border-violet-300 cursor-pointer' : ''}`}>
                                        <CardContent className="p-4 flex gap-4 items-center">
                                            <div className="w-16 h-16 bg-slate-200 rounded-md flex-shrink-0 bg-cover bg-center"
                                                style={{ backgroundImage: item.image_urls?.[0] ? `url(${item.image_urls[0]})` : undefined }}>
                                                {!item.image_urls?.[0] && <Package className="w-8 h-8 text-slate-400 m-auto mt-4" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-bold text-slate-800 truncate">{item.title}</h3>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="font-bold text-violet-600">¥{item.price.toLocaleString()}</span>
                                                    <span className={`text-xs px-2 py-0.5 rounded border ${item.status === 'listing' ? 'bg-green-50 text-green-700 border-green-200' :
                                                        item.status === 'sold' ? 'bg-slate-100 text-slate-500 border-slate-200' :
                                                            'bg-yellow-50 text-yellow-700 border-yellow-200'
                                                        }`}>
                                                        {item.status === 'listing' ? '出品中' :
                                                            item.status === 'matching' ? '取引中' :
                                                                item.status === 'sold' ? '売却済' : item.status}
                                                    </span>
                                                </div>
                                            </div>
                                            {/* Clickable Overlay */}
                                            {linkHref !== '#' && (
                                                <Link href={linkHref} className="absolute inset-0" />
                                            )}
                                        </CardContent>
                                    </Card>
                                </div>
                            );
                        })}
                    </div>
                )
            )}
        </div>
    );
}
