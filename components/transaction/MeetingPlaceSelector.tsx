import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { MapPin } from "lucide-react";

interface MeetingPlaceSelectorProps {
    value?: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}

const PLACES = [
    "1号館 1F ロビー",
    "3号館 学食前ベンチ",
    "図書館前（旧・新）",
    "5号館 ファミリーマート前",
    "6号館 (アリーナ) 入口"
];

export const MeetingPlaceSelector = ({ value, onChange, disabled }: MeetingPlaceSelectorProps) => {
    return (
        <div className="space-y-2">
            <Label className="flex items-center gap-2 text-slate-700">
                <MapPin className="w-4 h-4 text-violet-600" />
                待ち合わせ場所 (候補)
            </Label>
            <Select onValueChange={onChange} value={value} disabled={disabled}>
                <SelectTrigger className="w-full bg-white border-slate-200">
                    <SelectValue placeholder="場所を選択してください" />
                </SelectTrigger>
                <SelectContent>
                    {PLACES.map((place) => (
                        <SelectItem key={place} value={place}>
                            {place}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
};
