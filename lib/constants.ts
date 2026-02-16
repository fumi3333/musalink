export const APP_NAME = "Musalink";

// 費用の設定
// 費用の設定
export const SYSTEM_FEE = 100; // 100 Coin (System Usage Fee)

/**
 * システム利用料を返します。
 * 現在は固定で100コインです。
 */
export const calculateFee = (price: number): number => {
    return SYSTEM_FEE;
};

// 学内ドメイン
export const ALLOWED_DOMAIN = "stu.musashino-u.ac.jp";

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
