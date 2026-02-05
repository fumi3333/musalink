"use client"

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation'; // [New]
import { useAuth } from '@/contexts/AuthContext'; // [New]
import { getDocs, collection, orderBy, query, limit, startAfter } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Transaction } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Code } from 'lucide-react';

export default function AdminTransactionsPage() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [lastDoc, setLastDoc] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [hasMore, setHasMore] = useState(true);

    const fetchTxs = async (isNext = false) => {
        setLoading(true);
        try {
            let q = query(collection(db, "transactions"), orderBy("updatedAt", "desc"), limit(20));
            if (isNext && lastDoc) {
                q = query(collection(db, "transactions"), orderBy("updatedAt", "desc"), startAfter(lastDoc), limit(20));
            }

            const snap = await getDocs(q);
            const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));

            setTransactions(prev => isNext ? [...prev, ...data] : data);
            setLastDoc(snap.docs[snap.docs.length - 1]);
            setHasMore(snap.docs.length === 20);
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    // Admin Email List
    const ADMIN_EMAILS = [
        "admin@musashino-u.ac.jp",
        "fumi_admin@musashino-u.ac.jp",
        "s2527084@stu.musashino-u.ac.jp" // Your email for testing if needed, or remove for strictness
    ];



    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            router.push('/');
            return;
        }
        // Simple Admin Check
        if (!ADMIN_EMAILS.includes(user.email || "")) {
            alert("アクセス権限がありません");
            router.push('/');
            return;
        }

        fetchTxs();
    }, [user, authLoading]);

    if (loading && transactions.length === 0) return <div className="p-8">読み込み中...</div>;

    return (
        <div className="p-8 bg-slate-50 min-h-screen">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-slate-800">取引ログ (Transaction Logs)</h1>
                <Button onClick={() => downloadCSV(transactions)} variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-200 border border-green-200">
                    <Code className="mr-2 h-4 w-4" /> Download CSV
                </Button>
            </div>

            {/* [New] Mini Dashboard for Beta Monitoring */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <Card>
                    <CardContent className="p-4 flex flex-col items-center justify-center">
                        <span className="text-xs text-slate-500 font-bold uppercase">Total Deals</span>
                        <span className="text-2xl font-bold text-slate-800">{transactions.length}</span>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex flex-col items-center justify-center">
                        <span className="text-xs text-slate-500 font-bold uppercase">Total Volume</span>
                        <span className="text-2xl font-bold text-violet-600">
                            ¥{transactions.reduce((sum, tx) => sum + ((tx.fee_amount || 0) * 10), 0).toLocaleString()}
                        </span>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex flex-col items-center justify-center">
                        <span className="text-xs text-slate-500 font-bold uppercase">Revenue (Fees)</span>
                        <span className="text-2xl font-bold text-green-600">
                            ¥{transactions.reduce((sum, tx) => sum + (tx.fee_amount || 0), 0).toLocaleString()}
                        </span>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex flex-col items-center justify-center">
                        <span className="text-xs text-slate-500 font-bold uppercase">Status</span>
                        <span className="text-xs font-bold text-slate-700 mt-1">
                            Comp: {transactions.filter(t => t.status === 'completed').length} /
                            Pend: {transactions.filter(t => t.status === 'payment_pending').length}
                        </span>
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-4">
                {transactions.map(tx => (
                    <Card key={tx.id} className="border border-slate-200">
                        <CardHeader className="py-3 px-4 bg-slate-50/50 flex flex-row items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="font-mono text-xs text-slate-500">{tx.id}</span>
                                <Badge className={
                                    tx.status === 'completed' ? "bg-green-500" :
                                        tx.status === 'cancelled' ? "bg-red-500" :
                                            tx.status === 'payment_pending' ? "bg-blue-500" : "bg-slate-500"
                                }>
                                    {tx.status}
                                </Badge>
                            </div>
                            <div className="text-xs text-slate-400">
                                更新: {tx.updatedAt?.toDate?.()?.toLocaleString() || "N/A"}
                            </div>
                        </CardHeader>
                        <CardContent className="py-3 px-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-2">
                                <div>
                                    <span className="font-bold text-slate-600 block text-xs">購入者 (Buyer)</span>
                                    {tx.buyer_id}
                                </div>
                                <div>
                                    <span className="font-bold text-slate-600 block text-xs">出品者 (Seller)</span>
                                    {tx.seller_id}
                                </div>
                                <div>
                                    <span className="font-bold text-slate-600 block text-xs">財務 (Financials)</span>
                                    手数料: ¥{tx.fee_amount} / 情報開示: {tx.unlocked_assets ? "済" : "未"}
                                </div>
                            </div>

                            <div className="flex justify-between items-center mt-2 border-t pt-2">
                                <span className="text-xs text-slate-400">
                                    Stripe ID: {tx.payment_intent_id || "なし"}
                                </span>

                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                                            <Code className="h-3 w-3" /> 生データ表示 (JSON)
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
                                        <h3 className="font-bold mb-2">Transaction Data (JSON)</h3>
                                        <pre className="bg-slate-950 text-green-400 p-4 rounded text-xs font-mono overflow-auto">
                                            {JSON.stringify(tx, null, 2)}
                                        </pre>
                                    </DialogContent>
                                </Dialog>

                                <Button
                                    variant="destructive"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={async () => {
                                        if (!confirm("本当に強制キャンセルしますか？")) return;
                                        try {
                                            const { httpsCallable, getFunctions } = await import('firebase/functions');
                                            const functions = getFunctions();
                                            const cancelFn = httpsCallable(functions, 'adminCancelTransaction');
                                            await cancelFn({ transactionId: tx.id, reason: "Manual Admin Cancel" });
                                            alert("キャンセルしました");
                                            fetchTxs(); // Refresh
                                        } catch (e: any) {
                                            alert("エラー: " + e.message);
                                        }
                                    }}
                                >
                                    Force Cancel
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {
                hasMore && (
                    <div className="mt-6 text-center">
                        <Button
                            onClick={() => fetchTxs(true)}
                            disabled={loading}
                            variant="outline"
                        >
                            {loading ? "読み込み中..." : "もっと見る"}
                        </Button>
                    </div>
                )
            }
        </div>
    );
}

// Helper to download CSV
function downloadCSV(transactions: Transaction[]) {
    const headers = ["ID", "Status", "Date", "BuyerID", "SellerID", "Price", "Fee", "StripeID"];
    const rows = transactions.map(tx => [
        tx.id,
        tx.status,
        tx.updatedAt?.toDate?.()?.toISOString() || "",
        tx.buyer_id,
        tx.seller_id,
        tx.fee_amount ? (tx.fee_amount * 10) : 0, // Approximate total based on fee (10%), or just use fee
        tx.fee_amount || 0,
        tx.payment_intent_id || ""
    ]);

    const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `transactions_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
}
