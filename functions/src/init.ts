// 全 Cloud Functions の共通初期化。最初に一度だけ実行される。
// admin.initializeApp() は重複呼び出し禁止なので、ここに集約する。

require('dotenv').config();

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import Stripe from "stripe";

const config = functions.config() as any;
const stripeSecret = config.stripe?.secret || process.env.STRIPE_SECRET_KEY;

if (!stripeSecret) {
    console.warn("Stripe Config is missing! Run: firebase functions:config:set stripe.secret='sk_test_...' or set STRIPE_SECRET_KEY in functions/.env");
}

export const stripe = new Stripe(stripeSecret || "dummy_key_check_env", {
    apiVersion: "2024-06-20" as any,
});

if (!admin.apps.length) {
    admin.initializeApp();
}

export const db = admin.firestore();
export { admin };
