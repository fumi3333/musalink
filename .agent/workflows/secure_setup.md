---
description: 新規プロジェクトの安全なセットアップ手順 (Husky + シークレットスキャン)
---

# セキュアプロジェクトセットアップワークフロー

ユーザーと新しいプロジェクトを開始する際は、`git init` の直後に以下の手順を実行してください。

## 1. Huskyのインストール
```bash
npm install --save-dev husky
npx husky init
```

## 2. シークレットスキャン用スクリプトの作成
以下の内容で `scripts/check-secrets.js` を作成してください:

```javascript
const fs = require('fs');
const { execSync } = require('child_process');

// ... (標準的なシークレットスキャン用スクリプトの内容を使用) ...
// sk_test_, pk_test_ などを確実にスキャンするようにしてください。
```
*(Musashino Link プロジェクトの実装から完全なスクリプトをコピーしてください)*

## 3. プレコミットフックの設定
`.husky/pre-commit` に以下を書き込んでください:
```bash
npm run check-secrets
```

## 4. package.jsonへのスクリプト追加
`package.json` に `"check-secrets": "node scripts/check-secrets.js"` を追加してください。

## 5. 動作確認
`npm run check-secrets` を実行して動作を確認してください。

// turbo-all
