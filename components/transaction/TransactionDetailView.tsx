
"use client";

import React, { useState } from 'react';
import QRCode from 'react-qr-code';
import { Item, Transaction, TransactionStatus, User } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lock, Unlock, Copy, CheckCircle, AlertTriangle, Coins, ArrowRight, UserCheck } from 'lucide-react';
import { RevealableContent } from './RevealableContent';
import { calculateFee } from '@/lib/constants'; // Restored
import { TransactionStepper } from './TransactionStepper';
import { MeetingPlaceSelector } from './MeetingPlaceSelector';
import { cn, getTransactionStatusLabel } from '@/lib/utils';
import { toast } from 'sonner';
import { Elements } from '@stripe/react-stripe-js';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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

    // Helper: Saves meeting place...
    const handleMeetingPlaceChange = (val: string) => {
        setMeetingPlace(val);
    };

    // [Step 9678] QR Scanner Logic
    const [isScanning, setIsScanning] = useState(false);

    React.useEffect(() => {
        if (!isScanning) return;

        let scanner: any = null;

        const initScanner = async () => {
            try {
                const { Html5QrcodeScanner } = await import('html5-qrcode');

                // Initialize scanner (targetId: "reader")
                scanner = new Html5QrcodeScanner(
                    "reader",
                    { fps: 10, qrbox: { width: 250, height: 250 } },
                    /* verbose= */ false
                );

                scanner.render(async (decodedText: string) => {
                    // console.log("Scanned:", decodedText);

                    // Validate ID
                    if (decodedText === transaction.id) {
                        scanner.clear();
                        setIsScanning(false);
                        toast.success("QRコードを読み取りました！");

                        // Execute Capture Payment Flow
                        await handleCapturePayment();
                    } else {
                        // Wrong QR Code
                        toast.error("無効なQRコードです（取引IDが一致しません）");
                    }
                }, (error: any) => {
                    // console.warn(error);
                });
            } catch (e) {
                console.error("Scanner Init Error", e);
                toast.error("カメラの起動に失敗しました");
                setIsScanning(false);
            }
        };

        // Small timeout to ensure DOM is ready
        const timer = setTimeout(initScanner, 100);

        return () => {
            clearTimeout(timer);
            if (scanner) {
                scanner.clear().catch((err: any) => console.error("Failed to clear scanner", err));
            }
        };
    }, [isScanning, transaction.id]);

    // Extracted Capture Logic
    const handleCapturePayment = async () => {
        const { toast } = await import('sonner');

        // [Robust Demo Check]
        const isDemo = currentUser.is_demo === true ||
            currentUser.university_email?.startsWith('s2527') ||
            currentUser.university_email?.startsWith('s11111');

        if (isDemo) {
            toast.success("デモ決済: 受取完了");
            onStatusChange('completed');
            return;
        }

        const { httpsCallable } = await import('firebase/functions');
        const { functions } = await import('@/lib/firebase');

        toast.info("受取確認処理中...", { duration: 5000 });
        try {
            const captureFn = httpsCallable(functions, 'capturePayment');
            await captureFn({ transactionId: transaction.id });
            toast.success("受取完了！支払いを確定しました");
            window.location.reload();
        } catch (e: any) {
            toast.error("通信エラーが発生しました (" + e.message + ")");
        }
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
                                    承認する
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
                        {/* Hybrid View: Show Buyer Logic if Buyer OR Self-Trade */}
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

                                {/* Hybrid Logic: If Self-Trade (Buyer & Seller), show BOTH sections stack */}

                                {(isSeller || (isBuyer && isSeller)) && (
                                    <div className="space-y-4 mb-8 border-b border-slate-100 pb-8">
                                        <p className="text-sm font-bold text-slate-500">【売り手】このQRコードを買い手に提示してください</p>
                                        <div className="bg-white p-4 mx-auto inline-block rounded-lg shadow-inner border border-slate-200">
                                            <QRCode value={transaction.id} size={160} />
                                        </div>
                                        <p className="text-xs text-slate-400">商品を手渡す際に提示してください</p>
                                    </div>
                                )}

                                {(isBuyer || (isBuyer && isSeller)) && (
                                    <div className="space-y-4">
                                        <p className="text-sm font-bold text-slate-500">【買い手】売り手のQRコードを読み取ってください</p>

                                        {!isScanning ? (
                                            <div className="space-y-4">
                                                <div className="w-48 h-48 bg-slate-100 mx-auto flex items-center justify-center border border-slate-300 rounded-lg">
                                                    <span className="text-slate-400 text-xs">カメラビュー (Mock)</span>
                                                </div>
                                                <Button
                                                    className="w-full bg-blue-600 hover:bg-blue-700 font-bold py-4 shadow-lg shadow-blue-200"
                                                    onClick={() => setIsScanning(true)}
                                                >
                                                    <span className="flex items-center gap-2">
                                                        <CheckCircle className="w-5 h-5" />
                                                        カメラを起動して読み取る
                                                    </span>
                                                </Button>
                                                {/* Fallback/Demo Button kept for safety if camera fails */}
                                                <button
                                                    onClick={() => {
                                                        const isDemo = currentUser.is_demo === true ||
                                                            currentUser.university_email?.startsWith('s2527') ||
                                                            currentUser.university_email?.startsWith('s11111');

                                                        if (isDemo) {
                                                            toast.success("デモ決済: バーコードを読み取りました");
                                                            onStatusChange('completed');
                                                            return;
                                                        }
                                                        toast.error("カメラを使用してください");
                                                    }}
                                                    className="text-xs text-slate-400 underline hover:text-slate-600"
                                                >
                                                    (デモ用: カメラが使えない場合はこちら)
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                <div id="reader" className="w-full max-w-sm mx-auto overflow-hidden rounded-lg border border-slate-300"></div>
                                                <Button
                                                    variant="outline"
                                                    className="w-full"
                                                    onClick={() => setIsScanning(false)}
                                                >
                                                    キャンセル
                                                </Button>
                                            </div>
                                        )}
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
                                                    className="w-10 h-10 rounded-full border-yellow-400 hover:bg-yellow-100 text-yellow-500 transition-all hover:scale-110"
                                                    onClick={async () => {
                                                        const { rateUser } = await import('@/services/firestore');
                                                        const { toast } = require('sonner');
                                                        const ratedUserId = isBuyer ? seller.id : transaction.buyer_id;

                                                        try {
                                                            await rateUser(ratedUserId, transaction.id, isBuyer ? 'buyer' : 'seller', score);
                                                            toast.success("評価を送信しました！");
                                                            window.location.reload();
                                                        } catch (e) {
                                                            toast.error("評価に失敗しました");
                                                        }
                                                    }}
                                                >
                                                    {/* Show visual stars for input */}
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
                                                    // Close dialog hack (or use state if strictly controlled, but Dialog primitive handles close on outside click)
                                                    // For cleaner UX, we should use state, but this is inside a deeply nested block.
                                                    // Let's rely on toast for now.
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
