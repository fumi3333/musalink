// ⚠️ DUAL SOURCE: `lib/constants.ts` の SYSTEM_FEE_RATE / calculateFee と同期させること。
// Cloud Functions は別 tsconfig + node ランタイムなのでフロントの constants を直接 import できない。
// 値を変更したら両方更新する。
export const SYSTEM_FEE_RATE = 0.10; // 10% platform fee
