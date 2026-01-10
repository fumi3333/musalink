// CONFIG LOCAL
// const PROJECT_ID = "musa-link";
// const REGION = "us-central1";
// const FUNCTION_URL = `http://127.0.0.1:5001/${PROJECT_ID}/${REGION}/unlockTransaction`;

// CONFIG PRODUCTION
const PROJECT_ID = "musa-link";
const REGION = "us-central1";
const FUNCTION_URL = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/unlockTransaction`;

async function callFunction(name, data) {
    console.log(`\n[TEST] Calling ${name} with data:`, JSON.stringify(data));
    try {
        const response = await fetch(FUNCTION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ data: data }),
        });

        const json = await response.json();
        console.log(`[STATUS] ${response.status}`);
        console.log(`[RESPONSE]`, JSON.stringify(json, null, 2));
        return json;
    } catch (e) {
        console.error(`[ERROR] Request failed:`, e);
    }
}

async function runAudit() {
    console.log("=== STARTING MALICIOUS DEBUGGING (SECURITY AUDIT) ===");

    // Scenario 1: Missing Parameters
    await callFunction("unlockTransaction (Missing Params)", { userId: "hacker" });

    // Scenario 2: Try to unlock without Paying (Legacy Coin Path Check)
    // Needs a valid transaction ID. We might need to guess or use a known one.
    // Since we are mocking, the function will look for the doc. If not found, 404.
    // We expect 404 Not Found (or 500) but NOT 200 Success.
    await callFunction("unlockTransaction (No Payment)", {
        userId: "hacker_001",
        transactionId: "tx_exploit_attempt"
    });

    // Scenario 3: Fake Stripe Payment Intent
    // If logic is robust, it should call Stripe, fail verification, and return Permission Denied (403/500).
    await callFunction("unlockTransaction (Fake Payment)", {
        userId: "hacker_001",
        transactionId: "tx_exploit_attempt",
        paymentIntentId: "pi_fake_123456789"
    });

    console.log("=== AUDIT COMPLETE ===");
}

runAudit();
