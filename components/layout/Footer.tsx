
import Link from 'next/link';

export function Footer() {
    return (
        <footer className="bg-white border-t py-8 mt-12 text-sm text-slate-500">
            <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex gap-4">
                    <Link href="/legal/terms" className="hover:text-purple-600 transition-colors">
                        利用規約
                    </Link>
                    <Link href="/guide" className="hover:text-purple-600 transition-colors">
                        ご利用ガイド・よくある質問
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
                <div className="text-center md:text-right">
                    <p className="font-bold text-xs text-slate-400 mb-1">
                        ※本サービスは武蔵野大学の学生有志による非公式プロジェクトです。<br />
                        大学公式のサービスではありません。
                    </p>
                    &copy; 2026 Musalink
                </div>
            </div>
            <div className="container mx-auto px-4 mt-8 pb-4 border-t border-slate-100 pt-4">
                <p className="text-[10px] text-slate-400 text-center leading-relaxed">
                    運営者は、本サービスの利用により発生したユーザー間のトラブル（金銭トラブル、商品の瑕疵、対人トラブル等を含むがこれに限らない）について、一切の責任を負いません。<br />
                    全ての取引は、ユーザー自身の責任と判断において行ってください。トラブルが発生した場合は当事者間で誠意を持って解決してください。
                </p>
            </div>
        </footer>
    );
}
