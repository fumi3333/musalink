import React from 'react';

export default function TermsPage() {
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-slate-800">利用規約 (Terms of Service)</h1>
            <p className="text-sm text-slate-500">最終更新日: 2024年1月1日</p>

            <section>
                <h2 className="text-lg font-bold text-slate-700 mt-4 mb-2">1. サービスの目的</h2>
                <p>Musa（以下「本サービス」）は、武蔵野大学の学生間における教科書および学用品の売買を支援するマッチングプラットフォームです。</p>
            </section>

            <section>
                <h2 className="text-lg font-bold text-slate-700 mt-4 mb-2">2. 利用資格</h2>
                <p>本サービスを利用できるのは、武蔵野大学に在籍し、有効な学内メールアドレス（@stu.musashino-u.ac.jp）を所有する学生に限られます。</p>
            </section>

            <section>
                <h2 className="text-lg font-bold text-slate-700 mt-4 mb-2">3. 禁止事項</h2>
                <ul className="list-disc pl-5 space-y-1">
                    <li>虚偽の情報を登録する行為</li>
                    <li>公序良俗に反する商品の出品</li>
                    <li>授業内での不適切な受け渡し行為</li>
                    <li>その他、大学の定める学生規則に違反する行為</li>
                </ul>
            </section>

            <section>
                <h2 className="text-lg font-bold text-slate-700 mt-4 mb-2">4. 免責事項</h2>
                <p>本サービスは取引の場を提供するものであり、ユーザー間のトラブル（商品の瑕疵、未着、代金不払い等）について、運営者は一切の責任を負いません。取引は自己責任で行ってください。</p>
            </section>
        </div>
    );
}
