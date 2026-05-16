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
- **「エスクロー」という単語を使わない**（資金決済法リスク。安全のため「仮押さえ決済」「Authorize/Capture」と呼ぶ）
- **「資金を預かる」「資金を保管する」とも書かない**（Stripeが預かる、と書く）
- 法的な断言（「違法ではない」「法的に問題ない」等）はしない。**必ず「要弁護士確認」を添える**
- 利用規約・特商法・プライバシーポリシーの文言変更時は、変更前にユーザーへ確認

### 環境ルール（本番/テスト混同防止）
- `musa-link.web.app` = **テスト環境**（ダミーカード）
- `musa-link-prod` = **本番環境**（本物カード、実取引）
- Firebase プロジェクト・Stripe キー・Firestore データを操作する作業の前に、**「今どちらの環境を対象にしますか？」と必ず確認する**
- 本番デプロイ前は必ず差分の最終確認を求める

### セキュリティ最優先ルール
過去にテストアカウントへ過大な権限を与えてIDOR脆弱性を作った経緯あり。同じ事故を防ぐ：

- **クライアント側のフラグ（is_admin など）をサーバーで信頼しない**
- Firestore Rules では「リソースのowner == request.auth.uid」を**第一条件**にする
- Cloud Functions では受信した uid を信用せず、**ID Token 検証で取得した uid を使う**
- 新しい Cloud Functions / Firestore Rules を書いたら **「IDOR可能か？」を自問し、答えをコメントに残す**
- テストアカウントに本番権限を与えない（管理者権限は Cloud Functions 内のホワイトリスト UID で判定する）

---

## 📝 ログ・記録ルール

### 作業の度に残すもの

1. **コード変更したら** → `DEVELOPMENT_LOG.md` の末尾に日付付きで追記
   - 何を / なぜ / 影響範囲
   - ファイルパスは markdown リンク形式

2. **設計判断したら** → `docs/decisions/YYYY-MM-DD_<topic>.md` を新規作成
   - 形式：背景 / 検討した選択肢 / 採用した案 / 理由 / リスク
   - 例：「なぜFirestore Rulesで○○な構造にしたか」

3. **コミットメッセージ**
   - 既存の形式に従う：`fix(ux): ...` / `security: ...` / `fix(payment): ...`
   - 「なぜ」を1-2文で書く（「何を」だけだとgit diffで分かるので不要）

---

## 🧠 作業スタイル

### 段階的に進める
- 大きな変更は**先にプランを提示**してから実装する
- 「本番に影響する変更」「Firestore Rules変更」「Cloud Functions変更」は**実行前に必ず確認**を求める
- 小さな修正・ファイル読み取りは確認不要

### 確認を求めるべきタイミング
- 本番環境への影響がある操作
- Firestore Rules の変更
- 法務関連文書（利用規約・プライバシー・特商法）の変更
- 依存パッケージの追加・更新
- データ削除を伴う操作（git reset --hard 等含む）

### 確認不要で進めていいこと
- ファイル読み取り・検索
- ローカルのバグ修正・型修正・lint修正
- ドキュメント・コメントの修正
- DEVELOPMENT_LOG.md への追記

---

## 💬 コミュニケーション

- 返答は**日本語**
- ユーザーは学生個人開発者で、技術用語は理解できるが法務・セキュリティの最終判断は不慣れ
- 長くなりそうなら表・箇条書きで整理する
- 「これでいい？」と確認を取る癖を持つ（一方的に進めない）

---

## 🛠️ 技術スタック早見表

| レイヤ | 技術 |
|---|---|
| フロント | Next.js 15 (App Router) / React 19 / TypeScript / Tailwind / shadcn/ui |
| 認証 | Firebase Auth (Google OAuth, ドメイン制限) |
| DB | Cloud Firestore (Security Rules で認可) |
| バックエンド | Cloud Functions (Node.js 22, TypeScript) |
| 決済 | Stripe Connect Express + Payment Intents (manual capture) |
| ホスティング | Firebase Hosting (静的エクスポート) |

---

## 🔍 まず読むべきファイル（コンテキスト把握）

新しい話題に入る時、以下を最初に確認すると判断ミスが減る：

- `firestore.rules` - 認可ロジック
- `functions/src/index.ts` - 決済・取引のサーバー処理
- `types/index.ts` - データ構造の定義
- `DEVELOPMENT_LOG.md` - 直近の変更履歴
- `COMPLIANCE_AUDIT_2026_05_13.md` - 法務観点の課題リスト

---

## 📌 現在の主要課題（2026-05時点）

- JCB審査の保留中（Visa/Mastercardは承認済み）
- 本番環境 `musa-link-prod` への分離が進行中
- IDOR脆弱性対策とFirestore Rulesの強化が継続課題
- 大学側の規約調整（石原真三子先生経由）
