"use client";

import React, { useState } from 'react';
import { toast } from 'sonner';
import { Lock, Unlock, Copy, CheckCircle, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RevealableContent } from '../RevealableContent';
import type { Item, Transaction, User } from '@/types';

interface CompletedSectionProps {
    transaction: Transaction;
    item: Item;
    seller: User;
    isBuyer: boolean;
    isSeller: boolean;
}

// 「取引完了 (completed)」状態の UI — 連絡先開示・評価・問題報告・挨拶テンプレート。
export const CompletedSection: React.FC<CompletedSectionProps> = ({
    transaction,
    item,
    seller,
    isBuyer,
    isSeller,
}) => {
    const [copied, setCopied] = useState(false);
    const [showSellerInfo, setShowSellerInfo] = useState(false);

    const getGreetingMessage = (sellerName: string, itemName: string) => {
        const verifiedTag = seller.is_verified ? " [学内認証済]" : "";
        return `${sellerName}${verifiedTag} 先輩

本日、${itemName} をお譲りいただき、感謝いたします。
Musalinkで連絡先を確認しました。
受け渡し場所の相談などをさせていただきたく存じます。

学部・学科
氏名`;
    };

    const handleCopy = () => {
        const text = getGreetingMessage(seller.display_name, item.title);
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Card className="border-green-200 bg-green-50 shadow-md">
            <CardHeader className="border-b border-green-100 pb-4">
                <CardTitle className="flex items-center gap-2 text-green-800">
                    <Unlock className="h-6 w-6" /> 連絡先が開示されました
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">

                <div className="bg-green-100 border-l-4 border-green-500 p-4 rounded-r">
                    <div className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <h4 className="font-bold text-green-700">決済完了済み</h4>
                    </div>
                    <p className="text-sm text-green-800 mt-1">
                        Stripeにより決済が完了しています。現金での支払いは不要です。
                    </p>
                </div>

                <div className="space-y-4">
                    {!showSellerInfo ? (
                        <div className="bg-white p-4 rounded-lg border border-slate-200 text-center space-y-3">
                            <div className="text-slate-500 text-sm">
                                <p className="font-bold flex items-center justify-center gap-2">
                                    <Lock className="w-4 h-4" /> 出品者情報は非表示です
                                </p>
                                <p className="text-xs mt-1">通常、連絡先の交換は不要です。アプリ内で完結します。</p>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    if (confirm("【警告】\n出品者の個人情報（学生番号・メール）を表示します。\n\n通常、取引は受け渡し場所・時間の確認だけで完了します。\n相手と連絡が取れないなどの「トラブル時のみ」使用してください。\n\n表示しますか？")) {
                                        setShowSellerInfo(true);
                                    }
                                }}
                                className="text-xs text-slate-400 hover:text-red-500 hover:border-red-200"
                            >
                                トラブル等のため表示する
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <RevealableContent
                                title="出品者情報 (Seller Info)"
                                isUnlocked={true}
                                content={transaction.unlocked_assets || {}}
                            />
                            <Button
                                variant="ghost"
                                size="sm"
                                className="w-full text-xs text-slate-400"
                                onClick={() => setShowSellerInfo(false)}
                            >
                                情報を隠す（非表示）
                            </Button>
                        </div>
                    )}
                </div>

                <div className="pt-4 border-t border-green-200">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {((isBuyer && !transaction.buyer_rated) || (isSeller && !transaction.seller_rated)) ? (
                            <div className="col-span-full bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                                <p className="font-bold text-yellow-800 mb-2 text-center">取引相手を評価してください</p>
                                <div className="flex justify-center gap-2 mb-3">
                                    {[1, 2, 3, 4, 5].map(score => (
                                        <Button
                                            key={score}
                                            variant="outline"
                                            size="icon"
                                            className="w-10 h-10 rounded-full border-yellow-400 hover:bg-yellow-100 text-yellow-500 transition-all hover:scale-110"
                                            onClick={async () => {
                                                const { rateUser } = await import('@/services/firestore');

                                                let targetRole: 'buyer' | 'seller' = isBuyer ? 'buyer' : 'seller';
                                                if (isBuyer && isSeller) {
                                                    if (!transaction.buyer_rated) targetRole = 'buyer';
                                                    else if (!transaction.seller_rated) targetRole = 'seller';
                                                }

                                                const ratedUserId = targetRole === 'buyer' ? seller.id : transaction.buyer_id;

                                                try {
                                                    await rateUser(ratedUserId, transaction.id, targetRole, score);
                                                    toast.success("評価を送信しました！");
                                                    setTimeout(() => {
                                                        window.location.href = '/mypage';
                                                    }, 1000);
                                                } catch (e) {
                                                    toast.error("評価に失敗しました");
                                                }
                                            }}
                                        >
                                            <div className="flex flex-col items-center">
                                                <span className="font-bold text-lg leading-none">{score}</span>
                                            </div>
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="col-span-full text-center py-4 space-y-3">
                                <div className="text-slate-500 text-sm">
                                    <Badge variant="outline" className="bg-slate-100 mb-2">評価済み</Badge>
                                    <p>取引はすべて完了しました。お疲れ様でした！</p>
                                </div>
                                <Button
                                    onClick={() => window.location.href = '/mypage'}
                                    className="bg-slate-800 text-white hover:bg-slate-700 w-full md:w-auto md:px-8"
                                >
                                    取引を終了して戻る
                                </Button>
                            </div>
                        )}
                    </div>

                    <div className="mt-4">
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button
                                    variant="ghost"
                                    className="w-full text-red-600 hover:bg-red-50 hover:text-red-700"
                                >
                                    <AlertTriangle className="mr-2 h-4 w-4" /> 問題を報告する
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>問題を報告</DialogTitle>
                                    <DialogDescription>
                                        運営チームに問題を報告します。この報告は相手には通知されません。
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <textarea
                                        id="report-reason"
                                        className="flex min-h-[80px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                                        placeholder="問題の詳細を入力してください（例: 相手が現れない、暴言を吐かれた等）"
                                    />
                                    <Button onClick={async () => {
                                        const reasonEl = document.getElementById('report-reason') as HTMLTextAreaElement;
                                        const reason = reasonEl.value;
                                        if (!reason) return;

                                        try {
                                            const { reportIssue } = await import('@/services/firestore');
                                            await reportIssue('transaction', transaction.id, 'user_report', reason);
                                            toast.success("報告を受け付けました");
                                        } catch (e) {
                                            toast.error("送信に失敗しました");
                                        }
                                    }} className="bg-red-600 hover:bg-red-700 text-white w-full">
                                        送信する
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                {isBuyer && (
                    <div className="bg-white p-4 rounded border border-green-100 mt-4">
                        <h4 className="font-bold text-sm text-slate-700 mb-2">初回連絡用テンプレート (コピーして使用)</h4>
                        <div className="relative">
                            <textarea
                                className="w-full h-32 text-sm p-2 border rounded bg-slate-50 text-slate-600"
                                readOnly
                                value={getGreetingMessage(seller.display_name, item.title)}
                            />
                            <Button
                                className="absolute bottom-2 right-2 h-8 text-xs"
                                variant="secondary"
                                onClick={handleCopy}
                            >
                                {copied ? <CheckCircle className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                                {copied ? 'Copied' : 'Copy'}
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
