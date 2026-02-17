const fs = require('fs');
const { execSync } = require('child_process');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

const FORBIDDEN_PATTERNS = [
    { pattern: /sk_test_[a-zA-Z0-9]+/, name: 'Stripe Secret Key (Test)' },
    { pattern: /sk_live_[a-zA-Z0-9]+/, name: 'Stripe Secret Key (Live)' },
    { pattern: /pk_test_[a-zA-Z0-9]+/, name: 'Stripe Publishable Key (Test)' },
    { pattern: /pk_live_[a-zA-Z0-9]+/, name: 'Stripe Publishable Key (Live)' },
    { pattern: /rk_test_[a-zA-Z0-9]+/, name: 'Stripe Restricted Key (Test)' },
    { pattern: /rk_live_[a-zA-Z0-9]+/, name: 'Stripe Restricted Key (Live)' },
    // Prevent accidental exposure of secrets via NEXT_PUBLIC_
    { pattern: /NEXT_PUBLIC_.*(SECRET|PASSWORD|KEY|TOKEN).*(?!=.*PUBLISHABLE)/i, name: 'Potential Secret exposed via NEXT_PUBLIC_' },
];

// Files to ignore (e.g. env files that are already gitignored but checking just in case, or specific config)
// Scan exclusions
const EXCLUDED_DIRS = ['.git', 'node_modules', '.next', 'out', 'dist', 'build', 'coverage', '.gemini', 'project_context'];
const EXCLUDED_FILES = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', '.env.example'];
const IGNORED_FILES = [
    '.env',
    '.env.local',
    '.env.development',
    '.env.production',
    'functions/.runtimeconfig.json',
    'scripts/check-secrets.js' // Ignore self to avoid false positive if we hardcode patterns
];

try {
    // 1. Get list of staged files
    const stagedFiles = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf-8' })
        .split('\n')
        .filter(file => file.trim() !== '');

    if (stagedFiles.length === 0) {
        process.exit(0);
    }

    let hasError = false;

    stagedFiles.forEach(file => {
        if (IGNORED_FILES.includes(file)) return;
        
        // Check if file is in excluded directory
        const isExcludedDir = EXCLUDED_DIRS.some(dir => file.startsWith(dir + '/') || file === dir);
        if (isExcludedDir) return;

        try {
            const content = fs.readFileSync(file, 'utf-8');

            FORBIDDEN_PATTERNS.forEach(({ pattern, name }) => {
                if (pattern.test(content)) {
                    console.error(`${RED}[Security Block] Found ${name} in ${file}${RESET}`);
                    console.error(`${YELLOW}Please remove the key or add it to environment variables.${RESET}`);
                    hasError = true;
                }
            });

        } catch (e) {
            // File might have been deleted or not readable, skip
        }
    });

    if (hasError) {
        console.error(`${RED}Commit blocked due to potential secret leak.${RESET}`);
        process.exit(1);
    } else {
        console.log(`${GREEN}No secrets found. Commit allowed.${RESET}`);
        process.exit(0);
    }

} catch (e) {
    console.error('Error running secret check:', e);
    process.exit(1); // Fail safe
}
