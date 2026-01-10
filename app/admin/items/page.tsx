"use client"

import { useEffect, useState } from 'react';
import { getDocs, collection, query, limit, startAfter, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Item } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function AdminItemsPage() {
    const [items, setItems] = useState<Item[]>([]);
    const [lastDoc, setLastDoc] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [hasMore, setHasMore] = useState(true);

    const fetchItems = async (isNext = false) => {
        setLoading(true);
        try {
            // Updated Date Descending
            let q = query(collection(db, "items"), orderBy("createdAt", "desc"), limit(20));
            if (isNext && lastDoc) {
                q = query(collection(db, "items"), orderBy("createdAt", "desc"), startAfter(lastDoc), limit(20));
            }

            const snap = await getDocs(q);
            const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Item));

            setItems(prev => isNext ? [...prev, ...data] : data);
            setLastDoc(snap.docs[snap.docs.length - 1]);
            setHasMore(snap.docs.length === 20);
        } catch (e) {
            console.error("Fetch items error", e);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchItems();
    }, []);

    if (loading && items.length === 0) return <div className="p-8">読み込み中...</div>;

    return (
        <div className="p-8 bg-slate-50 min-h-screen">
            <h1 className="text-3xl font-bold mb-6 text-slate-800">出品商品一覧 (Inventory)</h1>
            <div className="grid gap-4">
                {items.map(item => (
                    <Card key={item.id} className="border border-slate-200">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg flex justify-between items-center">
                                <span>{item.title}</span>
                                <Badge variant="outline">{item.status}</Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-sm font-mono bg-slate-100 p-2 rounded mb-2">
                                ID: {item.id}
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm text-slate-600">
                                <div>価格: ¥{item.price.toLocaleString()}</div>
                                <div>出品者ID: {item.seller_id}</div>
                                <div>状態: {item.condition} / 5</div>
                                <div>作成日時: {item.metadata?.createdAt?.toDate?.()?.toLocaleString() || item.createdAt?.toDate?.()?.toLocaleString() || "不明"}</div>
                            </div>
                            {item.metadata?.seller_department && (
                                < Badge variant="secondary" className="mt-2 text-xs">
                                    {item.metadata.seller_department}
                                </Badge>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>

            {hasMore && (
                <div className="mt-6 text-center">
                    <Button
                        onClick={() => fetchItems(true)}
                        disabled={loading}
                        variant="outline"
                    >
                        {loading ? "読み込み中..." : "もっと見る"}
                    </Button>
                </div>
            )}
        </div>
    );
}
