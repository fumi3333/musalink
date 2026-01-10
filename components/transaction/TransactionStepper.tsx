import { Check } from 'lucide-react';

interface TransactionStepperProps {
    status: 'request_sent' | 'approved' | 'matching' | 'payment_pending' | 'completed' | 'cancelled';
}

export const TransactionStepper = ({ status }: TransactionStepperProps) => {
    // Defines steps. 'id' matches status logic
    const steps = [
        { id: 'matching', label: 'リクエスト', activeStatus: ['request_sent', 'approved', 'matching', 'payment_pending', 'completed'] },
        { id: 'payment_pending', label: '予約・調整', activeStatus: ['payment_pending', 'completed'] },
        { id: 'completed', label: '受渡・完了', activeStatus: ['completed'] },
    ];

    return (
        <div className="w-full py-6">
            <div className="flex items-center justify-between relative">
                {/* Progress Bar Background */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-200 -z-10" />

                {steps.map((step, index) => {
                    // Determine state
                    // Logic simplification:
                    let isActive = false;

                    // Specific status mapping
                    if (status === 'completed') isActive = true;
                    else if (status === 'payment_pending' && index <= 1) isActive = true;
                    else if ((status === 'matching' || status === 'approved' || status === 'request_sent') && index === 0) isActive = true;

                    // Specific check for "completed" step (checkmark)
                    const isStepFinished =
                        (status === 'completed' && index < 2) ||
                        (status === 'payment_pending' && index === 0) ||
                        ((status === 'approved' || status === 'matching') && index === 0 && false); // approved doesn't mean step 1 is 'finished' in stepper terms usually, but let's keep it active.

                    return (
                        <div key={step.id} className="flex flex-col items-center bg-white px-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors duration-300
                                ${isActive ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-slate-300 text-slate-400'}
                            `}>
                                {isStepFinished ? <Check className="w-5 h-5" /> : <span className="text-sm font-bold">{index + 1}</span>}
                            </div>
                            <span className={`text-xs font-bold mt-2 transition-colors duration-300 ${isActive ? 'text-violet-700' : 'text-slate-400'}`}>
                                {step.label}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
