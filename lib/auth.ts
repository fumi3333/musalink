import { auth } from './firebase';
import { GoogleAuthProvider, signInWithPopup, signOut, User } from 'firebase/auth';
import { ALLOWED_DOMAIN } from './constants';

export const signInWithGoogle = async (): Promise<User | null> => {
    const provider = new GoogleAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        // Domain Restriction Validation
        if (!user.email?.endsWith(`@${ALLOWED_DOMAIN}`)) {
            // Unauthorized domain
            await signOut(auth); // Immediately sign out
            throw new Error(`Only ${ALLOWED_DOMAIN} email addresses are allowed.`);
        }

        return user;
    } catch (error) {
        console.error("Error signing in with Google", error);
        throw error;
    }
};

export const logout = async () => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Error signing out", error);
        throw error;
    }
};
