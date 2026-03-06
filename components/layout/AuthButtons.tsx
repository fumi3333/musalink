"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { User as UserIcon, LogIn, AlertCircle, Bell } from 'lucide-react';
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
    const { user, userData, login, logout, loading, error, unreadNotifications } = useAuth();
    const [showErrorDialog, setShowErrorDialog] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    // Watch for errors returned by useAuth
    React.useEffect(() => {
        if (error) {
            setShowErrorDialog(true);
        }
    }, [error]);

    const isVerified = user?.email?.endsWith('@stu.musashino-u.ac.jp');

    if (loading) return <div className="text-xs text-slate-400 px-2">読み込み中...</div>;

    if (!user) {
        // ... (Guest Buttons kept same)
        return (
            <div className="flex gap-2">
                <Button
                    onClick={async () => {
                        if (isLoggingIn) return;
                        setIsLoggingIn(true);
                        try {
                            await login();
                        } finally {
                            setIsLoggingIn(false);
                        }
                    }}
                    disabled={isLoggingIn}
                    variant="default"
                    size="sm"
                    className="bg-violet-600 text-white font-bold"
                >
                    <LogIn className="w-4 h-4 mr-2" />
                    {isLoggingIn ? "ログイン中..." : "ログイン"}
                </Button>



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
                                    {(error && error.includes("設定")) && (
                                        <>
                                            <span className="font-bold text-slate-700">解決手順:</span>
                                            <ol className="list-decimal list-inside mt-2 text-xs space-y-1">
                                                <li>Firebase Consoleを開く</li>
                                                <li>認証 &gt; サインイン方法を選択</li>
                                                <li>Googleプロバイダを「有効」にする</li>
                                            </ol>
                                        </>
                                    )}
                                </div>
                            </DialogDescription>
                        </DialogHeader>
                    </DialogContent>
                </Dialog>
            </div>
        );
    }



    return (
        <div className="flex items-center gap-4">


            {/* Notification Bell */}
            <Link href="/notifications">
                <Button variant="ghost" size="icon" className="text-slate-600 hover:text-violet-600 relative">
                    <Bell className="w-5 h-5" />
                    {unreadNotifications > 0 && (
                        <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                    )}
                </Button>
            </Link>

            {/* User Menu Toggle */}
            <Button
                variant="ghost"
                size="sm"
                className="text-slate-600 hover:text-violet-600 gap-2 px-2"
                onClick={() => setMenuOpen(!menuOpen)}
            >
                                {/* Show Nickname or Masked Email on Desktop */}
                <span className="hidden md:inline-block text-xs font-bold text-slate-700 max-w-[150px] truncate">
                    {userData?.display_name || user.displayName || "ゲスト"}
                </span>

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
                                <p className="text-sm font-bold text-slate-800 truncate">{userData?.display_name || user.displayName || "ゲスト"}</p>
                                <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    {isVerified ? (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                            ✅ 本人確認済み
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                                            未確認
                                        </span>
                                    )}
                                </div>
                            </div>

                            <Link
                                href="/mypage"
                                className="flex items-center gap-2 text-sm text-slate-700 font-bold hover:text-violet-600 p-2 hover:bg-slate-50 rounded transition-colors"
                                onClick={() => setMenuOpen(false)}
                            >
                                <span className="text-lg">🏠</span>
                                マイページ
                            </Link>

                            <Link
                                href="/mypage?tab=selling"
                                className="flex items-center gap-2 text-sm text-slate-600 hover:text-violet-600 p-2 hover:bg-slate-50 rounded transition-colors"
                                onClick={() => setMenuOpen(false)}
                            >
                                <span className="text-lg">🏷️</span>
                                出品した商品
                            </Link>

                            <Link
                                href="/mypage?tab=purchase"
                                className="flex items-center gap-2 text-sm text-slate-600 hover:text-violet-600 p-2 hover:bg-slate-50 rounded transition-colors"
                                onClick={() => setMenuOpen(false)}
                            >
                                <span className="text-lg">📦</span>
                                取引一覧
                            </Link>

                            <Link
                                href="/items/create"
                                className="flex items-center gap-2 text-sm text-slate-600 hover:text-violet-600 p-2 hover:bg-slate-50 rounded transition-colors"
                                onClick={() => setMenuOpen(false)}
                            >
                                <span className="text-lg">📷</span>
                                出品する
                            </Link>

                            <Link
                                href="/seller/payout"
                                className="flex items-center gap-2 text-sm text-slate-600 hover:text-violet-600 p-2 hover:bg-slate-50 rounded transition-colors"
                                onClick={() => setMenuOpen(false)}
                            >
                                <span className="text-lg">💰</span>
                                売上・口座管理
                            </Link>

                            <Link
                                href="/notifications"
                                className="flex items-center gap-2 text-sm text-slate-600 hover:text-violet-600 p-2 hover:bg-slate-50 rounded transition-colors"
                                onClick={() => setMenuOpen(false)}
                            >
                                <span className="text-lg">🔔</span>
                                お知らせ
                                {unreadNotifications > 0 && (
                                    <span className="ml-auto bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5">
                                        {unreadNotifications}
                                    </span>
                                )}
                            </Link>

                            <div className="border-t border-slate-100 pt-2">
                                <Button variant="ghost" className="w-full justify-start text-red-500 text-xs h-8" onClick={() => logout()}>
                                    ログアウト
                                </Button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
