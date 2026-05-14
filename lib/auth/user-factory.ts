import { randomBytes } from 'crypto';

// Note: This project currently uses Firebase, not Prisma.
// However, to enforce the best practices learned from the ZAX project:
// 1. Direct user creation (e.g. prisma.user.create or Firebase admin.auth().createUser) 
//    should be centralized here to prevent insecure fallbacks.
// 2. Hardcoded passwords or fallback IDs must be avoided.

export class UserFactory {
  /**
   * Generates a strong random password for guest/email-only accounts
   * to ensure they cannot be easily compromised.
   */
  static generateSecurePassword(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Example: Create a guest user securely.
   */
  static async createGuestUser(sessionId: string) {
    if (!sessionId) {
      throw new Error("Cannot create guest user without session ID");
    }
    
    // Implementation would depend on whether you are using Firebase Auth or Prisma
    // e.g. return await prisma.user.create({ data: { email: `guest_${sessionId}@example.com`, password: this.generateSecurePassword() } })
    return {
      id: `guest_${sessionId}`,
      email: `guest_${sessionId}@example.com`,
      isGuest: true
    };
  }
}
