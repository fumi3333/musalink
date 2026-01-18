"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '@/services/firestore';
import { Notification } from '@/types';
import { Bell, Check, ChevronRight, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export default function NotificationsPage() {
    const { userData, loading: authLoading } = useAuth();
    const router = useRouter();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!authLoading && !userData) {
            router.push('/');
            return;
        }

        if (userData?.id) {
            loadNotifications();
        }
    }, [userData, authLoading, router]);

    const loadNotifications = async () => {
        if (!userData?.id) return;
        setLoading(true);
        const data = await getNotifications(userData.id);
        setNotifications(data);
        setLoading(false);
    };

    const handleMarkAllRead = async () => {
        if (!userData?.id) return;
        await markAllNotificationsRead(userData.id);
        // Optimistic update
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    const handleNotificationClick = async (notification: Notification) => {
        if (!notification.read && userData?.id) {
            await markNotificationRead(userData.id, notification.id);
            setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, read: true } : n));
        }
        if (notification.link) {
            router.push(notification.link);
        }
    };

    if (authLoading || loading) {
        return <div className="min-h-screen pt-20 text-center text-slate-500">Loading notifications...</div>;
    }

    const unreadCount = notifications.filter(n => !n.read).length;

    return (
        <div className="min-h-screen bg-slate-50 pb-20 pt-4">
            <div className="max-w-md mx-auto px-4">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Bell className="h-6 w-6" />
                        お知らせ
                    </h1>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleMarkAllRead}
                            className="text-slate-500 hover:text-violet-600 text-xs"
                        >
                            <Check className="h-3 w-3 mr-1" />
                            すべて既読にする
                        </Button>
                    )}
                </div>

                <div className="space-y-3">
                    {notifications.length > 0 ? (
                        notifications.map((notification) => (
                            <Card
                                key={notification.id}
                                onClick={() => handleNotificationClick(notification)}
                                className={`
                                    border-none shadow-sm cursor-pointer transition-colors
                                    ${notification.read ? 'bg-white opacity-60' : 'bg-white border-l-4 border-violet-500'}
                                    hover:bg-slate-50
                                `}
                            >
                                <CardContent className="p-4 flex items-start gap-3">
                                    <div className={`
                                        p-2 rounded-full flex-shrink-0
                                        ${notification.type === 'transaction_created' ? 'bg-amber-100 text-amber-600' :
                                            notification.type === 'message_received' ? 'bg-green-100 text-green-600' :
                                                'bg-slate-100 text-slate-500'}
                                    `}>
                                        <Bell className="h-4 w-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start">
                                            <h3 className={`font-bold text-sm mb-1 ${notification.read ? 'text-slate-700' : 'text-slate-900'}`}>
                                                {notification.title}
                                            </h3>
                                            <span className="text-[10px] text-slate-400 whitespace-nowrap ml-2">
                                                {notification.createdAt?.toDate ? notification.createdAt.toDate().toLocaleDateString() : 'Just now'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 line-clamp-2">
                                            {notification.body}
                                        </p>
                                    </div>
                                    {!notification.read && (
                                        <div className="w-2 h-2 rounded-full bg-violet-500 mt-2"></div>
                                    )}
                                </CardContent>
                            </Card>
                        ))
                    ) : (
                        <div className="text-center py-20 text-slate-400">
                            <Inbox className="h-12 w-12 mx-auto mb-3 opacity-20" />
                            <p>お知らせはありません</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
