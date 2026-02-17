"use client"

import React, { use, useEffect, useState } from 'react';
import { Item, User } from '@/types';
import { getItem, getUser } from '@/services/firestore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { ArrowLeft, MessageCircle, Share2, ShieldCheck, Star, User as UserIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getItemCategoryLabel } from '@/lib/constants';

export default function ItemDetail({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [item, setItem] = useState<Item | null>(null);
    const [seller, setSeller] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const loadData = async () => {
            try {
                const itemData = await getItem(id);
                if (itemData) {
                    setItem(itemData);
                    try {
                        const sellerData = await getUser(itemData.seller_id);
                        if (sellerData) setSeller(sellerData);
                    } catch (e) {
                         console.error("Seller load error", e);
                    }
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [id]);

    if (loading) return <div className="min-h-screen flex items-center justify-center">読み込み中...</div>;
    if (!item) return <div className="min-h-screen flex items-center justify-center">商品が見つかりません</div>;

    return (
        <div className="min-h-screen bg-slate-50 py-8 px-4">
            <div className="max-w-4xl mx-auto">
                <Button variant="ghost" className="mb-4 pl-0 hover:bg-transparent" onClick={() => router.back()}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> 戻る
                </Button>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Left: Image */}
                    <div className="space-y-4">
                         <div className="aspect-[3/4] bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center justify-center relative overflow-hidden group">
                             {item.image_urls && item.image_urls.length > 0 ? (
                                 <img src={item.image_urls[0]} alt={item.title} className="w-full h-full object-cover" />
                             ) : (
                                 <div className="text-slate-300 flex flex-col items-center">
                                     <span className="text-4xl mb-2">📚</span>
                                     <span className="text-sm">No Image</span>
                                 </div>
                             )}
                             
                             {item.status === 'sold' && (
                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                    <span className="text-white font-bold text-2xl tracking-widest border-2 border-white px-6 py-2 transform -rotate-12">
                                        SOLD OUT
                                    </span>
                                </div>
                             )}
                         </div>
                    </div>

                    {/* Right: Info */}
                    <div className="space-y-6">
                        <div>
                            <div className="flex flex-wrap gap-2 mb-3">
                                <Badge variant="secondary" className="bg-violet-100 text-violet-700 hover:bg-violet-200">
                                    {getItemCategoryLabel(item.category)}
                                </Badge>
                                {item.metadata?.seller_department && (
                                    <Badge variant="outline" className="text-slate-500">
                                        {item.metadata.seller_department}
                                    </Badge>
                                )}
                                {item.metadata?.seller_grade && (
                                    <Badge variant="outline" className="text-slate-500">
                                        {item.metadata.seller_grade}
                                    </Badge>
                                )}
                            </div>
                            
                            <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-2 leading-tight">
                                {item.title}
                            </h1>
                            {item.author && (
                                <p className="text-slate-500 text-sm mb-4">
                                    著者: {item.author}
                                </p>
                            )}

                            <div className="flex items-center gap-4 mb-6">
                                <span className="text-3xl font-bold text-slate-900">
                                    ¥{(item.price ?? 0).toLocaleString()}
                                </span>
                                <div className="flex items-center text-sm text-slate-500">
                                    <span className={`w-3 h-3 rounded-full mr-2 ${item.condition >= 4 ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                                    状態: {item.condition >= 4 ? '良い' : '普通'}
                                </div>
                            </div>

                            <Card className="bg-white border-slate-200 shadow-sm mb-6">
                                <CardContent className="p-4 text-sm text-slate-600 leading-relaxed">
                                    {item.description || "説明文はありません。"}
                                </CardContent>
                            </Card>

                            {/* Seller Info */}
                            {seller && (
                                <div className="flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-100 mb-8">
                                    <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                                        <UserIcon className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-700">{seller.display_name || "匿名ユーザー"}</p>
                                        <div className="flex items-center text-xs text-slate-500">
                                            <Star className="w-3 h-3 text-yellow-400 fill-current mr-1" />
                                            <span>{seller.trust_score ?? 4.5}</span>
                                            <span className="mx-1">•</span>
                                            <span>取引 {seller.ratings?.count || 0}件</span>
                                        </div>
                                    </div>
                                    {seller.is_verified && (
                                         <Badge variant="outline" className="ml-auto border-green-200 text-green-700 bg-green-50 text-[10px]">
                                             <ShieldCheck className="w-3 h-3 mr-1" />
                                             本人確認済
                                         </Badge>
                                    )}
                                    {/* Campus Badge */}
                                    {seller.campus && (
                                        <Badge variant="outline" className={`ml-2 text-[10px] ${
                                            seller.campus === 'musashino' ? 'border-orange-200 text-orange-700 bg-orange-50' :
                                            seller.campus === 'ariake' ? 'border-blue-200 text-blue-700 bg-blue-50' :
                                            'border-purple-200 text-purple-700 bg-purple-50'
                                        }`}>
                                            {seller.campus === 'musashino' ? '武蔵野' : seller.campus === 'ariake' ? '有明' : '両キャンパス'}
                                        </Badge>
                                    )}
                                </div>
                            )}

                            {/* Actions */}
                            <div className="space-y-3">
                                {item.status === 'listing' ? (
                                    <Link href={`/transactions/new?itemId=${item.id}`} className="block w-full">
                                        <Button className="w-full h-12 text-lg font-bold bg-[#635BFF] hover:bg-[#544DC8] shadow-lg shadow-indigo-200">
                                            購入リクエストを送る
                                        </Button>
                                    </Link>
                                ) : (
                                    <Button disabled className="w-full h-12 text-lg font-bold">
                                        売り切れ / 取引中
                                    </Button>
                                )}
                                
                                <div className="flex gap-2">
                                    <Button variant="outline" className="flex-1">
                                        <MessageCircle className="w-4 h-4 mr-2" />
                                        コメント (0)
                                    </Button>
                                    <Button variant="outline" className="flex-1">
                                        <Share2 className="w-4 h-4 mr-2" />
                                        シェア
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
