"use client";

import React, { useState } from 'react';
import { Camera, Star, X } from 'lucide-react';
import { toast } from 'sonner';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ITEM_CATEGORIES } from '@/lib/constants';
import { storage } from '@/lib/firebase';
import { createItem } from '@/services/firestore';
import type { ItemCategory } from '@/types';

interface ItemFormProps {
    currentUser: {
        id: string;
        grade?: string;
        department?: string;
        departmentId?: string;
        is_verified?: boolean;
    };
    userUid: string;
    onSuccess: () => void;
}

// 出品フォーム本体。親側で blocking gate (auth/verify/payout) を通過した後に表示される。
export const ItemForm: React.FC<ItemFormProps> = ({ currentUser, userUid, onSuccess }) => {
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
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);

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
        setLoading(true);

        const form = e.target as HTMLFormElement;
        const rawPrice = parseInt((form.elements.namedItem('price') as HTMLInputElement).value, 10);

        if (isNaN(rawPrice) || rawPrice < 300) {
            toast.error("価格は300円以上で入力してください");
            setLoading(false);
            return;
        }
        if (rawPrice > 100000) {
            toast.error("価格は100,000円以下にしてください");
            setLoading(false);
            return;
        }

        try {
            let downloadURL = "";
            if (imageFile && userUid) {
                try {
                    const storageRef = ref(storage, `users/${userUid}/items/${Date.now()}_${imageFile.name}`);
                    const snapshot: any = await Promise.race([
                        uploadBytes(storageRef, imageFile),
                        new Promise((_, reject) => setTimeout(() => reject(new Error("Upload timeout")), 15000))
                    ]);
                    downloadURL = await getDownloadURL(snapshot.ref);
                } catch (imgError: any) {
                    console.error("Image upload error:", imgError);
                    toast.error("画像のアップロードに失敗しました。画像なしで出品しますか？", { duration: 4000 });
                    // Continue without image
                }
            }

            await createItem({
                category,
                title,
                author: category === 'book' ? author : undefined,
                isbn: category === 'book' ? isbn : undefined,
                price: rawPrice,
                description,
                lecture_name: category === 'book' ? lectureName : undefined,
                teacher_name: category === 'book' ? teacherName : undefined,
                condition,
                status: 'listing',
                seller_id: currentUser.id,
                image_urls: downloadURL ? [downloadURL] : [],
                metadata: {
                    seller_grade: currentUser.grade || '不明',
                    seller_department: currentUser.department || currentUser.departmentId || '不明',
                    seller_verified: !!currentUser.is_verified,
                },
            });
            toast.success("出品が完了しました！");
            onSuccess();
        } catch (e: any) {
            console.error(e);
            toast.error("出品に失敗しました: " + (e.message || "不明なエラー"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <Card className="shadow-sm border-slate-200">
                <CardHeader className="bg-white rounded-t-lg pb-4">
                    <CardTitle className="text-lg">カテゴリーと商品情報</CardTitle>
                    <CardDescription className="text-xs md:text-sm">
                        {category === 'book' ? '教科書の場合はISBNで自動入力できます。' : '商品名と説明を入力してください。'}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">

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
                            <Input
                                id="price"
                                name="price"
                                type="number"
                                className="pl-8 text-xl font-bold tracking-tight"
                                placeholder="1000"
                                min="300"
                                max="100000"
                                required
                                onWheel={(e) => e.currentTarget.blur()}
                            />
                        </div>
                        <p className="text-xs text-slate-500">
                            ※サービス手数料 10%（最低50円）が販売価格から差し引かれて入金されます。<br />
                            例：1,000円で出品 → 出品者の受取額は 900円。
                        </p>
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

                    <div className="space-y-2">
                        <Label className="font-bold text-slate-700">商品画像 (任意)</Label>
                        {imagePreview ? (
                            <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                                <img src={imagePreview} alt="プレビュー" className="w-full h-full object-cover" />
                                <button
                                    type="button"
                                    onClick={removeImage}
                                    className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1.5 hover:bg-black/80 transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <label
                                htmlFor="image-upload"
                                className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-violet-400 hover:bg-violet-50/50 transition-colors"
                            >
                                <Camera className="w-8 h-8 text-slate-400 mb-2" />
                                <span className="text-sm text-slate-500 font-medium">タップして画像を選択</span>
                                <span className="text-xs text-slate-400 mt-1">JPG, PNG (5MBまで)</span>
                                <input
                                    id="image-upload"
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    className="hidden"
                                    onChange={handleImageSelect}
                                />
                            </label>
                        )}
                    </div>

                </CardContent>
                <CardFooter className="pb-6 pt-2">
                    <Button type="submit" className="w-full font-bold text-lg h-12 bg-slate-900 hover:bg-slate-800 shadow-lg shadow-slate-200" disabled={loading}>
                        {loading ? '出品処理中...' : '出品する'}
                    </Button>
                </CardFooter>
            </Card>
        </form>
    );
};
