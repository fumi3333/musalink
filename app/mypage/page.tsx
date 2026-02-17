"use client";

import React, { useEffect, useState, Suspense } from 'react'; // Added Suspense
import { useAuth } from '@/contexts/AuthContext';
// ... imports

// ... ListingItemCard and TransactionItemCard code ...

function MyPageContent() {
    const { userData, loading: authLoading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const currentTab = searchParams.get('tab') || 'selling';

    const handleTabChange = (value: string) => {
        router.push(`/mypage?tab=${value}`);
    };
    
    // ... rest of the component logic ...
    
    // (Existing return JSX)
    return (
        <div className="min-h-screen bg-slate-100 pb-20">
             {/* ... */}
        </div>
    );
}

export default function MyPage() {
    return (
        <Suspense fallback={<div className="min-h-screen pt-20 text-center">読み込み中...</div>}>
            <MyPageContent />
        </Suspense>
    );
}
