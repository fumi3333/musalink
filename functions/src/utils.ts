import { SYSTEM_FEE_RATE } from "./constants";

/**
 * Calculate the application fee based on the transaction amount.
 * JPY is an integer currency, so we floor the result.
 * Fee = amount * SYSTEM_FEE_RATE (e.g. 10%)
 * Minimum fee: 50 JPY (to cover Stripe processing)
 * 
 * @param amount Total transaction amount in JPY (integer)
 * @returns Application fee in JPY (integer)
 */
export const calculateFee = (amount: number): number => {
    if (amount <= 0) return 0;
    const fee = Math.floor(amount * SYSTEM_FEE_RATE);
    return Math.max(fee, 50); // Minimum 50 JPY
};
