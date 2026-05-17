import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
    initializeTestEnvironment,
    assertFails,
    assertSucceeds,
    type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
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

describe("items: price range enforcement (300-100,000 JPY)", () => {
    it("rejects creation at 299 yen", async () => {
        const seller = studentAuth("seller");
        const db = seller.firestore();

        await assertFails(
            setDoc(doc(db, "items", "item-too-cheap"), {
                seller_id: "seller",
                title: "test",
                price: 299,
                description: "x",
                status: "listing",
            })
        );
    });

    it("rejects creation at 100,001 yen", async () => {
        const seller = studentAuth("seller");
        const db = seller.firestore();

        await assertFails(
            setDoc(doc(db, "items", "item-too-pricey"), {
                seller_id: "seller",
                title: "test",
                price: 100001,
                description: "x",
                status: "listing",
            })
        );
    });

    it("accepts creation at 300 yen (lower bound)", async () => {
        const seller = studentAuth("seller");
        const db = seller.firestore();

        await assertSucceeds(
            setDoc(doc(db, "items", "item-min"), {
                seller_id: "seller",
                title: "test",
                price: 300,
                description: "x",
                status: "listing",
            })
        );
    });

    it("accepts creation at 100,000 yen (upper bound)", async () => {
        const seller = studentAuth("seller");
        const db = seller.firestore();

        await assertSucceeds(
            setDoc(doc(db, "items", "item-max"), {
                seller_id: "seller",
                title: "test",
                price: 100000,
                description: "x",
                status: "listing",
            })
        );
    });
});

describe("items: delete only allowed while status == 'listing'", () => {
    it("seller can delete their own 'listing' item", async () => {
        await env.withSecurityRulesDisabled(async (ctx) => {
            await setDoc(doc(ctx.firestore(), "items", "live-item"), {
                seller_id: "seller",
                title: "test",
                price: 500,
                description: "x",
                status: "listing",
            });
        });

        const seller = studentAuth("seller");
        await assertSucceeds(deleteDoc(doc(seller.firestore(), "items", "live-item")));
    });

    it("seller cannot delete an item that is in 'matching' (transaction in progress)", async () => {
        await env.withSecurityRulesDisabled(async (ctx) => {
            await setDoc(doc(ctx.firestore(), "items", "matching-item"), {
                seller_id: "seller",
                title: "test",
                price: 500,
                description: "x",
                status: "matching",
            });
        });

        const seller = studentAuth("seller");
        await assertFails(deleteDoc(doc(seller.firestore(), "items", "matching-item")));
    });

    it("seller cannot delete an item that has been sold (audit-trail preservation)", async () => {
        await env.withSecurityRulesDisabled(async (ctx) => {
            await setDoc(doc(ctx.firestore(), "items", "sold-item"), {
                seller_id: "seller",
                title: "test",
                price: 500,
                description: "x",
                status: "sold",
            });
        });

        const seller = studentAuth("seller");
        await assertFails(deleteDoc(doc(seller.firestore(), "items", "sold-item")));
    });
});

describe("transactions: payment_pending -> completed is server-only", () => {
    it("buyer cannot fast-forward payment_pending directly to completed from the client", async () => {
        await env.withSecurityRulesDisabled(async (ctx) => {
            await setDoc(doc(ctx.firestore(), "transactions", "tx-skip"), {
                buyer_id: "alice",
                seller_id: "bob",
                item_id: "item1",
                status: "payment_pending",
            });
        });

        const alice = studentAuth("alice");
        await assertFails(
            updateDoc(doc(alice.firestore(), "transactions", "tx-skip"), {
                status: "completed",
            })
        );
    });

    it("seller cannot fast-forward payment_pending to completed either", async () => {
        await env.withSecurityRulesDisabled(async (ctx) => {
            await setDoc(doc(ctx.firestore(), "transactions", "tx-skip-2"), {
                buyer_id: "alice",
                seller_id: "bob",
                item_id: "item1",
                status: "payment_pending",
            });
        });

        const bob = studentAuth("bob");
        await assertFails(
            updateDoc(doc(bob.firestore(), "transactions", "tx-skip-2"), {
                status: "completed",
            })
        );
    });
});

describe("items: price range enforced on update too", () => {
    it("seller cannot lower price below 300 on update", async () => {
        await env.withSecurityRulesDisabled(async (ctx) => {
            await setDoc(doc(ctx.firestore(), "items", "item-update-cheap"), {
                seller_id: "seller",
                title: "test",
                price: 1000,
                description: "x",
                status: "listing",
            });
        });

        const seller = studentAuth("seller");
        await assertFails(
            updateDoc(doc(seller.firestore(), "items", "item-update-cheap"), {
                price: 299,
            })
        );
    });

    it("seller can update price within range", async () => {
        await env.withSecurityRulesDisabled(async (ctx) => {
            await setDoc(doc(ctx.firestore(), "items", "item-update-ok"), {
                seller_id: "seller",
                title: "test",
                price: 1000,
                description: "x",
                status: "listing",
            });
        });

        const seller = studentAuth("seller");
        await assertSucceeds(
            updateDoc(doc(seller.firestore(), "items", "item-update-ok"), {
                price: 5000,
            })
        );
    });
});

describe("items: non-owner cannot delete another's item", () => {
    it("buyer cannot delete a seller's listing", async () => {
        await env.withSecurityRulesDisabled(async (ctx) => {
            await setDoc(doc(ctx.firestore(), "items", "others-item"), {
                seller_id: "seller",
                title: "test",
                price: 500,
                description: "x",
                status: "listing",
            });
        });

        const buyer = studentAuth("buyer");
        await assertFails(deleteDoc(doc(buyer.firestore(), "items", "others-item")));
    });
});

describe("transactions: non-participant cannot create with spoofed buyer_id", () => {
    it("mallory cannot create a transaction claiming to be alice", async () => {
        const mallory = studentAuth("mallory");
        await assertFails(
            setDoc(doc(mallory.firestore(), "transactions", "fake-tx"), {
                buyer_id: "alice",
                seller_id: "bob",
                item_id: "item1",
                status: "request_sent",
            })
        );
    });
});
