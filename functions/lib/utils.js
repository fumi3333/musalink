"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateFee = void 0;
const constants_1 = require("./constants");
/**
 * Calculate the application fee based on the transaction amount.
 * JPY is an integer currency, so we floor the result.
 *
 * @param amount Total transaction amount (integer)
 * @returns Application fee (integer)
 */
const calculateFee = (amount) => {
    if (amount < 0)
        return 0;
    return Math.floor(amount * constants_1.SYSTEM_FEE);
};
exports.calculateFee = calculateFee;
//# sourceMappingURL=utils.js.map