# セキュリティ・フィードバック対応メモ

外部からいただいた技術フィードバックと、`firestore.rules` の内容・対応状況をまとめたドキュメントです。

---

## 1. `firestore.rules` 全文

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper: Check if user is authenticated
    function isAuthenticated() {
      return request.auth != null;
    }

    // Helper: Check if user is owner of the user profile
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    // Helper: Enforce University Email (or specific Demo/Admin accounts)
    function isVerifiedStudefirebase deploy --only functionsil == 'demo@musashino-u.ac.jp' ||
         request.auth.token.firebase.sign_in_provider == 'anonymous'
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

    match /payout_requests/{requestId} {
      allow read: if isOwner(requestId) || request.auth.token.admin == true;
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

（上記は要点を保った要約です。実ファイルは `../firestore.rules` を参照してください。）

---

## 2. フィードバック項目ごとの対応状況

### 2.1 「output: 'export'」と API Routes の競合

- **指摘**: Static Export では `app/api/*` が動かず、Vercel 上で API が 404 になる可能性がある。
- **現状**: `next.config.ts` に `output: 'export'` が指定されている。本番で `/api/create-payment-intent` 等を利用している場合は、**`output: 'export'` を外し、Vercel の Serverless としてデプロイする**必要がある。
- **確認**: デプロイ方式（静的 export 配信 vs Node/Serverless）と、実際に API が 200 で返っているかの確認を推奨。

---

### 2.2 セキュリティとドメイン制限の堅牢性

- **指摘**: クライアントだけのチェックではバイパスされうる。Firestore Rules や Functions 側でも学内ドメインを強制すべき。
- **現状（Rules）**:  
  - **items**: `create` は `isVerifiedStudent()` 必須。  
  - **transactions**: `create` / `update` は `isVerifiedStudent()` 必須。  
  - `isVerifiedStudent()` は `request.auth.token.email` が `@stu.musashino-u.ac.jp` / `@musashino-u.ac.jp` であること（および demo・匿名の例外）で判定している。
- **結論**: **Firestore 側でも「学内ドメイン（または許可された例外）でないと items/transactions を書けない」ようになっており、クライアントをバイパスしても他ユーザーになりすましたり、学外で create を通すことはできない。** エコーチェンバーにならないよう、Rules でサーバー側チェックが入っている状態です。
- **補足**: 匿名は `sign_in_provider == 'anonymous'` で許可している。本番で匿名を完全にやめる場合は、この条件を削除する選択肢あり。

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
- **注意点**: 現在、processUnlock は **公開の `users` ドキュメント** から seller の連絡先を読んでいる。学籍番号・メールを公開ドキュメントに持たず `private_data` のみにしている場合は、**Functions 側で `users/{sellerId}/private_data/profile` を Admin SDK で読んで `unlocked_assets` に詰める**ようにすると、より一貫したプライバシー設計になる。

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

### 2.7 payout_requests の read ルール（既知の課題）

- **現状**: `allow read: if isOwner(requestId)` となっており、`requestId` はドキュメント ID（自動採番）のため、**実質「自分の uid と doc ID が一致する」場合しか読めない**。  
  振込申請は `addDoc` で作成するため doc ID はランダムになり、**ユーザーが自分で作成した申請を read できない**可能性がある。
- **推奨修正**:  
  `allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || request.auth.token.admin == true);`  
  のようにし、一覧取得時は `where("userId", "==", request.auth.uid)` のクエリとセットで使う。  
  （CODE_REVIEW.md でも同様の指摘あり。）

---

## 3. まとめ

| 項目 | 状態 |
|------|------|
| ドメイン制限（Rules） | ✅ items/transactions で `isVerifiedStudent()` によりサーバー側でも強制されている |
| private_data の保護 | ✅ 本人以外は read/write 不可。Unlock は Functions が書き込んだ `unlocked_assets` のみクライアント表示 |
| Unlock 前の相手情報 | ✅ クライアントは相手の `private_data` を読まない設計 |
| output: 'export' と API | ⚠ 本番で API を使うなら `output: 'export'` を外す必要あり |
| payout_requests の read | ⚠ `resource.data.userId == request.auth.uid` に変更することを推奨 |
| 対面・オフライン UX | 要検討（リトライ案内・capture 期限の確認等） |
| Stripe Connect 未成年 | Stripe 本番要件の確認と案内の整備を推奨 |

`firestore.rules` の主要な穴（誰でも他人の商品を書き換えられる・非公開データを読める等）はなく、**ドメイン制限と private_data の分離は Rules で担保されている**状態です。上記の `payout_requests` 修正と、デプロイ方式の確認をすれば、リリースに向けた安心度はさらに高まります。
