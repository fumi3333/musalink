import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import React from 'react';

export interface BreadcrumbItem {
    label: string;
    href?: string;
}

interface BreadcrumbsProps {
    items: BreadcrumbItem[];
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items }) => {
    return (
        <nav className="flex items-center text-sm text-slate-500 mb-4 overflow-x-auto whitespace-nowrap">
            <Link href="/" className="hover:text-violet-600 transition-colors flex items-center">
                <Home className="w-4 h-4 mr-1" />
                <span className="sr-only">ホーム</span>
            </Link>
            
            {items.map((item, index) => (
                <div key={index} className="flex items-center">
                    <ChevronRight className="w-4 h-4 mx-2 text-slate-400" />
                    {item.href ? (
                        <Link href={item.href} className="hover:text-violet-600 transition-colors">
                            {item.label}
                        </Link>
                    ) : (
                        <span className="font-medium text-slate-800 pointer-events-none">
                            {item.label}
                        </span>
                    )}
                </div>
            ))}
        </nav>
    );
};
