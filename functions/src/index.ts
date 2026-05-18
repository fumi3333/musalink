// Musalink Cloud Functions — entry point.
// admin / stripe init は ./init で side-effect として走る。
// 各機能の関数はテーマ別ファイルから re-export。Firebase Functions は
// この index.ts の named export を関数名として認識する。

import "./init"; // Run admin / stripe init exactly once

export * from "./stripe";        // Stripe Connect / Payment Intent / capture / webhook
export * from "./transactions";  // unlock / cancel / rate / admin cancel / cron sweep
export * from "./identity";      // verifyUserIdentity + sendUniversityOTP + verifyUniversityOTP
export * from "./notifications"; // Firestore triggers (transaction created/updated)
export * from "./contact";       // sendContactEmail — お問い合わせフォーム

// 過去関数の履歴メモ:
// - fixSellerStatus: 2026-05-16 削除（モック Stripe ID を書く dev-only ショートカット、本番危険）
// - onMessageCreated: 2026-05-16 削除（チャット機能ごと電気通信事業法リスクで撤去）
