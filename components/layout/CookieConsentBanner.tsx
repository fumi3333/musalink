"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { initAnalyticsIfConsented } from "@/lib/firebase";

const STORAGE_KEY = "musalink_analytics_consent";

export function CookieConsentBanner() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const current = window.localStorage.getItem(STORAGE_KEY);
        if (current !== "granted" && current !== "denied") {
            setVisible(true);
        }
    }, []);

    const handle = (value: "granted" | "denied") => {
        try {
            window.localStorage.setItem(STORAGE_KEY, value);
        } catch (_) {
            // ignore (private mode etc.)
        }
        if (value === "granted") {
            initAnalyticsIfConsented();
        }
        setVisible(false);
    };

    if (!visible) return null;

    return (
        <div
            role="dialog"
            aria-live="polite"
            className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 sm:px-6 sm:pb-6"
        >
            <div className="mx-auto max-w-3xl rounded-lg bg-slate-900 text-white shadow-xl ring-1 ring-white/10">
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
                    <p className="text-sm leading-relaxed">
                        本サービスでは、サービス改善のため Google Firebase Analytics による
                        Cookie・利用状況の取得を行うことがあります。詳細は
                        <Link href="/legal/privacy" className="underline ml-1">
                            プライバシーポリシー
                        </Link>
                        をご確認ください。
                    </p>
                    <div className="flex gap-2 shrink-0">
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handle("denied")}
                        >
                            拒否
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => handle("granted")}
                        >
                            同意する
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
