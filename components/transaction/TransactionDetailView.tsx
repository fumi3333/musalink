"use client";

import React from 'react';
import { toast } from 'sonner';
import { Item, Transaction, TransactionStatus, User } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, UserCheck } from 'lucide-react';
import { TransactionStepper } from './TransactionStepper';
import { PaymentSection } from './sections/PaymentSection';
import { HandoverSection } from './sections/HandoverSection';
import { CompletedSection } from './sections/CompletedSection';

interface TransactionDetailViewProps {
    transaction: Transaction;
    item: Item;
    seller: User;
    currentUser: User;
    onStatusChange: (status: TransactionStatus) => void;
    clientSecret?: string;
}

export const TransactionDetailView: React.FC<TransactionDetailViewProps> = ({
    transaction,
    item,
    seller,
    currentUser,
    onStatusChange,
    clientSecret,
}) => {
    // Role resolution. Self-trade (Buyer === Seller) は student_id ヒューリスティックで解決。
    // s1111111 はゲストアカウントの慣例で Buyer 役、それ以外は Seller 役。
    let isBuyer = currentUser.id === transaction.buyer_id;
    let isSeller = currentUser.id === transaction.seller_id;
    if (isBuyer && isSeller) {
        if (currentUser.student_id === 's1111111') {
            isSeller = false;
        } else {
            isBuyer = false;
        }
    }

    const handleCancel = async (reason: string) => {
        if (!confirm("本当にキャンセルしますか？\n（決済済みの場合は返金処理が行われます）")) return;

        const { httpsCallable } = await import('firebase/functions');
        const { functions } = await import('@/lib/firebase');

        toast.info("キャンセル処理中...", { duration: 5000 });
        try {
            const cancelFn = httpsCallable(functions, 'cancelTransaction');
            await cancelFn({ transactionId: transaction.id, reason });
            toast.success("取引をキャンセルしました");
            onStatusChange('cancelled');
            window.location.reload();
        } catch (e: any) {
            console.error(e);
            toast.error("キャンセルに失敗しました: " + e.message);
        }
    };

    return (
        <div className="space-y-6">
            <TransactionStepper status={transaction.status} />

            {transaction.status === 'cancelled' && (
                <Card className="border-2 border-slate-100 bg-slate-50">
                    <CardContent className="pt-6 text-center text-slate-500">
                        <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                        <p>この取引はキャンセルされました</p>
                        <p className="text-xs mt-1">理由: {transaction.cancel_reason || "ユーザー都合"}</p>
                    </CardContent>
                </Card>
            )}

            {transaction.status === 'request_sent' && (
                <Card className="border-2 border-slate-200 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-xl flex items-center gap-2">
                            <UserCheck className="h-6 w-6 text-violet-500" />
                            {isSeller ? "購入リクエストが届いています" : "出品者の承認待ちです"}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="mb-4 text-slate-600">
                            {isSeller
                                ? "購入希望者がいます。評価などを確認し、問題なければ承認してください。承認すると買い手が決済に進めるようになります。"
                                : "出品者が承認すると、決済枠の確保（仮押さえ）へ進めます。しばらくお待ちください。"
                            }
                        </p>

                        {isSeller && (
                            <div className="flex gap-2">
                                <Button
                                    className="w-full bg-violet-600 hover:bg-violet-700 font-bold"
                                    onClick={() => onStatusChange('approved')}
                                >
                                    承認する
                                </Button>
                                <Button
                                    variant="outline"
                                    className="w-full text-red-500 border-red-200 hover:bg-red-50"
                                    onClick={() => handleCancel("出品者がリクエストを拒否")}
                                >
                                    拒否する
                                </Button>
                            </div>
                        )}

                        {isBuyer && (
                            <Button
                                variant="outline"
                                className="w-full text-slate-500"
                                onClick={() => handleCancel("買い手がリクエストを取り下げ")}
                            >
                                リクエストを取り下げる
                            </Button>
                        )}
                    </CardContent>
                </Card>
            )}

            {transaction.status === 'approved' && (
                <PaymentSection
                    transaction={transaction}
                    item={item}
                    seller={seller}
                    currentUser={currentUser}
                    isBuyer={isBuyer}
                    clientSecret={clientSecret}
                    onStatusChange={onStatusChange}
                />
            )}

            {transaction.status === 'payment_pending' && (
                <HandoverSection
                    transaction={transaction}
                    isBuyer={isBuyer}
                    isSeller={isSeller}
                    meetingPlace={transaction.meeting_place}
                />
            )}

            {transaction.status === 'completed' && (
                <CompletedSection
                    transaction={transaction}
                    item={item}
                    seller={seller}
                    isBuyer={isBuyer}
                    isSeller={isSeller}
                />
            )}
        </div>
    );
};
