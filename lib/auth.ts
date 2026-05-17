import { auth } from './firebase';
import { signOut, User, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth';
import { ALLOWED_DOMAIN } from './constants';

// 注: Google ログインは AuthContext の login() を使う。
// 旧 signInWithGoogle() / logout() はこのファイルから 2026-05-17 に削除済み。

export const sendLoginLink = async (email: string) => {
    if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
        throw new Error(`武蔵野大学のメールアドレス（@${ALLOWED_DOMAIN}）のみ利用可能です。`);
    }

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    
    const actionCodeSettings = {
        url: `${baseUrl}/login/verify`,
        handleCodeInApp: true,
    };

    try {
        await sendSignInLinkToEmail(auth, email, actionCodeSettings);
        window.localStorage.setItem('emailForSignIn', email);
    } catch (error) {
        console.error("Error sending email link", error);
        throw error;
    }
};

export const verifyEmailLink = async (windowUrl: string): Promise<User | null> => {
    if (isSignInWithEmailLink(auth, windowUrl)) {
        let email = window.localStorage.getItem('emailForSignIn');
        // If missing email, prompt user for it
        if (!email) {
            email = window.prompt('確認のため、リンクを送信したメールアドレスを入力してください。');
        }
        
        if (!email) {
            throw new Error("メールアドレスが必要です。");
        }

        try {
            const result = await signInWithEmailLink(auth, email, windowUrl);
            window.localStorage.removeItem('emailForSignIn');
            
            // Domains Restrictions again
            if (!result.user.email?.endsWith(`@${ALLOWED_DOMAIN}`)) {
                await signOut(auth);
                throw new Error(`武蔵野大学のメールアドレス（@${ALLOWED_DOMAIN}）のみ利用可能です。`);
            }

            return result.user;
        } catch (error) {
            console.error("Error signing in with email link", error);
            throw error;
        }
    }
    return null;
};

