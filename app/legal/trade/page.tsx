import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Mail, MapPin, User, FileText, CreditCard, ShieldCheck } from "lucide-react";

export default function TradePage() {
    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-800 mb-4">特定商取引法に基づく表記</h1>
                <p className="text-slate-600 leading-relaxed">
                    Musalink（以下「当サービス」）は、ユーザー間の物品売買を仲介するプラットフォームです。<br />
                    当サービスの運営者に関する情報は以下の通りです。なお、個々の取引における販売者は各出品者（ユーザー）となります。
                </p>
            </div>

            <Card className="border-none shadow-md overflow-hidden bg-white mb-8">
                <CardContent className="p-0">
                    <div className="divide-y divide-slate-100">
                        {/* サービス運営者 */}
                        <div className="grid grid-cols-1 md:grid-cols-4 p-6 hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-2 text-slate-500 font-bold mb-2 md:mb-0">
                                <User className="w-4 h-4" />
                                <span>販売業者・運営者</span>
                            </div>
                            <div className="md:col-span-3 text-slate-800">
                                Musalink 運営事務局<br />
                                <span className="text-xs text-slate-400">※本サービスは武蔵野大学の学生有志による開発・運営プロジェクトであり、大学法人とは直接関係ありません。</span>
                            </div>
                        </div>

                        {/* 所在地 */}
                        <div className="grid grid-cols-1 md:grid-cols-4 p-6 hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-2 text-slate-500 font-bold mb-2 md:mb-0">
                                <MapPin className="w-4 h-4" />
                                <span>所在地</span>
                            </div>
                            <div className="md:col-span-3 text-slate-800">
                                東京都江東区有明3-3-3<br />
                                <span className="text-xs text-slate-400">※運営拠点の住所です。対面での対応は行っておりません。</span>
                            </div>
                        </div>

                        {/* 連絡先 */}
                        <div className="grid grid-cols-1 md:grid-cols-4 p-6 hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-2 text-slate-500 font-bold mb-2 md:mb-0">
                                <Mail className="w-4 h-4" />
                                <span>連絡先</span>
                            </div>
                            <div className="md:col-span-3 text-slate-800">
                                <p className="mb-1">support@musalink.jp</p>
                                <p className="text-xs text-slate-500">
                                    ※お電話でのお問い合わせは受け付けておりません。上記メールアドレスまたはアプリ内のお問い合わせフォームよりご連絡ください。<br />
                                    ※特定商取引法に基づき、請求があった場合は遅滞なく電話番号を開示いたします。
                                </p>
                            </div>
                        </div>

                        {/* 販売価格 */}
                        <div className="grid grid-cols-1 md:grid-cols-4 p-6 hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-2 text-slate-500 font-bold mb-2 md:mb-0">
                                <FileText className="w-4 h-4" />
                                <span>販売価格</span>
                            </div>
                            <div className="md:col-span-3 text-slate-800">
                                各商品ページに記載された価格（税込）に基づきます。<br />
                                サービス利用料：現在はベータ版のため無料です。
                            </div>
                        </div>

                        {/* 代金以外の必要料金 */}
                        <div className="grid grid-cols-1 md:grid-cols-4 p-6 hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-2 text-slate-500 font-bold mb-2 md:mb-0">
                                <CreditCard className="w-4 h-4" />
                                <span>商品代金以外の<br className="hidden md:block"/>必要料金</span>
                            </div>
                            <div className="md:col-span-3 text-slate-800">
                                <ul className="list-disc list-inside space-y-1">
                                    <li>インターネット接続料金、通信料金（お客様負担）</li>
                                    <li>手渡しのため、原則として送料は発生しません。</li>
                                </ul>
                            </div>
                        </div>

                        {/* 支払方法 */}
                        <div className="grid grid-cols-1 md:grid-cols-4 p-6 hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-2 text-slate-500 font-bold mb-2 md:mb-0">
                                <CreditCard className="w-4 h-4" />
                                <span>支払方法・時期</span>
                            </div>
                            <div className="md:col-span-3 text-slate-800">
                                <p className="font-bold mb-1">支払方法</p>
                                <p className="mb-2">クレジットカード決済（Stripe Connectを利用）</p>
                                
                                <p className="font-bold mb-1">支払時期</p>
                                <p>取引開始時に購入者のカード枠を確保（仮売上）し、商品受け渡し完了後の「評価・取引完了」時点で決済が確定します。</p>
                            </div>
                        </div>

                        {/* 引渡時期 */}
                        <div className="grid grid-cols-1 md:grid-cols-4 p-6 hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-2 text-slate-500 font-bold mb-2 md:mb-0">
                                <ShieldCheck className="w-4 h-4" />
                                <span>商品の引渡時期</span>
                            </div>
                            <div className="md:col-span-3 text-slate-800">
                                取引成立後、出品者・購入者間で合意した日時に、指定の場所（キャンパス内等）にて手渡しで行われます。<br />
                                原則として、取引開始から1週間以内の受け渡しを推奨しています。
                            </div>
                        </div>

                        {/* 返品・キャンセル */}
                        <div className="grid grid-cols-1 md:grid-cols-4 p-6 hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-2 text-slate-500 font-bold mb-2 md:mb-0">
                                <ShieldCheck className="w-4 h-4" />
                                <span>返品・キャンセル</span>
                            </div>
                            <div className="md:col-span-3 text-slate-800">
                                <p className="font-bold mb-1">取引完了前</p>
                                <p className="mb-2">
                                    商品受け渡し前、または受け渡し時に商品に問題があった場合は、双方合意の上でアプリ内からキャンセルが可能です。<br />
                                    キャンセルが成立した場合、クレジットカードの仮売上は取り消され、代金は請求されません。
                                </p>

                                <p className="font-bold mb-1">取引完了後</p>
                                <p>
                                    原則として、取引完了（評価済み）後の返品・返金はお受けできません。<br />
                                    ただし、商品に隠れたる瑕疵（説明にない重大な欠陥）があった場合に限り、当事者間の話し合いにより解決を図るものとします。
                                </p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="text-xs text-slate-400 text-center">
                <p>最終更新日: {new Date().toLocaleDateString()}</p>
            </div>
        </div>
    );
}
