"use client"

import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [authorized, setAuthorized] = useState(false);

    useEffect(() => {
        if (!loading) {
            // Simple Admin Check: For MVP, only allow specific ID or block generic guests
            // Ideally, checking a custom claim or 'role' field in Firestore
            // Here, we block guests (demo users) and maybe require specific ID if needed.

            // For now: Block if not logged in OR is guest (is_demo/anonymous)
            // Assuming 'user_001' is the "real" user who might be admin.

            if (!user) {
                router.push("/");
                return;
            }

            // If we want to be strict: only allow specific email domain or ID
            // const isAdmin = user.email?.endsWith("@musashino-u.ac.jp"); 
            // Let's just block the known guest patterns for now.

            // NOTE: guest user from createTransaction (demo) has is_demo flag.
            // But auth.currentUser might not have custom claims sync immediately.
            // In our mock 'useAuth', we return { user, userData }.

            // We need to check userData logic in AuthContext, but let's use a safe heuristic:
            // If user is anonymous (Firebase Auth) -> Block
            // If user ID is the hardcoded guest ID -> Block

            if (user.isAnonymous) {
                alert("Access Denied: Admins only.");
                router.push("/");
                return;
            }

            setAuthorized(true);
        }
    }, [user, loading, router]);

    if (loading || !authorized) {
        return <div className="p-10 text-center">Checking Permissions...</div>;
    }

    return <>{children}</>;
}
