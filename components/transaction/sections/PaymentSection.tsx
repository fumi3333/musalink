"use client";

import React, { useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Elements } from '@stripe/react-stripe-js';
import { stripePromise } from '@/lib/stripe';
import StripePaymentForm from '../StripePaymentForm';
import { MeetingPlaceSelector } from '../MeetingPlaceSelector';
import { calculateFee } from '@/lib/constants';
import type { Item, Transaction, TransactionStatus, User } from '@/types';

interface PaymentSectionProps {
    transaction: Transaction;
    item: Item;
    seller: User;
    currentUser: User;
    isBuyer: boolean;
    clientSecret?: string;
    onStatusChange: (status: TransactionStatus) => void;
}

// 「承認済 (approved)」状態の UI — Stripe 決済枠の予約フォーム。
// Buyer 視点では決済入力、Seller 視点では「待っている」表示。
export const PaymentSection: React.FC<PaymentSectionProps> = ({
    transaction,
    item,
    seller,
    currentUser,
    isBuyer,
    clientSecret,
    onStatusChange,
}) => {
    const [meetingPlace, setMeetingPlace] = useState(transaction.meeting_place || "");
    const feeAmount = calculateFee(item.price);

    return (
        <Card className="border-2 border-violet-100 shadow-sm">
            <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2 text-violet-800">
                    <CheckCircle className="h-6 w-6" />
                    リクエストが承認されました
                </CardTitle>
            </CardHeader>
            <CardContent>
                {isBuyer ? (
                    <>
                        <p className="mb-4 text-slate-600">
                            商品の確保（決済予約）を行います。<br />
                            <span className="font-bold text-slate-800">まだ支払いは確定しません。</span> 商品受け取り時に確定します。
                        </p>

                        <div className="bg-violet-50 p-4 rounded-lg border border-violet-200 text-center mb-6">
                            <p className="font-bold text-violet-800 mb-2">① 決済枠の確保 (Reserve)</p>
                            <p className="text-sm text-slate-600">
                                クレジットカードの利用枠を確保します。<br />
                                この段階ではまだ請求は確定しません。
                            </p>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6 text-sm">
                            <p className="font-bold text-slate-800 mb-2">お支払い内訳</p>
                            <div className="flex justify-between text-slate-600">
                                <span>商品代金</span>
                                <span>¥{item.price.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-slate-500 text-xs mt-1">
                                <span>うちサービス手数料（出品者から差引・10% / 最低50円）</span>
                                <span>¥{feeAmount.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-slate-700 mt-2 pt-2 border-t border-slate-200">
                                <span>あなたのお支払い</span>
                                <span className="font-bold">¥{item.price.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-slate-500 text-xs mt-1">
                                <span>出品者の受取額</span>
                                <span>¥{(item.price - feeAmount).toLocaleString()}</span>
                            </div>
                        </div>

                        <div className="mb-6 bg-slate-50 p-4 rounded-lg">
                            <MeetingPlaceSelector
                                value={meetingPlace}
                                onChange={setMeetingPlace}
                            />
                            <p className="text-xs text-slate-500 mt-2">
                                ※ここでの選択は挨拶テンプレートに反映されます（後で変更可）
                            </p>
                            <div className="mt-2 text-xs bg-white p-2 rounded border border-slate-100 text-slate-600">
                                <span className="font-bold">出品者の活動キャンパス: </span>
                                {seller?.campus === 'musashino' ? '武蔵野キャンパス' :
                                    seller?.campus === 'ariake' ? '有明キャンパス' :
                                        seller?.campus === 'both' ? '両キャンパス' :
                                            '未設定'}
                            </div>
                        </div>

                        <p className="text-sm text-center text-slate-500 mb-4">
                            下のフォームからカード情報を入力して<br />
                            「支払いを予約する」ボタンを押してください。
                        </p>

                        {clientSecret ? (
                            <div className="bg-white p-4 rounded-lg border border-slate-200">
                                <Elements stripe={stripePromise} options={{ clientSecret }}>
                                    <StripePaymentForm
                                        transactionId={transaction.id}
                                        userId={currentUser.id}
                                        amount={item.price}
                                        onSuccess={() => onStatusChange('payment_pending')}
                                    />
                                </Elements>
                            </div>
                        ) : (
                            <div className="text-center py-6">
                                <p className="text-slate-500 text-sm mb-2">決済システムの準備中、またはエラーが発生しました。</p>
                                <p className="text-slate-400 text-xs">ページを再読み込みするか、時間をおいてお試しください。</p>
                            </div>
                        )}
                    </>
                ) : (
                    <p className="text-slate-600">
                        買い手が支払いの予約（枠確保）を行うのを待っています。<br />
                        予約が完了すると、対面受け渡しのステップに進みます。
                    </p>
                )}
            </CardContent>
        </Card>
    );
};
