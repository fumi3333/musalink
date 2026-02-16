# Musa（musalink）コード全体まとめ

**武蔵野大学 学生専用 教科書マッチングプラットフォーム** のコードベースを一覧でまとめたドキュメントです。

---

## 1. プロジェクト概要

| 項目 | 内容 |
|------|------|
| 名称 | Musa（ムサ） / musalink |
| 本番URL | https://musalink.vercel.app |
| フロント | Next.js 16 (App Router), React 19, TypeScript |
| バックエンド | Firebase (Auth, Firestore, Functions), Stripe Connect |
| デプロイ | Vercel（フロント）, Firebase Hosting/Functions（API・決済） |

---

## 2. ディレクトリ構成と役割

```
musashino link/
├── app/                    # Next.js App Router（ページ・API）
│   ├── api/                # API Routes（決済・Stripe プロキシ）
│   ├── legal/              # 利用規約・プライバシー・特商法
│   ├── admin/              # 管理画面（ユーザー・出品・取引・ログ）
│   ├── items/              # 出品一覧・詳細・新規出品
│   ├── transactions/       # 取引一覧・詳細・新規取引
│   ├── seller/             # 売上・振込申請（Stripe Connect）
│   ├── mypage/             # マイページ
│   ├── notifications/      # お知らせ
│   ├── login/              # ログイン
│   ├── verify/             # 本人確認
│   ├── verify-security/    # セキュリティ検証用
│   ├── layout.tsx          # ルートレイアウト（Header, Footer, AuthProvider）
│   └── page.tsx            # トップ（HeroSection, HowItWorks）
├── components/             # UI コンポーネント
│   ├── layout/             # Header, Footer, AuthButtons, InAppBrowserGuard
│   ├── home/               # HeroSection, HowItWorks
│   ├── listing/            # ItemCard
│   ├── transaction/       # TransactionDetailView, Stepper, StripePaymentForm, ChatRoom 等
│   ├── chat/               # ChatRoom
│   ├── profile/            # InterestSelector
│   └── ui/                 # 汎用UI（button, card, dialog, input, select, tabs 等）
├── contexts/               # React Context
│   └── AuthContext.tsx     # 認証状態・userData・login/logout
├── hooks/
│   └── useAuth.ts          # AuthContext の再エクスポート
├── services/               # データ・外部API
│   ├── firestore.ts        # Firestore CRUD（items, transactions, users, notifications）
│   ├── analytics.ts       # イベント・検索ミスログ
│   └── books.ts            # OpenBD（ISBN検索）
├── lib/                    # 設定・ユーティリティ
│   ├── firebase.ts         # Firebase 初期化（auth, db, storage, functions）
│   ├── stripe.ts           # Stripe.js 読み込み
│   ├── auth.ts             # signInWithGoogle（ドメイン制限）
│   ├── constants.ts        # アプリ定数・手数料・ドメイン
│   ├── utils.ts            # cn, getTransactionStatusLabel
│   └── studentId.ts        # 学籍番号抽出
├── types/
│   └── index.ts            # User, Item, Transaction, Notification, TransactionStatus
├── firestore.rules         # Firestore セキュリティルール
├── functions/              # Cloud Functions
│   └── src/
│       ├── index.ts        # 決済・Unlock・キャンセル・評価・Webhook・管理
│       ├── notifications.ts # 取引・メッセージ時の通知
│       ├── config.ts      # CORS allowedOrigins
│       ├── utils.ts        # 手数料等
│       └── errorUtils.ts   # エラーレスポンス統一
└── scripts/                # 運用・検証用スクリプト
```

---

## 3. 主要ファイル一覧（役割別）

### 認証

| ファイル | 役割 |
|----------|------|
| `contexts/AuthContext.tsx` | ログイン状態・userData（Firestore users + private_data マージ）・ドメイン制限・通知件数・login/logout |
| `hooks/useAuth.ts` | useAuth を AuthContext から再エクスポート |
| `lib/firebase.ts` | Firebase 初期化（auth, db, storage, functions, analytics） |
| `lib/auth.ts` | signInWithGoogle（学内ドメインチェック付き） |

### 取引・決済フロー

| ファイル | 役割 |
|----------|------|
| `app/transactions/new/page.tsx` | 購入リクエスト作成・利用規約同意チェック |
| `app/transactions/detail/page.tsx` | 取引詳細・ステータス更新・Payment Intent 取得・Unlock 呼び出し |
| `components/transaction/TransactionDetailView.tsx` | 取引UI（承認/拒否・決済フォーム・QR・キャンセル・評価・チャット） |
| `components/transaction/StripePaymentForm.tsx` | Stripe Payment Element・確認→payment_pending 更新 |
| `components/transaction/TransactionStepper.tsx` | リクエスト→予約・調整→受渡・完了のステップ表示 |
| `components/transaction/MeetingPlaceSelector.tsx` | 受け渡し場所選択 |
| `components/transaction/RevealableContent.tsx` | アンロック後の学籍番号・メール表示 |

### API Routes（CORS 回避のプロキシ）

| ファイル | 役割 |
|----------|------|
| `app/api/create-payment-intent/route.ts` | クライアント→Next→Cloud Functions createPaymentIntent |
| `app/api/unlock-transaction/route.ts` | クライアント→Next→Cloud Functions unlockTransaction |
| `app/api/stripe-connect/route.ts` | Stripe Connect アカウント作成・リンク取得 |

### Firestore・データ

| ファイル | 役割 |
|----------|------|
| `services/firestore.ts` | createItem, getItems, getItem, createTransaction, getTransaction, updateTransactionStatus, getUser, updateUser, getPrivateProfile, getMyItems, getMyTransactions, getNotifications, rateUser, reportIssue 等 |
| `firestore.rules` | users/items/transactions/conversations/payout_requests/reports の読み書き条件・状態遷移 |
| `types/index.ts` | User, Item, Transaction, Notification, TransactionStatus の型定義 |

### 出品・一覧

| ファイル | 役割 |
|----------|------|
| `app/items/page.tsx` | 出品一覧・検索・学部・学年フィルタ |
| `app/items/[id]/page.tsx` | 商品詳細・購入リクエストへ |
| `app/items/create/page.tsx` | 新規出品フォーム・画像・ISBN検索・本人確認/振込チェック |
| `components/listing/ItemCard.tsx` | 一覧用カード |

### マイページ・振込・お知らせ

| ファイル | 役割 |
|----------|------|
| `app/mypage/page.tsx` | プロフィール・出品一覧・取引一覧・編集 |
| `app/seller/payout/page.tsx` | 売上残高・振込申請・Stripe Connect 連携/ログインリンク |
| `app/notifications/page.tsx` | お知らせ一覧・既読 |

### レイアウト・共通UI

| ファイル | 役割 |
|----------|------|
| `app/layout.tsx` | ルートレイアウト・AuthProvider・Header・Footer・InAppBrowserGuard・Toaster |
| `components/layout/Header.tsx` | ロゴ・ナビ・AuthButtons・モバイルメニュー |
| `components/layout/Footer.tsx` | 利用規約・プライバシー・特商法・お問い合わせ |
| `components/layout/AuthButtons.tsx` | ログイン/ログアウト・ユーザーメニュー・通知バッジ |
| `components/layout/InAppBrowserGuard.tsx` | LINE/Instagram 等 in-app ブラウザ検知・注意表示 |

### 法的事項

| ファイル | 役割 |
|----------|------|
| `app/legal/layout.tsx` | 法的事項共通レイアウト |
| `app/legal/terms/page.tsx` | 利用規約 |
| `app/legal/privacy/page.tsx` | プライバシーポリシー |
| `app/legal/trade/page.tsx` | 特定商取引法に基づく表記 |

### 管理・検証

| ファイル | 役割 |
|----------|------|
| `app/admin/layout.tsx` | 管理画面レイアウト |
| `app/admin/page.tsx` | ダッシュボード（ユーザー数・出品数・取引数） |
| `app/admin/users/page.tsx` | ユーザー一覧 |
| `app/admin/items/page.tsx` | 出品一覧 |
| `app/admin/transactions/page.tsx` | 取引一覧・強制キャンセル |
| `app/admin/logs/page.tsx` | ログ |
| `app/verify-security/page.tsx` | IDOR 等セキュリティ検証用 |

### Cloud Functions（`functions/src/`）

| 関数・ファイル | 役割 |
|----------------|------|
| `index.ts` | executeStripeConnect, createStripeLoginLink, createPaymentIntent, capturePayment, unlockTransaction, cancelTransaction, rateUser, stripeWebhook, cancelStaleTransactions（定時）, adminCancelTransaction, fixSellerStripeData 等 |
| `notifications.ts` | onTransactionCreated, onTransactionUpdated, onMessageCreated（メール・通知作成） |
| `config.ts` | allowedOrigins（CORS） |
| `utils.ts` | 手数料計算等 |
| `errorUtils.ts` | handleError, handleCallableError |

---

## 4. 画面・フローとコードの対応

| ユーザー操作 | 主に使うコード |
|--------------|----------------|
| トップ表示 | `app/page.tsx` → HeroSection, HowItWorks |
| ログイン | AuthContext.login() → Firebase Google popup → Firestore users/private_data 取得・マージ |
| 出品一覧 | `app/items/page.tsx` → firestore.getItems |
| 商品詳細 | `app/items/[id]/page.tsx` → getItem, getUser(seller) |
| 出品する | `app/items/create/page.tsx` → 本人確認/振込チェック → createItem, Storage 画像 |
| 購入リクエスト | `app/transactions/new/page.tsx` → 利用規約同意 → createTransaction |
| 取引詳細 | `app/transactions/detail/page.tsx` → getTransaction, getItem, getUser → TransactionDetailView |
| 承認/拒否/キャンセル | TransactionDetailView → updateTransactionStatus または cancelTransaction（Callable） |
| 決済枠確保 | TransactionDetailView → /api/create-payment-intent → StripePaymentForm → capturePayment（Callable） |
| 受け渡し完了 | QR または「受取確認」→ capturePayment → payment_pending→completed は Unlock（/api/unlock-transaction） |
| チャット | ChatRoom → conversations/{txId}/messages |
| マイページ | `app/mypage/page.tsx` → getMyItems, getMyTransactions, updateUser |
| 振込申請 | `app/seller/payout/page.tsx` → Stripe Connect 連携/ログイン → payout_requests 作成 |
| お知らせ | `app/notifications/page.tsx` → getNotifications, markRead |

---

## 5. 設定・環境変数

### Next.js（`next.config.ts`）

- `output: 'export'` … 静的エクスポート（API 利用時は要確認）
- `images.unoptimized: true`

### 環境変数（例）

| 変数 | 用途 |
|------|------|
| `NEXT_PUBLIC_FIREBASE_*` | Firebase クライアント設定 |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe 公開キー |
| `FUNCTIONS_BASE_URL` | API Route から Cloud Functions を叩くときのベースURL（未設定時はローカル） |

### Firebase（`lib/firebase.ts`）

- Auth, Firestore, Storage, Functions（us-central1）, Analytics を初期化
- 環境変数未設定時はビルド用の mock 値をフォールバック

---

## 6. 関連ドキュメント

| ファイル | 内容 |
|----------|------|
| [README.md](./README.md) | プロジェクト概要・本番URL・機能・技術スタック |
| [CODE_REVIEW.md](./CODE_REVIEW.md) | 詳細コードレビュー・改善提案 |
| [DEVELOPMENT.md](./DEVELOPMENT.md) | 開発手順・環境 |
| [MANUAL.md](./MANUAL.md) | 運用マニュアル |

---

© 2026 Musa Project
