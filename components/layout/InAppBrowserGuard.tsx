"use client";

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

export const InAppBrowserGuard = ({ children }: { children: React.ReactNode }) => {
    const [isInAppBrowser, setIsInAppBrowser] = useState(false);

    useEffect(() => {
        // Detect common in-app browsers (LINE, Instagram, Facebook, TikTok)
        const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
        const isLine = /Line/i.test(ua);
        const isInstagram = /Instagram/i.test(ua);
        const isFacebook = /FBAN|FBAV/i.test(ua);
        const isTikTok = /TikTok/i.test(ua);

        if (isLine || isInstagram || isFacebook || isTikTok) {
            setIsInAppBrowser(true);
        }
    }, []);

    if (isInAppBrowser) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 text-center">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full space-y-6">
                    <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto">
                        <ExternalLink className="w-8 h-8 text-orange-600" />
                    </div>

                    <h2 className="text-xl font-bold text-slate-800">
                        ブラウザを変更してください
                    </h2>

                    <div className="text-slate-600 text-sm space-y-4 text-left p-4 bg-slate-50 rounded-lg">
                        <p>
                            現在、LINEやInstagramなどのアプリ内ブラウザを使用されています。
                        </p>
                        <p className="font-bold text-red-500">
                            Googleのセキュリティ制限により、このままではログインできません。
                        </p>
                    </div>

                    <div className="space-y-4">
                        <p className="text-sm font-bold text-slate-800">
                            👇 手順 (右上のメニューから選択)
                        </p>
                        <div className="flex flex-col gap-2 text-sm text-slate-600 border border-slate-200 rounded-lg p-2">
                            <div className="flex items-center gap-2">
                                <span className="bg-slate-200 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                                <span>右上の <span className="font-bold">「...」</span> または <span className="font-bold">シェア</span> をタップ</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="bg-slate-200 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                                <span><span className="font-bold">「デフォルトのブラウザで開く」</span> を選択</span>
                            </div>
                        </div>
                    </div>

                    <Button
                        className="w-full font-bold"
                        onClick={() => window.location.href = window.location.href}
                    >
                        再読み込み
                    </Button>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};
