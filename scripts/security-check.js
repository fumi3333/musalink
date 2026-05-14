const fs = require('fs');
const { execSync } = require('child_process');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

const FORBIDDEN_PATTERNS = [
    { pattern: /prisma\.user\.create/, name: 'Direct prisma.user.create usage (Use factory.ts)' },
    { pattern: /prisma\.create/, name: 'Direct prisma.create usage' },
    { pattern: /password:\s*['"](email_only|guest-password)['"]/, name: 'Hardcoded weak password' },
    { pattern: /prisma\.user\.findFirst\(\)/, name: 'Dangerous findFirst fallback' },
    { pattern: /\?email=/, name: 'Email query parameter used for auth/data fetching' },
];

const EXCLUDED_DIRS = ['.git', 'node_modules', '.next', 'out', 'dist', 'build', 'coverage', '.gemini', 'project_context'];
const EXCLUDED_FILES = [
    'package-lock.json', 
    'pnpm-lock.yaml', 
    'yarn.lock', 
    'scripts/security-check.js',
    'SECURITY_AND_FEEDBACK.md',
    'lib/auth/user-factory.ts'
];

try {
    const stagedFiles = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf-8' })
        .split('\n')
        .filter(file => file.trim() !== '');

    if (stagedFiles.length === 0) {
        process.exit(0);
    }

    let hasError = false;

    stagedFiles.forEach(file => {
        if (EXCLUDED_FILES.includes(file)) return;
        const isExcludedDir = EXCLUDED_DIRS.some(dir => file.startsWith(dir + '/') || file === dir);
        if (isExcludedDir) return;

        try {
            const content = fs.readFileSync(file, 'utf-8');

            FORBIDDEN_PATTERNS.forEach(({ pattern, name }) => {
                if (pattern.test(content)) {
                    console.error(`${RED}[Security Block] Found ${name} in ${file}${RESET}`);
                    console.error(`${YELLOW}Please fix the issue to proceed with the commit.${RESET}`);
                    hasError = true;
                }
            });
        } catch (e) {
            // file might have been deleted or not readable
        }
    });

    if (hasError) {
        console.error(`${RED}Commit blocked due to security violations.${RESET}`);
        process.exit(1);
    } else {
        console.log(`${GREEN}Security check passed. No forbidden patterns found.${RESET}`);
        process.exit(0);
    }
} catch (e) {
    console.error('Error running security check:', e);
    process.exit(1);
}
