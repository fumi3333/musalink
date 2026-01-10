"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { extractStudentId } from '@/lib/studentId';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { AlertCircle } from 'lucide-react';

export default function VerificationPage() {
    const router = useRouter();
    const { user, login } = useAuth();
    const [studentId, setStudentId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [isVerified, setIsVerified] = useState(false);

    useEffect(() => {
        async function checkStatus() {
            if (user) {
                if (user.email) {
                    const sid = extractStudentId(user.email);
                    setStudentId(sid);
                }

                // Check if already verified
                const userRef = doc(db, "users", user.uid);
                const userDoc = await getDoc(userRef);
                if (userDoc.exists() && userDoc.data().is_verified) {
                    setIsVerified(true);
                }
            }
            setLoading(false);
        }
        checkStatus();
    }, [user]);

    const handleVerify = async () => {
        if (!user || !studentId) return;
        setLoading(true);

        try {
            const userRef = doc(db, "users", user.uid);

            // Ensure user doc exists, then update
            await setDoc(userRef, {
                id: user.uid,
                university_email: user.email,
                student_id: studentId,
                is_verified: true,
                updatedAt: new Date()
            }, { merge: true });

            toast.success("本人確認が完了しました！");
            setIsVerified(true);
            // Redirect to Payout Setup (Stripe Connect)
            setTimeout(() => router.push('/seller/payout'), 1500);

        } catch (e: any) {
            console.error(e);
            toast.error("エラーが発生しました: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500">読み込み中...</div>;

    // Use centralized Auth Logic (which handles 'configuration-not-found' gracefully)
    if (!user) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <Card className="w-full max-w-md shadow-lg border-slate-200">
                    <CardHeader className="bg-white rounded-t-lg">
                        <CardTitle className="text-slate-800 text-center">ログインが必要です</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4 text-center">
                        <p className="text-slate-600">
                            本人確認を行うには、まずログインしてください。<br />
                            (武蔵野大学のGoogleアカウントが必要です)
                        </p>
                        <Button
                            className="w-full font-bold bg-violet-600 text-white"
                            onClick={login}
                        >
                            Googleでログイン
                        </Button>
                        <Button onClick={() => router.push('/')} variant="ghost" className="w-full mt-2">
                            トップへ戻る
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md shadow-lg border-violet-100">
                <CardHeader className="bg-violet-50 border-b border-violet-100">
                    <CardTitle className="text-violet-800 text-center">本人確認 (Identity Verification)</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">

                    {isVerified ? (
                        <div className="text-center py-6">
                            <div className="text-4xl mb-4">✅</div>
                            <h2 className="text-lg font-bold text-slate-700">認証済みです</h2>
                            <p className="text-slate-500 mb-6">次は売上受け取り口座の設定です。</p>
                            <Button onClick={() => router.push('/seller/payout')} className="w-full">
                                口座登録へ進む
                            </Button>
                        </div>
                    ) : (
                        <>
                            <div className="text-center space-y-2">
                                <p className="text-sm text-slate-600">
                                    安全な取引のため、大学メールアドレスから<br />
                                    <strong>学籍番号</strong>を確認し、アカウントに紐付けます。
                                </p>
                            </div>

                            <div className="bg-slate-100 p-4 rounded-lg space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-slate-500">EMAIL</span>
                                    <span className="font-mono text-sm">{user.email}</span>
                                </div>
                                <div className="flex justify-between items-center bg-white p-2 rounded border border-slate-200">
                                    <span className="text-xs font-bold text-violet-600">STUDENT ID</span>
                                    <span className="font-mono text-lg font-bold text-slate-800">
                                        {studentId || "Unknown"}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <p className="text-xs text-slate-500 text-center">
                                    下のボタンを押すことで、私が武蔵野大学の学生であり、<br />
                                    責任を持って取引を行うことを宣誓します。
                                </p>

                                <Button
                                    onClick={handleVerify}
                                    disabled={!studentId || loading}
                                    className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold py-6 shadow-md shadow-violet-200"
                                >
                                    確認して出品者登録する
                                </Button>
                            </div>
                        </>
                    )}

                </CardContent>
            </Card>
        </div>
    );
}

