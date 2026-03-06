# Musalink Production Implementation Roadmap

本番環境（Live Mode）へ移行し、実際のクレジットカード決済を開始するために必要なAPIキーと手順のチェックリストです。

## 1. 必要な API キー・シークレット一覧

以下のキーを Stripe ダッシュボードおよび Firebase Console から取得してください。

### Stripe (Live Mode)
> [!IMPORTANT]
> 「テストモード」をオフにし、本番環境のキーを取得してください。`sk_test_` ではなく `sk_live_` で始まるものです。

| キー名 | 種類 | 取得場所 | 用途 |
| :--- | :--- | :--- | :--- |
| `STRIPE_SECRET_KEY` | Secret | Stripe > 開発者 > APIキー | バックエンド (Functions) での決済処理 |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Public | Stripe > 開発者 > APIキー | フロントエンド (Vercel) でのフォーム表示 |
| `STRIPE_WEBHOOK_SECRET` | Secret | Stripe > 開発者 > Webhook | 決済完了通知の受信検証用 |
| `STRIPE_CONNECT_CLIENT_ID` | Public | Stripe > Connect > 設定 | セラー（学生）の連携用 |

### Firebase (Production)
| キー名 | 取得場所 | 用途 |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | プロジェクト設定 > 全般 | フロントエンドの Firebase 初期化 |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | プロジェクト設定 > 全般 | プロジェクトの特定 |
| (その他共通設定) | プロジェクト設定 | 各種 Firebase SDK の動作用 |

---

## 2. 移行手順ステップバイステップ

### ステップ 1: Stripe Connect の設定（本番）
1. **Connect 設定の更新**: [Stripe Connect 設定](https://dashboard.stripe.com/settings/connect) で、プラットフォームの名称、アイコン、色などを設定します。
2. **OAuth 設定**: `Redirect URI` に本番ドメイン（例: `https://musalink.vercel.app/seller/payout`）を追加します。

### ステップ 2: 環境変数の設定 (Vercel / Frontend)
[Vercel Dashboard](https://vercel.com/) のプロジェクト設定 > Environment Variables で以下を追加・更新します。
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_FIREBASE_API_KEY` 等 (Firebase Config一式)
- `NEXT_PUBLIC_APP_URL` : 本番サイトの URL

### ステップ 3: 環境変数の設定 (Firebase Functions)
以下のコマンドでバックエンドに本番用の秘密鍵を書き込みます。
```bash
# Stripe シークレットキーの設定
firebase functions:secrets:set STRIPE_SECRET_KEY

# Webhook シークレットの設定 (ステップ4で作成後)
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET

# その他の設定 (必要に応じて)
firebase functions:config:set app.url="https://your-production-url.com"
```

### ステップ 4: Webhook の作成
1. [Stripe Webhook 設定](https://dashboard.stripe.com/webhooks) で「エンドポイントを追加」をクリック。
2. **エンドポイントURL**: `https://<YOUR_REGION>-<YOUR_PROJECT_ID>.cloudfunctions.net/stripeWebhook`
3. **送信イベント**: `payment_intent.succeeded`, `account.updated` を選択。
4. 発行された `whsec_...` をステップ3で Functions に設定します。

### ステップ 5: デプロイと最終テスト
1. **Functions デプロイ**: `firebase deploy --only functions`
2. **Frontend デプロイ**: `git push origin main`
3. **少額テスト**: 実際に 100 円の商品を作成し、自分自身（またはテスト協力者）の**本番カード**で決済が完了し、ステータスが「完了」になるか確認してください。

---

## 3. 注意事項
- **本人確認 (KYC)**: セラー（学生）が売上を受け取るには、Stripe Connect 上で本人確認書類の提出が必要になります。あらかじめ「よくある質問」などでユーザーに案内しておくことを推奨します。
- **特定商取引法の表記**: `app/legal/trade/page.tsx` に記載した「運営者情報（氏名、住所、電話番号）」が正しく表示されているか再確認してください。これは法律上の義務です。
