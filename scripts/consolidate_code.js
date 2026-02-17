const fs = require('fs');
const path = require('path');

const rootDir = 'c:/musashino link'; // Adjust if needed
const outputDir = path.join(rootDir, 'project_context');
const outputFile = path.join(outputDir, 'full_codebase.md');

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Files/Dirs to include
const includePaths = [
    'app',
    'components',
    'lib',
    'services',
    'types',
    'functions/src',
    'hooks',
    'contexts'
];

// Files to exclude
const excludePatterns = [
    'node_modules',
    '.next',
    '.git',
    'ui/shadcn', // Skip generic UI components to save space? Maybe keep them.
    // Let's keep shadcn for completeness as requested "余さず"
    'project_context', // Avoid recursive inclusion
    'favicon.ico',
    '.png', '.jpg', '.jpeg', '.webp', '.svg'
];

let content = "# Musalink Full Codebase\n\n";

function processDirectory(dir) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, '/');

        if (excludePatterns.some(p => relativePath.includes(p))) continue;

        if (stat.isDirectory()) {
            processDirectory(fullPath);
        } else {
            // Check extension
            const ext = path.extname(file);
            if (!['.ts', '.tsx', '.js', '.css', '.md', '.json'].includes(ext)) continue;
            if (file === 'package-lock.json') continue;

            const fileContent = fs.readFileSync(fullPath, 'utf8');
            content += `\n## File: ${relativePath}\n\`\`\`${ext.substring(1)}\n${fileContent}\n\`\`\`\n`;
        }
    }
}

includePaths.forEach(p => {
    const fullPath = path.join(rootDir, p);
    if (fs.existsSync(fullPath)) {
        processDirectory(fullPath);
    }
});

// Also add root files
['package.json', 'tsconfig.json', 'next.config.ts', 'middleware.ts'].forEach(f => {
    const fullPath = path.join(rootDir, f);
    if (fs.existsSync(fullPath)) {
        const fileContent = fs.readFileSync(fullPath, 'utf8');
        content += `\n## File: ${f}\n\`\`\`json\n${fileContent}\n\`\`\`\n`;
    }
});

fs.writeFileSync(outputFile, content);
console.log(`Consolidated codebase written to ${outputFile}`);
