export type TransactionStatus = 'request_sent' | 'approved' | 'payment_pending' | 'completed' | 'cancelled';

export interface User {
    id: string;
    display_name: string;
    student_id?: string; // アンロックされるまでundefinedまたは隠蔽される
    university_email?: string; // アンロックされるまでundefinedまたは隠蔽される
    grade?: string; // 学年 (e.g., 'B1', 'M1')
    department?: string; // 学部学科 (e.g., '工学部数理工学科')
    trust_score: number;
    coin_balance: number; // 現在保有コイン
    locked_balance: number; // エスクロー中コイン
    is_verified?: boolean; // 学籍番号認証済み
    stripe_connect_id?: string; // Stripe Connect Account ID (acct_...)
    charges_enabled?: boolean; // 決済有効化フラグ (KYC完了)
    ratings?: {
        count: number;
        total_score: number; // average = total_score / count
    };
}

export interface Item {
    id: string;
    title: string;
    author?: string; // 著者名
    isbn?: string;   // ISBNコード
    lecture_name?: string; // [New]
    teacher_name?: string; // [New]
    price: number;
    description: string;
    seller_id: string;
    status: 'listing' | 'matching' | 'sold';
    condition: number; // 1 (悪い) ~ 5 (新品同様)
    image_urls: string[]; // 商品画像のURL配列 (将来用)
    metadata: Record<string, any>; // 汎用コンテナ (継承メモなど)
    createdAt?: any; // Firestore Timestamp
    updatedAt?: any; // Firestore Timestamp
}

export interface Transaction {
    id: string;
    item_id: string;
    buyer_id: string;
    seller_id: string;
    status: TransactionStatus;
    fee_amount: number; // 確定した手数料
    unlocked_assets?: {
        student_id?: string;
        university_email?: string;
        unlockedAt?: any;
    };
    meeting_place?: string; // [New]

    // Post-Unlock Actions
    buyer_handover_checked?: boolean; // 買い手: 受け取り完了
    seller_handover_checked?: boolean; // 売り手: 引き渡し完了
    buyer_rated?: boolean; // [New] 買い手: 評価完了
    seller_rated?: boolean; // [New] 売り手: 評価完了
    issue_reported?: boolean; // 問題報告あり
    stripe_payment_intent_id?: string;
    is_demo?: boolean; // [Security] Allows checking if this is a test transaction for bypass rules
    updatedAt?: any; // Firestore Timestamp
    createdAt?: any; // Firestore Timestamp
}
