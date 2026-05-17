# Firestore Rules Tests

## 目的

`firestore.rules` の認可ロジックを CI / 手動で検証するためのユニットテスト。
2026-05-16 のセキュリティ修正（チャット削除・サーバーフィールドのロックダウン・Anonymous bypass 削除）が将来退行しないよう保護する。

## 前提

- Firebase CLI がインストール済み (`npm i -g firebase-tools` 等)
- ローカルで Firestore Emulator が動作可能

## 実行手順

別ターミナルで Emulator を起動:

```bash
firebase emulators:start --only firestore
```

テスト実行:

```bash
pnpm install   # 初回のみ (vitest と @firebase/rules-unit-testing をインストール)
pnpm test:rules
```

## 含まれるケース

- `users/{uid}`: 自分の `trust_score` / `charges_enabled` / `stripe_connect_id` を書き換えられないこと
- `users/{uid}`: 通常フィールド (`display_name`) は更新できること
- `conversations/{id}` および `messages/{id}`: 全アクセス拒否
- `transactions/{id}`: anonymous 認証で `is_demo: true` が作成できないこと
- `transactions/{id}`: 学内ドメインユーザーは通常の取引を作成できること

新しい認可ロジックを追加するたびに、このファイルにケースを追加すること。
