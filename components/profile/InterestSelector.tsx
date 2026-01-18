import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tag } from 'lucide-react';

export const INTEREST_TAGS = [
    // Academics
    "Law", "Economics", "Business", "Literature", "Engineering", "Data Science", "Nursing", "Education",
    // Zax / Common Interests
    "Music", "Tech", "Art", "Sports", "Reading", "Travel", "Cooking", "Gaming", "Photography", "Fashion"
];

interface InterestSelectorProps {
    selected: string[];
    onChange: (tags: string[]) => void;
}

export function InterestSelector({ selected, onChange }: InterestSelectorProps) {

    const toggleTag = (tag: string) => {
        if (selected.includes(tag)) {
            onChange(selected.filter(t => t !== tag));
        } else {
            if (selected.length >= 5) {
                // simple max limit toast or just ignore could be better but let's just ignore for now or handle in parent
                return;
            }
            onChange([...selected, tag]);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <Tag className="w-4 h-4" />
                興味・関心 (Interests)
                <span className="text-xs font-normal text-slate-400 ml-auto">
                    Max 5 (Selected: {selected.length})
                </span>
            </div>

            <div className="flex flex-wrap gap-2">
                {INTEREST_TAGS.map(tag => {
                    const isSelected = selected.includes(tag);
                    return (
                        <Badge
                            key={tag}
                            variant={isSelected ? "default" : "outline"}
                            className={`
                                cursor-pointer px-3 py-1.5 transition-all
                                ${isSelected
                                    ? 'bg-violet-600 hover:bg-violet-700 border-violet-600'
                                    : 'hover:bg-violet-50 hover:text-violet-600 hover:border-violet-200 text-slate-500'
                                }
                            `}
                            onClick={() => toggleTag(tag)}
                        >
                            {tag}
                        </Badge>
                    );
                })}
            </div>
        </div>
    );
}
