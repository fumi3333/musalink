import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
    initializeTestEnvironment,
    assertFails,
    assertSucceeds,
    type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const PROJECT_ID = "musalink-rules-test";
const RULES_PATH = resolve(__dirname, "..", "..", "firestore.rules");

let env: RulesTestEnvironment;

beforeAll(async () => {
    env = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: {
            rules: readFileSync(RULES_PATH, "utf8"),
            host: "127.0.0.1",
            port: 8080,
        },
    });
});

afterAll(async () => {
    await env.cleanup();
});

beforeEach(async () => {
    await env.clearFirestore();
});

function studentAuth(uid: string) {
    return env.authenticatedContext(uid, {
        email: `${uid}@stu.musashino-u.ac.jp`,
    });
}

describe("users/{uid}: server-managed field lockdown", () => {
    it("owner can update their display_name", async () => {
        const alice = studentAuth("alice");
        const db = alice.firestore();

        // seed via admin to bypass create rules during fixture setup
        await env.withSecurityRulesDisabled(async (ctx) => {
            await setDoc(doc(ctx.firestore(), "users", "alice"), {
                display_name: "Alice",
                trust_score: 0,
                charges_enabled: false,
                stripe_connect_id: null,
            });
        });

        await assertSucceeds(
            updateDoc(doc(db, "users", "alice"), { display_name: "Alice Updated" })
        );
    });

    it("owner cannot inflate their own trust_score", async () => {
        const alice = studentAuth("alice");
        const db = alice.firestore();

        await env.withSecurityRulesDisabled(async (ctx) => {
            await setDoc(doc(ctx.firestore(), "users", "alice"), {
                display_name: "Alice",
                trust_score: 0,
            });
        });

        await assertFails(
            updateDoc(doc(db, "users", "alice"), { trust_score: 5 })
        );
    });

    it("owner cannot flip charges_enabled to bypass KYC", async () => {
        const alice = studentAuth("alice");
        const db = alice.firestore();

        await env.withSecurityRulesDisabled(async (ctx) => {
            await setDoc(doc(ctx.firestore(), "users", "alice"), {
                display_name: "Alice",
                charges_enabled: false,
            });
        });

        await assertFails(
            updateDoc(doc(db, "users", "alice"), { charges_enabled: true })
        );
    });

    it("owner cannot overwrite stripe_connect_id", async () => {
        const alice = studentAuth("alice");
        const db = alice.firestore();

        await env.withSecurityRulesDisabled(async (ctx) => {
            await setDoc(doc(ctx.firestore(), "users", "alice"), {
                display_name: "Alice",
                stripe_connect_id: "acct_real",
            });
        });

        await assertFails(
            updateDoc(doc(db, "users", "alice"), { stripe_connect_id: "acct_fake" })
        );
    });
});

describe("conversations/{id}: chat feature fully disabled", () => {
    it("authenticated user cannot read a conversation", async () => {
        await env.withSecurityRulesDisabled(async (ctx) => {
            await setDoc(doc(ctx.firestore(), "conversations", "tx1"), {
                participants: ["alice", "bob"],
            });
        });

        const alice = studentAuth("alice");
        await assertFails(getDoc(doc(alice.firestore(), "conversations", "tx1")));
    });

    it("authenticated user cannot write a message", async () => {
        const alice = studentAuth("alice");
        await assertFails(
            setDoc(doc(alice.firestore(), "conversations", "tx1", "messages", "m1"), {
                senderId: "alice",
                text: "hi",
            })
        );
    });
});

describe("transactions: anonymous-auth bypass closed", () => {
    it("anonymous user cannot create a demo transaction", async () => {
        const anon = env.authenticatedContext("anon-uid", {
            firebase: { sign_in_provider: "anonymous" },
        } as any);
        const db = anon.firestore();

        await assertFails(
            setDoc(doc(db, "transactions", "tx1"), {
                buyer_id: "anon-uid",
                seller_id: "bob",
                item_id: "item1",
                status: "request_sent",
                is_demo: true,
            })
        );
    });

    it("verified student can create a normal transaction", async () => {
        const alice = studentAuth("alice");
        const db = alice.firestore();

        await assertSucceeds(
            setDoc(doc(db, "transactions", "tx1"), {
                buyer_id: "alice",
                seller_id: "bob",
                item_id: "item1",
                status: "request_sent",
            })
        );
    });
});
