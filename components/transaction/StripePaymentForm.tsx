
"use client";

import React, { useState } from 'react';
import {
    PaymentElement,
    useStripe,
    useElements
} from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { toast } from 'sonner';

interface StripePaymentFormProps {
    transactionId: string;
    userId: string;
    amount: number;
    onSuccess: () => void;
}

export default function StripePaymentForm({ transactionId, userId, amount, onSuccess }: StripePaymentFormProps) {
    const stripe = useStripe();
    const elements = useElements();
    const [message, setMessage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!stripe || !elements) {
            return;
        }

        setIsLoading(true);

        const { error, paymentIntent } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                // Return URL is required, but we handle logic via promise if unnecessary redirect?
                // For 'payment_method' type sometimes redirect is needed.
                // But for standard cards we can sometimes avoid it or use redirect: 'if_required'.
                return_url: `${window.location.origin}/transactions/detail?id=${transactionId}`,
            },
            redirect: "if_required",
        });

        if (error) {
            setMessage(error.message ?? "予期しないエラーが発生しました。");
            setIsLoading(false);
        } else if (paymentIntent && (paymentIntent.status === "succeeded" || paymentIntent.status === "requires_capture")) {
            setMessage("決済が承認されました。利用枠を確保しました。");

            // [Auth & Capture Flow]
            // We do NOT unlock yet. We just update status to 'payment_pending'.
            // The actual unlock happens via QR Code scan.
            try {
                // [Auth & Capture Flow]
                // Valid status transition allowed by Rules: approved -> payment_pending
                const { updateTransactionStatus } = await import('@/services/firestore');
                await updateTransactionStatus(transactionId, 'payment_pending', {
                    payment_intent_id: paymentIntent.id
                });

                toast.success("支払いの仮押さえが完了しました！キャンパスで受け渡しを行ってください。");
                onSuccess(); // Triggers UI refresh
            } catch (dbError: any) {
                console.error(dbError);
                setMessage(
                    "決済の枠確保は完了しましたが、取引ステータスの更新に失敗しました。\n" +
                    "お手数ですが support@musalink.jp までご連絡ください。\n" +
                    `取引ID: ${transactionId}`
                );
            } finally {
                setIsLoading(false);
            }
        } else {
            // paymentIntent?.status は Stripe の英語 enum（例: requires_payment_method）。
            // 一般ユーザーには日本語で「処理を続けられませんでした」と伝え、技術詳細はサポート向けに残す。
            setMessage(
                `決済を完了できませんでした。もう一度お試しいただくか、別のカードをご利用ください。\n` +
                `(詳細: ${paymentIntent?.status ?? "不明"})`
            );
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <PaymentElement />
            <Button disabled={isLoading || !stripe || !elements} className="w-full font-bold bg-violet-600 hover:bg-violet-700">
                {isLoading ? "処理中..." : `${amount}円を支払う`}
            </Button>
            {message && <div className="text-sm text-red-500 font-bold">{message}</div>}
        </form>
    );
}
