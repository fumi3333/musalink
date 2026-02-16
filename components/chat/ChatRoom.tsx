"use client";

import React, { useEffect, useState, useRef } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, setDoc, doc, getDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Send, User as UserIcon } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface Message {
    id: string;
    text: string;
    senderId: string;
    createdAt: any;
}

interface ChatRoomProps {
    transactionId: string;
    buyerId: string;
    sellerId: string;
}

export const ChatRoom = ({ transactionId, buyerId, sellerId }: ChatRoomProps) => {
    const { user } = useAuth();
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [sending, setSending] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    const conversationId = transactionId; // 1:1 mapping for simplicity

    useEffect(() => {
        if (!transactionId) return;

        // Subscribe to Messages
        const q = query(
            collection(db, "conversations", conversationId, "messages"),
            orderBy("createdAt", "asc")
        );

        const unsubscribe = onSnapshot(q, {
            next: (snapshot) => {
                const msgs = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as Message));
                setMessages(msgs);
                // Scroll to bottom on new message
                setTimeout(() => {
                    if (scrollRef.current) {
                        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                    }
                }, 100);
            },
            error: (error) => {
                // Silently handle permission errors during role switching
                if (error.code === 'permission-denied') {
                    console.debug("Chat listener permission denied (likely auth switch). Ignoring.");
                    return;
                }
                console.error("Chat listener error:", error);
            }
        });

        return () => unsubscribe();
    }, [transactionId, conversationId]);

    const handleSend = async () => {
        if (!newMessage.trim() || !user) return;
        setSending(true);

        try {
            // 1. Ensure Conversation Exists (Idempotent)
            // We check/set this every time or just once? Setting with merge=true is safe and cheap enough.
            // This ensures 'participants' are there for the Cloud Function to find the recipient email.
            await setDoc(doc(db, "conversations", conversationId), {
                participants: [buyerId, sellerId],
                itemId: "linked_via_transaction", // Could pass this down if needed
                updatedAt: serverTimestamp(),
                lastMessage: newMessage
            }, { merge: true });

            // 2. Add Message
            await addDoc(collection(db, "conversations", conversationId, "messages"), {
                text: newMessage,
                senderId: user.uid,
                createdAt: serverTimestamp(),
                read: false
            });

            setNewMessage("");
        } catch (error) {
            console.error("Failed to send message", error);
        } finally {
            setSending(false);
        }
    };

    if (!user) return null;

    return (
        <div className="flex flex-col h-[400px] border rounded-lg bg-white shadow-sm overflow-hidden mt-4">
            {/* Header */}
            <div className="bg-slate-50 p-3 border-b flex items-center justify-between">
                <span className="font-bold text-slate-700 text-sm">💬 取引メッセージ</span>
                <span className="text-xs text-slate-400">相手と直接やり取りできます</span>
            </div>

            {/* Message List */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
                {messages.length === 0 && (
                    <div className="text-center text-slate-400 text-sm py-10">
                        まだメッセージはありません。<br />
                        挨拶を送ってみましょう！
                    </div>
                )}
                {messages.map((msg) => {
                    const isMe = msg.senderId === user.uid;
                    return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] rounded-lg p-3 text-sm ${isMe
                                ? 'bg-violet-600 text-white rounded-br-none'
                                : 'bg-white border text-slate-800 rounded-bl-none shadow-sm'
                                }`}>
                                {msg.text}
                                <div className={`text-[10px] mt-1 text-right ${isMe ? 'text-violet-200' : 'text-slate-400'}`}>
                                    {/* Handle Firestore Timestamp or Date */}
                                    {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Input Area */}
            <div className="p-3 bg-white border-t flex gap-2">
                <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    placeholder="メッセージを入力..."
                    className="flex-1 border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    disabled={sending}
                />
                <Button onClick={handleSend} disabled={!newMessage.trim() || sending} size="icon" className="bg-violet-600 hover:bg-violet-700">
                    <Send className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
};
