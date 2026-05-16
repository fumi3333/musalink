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

#### 🚀 【インフラ・UX・セキュリティの最終調整】(同日 午後)
本番リリースを見据え、システム全体の潜在的なリスク（炎上や技術的負債になり得る箇所）を洗い出し、以下の4点を修正しました。

1. **【UX】LINEアプリ内ブラウザの外部起動強制パラメータ (`?openExternalBrowser=1`) の導入**
   * **対象**: `functions/src/notifications.ts`, `components/layout/InAppBrowserGuard.tsx`
   * **内容**: iOSのLINEアプリ内ブラウザで開くとカメラが起動しない仕様を根本的に解決するため、通知メール等で送信される取引URLの末尾にLINE専用の魔法のパラメータ `&openExternalBrowser=1` を付与するように修正。これにより、LINEのトーク画面でリンクをタップした際、自動的にLINEブラウザを飛び出して Safari / Chrome が一発で開く画期的なUXを実現しました。
2. **【UX】取引キャンセル時の通知漏れの修正**
   * **対象**: `functions/src/notifications.ts`
   * **内容**: 24時間の自動キャンセルや、相手都合でのキャンセルが行われた際、システム上は処理されても「通知」が一切飛ばない仕様になっていました。これでは「取引が消えた」とクレームになるため、キャンセル時に両者（または影響を受ける側）へ自動でメール・アプリ内通知が飛ぶように `onTransactionUpdated` に処理を追加しました。
3. **【セキュリティ】GitHubの依存パッケージ脆弱性（129件）の解消**
   * **対象**: `package.json`, `pnpm-lock.yaml`
   * **内容**: GitHub Dependabot が警告していた129件のパッケージ脆弱性（うち4件Critical）について、`pnpm audit --fix` と `pnpm install` を実行し、古いReact/Next.js周辺のライブラリのセキュリティパッチを適用しました。
4. **【インフラ】Cloud FunctionsのNode.js 22へのアップグレード**
   * **対象**: `functions/package.json`
   * **内容**: デプロイ時に「Node.js 20は半年後にサポート終了する」という警告が出ていたため、将来的な稼働停止を防ぐべく、エンジンの指定を `"node": "22"` に引き上げました。

※ **運用メモ (Stripe JCB審査について)**
Stripe/JCBへコンプライアンスチェックリストを提出後、3日ほど音沙汰がないとのことですが、これは正常です。JCBの「店子登録不要事業者」などの特殊な審査は、通常1週間〜2週間程度（営業日ベース）かかることが多く、特に規約の目視確認などが入るため時間がかかります。来週半ばまで待って進展がなければ、Stripeサポートへ進捗のフォローアップメールを送ることをお勧めします。

---

#### 🔍 【本番テスト前のワークフロー深掘り・通知ロジックの改善】(同日 深夜)
松田さんが友人とテストを行う前に、決済と受け渡しの全フェーズ（各ステータス遷移）をコードレベルで深く再検証しました。結果、決済ロジック自体は極めて堅牢でしたが、「ユーザーへの通知（メール・アプリ内通知）」のタイミングに大きな見落としを発見し、修正しました。

1. **フェーズ分析と堅牢性の確認**:
   * **Phase 1〜2 (リクエスト〜承認)**: Firestore Rulesにより、買い手と出品者のみが安全にステータスを変更できることを確認済。
   * **Phase 3 (支払いの枠確保 / `payment_pending`)**: クライアントからStripeの `confirmPayment` を実行し、成功時のみステータスを更新。Firestore RulesとCloud Functionsのバリデーションにより、不正な改ざんは不可能。
   * **Phase 4〜5 (対面QRスキャン〜売上確定 / `completed`)**: 買い手がQRをスキャンすると、セキュアな関数 `capturePayment` が発動し、Stripeの売上確定処理（Capture）、手数料の記録、個人情報（学生証/メアド）のアンロックが完全に同期して実行されることを確認。

2. **🛠️ 【通知のバグ修正】「枠確保」と「完了」の通知タイミングの適正化**:
   * **バグの内容**: これまで、買い手がクレジットカードで「支払いの枠確保（`payment_pending`）」を行った際、**出品者に通知がいかない**という致命的なUXの欠陥がありました。これでは、出品者は「いつキャンパスに行けばいいのか」分かりません。また、取引完了時（`completed`）の通知文章が「支払いが完了しました。商品の受け渡しを行ってください」となっており、実態（QRスキャン＝既に受け渡し済み）と矛盾していました。
   * **修正内容** (`functions/src/notifications.ts`):
     * 買い手がカード枠を確保した瞬間に、出品者へ「支払いの枠確保が完了しました！チャットで連絡を取り、キャンパス内で商品の受け渡しを行ってください。」という通知を飛ばす機能を追加。
     * 取引完了時（QR読み取り後）の通知文章を「受け渡し（QR認証）が完了し、売上が確定しました！」という正しい完了メッセージに修正。
   * **効果**: これにより、テスト時および本番環境において「次に誰が何をすべきか」が明確になり、待ち合わせのすれ違いや取引の停滞を完全に防止できるようになりました。

---

### 2026年5月16日 (金)
本日、Claude（AIアシスタント）と共同で**コンプライアンス・セキュリティ統合監査**を実施し、5件の重大・高リスク事項を一気に修正しました。きっかけは「『エスクロー』という用語が資金決済法リスクになり得る」「取引内チャットが電気通信事業法に抵触するため削除した」というユーザーからの法務上の懸念で、それを起点にプロジェクト全体を再点検した結果、削除が中途半端だった箇所や、過去の監査（5/13）で指摘済みだが未対応だった項目を一括処理しました。

#### 0. 🗂️ 【ドキュメント整備】用語統一とCLAUDE.mdの新設
* **対象**: `README.md`, `README_EN.md`, `CODE_REVIEW.md`, `docs/TECH_STACK_EXPLANATION.md`, `COMPLIANCE_AUDIT_2026_05_13.md`, `types/index.ts`
* **内容**: 資金決済法リスクを避けるため、コードベース全体から「エスクロー / escrow / Escrow」の用語を排除し、「仮押さえ決済」「安全な決済フロー」等に置換。さらに、今後のClaude経由の開発で同じ事故を起こさないよう、プロジェクトルートに `CLAUDE.md` を新設し、法務レッドライン・環境ルール・IDOR防止ルール・ログ規約を明記。

#### 1. 🚨 【法務】チャット機能の完全削除（電気通信事業法対応）
* **対象**:
  * [firestore.rules](firestore.rules:100) - `conversations/{conversationId}` および `messages/{messageId}` のルール
  * [functions/src/notifications.ts](functions/src/notifications.ts:86) - `onMessageCreated` 関数
  * [functions/src/notifications.ts](functions/src/notifications.ts:191) - 通知文中の「チャットで連絡を取り」表現
  * [components/transaction/TransactionDetailView.tsx](components/transaction/TransactionDetailView.tsx:496) - 警告ダイアログ内のチャット言及
* **対応の背景**: UI からは削除済みだったが、Firestore Rules・Cloud Functions・通知文面にチャット関連の実装と表現が残存しており、「機能停止」と法的に主張できない状態だった。
* **対応内容**:
  * Firestore Rules で `conversations` と `messages` を `allow read, write: if false;` に変更し、既存データへの読み書きをサーバー側で完全遮断。
  * `onMessageCreated` 関数を削除（Cloud Functions のデプロイ時に該当関数も削除される）。
  * 通知メールから「チャットで連絡を取り」を「取引詳細画面で受け渡し場所を確認し」に修正。
* **効果**: 「ユーザー間の通信（メッセージング）」を提供していないことが法的・実装的に明確化され、電気通信事業法の届出義務リスクが構造的に解消される。

#### 2. 🚨 【セキュリティ】Firestore Rules の Field-Level 制限導入（IDOR/整合性防止）
* **対象**: [firestore.rules](firestore.rules:24) - `users/{userId}` の update ルール
* **問題**: 既存ルールでは `allow update: if isOwner(userId);` のみで、ユーザーが自分自身の `trust_score`, `ratings`, `charges_enabled`, `stripe_connect_id`, `coin_balance`, `is_verified`, `is_admin` などのサーバー管理フィールドを自由に書き換え可能だった。特に `charges_enabled` を偽装すると決済フロー（`createPaymentIntent` 時の `seller.charges_enabled` 検証）を回避できる重大リスク。
* **対応内容**:
  * `userServerOnlyFields()` ヘルパー関数を追加し、サーバー管理フィールド一覧を列挙。
  * `update` 時に `request.resource.data.diff(resource.data).affectedKeys().hasAny(userServerOnlyFields())` が `false` であることを必須化（=これらのフィールドへの差分があれば即座に拒否）。
  * `create` 時も同フィールドを含むドキュメントの作成を拒否。
  * Cloud Functions は Admin SDK 経由でルールをバイパスして書き込めるため、サーバー側ロジックには影響なし。
* **効果**: クライアントからの信頼スコア偽装・KYC回避・管理者権限詐取などのIDOR系攻撃が構造的に不可能になった。

#### 3. 🚨 【セキュリティ】Anonymous 認証バイパスの完全削除
* **対象**: [firestore.rules](firestore.rules:66) - `transactions/{transactionId}` の create ルール
* **問題**: 5/13に「Anonymous auth and demo bypass removed」とコメントが追加されたものの、`transactions` の create ルールには `request.auth.token.firebase.sign_in_provider == 'anonymous'` のとき `is_demo: true` な取引を許可する条件が残存していた。匿名ユーザーがデモ取引を作成できる温床。
* **対応内容**: バイパス条件を削除し、`is_demo` フィールドは `false` または未指定のみ許可する形に変更。
* **効果**: 匿名認証経由の不正な取引作成が遮断され、本番データへの汚染リスクが解消された。

#### 4. 🛡️ 【法務】Cookie/Analytics 同意バナーの実装（電気通信事業法 第27条の12 対応）
* **対象**:
  * [lib/firebase.ts](lib/firebase.ts) - Firebase Analytics の遅延初期化
  * [components/layout/CookieConsentBanner.tsx](components/layout/CookieConsentBanner.tsx) - 新規バナーコンポーネント
  * [app/layout.tsx](app/layout.tsx) - レイアウトへの組み込み
* **問題**: 5/13の監査で指摘されていた、Firebase Analytics をユーザー同意なしで初期化していた問題（電気通信事業法 第27条の12「Cookie等の情報送信に関する通知義務」違反のリスク）が未対応だった。
* **対応内容**:
  * `lib/firebase.ts` から無条件の `getAnalytics()` を撤去し、`initAnalyticsIfConsented()` 関数で localStorage の `musalink_analytics_consent === 'granted'` を確認してから初期化する形に変更。
  * 初回訪問時に `CookieConsentBanner` を画面下部に表示。「同意する」ボタンで Analytics 初期化、「拒否」ボタンで以後トラッキングなし、選択結果は localStorage に永続化。
* **効果**: ユーザーが Cookie/トラッキングを許諾するまで Firebase Analytics は一切起動せず、法的告知義務を満たした上で初めて計測される。

#### 5. 🛡️ 【セキュリティ】管理者判定の Custom Claim 化（ハードコードメール撤廃）
* **対象**: [functions/src/index.ts](functions/src/index.ts:1030) - `adminCancelTransaction` および [functions/src/index.ts](functions/src/index.ts:1128) - `fixSellerStatus`
* **問題**: 管理者権限の判定が `admin@musashino-u.ac.jp` / `fumi_admin@musashino-u.ac.jp` 等のハードコードメールアドレスで行われており、当該メールが乗っ取られたら全権限を奪取される構造だった（実際の Firestore Rules 側は既に `request.auth.token.admin == true` で Custom Claim を要求する形だったが、Cloud Functions 側だけメール認証が残っていた）。
* **対応内容**:
  * 両関数の admin チェックを `context.auth?.token.admin === true` および `decoded.admin === true` に統一。
  * Custom Claim は `admin.auth().setCustomUserClaims(uid, { admin: true })` を Firebase Functions Shell または Admin SDK 経由で個別に付与する運用に切替（=本番デプロイ前に明示的に管理者ユーザーへ付与する必要あり。**運用メモ参照**）。
* **効果**: メールアドレス乗っ取りによる管理者権限奪取が不可能になり、Firestore Rules と Cloud Functions の認可ロジックが Custom Claim ベースに完全統一された。

#### 📋 運用メモ・残課題
* **デプロイ前必須作業**: `adminCancelTransaction` / `fixSellerStatus` を使う管理者ユーザーには、デプロイ前に手動で Custom Claim を付与する必要がある:
  ```
  // Firebase Functions Shell or Admin SDK script:
  await admin.auth().setCustomUserClaims(uid, { admin: true });
  ```
  対象UIDは Firebase Console の Authentication タブから確認可能。付与漏れがあると管理者操作が全て 403 になる。
* **Firestore Rules のデプロイ**: 今回の変更後、`firebase deploy --only firestore:rules` を必ず実行すること。Cloud Functions も `firebase deploy --only functions` で `onMessageCreated` の削除を反映させる。
* **次の優先対応**:
  1. プライバシーポリシーへの Cookie/Analytics 取扱いの明記（5/13監査の H-L2 として既に指摘あり、文言は監査レポート参照）
  2. プライバシーポリシーへの保管期間明記（H-L1）
  3. Firestore Rules のユニットテスト導入（`@firebase/rules-unit-testing` で今回の修正が二度と退行しないように）

#### 6. 📜 【法務】プライバシーポリシーの整合性アップデート（同日 追加対応）
* **対象**: [app/legal/privacy/page.tsx](app/legal/privacy/page.tsx)
* **問題**:
  * 第1条で「取引情報（…取引チャットの内容）」と記載があり、チャット機能削除後の実態と矛盾していた。
  * 第7条が「Firebase Analytics を使用しています（断定）」となっていたが、Cookie同意バナー導入後は「同意を得た場合にのみ実行する」という運用に変わったため、文言が不正確だった。
* **対応内容**:
  * 第1条：「取引チャットの内容」を「取引ステータス、受け渡し場所等」に置換。
  * 第7条：Firebase Analytics の利用は **明示的同意取得後にのみ初期化する** 旨を追記。同意撤回方法（お問い合わせ窓口経由）も明示。電気通信事業法 第27条の12 への対応をポリシー文面上でも明確化。

#### 7. 🧪 【品質】Firestore Rules ユニットテストの土台整備
* **対象**:
  * [tests/rules/firestore.test.ts](tests/rules/firestore.test.ts) (新規)
  * [tests/rules/vitest.config.ts](tests/rules/vitest.config.ts) (新規)
  * [tests/rules/README.md](tests/rules/README.md) (新規)
  * [package.json](package.json) - `test:rules` スクリプトと `@firebase/rules-unit-testing` / `vitest` の devDependencies 追加
* **対応の背景**: 今回手で潰した重大バグ（チャット削除、サーバーフィールドのロックダウン、Anonymous bypass）は、テストがなければ将来うっかり退行させる可能性が高い。`@firebase/rules-unit-testing` を使った Firestore Emulator ベースのユニットテストで保護する。
* **対応内容**: 以下のケースを実装した（合計7ケース）。
  * `users/{uid}`: 自分の `display_name` は更新できる
  * `users/{uid}`: 自分の `trust_score`, `charges_enabled`, `stripe_connect_id` を書き換えようとすると失敗する
  * `conversations/{id}` の読み取り・`messages/{id}` の作成がすべて拒否される
  * Anonymous 認証で `is_demo: true` の取引を作成できない
  * 学内ドメインユーザーは通常の取引を作成できる
* **実行方法**: 別ターミナルで `firebase emulators:start --only firestore` を起動した上で `pnpm test:rules` を実行する。詳細は [tests/rules/README.md](tests/rules/README.md) 参照。
* **効果**: 今回の修正が CI でも検証可能になり、将来のリファクタリングや権限変更時に Firestore Rules の重大バグが事前検出されるようになった。

#### 8. 🔒 【セキュリティ】依存パッケージ脆弱性（minimatch ReDoS）への対応
* **対象**: [package.json](package.json) - `pnpm.overrides` に `minimatch@>=10.0.0 <10.2.3: ">=10.2.3"` を追加
* **問題**: `pnpm audit` で High Severity の ReDoS 脆弱性（CVE-2026-27903）が ESLint の依存である `minimatch@10.2.1` に検出された。本番ランタイムには影響しないが、CI/開発環境でビルド時の DoS リスクがある。
* **対応内容**: pnpm の overrides 機能で脆弱なバージョン範囲を `>=10.2.3` に強制的に置き換え。次回 `pnpm install --force` で全環境に反映される。
* **残課題**: 本コミット時点では `pnpm-lock.yaml` の minimatch 10.2.1 エントリが残っているため、メイン環境で `pnpm install --force` を一度走らせてロックファイルを更新する必要あり。

---

### 2026年5月16日 (金) - main ブランチ直接コミット (PRと並行)

PR `claude/peaceful-pare-9bfd59` が走っている間に、main ブランチ上に未コミットだった機能改善 4 件をクリーンに分割してコミット・プッシュした。価格制限・買い手通知・学部リスト最新化・脆弱性 override の取り込みで、いずれも PR との競合は発生していない（PR は `users/{uid}` セクション、本 main コミットは `items/{itemId}` セクションを触っており別箇所）。

#### 9. 💰 【法務・UX】商品価格の 300〜100,000 円レンジ強制 (7c59921)
* **対象**: [firestore.rules](firestore.rules), [app/items/create/page.tsx](app/items/create/page.tsx)
* **対応内容**:
  * Firestore Rules: `items/{itemId}` の create / update に `price is int && price >= 300 && price <= 100000` を必須条件として追加。
  * 出品フォーム: クライアントサイドバリデーションを「>0」から「>=300」に引き上げ、入力フィールドの `min` 属性も 0→300 に。
* **効果**: 詐欺目的の ¥1 出品・誤入力の ¥0 出品・桁ミスの極端な高額出品を、サーバー・クライアント双方でブロック。特商法ページに記載した価格帯ポリシーとも整合。

#### 10. 📧 【UX】取引完了時の買い手通知の追加 (be85ec3)
* **対象**: [functions/src/notifications.ts](functions/src/notifications.ts)
* **問題**: これまで `completed` 遷移時に通知が飛ぶのは売り手のみ。買い手側には「受け取り・支払いが完了したこと」を明示的に告げる仕組みがなく、後追いの不安や問い合わせ要因になり得た。
* **対応内容**: 既存の `onTransactionUpdated` トリガー内に買い手向けの in-app 通知 + メール送信を追加。スキーマ変更なし。
* **効果**: 双方が「取引完了」のオフィシャルな確認メールを受け取れるようになり、評価フェーズへの遷移がスムーズになる。

#### 11. 🏫 【UX】学部リストを武蔵野大学の現行 13 学部に更新 (d46b241)
* **対象**: [app/items/page.tsx](app/items/page.tsx), [app/mypage/page.tsx](app/mypage/page.tsx)
* **問題**: 検索フィルタの学部リストが旧来の英語キー（"Law", "Economics", ...）のままで、しかも現在の武蔵野大学の全学部（アントレプレナーシップ学部・人間科学部・ウェルビーイング学部・薬学部・看護学部など）が網羅されていなかった。商品ドキュメント側は日本語の学部名で保存されているため、検索しても一致しないケースが発生していた。
* **対応内容**:
  * `items/page.tsx`: 学部セレクトの value を日本語表記に統一し、現行 13 学部を全て列挙。
  * `mypage/page.tsx`: 古い TODO/scratch コメントと dead な lazy-load 注釈を削除（挙動変更なしのクリーンアップ）。
* **効果**: 全学部の学生が自分の所属学部で検索できるようになり、検索ヒット率が向上。

#### 12. 🔒 【セキュリティ】pnpm-workspace.yaml のリポジトリ管理化 (e3f4b34)
* **対象**: [pnpm-workspace.yaml](pnpm-workspace.yaml)（新規）
* **問題**: pnpm-workspace.yaml がローカル untracked のままで、`next`・`minimatch`・`hono`・`brace-expansion`・`picomatch`・`protobufjs` 等の脆弱性パッチ override が個人マシン側にしか存在しなかった。新しくクローンしたメンバーや CI には適用されない。
* **対応内容**: 既存の override リストごとリポジトリに取り込み。チェックインしたことで、`pnpm install` 経由で誰でも同じ安全な依存ツリーが得られるようになった。

---

### 2026年5月17日 (土) - デプロイ可否監査の第2ラウンドと修正

5/16 にコミット 5c17477 で B1〜B3 / W1 / W4〜W6 を入れたあと、**3 並列 Explore subagent**（修正検証 / コード品質 / エッジケース）で多角的に再監査。検証は ✅ だったが、再監査で**新規ブロッカー 3 件 + 強推奨 2 件**が浮上したため、コミット 89296c9 で一気に潰した。

#### 13. 🚨 【整合性】unlockTransaction にも item.status='sold' 更新を追加 (B4)
* **対象**: [functions/src/index.ts](functions/src/index.ts) - `unlockTransaction` の完了処理
* **問題**: W5 の対応で `capturePayment` と `processUnlock` には item を 'sold' に flip するロジックを入れたが、HTTP fallback の `unlockTransaction` だけ更新漏れ。dev の force-complete ボタンや、QR が壊れた時の手動 unlock 経由で完了した商品が「matching」のまま marketplace に残り続ける。
* **対応**: `txRef.update` を WriteBatch にまとめ、`items/{id}.status = 'sold'` を同一 batch で原子的に更新する形に変更。3 つの完了パス（capturePayment / processUnlock / unlockTransaction）で同じ item 遷移が起きるようになった。

#### 14. 🚨 【データ保全】items の delete を `status == 'listing'` 限定に (B5)
* **対象**: [firestore.rules](firestore.rules:75)
* **問題**: 旧ルールは `seller_id == request.auth.uid` のみチェックしており、状態を見ていなかった。seller が `payment_pending` 中（item.status='matching'）に item を削除可能。商品消滅で buyer が決済中の商品情報を確認できなくなる事故が起きうる。`sold` 状態でも削除可能で、取引記録の証跡が消える危険性があった。
* **対応**: `allow delete` に `resource.data.status == 'listing'` を必須条件として追加。出品中の商品しか削除できず、取引開始後・完了後はサーバー（Admin SDK）経由でしか手を入れられない。
* **テスト**: `tests/rules/firestore.test.ts` に「listing は削除可」「matching は削除不可」「sold は削除不可」の 3 ケースを追加。

#### 15. 📜 【手順書】デプロイ手順書から削除済み関数を取り除き、クリーンビルド手順を追加 (B6 + I8)
* **対象**: [docs/DEPLOY_2026_05_16.md](docs/DEPLOY_2026_05_16.md)
* **問題**: 5/16 に `fixSellerStatus` を削除したのに、デプロイ手順書では「これがないと 403 になる」「Functions Console で `fixSellerStatus` の存在を確認」と書かれたまま。`functions/lib/` の古いビルド成果物に削除済み関数の `.js` が残るリスクも未対応だった。
* **対応**: §2 と §4 の `fixSellerStatus` 言及を削除し「2026-05-16 にセキュリティ修正で削除済み」と注記。§4 にクリーンビルド手順（`rm -rf functions/lib && pnpm --prefix functions run build`）と、現存する関数の網羅リストを追加。

#### 16. 🛡️ 【整合性】Stripe API を Firestore Transaction の外へ (W7)
* **対象**: [functions/src/index.ts](functions/src/index.ts) の `capturePayment` および `adminCancelTransaction`
* **問題**: Stripe API 呼び出し（capture / cancel / refund）を Firestore `runTransaction` の中で行っていた。Stripe の応答が遅いと Firestore Tx の 60s 上限に達し、**Stripe では capture/cancel 完了 / DB は未更新**という整合性破壊が発生しうる。
* **対応**: 両関数を 3 フェーズに再構成。
  1. **Phase 1 (Transaction なし)**: 取引を読んで認可・状態チェック
  2. **Phase 2 (Transaction なし)**: Stripe API 呼び出し。`idempotencyKey` を付与して再試行を安全に。Stripe 5xx / `request_timeout` は `HttpsError 'unavailable'`（リトライ可）にマッピング。
  3. **Phase 3 (小さな runTransaction)**: Stripe 成功を確認してから DB 更新のみ実行。冪等性チェックも入れて webhook と client の競合に耐性。
* **効果**: Stripe API が長引いても DB 整合性は壊れない。すべての Stripe 操作に idempotencyKey が付いた（capture / cancel / refund）。

#### 17. 🛑 【UX】updateTransactionStatus の offline silent failure を撤廃 (W8)
* **対象**: [services/firestore.ts](services/firestore.ts:277)
* **問題**: 旧実装は Firestore offline 時に `console.warn` だけ出して **silent success** を返していた。UI には「成功した」と見えるのにサーバーは未反映で、他タブやサーバー側の真実と乖離する。
* **対応**: `error.code === 'unavailable'` を検出したら、日本語の `Error("インターネット接続がありません。オンラインに戻ってから再度お試しください。")` を throw するように変更。呼び出し側（`StripePaymentForm` 等）の既存 catch がそのままユーザーへ伝える。
* **効果**: 「成功したように見えるが実はサーバー未反映」事故が物理的に起きなくなった。

#### 18. 🌐 【UX】UI 表記の日本語化と価格バリデーション同期
* **対象**:
  * [app/items/create/page.tsx](app/items/create/page.tsx) - 価格バリデーション
  * [components/transaction/StripePaymentForm.tsx](components/transaction/StripePaymentForm.tsx) - 失敗時メッセージ
* **対応内容**:
  * `app/items/create/page.tsx`: クライアントの価格チェックを `<= 0` → `< 300` に修正し、Firestore Rules の 300〜100,000 円レンジと完全に同期。`input` 要素にも `min="300" max="100000"` を追加。
  * `StripePaymentForm.tsx`: 旧実装は失敗時に「決済ステータス: requires_payment_method」のように Stripe の英語 enum をそのまま表示していた。日本語の「決済を完了できませんでした。もう一度お試しいただくか、別のカードをご利用ください。（詳細: …）」に変更。DB update 失敗時の文言も `support@musalink.jp` と取引 ID を明示する形に強化。
* **効果**: 一般ユーザー向け文言から英語が消え、エラー復旧導線が明示された。

#### 19. 🧪 【テスト】Firestore Rules テスト拡充 (I12 一部)
* **対象**: [tests/rules/firestore.test.ts](tests/rules/firestore.test.ts)
* **追加カバレッジ**:
  * 価格レンジ強制：299 円 / 100,001 円は create 拒否、300 円 / 100,000 円は許可（境界値）
  * delete rule：listing は削除可、matching と sold は削除不可
  * state machine：buyer / seller どちらからも `payment_pending → completed` の直接遷移が拒否される（Cloud Functions のみ可）
* **効果**: B4 / B5 / W5 のロジックが将来のリファクタリングで退行した際、CI / ローカルテストで即座に検知できる。

---

### 残課題（次セッションへの引き継ぎ）

1. **Next.js 16.1.1 → 16.2.6 系へのセキュリティアップデート**: `pnpm audit` で DoS / SSRF / Middleware bypass 系の脆弱性が **9 件 High 残**。今回のセキュリティ修正とはスコープが違うので別 PR で対応する想定。
2. **Custom Claim 付与の実運用**: 本番管理者 UID に `setCustomUserClaims(uid, { admin: true })` を手動付与する必要あり。手順は [docs/DEPLOY_2026_05_16.md](docs/DEPLOY_2026_05_16.md) §2 参照。スクリプト: [scripts/grant-admin-claim.js](scripts/grant-admin-claim.js)。
3. **本番デプロイ**: `firebase deploy --only firestore:rules,functions,hosting` を、Custom Claim 付与の後に実行する。手順書通り。
4. **Vercel 連携の解除**: GitHub の Apps 設定から Vercel のリポジトリアクセスを外す。Firebase Hosting がメインのため Vercel preview は不要。詳細は [docs/notes/claude-code-permissions-memo.md](docs/notes/claude-code-permissions-memo.md) と CLAUDE.md 参照。
