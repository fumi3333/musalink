import React from 'react';

export default function TradePage() {
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-slate-800">特定商取引法に基づく表記</h1>
            <p className="text-sm text-slate-500">※本サービスは個人間取引のプラットフォームであり、運営者が販売者となるものではありませんが、サービスの運営主体として以下の通り表示します。</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-slate-200 pt-4">
                <div className="font-bold text-slate-700">サービス名</div>
                <div className="md:col-span-2">Musashino Link</div>

                <div className="font-bold text-slate-700">運営者</div>
                <div className="md:col-span-2">Musashino Link プロジェクトチーム (CS学部 学生有志)</div>

                <div className="font-bold text-slate-700">所在地</div>
                <div className="md:col-span-2">東京都江東区有明3-3-3 武蔵野大学 有明キャンパス</div>

                <div className="font-bold text-slate-700">連絡先</div>
                <div className="md:col-span-2">support@musashino-link-demo.com (Demo)</div>

                <div className="font-bold text-slate-700">利用料金</div>
                <div className="md:col-span-2">
                    現在、ベータテスト期間につきシステム利用料は無料ですが、将来的に取引ごとに手数料（例: 10%）が発生する場合があります。<br />
                    出品および会員登録は無料です。
                </div>

                <div className="font-bold text-slate-700">支払方法</div>
                <div className="md:col-span-2">クレジットカード決済 (Stripe)</div>
            </div>
        </div>
    );
}
