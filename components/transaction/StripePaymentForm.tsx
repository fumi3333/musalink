
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
    onSuccess: () => void;
}

export default function StripePaymentForm({ transactionId, userId, onSuccess }: StripePaymentFormProps) {
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
            setMessage(error.message ?? "An unexpected error occurred.");
            setIsLoading(false);
        } else if (paymentIntent && paymentIntent.status === "succeeded") {
            setMessage("Payment succeeded! Unlocking contact info...");

            // Call Server to Unlock
            try {
                const unlockFn = httpsCallable(functions, 'unlockTransaction');
                await unlockFn({
                    transactionId,
                    userId,
                    paymentIntentId: paymentIntent.id
                });
                toast.success("支払いが完了しました！連絡先が開示されます。");
                onSuccess();
            } catch (serverError: any) {
                console.error(serverError);
                setMessage("支払いは完了しましたが、画面更新に失敗しました。運営に連絡してください。");
            } finally {
                setIsLoading(false);
            }
        } else {
            setMessage("Payment status: " + paymentIntent?.status);
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <PaymentElement />
            <Button disabled={isLoading || !stripe || !elements} className="w-full font-bold bg-violet-600 hover:bg-violet-700">
                {isLoading ? "処理中..." : "100円を支払う"}
            </Button>
            {message && <div className="text-sm text-red-500 font-bold">{message}</div>}
        </form>
    );
}
