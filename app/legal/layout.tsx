import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function LegalLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-slate-50 py-10 px-4">
            <div className="max-w-4xl mx-auto space-y-6">
                <Card className="border-slate-200 shadow-sm">
                    <CardHeader className="border-b border-slate-100 pb-4 mb-4">
                        <CardTitle className="text-xl text-slate-700">法的事項・規約</CardTitle>
                    </CardHeader>
                    <CardContent className="prose prose-slate max-w-none">
                        {children}
                    </CardContent>
                </Card>
                <div className="text-center text-xs text-slate-400">
                    &copy; 2024 Musa Project. All interactions are subject to University Guidelines.
                </div>
            </div>
        </div>
    );
}
