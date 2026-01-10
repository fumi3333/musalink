---
description: How to set up a new project with secure secret blocking (Husky + Secret Scanner)
---

# Secure Project Setup Workflow

When starting ANY new project with the user, follow these steps immediately after `git init`.

## 1. Install Husky
```bash
npm install --save-dev husky
npx husky init
```

## 2. Create Secret Scanning Script
Create `scripts/check-secrets.js` with the following content:

```javascript
const fs = require('fs');
const { execSync } = require('child_process');

// ... (Use the standard secret scanning script content) ...
// Ensure it scans for sk_test_, pk_test_, etc.
```
*(Copy the full script from the Musashino Link project implementation)*

## 3. Configure Pre-commit Hook
Write to `.husky/pre-commit`:
```bash
npm run check-secrets
```

## 4. Add Script to package.json
Add `"check-secrets": "node scripts/check-secrets.js"` to `package.json`.

## 5. Verify
Run `npm run check-secrets` to ensure it works.

// turbo-all
