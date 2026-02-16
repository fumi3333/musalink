import { SYSTEM_FEE } from "./constants";

/**
 * Calculate the application fee based on the transaction amount.
 * JPY is an integer currency, so we floor the result.
 * 
 * @param amount Total transaction amount (integer)
 * @returns Application fee (integer)
 */
export const calculateFee = (amount: number): number => {
    if (amount < 0) return 0;
    return Math.floor(amount * SYSTEM_FEE);
};
