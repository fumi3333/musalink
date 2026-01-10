export const APP_NAME = "Musashino Link";

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
