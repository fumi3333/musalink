# Musalink セキュリティ・リーガル統合監査レポート
**監査実行日**: 2026年5月13日  
**監査対象**: `c:\musashino link` (fumi3333/musalink)  
**エージェント1**: リーガル・コンプライアンス担当（法律家）  
**エージェント2**: セキュリティ・決済アーキテクト

---

## エージェント1：リーガル・コンプライアンス監査

### ✅ 適合している事項

| 項目 | 根拠 | 評価 |
|------|------|------|
| 特商法（特定商取引法）表記 | `/app/legal/trade/page.tsx` が存在し、運営者・所在地・連絡先・販売価格・支払方法・引渡時期・返品ポリシーが記載されている | ✅ 適合 |
| 資金決済法（仮押さえ決済構造） | 購入時は「仮売上（Authorize-Only）」で資金保留し、受け渡し確認後にキャプチャする仮押さえ決済構造を採用。代金は直接Stripeに預けられ、プラットフォームが保管することはない | ✅ 適合 |
| プライバシーポリシー | `/app/legal/privacy/page.tsx` が存在し、収集情報・利用目的・第三者提供・安全管理措置が記載されている | ✅ 適合 |
| クレジットカード情報の非保存 | プライバシーポリシー第1条に「カード情報はStripeが直接取り扱い、当サービスには保存されない」と明記 | ✅ 適合 |
| 事業者禁止ポリシー（JCB対応） | 利用規約第2条1項・特商法表記ページに「非事業者（学生個人）限定、事業者出店禁止」の文言を2026年5月12日に追加済み | ✅ 適合 |
| 利用規約 | `/app/legal/terms/page.tsx` に適用範囲・利用資格・禁止事項・免責・準拠法・管轄裁判所を記載 | ✅ 適合 |

---

### 🔴 HIGH：早急な対応が必要な法的リスク

#### H-L1：プライバシーポリシーに「個人情報の保存期間・削除ポリシー」の記載がない
- **根拠法令**: 個人情報保護法 第19条（利用目的の達成に必要な範囲を超えた保管の禁止）
- **問題**: プライバシーポリシーに「退会後のデータをいつ削除するか」「取引完了後の取引履歴をいつまで保持するか」の記載が一切ない。C2Cプラットフォームとして、最低限「退会後○ヶ月で削除する」または「法令上の義務がある場合を除き削除する」の記述が必要。
- **修正案（プライバシーポリシーへの追記）**:
```
第6条（個人情報の保管期間）
当サービスは、利用目的の達成に必要な範囲内で個人情報を保管します。ユーザーが退会した場合、当サービスは法令上の保管義務がある場合（会計帳簿の保管義務等）を除き、退会後90日以内に個人情報を削除します。ただし、取引完了後の取引記録は、不正行為の調査・対応のため、取引完了から1年間保管することがあります。
```

#### H-L2：プライバシーポリシーに「Cookieおよびアクセス解析ツール（Firebase Analytics）についての記述」がない
- **根拠法令**: 電気通信事業法 第27条の12（Cookie等の情報送信に関する通知義務）、2023年6月改正施行
- **問題**: Firebase Analyticsを利用しているにもかかわらず（`NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-7SLDW6Y0J3`）、Cookie・計測ツールの利用に関する告知がプライバシーポリシーに記載されていない。
- **修正案**:
```
第7条（アクセス解析・Cookie）
当サービスはGoogle Firebase Analyticsを使用しており、ユーザーのアクセスデータ（IPアドレス、閲覧ページ、滞在時間等）を収集・分析しています。このデータはGoogleのプライバシーポリシーに基づき管理されます。これらの計測データはユーザーを特定するために使用しません。詳細はGoogleのプライバシーポリシー（https://policies.google.com/privacy）をご参照ください。
```

---

### 🟡 MEDIUM：中期的な対応推奨

#### M-L1：資金移動業登録の要否検討
- **根拠法令**: 資金決済法 第37条（資金移動業の登録義務）
- **現状**: Stripe Connectの仮押さえ決済構造により、「資金の受入れ・移転」はすべてStripe（資金移動業者）が行う。Musalink自身はStripeを「代理人・仲介者」として利用しており、直接資金を保管しない構造であるため、**現時点では資金移動業登録は不要と判断される**。
- **推奨**: Stripe Connectを正しく利用し続ける限り問題なし。ただし将来的に「Musalinkのウォレット機能」「ポイント付与・使用」などを実装する場合は資金移動業登録が必要になる可能性があるため、事前に弁護士へ相談すること。

#### M-L2：未成年ユーザーへの対応ポリシーの欠如
- **問題**: 学生限定サービスであるが、未成年（高校から大学1年生に上がったばかり）が存在する可能性がある。クレジットカード決済を行う場合、民法上の「未成年者取消権」の問題が生じる。利用規約に「18歳未満の利用は保護者の同意が必要」等の記載を検討すること。

#### M-L3：問い合わせ窓口のプレースホルダーURLの残存
- **該当ファイル**: `/components/layout/Footer.tsx` L21
- **問題**: `href="https://forms.google.com/your-form-id"` というプレースホルダーURLが残っている。実際の問い合わせフォームURLと差し替える必要がある。

---

## エージェント2：セキュリティ・決済アーキテクト監査

### ✅ 適合している事項

| 項目 | 根拠 | 評価 |
|------|------|------|
| Stripe Webhookの署名検証 | `stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret)` で正しく検証している（L912） | ✅ 適合 |
| Firebase Auth IDトークン検証 | 全HTTPSエンドポイントで `admin.auth().verifyIdToken(idToken, true)` を実施（`true`でRevocation Checkも有効） | ✅ 適合 |
| 学内メール認証強制 | Firestoreルールの `isVerifiedStudent()` で `@stu.musashino-u.ac.jp` / `@musashino-u.ac.jp` 以外を完全排除 | ✅ 適合 |
| クライアントからのフィールド改ざん防止 | `transactions`ルールで `unlocked_assets` `is_demo` のクライアント書き込みを完全ブロック（L78-79） | ✅ 適合 |
| Stripe Connect IDのサーバーサイド管理 | クライアントは `stripe_connect_id` を送信できず、Cloud FunctionsがFirestoreのprivate_dataから直接取得する設計 | ✅ 適合 |
| APIキーのコード非埋め込み | TypeScript/TSX ファイル内に `sk_test`, `sk_live`, `pk_test`, `pk_live` のハードコードはゼロ（grep結果で確認済み） | ✅ 適合 |
| stripe_accountsコレクション | Firestoreルールで `allow read, write: if false` でクライアントからのアクセスを完全遮断 | ✅ 適合 |
| メッセージ改ざん・削除の防止 | `messages`サブコレクションで `update, delete: if false`を設定し、証跡の完全性を保護 | ✅ 適合 |
| 状態機械（ステートマシン）の強制 | Firestoreルールでトランザクション状態の不正遷移をサーバー側で防止 | ✅ 適合 |
| Huskyによるシークレットスキャン | コミット時に `scripts/check-secrets.js` が自動実行され、APIキーの誤コミットを防止 | ✅ 適合 |

---

### 🔴 HIGH：早急な対応が必要なセキュリティリスク

#### H-S1：Firestoreルールに「匿名ログイン（Anonymous）」が混入している（最重要）
- **該当行**: `firestore.rules` L21
```javascript
// 問題のあるコード（現在のルール）
request.auth.token.firebase.sign_in_provider == 'anonymous'
```
- **問題**: `isVerifiedStudent()` ヘルパー関数の中に、匿名認証ユーザー（学籍未確認の第三者）がアイテムを出品・取引できてしまう抜け穴が存在する。本番公開前に必ず削除または条件を絞る必要がある。
- **修正案**:
```javascript
// 修正後（匿名認証を完全に除外）
function isVerifiedStudent() {
   return isAuthenticated() && (
     request.auth.token.email.matches('.*@stu\\.musashino-u\\.ac\\.jp$') ||
     request.auth.token.email.matches('.*@musashino-u\\.ac\\.jp$')
   );
}
```
> ※デモアカウント（`demo@musashino-u.ac.jp`）はドメインチェックで通過するため、このエントリも削除してもデモは機能する。

#### H-S2：Webhookエンドポイントのエラー応答が詳細すぎる
- **該当行**: `index.ts` L915
```typescript
// 問題のあるコード
res.status(400).send(`Webhook Error: ${err.message}`);
```
- **問題**: Webhookの署名検証に失敗した際のエラーメッセージ（`err.message`の内容）をそのままHTTPレスポンスに含めている。攻撃者にシステム内部情報を漏洩するリスクがある。
- **修正案**:
```typescript
// 修正後
console.error(`Webhook signature verification failed: ${err.message}`);
res.status(400).send('Bad Request');
```

---

### 🟡 MEDIUM：中期的な対応推奨

#### M-S1：`items`コレクションの読み取りが完全パブリック（未認証でも読める）
- **該当行**: `firestore.rules` L45 `allow read: if true;`
- **問題**: 未認証ユーザー（ログインなし）でもアイテム一覧・詳細を読み取れる設計になっている。武蔵野大学学生専用サービスとしては、出品情報も認証済みユーザーのみに限定するのが望ましい。
- **推奨修正**: `allow read: if isAuthenticated();` に変更を検討。SEO目的なら現状維持でも可。

#### M-S2：Cloud Functions の `runtimeconfig` とSecret Managerの未統合
- **問題**: 現在、Stripe Secretキーは `firebase functions:config:set stripe.secret='sk_...'` という旧来の `runtimeconfig` で管理されている（L18の `functions.config().stripe?.secret`）。
- **推奨**: Firebase Functions v2 および Google Cloud Secret Manager への移行を推奨。`runtimeconfig` はFirebase Functions v2では非推奨（deprecated）になっており、Secret Managerの方がより安全でアクセス制御・監査ログも充実している。
- **移行コスト**: 低〜中（環境変数の書き方を変えるのみで、ロジックの変更は不要）

#### M-S3：`payout_requests`コレクションに `update` ポリシーがない
- **該当行**: `firestore.rules` L125 `allow update: if false;`
- **評価**: `update: if false` で正しく書き込みを防止しているが、出金リクエストが承認済みになった後のステータス更新をCloud Functions経由でのみ行う設計が維持されているか、定期的に確認が必要。

---

### 🟢 LOW：小さな改善点

#### L-S1：Cloud FunctionsのCORSに `localhost:3000` が含まれていないかを確認
- **該当ファイル**: `/functions/src/config.ts`
- **推奨**: `allowedOrigins` の配列に、開発環境用の `http://localhost:3000` が**本番環境のCloud Functionsにデプロイされる際に含まれていないか**を再確認すること。

#### L-S2：ログにUID・StripeAccount IDが記録されている（PII漏洩リスク）
- **該当行**: `index.ts` L122, L245, L943, L958
- **問題**: Cloud Functionsのログ（Google Cloud Logging）に `userId` や `stripeConnectId` が出力される。Google Cloudのロギングサービスは適切なIAMで保護されているが、将来的に監査・コンプライアンス要件が厳しくなった際に問題になる可能性がある。
- **推奨**: ログには内部IDのハッシュ値を使うか、または本番環境ではログレベルをINFO以上に絞ることを検討。

---

## 📊 総合スコアカード

| カテゴリ | 適合 | HIGH | MEDIUM | LOW |
|---------|------|------|--------|-----|
| リーガル | 6 | 2 | 3 | 0 |
| セキュリティ | 10 | 2 | 3 | 2 |
| **合計** | **16** | **4** | **6** | **2** |

## 🎯 本番ローンチ前に必ず対応すべき最重要事項（P0）

1. **H-S1**: Firestoreルールから「匿名認証（anonymous）」の抜け穴を削除する
2. **H-L1**: プライバシーポリシーに「データ保存期間・削除ポリシー」を追記する
3. **H-S2**: Webhookエラーレスポンスから内部エラーメッセージの漏洩を防ぐ
4. **H-L2**: プライバシーポリシーに「Firebase Analytics/Cookieの利用告知」を追記する
5. **M-L3**: Footerの問い合わせフォームURLのプレースホルダーを実際のURLに差し替える

---
*このレポートはAI（Antigravity）による自動コード解析に基づいています。法的助言は専門の弁護士にご確認ください。*
