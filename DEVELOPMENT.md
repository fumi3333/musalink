# 💻 開発者向けドキュメント (Development Guide)

このドキュメントは、Musashino Link の開発環境構築手順をまとめたものです。
プロジェクトの一般向け概要は [README.md](./README.md) を参照してください。

## 1. 環境構築 (Setup)

### 必須要件
*   Node.js 18.x 以上
*   npm または pnpm
*   Firebase CLI (`npm install -g firebase-tools`)

### インストール
```bash
# リポジトリのクローン
git clone https://github.com/fumi3333/musalink.git
cd musalink

# 依存パッケージのインストール
npm install
# または
pnpm install
```

## 2. 環境変数の設定 (.env.local)
プロジェクトルートに `.env.local` ファイルを作成し、以下の変数を設定してください。
※ 実際のキーはセキュリティのため、管理者のみが保有しています。

```env
# Firebase Client SDK
NEXT_PUBLIC_FIREBASE_API_KEY=xxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxx
NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxx
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=xxx
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=xxx
NEXT_PUBLIC_FIREBASE_APP_ID=xxx

# Stripe Public Key (Test Mode)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
```

## 3. 起動 (Run)

```bash
# 開発サーバーの起動
npm run dev

# ブラウザでアクセス
http://localhost:3000
```

## 4. デプロイ (Deployment)

### Vercel (Frontend)
mainブランチへのプッシュで自動デプロイされます。

### Firebase (Backend)
Cloud Functions や Firestore Rules の更新は以下のコマンドで行います。

```bash
firebase deploy
```

## ⚠️ 注意事項 (Security)
*   **APIキーの漏洩防止**: `.env.local` や `service-account.json` は絶対にコミットしないでください。
*   **データ保護**: Firestoreのデータは本番環境のものを不用意に削除・変更しないでください。
