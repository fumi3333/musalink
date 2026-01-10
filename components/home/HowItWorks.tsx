import { Search, CreditCard, Handshake, QrCode } from 'lucide-react';

export const HowItWorks = () => {
    const steps = [
        {
            icon: <Search className="w-8 h-8 text-violet-600" />,
            title: "1. 探す & リクエスト",
            description: "学内の出品から欲しい教科書を見つけ、購入リクエストを送ります。"
        },
        {
            icon: <CreditCard className="w-8 h-8 text-blue-600" />,
            title: "2. 予約 (Reserve)",
            description: "出品者が承認したら、カードで支払いを「予約」します。まだ決済は確定しません。"
        },
        {
            icon: <QrCode className="w-8 h-8 text-emerald-600" />,
            title: "3. 会う & 確定",
            description: "キャンパスで受け渡し。QRコードを見せ合って取引完了、ここで初めて決済されます。"
        }
    ];

    return (
        <section className="py-24 bg-slate-50">
            <div className="container mx-auto px-4">
                <div className="text-center mb-16">
                    <h2 className="text-3xl font-bold text-slate-800 mb-4">安心・安全な取引の流れ</h2>
                    <p className="text-slate-600">対面取引 × キャッシュレス決済で、トラブルを防ぎます。</p>
                </div>

                <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                    {steps.map((step, index) => (
                        <div key={index} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative">
                            {index < steps.length - 1 && (
                                <div className="hidden md:block absolute top-[40%] -right-4 w-8 h-0.5 bg-slate-200 z-10" />
                            )}
                            <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mb-6 mx-auto">
                                {step.icon}
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 mb-3 text-center">{step.title}</h3>
                            <p className="text-slate-600 text-center leading-relaxed">
                                {step.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};
