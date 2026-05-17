# Musalink - Claude 開発ガイドライン

このプロジェクトで作業する際の重要ルール。**毎回このファイルが読まれる**ので、ここに書いた指示は常に有効。

---

## 🎯 プロジェクト概要（短く）

- **武蔵野大学 学生限定 C2C マッチングプラットフォーム**（教科書・物品売買）
- **本番稼働中**（https://musa-link.web.app/）
- **学生個人開発**（fumi3333 = 松田氏）、大学公式ではない
- 決済：Stripe Connect Express + 仮押さえ決済（Authorize/Capture）
- 認証：Google OAuth + 学内ドメイン（@stu.musashino-u.ac.jp）制限

---

## 🚨 絶対ルール（破ったら事故になる）

### 法務レッドライン
- **「エスクロー」という単語を使わない**（資金決済法リスク。「仮押さえ決済」「Authorize/Capture」と呼ぶ）
- **「資金を預かる」「資金を保管する」とも書かない**（Stripeが預かる、と書く）
- 法的な断言（「違法ではない」「法的に問題ない」等）はしない。**必ず「要弁護士確認」を添える**
- 利用規約・特商法・プライバシーポリシーの文言変更時は、本人と相談する
- **取引相手同士のチャット／メッセージ機能は復活させない**（電気通信事業法リスクで2026-05-16に完全削除済み）

### 環境ルール（本番/テスト混同防止）
- `musa-link.web.app` = **テスト環境**（ダミーカード）
- `musa-link-prod` = **本番環境**（本物カード、実取引）
- Firebase プロジェクト・Stripe キー・Firestore データを操作する前に、**今どちらの環境かを宣言してから動く**
- 本番デプロイは [docs/DEPLOY_2026_05_16.md](docs/DEPLOY_2026_05_16.md) の手順に従う

### セキュリティ最優先ルール
過去にテストアカウントへ過大な権限を与えてIDOR脆弱性を作った経緯あり。**同じ事故を二度と起こさない**：

- **クライアント側のフラグ（is_admin など）をサーバーで信頼しない**
- Firestore Rules では「リソースのowner == request.auth.uid」を**第一条件**にする
- Cloud Functions では受信した uid を信用せず、**ID Token 検証で取得した uid を使う**
- 新しい Cloud Functions / Firestore Rules を書いたら **「IDOR可能か？」を自問し、答えをコメントに残す**
- **管理者権限は Custom Claim (`admin: true`) でのみ判定**。メールアドレスのハードコード allow-list 禁止
- `users/{uid}` のサーバー管理フィールド（trust_score, charges_enabled, stripe_connect_id, coin_balance, locked_balance, is_verified, is_admin）はクライアントから書き込み不可。Firestore Rules で field-level lockdown 済み

### インフラ意思決定（戻すな）
- **Vercel は使わない**。バックエンド全部 Firebase なので Vercel preview は機能的に無意味。preview が欲しい場合は `firebase hosting:channel:deploy` を使う
- **チャット機能は復活させない**（上記法務レッドライン参照）
- **`coin_balance` / `locked_balance` の実装は型のみ**。実装に進む前に資金決済法の再確認が必要

---

## 🧠 作業スタイル（2026-05-16 アップデート）

### 基本動作：bypass モード + 監査ループ

ユーザーは Claude Code を **bypass モード** で動かしている。許可ダイアログは出ない。代わりに以下のサイクルで安全を担保する：

1. **作業前**：何をするかを1-2行で日本語宣言
2. **作業中**：deny リスト（`firebase deploy*`, `git push --force*`, `rm -rf*`, `stripe payouts*` 等）は自動ブロックされる
3. **作業後**：差分を読み返して、法務／セキュリティのレッドラインに触れていないか自己監査
4. **完了時**：「やったこと・残課題・本番影響」を要約

### 重大な判断ではこのワークフローを必ず使う

対象：Firestore Rules 変更 / Cloud Functions の認可ロジック / 決済フロー / 法務関連文書 / 認証・管理者権限 / 本番デプロイ / 依存パッケージのランタイム影響更新

1. **最も強いモデル**（Opus が使えるなら Opus、なければ Sonnet の最強）で考える
2. **関連コードを全体的に読む**（必要なら Explore サブエージェント）
3. **2回以上思考する**：1回目で案を出し、2回目で「これの何が壊れるか」を自分で攻撃する
4. **実装後にデバッグ**：diff を読み返す / 影響範囲をテストする / ログを確認する。検証なしで「完了」と言わない

### 確認を求めずに進めていいこと
- ファイル読み取り・検索
- ローカルのバグ修正・型修正・lint修正
- ドキュメント・コメント・通知文の修正
- DEVELOPMENT_LOG.md への追記
- 通常の git コミット・push（force push でなければ）
- pnpm / npm / firebase の非破壊コマンド

### 動く前に一言予告すること（bypass でも止まれないが、説明はする）
- Firestore Rules 変更
- Cloud Functions の認可ロジック変更
- 法務関連ページ（terms / privacy / trade）の文言変更
- 依存パッケージのメジャー更新

---

## 📝 ログ・記録ルール

1. **コード変更したら** → `DEVELOPMENT_LOG.md` の末尾に日付付きで追記
   - 何を / なぜ / 影響範囲
   - ファイルパスは markdown リンク形式
2. **設計判断したら** → `docs/decisions/YYYY-MM-DD_<topic>.md` を新規作成（背景 / 選択肢 / 採用案 / 理由 / リスク）
3. **コミットメッセージ** → 既存形式に従う：`fix(ux): ...` / `security: ...` / `feat(items): ...`。「なぜ」を1-2文（「何を」は diff で見える）

---

## 💬 コミュニケーション

- 返答は**日本語**
- ユーザーは学生個人開発者で、技術用語は理解できるが**法務・セキュリティのリスク評価は不慣れ**。「あなたが判断して」と言われる前提で動く
- 長くなりそうなら表・箇条書きで整理する
- 危ないことの前は**ダイアログではなく日本語で説明**してから動く

---

## 🛠️ 技術スタック早見表

| レイヤ | 技術 |
|---|---|
| フロント | Next.js 16 (App Router) / React 19 / TypeScript / Tailwind / shadcn/ui |
| 認証 | Firebase Auth (Google OAuth, ドメイン制限) |
| DB | Cloud Firestore (Security Rules で認可) |
| バックエンド | Cloud Functions (Node.js 22, TypeScript) |
| 決済 | Stripe Connect Express + Payment Intents (manual capture) |
| ホスティング | Firebase Hosting (静的エクスポート)。**Vercelは使わない** |
| テスト | Vitest + @firebase/rules-unit-testing（Firestore Rules 用） |
| 同意 | Cookie同意バナー → localStorage `musalink_analytics_consent` |

---

## 📐 ドメインルール（コードに埋まっている前提）

- **商品価格**：300円 ≤ price ≤ 100,000円（`firestore.rules` で強制、`items/create` でも UI validation）
- **取引ステータス遷移**：`request_sent` → `approved` → `payment_pending` → `completed`（または途中で `cancelled`）。`payment_pending → completed` は Cloud Functions 経由のみ
- **個人情報アンロック**：取引が `completed` になった時のみ、双方の学籍番号・大学メールが `unlocked_assets` に書き込まれる
- **手数料**：価格の 10%、最低 50 円（`functions/src/index.ts` の `calculateFee()`）
- **取引完了通知**：QR スキャン後、買い手・売り手の両方に通知（in-app + email）
- **24時間タイムアウト**：`payment_pending` のまま24時間放置で自動キャンセル＋Stripe Auth Hold をボイド

---

## 🔍 まず読むべきファイル（コンテキスト把握）

新しい話題に入る時、以下を確認すると判断ミスが減る：

- [firestore.rules](firestore.rules) - 認可ロジック
- [functions/src/index.ts](functions/src/index.ts) - 決済・取引のサーバー処理
- [functions/src/notifications.ts](functions/src/notifications.ts) - 通知トリガー
- [types/index.ts](types/index.ts) - データ構造の定義
- [DEVELOPMENT_LOG.md](DEVELOPMENT_LOG.md) - 直近の変更履歴（日本語、判断ログ付き）
- [COMPLIANCE_AUDIT_2026_05_13.md](COMPLIANCE_AUDIT_2026_05_13.md) - 法務観点の課題リスト
- [docs/DEPLOY_2026_05_16.md](docs/DEPLOY_2026_05_16.md) - 本番デプロイ手順
- [tests/rules/](tests/rules/) - Firestore Rules ユニットテスト

---

## 📌 現在の主要課題（2026-05時点）

- JCB審査の保留中（Visa/Mastercardは承認済み）
- 本番環境 `musa-link-prod` への分離が進行中
- 大学側の規約調整（石原真三子先生経由）
- Next.js 16.1.1 → 16.2.6 系へのセキュリティアップデート（DoS / SSRF 系の脆弱性が複数）
- 管理者UIDへの Custom Claim 付与 → `node scripts/grant-admin-claim.js <email>` で実施
