"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { User as UserIcon, LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"

export const AuthButtons = () => {
    const { user, login, logout, loading, error, debugLogin } = useAuth();
    const [showErrorDialog, setShowErrorDialog] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

    // Watch for errors returned by useAuth
    React.useEffect(() => {
        if (error) {
            setShowErrorDialog(true);
        }
    }, [error]);

    const isVerified = user?.email?.endsWith('@stu.musashino-u.ac.jp');

    if (loading) return <div className="text-xs text-slate-400 px-2">Loading...</div>;

    if (!user) {
        return (
            <div className="flex gap-2">
                <Button onClick={login} variant="default" size="sm" className="bg-violet-600 text-white font-bold">
                    <LogIn className="w-4 h-4 mr-2" />
                    ログイン
                </Button>

                {/* TEST MODE ACCOUNTS */}
                <div className="flex flex-col gap-1">
                    <Button onClick={() => debugLogin('seller')} variant="outline" size="sm" className="text-[10px] h-6 px-2 text-slate-500 border-dashed border-slate-300 hover:bg-violet-50 hover:text-violet-600 hover:border-violet-300 transition-all">
                        🟢 売り手で試す (Guest Seller)
                    </Button>
                    <Button onClick={() => debugLogin('buyer')} variant="outline" size="sm" className="text-[10px] h-6 px-2 text-slate-500 border-dashed border-slate-300 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 transition-all">
                        🔵 買い手で試す (Guest Buyer)
                    </Button>
                </div>

                <Dialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-red-600">
                                <AlertCircle className="w-5 h-5" />
                                ログイン設定エラー
                            </DialogTitle>
                            <DialogDescription className="pt-2">
                                <div className="text-sm text-muted-foreground">
                                    {error}
                                    <br /><br />
                                    <span className="font-bold text-slate-700">解決手順:</span>
                                    <ol className="list-decimal list-inside mt-2 text-xs space-y-1">
                                        <li>Firebase Consoleを開く</li>
                                        <li>Authentication &gt; Sign-in methodを選択</li>
                                        <li>Googleプロバイダを「有効」にする</li>
                                    </ol>
                                </div>
                            </DialogDescription>
                        </DialogHeader>
                    </DialogContent>
                </Dialog>
            </div>
        );
    }



    return (
        <div className="relative">
            <Button
                variant="ghost"
                size="icon"
                className="text-slate-600 hover:text-violet-600"
                onClick={() => setMenuOpen(!menuOpen)}
            >
                <div className="relative">
                    <UserIcon className="w-5 h-5" />
                    {isVerified && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white"></span>
                    )}
                </div>
            </Button>

            {menuOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-lg shadow-xl p-4 z-50 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex flex-col space-y-3">
                            <div className="pb-3 border-b border-slate-100">
                                <p className="text-sm font-bold text-slate-800 truncate">{user.email}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    {isVerified ? (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                            ✅ 本人確認済み (学生)
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                                            未確認アカウント
                                        </span>
                                    )}
                                </div>
                            </div>

                            <Link
                                href="/seller/payout"
                                className="flex items-center gap-2 text-sm text-slate-600 hover:text-violet-600 p-2 hover:bg-slate-50 rounded transition-colors"
                                onClick={() => setMenuOpen(false)}
                            >
                                <span className="text-lg">💰</span>
                                売上・口座管理
                            </Link>

                            <Link
                                href="/items/create"
                                className="flex items-center gap-2 text-sm text-slate-600 hover:text-violet-600 p-2 hover:bg-slate-50 rounded transition-colors"
                                onClick={() => setMenuOpen(false)}
                            >
                                <span className="text-lg">📝</span>
                                出品する
                            </Link>

                            <Button variant="ghost" className="w-full justify-start text-red-500 text-xs h-8" onClick={() => logout()}>
                                ログアウト
                            </Button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
