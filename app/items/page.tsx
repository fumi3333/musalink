"use client"

import React, { useEffect, useState } from 'react';
import { Item } from '@/types';
import { ItemCard } from '@/components/listing/ItemCard';
import { Button } from '@/components/ui/button';
import { Plus, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { getItems } from '@/services/firestore';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

export default function ItemListView() {
    const [items, setItems] = useState<Item[]>([]);
    const [loading, setLoading] = useState(true);

    const [department, setDepartment] = useState("all");
    const [grade, setGrade] = useState("all");

    const fetchItems = async () => {
        setLoading(true);
        try {
            const data = await getItems({ department, grade });
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
    }, [department, grade]);

    return (
        <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6">
            <div className="max-w-6xl mx-auto space-y-6">

                {/* Header Area */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">出品一覧</h1>
                        <p className="text-slate-500 text-sm">現在販売中の教科書: {loading ? '...' : items.length}件</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="icon" onClick={fetchItems} disabled={loading}>
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        </Button>
                        <Link href="/items/create">
                            <Button className="font-bold shadow-md bg-slate-900 text-white hover:bg-slate-800">
                                <Plus className="mr-2 h-4 w-4" /> 教科書を出品
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* Item Grid */}
                {loading ? (
                    <div className="text-center py-20 text-slate-400">読み込み中...</div>
                ) : items.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-lg border-2 border-dashed border-slate-200">
                        <p className="text-slate-500 mb-4">まだ出品された教科書はありません</p>
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
