"use client"

import React from 'react';
import { Lock, Unlock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface RevealableContentProps {
    title?: string;
    isUnlocked: boolean;
    content: Record<string, any>;
    lockedMessage?: string;
    className?: string;
}

/**
 * 情報の段階的アンロックコンポーネント
 * 
 * isUnlocked が false の場合: ロック画面とメッセージを表示
 * isUnlocked が true の場合: content (Map) の中身を自動的にリスト展開して表示
 */
export const RevealableContent: React.FC<RevealableContentProps> = ({
    title = "Unlockable Content",
    isUnlocked,
    content,
    lockedMessage = "情報の鍵がかかっています",
    className,
}) => {
    if (!isUnlocked) {
        return (
            <Card className={cn("border-dashed border-slate-300 bg-slate-50", className)}>
                <CardContent className="flex flex-col items-center justify-center py-8 text-slate-400">
                    <Lock className="h-10 w-10 mb-3 opacity-50" />
                    <p className="font-medium text-sm">{lockedMessage}</p>
                </CardContent>
            </Card>
        );
    }

    // content Mapが空の場合のハンドリング
    if (Object.keys(content).length === 0) {
        return (
            <Card className={cn("bg-white border-slate-200", className)}>
                <CardContent className="py-6 text-center text-slate-400 text-sm">
                    情報はありません
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className={cn("bg-green-50 border-green-100 overflow-hidden", className)}>
            <CardHeader className="bg-green-100/50 py-3 px-4 border-b border-green-100">
                <CardTitle className="text-sm font-semibold text-green-800 flex items-center">
                    <Unlock className="h-4 w-4 mr-2 text-green-600" />
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <dl className="divide-y divide-green-100/50">
                    {Object.entries(content).map(([key, value]) => (
                        <div key={key} className="grid grid-cols-[1fr_2fr] sm:grid-cols-[120px_1fr] px-4 py-3 text-sm">
                            <dt className="font-medium text-green-700 truncate capitalize">
                                {key.replace(/_/g, ' ')} {/* student_id -> student id */}
                            </dt>
                            <dd className="text-green-900 break-words font-mono sm:font-sans">
                                {String(value)}
                            </dd>
                        </div>
                    ))}
                </dl>
            </CardContent>
        </Card>
    );
};
