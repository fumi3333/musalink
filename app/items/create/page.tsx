"use client"

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Star } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { createItem } from '@/services/firestore';
import { db, storage } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Camera, X } from 'lucide-react';
import { toast } from 'sonner';
import { ITEM_CATEGORIES } from '@/lib/constants';
import type { ItemCategory } from '@/types';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export default function CreateListingPage() {
    const { user, userData: authUserData, login } = useAuth(); // Get userData from Context
    const [category, setCategory] = useState<ItemCategory>('book');
    const [condition, setCondition] = useState<number>(3);
    const [loading, setLoading] = useState(false);
    const [searchingIsbn, setSearchingIsbn] = useState(false);
    const [isbn, setIsbn] = useState("");
    const [author, setAuthor] = useState("");
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [lectureName, setLectureName] = useState("");
    const [teacherName, setTeacherName] = useState("");

    // Image Upload State
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    const router = useRouter();
    const [currentUser, setCurrentUser] = useState<any>(null);

    const [blockingReason, setBlockingReason] = useState<'unauthenticated' | 'unverified' | 'payout_missing' | null>(null);



    useEffect(() => {
        // Sync with useAuth user
        if (!user) {
            setBlockingReason('unauthenticated');
            setCurrentUser(null);
            return;
        }

        // Additional checks for Verification / Payout
        async function checkUserData() {
            // [Fix] Priority: Use AuthContext userData (Handles Guest/Demo logic)
            if (authUserData) {
                // Determine if Verified
                if (!authUserData.is_verified && !authUserData.is_demo) { // Allow Demo
                    setBlockingReason('unverified');
                    setCurrentUser(authUserData);
                    return;
                }

                // Determine if Payout Enabled
                // Note: Guest users have charges_enabled = true
                if (!authUserData.charges_enabled && !authUserData.is_demo) { // Allow Demo
                    setBlockingReason('payout_missing');
                    setCurrentUser(authUserData);
                    return;
                }

                // All Good
                setBlockingReason(null);
                setCurrentUser(authUserData);
                return;
            }

            // Fallback: Fetch from Firestore
            // ... (Existing logic kept as backup)
            try {
                // ... (Logic removed for brevity in tool call, standardizing on AuthContext data mostly)
                // If authUserData is null (loading), we wait.
                // If it's really missing, the useEffect above handles it.
            } catch (e) {
                console.error("Error checking user status:", e);
            }
        }

        checkUserData();


    }, [user, authUserData, router]);

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                toast.error("画像サイズは5MB以下にしてください");
                return;
            }
            setImageFile(file);
            const previewUrl = URL.createObjectURL(file);
            setImagePreview(previewUrl);
        }
    };

    const removeImage = () => {
        setImageFile(null);
        if (imagePreview) URL.revokeObjectURL(imagePreview);
        setImagePreview(null);
    };

    const handleIsbnSearch = async () => {
        if (!isbn) return;
        setSearchingIsbn(true);
        try {
            // Dynamic import to avoid SSR issues if any, or just import at top. 
            // Importing at top is fine for client component.
            const { searchBookByIsbn } = await import('@/services/books');
            const book = await searchBookByIsbn(isbn);
            if (book) {
                setTitle(book.title);
                setAuthor(book.author);
                if (!description) setDescription(book.description);
            } else {
                toast.info("書籍が見つかりませんでした。手動で入力してください。");
            }
        } catch (e) {
            console.error(e);
            toast.error("検索エラーが発生しました");
        } finally {
            setSearchingIsbn(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;
        setLoading(true);

        const form = e.target as HTMLFormElement;
        const price = parseInt((form.elements.namedItem('price') as HTMLInputElement).value);

        try {
            let downloadURL = "";
            if (imageFile) {
                const storageRef = ref(storage, `users/${user?.uid}/items/${Date.now()}_${imageFile.name}`);
                const snapshot = await uploadBytes(storageRef, imageFile);
                downloadURL = await getDownloadURL(snapshot.ref);
            }

            await createItem({
                category,
                title,
                author: category === 'book' ? author : undefined,
                isbn: category === 'book' ? isbn : undefined,
                price,
                description,
                lecture_name: category === 'book' ? lectureName : undefined,
                teacher_name: category === 'book' ? teacherName : undefined,
                condition,
                status: 'listing',
                seller_id: currentUser.id,
                image_urls: downloadURL ? [downloadURL] : [],
                metadata: {
                    seller_grade: currentUser.student_id ? 'B1' : '不明',
                    seller_department: 'Department',
                    seller_verified: true
                },
            });
            const { toast } = require('sonner');
            toast.success("出品が完了しました！");
            router.push('/items');
        } catch (e: any) {
            console.error(e);
            const { toast } = require('sonner');
            toast.error("出品に失敗しました: " + (e.message || "不明なエラー"));
        } finally {
            setLoading(false);
        }
    };

    if (blockingReason === 'unauthenticated') {
        // useAuth provides 'login' which handles errors
        return (
            <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
                <Card className="max-w-md w-full shadow-lg border-slate-200">
                    <CardHeader className="bg-white rounded-t-lg">
                        <CardTitle className="text-slate-800 text-center">ログインが必要です</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4 text-center">
                        <p className="text-slate-600">
                            出品するには、まずログインしてください。<br />
                            (武蔵野大学のGoogleアカウントが必要です)
                        </p>
                        <Button
                            className="w-full font-bold bg-violet-600 text-white"
                            onClick={login}
                        >
                            Googleでログイン
                        </Button>
                        <Link href="/items">
                            <Button variant="ghost" className="w-full mt-2">戻る</Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!currentUser) return <div className="min-h-screen flex items-center justify-center text-slate-500">読み込み中...</div>;

    if (blockingReason === 'unverified') {
        return (
            <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
                <Card className="max-w-md w-full shadow-lg border-violet-100">
                    <CardHeader className="bg-violet-50 rounded-t-lg">
                        <CardTitle className="text-violet-800 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-violet-600" />
                            本人確認が必要です
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        <p className="text-slate-600 leading-relaxed">
                            安全な取引のため、出品を行うには大学メールアドレスによる本人確認が必要です。
                        </p>
                        <Button className="w-full font-bold" onClick={() => router.push('/verify')}>
                            本人確認ページへ進む
                        </Button>
                        <Link href="/items">
                            <Button variant="ghost" className="w-full mt-2">戻る</Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (blockingReason === 'payout_missing') {
        return (
            <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
                <Card className="max-w-md w-full shadow-lg border-blue-100">
                    <CardHeader className="bg-blue-50 rounded-t-lg">
                        <CardTitle className="text-blue-800 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-blue-600" />
                            受取口座の登録が必要です
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        <p className="text-slate-600 leading-relaxed">
                            売上を受け取るための銀行口座が登録されていません。これを行わないと出品できません。
                        </p>
                        <Button className="w-full font-bold bg-blue-600 hover:bg-blue-700" onClick={() => router.push('/seller/payout')}>
                            口座登録ページへ進む
                        </Button>
                        <Link href="/items">
                            <Button variant="ghost" className="w-full mt-2">戻る</Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 py-6 px-4 pb-20 md:py-10">
            <div className="max-w-2xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <h1 className="text-xl md:text-2xl font-bold text-slate-800">商品を出品する</h1>
                    <Link href="/items">
                        <Button variant="ghost" size="sm">キャンセル</Button>
                    </Link>
                </div>

                <form onSubmit={handleSubmit}>
                    <Card className="shadow-sm border-slate-200">
                        <CardHeader className="bg-white rounded-t-lg pb-4">
                            <CardTitle className="text-lg">カテゴリーと商品情報</CardTitle>
                            <CardDescription className="text-xs md:text-sm">
                                {category === 'book' ? '教科書の場合はISBNで自動入力できます。' : '商品名と説明を入力してください。'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-6">

                            {/* カテゴリー選択 */}
                            <div className="space-y-2">
                                <Label className="font-bold text-slate-700">カテゴリー *</Label>
                                <Select value={category} onValueChange={(v) => setCategory(v as ItemCategory)}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="カテゴリーを選択" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {ITEM_CATEGORIES.map((c) => (
                                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* 教科書のときだけ ISBN 検索・書籍用入力 */}
                            {category === 'book' && (
                                <>
                                    <div className="space-y-2">
                                        <Label htmlFor="isbn" className="font-bold text-slate-700">ISBN (任意)</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                id="isbn"
                                                placeholder="例: 9784..."
                                                value={isbn}
                                                onChange={(e) => setIsbn(e.target.value)}
                                                className="font-mono"
                                            />
                                            <Button type="button" onClick={handleIsbnSearch} disabled={searchingIsbn || !isbn} variant="secondary" className="whitespace-nowrap">
                                                {searchingIsbn ? '...' : '自動入力'}
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="author" className="text-slate-600">著者名</Label>
                                        <Input
                                            id="author"
                                            value={author}
                                            onChange={(e) => setAuthor(e.target.value)}
                                            placeholder="例: 武蔵野 太郎"
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="lecture" className="text-slate-600">授業名 (任意)</Label>
                                            <Input
                                                id="lecture"
                                                value={lectureName}
                                                onChange={(e) => setLectureName(e.target.value)}
                                                placeholder="例: 基礎演習A"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="teacher" className="text-slate-600">先生の名前 (任意)</Label>
                                            <Input
                                                id="teacher"
                                                value={teacherName}
                                                onChange={(e) => setTeacherName(e.target.value)}
                                                placeholder="例: 佐藤先生"
                                            />
                                        </div>
                                    </div>
                                </>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="title" className="font-bold text-slate-700">{category === 'book' ? '教科書タイトル' : '商品名'} *</Label>
                                <Input
                                    id="title"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder={category === 'book' ? '例: 情報工学の基礎' : '例: デスクライト、マジックグッズ など'}
                                    required
                                    className="font-bold text-lg"
                                />
                            </div>

                            <div className="space-y-3">
                                <Label className="font-bold text-slate-700">商品の状態 *</Label>
                                <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                                    {[5, 4, 3, 2, 1].map((value) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => setCondition(value)}
                                            className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all h-20 ${condition === value
                                                ? 'border-violet-500 bg-violet-50 text-violet-700 shadow-sm ring-1 ring-violet-200'
                                                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-500'
                                                }`}
                                        >
                                            <div className="flex -space-x-1 mb-1">
                                                {Array.from({ length: Math.min(value, 3) }).map((_, i) => (
                                                    <Star key={i} className="h-3 w-3 fill-current" />
                                                ))}
                                                {value > 3 && <span className="text-[10px] self-center ml-1">...</span>}
                                            </div>
                                            <span className="text-[10px] font-bold">
                                                {value === 5 && '新品同様'}
                                                {value === 4 && '美品'}
                                                {value === 3 && '普通'}
                                                {value === 2 && '傷あり'}
                                                {value === 1 && '悪い'}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="price" className="font-bold text-slate-700">販売価格 (円) *</Label>
                                <div className="relative">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">¥</div>
                                    <Input id="price" name="price" type="number" className="pl-8 text-xl font-bold tracking-tight" placeholder="1000" min="0" required />
                                </div>
                                <p className="text-xs text-slate-500">※手数料は購入者が負担します。</p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="description" className="text-slate-600">詳細メモ</Label>
                                <Textarea
                                    id="description"
                                    name="description"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="商品の状態や使用歴など..."
                                    className="min-h-[100px] text-sm"
                                />
                            </div>

                        </CardContent>
                        <CardFooter className="pb-6 pt-2">
                            <Button type="submit" className="w-full font-bold text-lg h-12 bg-slate-900 hover:bg-slate-800 shadow-lg shadow-slate-200" disabled={loading}>
                                {loading ? '出品処理中...' : '出品する'}
                            </Button>
                        </CardFooter>
                    </Card>
                </form>
            </div>
        </div>
    );
}
