import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Lock, Eye, Share2, Server, ShieldCheck } from "lucide-react";

export default function PrivacyPage() {
    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-800 mb-4">プライバシーポリシー</h1>
                <p className="text-slate-600">
                    Musalink（以下「当サービス」）は、本ウェブサイト上で提供するサービス（以下「本サービス」）における、ユーザーの個人情報の取扱いについて、以下のとおりプライバシーポリシー（以下「本ポリシー」）を定めます。
                </p>
                <p className="text-xs text-slate-400 mt-2 text-right">最終更新日: {new Date().toLocaleDateString()}</p>
            </div>

            <div className="space-y-6">
                {/* 第1条 */}
                <Card className="border-none shadow-sm bg-white">
                    <CardContent className="p-6">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
                            <Eye className="w-5 h-5 text-blue-500" />
                            第1条（収集する情報）
                        </h2>
                        <p className="text-sm text-slate-600 mb-2">当サービスは、ユーザーが本サービスを利用する際に、以下の情報を取得・収集します。</p>
                        <ul className="list-disc list-inside space-y-2 text-slate-600 text-sm leading-relaxed pl-2">
                            <li>認証情報（Googleアカウント連携によるメールアドレス、氏名、プロフィール画像）</li>
                            <li>プロフィール情報（ニックネーム、所属キャンパス、学部、興味タグ等）</li>
                            <li>取引情報（出品データ、購入履歴、取引チャットの内容）</li>
                            <li>アクセスログ（IPアドレス、利用日時、デバイス情報等）</li>
                            <li>
                                <span className="font-bold text-slate-700">注意:</span> クレジットカード情報は決済代行会社（Stripe）が直接取り扱い、当サービスのサーバーには保存されません。
                            </li>
                        </ul>
                    </CardContent>
                </Card>

                {/* 第2条 */}
                <Card className="border-none shadow-sm bg-white">
                    <CardContent className="p-6">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
                            <Server className="w-5 h-5 text-blue-500" />
                            第2条（利用目的）
                        </h2>
                        <p className="text-sm text-slate-600 mb-2">収集した情報は、以下の目的で利用します。</p>
                        <ol className="list-decimal list-inside space-y-2 text-slate-600 text-sm leading-relaxed">
                            <li>本サービスの提供・運営（ログイン認証、マッチング機能等）のため</li>
                            <li>ユーザーからのお問い合わせへの対応のため</li>
                            <li>利用規約に違反する行為（スパム、不正取引等）の防止・対応のため</li>
                            <li>重要なお知らせ（メンテナンス情報等）の通知のため</li>
                            <li>個人を特定できない形での統計データ作成のため</li>
                        </ol>
                    </CardContent>
                </Card>

                {/* 第3条 */}
                <Card className="border-none shadow-sm bg-white">
                    <CardContent className="p-6">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
                            <Share2 className="w-5 h-5 text-blue-500" />
                            第3条（第三者提供）
                        </h2>
                        <p className="text-sm text-slate-600 mb-2">
                            当サービスは、次に掲げる場合を除いて、あらかじめユーザーの同意を得ることなく、第三者に個人情報を提供することはありません。
                        </p>
                        <ul className="list-disc list-inside space-y-2 text-slate-600 text-sm leading-relaxed pl-2">
                            <li>法令に基づく場合（警察、裁判所等からの照会）</li>
                            <li>人の生命、身体または財産の保護のために必要がある場合であって、本人の同意を得ることが困難であるとき</li>
                            <li>公衆衛生の向上または児童の健全な育成の推進のために特に必要がある場合</li>
                            <li>
                                <b>取引成立時における相手方への開示:</b><br/>
                                <span className="text-xs text-slate-500 ml-5 block">
                                    本サービスは個人間取引を仲介する性質上、取引が成立（マッチング）した段階で、取引相手（出品者または購入者）に対して、
                                    必要最小限のユーザー情報（氏名、ニックネーム等）を開示します。<br/>
                                    ※住所や電話番号、メールアドレスは、当事者間で合意のもと自発的に交換しない限り、システムから自動的に開示されることはありません。
                                </span>
                            </li>
                        </ul>
                    </CardContent>
                </Card>

                {/* 第4条 */}
                <Card className="border-none shadow-sm bg-white">
                    <CardContent className="p-6">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
                            <ShieldCheck className="w-5 h-5 text-blue-500" />
                            第4条（安全管理措置）
                        </h2>
                        <p className="text-sm text-slate-600 leading-relaxed">
                            当サービスは、個人情報の漏洩、滅失または毀損の防止その他の個人情報の安全管理のために必要かつ適切な措置を講じます。<br />
                            また、個人情報はFirebase（Google Cloud）のセキュアな環境で管理され、アクセス権限の管理を徹底します。
                        </p>
                    </CardContent>
                </Card>

                {/* 第5条 */}
                <Card className="border-none shadow-sm bg-white">
                    <CardContent className="p-6">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
                            <Lock className="w-5 h-5 text-blue-500" />
                            第5条（お問い合わせ）
                        </h2>
                        <p className="text-sm text-slate-600 leading-relaxed">
                            本ポリシーに関するお問い合わせは、以下の窓口までお願いいたします。<br />
                            <br />
                            Musalink 運営事務局<br />
                            E-mail: support@musalink.jp
                            <span className="text-xs text-slate-400 block mt-1">※大学の事務窓口へのお問い合わせはご遠慮ください。</span>
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
