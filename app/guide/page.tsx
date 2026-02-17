"use client";

import React from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import Link from 'next/link';

export default function GuidePage() {
    return (
        <div className="container mx-auto px-4 py-8 max-w-3xl">
            <h1 className="text-3xl font-bold text-slate-900 mb-6">ご利用ガイド・よくある質問</h1>
            
            <section className="mb-10">
                <h2 className="text-xl font-bold text-violet-700 mb-4 border-b border-violet-100 pb-2">📦 購入について</h2>
                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="item-1">
                        <AccordionTrigger>購入の流れを教えてください</AccordionTrigger>
                        <AccordionContent className="space-y-2">
                            <ol className="list-decimal pl-5 space-y-1">
                                <li>欲しい商品を見つけたら「購入リクエスト」を送ります。</li>
                                <li>出品者がリクエストを承認すると、通知が届きます。</li>
                                <li>通知から支払い画面へ進み、クレジットカード(Stripe)で支払いを完了させてください。</li>
                                <li>キャンパス内で出品者から商品を受け取ります。</li>
                                <li>商品を確認し、その場で「受取完了」操作を行って取引終了です。</li>
                            </ol>
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-2">
                        <AccordionTrigger>支払い方法は何がありますか？</AccordionTrigger>
                        <AccordionContent>
                            現在はクレジットカード決済（Visa, Mastercard, Amex, JCB等）のみ対応しています。<br />
                            決済は安全なStripeプラットフォームを通じて行われます。
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </section>

            <section className="mb-10">
                <h2 className="text-xl font-bold text-amber-600 mb-4 border-b border-amber-100 pb-2">🏷️ 出品・売上について</h2>
                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="sell-1">
                        <AccordionTrigger>出品手数料はかかりますか？</AccordionTrigger>
                        <AccordionContent>
                            現在はベータ版のため、手数料は無料キャンペーン中です。<br />
                            (将来的にシステム利用料が発生する可能性があります)
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="sell-2">
                        <AccordionTrigger>売上はいつ振り込まれますか？</AccordionTrigger>
                        <AccordionContent>
                            <p className="mb-2">Musalinkでは、Stripe Connectを利用して<strong>ご登録の銀行口座へ直接振り込まれます</strong>。</p>
                            <p>アプリ内に残高が溜まることはありません。通常、取引完了から3〜7営業日程度でStripeから入金されます。</p>
                            <p className="text-xs text-slate-500 mt-2">※初回のみ本人確認(KYC)の手続きが必要になる場合があります。</p>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </section>

            <section className="mb-10">
                <h2 className="text-xl font-bold text-slate-700 mb-4 border-b border-slate-100 pb-2">❓ トラブル・その他</h2>
                <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="other-1">
                        <AccordionTrigger>取引相手と連絡が取れません</AccordionTrigger>
                        <AccordionContent>
                            取引詳細画面の「チャット」機能を使ってメッセージ送ってください。<br />
                            それでも返信がない場合は、運営までお問い合わせください。
                        </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="other-2">
                        <AccordionTrigger>退会したいです</AccordionTrigger>
                        <AccordionContent>
                            マイページの下部にある「退会する」ボタンから手続きを行ってください。<br />
                            ※進行中の取引がある場合は退会できません。
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </section>

            <div className="bg-slate-50 p-6 rounded-xl text-center">
                <p className="text-slate-600 mb-4">解決しない場合はこちら</p>
                <Button variant="outline" asChild>
                    <a href="https://forms.google.com/your-form-id" target="_blank" rel="noopener noreferrer">
                        運営にお問い合わせ
                    </a>
                </Button>
            </div>
        </div>
    );
}
