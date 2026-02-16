
import Link from 'next/link';

export function Footer() {
    return (
        <footer className="bg-white border-t py-8 mt-12 text-sm text-slate-500">
            <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex gap-4">
                    <Link href="/legal/terms" className="hover:text-purple-600 transition-colors">
                        利用規約
                    </Link>
                    <Link href="/legal/privacy" className="hover:text-purple-600 transition-colors">
                        プライバシーポリシー
                    </Link>
                    <Link href="/legal/trade" className="hover:text-purple-600 transition-colors">
                        特定商取引法に基づく表記
                    </Link>
                    <a href="https://forms.google.com/your-form-id" target="_blank" rel="noopener noreferrer" className="hover:text-purple-600 transition-colors">
                        お問い合わせ
                    </a>

                </div>
                <div>
                    &copy; 2026 Musa Project
                </div>
            </div>
        </footer>
    );
}
