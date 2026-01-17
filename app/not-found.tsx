import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FileQuestion } from 'lucide-react';

export default function NotFound() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4 text-center">
            <div className="bg-white p-8 rounded-full shadow-sm mb-6">
                <FileQuestion className="h-16 w-16 text-slate-300" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">ページが見つかりません</h2>
            <p className="text-slate-500 mb-8 max-w-sm">
                お探しのページは削除されたか、URLが間違っている可能性があります。
            </p>
            <Link href="/">
                <Button className="font-bold bg-violet-600 hover:bg-violet-700">
                    トップページに戻る
                </Button>
            </Link>
        </div>
    );
}
