# Musalink Architecture Overview

## 1. System Overview
Musalink is a P2P marketplace platform designed exclusively for Musashino University students. It allows students to buy and sell textbooks and study materials safely within the campus community using their university email addresses as identity verification.

## 2. Technical Stack
- **Frontend**: Next.js 14+ (App Router), React, Tailwind CSS, shadcn/ui
- **Backend**: Firebase (Authentication, Firestore, Storage, Cloud Functions)
- **Payment**: Stripe Connect (Express accounts) for direct P2P payments
- **Language**: TypeScript

## 3. Core Features & Data Flow

### 3.1 Authentication
- **Provider**: Google Sign-In restricted to `@stu.musashino-u.ac.jp` domain.
- **Data**: User profiles stored in `users/{uid}`. Sensitive data (Stripe ID, email) stored in `users/{uid}/private_data/profile` for security.

### 3.2 Listing & Search
- **Items**: Stored in `items` collection.
- **Search**: Client-side filtering (for MVP) or Firestore queries. Images stored in Firebase Storage.

### 3.3 Transaction Flow (The "Musalink Flow")
1.  **Request**: Buyer requests an item -> `transactions` doc created with status `request_sent`.
2.  **Approval**: Seller approves -> Status `approved` -> Payment Intent created (Stripe).
3.  **Payment**: Buyer pays via Stripe (Auth Hold) -> Status `payment_pending`.
4.  **Handover**: Users meet on campus. 
5.  **Completion**: Buyer/Seller confirms handover -> `capturePayment` Cloud Function runs -> Stripe Charge Captured -> Funds transferred to Seller's Stripe Account -> Status `completed`.

### 3.4 Payouts
- **Stripe Connect**: Sellers register as Express accounts.
- **Direct Payout**: Funds are held by Stripe and paid out directly to the seller's bank account. The platform does not hold funds (compliant with Japanese Payment Services Act for avoiding "funds transfer business" regulation).

## 4. Key Cloud Functions
- `createStripeAccount`: Creates Express account for sellers.
- `createPaymentIntent`: Initializes payment for an item.
- `capturePayment`: Finalizes the transaction and transfers funds.
- `cancelTransaction`: Handles refunds/cancellations.
- `onTransactionCreated` / `onMessageCreated`: Triggers notifications (Email + In-App).

## 5. Security Measures
- **Firestore Rules**: Strict R/W access based on authentication and resource ownership.
- **Private Data**: Sensitive fields separated into subcollections.
- **App Check**: (Planned/Recommended) To prevent abuse.

## 6. Directory Structure
- `app/`: Next.js pages and layouts
- `components/`: Reusable UI components
- `functions/`: Backend logic (Cloud Functions)
- `lib/`: Utility functions and Firebase config
- `types/`: TypeScript definitions
