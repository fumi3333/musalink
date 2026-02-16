# セキュリティ・フィードバック対応メモ

外部からいただいた技術フィードバックと、`firestore.rules` の内容・対応状況をまとめたドキュメントです。

---

## 実施した修正（Critical / High 対応済み）

| 優先度 | 項目 | 対応内容 |
|--------|------|----------|
| Critical | 匿名ログイン許可 | `isVerifiedStudent()` から `anonymous` を削除（`firestore.rules`） |
| Critical | output: 'export' | `next.config.ts` から削除し、Vercel Serverless デプロイ可能に |
| Critical | payout_requests read | `resource.data.userId == request.auth.uid` で本人読取に変更 |
| High | Unlock 時の個人情報 | `processUnlock` および `capturePayment` 内で seller 情報を `private_data/profile` から取得するよう変更（`functions/src/index.ts`） |
| Medium | ステータス遷移の明示 | `firestore.rules` の transactions update にコメントで「payment_pending → completed は Functions のみ」を明記 |

---

## 1. `firestore.rules` の要点（現行）

```javascript
// 匿名は許可しない（書き込みは学内メール認証のみ）
function isVerifiedStudent() {
   return isAuthenticated() && (
     request.auth.token.email.matches('.*@stu.musashino-u.ac.jp') ||
     request.auth.token.email.matches('.*@musashino-u.ac.jp') ||
     request.auth.token.email == 'demo@musashino-u.ac.jp'
   );
}

    // Users: Profiles (Public Read, Owner Write)
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow create: if isOwner(userId);
      allow update: if isOwner(userId);
      allow delete: if false;

      match /private_data/{docId} {
          allow read, write: if isOwner(userId);
      }

      match /notifications/{notificationId} {
          allow read, write: if isOwner(userId);
      }
    }

    // Items: Public Read, Seller Write
    match /items/{itemId} {
      allow read: if true;
      allow create: if isVerifiedStudent() 
                    && request.resource.data.seller_id == request.auth.uid
                    && request.resource.data.description.size() < 2000;
      allow update: if isAuthenticated() && (
                      resource.data.seller_id == request.auth.uid
                      || ( isVerifiedStudent() 
                          && resource.data.status == 'listing'
                          && request.resource.data.status == 'matching'
                          && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status']) )
                    );
      allow delete: if isAuthenticated() && resource.data.seller_id == request.auth.uid;
    }

    // Transactions: Involved Parties Only
    match /transactions/{transactionId} {
      allow read: if isAuthenticated() && (resource.data.buyer_id == request.auth.uid || resource.data.seller_id == request.auth.uid);
      allow create: if isVerifiedStudent() && request.resource.data.buyer_id == request.auth.uid;
      allow update: if isVerifiedStudent() 
                    && (resource.data.buyer_id == request.auth.uid || resource.data.seller_id == request.auth.uid)
                    && ( /* 厳密なステータス遷移のみ許可（略） */ );
    }

    // Conversations & Messages
    match /conversations/{conversationId} {
      allow read, update: if isAuthenticated() && request.auth.uid in resource.data.participants;
      allow create: if isAuthenticated() && request.auth.uid in request.resource.data.participants;
      match /messages/{messageId} {
        allow read, write: if isAuthenticated() 
                           && request.auth.uid in get(/databases/$(database)/documents/conversations/$(conversationId)).data.participants;
      }
    }

    // ドキュメントIDは自動採番のため、resource.data.userId で本人判定
    match /payout_requests/{requestId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || request.auth.token.admin == true);
      allow create: if isAuthenticated() && request.resource.data.userId == request.auth.uid;
      allow update: if false;
    }

    match /reports/{reportId} {
        allow create: if isAuthenticated();
        allow read: if request.auth.token.admin == true;
    }
  }
}
```

（上記は要点を保った要約です。実ファイルは `firestore.rules` を参照してください。）

---

## 2. フィードバック項目ごとの対応状況

### 2.1 「output: 'export'」と API Routes の競合

- **対応済み**: `next.config.ts` から `output: 'export'` を削除済み。Vercel で Framework Preset を "Next.js" にし、Serverless としてデプロイすること。

---

### 2.2 セキュリティとドメイン制限の堅牢性

- **指摘**: クライアントだけのチェックではバイパスされうる。Firestore Rules や Functions 側でも学内ドメインを強制すべき。
- **現状（Rules）**:  
  - **items**: `create` は `isVerifiedStudent()` 必須。  
  - **transactions**: `create` / `update` は `isVerifiedStudent()` 必須。  
  - `isVerifiedStudent()` は `request.auth.token.email` が `@stu.musashino-u.ac.jp` / `@musashino-u.ac.jp` であること（および demo 用 `demo@musashino-u.ac.jp`）で判定。**匿名は許可していない（削除済み）。**
- **結論**: Firestore 側で学内ドメイン（または demo）でないと items/transactions の書き込みができず、クライアントをバイパスしても匿名・学外では create を通せない。

---

### 2.3 個人情報の分離（Privacy）と Unlock 前後の設計

- **指摘**: 取引相手の情報表示で、Unlock 前には `private_data` を fetch しない（あるいは Rules で read を弾く）設計になっているか。
- **現状（Rules）**:  
  - `users/{userId}/private_data/{docId}` は **`isOwner(userId)` のみ**で read/write 可能。  
  - つまり **本人以外は他人の `private_data` を一切読めない**。
- **Unlock フロー**:  
  - クライアントは **`transaction.unlocked_assets`** だけを表示（`TransactionDetailView` → `RevealableContent`）。  
  - `unlocked_assets` の書き込みは **Cloud Functions の processUnlock** で行い、その際に **Functions 側で seller の `users` ドキュメント（公開側）** から `student_id` / `university_email` を読んで書き込んでいる。  
  - クライアントが直接 `private_data` を読む経路はなく、**Unlock 前は相手の private_data に触れない設計**になっている。
- **対応済み**: `processUnlock` および `capturePayment` 内の Unlock 処理で、seller の学籍番号・メールを **`users/{sellerId}/private_data/profile`** から取得するよう変更済み。公開の `users` ドキュメントには漏れて困る情報を置かずに済む設計になっている。

---

### 2.4 対面取引と Unlock の UX（電波不良・タイムアウト）

- **指摘**: 対面で QR が読めない・Unlock API がタイムアウトする場合の備え（オフライン証拠や「あとで報告」、capture 期限など）。
- **現状**: コード上はオフライン時の「証拠を残す」フローや、Unlock 失敗時のリトライ・代替フローは明示的には実装されていない。Stripe の capture 期限は Stripe ダッシュボード側の設定に依存。
- **推奨**: 運用として「キャンパス内で再度 Unlock を試す」「サポートに問い合わせ」を案内するか、必要に応じて「あとで Unlock する」を許すステートや、capture 期限の余裕を確認するとよい。

---

### 2.5 InAppBrowserGuard

- **評価**: LINE/Instagram 等のアプリ内ブラウザで Google ログインが失敗する問題を抑える実装として、そのまま有効にしておくのがよい。

---

### 2.6 Stripe Connect と未成年・KYC

- **指摘**: 未成年の学生利用時、親権者同意など Stripe 側の要件が UI で詰まらないか。
- **現状**: `app/seller/payout/page.tsx` は振込申請と Stripe Connect 連携/ログインリンクを提供。Stripe の KYC 画面は Stripe 側に遷移するため、本番の本人確認要件（未成年時の同意書等）は Stripe のドキュメントとダッシュボードで確認し、必要なら学内案内やヘルプに追記するのがよい。

---

### 2.7 payout_requests の read ルール

- **対応済み**: `allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || request.auth.token.admin == true);` に修正済み。一覧取得時は `where("userId", "==", request.auth.uid)` のクエリを使用すること。

---

## 3. まとめ

| 項目 | 状態 |
|------|------|
| ドメイン制限（Rules） | ✅ items/transactions で `isVerifiedStudent()` によりサーバー側でも強制されている |
| private_data の保護 | ✅ 本人以外は read/write 不可。Unlock は Functions が書き込んだ `unlocked_assets` のみクライアント表示 |
| Unlock 前の相手情報 | ✅ クライアントは相手の `private_data` を読まない設計 |
| output: 'export' と API | ✅ `next.config.ts` から削除済み |
| payout_requests の read | ✅ 修正済み（resource.data.userId で本人判定） |
| 対面・オフライン UX | 要検討（リトライ案内・capture 期限の確認等） |
| Stripe Connect 未成年 | Stripe 本番要件の確認と案内の整備を推奨 |

`firestore.rules` の主要な穴（誰でも他人の商品を書き換えられる・非公開データを読める等）はなく、**ドメイン制限と private_data の分離は Rules で担保されている**状態です。上記の `payout_requests` 修正と、デプロイ方式の確認をすれば、リリースに向けた安心度はさらに高まります。
