"use client";

import React, { useState } from 'react';
import { Coins } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { QRCodeGenerator } from '../QRCodeGenerator';
import { QRCodeScanner } from '../QRCodeScanner';
import type { Transaction } from '@/types';

interface HandoverSectionProps {
    transaction: Transaction;
    isBuyer: boolean;
    isSeller: boolean;
    meetingPlace?: string;
}

// 「決済枠確保済 (payment_pending)」状態の UI — 対面受渡し + QR スキャン。
// Seller は QR を表示、Buyer はカメラでスキャンして capture を呼ぶ。
export const HandoverSection: React.FC<HandoverSectionProps> = ({
    transaction,
    isBuyer,
    isSeller,
    meetingPlace,
}) => {
    const [scanKey, setScanKey] = useState(0);
    const [cameraError, setCameraError] = useState<'denied' | 'unavailable' | null>(null);

    const qrValue = React.useMemo(
        () => JSON.stringify({ type: 'musalink_handover', txId: transaction.id }),
        [transaction.id]
    );

    const handleCapturePayment = async () => {
        if (!transaction || !transaction.id) {
            toast.error("取引IDが見つかりません");
            return;
        }

        const { httpsCallable } = await import('firebase/functions');
        const { functions } = await import('@/lib/firebase');

        toast.info("受取確認処理中...", { duration: 5000 });
        try {
            const captureFn = httpsCallable(functions, 'capturePayment');
            await captureFn({ transactionId: transaction.id });
            toast.success("受取完了！支払いを確定しました");

            // Wait for Firestore sync, then reload to fetch unlocked_assets
            setTimeout(() => window.location.reload(), 1000);
        } catch (e: any) {
            console.error("Capture Error Detailed:", e);
            const errorMsg = e.message || "不明な通信エラー";
            const errorCode = e.code || "no-code";
            toast.error(`通信エラーが発生しました (${errorCode}: ${errorMsg})`, {
                duration: 10000,
                description: "この画面をスクリーンショットして開発者に送ってください。"
            });
            setScanKey(prev => prev + 1);
        }
    };

    return (
        <Card className="border-2 border-blue-200 shadow-xl overflow-hidden">
            <CardHeader className="bg-blue-600 text-white border-b border-blue-500">
                <CardTitle className="flex items-center gap-2">
                    <Coins className="h-6 w-6" /> 商品の受け渡し・QR認証
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-8 space-y-8">
                <div className="text-center space-y-6">

                    {isSeller && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 text-left">
                                <p className="text-lg font-bold text-blue-900 mb-1">
                                    👮 出品者のアクション
                                </p>
                                <p className="text-sm text-blue-700">
                                    購入者に会ったら、このQRコードを見せてください。<br />
                                    購入者が読み取ると、取引が完了し売上が確定します。
                                </p>
                            </div>

                            <div className="flex justify-center my-8">
                                <div className="relative group">
                                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-violet-600 rounded-2xl blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
                                    <div className="relative">
                                        <QRCodeGenerator value={qrValue} size={220} />
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3">
                                <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                    待機中... 画面を閉じずにそのままお待ちください
                                </div>
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button variant="ghost" size="sm" className="text-xs text-slate-400 hover:text-red-500">
                                            買い手がスキャンできない場合
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>手動完了（緊急用）</DialogTitle>
                                            <DialogDescription>
                                                カメラが壊れている等の理由でスキャンできない場合のみ使用してください。
                                            </DialogDescription>
                                        </DialogHeader>
                                        <p className="text-sm text-slate-600 mb-4">
                                            相手のアプリ画面で「受取完了」ボタンを押してもらってください。<br />
                                            ※現在、買い手側の手動ボタンは非表示設定になっています。<br />
                                            トラブルとして報告してください。
                                        </p>
                                        <Button
                                            variant="secondary"
                                            onClick={() => window.location.reload()}
                                        >
                                            再読み込み
                                        </Button>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </div>
                    )}

                    {isBuyer && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 text-left">
                                <p className="text-lg font-bold text-blue-900 mb-1">
                                    🙋 購入者のアクション
                                </p>
                                <p className="text-sm text-blue-700">
                                    出品者から商品を受け取り、中身を確認してください。<br />
                                    問題なければ、相手のスマホのQRコードを読み取ってください。
                                </p>
                            </div>

                            <div className="min-h-[300px] bg-black rounded-xl overflow-hidden relative border-4 border-slate-900">
                                {cameraError ? (
                                    <div className="flex flex-col items-center justify-center h-[300px] p-6 text-center space-y-3">
                                        <p className="text-2xl">📷</p>
                                        <p className="text-white font-bold text-sm">
                                            {cameraError === 'denied'
                                                ? 'カメラのアクセスが拒否されています'
                                                : 'カメラを起動できませんでした'}
                                        </p>
                                        <p className="text-slate-400 text-xs leading-relaxed">
                                            {cameraError === 'denied'
                                                ? 'ブラウザの設定 → このサイトの設定 → カメラを「許可」に変更してから再試行してください。'
                                                : 'カメラが接続されていないか、他のアプリが使用中です。'}
                                        </p>
                                        <button
                                            onClick={() => { setCameraError(null); setScanKey(prev => prev + 1); }}
                                            className="mt-2 px-4 py-2 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700"
                                        >
                                            再試行
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <QRCodeScanner
                                            key={scanKey}
                                            onScan={(decodedText) => {
                                                try {
                                                    const data = JSON.parse(decodedText);
                                                    if (data.type === 'musalink_handover' && data.txId === transaction.id) {
                                                        handleCapturePayment();
                                                    } else {
                                                        toast.error("無効なQRコードです（別の取引コードの可能性があります）");
                                                        setTimeout(() => setScanKey(prev => prev + 1), 2000);
                                                    }
                                                } catch {
                                                    toast.error("QRコードの形式が正しくありません");
                                                    setTimeout(() => setScanKey(prev => prev + 1), 2000);
                                                }
                                            }}
                                            onError={(err) => {
                                                if (err === 'camera_denied') {
                                                    setCameraError('denied');
                                                } else if (err === 'camera_unavailable') {
                                                    setCameraError('unavailable');
                                                }
                                            }}
                                        />
                                        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent text-white text-center pointer-events-none">
                                            <p className="font-bold text-sm">カメラを許可してスキャン</p>
                                        </div>
                                    </>
                                )}
                            </div>

                            {process.env.NODE_ENV === 'development' && (
                                <div className="pt-4">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-xs text-slate-400"
                                        onClick={() => {
                                            if (confirm("【デバッグ用】カメラなしで強制完了しますか？")) {
                                                handleCapturePayment();
                                            }
                                        }}
                                    >
                                        [Debug] QRなしで完了 (クリック)
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}

                </div>

                {meetingPlace && (
                    <div className="bg-slate-50 p-3 rounded text-sm text-slate-600 flex items-center gap-2 justify-center border border-slate-100">
                        <span className="font-bold text-slate-400">待ち合わせ場所:</span> {meetingPlace}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
