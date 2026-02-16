"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Search, Bell, User, Menu, X, PlusCircle } from 'lucide-react';
import { AuthButtons } from './AuthButtons';

import { IS_BETA } from '@/lib/constants';

export const Header = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-white/20">
            {/* BETA BANNER */}
            {IS_BETA && (
                <div className="bg-amber-400 text-amber-900 text-center text-xs font-bold py-1 px-4 shadow-sm border-b border-amber-500/20">
                    🚧 ベータテストモード - 実際の決済は発生しません 🚧
                </div>
            )}
            <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                {/* Logo */}
                <Link href="/" className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-violet-600 to-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                        M
                    </div>
                    <span className="font-bold text-xl tracking-tight text-slate-800">
                        Musalink
                    </span>
                </Link>

                {/* Desktop Nav */}
                <nav className="hidden md:flex items-center gap-6">
                    <Link href="/items" className="text-sm font-medium text-slate-600 hover:text-violet-600 transition-colors">
                        探す
                    </Link>
                </nav>

                {/* Actions & Mobile Menu Toggle */}
                <div className="flex items-center gap-2">
                    {/* If user is logged in, show User Icon, else show Login Button */}
                    <AuthButtons />

                    {/* Mobile Hamburger */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="md:hidden text-slate-800"
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                    >
                        {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                    </Button>
                </div>
            </div>

            {/* Mobile Menu Overlay */}
            {isMenuOpen && (
                <div className="md:hidden absolute top-16 left-0 right-0 bg-white border-b border-slate-200 shadow-xl p-4 flex flex-col gap-4 animate-in slide-in-from-top-2">
                    <Link
                        href="/items"
                        className="flex items-center gap-3 p-3 rounded-md hover:bg-slate-50 text-slate-700 font-bold"
                        onClick={() => setIsMenuOpen(false)}
                    >
                        <Search className="w-5 h-5 text-violet-600" />
                        探す
                    </Link>
                    <Link
                        href="/transactions"
                        className="flex items-center gap-3 p-3 rounded-md hover:bg-slate-50 text-slate-700 font-bold"
                        onClick={() => setIsMenuOpen(false)}
                    >
                        <Bell className="w-5 h-5 text-violet-600" />
                        取引一覧
                    </Link>
                    <Link
                        href="/notifications"
                        className="flex items-center gap-3 p-3 rounded-md hover:bg-slate-50 text-slate-700 font-bold"
                        onClick={() => setIsMenuOpen(false)}
                    >
                        <Bell className="w-5 h-5 text-violet-600" />
                        お知らせ
                    </Link>
                    <Link
                        href="/items/create"
                        className="flex items-center gap-3 p-3 rounded-md hover:bg-slate-50 text-slate-700 font-bold"
                        onClick={() => setIsMenuOpen(false)}
                    >
                        <PlusCircle className="w-5 h-5 text-violet-600" />
                        出品する
                    </Link>
                    <Link
                        href="/mypage"
                        className="flex items-center gap-3 p-3 rounded-md hover:bg-slate-50 text-slate-700 font-bold"
                        onClick={() => setIsMenuOpen(false)}
                    >
                        <User className="w-5 h-5 text-violet-600" />
                        マイページ
                    </Link>

                </div>
            )}
        </header>
    );
};
