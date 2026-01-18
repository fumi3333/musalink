"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getMyItems, getMyTransactions, getItem, getUser } from '@/services/firestore';
import { Item, Transaction, User } from '@/types';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Star, Package, ShoppingBag, Clock, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

// --- Sub Component: Listing Item ---
const ListingItemCard = ({ item }: { item: Item }) => {
    return (
        <Link href={`/items/${item.id}`} className="block">
            <div className="flex items-center gap-4 p-4 border-b border-slate-100 bg-white hover:bg-slate-50 transition-colors cursor-pointer group">
                <div className="w-16 h-16 bg-slate-200 rounded overflow-hidden flex-shrink-0 relative">
                    {item.image_urls?.[0] ? (
                        <img src={item.image_urls[0]} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                        <div className="flex items-center justify-center h-full text-slate-400">
                            <Package className="h-6 w-6" />
                        </div>
                    )}
                    {item.status === 'sold' && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <span className="text-white text-xs font-bold px-1 py-0.5 bg-red-600 rounded">SOLD</span>
                        </div>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-slate-800 truncate group-hover:text-violet-600 transition-colors">{item.title}</h4>
                    <div className="flex items-center gap-2 text-xs mt-1">
                        <Badge variant="outline" className={`
                            ${item.status === 'listing' ? 'bg-blue-50 text-blue-700 border-blue-200' : ''}
                            ${item.status === 'matching' ? 'bg-amber-50 text-amber-700 border-amber-200' : ''}
                            ${item.status === 'sold' ? 'bg-slate-100 text-slate-500 border-slate-200' : ''}
                        `}>
                            {item.status === 'listing' && '出品中'}
                            {item.status === 'matching' && '取引中'}
                            {item.status === 'sold' && '売却済'}
                        </Badge>
                        <span className="text-slate-500">¥{item.price.toLocaleString()}</span>
                    </div>
                </div>
                {/* Replaced confusing ExternalLink with simple arrow */}
                <div className="text-slate-300 group-hover:text-violet-500">
                    <ChevronRight className="h-5 w-5" />
                </div>
            </div>
        </Link>
    );
};

// --- Sub Component: Transaction Item ---
const TransactionItemCard = ({ transaction, currentUserId }: { transaction: Transaction, currentUserId: string }) => {
    const [itemTitle, setItemTitle] = useState("Loading...");
    const isBuyer = transaction.buyer_id === currentUserId;

    useEffect(() => {
        // Fetch snapshot title if possible, or live item
        getItem(transaction.item_id).then(i => {
            if (i) setItemTitle(i.title);
            else setItemTitle("Unknown Item");
        });
    }, [transaction.item_id]);

    const statusLabel = {
        'request_sent': '承認待ち',
        'approved': '支払い待ち',
        'payment_pending': '受渡待ち',
        'completed': '取引完了',
        'cancelled': 'キャンセル'
    }[transaction.status] || transaction.status;

    return (
        <Link href={`/transactions/detail?id=${transaction.id}`}>
            <div className="block p-4 border-b border-slate-100 bg-white hover:bg-slate-50 transition-colors cursor-pointer">
                <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                        <Badge variant={isBuyer ? 'default' : 'secondary'} className="text-[10px]">
                            {isBuyer ? '購入' : '販売'}
                        </Badge>
                        <span className="text-xs text-slate-400">
                            {/* Date formatting mock */}
                            {new Date().toLocaleDateString()}
                        </span>
                    </div>
                    <Badge variant="outline" className={`
                        text-xs
                        ${transaction.status === 'completed' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}
                    `}>
                        {statusLabel}
                    </Badge>
                </div>
                <h4 className="font-bold text-slate-800 mb-1">{itemTitle}</h4>
                <p className="text-xs text-slate-500 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    最終更新: {transaction.updatedAt ? "直近" : "---"}
                </p>
            </div>
        </Link>
    );
};


export default function MyPage() {
    const { userData, loading: authLoading } = useAuth();
    const router = useRouter();

    const [myItems, setMyItems] = useState<Item[]>([]);
    const [myTransactions, setMyTransactions] = useState<Transaction[]>([]);
    const [loadingData, setLoadingData] = useState(true);

    useEffect(() => {
        if (!authLoading && !userData) {
            router.push('/'); // Redirect if not logged in
            return;
        }

        if (userData?.id) {
            const load = async () => {
                const [items, txs] = await Promise.all([
                    getMyItems(userData.id),
                    getMyTransactions(userData.id)
                ]);
                setMyItems(items);
                setMyTransactions(txs);
                setLoadingData(false);
            };
            load();
        }
    }, [userData, authLoading, router]);

    if (authLoading || (!userData && loadingData)) return <div className="min-h-screen pt-20 text-center">Loading...</div>;

    const activeListings = myItems.filter(i => i.status === 'listing');
    const soldListings = myItems.filter(i => i.status !== 'listing');

    // Sort transactions: Active vs Completed
    const activeTx = myTransactions.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
    const pastTx = myTransactions.filter(t => t.status === 'completed' || t.status === 'cancelled');

    // --- Edit Profile Logic ---
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editForm, setEditForm] = useState({
        display_name: "",
        interests: [] as string[]
    });

    const openEdit = () => {
        if (!userData) return;
        setEditForm({
            display_name: userData.display_name || "",
            interests: userData.interests || []
        });
        setIsEditOpen(true);
    };

    const handleUpdateProfile = async () => {
        if (!userData) return;
        const { toast } = require('sonner');
        const { updateUser } = await import('@/services/firestore');

        try {
            await updateUser(userData.id, editForm);
            toast.success("プロフィールを更新しました");
            setIsEditOpen(false);
            // Ideally re-fetch or update local context. AuthContext might need a mechanism or just reload.
            // For MVP, reload is safest to sync AuthContext
            window.location.reload();
        } catch (e) {
            toast.error("更新に失敗しました");
        }
    };

    // Lazy Load Interest Selector to avoid huge bundle potentially? (Not really needed but good practice)
    const { InterestSelector } = require('@/components/profile/InterestSelector');
    const { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } = require('@/components/ui/dialog');
    const { Input } = require('@/components/ui/input');
    const { Label } = require('@/components/ui/label');

    return (
        <div className="min-h-screen bg-slate-100 pb-20">
            {/* --- Profile Header --- */}
            <div className="bg-white p-6 shadow-sm mb-4 relative">
                <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
                    onClick={openEdit}
                >
                    編集
                </Button>

                <div className="max-w-md mx-auto flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center text-2xl overflow-hidden border-2 border-slate-100">
                        {userData?.photoURL ? (
                            <img src={userData.photoURL} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <span>{userData?.display_name?.[0] || "U"}</span>
                        )}
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-slate-900">{userData?.display_name || "ゲスト"}</h1>
                        <div className="flex items-center gap-1 text-amber-400 text-sm">
                            <Star className="h-4 w-4 fill-current" />
                            <span className="font-bold text-slate-700">5.0</span>
                            <span className="text-slate-400 text-xs ml-1">(Mock Rating)</span>
                        </div>

                        {/* Tags Display */}
                        <div className="flex flex-wrap gap-1 mt-2">
                            {userData?.is_verified && (
                                <Badge variant="secondary" className="bg-blue-50 text-blue-700 text-[10px]">
                                    学内認証済
                                </Badge>
                            )}
                            {userData?.interests?.map((tag: string) => (
                                <Badge key={tag} variant="outline" className="text-[10px] text-slate-500 bg-slate-50">
                                    {tag}
                                </Badge>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* --- Edit Modal --- */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>プロフィール編集</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>ニックネーム (表示名)</Label>
                            <Input
                                value={editForm.display_name}
                                onChange={(e: any) => setEditForm({ ...editForm, display_name: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <InterestSelector
                                selected={editForm.interests}
                                onChange={(tags: string[]) => setEditForm({ ...editForm, interests: tags })}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditOpen(false)}>キャンセル</Button>
                        <Button onClick={handleUpdateProfile}>保存する</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* --- Main Content --- */}
            <div className="max-w-md mx-auto px-4">

                <Tabs defaultValue={new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('tab') || "selling"} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 bg-white p-1 rounded-xl shadow-sm mb-4">
                        <TabsTrigger value="selling" className="font-bold">出品した商品</TabsTrigger>
                        <TabsTrigger value="purchase" className="font-bold">取引 / 購入</TabsTrigger>
                    </TabsList>

                    {/* --- Selling Tab --- */}
                    <TabsContent value="selling" className="space-y-4">
                        <Card className="border-none shadow-none bg-transparent">
                            <CardContent className="p-0 space-y-4">
                                {/* Create New Button */}
                                <Link href="/items/create">
                                    <Button className="w-full bg-red-500 hover:bg-red-600 font-bold shadow-md text-white mb-4 py-6">
                                        <Package className="mr-2 h-5 w-5" />
                                        出品する
                                    </Button>
                                </Link>

                                <div className="bg-slate-50 rounded-lg overflow-hidden">
                                    <h3 className="px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">出品中 ({activeListings.length})</h3>
                                    <div className="divide-y divide-slate-100 rounded-lg overflow-hidden border border-slate-200">
                                        {activeListings.length > 0 ? (
                                            activeListings.map(item => <ListingItemCard key={item.id} item={item} />)
                                        ) : (
                                            <div className="p-8 text-center text-slate-400 bg-white">出品中の商品はありません</div>
                                        )}
                                    </div>
                                </div>

                                <div className="bg-slate-50 rounded-lg overflow-hidden">
                                    <h3 className="px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">売却済み / 取引中 ({soldListings.length})</h3>
                                    <div className="divide-y divide-slate-100 rounded-lg overflow-hidden border border-slate-200">
                                        {soldListings.length > 0 ? (
                                            soldListings.map(item => <ListingItemCard key={item.id} item={item} />)
                                        ) : (
                                            <div className="p-8 text-center text-slate-400 bg-white">履歴はありません</div>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* --- Purchase / Transaction Tab --- */}
                    <TabsContent value="purchase" className="space-y-4">
                        <div className="bg-slate-50 rounded-lg overflow-hidden">
                            <h3 className="px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">進行中の取引 ({activeTx.length})</h3>
                            <div className="divide-y divide-slate-100 rounded-lg overflow-hidden border border-slate-200">
                                {activeTx.length > 0 ? (
                                    activeTx.map(tx => <TransactionItemCard key={tx.id} transaction={tx} currentUserId={userData?.id} />)
                                ) : (
                                    <div className="p-8 text-center text-slate-400 bg-white">進行中の取引はありません</div>
                                )}
                            </div>
                        </div>

                        <div className="bg-slate-50 rounded-lg overflow-hidden">
                            <h3 className="px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">過去の取引 ({pastTx.length})</h3>
                            <div className="divide-y divide-slate-100 rounded-lg overflow-hidden border border-slate-200">
                                {pastTx.length > 0 ? (
                                    pastTx.map(tx => <TransactionItemCard key={tx.id} transaction={tx} currentUserId={userData?.id} />)
                                ) : (
                                    <div className="p-8 text-center text-slate-400 bg-white">過去の取引はありません</div>
                                )}
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
