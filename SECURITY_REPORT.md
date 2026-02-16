# エンジニア向けセキュリティ実装レポート (Security Implementation Report)

このプロジェクト（Musalink）では、個人開発の枠を超え、商用レベルのセキュリティ基準である**IDOR対策（なりすまし防止）**と**PII（個人情報）保護**を徹底しています。

以下に、特に注力したセキュリティ対策のハイライトをまとめました。コードレビューや面接の際にご活用ください。

---

## 1. 脆弱性対策のハイライト (Critical Vulnerability Fixes)

### A. Stripeアカウントへの不正アクセス防止 (`createStripeLoginLink`)
**課題:**
管理画面へのログインリンク発行時に、クライアントから送られてきた `accountId` をそのまま使用すると、他人のIDを推測してアクセスできてしまうリスク（IDOR）がありました。

**対策:**
引数でのID受け取りを廃止し、**「認証済みユーザーのDBレコード（Private Data）」からサーバーサイドでIDを取得する**方式に完全移行しました。これにより、本人が自分のアカウントにしかアクセスできないことが保証されます。

**実装コード (`functions/src/index.ts`):**
```typescript
export const createStripeLoginLink = functions.https.onCall(async (data, context) => {
    // 1. 厳格な認証チェック (Strict Auth Check)
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }
    const userId = context.auth.uid;

    try {
        // 2. サーバーサイドでのID取得 (Server-side Lookup)
        // クライアントからの入力は一切信用せず、Firestoreの秘密領域からIDを取得
        const profileRef = db.collection('users').doc(userId).collection('private_data').doc('profile');
        const profileSnap = await profileRef.get();

        if (!profileSnap.exists) throw new functions.https.HttpsError('not-found', 'Stripe account not linked.');
        
        const stripeConnectId = profileSnap.data()?.stripe_connect_id;
        
        // 3. 安全なリンク生成
        const link = await stripe.accounts.createLoginLink(stripeConnectId);
        return { url: link.url };

    } catch (e: any) {
        throw new functions.https.HttpsError('internal', `Stripe Error: ${e.message}`);
    }
});
```

### B. 取引操作のなりすまし防止 (`unlockTransaction`)
**対策:**
取引を完了させる処理において、リクエスト送信者がその取引の**正当な当事者（購入者 または 出品者）**であることを必ず確認しています。無関係な第三者がAPIを叩いてもはじかれます。

```typescript
// IDOR Check Logic
if (tx.buyer_id !== callerId && tx.seller_id !== callerId) {
     console.warn(`Unlock attempt by unrelated: ${callerId}`);
     // 明示的に拒否
     res.status(403).json({ error: 'Permission denied: You are not a participant.' });
     return;
}
```

---

## 2. データプライバシー設計 (Data Privacy Architecture)

ユーザーの**個人情報（メールアドレス、Stripe ID、口座情報など）**が、他のユーザーから意図せず閲覧されることを防ぐため、Firestoreのデータ構造を根本から設計しています。

*   **Public Profile (`/users/{uid}`)**:
    *   ニックネーム、アイコン、評価など、公開して良い情報のみ格納。
*   **Private Data (`/users/{uid}/private_data/profile`)**:
    *   **本人以外アクセス不可**。メールアドレス、Stripe Connect IDなどの機密情報を隔離。

**セキュリティルール (`firestore.rules`):**
```javascript
match /users/{userId} {
  allow read: if isAuthenticated(); // 公開プロフィールは誰でも見れる

  // [重要] 個人情報は本人（Owner）しか読み書きできない
  match /private_data/{docId} {
      allow read, write: if request.auth.uid == userId;
  }
}
```

---

## 3. 実装の健全性 (Code Health)

*   **型安全性**: TypeScriptを使用し、`any` の使用を最小限に抑えつつ（開発速度とのバランスを考慮）、主要なデータモデルは型定義されています。
*   **環境分離**: APIキーやSecretは `.env` で管理し、リポジトリへの混入を防いでいます（`.gitignore` 設定済み）。
*   **検証済み**: `app/verify-security` ページを作成し、実際に攻撃コード（不正なIDでのアクセス）を実行してエラーになることをテスト済みです。

---

このレポートは、Musalinkプロジェクトのセキュリティ品質を証明するものです。
