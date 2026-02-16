"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateFee = void 0;
const constants_1 = require("./constants");
/**
 * Calculate the application fee based on the transaction amount.
 * JPY is an integer currency, so we floor the result.
 * Fee = amount * SYSTEM_FEE_RATE (e.g. 10%)
 * Minimum fee: 50 JPY (to cover Stripe processing)
 *
 * @param amount Total transaction amount in JPY (integer)
 * @returns Application fee in JPY (integer)
 */
const calculateFee = (amount) => {
    if (amount <= 0)
        return 0;
    const fee = Math.floor(amount * constants_1.SYSTEM_FEE_RATE);
    return Math.max(fee, 50); // Minimum 50 JPY
};
exports.calculateFee = calculateFee;
//# sourceMappingURL=utils.js.map