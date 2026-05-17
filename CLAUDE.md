# Musalink - Claude 開発ガイドライン

このプロジェクトで作業する際の重要ルール。**毎回このファイルが読まれる**ので、ここに書いた指示は常に有効。

---

## 🎯 プロジェクト概要

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
- **Vercel は使わない**。preview が欲しい場合は `firebase hosting:channel:deploy`
- **チャット機能は復活させない**（上記法務レッドライン参照）
- **`coin_balance` / `locked_balance` の実装は型のみ**。実装に進む前に資金決済法の再確認が必要

---

## 🧠 作業ルール

### 確認なしで進めていいこと
- ファイル読み取り・検索 / ローカルのバグ修正・型修正・lint修正
- ドキュメント・コメント・通知文の修正 / DEVELOPMENT_LOG.md への追記
- 通常の git コミット・push（force push でなければ）/ pnpm / npm / firebase の非破壊コマンド

### 動く前に一言予告すること
- Firestore Rules 変更 / Cloud Functions の認可ロジック変更
- 法務関連ページ（terms / privacy / trade）の文言変更 / 依存パッケージのメジャー更新

### 重大変更（Firestore Rules / 認可 / 決済 / 本番デプロイ）では
関連コードを全体的に読む → 実装 → 「これの何が壊れるか」を自問 → 検証してから「完了」と言う

---

## 📝 ログ・記録ルール

1. **コード変更したら** → `DEVELOPMENT_LOG.md` の末尾に日付付きで追記（何を・なぜ・影響範囲・ファイルパスはリンク形式）
2. **設計判断したら** → `docs/decisions/YYYY-MM-DD_<topic>.md` を新規作成（背景・選択肢・採用案・理由・リスク）
3. **コミットメッセージ** → `fix(ux): ...` / `security: ...` / `feat(items): ...`。「なぜ」を1-2文

---

## 💬 コミュニケーション

返答は**日本語**。法務・セキュリティのリスク評価が不慣れな学生個人開発者前提で、「あなたが判断して」と言われる前提で動く。

---

## 📐 ドメインルール

- **商品価格**：300円 ≤ price ≤ 100,000円（`firestore.rules` と `items/create` で強制）
- **取引ステータス遷移**：`request_sent` → `approved` → `payment_pending` → `completed`（または `cancelled`）。`payment_pending → completed` は Cloud Functions 経由のみ
- **個人情報アンロック**：`completed` になった時のみ、双方の学籍番号・大学メールが `unlocked_assets` に書き込まれる
- **手数料**：価格の 10%、最低 50 円（`functions/src/constants.ts` の `SYSTEM_FEE_RATE`）
- **24時間タイムアウト**：`payment_pending` のまま24時間放置で自動キャンセル＋Stripe Auth Hold をボイド

---

## 🔍 まず読むべきファイル

- [firestore.rules](firestore.rules) - 認可ロジック
- [functions/src/index.ts](functions/src/index.ts) - re-export のみ。実体は stripe.ts / transactions.ts / identity.ts
- [types/index.ts](types/index.ts) - データ構造の定義
- [DEVELOPMENT_LOG.md](DEVELOPMENT_LOG.md) - 直近の変更履歴（日本語、判断ログ付き）
- [docs/DEPLOY_2026_05_16.md](docs/DEPLOY_2026_05_16.md) - 本番デプロイ手順
