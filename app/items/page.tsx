"use client"

import React, { useEffect, useState } from 'react';
import { Item } from '@/types';
import { ItemCard } from '@/components/listing/ItemCard';
import { Button } from '@/components/ui/button';
import { Plus, RefreshCw, Search } from 'lucide-react';
import Link from 'next/link';
import { getItems } from '@/services/firestore';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { ITEM_CATEGORIES } from '@/lib/constants';

export default function ItemListView() {
    const [items, setItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState(true);

    const [category, setCategory] = useState("all");
    const [department, setDepartment] = useState("all");
    const [grade, setGrade] = useState("all");
    const [keyword, setKeyword] = useState("");

    const fetchItems = async () => {
        setLoading(true);
        try {
            const data = await getItems({ category, department, grade, keyword });
            setItems(data);
        } catch (e) {
            console.error(e);
            alert("データの取得に失敗しました");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
    }, [category, department, grade]);

    const handleSearch = () => {
        fetchItems();
    };

    return (
        <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* Header Area */}
                <div className="flex flex-col gap-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">出品一覧</h1>
                            <p className="text-slate-500 text-sm">現在販売中の商品: {loading ? '...' : items.length}件</p>
                        </div>
                        <Link href="/items/create">
                            <Button className="font-bold shadow-md bg-slate-900 text-white hover:bg-slate-800">
                                <Plus className="mr-2 h-4 w-4" /> 商品を出品
                            </Button>
                        </Link>
                    </div>

                    {/* Search & Filter Bar */}
                    <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                        <div className="flex-1 flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                <Input
                                    placeholder="商品名、著者名で検索..."
                                    className="pl-9 bg-slate-50 border-slate-200"
                                    value={keyword}
                                    onChange={(e) => setKeyword(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                />
                            </div>
                            <Button onClick={handleSearch} disabled={loading}>
                                検索
                            </Button>
                        </div>
                        <div className="flex flex-wrap gap-2 shrink-0">
                            <Select value={category} onValueChange={setCategory}>
                                <SelectTrigger className="w-[140px]">
                                    <SelectValue placeholder="カテゴリー" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">全カテゴリー</SelectItem>
                                    {ITEM_CATEGORIES.map((c) => (
                                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={department} onValueChange={setDepartment}>
                                <SelectTrigger className="w-[140px]">
                                    <SelectValue placeholder="学部" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">全学部</SelectItem>
                                    <SelectItem value="Law">法学部</SelectItem>
                                    <SelectItem value="Economics">経済学部</SelectItem>
                                    <SelectItem value="Business">経営学部</SelectItem>
                                    <SelectItem value="Literature">文学部</SelectItem>
                                    <SelectItem value="Education">教育学部</SelectItem>
                                    <SelectItem value="Global">グローバル</SelectItem>
                                    <SelectItem value="DataScience">データサイエンス</SelectItem>
                                    <SelectItem value="Engineering">工学部</SelectItem>
                                </SelectContent>
                            </Select>

                            <Select value={grade} onValueChange={setGrade}>
                                <SelectTrigger className="w-[100px]">
                                    <SelectValue placeholder="学年" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">全学年</SelectItem>
                                    <SelectItem value="B1">1年</SelectItem>
                                    <SelectItem value="B2">2年</SelectItem>
                                    <SelectItem value="B3">3年</SelectItem>
                                    <SelectItem value="B4">4年</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                {/* Item Grid */}
                {loading ? (
                    <div className="text-center py-20 text-slate-400">読み込み中...</div>
                ) : items.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-lg border-2 border-dashed border-slate-200">
                        <p className="text-slate-500 mb-4">まだ出品された商品はありません</p>
                        <Link href="/items/create">
                            <Button>最初の出品者になる</Button>
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                        {items.map((item) => (
                            <div key={item.id} className="h-full">
                                <ItemCard item={item} />
                            </div>
                        ))}
                    </div>
                )}

            </div>
        </div>
    );
}
