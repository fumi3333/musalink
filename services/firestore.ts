import { db } from "@/lib/firebase";
import {
    collection,
    addDoc,
    getDocs,
    doc,
    getDoc,
    updateDoc,
    query,
    where,
    orderBy,
    serverTimestamp,
    increment,
    DocumentData
} from "firebase/firestore";
import { Item, Transaction, User, TransactionStatus } from "@/types";

// Collection References
const itemsRef = collection(db, "items");
const transactionsRef = collection(db, "transactions");
const usersRef = collection(db, "users");

import { functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";

export const rateUser = async (targetUserId: string, transactionId: string, role: 'buyer' | 'seller', score: number) => {
    try {
        const rateUserFn = httpsCallable(functions, 'rateUser');
        await rateUserFn({ transactionId, score });
        // Note: targetUserId and role are determined server-side for security, but kept in signature for compatibility or if needed later.
    } catch (e: any) {
        if (e.code === 'unavailable' || e.message?.includes('offline') || e.code === 'internal') {
            console.warn("rateUser failed (offline/internal), simulating success.");
            return;
        }
        console.error("Error rating user:", e);
        throw e;
    }
};

// --- Items Service ---

// Mock Data for Fallback - Status corrected to 'listing'
const MOCK_ITEMS: Item[] = [
    {
        id: 'mock_item_1',
        title: 'Mock Textbook A',
        price: 1500,
        seller_id: 'mock-user-s2527084',
        status: 'listing',
        condition: 4,
        description: 'Previously used for Engineering Math.',
        createdAt: new Date(),
        image_urls: [],
        metadata: {
            seller_grade: 'B2',
            seller_department: 'Engineering',
            seller_verified: true
        }
    },
    {
        id: 'mock_item_2',
        title: 'Mock Textbook B',
        price: 800,
        seller_id: 'mock-user-s2527084',
        status: 'listing',
        condition: 3,
        description: 'Good condition, some highlights.',
        createdAt: new Date(),
        image_urls: [],
        metadata: {
            seller_grade: 'B3',
            seller_department: 'Law',
            seller_verified: true
        }
    }
];


// Helper to timeout a promise
const withTimeout = <T>(promise: Promise<T>, ms: number, fallbackValue: T): Promise<T> => {
    return Promise.race([
        promise,
        new Promise<T>((resolve) => setTimeout(() => {
            console.warn(`Firestore operation timed out after ${ms}ms. Using fallback.`);
            resolve(fallbackValue);
        }, ms))
    ]);
};

// --- Items Service ---
import { logEvent, logSearchMiss } from './analytics';

// ... (MOCK_ITEMS definitions)

export const createItem = async (item: Omit<Item, 'id'>) => {
    try {
        // Try to add doc with 2s timeout, fallback to mock ID
        const docRefId = await withTimeout(
            addDoc(itemsRef, {
                ...item,
                createdAt: serverTimestamp(),
            }).then(ref => ref.id),
            2000,
            "mock_item_" + Date.now()
        );

        // [Analytics] Log New Listing
        logEvent('item_listed', { itemId: docRefId, sellerId: item.seller_id, price: item.price, title: item.title });

        return docRefId;
    } catch (error: any) {
        // ... (Offline handling)
        if (error.code === 'unavailable' || error.message?.includes('offline')) {
            console.warn("Firestore offline (createItem), simulating success.");
            return "mock_item_" + Date.now();
        }
        console.error("Error creating item:", error);
        throw error;
    }
};

export const getItems = async (filters?: { department?: string, grade?: string, keyword?: string }): Promise<Item[]> => {
    try {
        // Build constraints
        // Listing中のアイテムのみ取得 (日時降順)
        // Note: Firestore doesn't support full-text search easily.
        // For MVP, we fetch matches by category then filter by keyword client-side.
        // If the dataset grows, we need Algolia/typesense.

        const constraints: any[] = [where("status", "==", "listing")];

        if (filters?.department && filters.department !== "all") {
            constraints.push(where("metadata.seller_department", "==", filters.department));
        }
        if (filters?.grade && filters.grade !== "all") {
            constraints.push(where("metadata.seller_grade", "==", filters.grade));
        }

        const q = query(
            itemsRef,
            ...constraints
            // orderBy("createdAt", "desc") 
        );

        // Timeout 2s, fallback to mock
        const querySnapshot = await withTimeout(
            getDocs(q),
            2000,
            null
        );

        if (!querySnapshot) {
            console.warn("getItems timed out/offline. Returning mock items.");
            return MOCK_ITEMS;
        }

        let results = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Item));

        // Client-side Keyword Filter
        if (filters?.keyword) {
            const lowerKw = filters.keyword.toLowerCase();
            results = results.filter(item =>
                item.title.toLowerCase().includes(lowerKw) ||
                (item.author && item.author.toLowerCase().includes(lowerKw))
            );
        }

        // [Analytics] Log Search Miss (Zero Results)
        if (results.length === 0) {
            // Only log if meaningful search (filters or keyword exist)
            const hasFilters = filters?.department !== "all" || filters?.grade !== "all" || !!filters?.keyword;

            if (hasFilters) {
                const logKw = filters?.keyword || "filter_only";
                // Delay logging slightly to avoid blocking UI? No, it's async promise usually or fire-and-forget.
                logSearchMiss(logKw, filters, "anonymous_or_context_user");
            }
        }

        return results;
    } catch (error: any) {
        // ... (Offline handling)
        if (error.code === 'unavailable' || error.message?.includes('offline')) {
            console.warn("Firestore offline (getItems), returning mocks.");
            return MOCK_ITEMS;
        }
        console.error("Error getting items:", error);
        return [];
    }
};

export const getItem = async (itemId: string): Promise<Item | null> => {
    try {
        if (itemId.startsWith('mock_')) {
            return MOCK_ITEMS.find(i => i.id === itemId) || MOCK_ITEMS[0];
        }

        const docRef = doc(db, "items", itemId);
        const docSnap = await withTimeout(getDoc(docRef), 2000, null);

        if (!docSnap) {
            console.warn("getItem timed out. Returning mock.");
            return MOCK_ITEMS.find(i => i.id === itemId) || MOCK_ITEMS[0];
        }

        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as Item;
        } else {
            return null;
        }
    } catch (error: any) {
        if (error.code === 'unavailable' || error.message?.includes('offline')) {
            console.warn("Firestore offline (getItem), returning mock.");
            return MOCK_ITEMS.find(i => i.id === itemId) || MOCK_ITEMS[0];
        }
        console.error("Error getting item:", error);
        return null; // Return null instead of throwing to prevent UI crash
    }
}


// --- Transactions Service ---

import { runTransaction } from "firebase/firestore";

export const createTransaction = async (itemId: string, buyerId: string, sellerId: string, extraData: Partial<Transaction> = {}) => {
    try {
        // Double Booking Protection: Use Firestore Transaction
        return await runTransaction(db, async (t) => {
            const itemRef = doc(db, "items", itemId);
            const itemDoc = await t.get(itemRef);

            if (!itemDoc.exists()) {
                throw new Error("Item not found");
            }

            const itemData = itemDoc.data() as Item;

            // Critical Check: Is item still available?
            if (itemData.status !== 'listing') {
                throw new Error("This item is no longer available (sold or in negotiation).");
            }

            // Prepare Transaction Data
            const newTxRef = doc(transactionsRef); // Auto-generated ID
            const transactionData: Transaction = {
                id: newTxRef.id,
                item_id: itemId,
                buyer_id: buyerId,
                seller_id: sellerId,
                status: 'request_sent',
                fee_amount: 0,
                unlocked_assets: {},
                createdAt: serverTimestamp(),
                ...extraData
            } as any; // Cast mainly for timestamp type compatibility

            // 1. Create Transaction
            t.set(newTxRef, transactionData);

            // 2. Update Item Status (Lock it)
            t.update(itemRef, {
                status: 'matching'
            });

            // [Analytics] Log New Transaction Request
            // Note: Side effects in transaction will run even if retry happens, but logEvent is safe enough (idempotent-ish)
            // Ideally should be outside, but we need result. 
            // We'll log outside after success.

            return newTxRef.id;
        });

    } catch (error: any) {
        if (error.code === 'unavailable' || error.message?.includes('offline')) {
            console.warn("Firestore offline (createTransaction). Transaction requires online.");
            throw new Error("Transaction creation requires internet connection to prevent double booking.");
        }
        console.error("Error creating transaction:", error);
        throw error;
    }
};

export const getTransaction = async (transactionId: string): Promise<Transaction | null> => {
    try {
        const docRef = doc(db, "transactions", transactionId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as Transaction;
        }
        return null;
    } catch (error) {
        console.error("Error getting transaction:", error);
        throw error;
    }
};

export const updateTransactionStatus = async (
    transactionId: string,
    status: TransactionStatus,
    updates: Partial<Transaction> = {}
) => {
    try {
        const docRef = doc(db, "transactions", transactionId);
        // Optimistic update - await but suppress offline error
        await updateDoc(docRef, {
            status,
            ...updates,
            updatedAt: serverTimestamp()
        });
    } catch (error: any) {
        if (error.code === 'unavailable' || error.message?.includes('offline')) {
            console.warn(`Transaction update failed (offline), ignoring: ${status}`);
            return; // Simulate success
        }
        console.error("Error updating transaction status:", error);
        throw error;
    }
};

// --- Users Service (Mock for MVP) ---

export const getUser = async (userId: string): Promise<User> => {
    // MVP: Firestoreにユーザーがいなければモックを返す、あるいは自動作成するロジック
    // ここでは簡易的にFirestoreを見に行き、なければモックを返す
    try {
        const docRef = doc(db, "users", userId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as User;
        }
    } catch (e) {
        console.warn("User fetch failed, using mock", e);
    }

    // Fallback Mock Data
    return {
        id: userId,
        display_name: userId === 'user_001' ? '田中 太郎' : 'ゲストユーザー',
        trust_score: 50,
        coin_balance: 1000,
        locked_balance: 0,
        student_id: userId === 'user_001' ? 's1234567' : undefined,
        university_email: userId === 'user_001' ? 's1234567@musashino-u.ac.jp' : undefined
    };
}
