export const APP_NAME = "Musalink";

// 費用の設定
export const SYSTEM_FEE_RATE = 0.10; // 10% platform fee

/**
 * システム手数料を計算します。
 * 手数料 = 価格 × 10%（最低50円）
 */
export const calculateFee = (price: number): number => {
    if (price <= 0) return 0;
    return Math.max(Math.floor(price * SYSTEM_FEE_RATE), 50);
};

// 学内ドメイン
export const ALLOWED_DOMAIN = "stu.musashino-u.ac.jp";

// Cloud Functions のベースURL（API Route が使えない静的ホストでも Stripe 連携できるように直接呼ぶ）
export const FUNCTIONS_BASE_URL =
    typeof process !== "undefined" && process.env?.NEXT_PUBLIC_FUNCTIONS_BASE_URL
        ? process.env.NEXT_PUBLIC_FUNCTIONS_BASE_URL
        : "https://us-central1-musa-link.cloudfunctions.net";

// Feature Flags
export const IS_BETA = process.env.NEXT_PUBLIC_IS_BETA === 'true';

// 出品カテゴリー（教科書以外も出品可能）
import type { ItemCategory } from '@/types';

export const ITEM_CATEGORIES: { value: ItemCategory; label: string }[] = [
    { value: 'book', label: '教科書・書籍' },
    { value: 'electronics', label: '家電・デジタル' },
    { value: 'furniture', label: '家具・生活' },
    { value: 'variety', label: '面白枠・その他' },
    { value: 'others', label: 'その他' },
];

export function getItemCategoryLabel(category: ItemCategory | undefined): string {
    if (!category) return 'その他';
    return ITEM_CATEGORIES.find(c => c.value === category)?.label ?? category;
}
