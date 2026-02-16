import * as functions from "firebase-functions";
import { z } from "zod";

/**
 * Standardize error logging and response.
 * Hides internal errors from the client unless safe to expose.
 */
export const handleError = (res: functions.Response, error: unknown, context: string) => {
    console.error(`[${context}] Error:`, error);
    
    let statusCode = 500;
    let message = "Internal Server Error";
    let details: any = undefined;

    if (error instanceof z.ZodError) {
        statusCode = 400;
        message = "Invalid parameters";
        details = error.errors;
    } else if (error instanceof functions.https.HttpsError) {
        // Map HttpsError codes to HTTP status
        statusCode = httpsErrorToStatusCode(error.code);
        message = error.message;
        details = error.details;
    } else if (error instanceof Error) {
        // Check for specific Stripe errors if needed, otherwise hide
        // For now, exposing message might be safe for some, but dangerous for others.
        // Let's be conservative.
        if ((error as any).type?.startsWith('Stripe')) {
             message = error.message; // Stripe messages are usually safe for users (e.g. card declined)
             statusCode = 400; // Assume client error for Stripe mostly
        }
    }

    res.status(statusCode).json({ error: message, details });
};

/**
 * Handle errors for Callable functions (throws HttpsError).
 */
export const handleCallableError = (error: unknown, context: string): never => {
    console.error(`[${context}] Error:`, error);

    if (error instanceof z.ZodError) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid parameters', error.errors);
    }
    
    if (error instanceof functions.https.HttpsError) {
        throw error;
    }

    // Default to internal
    const message = error instanceof Error ? error.message : "Unknown error";
    // Check for Stripe
    if ((error as any).type?.startsWith('Stripe')) {
        throw new functions.https.HttpsError('aborted', `Stripe Error: ${message}`);
    }

    throw new functions.https.HttpsError('internal', message);
};

const httpsErrorToStatusCode = (code: functions.https.FunctionsErrorCode): number => {
    switch (code) {
        case 'ok': return 200;
        case 'cancelled': return 499; // Client Closed Request
        case 'unknown': return 500;
        case 'invalid-argument': return 400;
        case 'deadline-exceeded': return 504;
        case 'not-found': return 404;
        case 'already-exists': return 409;
        case 'permission-denied': return 403;
        case 'resource-exhausted': return 429;
        case 'failed-precondition': return 400;
        case 'aborted': return 409;
        case 'out-of-range': return 400;
        case 'unimplemented': return 501;
        case 'internal': return 500;
        case 'unavailable': return 503;
        case 'data-loss': return 500;
        case 'unauthenticated': return 401;
        default: return 500;
    }
};
