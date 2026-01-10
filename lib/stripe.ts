import { loadStripe } from "@stripe/stripe-js";

// Ensure you have NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY in .env.local
export const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
