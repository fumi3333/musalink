# Musa（武蔵野大学 教科書マッチング） 詳細コードレビュー

**レビュー日**: 2026年2月  
**対象**: フロントエンド (Next.js 16) / Firebase (Auth, Firestore, Functions) / Stripe Connect  
**目的**: 本番運用・保守性・セキュリティの観点での総合評価と改善提案

---

## 1. エグゼクティブサマリー

- **全体評価**: 学内限定・決済・取引フローまで一通り実装された、コンセプトの明確なアプリケーションです。Firestore セキュリティルールと Cloud Functions による決済分離は適切に設計されています。
- **強み**: 認証ドメイン制限、Public/Private データ分離、取引ステータス機械、API プロキシによる CORS 回避、オフライン考慮のフォールバックが用意されている点。
- **要対応**: `userData.id` 未設定による実質バグ、`output: 'export'` と API Routes の共存リスク、Firestore ルールの `payout_requests` 読み取り条件、本番モックデータの扱い。これらは早めの対応を推奨します。
- **推奨**: 型の厳密化（`any` 削減）、環境別設定の統一、デプロイ構成の明文化、テストの追加。

---

## 2. アーキテクチャ・技術スタック

| レイヤー | 技術 | 所見 |
|----------|------|------|
| フロント | Next.js 16 (App Router), React 19, TypeScript | 現代的。`output: 'export'` は後述の通り要確認。 |
| 認証 | Firebase Auth (Google) | ドメイン制限はクライアント＋ルールの二重で妥当。 |
| DB | Firestore | ルールで状態遷移・役割が整理されている。 |
| 決済 | Stripe Connect, Payment Intents | エスクローは Functions 側で完結しており良い。 |
| バックエンド | Cloud Functions (onRequest/onCall), Next.js API Routes | プロキシ構成で CORS を回避している。 |

**ディレクトリ構成**: `app/`（ページ）、`components/`（UI・取引・チャット）、`contexts/`（Auth）、`services/`（firestore, analytics, books）、`lib/`（firebase, stripe, constants, utils）と役割が分かれており把握しやすい。

---

## 3. クリティカルな問題（要対応）

### 3.1 `userData.id` が設定されない（実質バグ）

**現象**: `AuthContext` で `userData` は Firestore の `users/{uid}` と `private_data/profile` の `data()` のみをマージしており、**ドキュメント ID（= Firebase Auth の uid）が `userData` に含まれていません**。  
一方、以下の箇所で `userData.id` を前提にしています。

- `app/transactions/detail/page.tsx`: `userData?.id === tx.buyer_id`, `userId: userData.id`
- `app/transactions/new/page.tsx`: `createTransaction(item.id, userData.id, ...)`
- `app/mypage/page.tsx`: `getMyItems(userData.id)`, `getMyTransactions(userData.id)`, `updateUser(userData.id, ...)`
- `app/seller/payout/page.tsx`: `userId: userData.id`, `updateDoc(doc(db, "users", userData.id), ...)`
- `app/notifications/page.tsx`: `getNotifications(userData.id)` 等
- `app/items/create/page.tsx`: `seller_id: currentUser.id`（`currentUser` は `authUserData` 由来）

**影響**:  
- 取引作成時に `buyer_id` が `undefined` になり、Firestore ルール `request.resource.data.buyer_id == request.auth.uid` で弾かれる可能性が高い。  
- マイページ・振込申請・通知・出品時の `seller_id` なども同様に不整合を起こし得る。

**推奨修正**:  
`AuthContext` で Firestore から取得したオブジェクトに、必ず `id: firebaseUser.uid` を付与する。

```ts
// contexts/AuthContext.tsx の finalUserData をセットする箇所
if (userSnap.exists()) {
  finalUserData = { ...userSnap.data(), id: firebaseUser.uid };
}
// 同様に private マージ後も
finalUserData = { ...finalUserData, id: firebaseUser.uid };
setUserData(finalUserData);
```

初回ログインでスケルトンを作る分岐でも、作成するドキュメントの `id` と、`userData` に渡す `id` を `firebaseUser.uid` で統一すること。

---

### 3.2 Next.js `output: 'export'` と API Routes の関係

**現状**: `next.config.ts` で `output: 'export'` が指定されています。

```ts
// next.config.ts
const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
};
```

**問題**:  
Next.js の静的エクスポートでは **`app/api/*` の API Routes はビルド成果物に含まれず、静的ホスティングでは動作しません**。  
決済・Unlock は `/api/create-payment-intent` と `/api/unlock-transaction` に依存しているため、静的エクスポートをそのまま Vercel にデプロイしていると、これらの API が 404 になる可能性があります。

**確認事項**:  
- 実際のデプロイが「Vercel の Node ランタイム（`next start` 相当）」か「静的エクスポートの配信」かを確認すること。  
- 本番で API を使うなら、`output: 'export'` を外し、Vercel のデフォルト（サーバー/サーバーレス）でデプロイする構成を推奨。

---

### 3.3 Firestore ルール: `payout_requests` の read 条件

**現状**:

```javascript
match /payout_requests/{requestId} {
  allow read: if isOwner(requestId) || request.auth.token.admin == true;
  allow create: if isAuthenticated() && request.resource.data.userId == request.auth.uid;
  allow update: if false;
}
```

**問題**:  
`isOwner(requestId)` は `request.auth.uid == requestId` を意味します。  
一方、クライアントは `addDoc(collection(db, "payout_requests"), { userId: userData.id, ... })` で **自動生成されたドキュメント ID** を使っているため、`requestId` はランダム ID であり、ユーザー ID と一致しません。  
結果として、**誰も自分の振込申請ドキュメントを read できていない**可能性が高いです。

**推奨**:  
「自分が作成した申請」で読めるようにする。

```javascript
allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || request.auth.token.admin == true);
```

一覧取得時は `where("userId", "==", request.auth.uid)` のクエリとセットで使う必要があります。

---

### 3.4 本番でのモック・フォールバック

**現状**:  
`services/firestore.ts` の `getItems` / `getItem` で、タイムアウトや `unavailable` 時に **MOCK_ITEMS** を返しています。

**問題**:  
本番でネットワーク遅延や一時的な障害が起きた場合、**実際にはデータが無い／取得できていないのに、固定のモック一覧が表示される**可能性があります。ユーザーには「在庫がある」と誤認させ、取引フローで不整合を起こし得ます。

**推奨**:  
- 本番ではモックを返さず、エラー時は「取得できませんでした」＋再試行 or 空配列／null に限定する。  
- モックを使う場合は `NODE_ENV === 'development'` や `NEXT_PUBLIC_USE_MOCK` などフラグで切り替え、本番ビルドでは無効にすること。

---

## 4. セキュリティ詳細

### 4.1 認証・ドメイン制限

- **AuthContext**: `getUniversityFromEmail(email)` で `@stu.musashino-u.ac.jp` / `@musashino-u.ac.jp` 以外はサインアウト＋toast。妥当。
- **Firestore ルール**: `isVerifiedStudent()` で同じドメイン＋`demo@musashino-u.ac.jp`＋匿名を許可。匿名は AuthContext 側で本番ではサインアウトしているため、ルール側の匿名許可はデモ用と解釈できる。本番で匿名を完全に使わないなら、ルールからも外す選択肢あり。
- **二重チェック**: クライアントとルールの両方でドメインを見ているため、クライアント改ざんだけでは不正アクセスできない設計になっている。

### 4.2 決済・Unlock

- **createPaymentIntent / unlockTransaction**: いずれも Cloud Functions 側で Firebase ID トークン検証を行い、取引・売り手の整合性を確認している。支払い意図・Unlock はサーバー側で完結しており良い。
- **API Route プロキシ**: ブラウザは同一オリジン（`/api/...`）にだけ送り、Next サーバーが Cloud Functions を呼ぶ構成のため、CORS を気にせずトークンを転送できている。

### 4.3 その他

- **lib/auth.ts**: `signInWithGoogle` で `ALLOWED_DOMAIN` チェックがあるが、現在のフローでは `AuthContext` の `login()`（popup 直接）が主で、`lib/auth.ts` の関数がどこで使われているかは要確認。重複している場合は一箇所に寄せた方がよい。
- **AuthButtons**: 開発時のみ「通知テスト」で `transactions` にダミー追加している。本番ビルドでは `process.env.NODE_ENV === 'development'` で表示されないが、テスト用データが本番 DB に入らないよう、実行環境の切り分けは意識しておくこと。

---

## 5. データ層（Firestore / 型 / AuthContext）

### 5.1 型定義（`types/index.ts`）

- `User`, `Item`, `Transaction`, `Notification`, `TransactionStatus` が一箇所で定義されており扱いやすい。
- `User` の `id` は必須。前述の通り、AuthContext から確実に `id` を渡す必要がある。
- `metadata: Record<string, any>` や `unlocked_assets` の詳細型など、もう一段細かくしても型安全性は上がる。

### 5.2 AuthContext

- **userData の型**: `userData: any` は避け、`User & { id: string }` や共通の `AppUser` 型を定義して使うとよい。
- **初回ログイン**: 「First time login - Create Skeleton」のロジックが省略されたまま。初回ユーザー用の `users` / `private_data` 作成を実装するか、コメントで「未実装」と明示するとよい。
- **ログインエラー**: `auth/configuration-not-found` の分岐が二重になっており、メッセージも微妙に異なる。一箇所にまとめ、`setError` と `toast.error` を一度だけ実行するようにするとよい。
- **ログアウト**: `window.location.reload()` で全体リロードしている。状態をクリアするだけでもよいが、意図（例: キャッシュ破棄）があればコメントがあると親切。

### 5.3 Firestore サービス（`services/firestore.ts`）

- **updateUser の重複閉じ括弧**: 前回指摘分は修正済み。
- **getUser**: 存在しないユーザーに対してモックの `User` を返している。呼び出し側が「存在しない」と区別できない。必要なら `getUser(...): Promise<User | null>` にして、null の場合は「ユーザーがいません」と扱う方が安全。
- **createTransaction**: `runTransaction` 内で二重予約防止とアイテムの `matching` 更新をしており良い。`logEvent` をトランザクション内で呼んでいるコメントの通り、理想的にはトランザクション外で行う方がよい（冪等でない副作用のため）。
- **orderBy**: `getItems` のクエリで `orderBy("createdAt", "desc")` がコメントアウトされている。インデックス未作成ならコメントのままでよいが、一覧の並び順要件が決まっていれば、インデックスを用意して有効化すると UX が明確になる。
- **getNotifications**: `orderBy("createdAt", "desc")` を使用。複合クエリの場合は Firestore の複合インデックスが必要になることがあるので、デプロイ時にコンソールで確認するとよい。

### 5.4 キャンセル理由のフィールド不統一

- **型・UI**: `Transaction` の `cancel_reason`、UI も `transaction.cancel_reason` を表示。
- **Cloud Functions**:  
  - `cancelStaleTransactions`: `cancellationReason: "auto_timeout_24h"` を書き込み。  
  - `cancelTransaction`（ユーザーキャンセル）: `cancel_reason`, `cancelledBy`, `cancelledAt` を更新。  
  - 管理者キャンセル相当の処理: `cancellationReason` を使用。

**推奨**:  
クライアントが参照するのは `cancel_reason` のみにし、スケジュール関数・管理者キャンセルも `cancel_reason`（と必要なら `cancelledBy`）に統一すると、一覧・詳細の表示と整合する。

---

## 6. API Routes と Cloud Functions

### 6.1 環境変数・URL の一貫性

- **create-payment-intent**: `FUNCTIONS_BASE_URL` で環境に応じた URL を組み立てている。
- **unlock-transaction**: URL が本番固定（`https://us-central1-musa-link.cloudfunctions.net/unlockTransaction`）のため、ローカルで Cloud Functions エミュレータを使う場合に切り替えられない。

**推奨**:  
`unlock-transaction` も `process.env.FUNCTIONS_BASE_URL` を使い、`create-payment-intent` と同様に環境別で切り替えられるようにする。

### 6.2 Cloud Functions（`functions/src/index.ts`）

- **CORS**: `allowedOrigins` に `https://musalink.com` はあるが、README の本番 URL は `https://musalink.vercel.app`。クライアントが Functions を直接呼ぶ経路がもしあれば、`musalink.vercel.app` を追加する必要がある。現状は API プロキシ経由なら影響は小さい。
- **Stripe**: `functions.config().stripe?.secret` と `process.env.STRIPE_SECRET_KEY` の両方を見ている。デプロイ環境に合わせてどちらを主とするか決め、ドキュメント化するとよい。
- **createPaymentIntent**: スキーマで `transactionId` のみ必須。`userId` は API Route から渡しているが、Functions 側ではトークンの uid で検証しているため、整合している。
- **processUnlock**: 売り手の `student_id` / `university_email` を `users` の公開ドキュメントから読んでいる。実際の連絡先は `private_data` にある可能性があるため、必要に応じて `private_data/profile` を参照するよう変更する余地がある。

---

## 7. フロントエンド（ページ・コンポーネント）

### 7.1 レイアウト・共通

- **layout.tsx**: `Footer` の import がフォントの後にある。他のコンポーネント import とまとめると読みやすい。
- **InAppBrowserGuard**: LINE/Instagram 等の in-app ブラウザ検知と注意表示は UX として良い。「LINEのままで開く」で `setIsInAppBrowser(false)` にすると、実際には in-app のままなので表示が消えるだけになる。意図が「強制的に外ブラウザを開く」でないなら、ボタンラベルや説明を調整した方がよい。

### 7.2 ヘッダー・ナビ

- **Header**: モバイルで「取引一覧」と「お知らせ」の両方に Bell アイコンで同じ見た目。区別しやすくするならアイコンやラベルを変えるとよい。
- **AuthButtons**: 未ログイン時に「売り手で試す」「買い手で試す」を表示しているが、`debugLogin` は常に「デモログインは無効化されました」と toast するだけ。本番ではボタン非表示にするか、デモ用の別フローにすると混乱が減る。

### 7.3 取引フロー

- **transactions/detail**:  
  - デモ判定が `is_demo === true` や `university_email?.startsWith('s2527')` 等のハードコード。デモモードは `userData.is_demo` や環境変数で一元化すると運用しやすい。  
  - `currentUser?.id` を unlock API に渡している。ここも `userData.id` に依存しているため、3.1 の修正が必須。
- **TransactionDetailView**:  
  - `currentUser.id` を Stripe フォームに渡している。同上。  
  - セルフ取引（同一ユーザーが売り手・買い手）のとき、`student_id === 's1111111'` で買い手側に寄せる分岐がある。デモ用の特別扱いならコメントで明示するとよい。
- **StripePaymentForm**: 未読のため、`userId` の使われ方とエラーハンドリングだけでも確認するとよい。

### 7.4 出品・一覧

- **items/create**: `seller_id: currentUser.id`、`currentUser` は `authUserData` 由来。3.1 の修正で `userData.id` が必ず入れば、ここも整合する。
- **items/page**: 検索は「検索」ボタンまたは Enter で `fetchItems`。keyword を useEffect の依存に含めず、意図的にボタン発火にしているのはコメントの通りでよい。

### 7.5 マイページ・振込・通知

- **mypage**: `userData?.id` で `getMyItems` / `getMyTransactions` を呼んでいる。3.1 対応必須。日付表示が `new Date().toLocaleDateString()` のままになっている箇所は、`transaction.createdAt` 等の実データに差し替えるとよい。
- **seller/payout**: `userData.id` で `addDoc` と `updateDoc`。3.1 対応必須。振込申請は「1,000円以上」のチェックのみで、Stripe Connect の残高と一致しているかはサーバー側で確認していない。将来、Functions で残高チェックや二重申請防止を行うとより安全。
- **notifications**: `userData.id` 前提。3.1 対応で一括で解消される。

### 7.6 チャット

- **ChatRoom**: `conversationId = transactionId` の 1:1 対応。`participants: [buyerId, sellerId]` で setDoc。Firestore ルールの `participants` と一致しており問題ない。`useAuth` は `@/hooks/useAuth` 経由で AuthContext を参照しているため、同一インスタンスでよい。

---

## 8. 設定・デプロイ

### 8.1 Next.js

- **next.config.ts**: `output: 'export'` は 3.2 の通り、API を使う本番構成と矛盾する可能性がある。API を本番で使うなら削除を推奨。
- **images.unoptimized**: 静的エクスポート時は必要な設定。`output` を変更する場合のみ、必要に応じて見直し。

### 8.2 Firebase

- **lib/firebase.ts**: 環境変数が無い場合のフォールバック（`mock_api_key_for_build` 等）はビルド通過用と解釈できる。本番では必ず環境変数が入るようにし、`NODE_ENV === 'production'` かつキーが無い場合は throw するなどすると、誤デプロイに気づきやすい。
- **stripe.ts**: `loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)` の非 null アサーション。本番で未設定だと実行時エラーになるので、可能なら起動時チェックやフォールバックのコメントを残すとよい。

### 8.3 定数・環境

- **lib/constants.ts**: `ALLOWED_DOMAIN` は `lib/auth.ts` で使用。AuthContext のドメイン判定は文字列で直接書いているため、`ALLOWED_DOMAIN` と揃えると変更が一箇所で済む。
- **Footer**: 問い合わせリンクが `https://forms.google.com/your-form-id` のまま。本番では実フォーム URL に差し替えること。

---

## 9. コード品質・保守性

### 9.1 TypeScript

- **any**: `AuthContext` の `userData`、`(snapshot: any)`、`(error: any)`、`metadata: Record<string, any>` など、段階的に型を絞っていくと安全。`unknown` と型ガードの利用を推奨。
- **未使用**: `services/firestore.ts` の `DocumentData`、`increment` など、未使用 import は削除すると lint が通りやすい。

### 9.2 エラーハンドリング

- 多くの catch で `console.error` のあと `toast.error` でユーザー向けメッセージを出している。本番では `error.message` をそのまま表示しない方針で問題ない。ログには `error` を残すか、メッセージをサニタイズして記録すると障害調査に役立つ。
- Firestore の `unavailable` やオフライン時に「成功のように扱う」箇所は、本番では「失敗」として扱い、モック返却は開発用に限定することを推奨（3.4 と共通）。

### 9.3 テスト

- リポジトリ内にテストファイル・設定がほぼ見当たらない。最低限、認証コンテキストの「未ログイン時は user null」「ログイン後は userData に id が入る」や、決済プロキシの「400/401 の返し方」などをユニット／統合で追加すると、3.1 のような regress を防ぎやすい。

### 9.4 ドキュメント・コメント

- README は概要・機能・技術スタックが整理されている。デプロイ手順（Vercel/Firebase の環境変数一覧、`output: 'export'` の可否）を追記すると運用が楽になる。
- コード内の `// [New]` や `// (Logic omitted for brevity)` は、対応する issue や「未実装」などのラベルに寄せると意図が残しやすい。

---

## 10. 推奨アクション（優先度順）

| 優先度 | 項目 | 内容 |
|--------|------|------|
| P0 | userData.id の付与 | AuthContext で Firestore 取得結果に `id: firebaseUser.uid` を必ず付与する。 |
| P0 | payout_requests の read ルール | `resource.data.userId == request.auth.uid` で読めるようにし、一覧クエリと合わせて検証。 |
| P0 | デプロイ構成の確認 | `output: 'export'` と API Routes の関係を確認し、本番で API を使うなら `output` を外す。 |
| P1 | 本番モック無効化 | getItems/getItem のモック返却を開発用に限定し、本番ではエラー or 空に統一。 |
| P1 | unlock-transaction の URL | FUNCTIONS_BASE_URL で環境切り替えできるようにする。 |
| P1 | キャンセル理由フィールド統一 | スケジュール・管理者キャンセルも `cancel_reason` に統一。 |
| P2 | userData の型 | `any` をやめ、`User & { id: string }` 等の型を定義。 |
| P2 | ログインエラー分岐の整理 | auth/configuration-not-found を一箇所にまとめる。 |
| P2 | CORS allowedOrigins | 本番ドメインが musalink.vercel.app なら追加。 |
| P2 | 初回ログイン or コメント | スケルトン作成を実装するか、「未実装」と明記。 |
| P3 | テストの追加 | Auth と決済プロキシ周りの最低限のテスト。 |
| P3 | 問い合わせ URL | Footer のフォーム URL を実態に合わせる。 |

---

以上で、一通りコードベースを前提にした詳細レビューとします。特定モジュールのさらに細かいレビューや、上記の修正パッチ案が必要であれば、対象ファイルやフローを指定してください。
