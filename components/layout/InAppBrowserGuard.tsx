"use client";

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export const InAppBrowserGuard = ({ children }: { children: React.ReactNode }) => {
    const [isInAppBrowser, setIsInAppBrowser] = useState(false);
    const { user, loading } = useAuth();

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

    // Do not show guard if still checking auth state to prevent flash
    if (loading) {
        return <>{children}</>;
    }

    // Show guard if in an in-app browser, regardless of login state, 
    // because QR code camera will fail on iOS LINE.
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
                            このままでは、ログインエラーが発生したり、受け渡し時のQRコード読み取り（カメラ）が起動しない問題が発生します。
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

                    <div className="space-y-4 pt-4">
                        <Button
                            variant="destructive"
                            className="w-full font-bold"
                            onClick={() => setIsInAppBrowser(false)}
                        >
                            LINEのままで開く (非推奨)
                        </Button>
                        
                        <p className="text-xs text-slate-500 text-center">
                            ※ LINEのままだとカメラが起動せず取引が完了できない場合があります。<br/>
                            その場合は上記手順でSafari/Chromeを開いてください。
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};
