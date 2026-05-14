# Musalink 開発・運営ログ (Development & Operations Log)

このファイルは、Musalink（武蔵野大学学生限定教科書マッチングプラットフォーム）の開発・変更履歴、Stripe や銀行などの運営ステータス、学内調整などの経緯を時系列で「日記」として記録し、いつでも振り返られるようにするためのものです。

---

## 📌 現在のプロジェクト状況 (2026年5月12日 時点)

### 💳 Musalink / Stripe のステータス
* **JCB審査の停滞**: 3月に本番決済（Visa/Mastercard等）は承認されましたが、JCBブランドのみ「コンプライアンスチェックリスト」が未提出のため、現在支払いが制限されています。
* **技術構成**: Stripe Connect (Express) を利用したC2C決済フローを構築済みです（Next.jsから直接 Firebase Cloud Functions をセキュアに呼び出す構成へ移行完了）。
* **大学側の規約対応**: 石原真三子先生を通じて、学内の「物品販売禁止」規約に抵触しないよう、特例認可に向けた相談を継続しています。
* **将来構想**: プロジェクトの収益を、対人データ解析OS「ZAX」へ再投資する計画を持っています。

### 🏦 楽天銀行の状況
* **役割**: Stripeからの売上入金先（振込指定口座）として設定されています。
* **稼働状況**: 直近（5月11日）にシステムメンテナンスの通知がありますが、口座自体は正常に稼働しており、5月分の会員ステージ更新も完了しています。
* **過去の検討事項**: サーバー代（Vercel/Firebase等）の支払いに楽天銀行のデビットカードを使用する運用や、他行との管理比較を検討していました。

---

## 📅 時系列 開発・運営日記 (Logs)

### 2026年5月12日 (火)
本日、Stripe（JCB）から届いた審査保留メール（「事業者情報の不備」の指摘）の対応と、以前指摘されていたキャンセル理由のバグ修正を行いました。

#### 1. 🛠️ 【バグ修正】キャンセル理由フィールドの一意の統一（P1）
* **対象ファイル**: 
  * [functions/src/index.ts](file:///c:/musashino%20link/functions/src/index.ts#L308)
* **対応内容**:
  * 24時間オートタイムアウト (`cancelStaleTransactions`）時にデータベースに書き込まれていた `cancellationReason: "auto_timeout_24h"` を、クライアント（フロントエンド）の表示スキーマに合わせて `cancel_reason: "auto_timeout_24h"` に修正。
  * 管理者強制キャンセル (`adminCancelTransaction`）時に書き込まれていた `cancellationReason` を、同様に `cancel_reason` に統一。
* **効果**: 取引完了前、自動キャンセルや管理者キャンセルが行われた際も、ユーザー詳細画面（`TransactionDetailView`）上でキャンセル理由が正常に表示されるように整合性を保ちました。

#### 2. 🛡️ 【JCB審査対策】利用規約および特商法表記ページへの「事業者利用禁止」の明記
* **対象ファイル**:
  * [app/legal/terms/page.tsx](file:///c:/musashino%20link/app/legal/terms/page.tsx#L41) (利用規約)
  * [app/legal/trade/page.tsx](file:///c:/musashino%20link/app/legal/trade/page.tsx#L12) (特定商取引法に基づく表記)
* **対応の背景**:
  * JCB審査官からの「一般学生（非事業者）なのか販売業者（事業者）なのかが、サイト上の記載から判断がつかないため、店子登録不要事業者の審査を保留にしている」という指摘に対応。
* **対応内容**:
  * 利用規約第2条1項に、「*本サービスは非事業者である個人のみの利用を目的としており、販売を目的とする事業者（ストア等）による出店や商取引行為は一切認めておりません。*」という文言を追加。
  * 特定商取引法に基づく表記ページに、「*本サービスは事業者（店舗等）の出店を認めておらず、出品者は非事業者である学生個人に限られます。*」という文言を追加。
* **効果**: これにより、松田さんがStripeの「店子登録不要事業者の加盟に係るチェックシート」を提出した際、JCB審査官がサイト内の規約と特商法ページを見て「確かに事業者の出店を明確に禁止している安全な学生専用アプリである」と一発で確信し、JCB審査をパスしやすくなる強固なアピール材料を整えました。


### 2026年5月13日 (水)
本日、本番リリースに向けた必須要件である「テスト環境（Sandbox）と本番環境（Production）の完全な分離（マルチ環境設計）」の土台構築を行いました。

#### 3. 🧪 【マルチ環境設計】テスト環境と本番環境の完全な分離
* **対象ファイル**:
  * [.firebaserc](file:///c:/musashino%20link/.firebaserc) (Firebase プロジェクト管理)
  * [.env.development](file:///c:/musashino%20link/.env.development) (Next.js 開発・テスト環境変数)
  * [.env.production](file:///c:/musashino%20link/.env.production) (Next.js 本番環境変数テンプレート)
* **対応内容**:
  * Firebase 設定に本番用のエイリアス `"production": "musa-link-prod"` を追加。
  * ローカル開発やSandbox決済デモ用のテスト環境を、テスト用APIキーやテストプロジェクトで安全に検証し続けられるよう `.env.development` に完全分離。
  * 一般公開用の本番カード決済設定を、`.env.production` にテンプレートとして新規作成。
* **効果**: 今あるテスト用のFirebaseプロジェクトを「開発・検証用サンドボックス」として維持したまま、新しい本番環境プロジェクトを完全に独立させて並行稼働できるようになりました。これにより、テスト環境で実際に「クレジットカード決済デモ（ダミー決済）」の受け渡し確認を行いながら、安心して本番公開を両立できるプロフェッショナルなインフラ構成を構築しました。

#### 💡 【重要】松田さんとの合意・環境ルール
* **今使っているURL (`musa-link.web.app` など)**:
  * ➡ **「テスト用（サンドボックス環境）」** として完全に固定されました。ダミーカード決済によるデモテストをいつでも自由に行える安全な場所です。
* **新しく今後作成するURL (`musa-link-prod...` など)**:
  * ➡ **「本番用（本物カード決済環境）」** になります。一般の学生がリアルに売買を行う場所です。

#### 🏷️ 「エイリアス」についての超簡単なまとめ
「エイリアス（Alias）」とは、IT用語で**「あだ名（ショートカット）」**のことです。
* **本名**: 長くて複雑なFirebaseのプロジェクト名（例：`musa-link-production-12345`）
* **あだ名（エイリアス）**:
  * テスト環境 ➡ **`default`**
  * 本番環境 ➡ **`production`**
* **メリット**: コマンドを入力する際、毎回長くて複雑な本名を入力する代わりに、`firebase use production`（本番のあだ名！）と入力するだけで、システムが自動的に本番環境を紐づけて切り替えてくれる便利なショートカット機能です。

---

### 2026年5月14日 (木)
本日、対面でのQRコードスキャンおよびStripe決済・Cloud Functionsの非同期処理に存在していた8つの重大なバグ・欠陥をすべて修正し、決済フローの堅牢化を完了しました。

#### 🛠️ 【決済・取引フローの不具合修正】QRスキャナー・ステータス遷移の堅牢化
* **対象ファイル**:
  * [functions/src/index.ts](file:///c:/musashino%20link/functions/src/index.ts) (Cloud Functions 決済ロジック)
  * [components/transaction/QRCodeScanner.tsx](file:///c:/musashino%20link/components/transaction/QRCodeScanner.tsx) (QR読み取りスキャナー)
  * [components/transaction/StripePaymentForm.tsx](file:///c:/musashino%20link/components/transaction/StripePaymentForm.tsx) (Stripe決済フォーム)
  * [components/transaction/TransactionDetailView.tsx](file:///c:/musashino%20link/components/transaction/TransactionDetailView.tsx) (取引詳細画面UI)
* **対応内容**:
  1. **QRスキャナー二重発火・カメラ起動不可の防止**: `QRCodeScanner.tsx` を全面的に書き換え。React 18の StrictMode による二重マウントを考慮したインスタンス管理と、`useRef` を用いたクロージャ・古いstateの参照バグを修正。さらにスキャン成功時にDOM要素を削除すると `scanner.clear()` がクラッシュする問題を回避するため、コンテナをCSS（`hidden`）で維持する設計に変更。
  2. **Webhook/非同期処理のステータス不整合修正**: `functions/src/index.ts` の `processUnlock` にて、ステータスが `payment_pending` 時にも正しくアンロック処理へ進めるように条件を拡張。
  3. **金額表示の動的化**: `StripePaymentForm.tsx` に `amount` プロパティを追加し、「100円を支払う」という固定表示から、実際の商品価格を反映した表示へ修正（景表法・ユーザー保護の遵守）。
  4. **自動キャンセルの対象ステータス修正**: 定期実行バッチ `cancelStaleTransactions` が対象とするステータスリストに `request_sent`, `approved`, `payment_pending` を設定。
  5. **フォールバック処理の完全化**: `unlockTransaction` に `stripe.paymentIntents.capture()` と個人情報アンロックのロジックを追加し、手動完了時にも確実に売上が確定するように強化。
  6. **QRコード生成の安定化**: `TransactionDetailView.tsx` のQR生成において `nonce: Date.now()` を排除し `useMemo` で安定化。画面更新によるQRのチラつき・読み取り失敗を防止。
  7. **デバッグボタンの本番隠蔽**: 強制完了ボタンを `process.env.NODE_ENV === 'development'` で囲み、本番環境への露出を完全遮断。
  8. **手数料記録の徹底**: `capturePayment` および `processUnlock` 内で商品価格を取得し、確定時のデータベース更新に `fee_amount` を必ず記録するように修正。
  9. **QR読み取りエラー時の自動リカバリー機能**: 無効なQRコードを誤スキャンした場合や、キャンパス内での通信エラーが発生した際に、カメラと画面がフリーズして進行不能になるUXの欠陥を発見。エラー表示後に自動でコンポーネントを再起動（`scanKey`をインクリメント）させ、リロードなしで即座に再スキャンできる自己復帰処理を実装。
* **効果**: 学生がキャンパスで対面取引を行う際、確実にカメラが起動し、1回のスキャンで決済と個人情報のアンロックがセキュアかつスムーズに完了する本番品質のフローを確立しました。

---

