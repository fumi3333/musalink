import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const analyticsRef = collection(db, 'analytics_logs');

/**
 * ユーザー行動ログを記録する
 * @param eventName イベント名 (e.g. 'search_miss', 'item_view', 'transaction_start')
 * @param data 関連データ (e.g. { keyword: '微分積分', userId: '...' })
 */
export const logEvent = async (eventName: string, data: Record<string, any>) => {
    try {
        // オフラインでもエラーにせず、できればキューイング、無理ならスキップ
        // 今回はFirestoreのオフライン機能を信じて fire-and-forget する
        addDoc(analyticsRef, {
            event: eventName,
            data: data,
            timestamp: serverTimestamp(),
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server'
        }).catch(err => {
            console.warn(`[Analytics] Failed to log ${eventName}`, err);
        });
    } catch (e) {
        // Analytics should never break the app
        console.warn("[Analytics] Exception", e);
    }
};

/**
 * 検索ログ（ヒットなし）
 * "Demand Mismatch" の証拠になる
 */
export const logSearchMiss = (keyword: string, filters: any, userId?: string) => {
    logEvent('search_miss', { keyword, filters, userId });
};

/**
 * 商品閲覧ログ
 * "Interest" のヒートマップ用
 */
export const logItemView = (itemId: string, userId?: string) => {
    logEvent('item_view', { itemId, userId });
};
