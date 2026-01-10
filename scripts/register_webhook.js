
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Config
const PROJECT_ID = "musa-link";
const REGION = "us-central1";
const FUNCTION_URL = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/stripeWebhook`;

// Note: This script assumes it's run from the project root or functions folder.
// We need to require 'stripe'. If not in root, try functions/node_modules.
let stripe;
try {
    stripe = require('stripe');
} catch (e) {
    try {
        stripe = require('../functions/node_modules/stripe');
    } catch (e2) {
        console.error("Stripe package not found. Please run 'npm install stripe' in the root or 'cd functions && npm install'.");
        process.exit(1);
    }
}

// 1. Get Secret Key from functions/.env
const envPath = path.resolve(__dirname, '../functions/.env');
let secretKey = "";

if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/STRIPE_SECRET_KEY=(.*)/);
    if (match) {
        secretKey = match[1].trim();
    }
}

if (!secretKey) {
    console.error("Could not find STRIPE_SECRET_KEY in functions/.env");
    console.error("Please ensure functions/.env exists and has the key.");
    process.exit(1);
}

const stripeClient = stripe(secretKey);

async function register() {
    console.log(`Registering Webhook Endpoint: ${FUNCTION_URL}`);

    try {
        const webhookEndpoint = await stripeClient.webhookEndpoints.create({
            url: FUNCTION_URL,
            enabled_events: ['payment_intent.succeeded'],
        });

        console.log("\n✅ Webhook Registered Successfully!");
        console.log(`ID: ${webhookEndpoint.id}`);
        console.log(`Secret: ${webhookEndpoint.secret}`);

        console.log("\n=== ACTION REQUIRED ===");
        console.log("Run the following command to configure your Cloud Functions:");
        console.log(`\nfirebase functions:config:set stripe.webhook_secret="${webhookEndpoint.secret}"\n`);
        fs.writeFileSync('webhook_secret.txt', webhookEndpoint.secret);
        console.log("Secret saved to webhook_secret.txt");

        console.log("Then deploy again:");
        console.log("firebase deploy --only functions");

    } catch (error) {
        console.error("\n❌ Registration Failed:", error.message);
    }
}

register();
