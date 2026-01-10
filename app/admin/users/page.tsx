"use client";

import { useEffect, useState } from 'react';
import { getDocs, collection, query, limit, startAfter } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function AdminUsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [lastDoc, setLastDoc] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [hasMore, setHasMore] = useState(true);

    const fetchUsers = async (isNext = false) => {
        setLoading(true);
        try {
            let q = query(collection(db, "users"), limit(20));
            if (isNext && lastDoc) {
                q = query(collection(db, "users"), startAfter(lastDoc), limit(20));
            }

            const snap = await getDocs(q);
            const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));

            setUsers(prev => isNext ? [...prev, ...data] : data);
            setLastDoc(snap.docs[snap.docs.length - 1]);
            setHasMore(snap.docs.length === 20);
        } catch (e) {
            console.error("Fetch error", e);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    // Helper for loading state (initial only)
    if (loading && users.length === 0) return <div className="p-8">読み込み中...</div>;

    return (
        <div className="p-8 bg-slate-50 min-h-screen">
            <h1 className="text-3xl font-bold mb-6 text-slate-800">ユーザー管理 (User Management)</h1>
            <div className="grid gap-4">
                {users.map(user => (
                    <Card key={user.id} className="border border-slate-200">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg flex justify-between items-center">
                                <span>{user.display_name}</span>
                                <Badge variant={user.is_verified ? "default" : "secondary"}>
                                    {user.is_verified ? "認証済み" : "未認証"}
                                </Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-sm font-mono bg-slate-100 p-2 rounded mb-2">
                                ID: {user.id}
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm text-slate-600">
                                <div>Stripe ID: {user.stripe_connect_id || "連携なし"}</div>
                                <div>決済有効化: {user.charges_enabled ? "有効 (Yes)" : "無効 (No)"}</div>
                                <div>学籍番号: {user.student_id || "非開示"}</div>
                                <div>Email: {user.university_email || "非開示"}</div>
                                <div>保有コイン: ¥{user.coin_balance?.toLocaleString()}</div>
                                <div className="text-red-500">ロック中コイン: ¥{user.locked_balance?.toLocaleString()}</div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {hasMore && (
                <div className="mt-6 text-center">
                    <Button
                        onClick={() => fetchUsers(true)}
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
