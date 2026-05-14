"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';

interface QRCodeScannerProps {
    onScan: (decodedText: string) => void;
    onError?: (error: any) => void;
}

export const QRCodeScanner: React.FC<QRCodeScannerProps> = ({ onScan, onError }) => {
    const [scanResult, setScanResult] = useState<string | null>(null);
    const scannerRef = useRef<any | null>(null);
    const regionId = "html5qr-code-full-region";
    const processedRef = useRef(false);

    // Keep latest onScan reference
    const onScanRef = useRef(onScan);
    useEffect(() => {
        onScanRef.current = onScan;
    }, [onScan]);

    useEffect(() => {
        if (typeof window === "undefined") return;

        let isMounted = true;

        const initializeScanner = async () => {
            if (scannerRef.current) return;
            
            try {
                const { Html5QrcodeScanner } = await import('html5-qrcode');
                
                if (!isMounted || scannerRef.current) return;

                const scanner = new Html5QrcodeScanner(
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
                        if (!processedRef.current) {
                            processedRef.current = true;
                            // Stop scanning after success
                            scanner.clear().catch((err: any) => console.error("Failed to clear scanner", err));
                            setScanResult(decodedText);
                            onScanRef.current(decodedText);
                        }
                    },
                    (errorMessage: string) => {
                        // Error Callback
                        if (onError && !errorMessage?.includes("No MultiFormat Readers")) {
                            // onError(errorMessage); 
                        }
                    }
                );
            } catch (err) {
                console.error("Failed to load html5-qrcode", err);
            }
        };

        initializeScanner();

        // Cleanup
        return () => {
            isMounted = false;
            if (scannerRef.current) {
                scannerRef.current.clear().catch((error: any) => {
                    console.error("Failed to clear html5-qrcode scanner. ", error);
                });
                scannerRef.current = null;
            }
        };
    }, []); // Empty dependency array to run once on mount

    return (
        <div className="w-full max-w-sm mx-auto bg-black rounded-xl overflow-hidden shadow-2xl">
            {/* 
              ReactによってDOMが消されないように、scanResultがあっても
              idを持つdivは残しつつCSSで隠す。これで scanner.clear() が安全に走る。
            */}
            <div id={regionId} className={`w-full text-white bg-slate-900 ${scanResult ? 'hidden' : 'block'}`}></div>
            
            {scanResult ? (
                 <div className="p-8 text-center bg-green-500 text-white animate-in zoom-in">
                    <p className="text-2xl font-bold mb-2">スキャン成功！</p>
                    <p className="text-sm opacity-90">処理を開始します...</p>
                 </div>
            ) : (
                <p className="text-center text-xs text-slate-400 py-2 bg-slate-900">
                    四角い枠内に相手のQRコードを合わせてください
                </p>
            )}
        </div>
    );
};
