import React from 'react';

export default function PrivacyPage() {
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-slate-800">プライバシーポリシー (Privacy Policy)</h1>
            <p className="text-sm text-slate-500">最終更新日: 2024年1月1日</p>

            <section>
                <h2 className="text-lg font-bold text-slate-700 mt-4 mb-2">1. 収集する情報</h2>
                <p>本サービスでは、以下の情報を収集します。</p>
                <ul className="list-disc pl-5 space-y-1">
                    <li>学内メールアドレス、氏名（Googleアカウント連携による）</li>
                    <li>学籍番号（任意入力）</li>
                    <li>取引履歴、出品情報</li>
                    <li>決済情報（Stripeを通じて処理され、当サービスでは保存しません）</li>
                </ul>
            </section>

            <section>
                <h2 className="text-lg font-bold text-slate-700 mt-4 mb-2">2. 情報の利用目的</h2>
                <ul className="list-disc pl-5 space-y-1">
                    <li>本サービスの提供および本人確認のため</li>
                    <li>取引相手への連絡先開示（取引成立時のみ）</li>
                    <li>不正利用の防止および対応のため</li>
                </ul>
            </section>

            <section>
                <h2 className="text-lg font-bold text-slate-700 mt-4 mb-2">3. 第三者への提供</h2>
                <p>法令に基づく場合を除き、ユーザーの同意なく個人情報を第三者（取引当事者を除く）に提供することはありません。</p>
            </section>
        </div>
    );
}
