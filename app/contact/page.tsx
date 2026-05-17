"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import Link from "next/link";

const CATEGORIES = [
    { value: "transaction_trouble", label: "取引トラブル" },
    { value: "inappropriate", label: "不正・不適切報告" },
    { value: "feature_request", label: "ご意見・ご要望" },
    { value: "other", label: "その他" },
];

export default function ContactPage() {
    const { user, userData, loading } = useAuth();
    const [category, setCategory] = useState("");
    const [message, setMessage] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);

    if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-400">読み込み中...</div>;

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
                <Card className="w-full max-w-md text-center">
                    <CardContent className="pt-8 pb-6 space-y-4">
                        <p className="text-slate-600">お問い合わせにはログインが必要です。</p>
                        <Button asChild><Link href="/login">ログイン</Link></Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (done) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
                <Card className="w-full max-w-md text-center">
                    <CardContent className="pt-8 pb-6 space-y-4">
                        <p className="text-4xl">✅</p>
                        <p className="font-bold text-lg">送信完了しました</p>
                        <p className="text-slate-500 text-sm">内容を確認し、必要に応じてご登録のメールアドレスへご連絡します。</p>
                        <Button variant="outline" asChild><Link href="/">トップへ戻る</Link></Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const handleSubmit = async () => {
        if (!category) { toast.error("カテゴリを選択してください"); return; }
        if (message.trim().length < 10) { toast.error("内容を10文字以上入力してください"); return; }

        setSubmitting(true);
        try {
            const fn = httpsCallable(functions, "sendContactEmail");
            await fn({ category, message: message.trim() });
            setDone(true);
        } catch (e: any) {
            toast.error(e?.message || "送信に失敗しました。時間をおいて再試行してください。");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 py-10 px-4 flex items-center justify-center">
            <Card className="w-full max-w-lg">
                <CardHeader>
                    <CardTitle>お問い合わせ</CardTitle>
                    <CardDescription>
                        送信元: {userData?.email || user.email}<br />
                        ※返信は登録のメールアドレス宛にお送りします。
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-700">カテゴリ</label>
                        <Select value={category} onValueChange={setCategory}>
                            <SelectTrigger>
                                <SelectValue placeholder="選択してください" />
                            </SelectTrigger>
                            <SelectContent>
                                {CATEGORIES.map(c => (
                                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-sm font-medium text-slate-700">内容</label>
                        <Textarea
                            placeholder="お問い合わせの詳細を入力してください（10文字以上）"
                            rows={6}
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            maxLength={2000}
                        />
                        <p className="text-xs text-slate-400 text-right">{message.length} / 2000</p>
                    </div>

                    <Button
                        className="w-full font-bold"
                        onClick={handleSubmit}
                        disabled={submitting}
                    >
                        {submitting ? "送信中..." : "送信する"}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
