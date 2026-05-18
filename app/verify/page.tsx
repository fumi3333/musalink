"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { db, auth } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getIdToken } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { CheckCircle, Loader2, Mail, KeyRound } from 'lucide-react';

type Step = 'email_input' | 'otp_input' | 'success';

export default function VerificationPage() {
    const router = useRouter();
    const { user, login } = useAuth();
    const [step, setStep] = useState<Step>('email_input');
    const [universityEmail, setUniversityEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        async function checkStatus() {
            if (user) {
                const userRef = doc(db, "users", user.uid);
                const userDoc = await getDoc(userRef);
                if (userDoc.exists() && userDoc.data().is_verified) {
                    setStep('success');
                }
            }
            setLoading(false);
        }
        checkStatus();
    }, [user]);

    const fns = getFunctions(undefined, 'us-central1');

    const handleSendOTP = async () => {
        if (!user) return;
        const email = universityEmail.trim().toLowerCase();
        if (!email.endsWith('@stu.musashino-u.ac.jp')) {
            toast.error('@stu.musashino-u.ac.jp で終わるメールアドレスを入力してください');
            return;
        }
        setSubmitting(true);
        try {
            const sendOTP = httpsCallable(fns, 'sendUniversityOTP');
            await sendOTP({ universityEmail: email });
            toast.success(`${email} に認証コードを送信しました`);
            setStep('otp_input');
        } catch (e: any) {
            toast.error(e.message || '送信に失敗しました');
        } finally {
            setSubmitting(false);
        }
    };

    const handleVerifyOTP = async () => {
        if (!user) return;
        if (!/^\d{6}$/.test(otp.trim())) {
            toast.error('6桁の数字を入力してください');
            return;
        }
        setSubmitting(true);
        try {
            const verifyOTP = httpsCallable(fns, 'verifyUniversityOTP');
            await verifyOTP({ otp: otp.trim() });

            // Custom Claim が付与されたので ID Token を強制更新
            if (auth.currentUser) {
                await getIdToken(auth.currentUser, true);
            }

            toast.success('在学確認が完了しました！');
            setStep('success');
            setTimeout(() => { window.location.href = '/seller/payout'; }, 1500);
        } catch (e: any) {
            toast.error(e.message || '確認に失敗しました');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center text-slate-500">読み込み中...</div>;
    }

    if (!user) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <Card className="w-full max-w-md shadow-lg border-slate-200">
                    <CardHeader className="bg-white rounded-t-lg">
                        <CardTitle className="text-slate-800 text-center">ログインが必要です</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4 text-center">
                        <p className="text-slate-600">
                            在学確認を行うには、まずGoogleアカウントでログインしてください。
                        </p>
                        <Button className="w-full font-bold bg-violet-600 text-white" onClick={login}>
                            Googleでログイン
                        </Button>
                        <Button onClick={() => router.push('/')} variant="ghost" className="w-full mt-2">
                            トップへ戻る
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md shadow-lg border-violet-100">
                <CardHeader className="bg-violet-50 border-b border-violet-100">
                    <CardTitle className="text-violet-800 text-center">在学確認</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">

                    {step === 'success' && (
                        <div className="text-center py-6 space-y-4">
                            <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
                            <h2 className="text-lg font-bold text-slate-700">認証済みです</h2>
                            <p className="text-slate-500">次は売上受け取り口座の設定です。</p>
                            <Button onClick={() => router.push('/seller/payout')} className="w-full">
                                口座登録へ進む
                            </Button>
                        </div>
                    )}

                    {step === 'email_input' && (
                        <div className="space-y-4">
                            <div className="text-center space-y-1">
                                <Mail className="w-8 h-8 text-violet-500 mx-auto" />
                                <p className="text-sm text-slate-600">
                                    武蔵野大学の学生メールアドレスに確認コードを送ります。
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500">大学メールアドレス</label>
                                <Input
                                    type="email"
                                    placeholder="s25xxxxx@stu.musashino-u.ac.jp"
                                    value={universityEmail}
                                    onChange={e => setUniversityEmail(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSendOTP()}
                                    disabled={submitting}
                                    className="font-mono text-sm"
                                />
                                <p className="text-xs text-slate-400">@stu.musashino-u.ac.jp のみ対応</p>
                            </div>

                            <Button
                                onClick={handleSendOTP}
                                disabled={submitting || !universityEmail}
                                className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold py-5"
                            >
                                {submitting ? (
                                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />送信中...</>
                                ) : (
                                    '確認コードを送信'
                                )}
                            </Button>

                            <p className="text-xs text-slate-400 text-center">
                                ログイン中のGoogleアカウント: {user.email}
                            </p>
                        </div>
                    )}

                    {step === 'otp_input' && (
                        <div className="space-y-4">
                            <div className="text-center space-y-1">
                                <KeyRound className="w-8 h-8 text-violet-500 mx-auto" />
                                <p className="text-sm text-slate-600">
                                    <span className="font-mono text-xs break-all">{universityEmail}</span><br />
                                    に6桁のコードを送信しました。<br />
                                    <span className="text-xs text-slate-400">迷惑メールフォルダもご確認ください。有効期限: 15分</span>
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500">認証コード（6桁）</label>
                                <Input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={6}
                                    placeholder="123456"
                                    value={otp}
                                    onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    onKeyDown={e => e.key === 'Enter' && handleVerifyOTP()}
                                    disabled={submitting}
                                    className="font-mono text-2xl text-center tracking-widest"
                                />
                            </div>

                            <Button
                                onClick={handleVerifyOTP}
                                disabled={submitting || otp.length !== 6}
                                className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold py-5"
                            >
                                {submitting ? (
                                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />確認中...</>
                                ) : (
                                    '確認して登録を完了する'
                                )}
                            </Button>

                            <Button
                                variant="ghost"
                                className="w-full text-xs text-slate-400"
                                onClick={() => { setStep('email_input'); setOtp(''); }}
                                disabled={submitting}
                            >
                                別のメールアドレスを使う
                            </Button>
                        </div>
                    )}

                </CardContent>
            </Card>
        </div>
    );
}
