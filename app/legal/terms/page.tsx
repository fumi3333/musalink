import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { ScrollText, ShieldAlert, UserCheck, Gavel, FileWarning } from "lucide-react";

export default function TermsPage() {
    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-800 mb-4">利用規約 (Terms of Service)</h1>
                <p className="text-slate-600">
                    この利用規約（以下「本規約」といいます。）は、Musalink運営事務局（以下「運営」といいます。）が提供するサービス「Musalink」（以下「本サービス」といいます。）の利用条件を定めるものです。<br />
                    登録ユーザーの皆様（以下「ユーザー」といいます。）には、本規約に従って本サービスをご利用いただきます。
                </p>
                <p className="text-xs text-slate-400 mt-2 text-right">最終更新日: {new Date().toLocaleDateString()}</p>
            </div>

            <div className="space-y-6">
                {/* 第1条 */}
                <Card className="border-none shadow-sm bg-white">
                    <CardContent className="p-6">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
                            <ScrollText className="w-5 h-5 text-violet-500" />
                            第1条（適用）
                        </h2>
                        <ol className="list-decimal list-inside space-y-2 text-slate-600 text-sm leading-relaxed">
                            <li>本規約は、ユーザーと運営との間の本サービスの利用に関わる一切の関係に適用されるものとします。</li>
                            <li>運営は本サービスに関し、本規約のほか、ご利用にあたってのルール等、各種の定め（以下「個別規定」といいます。）をすることがあります。これら個別規定はその名称のいかんに関わらず、本規約の一部を構成するものとします。</li>
                            <li>本規約の規定が前項の個別規定の規定と矛盾する場合には、個別規定において特段の定めなき限り、個別規定の規定が優先されるものとします。</li>
                        </ol>
                    </CardContent>
                </Card>

                {/* 第2条 */}
                <Card className="border-none shadow-sm bg-white">
                    <CardContent className="p-6">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
                            <UserCheck className="w-5 h-5 text-violet-500" />
                            第2条（利用登録・資格）
                        </h2>
                        <ol className="list-decimal list-inside space-y-2 text-slate-600 text-sm leading-relaxed">
                            <li>本サービスの利用資格は、<b>武蔵野大学に在籍する学生および教職員</b>に限られます。</li>
                            <li>登録希望者が当社の定める方法（学内メールアドレス認証等）によって利用登録を申請し、運営がこれを承認することによって、利用登録が完了するものとします。</li>
                            <li>運営は、利用登録の申請者に以下の事由があると判断した場合、利用登録の承認をしないことがあり、その理由については一切の開示義務を負わないものとします。
                                <ul className="list-disc list-inside pl-4 mt-1 text-xs text-slate-500">
                                    <li>利用登録の申請に際して虚偽の事項を届け出た場合</li>
                                    <li>本規約に違反したことがある者からの申請である場合</li>
                                    <li>その他、運営が利用登録を相当でないと判断した場合</li>
                                </ul>
                            </li>
                        </ol>
                    </CardContent>
                </Card>

                {/* 第3条 */}
                <Card className="border-none shadow-sm bg-white">
                    <CardContent className="p-6">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
                            <ShieldAlert className="w-5 h-5 text-red-500" />
                            第3条（禁止事項）
                        </h2>
                        <p className="text-sm text-slate-600 mb-2">ユーザーは、本サービスの利用にあたり、以下の行為をしてはなりません。</p>
                        <ul className="list-disc list-inside space-y-2 text-slate-600 text-sm leading-relaxed pl-2 marker:text-red-300">
                            <li>法令または公序良俗に違反する行為</li>
                            <li>犯罪行為に関連する行為</li>
                            <li>他人の個人情報、登録情報、利用履歴情報などを不正に収集、蓄積または開示する行為</li>
                            <li>本サービスの運営を妨害するおそれのある行為（サーバーへの攻撃、不正アクセス等）</li>
                            <li>他のユーザーになりすます行為</li>
                            <li>法律、法令等により所持または売買が規制されている物品を出品する行為</li>
                            <li>授業の進行を妨げるような態様での取引または商品の受け渡し</li>
                            <li>本サービス外での決済を誘導する行為（直接取引）</li>
                            <li>その他、運営が不適切と判断する行為</li>
                        </ul>
                    </CardContent>
                </Card>

                {/* 第4条 */}
                <Card className="border-none shadow-sm bg-white">
                    <CardContent className="p-6">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
                            <FileWarning className="w-5 h-5 text-amber-500" />
                            第4条（本サービスの性質と免責）
                        </h2>
                        <ol className="list-decimal list-inside space-y-2 text-slate-600 text-sm leading-relaxed">
                            <li>本サービスは、ユーザー間の物品売買の機会を提供するプラットフォームであり、運営は自ら商品の売買を行うものではありません。</li>
                            <li>運営は、本サービスに関して、ユーザーと他のユーザーまたは第三者との間において生じた取引、連絡または紛争等について一切責任を負いません。</li>
                            <li>ユーザー間の取引は、全て自己責任において行われるものとします。商品の瑕疵、未着、代金不払い、詐欺等のトラブルについて、運営は解決の努力義務は負いますが、補償等の法的責任は負いません。</li>
                            <li>本サービスは、システム障害、メンテナンス、天災地変等の不可抗力により、予告なく停止または中断することがあります。これによりユーザーに生じた損害について、運営は一切の責任を負いません。</li>
                        </ol>
                    </CardContent>
                </Card>

                {/* 第5条 */}
                <Card className="border-none shadow-sm bg-white">
                    <CardContent className="p-6">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
                            <Gavel className="w-5 h-5 text-slate-500" />
                            第5条（準拠法・裁判管轄）
                        </h2>
                        <p className="text-sm text-slate-600 leading-relaxed">
                            本規約の解釈にあたっては、日本法を準拠法とします。<br />
                            本サービスに関して紛争が生じた場合には、運営者の所在地を管轄する裁判所を専属的合意管轄とします。
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
