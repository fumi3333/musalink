"use client";

import React, { useEffect, useRef, useState } from 'react';
// import { Html5QrcodeScanner } from 'html5-qrcode'; // Dynamic import used instead

interface QRCodeScannerProps {
    onScan: (decodedText: string) => void;
    onError?: (error: any) => void;
}

export const QRCodeScanner: React.FC<QRCodeScannerProps> = ({ onScan, onError }) => {
    const [scanResult, setScanResult] = useState<string | null>(null);
    const scannerRef = useRef<any | null>(null);
    const regionId = "html5qr-code-full-region";

    useEffect(() => {
        // Prevent duplicate initialization or server-side execution
        if (typeof window === "undefined" || scannerRef.current) return;

        let scanner: any = null;

        import('html5-qrcode').then(({ Html5QrcodeScanner }) => {
            scanner = new Html5QrcodeScanner(
                regionId,
                { 
                    fps: 10, 
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0,
                    showTorchButtonIfSupported: true
                },
                /* verbose= */ false
            );
            
            scannerRef.current = scanner;

            scanner.render(
                (decodedText: string) => {
                    // Success Callback
                    if (scanResult !== decodedText) {
                        // Stop scanning after success
                        scanner.clear().catch((err: any) => console.error("Failed to clear scanner", err));
                        setScanResult(decodedText);
                        onScan(decodedText);
                    }
                },
                (errorMessage: string) => {
                    // Error Callback
                    if (onError) {
                        if (!errorMessage?.includes("No MultiFormat Readers")) {
                             // onError(errorMessage); 
                        }
                    }
                }
            );
        }).catch(err => {
            console.error("Failed to load html5-qrcode", err);
        });

        // Cleanup
        return () => {
            if (scanner) {
                scanner.clear().catch((error: any) => {
                    console.error("Failed to clear html5-qrcode scanner. ", error);
                });
            }
            scannerRef.current = null;
        };
    }, []); // Empty dependency array to run once on mount

    return (
        <div className="w-full max-w-sm mx-auto bg-black rounded-xl overflow-hidden shadow-2xl">
            {scanResult ? (
                 <div className="p-8 text-center bg-green-500 text-white animate-in zoom-in">
                    <p className="text-2xl font-bold mb-2">スキャン成功！</p>
                    <p className="text-sm opacity-90">処理を開始します...</p>
                 </div>
            ) : (
                <div id={regionId} className="w-full text-white bg-slate-900"></div>
            )}
            
            {!scanResult && (
                <p className="text-center text-xs text-slate-400 py-2 bg-slate-900">
                    四角い枠内に相手のQRコードを合わせてください
                </p>
            )}
        </div>
    );
};
