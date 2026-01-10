"use client"

import React, { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Transaction } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function AdminLogsPage() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);

    useEffect(() => {
        const q = query(collection(db, "transactions"), orderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Transaction[];
            setTransactions(data);
        });

        return () => unsubscribe();
    }, []);

    return (
        <div className="p-8 bg-slate-50 min-h-screen">
            <Card>
                <CardHeader>
                    <CardTitle>Transaction Logs (Admin)</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-100 text-slate-700 uppercase">
                                <tr>
                                    <th className="px-6 py-3">Date</th>
                                    <th className="px-6 py-3">Status</th>
                                    <th className="px-6 py-3">Params (Buyer / Seller / Item)</th>
                                    <th className="px-6 py-3">System Fee</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.map((tx) => (
                                    <tr key={tx.id} className="bg-white border-b hover:bg-slate-50">
                                        <td className="px-6 py-4 font-mono text-xs text-slate-500">
                                            {/* @ts-ignore: firestore timestamp handling */}
                                            {tx.createdAt?.toDate ? tx.createdAt.toDate().toLocaleString() : 'Pending'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <Badge variant="outline">{tx.status}</Badge>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-xs space-y-1">
                                                <div><span className="font-bold">B:</span> {tx.buyer_id}</div>
                                                <div><span className="font-bold">S:</span> {tx.seller_id}</div>
                                                <div><span className="font-bold">I:</span> {tx.item_id}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-bold">
                                            {tx.status === 'completed' || tx.status === 'approved'
                                                ? `${tx.fee_amount || 100} Coins`
                                                : '-'}
                                        </td>
                                    </tr>
                                ))}
                                {transactions.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-4 text-center text-slate-500">
                                            No transactions found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
