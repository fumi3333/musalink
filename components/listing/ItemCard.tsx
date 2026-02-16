import React from 'react';
import { Item } from '@/types';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, BookOpen, Clock, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { getItemCategoryLabel } from '@/lib/constants';

interface ItemCardProps {
    item: Item;
}

// 状態（Condition）のテキスト変換
const getConditionLabel = (condition: number) => {
    switch (condition) {
        case 5: return { label: '新品同様', color: 'bg-green-100 text-green-800' };
        case 4: return { label: '美品', color: 'bg-blue-100 text-blue-800' };
        case 3: return { label: '普通', color: 'bg-slate-100 text-slate-800' };
        case 2: return { label: '傷あり', color: 'bg-yellow-100 text-yellow-800' };
        case 1: return { label: '悪い', color: 'bg-red-100 text-red-800' };
        default: return { label: '不明', color: 'bg-gray-100 text-gray-800' };
    }
};

export const ItemCard: React.FC<ItemCardProps> = ({ item }) => {
    const { label, color } = getConditionLabel(item.condition);

    // Visual Condition Bar Logic
    const getConditionBar = (condition: number) => {
        const percentage = condition * 20; // 5 -> 100%, 1 -> 20%
        let colorClass = 'bg-slate-300';
        if (condition >= 5) colorClass = 'bg-green-500';
        else if (condition >= 4) colorClass = 'bg-blue-500';
        else if (condition >= 3) colorClass = 'bg-yellow-500';
        else if (condition >= 2) colorClass = 'bg-orange-500';
        else colorClass = 'bg-red-500';

        return (
            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
                <div className={`h-full ${colorClass}`} style={{ width: `${percentage}%` }} />
            </div>
        );
    };

    return (
        <Card className="group overflow-hidden flex flex-col h-full bg-white border-slate-200 hover:border-violet-200 hover:shadow-lg transition-all duration-300">
            {/* Image / Placeholder */}
            <div className="h-40 bg-slate-50 relative flex items-center justify-center overflow-hidden">
                {/* Gradient Overlay for Premium Feel */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-10" />

                {item.image_urls && item.image_urls.length > 0 ? (
                    <img src={item.image_urls[0]} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                    <BookOpen className="h-12 w-12 text-slate-300 group-hover:scale-110 transition-transform duration-500" />
                )}

                {/* Tags: カテゴリー + 学部（任意） */}
                <div className="absolute top-2 left-2 flex flex-col gap-1">
                    <Badge variant="secondary" className="bg-white/90 backdrop-blur-sm text-slate-700 shadow-sm text-[10px] border-none font-bold">
                        {getItemCategoryLabel(item.category)}
                    </Badge>
                    {item.metadata?.seller_department && (
                        <Badge variant="secondary" className="bg-white/80 backdrop-blur-sm text-slate-600 shadow-sm text-[10px] border-none">
                            {item.metadata.seller_department}
                        </Badge>
                    )}
                </div>

                {/* Status Badge */}
                {item.status !== 'listing' && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-[2px]">
                        <span className="bg-white text-black px-3 py-1 font-bold tracking-widest text-sm uppercase shadow-lg transform -rotate-6">
                            {item.status === 'sold' ? 'SOLD OUT' : 'RESERVED'}
                        </span>
                    </div>
                )}
            </div>

            <CardHeader className="p-4 pb-2 space-y-2">
                <div className="flex justify-between items-start gap-2">
                    <h3 className="font-bold text-base text-slate-800 line-clamp-2 leading-snug group-hover:text-violet-700 transition-colors">
                        {item.title}
                    </h3>
                </div>

                {/* Seller Rating - 5 Star Display */}
                <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                    <div className="flex text-yellow-400">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                                key={star}
                                className={`h-3 w-3 ${star <= (item.metadata?.seller_trust_score || 4.5) ? "fill-current" : "text-slate-200"}`}
                            />
                        ))}
                    </div>
                    <span className="font-bold text-slate-700 ml-1">{item.metadata?.seller_trust_score || 4.5}</span>
                    <span className="text-slate-400">({item.metadata?.rating_count || 12})</span>
                </div>

                <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-slate-900">
                        ¥{item.price.toLocaleString()}
                    </span>
                    {/* Visual Condition */}
                    <div className="flex flex-col items-end gap-0.5">
                        <span className={`text-[10px] font-bold ${color}`}>
                            {label}
                        </span>
                        {getConditionBar(item.condition)}
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-4 pt-0 flex-grow">
                <div className="flex items-center gap-2 mb-2">
                    {item.metadata?.seller_verified && (
                        <Badge variant="outline" className="border-green-200 text-green-700 bg-green-50 text-[10px] px-1.5 py-0 h-5 gap-0.5">
                            <CheckCircle className="h-3 w-3" />
                            <span>学内認証済</span>
                        </Badge>
                    )}
                </div>
                <p className="text-xs text-slate-500 line-clamp-2">
                    {item.description || "詳細なし"}
                </p>
            </CardContent>

            <CardFooter className="p-4 pt-0">
                <Link href={`/items/${item.id}`} className="w-full">
                    <Button variant="outline" size="sm" className="w-full border-slate-200 text-slate-600 group-hover:bg-violet-50 group-hover:text-violet-700 group-hover:border-violet-200 transition-all font-bold">
                        詳細を見る
                    </Button>
                </Link>
            </CardFooter>
        </Card>
    );
};
