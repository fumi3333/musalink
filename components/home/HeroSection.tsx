import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Search, PlusCircle, ArrowRight } from 'lucide-react';

export const HeroSection = () => {
    return (
        <section className="relative overflow-hidden bg-slate-900 text-white pb-20 pt-32 lg:pt-48">
            {/* Background Gradients */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
                <div className="absolute -top-[30%] -left-[10%] w-[70%] h-[70%] rounded-full bg-violet-600/30 blur-[100px]" />
                <div className="absolute top-[20%] -right-[10%] w-[60%] h-[60%] rounded-full bg-blue-500/20 blur-[100px]" />
                <div className="absolute -bottom-[20%] left-[20%] w-[50%] h-[50%] rounded-full bg-emerald-500/10 blur-[100px]" />
            </div>

            <div className="container mx-auto px-4 relative z-10 text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm text-sm font-medium mb-8 animate-fade-in-up">
                    <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    武蔵野大学生専用マーケットプレイス
                </div>

                <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-gradient-to-r from-white via-white to-slate-300 bg-clip-text text-transparent">
                    キャンパスで、<br className="md:hidden" />次の誰かへ。
                </h1>

                <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
                    Musaは、先輩から後輩へ、教科書やアイテムを
                    <br className="hidden md:block" />
                    安全に継承するための学内限定フリマアプリです。
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Button asChild size="lg" className="relative z-20 w-full sm:w-auto bg-violet-600 hover:bg-violet-700 text-white font-bold px-8 py-6 text-lg shadow-lg hover:translate-y-[-2px] transition-all">
                        <Link href="/items">
                            <Search className="w-5 h-5 mr-2" />
                            教科書を探す
                        </Link>
                    </Button>
                    <Button asChild size="lg" variant="outline" className="w-full sm:w-auto h-14 px-8 text-lg font-bold border-white/30 text-white hover:bg-white/10 rounded-full backdrop-blur-sm transition-all hover:scale-105 bg-black/40">
                        <Link href="/items/create">
                            <PlusCircle className="mr-2 h-5 w-5" />
                            教科書を出品
                        </Link>
                    </Button>
                </div>

                <div className="mt-16 flex items-center justify-center gap-8 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
                    {/* Trust Indicators / Univ Vibe (Mock logos or text) */}
                    <span className="text-sm font-semibold tracking-widest text-slate-400">武蔵野大学 学生専用プラットフォーム</span>
                </div>
            </div>
        </section>
    );
};
