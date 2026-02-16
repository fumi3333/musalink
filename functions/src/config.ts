
export const allowedOrigins = [
    'http://localhost:3000',
    'https://musalink.com',
    // Add other valid domains here as needed
    // 'https://staging.musalink.com',
];

export const isDev = process.env.FUNCTIONS_EMULATOR === 'true';
