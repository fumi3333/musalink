import { Leaf, Recycle, Users } from "lucide-react";

export const SustainabilitySection = () => {
    const goals = [
        {
            icon: <Leaf className="w-8 h-8 text-emerald-600" />,
            title: "脱炭素社会へ (Carbon Neutral)",
            description: "学内での手渡し取引により、配送にかかるCO2排出をゼロに。梱包資材の削減にも貢献し、環境負荷を最小限に抑えます。"
        },
        {
            icon: <Recycle className="w-8 h-8 text-blue-600" />,
            title: "資源の循環 (Resource Circularity)",
            description: "読み終わった教科書や不要になった家具を廃棄せず、次の学生へ。学内でのリユースサイクルを作り出し、廃棄物を削減します。"
        },
        {
            icon: <Users className="w-8 h-8 text-amber-600" />,
            title: "コミュニティの活性化 (Social Impact)",
            description: "「譲る」「受け取る」という行為を通じて、キャンパス内のつながりを創出。持続可能な学内コミュニティの形成に寄与します。"
        }
    ];

    return (
        <section className="py-24 bg-white border-t border-slate-100">
            <div className="container mx-auto px-4">
                <div className="text-center mb-16">
                    <span className="text-emerald-600 font-bold text-sm tracking-wider uppercase mb-2 block">Our Mission</span>
                    <h2 className="text-3xl font-bold text-slate-800 mb-4">持続可能なキャンパスライフのために</h2>
                    <p className="text-slate-600 max-w-2xl mx-auto">
                        Musalinkは、単なるフリマアプリではありません。<br />
                        学生同士の支え合いを通じて、より豊かな社会と未来を作るためのプラットフォームです。
                    </p>
                </div>

                <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                    {goals.map((goal, index) => (
                        <div key={index} className="bg-slate-50 p-8 rounded-2xl hover:bg-slate-100 transition-colors">
                            <div className="w-14 h-14 rounded-full bg-white shadow-sm flex items-center justify-center mb-6">
                                {goal.icon}
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 mb-3">{goal.title}</h3>
                            <p className="text-slate-600 leading-relaxed text-sm">
                                {goal.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};
