"use client";

import React, { useState } from 'react';
import { Item, Transaction, TransactionStatus, User } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lock, Unlock, Copy, CheckCircle, AlertTriangle, Coins, ArrowRight, UserCheck } from 'lucide-react';
import { RevealableContent } from './RevealableContent';
import { calculateFee } from '@/lib/constants';
import { TransactionStepper } from './TransactionStepper';
import { MeetingPlaceSelector } from './MeetingPlaceSelector';
import { toast } from 'sonner';
import { Elements } from '@stripe/react-stripe-js';
import { stripePromise } from '@/lib/stripe';
import StripePaymentForm from './StripePaymentForm';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { ChatRoom } from '@/components/chat/ChatRoom';

interface TransactionDetailViewProps {
    transaction: Transaction;
    item: Item;
    seller: User;
    currentUser: User;
    onStatusChange: (status: TransactionStatus) => void;
    clientSecret?: string; // New prop for Stripe Payment
}

export const TransactionDetailView: React.FC<TransactionDetailViewProps> = ({
    transaction,
    item,
    seller,
    currentUser,
    onStatusChange,
    clientSecret
}) => {
    const [copied, setCopied] = useState(false);
    const [meetingPlace, setMeetingPlace] = useState(transaction.meeting_place || "");

    const isBuyer = currentUser.id === transaction.buyer_id;
    const isSeller = currentUser.id === transaction.seller_id;

    // システム利用料 (100 Coin)
    const feeAmount = calculateFee(item.price);

    // Greeting & Copy
    const getGreetingMessage = (sellerName: string, itemName: string) => {
        const verifiedTag = seller.is_verified ? " [学内認証済]" : "";
        const placeText = meetingPlace ? `\n受け渡し希望場所: ${meetingPlace}` : "";
        return `${sellerName}${verifiedTag} 先輩

本日、${itemName} をお譲りいただき、感謝いたします。
Musashino Linkで連絡先を確認しました。
受け渡し場所の相談などをさせていただきたく存じます。${placeText}

学部・学科
氏名`;
    };

    const handleCopy = () => {
        const text = getGreetingMessage(seller.display_name, item.title);
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Helper: Saves meeting place (Mock implementation for now, should update Firestore)
    const handleMeetingPlaceChange = (val: string) => {
        setMeetingPlace(val);
        // Note: Real implementation would call updateTransaction(id, { meeting_place: val })
        // For MVP, we presume local state is sufficient for greeting generation, or we rely on page refresh
    };

    return (
        <div className="space-y-6">
            {/* Visual Stepper */}
            <TransactionStepper status={transaction.status} />

            {/* --- 1. Request Sent Phase --- */}
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
                                : "出品者が承認すると、手数料の支払いへ進めます。しばらくお待ちください。"
                            }
                        </p>

                        {isSeller && (
                            <div className="flex gap-2">
                                <Button
                                    className="w-full bg-violet-600 hover:bg-violet-700 font-bold"
                                    onClick={() => onStatusChange('approved')}
                                >
                                    承認する (Approve)
                                </Button>
                                <Button
                                    variant="outline"
                                    className="w-full text-red-500 border-red-200 hover:bg-red-50"
                                    onClick={() => onStatusChange('cancelled')}
                                >
                                    拒否する
                                </Button>
                            </div>
                        )}

                        {isBuyer && (
                            <Button
                                variant="outline"
                                className="w-full text-slate-500"
                                onClick={() => onStatusChange('cancelled')}
                            >
                                リクエストを取り下げる
                            </Button>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* --- 2. Approved Phase (Reservation / Payment Hold) --- */}
            {transaction.status === 'approved' && (
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
                                        手数料等はかかりません。
                                    </p>
                                </div>

                                {/* Meeting Place Selector (Before Reservation) */}
                                <div className="mb-6 bg-slate-50 p-4 rounded-lg">
                                    <MeetingPlaceSelector
                                        value={meetingPlace}
                                        onChange={handleMeetingPlaceChange}
                                    />
                                    <p className="text-xs text-slate-500 mt-2">
                                        ※ここでの選択は挨拶テンプレートに反映されます（後で変更可）
                                    </p>
                                </div>

                                <p className="text-sm text-center text-slate-500 mb-4">
                                    下のフォームからカード情報を入力して<br />
                                    「支払いを予約する」ボタンを押してください。<br />
                                    <span className="text-amber-600 font-bold text-xs mt-1 block bg-amber-50 p-1 rounded">
                                        ※これはテスト環境です。実際の課金は発生しません。
                                    </span>
                                </p>

                                {clientSecret ? (
                                    <div className="bg-white p-4 rounded-lg border border-slate-200">
                                        <Elements stripe={stripePromise} options={{ clientSecret }}>
                                            <StripePaymentForm
                                                transactionId={transaction.id}
                                                userId={currentUser.id}
                                                onSuccess={() => onStatusChange('payment_pending')} // Move state forward
                                            />
                                        </Elements>
                                    </div>
                                ) : (
                                    // Fallback / Demo Button if no clientSecret (e.g. Demo Mode or Error)
                                    <div className="text-center">
                                        <p className="text-red-500 text-sm mb-2">決済システムの準備ができませんでした(Demo Mode)</p>
                                        <Button
                                            className="w-full bg-slate-600 hover:bg-slate-700"
                                            onClick={() => onStatusChange('payment_pending')}
                                        >
                                            デモ用: 支払いをスキップ (Force Pay)
                                        </Button>
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
            )}

            {/* --- 3. Payment Pending (QR Handover) --- */}
            {transaction.status === 'payment_pending' && (
                <Card className="border-2 border-blue-200 shadow-md">
                    <CardHeader className="bg-blue-50 border-b border-blue-100">
                        <CardTitle className="flex items-center gap-2 text-blue-800">
                            <Coins className="h-6 w-6" /> 受け渡しを行ってください
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">

                        <div className="text-center space-y-4">
                            <div className="bg-white p-6 rounded-xl border-2 border-dashed border-blue-300 inline-block w-full max-w-sm">
                                {isBuyer ? (
                                    <div className="space-y-4">
                                        <p className="text-sm font-bold text-slate-500">出品者に見せてください</p>
                                        <div className="w-48 h-48 bg-slate-900 mx-auto flex items-center justify-center text-white font-mono text-xs rounded-lg shadow-inner">
                                            [QR CODE]<br />{transaction.id.substring(0, 8)}
                                        </div>
                                        <p className="text-xs text-slate-400">商品を確認してから提示してください</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <p className="text-sm font-bold text-slate-500">買い手のQRコードを読み取ってください</p>
                                        <div className="w-48 h-48 bg-slate-100 mx-auto flex items-center justify-center border border-slate-300 rounded-lg">
                                            <span className="text-slate-400 text-xs">Camera View (Mock)</span>
                                        </div>
                                        <Button
                                            className="w-full bg-blue-600 hover:bg-blue-700 font-bold py-4 shadow-lg shadow-blue-200"
                                            onClick={async () => {
                                                const { toast } = await import('sonner');
                                                // Check for Demo Mode (if currentUser is Debug User or Bypass Flag)
                                                // We can infer demo mode if email matches debug pattern OR via explicit prop if we had one.
                                                // Assuming Seller is clicking this (currentUser == seller).
                                                const isDemo = currentUser.university_email?.startsWith('s2527');

                                                if (isDemo) {
                                                    toast.success("デモ決済: バーコードを読み取りました");
                                                    onStatusChange('completed'); // Call parent (which handles direct DB update)
                                                    return;
                                                }

                                                const { httpsCallable } = await import('firebase/functions');
                                                const { functions } = await import('@/lib/firebase');

                                                toast.info("決済確定処理中...", { duration: 5000 });
                                                try {
                                                    const captureFn = httpsCallable(functions, 'capturePayment');
                                                    await captureFn({ transactionId: transaction.id });
                                                    toast.success("決済完了！取引成立です");
                                                    // Reload to show 'completed' state and rating UI
                                                    window.location.reload();
                                                } catch (e: any) {
                                                    toast.error("通信エラーが発生しました。もう一度お試しください (" + e.message + ")");
                                                }
                                            }}
                                        >
                                            QRコードを読み取って確定 (Capture)
                                        </Button>
                                        <p className="text-xs text-red-500 font-bold bg-red-50 p-2 rounded">
                                            ※押すと即座に決済が確定します。<br />
                                            必ず商品を手渡してから押してください。
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Meeting Place Reminder */}
                        {meetingPlace && (
                            <div className="bg-slate-50 p-3 rounded text-sm text-slate-600 flex items-center gap-2 justify-center">
                                <span className="font-bold">待ち合わせ場所:</span> {meetingPlace}
                            </div>
                        )}

                        {isBuyer && (
                            <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800">
                                <strong>次のステップ:</strong><br />
                                1. 大学で出品者と会います。<br />
                                2. 商品の状態を確認します。<br />
                                3. 問題なければこの画面のQRコードを見せます。<br />
                                4. 出品者が読み取ると決済が確定します。
                            </div>
                        )}

                    </CardContent>
                </Card>
            )}

            {/* --- 4. Completed (Unlocked) Phase --- */}
            {transaction.status === 'completed' && (
                <Card className="border-green-200 bg-green-50 shadow-md">
                    <CardHeader className="border-b border-green-100 pb-4">
                        <CardTitle className="flex items-center gap-2 text-green-800">
                            <Unlock className="h-6 w-6" /> 連絡先が開示されました
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">

                        {/* Offline Payment Warning - REMOVED/UPDATED for Stripe Connect Flow */}
                        {/* Now payment is already captured via Stripe. */}
                        <div className="bg-green-100 border-l-4 border-green-500 p-4 rounded-r">
                            <div className="flex items-center gap-2">
                                <CheckCircle className="h-5 w-5 text-green-600" />
                                <h4 className="font-bold text-green-700">決済完了済み</h4>
                            </div>
                            <p className="text-sm text-green-800 mt-1">
                                Stripeにより決済が完了しています。現金での支払いは不要です。
                            </p>
                        </div>

                        {/* Revealable Content */}
                        <div className="space-y-4">
                            <RevealableContent
                                title="出品者情報 (Seller Info)"
                                isUnlocked={true}
                                content={transaction.unlocked_assets || {}}
                            />
                        </div>

                        {/* Handover Actions */}
                        <div className="pt-4 border-t border-green-200">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {/* Rating Logic */}
                                {((isBuyer && !transaction.buyer_rated) || (isSeller && !transaction.seller_rated)) ? (
                                    <div className="col-span-full bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                                        <p className="font-bold text-yellow-800 mb-2 text-center">取引相手を評価してください</p>
                                        <div className="flex justify-center gap-2 mb-3">
                                            {[1, 2, 3, 4, 5].map(score => (
                                                <Button
                                                    key={score}
                                                    variant="outline"
                                                    size="icon"
                                                    className="w-10 h-10 rounded-full border-yellow-400 hover:bg-yellow-100 text-yellow-500"
                                                    onClick={async () => {
                                                        const targetId = isBuyer ? seller.id : currentUser.id; // Corrected: isBuyer rates seller, isSeller rates buyer
                                                        const targetRole = isBuyer ? 'seller' : 'buyer'; // The role of the person BEING rated? 
                                                        // rateUser(targetUserId, txId, myRole, score)
                                                        // My role is 'buyer', so I set buyer_rated = true.
                                                        // Target is seller.
                                                        // Correct.

                                                        const { rateUser } = await import('@/services/firestore');
                                                        const { toast } = require('sonner');

                                                        // Determine TARGET ID (who is being rated)
                                                        const ratedUserId = isBuyer ? seller.id : transaction.buyer_id;

                                                        try {
                                                            await rateUser(ratedUserId, transaction.id, isBuyer ? 'buyer' : 'seller', score);
                                                            toast.success("評価を送信しました！");
                                                            // Reload page or wait for optimistic update
                                                            window.location.reload();
                                                        } catch (e) {
                                                            toast.error("評価に失敗しました");
                                                        }
                                                    }}
                                                >
                                                    <span className="font-bold text-lg">{score}</span>
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="col-span-full text-center text-slate-500 text-sm py-2">
                                        <Badge variant="outline" className="bg-slate-100">評価済み</Badge>
                                    </div>
                                )}
                            </div>

                            <div className="mt-4">
                                <Button
                                    variant="ghost"
                                    className="w-full text-red-600 hover:bg-red-50 hover:text-red-700"
                                    onClick={() => alert("運営に問題を報告しました (Mock)")}
                                >
                                    <AlertTriangle className="mr-2 h-4 w-4" /> 問題を報告する
                                </Button>
                            </div>
                        </div>

                        {/* Greeting Template (Automatic for Buyer) */}
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
            )}

            {/* --- Chat Room (Available in all phases) --- */}
            <ChatRoom
                transactionId={transaction.id}
                buyerId={transaction.buyer_id}
                sellerId={transaction.seller_id}
            />
        </div>
    );
};
