"use client";

import React from 'react';
import QRCode from 'react-qr-code';

interface QRCodeGeneratorProps {
    value: string;
    size?: number;
}

export const QRCodeGenerator: React.FC<QRCodeGeneratorProps> = ({ value, size = 256 }) => {
    return (
        <div className="bg-white p-4 rounded-xl border-4 border-slate-900 inline-block shadow-sm">
            <QRCode
                size={size}
                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                value={value}
                viewBox={`0 0 ${size} ${size}`}
                fgColor="#1e293b" // Slate-800
            />
            <p className="mt-2 text-center text-xs font-bold text-slate-500">Scan to Complete</p>
        </div>
    );
};
