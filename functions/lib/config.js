"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDev = exports.allowedOrigins = void 0;
exports.allowedOrigins = [
    'http://localhost:3000',
    'https://musalink.com',
    'https://musalink.vercel.app',
    'https://musa-link.web.app',
];
exports.isDev = process.env.FUNCTIONS_EMULATOR === 'true';
//# sourceMappingURL=config.js.map