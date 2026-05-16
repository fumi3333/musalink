/**
 * Grant the `admin: true` Custom Claim to a user.
 *
 * Required for the 2026-05-16 security hardening — Firestore Rules and
 * Cloud Functions (`adminCancelTransaction`, `fixSellerStatus`) now refuse
 * to recognise anyone as admin unless they carry this claim. Email
 * allow-lists are gone.
 *
 * Usage:
 *
 *   # 1. Place a service-account JSON in functions/serviceAccountKey.json
 *   #    (already gitignored as *-key.json / service-account.json).
 *   # 2. Run:
 *
 *   node scripts/grant-admin-claim.js admin@musashino-u.ac.jp
 *   node scripts/grant-admin-claim.js --uid abc123xyz
 *   node scripts/grant-admin-claim.js admin@... --revoke   # remove the claim
 *
 * The script is idempotent — re-running it with the same value is safe.
 * After running, the target user must sign out and sign back in (or wait
 * up to ~1 hour) for the new ID token to carry the claim.
 */

const path = require('path');
const admin = require('firebase-admin');

function usage(msg) {
    if (msg) console.error(`Error: ${msg}\n`);
    console.error('Usage:');
    console.error('  node scripts/grant-admin-claim.js <email>');
    console.error('  node scripts/grant-admin-claim.js --uid <uid>');
    console.error('  node scripts/grant-admin-claim.js <email|--uid uid> --revoke');
    process.exit(1);
}

function parseArgs(argv) {
    const opts = { revoke: false, email: null, uid: null };
    for (let i = 2; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--revoke') {
            opts.revoke = true;
        } else if (a === '--uid') {
            opts.uid = argv[++i];
        } else if (a.startsWith('--')) {
            usage(`unknown flag: ${a}`);
        } else if (!opts.email && !opts.uid) {
            opts.email = a;
        } else {
            usage(`unexpected argument: ${a}`);
        }
    }
    if (!opts.email && !opts.uid) usage('must specify <email> or --uid <uid>');
    return opts;
}

async function main() {
    const opts = parseArgs(process.argv);

    // Load service account.
    // Path: <repo>/functions/serviceAccountKey.json
    const keyPath = path.resolve(__dirname, '..', 'functions', 'serviceAccountKey.json');
    let serviceAccount;
    try {
        serviceAccount = require(keyPath);
    } catch (e) {
        console.error(`Failed to load service account at: ${keyPath}`);
        console.error('Download it from Firebase Console → Project Settings → Service accounts → "Generate new private key".');
        console.error('Store it as functions/serviceAccountKey.json (it is already gitignored).');
        process.exit(1);
    }

    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
    }

    // Resolve target UID.
    let targetUid = opts.uid;
    if (!targetUid) {
        try {
            const rec = await admin.auth().getUserByEmail(opts.email);
            targetUid = rec.uid;
            console.log(`Resolved ${opts.email} → ${targetUid}`);
        } catch (e) {
            console.error(`Failed to resolve email ${opts.email}: ${e.message}`);
            process.exit(1);
        }
    }

    // Merge with existing custom claims so we do not clobber other flags.
    const existing = (await admin.auth().getUser(targetUid)).customClaims || {};
    const next = { ...existing };
    if (opts.revoke) {
        delete next.admin;
    } else {
        next.admin = true;
    }

    await admin.auth().setCustomUserClaims(targetUid, next);
    console.log(opts.revoke
        ? `Revoked admin claim from ${targetUid}.`
        : `Granted admin: true to ${targetUid}.`);
    console.log('The target user must sign out and sign back in for the new ID token to carry the change.');
    console.log('Current custom claims:', JSON.stringify(next));
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
