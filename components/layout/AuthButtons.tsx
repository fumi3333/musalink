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
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const AuthButtons = () => {
    const { user, userData, login, logout, loading, error, clearError, unreadNotifications } = useAuth();
    const [showErrorDialog, setShowErrorDialog] = useState(false);
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    // Watch for errors returned by useAuth
    React.useEffect(() => {
        if (error) {
            setShowErrorDialog(true);
        }
    }, [error]);

    // ダイアログを閉じた時にエラー state もクリア（次の試行で古いエラーを表示しない）
    const handleDialogChange = (open: boolean) => {
        setShowErrorDialog(open);
        if (!open) clearError();
    };

    const isVerified = user?.email?.endsWith('@stu.musashino-u.ac.jp') || userData?.is_verified === true;

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



                <Dialog open={showErrorDialog} onOpenChange={handleDialogChange}>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-red-600">
                                <AlertCircle className="w-5 h-5" />
                                ログインに失敗しました
                            </DialogTitle>
                            <DialogDescription className="pt-2 text-sm text-muted-foreground">
                                {error}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="text-sm text-slate-700 space-y-3">
                            <div className="bg-amber-50 border border-amber-200 rounded p-3">
                                <p className="font-bold text-amber-800 mb-1">📱 LINE / Instagram 内ブラウザの場合</p>
                                <p className="text-xs">
                                    画面右上の「…」メニュー → 「Safari / Chrome で開く」を選んでください。
                                </p>
                            </div>
                            {error && error.includes("設定") && (
                                <div className="bg-slate-50 border border-slate-200 rounded p-3">
                                    <p className="font-bold text-slate-700 mb-1">⚙️ サポート向け（管理者向け）</p>
                                    <ol className="list-decimal list-inside text-xs space-y-1">
                                        <li>Firebase Console を開く</li>
                                        <li>Authentication &gt; Sign-in method</li>
                                        <li>Google プロバイダを「有効」にする</li>
                                    </ol>
                                </div>
                            )}
                        </div>
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

            {/* User Menu — Radix DropdownMenu でポータル経由レンダリングするため外クリックで確実に閉じる */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-600 hover:text-violet-600 gap-2 px-2"
                    >
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
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-64 p-3">
                    {/* ユーザー情報ヘッダー */}
                    <div className="pb-3 mb-1 border-b border-slate-100">
                        <p className="text-sm font-bold text-slate-800 truncate">
                            {userData?.display_name || user.displayName || "ゲスト"}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
                        <div className="mt-1">
                            {isVerified ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                    ✅ 本人確認済み
                                </span>
                            ) : (
                                <Link href="/verify">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 cursor-pointer hover:bg-amber-200">
                                        ⚠️ 在学確認が必要
                                    </span>
                                </Link>
                            )}
                        </div>
                    </div>

                    <DropdownMenuItem asChild>
                        <Link href="/mypage" className="flex items-center gap-2 cursor-pointer">
                            <span>🏠</span> マイページ
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <Link href="/mypage?tab=selling" className="flex items-center gap-2 cursor-pointer">
                            <span>🏷️</span> 出品した商品
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <Link href="/mypage?tab=purchase" className="flex items-center gap-2 cursor-pointer">
                            <span>📦</span> 取引一覧
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <Link href="/items/create" className="flex items-center gap-2 cursor-pointer">
                            <span>📷</span> 出品する
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <Link href="/seller/payout" className="flex items-center gap-2 cursor-pointer">
                            <span>💰</span> 売上・口座管理
                        </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                        <Link href="/notifications" className="flex items-center gap-2 cursor-pointer">
                            <span>🔔</span> お知らせ
                            {unreadNotifications > 0 && (
                                <span className="ml-auto bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5">
                                    {unreadNotifications}
                                </span>
                            )}
                        </Link>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        className="text-red-500 cursor-pointer focus:text-red-500 focus:bg-red-50"
                        onClick={() => logout()}
                    >
                        ログアウト
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
};
