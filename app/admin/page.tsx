"use client"

import { useEffect, useState } from 'react';
import { getDocs, collection, getCountFromServer } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, ShoppingBag, Receipt, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function AdminDashboardPage() {
    const [counts, setCounts] = useState({ users: 0, items: 0, transactions: 0 });

    useEffect(() => {
        const fetchCounts = async () => {
            // Optimized: Use server-side counting
            try {
                const usersCount = await getCountFromServer(collection(db, "users"));
                const itemsCount = await getCountFromServer(collection(db, "items"));
                const txCount = await getCountFromServer(collection(db, "transactions"));

                setCounts({
                    users: usersCount.data().count,
                    items: itemsCount.data().count,
                    transactions: txCount.data().count
                });
            } catch (e) {
                console.error("Dashboard count error", e);
            }
        };
        fetchCounts();
    }, []);

    const cards = [
        { title: "Users", count: counts.users, icon: <Users className="h-4 w-4 text-slate-500" />, link: "/admin/users" },
        { title: "Items", count: counts.items, icon: <ShoppingBag className="h-4 w-4 text-slate-500" />, link: "/admin/items" },
        { title: "Transactions", count: counts.transactions, icon: <Receipt className="h-4 w-4 text-slate-500" />, link: "/admin/transactions" },
    ];

    return (
        <div className="p-8 bg-slate-50 min-h-screen">
            <h1 className="text-3xl font-bold mb-6 text-slate-800">管理ダッシュボード</h1>

            <div className="grid gap-4 md:grid-cols-3 mb-8">
                {cards.map((card) => (
                    <Link key={card.title} href={card.link}>
                        <Card className="hover:shadow-md transition-shadow cursor-pointer border-slate-200">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-slate-600">
                                    {card.title === "Users" ? "ユーザー数" : card.title === "Items" ? "出品数" : "取引数"}
                                </CardTitle>
                                {card.icon}
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-slate-800">{card.count} 件</div>
                                <p className="text-xs text-slate-500">
                                    登録総数
                                </p>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>

            <div className="bg-white p-6 rounded-lg border border-red-200">
                <h2 className="text-lg font-bold text-red-700 flex items-center gap-2 mb-4">
                    <ShieldAlert className="h-5 w-5" />
                    セキュリティ & メンテナンス
                </h2>
                <div className="flex gap-4">
                    <Button variant="outline" className="border-red-200 text-red-600 hover:bg-red-50">
                        自動キャンセル実行 (Dry Run)
                    </Button>
                    <Button variant="outline" className="border-slate-200 text-slate-600">
                        システムログ確認 (未実装)
                    </Button>
                </div>
            </div>
        </div>
    );
}
