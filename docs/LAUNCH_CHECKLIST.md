# 🚀 ローンチまでに必要な工程（詳細チェックリスト）

Musalink を本番ローンチするまでに実施すべき工程を、**必須・推奨・運用準備**に分けてまとめています。  
実施したら □ を ✅ に変えて進捗を管理してください。

---

## 目次

1. [環境・デプロイの確認](#1-環境デプロイの確認)
2. [決済（Stripe）本番化](#2-決済stripe本番化)
3. [Firebase 本番設定](#3-firebase-本番設定)
4. [ドメイン・URL・SEO](#4-ドメインurlseo)
5. [法的事項・利用規約](#5-法的事項利用規約)
6. [動作確認・テスト](#6-動作確認テスト)
7. [運用・監視・サポート準備](#7-運用監視サポート準備)
8. [ローンチ当日〜直後](#8-ローンチ当日直後)

---

## 1. 環境・デプロイの確認

| # | 工程 | 詳細 | 状態 |
|---|------|------|------|
| 1.1 | **Vercel で API が動くことを確認** | `output: 'export'` は外済み。本番 URL で `/api/create-payment-intent` 等が 404 にならないか確認。決済テスト時に「Payment Intent 取得」が成功するかで判断可能。 | □ |
| 1.2 | **Vercel 環境変数の設定** | 本番用の `NEXT_PUBLIC_FIREBASE_*`、`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`、必要なら `FUNCTIONS_BASE_URL` を Vercel の Project Settings → Environment Variables に設定。 | □ |
| 1.3 | **Firebase Functions のデプロイ** | `firebase deploy --only functions` が成功していること。本番用 Stripe キー・Webhook 設定は「2. 決済本番化」と同時に実施。 | □ |
| 1.4 | **Firestore Rules のデプロイ** | `firebase deploy --only firestore:rules` で本番ルールを反映。`payout_requests` の read が `resource.data.userId == request.auth.uid` になっていることを確認済み。 | □ |

---

## 2. 決済（Stripe）本番化

| # | 工程 | 詳細 | 状態 |
|---|------|------|------|
| 2.1 | **Stripe 本番アカウントの準備** | Stripe ダッシュボードで「本番モード」に切り替え、ビジネス情報・口座情報を完了。必要に応じて審査・本人確認を完了する。 | □ |
| 2.2 | **本番キーの取得と設定** | 本番の **Publishable key**（`pk_live_...`）と **Secret key**（`sk_live_...`）を取得。Vercel に `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`、Functions に `STRIPE_SECRET_KEY`（または `firebase functions:config:set stripe.secret`）を設定。 | □ |
| 2.3 | **Stripe Connect 本番有効化** | Connect 設定で本番の「プラットフォーム」を有効化。テスト用 `acct_mock_*` は本番では使わず、実売り手は本番の Connect アカウントで受け取りできるようにする。 | □ |
| 2.4 | **Webhook 本番エンドポイントの登録** | Stripe ダッシュボードで本番用 Webhook を追加。URL: `https://us-central1-musa-link.cloudfunctions.net/stripeWebhook`。必要なイベント（例: `account.updated`, `payment_intent.succeeded` 等）を選択。 | □ |
| 2.5 | **Webhook 署名シークレットの設定** | Webhook 作成後に表示される **Signing secret**（`whsec_...`）を Functions に設定: `firebase functions:config:set stripe.webhook_secret="whsec_..."` または `functions/.env` に `STRIPE_WEBHOOK_SECRET`。 | □ |
| 2.6 | **Capture 期限の確認** | Stripe の「仮押さえ（Authorize）から Capture まで」の期限（デフォルト 7 日等）を確認。対面受け渡しが数日以内に完了する想定で問題ないか。必要ならダッシュボードで調整。 | □ |
| 2.7 | **手数料・通貨の最終確認** | 日本円（JPY）、`lib/constants.ts` の `SYSTEM_FEE`（100円）が本番方針と一致しているか。 | □ |

---

## 3. Firebase 本番設定

| # | 工程 | 詳細 | 状態 |
|---|------|------|------|
| 3.1 | **本番プロジェクトの確認** | 開発用と本番用で Firebase プロジェクトを分けている場合は、本番用プロジェクトの ID（例: `musa-link`）で Vercel の `NEXT_PUBLIC_FIREBASE_*` が一致しているか確認。 | □ |
| 3.2 | **認証の許可ドメイン** | Firebase Console → Authentication → Settings → Authorized domains に、本番ドメイン（例: `musalink.vercel.app` やカスタムドメイン）を追加。 | □ |
| 3.3 | **Functions の環境変数・Config** | 本番用 `STRIPE_SECRET_KEY`、`STRIPE_WEBHOOK_SECRET`、必要に応じてメール送信用の設定を Functions に渡しているか。`functions.config()` は 2026 年 3 月までに params への移行が推奨。 | □ |
| 3.4 | **Firestore インデックス** | 本番で「カテゴリー検索」や複合クエリを使う場合、初回実行時にコンソールに表示されるインデックス作成リンクから必要なインデックスを作成。 | □ |
| 3.5 | **Storage ルール（画像アップロード）** | 出品時の画像アップロードに Storage を使っている場合、本番用の Storage セキュリティルールがデプロイされているか確認。 | □ |

---

## 4. ドメイン・URL・SEO

| # | 工程 | 詳細 | 状態 |
|---|------|------|------|
| 4.1 | **本番 URL の確定** | 現状は `https://musalink.vercel.app`。カスタムドメイン（例: `musa.musashino-u.ac.jp`）を使う場合は Vercel でドメイン追加・DNS 設定。 | □ |
| 4.2 | **OGP・メタ情報** | `app/layout.tsx` 等の metadata（title, description）が本番向けの文言になっているか。SNS でシェアしたときのプレビュー用 OGP 画像があるとよい。 | □ |
| 4.3 | **利用規約・プライバシー・特商法の URL** | フッターや取引開始前の同意画面から正しい URL（`/legal/terms` 等）にリンクしているか。 | □ |

---

## 5. 法的事項・利用規約

| # | 工程 | 詳細 | 状態 |
|---|------|------|------|
| 5.1 | **利用規約の最終確認** | `app/legal/terms/page.tsx` の内容を、学内サービス・Stripe 決済・個人情報の取り扱いと整合させる。必要なら大学の法務・学生支援課に確認。 | □ |
| 5.2 | **プライバシーポリシー** | 収集するデータ（学籍情報・メール・取引履歴等）と利用目的・第三者提供の有無を明記。 | □ |
| 5.3 | **特定商取引法に基づく表記** | `app/legal/trade/page.tsx` に、販売業者名・連絡先・返金ポリシー等を本番に合わせて記載。 | □ |
| 5.4 | **取引開始前の同意** | 購入リクエストや決済前に「利用規約・免責に同意する」チェックが必須になっているか（実装済みの場合は確認のみ）。 | □ |

---

## 6. 動作確認・テスト

| # | 工程 | 詳細 | 状態 |
|---|------|------|------|
| 6.1 | **学内アカウントでのログイン** | `@stu.musashino-u.ac.jp` でログインできるか。学外メールでは弾かれるか。 | □ |
| 6.2 | **出品フロー** | カテゴリー選択・画像・価格入力 → 出品 → 一覧に表示されるか。Firestore インデックスエラーが出たらコンソールのリンクから作成。 | □ |
| 6.3 | **購入リクエスト〜承認** | 購入リクエスト送信 → 売り手が承認。利用規約同意が必須になっているか。 | □ |
| 6.4 | **決済フロー（本番 or テスト）** | 承認後「支払う」→ Payment Intent 取得 → カード入力 → 仮押さえ → 取引が `payment_pending` になるか。本番前に Stripe テストモードで一通り実施推奨。 | □ |
| 6.5 | **受け渡し〜Capture** | QR スキャンまたは「受取確認」→ `capturePayment` が成功し、取引が `completed` になるか。学籍番号・メールがアンロック表示されるか。 | □ |
| 6.6 | **キャンセル・返金** | 取引キャンセルで Payment Intent が cancel/refund され、取引が `cancelled` になるか。 | □ |
| 6.7 | **売り手：Stripe Connect 連携** | 振込ページから Connect アカウント作成・ログインリンクが動作するか。本番では KYC 完了後に `charges_enabled` が true になるか。 | □ |
| 6.8 | **チャット・通知** | 取引中のチャット、取引・メッセージに応じた通知が届くか。 | □ |
| 6.9 | **管理画面** | `/admin` に管理者のみアクセスできるか。取引一覧・強制キャンセルが動作するか。 | □ |
| 6.10 | **スマートフォンでの表示・操作** | 実機で一覧・詳細・決済・QR 読み取りが問題なく動くか。InAppBrowserGuard で LINE 内ブラウザ等の注意表示が出るか。 | □ |

---

## 7. 運用・監視・サポート準備

| # | 工程 | 詳細 | 状態 |
|---|------|------|------|
| 7.1 | **管理者の権限** | Firestore のカスタムクレームや Admin フラグで、管理画面にアクセスできるユーザーを限定しているか。 | □ |
| 7.2 | **エラー監視** | Vercel のログ・Firebase Functions のログを定期的に確認するか。必要なら Sentry 等のエラー監視を導入。 | □ |
| 7.3 | **問い合わせ窓口** | 利用規約・フッターに「お問い合わせ」先（メール等）を記載。学内なら学生支援課や開発者連絡先を明示。 | □ |
| 7.4 | **トラブル時の手順** | MANUAL.md の「トラブル時の対応」を運用者と共有。決済確定後の返金は Stripe ダッシュボードから行うことを把握。 | □ |
| 7.5 | **バックアップ・データ** | Firestore のエクスポートや重要データのバックアップ方針を決めておく（任意）。 | □ |

---

## 8. ローンチ当日〜直後

| # | 工程 | 詳細 | 状態 |
|---|------|------|------|
| 8.1 | **Stripe を本番モードに切り替え** | 本番用キーを Vercel / Functions に設定済みであることを再確認。テストキーが本番に残っていないか。 | □ |
| 8.2 | **最終デプロイ** | `git push origin main` で Vercel がビルド。Functions は `firebase deploy --only functions` で必要に応じて再デプロイ。 | □ |
| 8.3 | **学内への案内** | 学内メール・掲示・SNS 等で「Musalink ローンチ」と URL・利用方法を案内。学内ドメイン必須であることを明記。 | □ |
| 8.4 | **初回利用者のサポート** | 最初の数日は問い合わせや不具合にすぐ対応できる体制があるとよい。 | □ |
| 8.5 | **監視** | デプロイ直後は Vercel / Firebase のログや Stripe ダッシュボードでエラー・不審な取引がないか確認。 | □ |

---

## 補足：既に対応済みの項目

- **output: 'export'** … 削除済み。Vercel で API Routes が動作する構成。
- **payout_requests の read ルール** … `resource.data.userId == request.auth.uid` で修正済み。
- **Unlock 時の個人情報** … Functions で `users/{id}/private_data/profile` から取得して `unlocked_assets` に保存する設計。
- **学内ドメイン制限** … Firestore Rules の `isVerifiedStudent()` で items/transactions の create/update を制限。

---

## 参考ドキュメント

| ファイル | 内容 |
|----------|------|
| [README.md](../README.md) | プロジェクト概要・本番 URL |
| [MANUAL.md](../MANUAL.md) | ユーザー向け・管理者向け・開発者向けガイド |
| [SECURITY_AND_FEEDBACK.md](./SECURITY_AND_FEEDBACK.md) | セキュリティ対応・フィードバック反映状況 |
| [DEVELOPMENT.md](../DEVELOPMENT.md) | 開発環境・デプロイ手順 |
| [CODE_SUMMARY.md](../CODE_SUMMARY.md) | コード全体・決済まわりのまとめ |

---

*Document Version: 1.0 | ローンチ前チェックリスト*
