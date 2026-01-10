# 🦅 Musashino Link (武蔵野リンク)

## 概要 (Overview)
**武蔵野大学 学生専用の教科書売買プラットフォーム**です。
学内での教科書や授業用アイテムの循環を促進し、安価で安全な取引環境を提供することを目的としています。

### 🌟 主な特徴
1.  **学内限定の安心感**: 武蔵野大学のGoogleアカウント(`@stu.musashino-u.ac.jp`)でのみ利用可能です。
2.  **安全な決済 (Stripe)**: 現金の直接やり取りではなく、Stripe Connectを用いたエスクロー決済を採用。トラブルを防ぎます。
3.  **講義・学科検索**: 授業名や先生の名前、学科タグから必要な教科書をすぐに見つけられます。
4.  **ISBN自動入力**: Google Books APIと連携し、ISBNコードを入力するだけで書誌情報を自動取得します。

---

## 🛠️ 技術スタック (Tech Stack)

### フロントエンド
*   **Next.js (App Router)**: 高速なページ遷移とSEO対策。
*   **Tailwind CSS**: レスポンシブでモダンなUIデザイン。
*   **Shadcn UI / Radix UI**: アクセシビリティに配慮した高品質なコンポーネント。

### バックエンド / インフラ
*   **Firebase Authentication**: 大学アカウント限定の認証基盤。
*   **Cloud Firestore**: リアルタイム性を活かしたNoSQLデータベース。
*   **Cloud Functions**: 決済処理、定期実行（キャンセル処理）、メール通知などのサーバーサイドロジック。
*   **Firebase Hosting**: 高速でセキュアな静的ホスティング。

### 決済
*   **Stripe Connect**: 個人間取引（マーケットプレイス）に特化した決済基盤。本人確認（KYC）も統合。

---

## 🚀 デモサイト (Live Demo)

現在、以下のURLで本番環境が稼働しています。

👉 **[https://musa-link.web.app](https://musa-link.web.app)**

*   **動作環境**: スマホ、PCブラウザ対応
*   **テストアカウント**:
    *   閲覧のみならログイン不要で一覧を見ることができます。
    *   出品・購入には大学アカウントが必要です（デモ用アカウントについては管理者にお問い合わせください）。

---

## 💻 開発環境のセットアップ (Development)

このリポジトリをローカルで動かす場合の手順です。

### 1. 前提条件
*   Node.js (v18以上推奨)
*   npm

### 2. インストール

```bash
# リポジトリをクローン
git clone https://github.com/fumi3333/Musa-lo.git

# ディレクトリへ移動
cd musashino-link

# 依存パッケージをインストール
npm install
```

### 3. 環境変数の設定 (`.env.local`)
`.env.local.example` をコピーして `.env.local` を作成し、必要なFirebase/Stripeのキーを設定してください。
※APIキーなどの機密情報は、**絶対にこのリポジトリ（GitHub）に公開しないでください**。

### 4. 起動

```bash
npm run dev
```
ブラウザで `http://localhost:3000` を開きます。

---

## ⚠️ 公開・取り扱いに関する注意 (Security Note)

このプロジェクトを第三者に共有・公開する際は、以下のファイルが含まれていないことを確認してください（通常は `.gitignore` で除外されています）。

*   **`.env.local`**: APIキーやStripeの秘密鍵が含まれています。
*   **`firebase-debug.log`**: デバッグログに機密情報が残る場合があります。
*   **`.pem` / `.json` (キーファイル)**: サービスアカウントキーなど。

---

Created by Musashino Link Dev Team
