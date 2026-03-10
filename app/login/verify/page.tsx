"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { verifyEmailLink } from "@/lib/auth";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, MailCheck, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

function VerifyContent() {
    const router = useRouter();
    const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        const verifyLink = async () => {
            try {
                // Must ensure this is the browser environment
                if (typeof window === 'undefined') return;

                const user = await verifyEmailLink(window.location.href);
                
                if (user) {
                    setStatus("success");
                    toast.success("ログインに成功しました。");
                    
                    // Small delay for user to read success message before redirecting
                    setTimeout(() => {
                        window.location.href = "/items"; // Full page reload prevents NextJS caching issues with auth state
                    }, 1000);
                } else {
                    setStatus("error");
                    setErrorMessage("無効なリンクであるか、有効期限が切れています。もう一度ログインページからお試しください。");
                }
            } catch (error: any) {
                console.error("Verification error:", error);
                setStatus("error");
                setErrorMessage(error.message || "検証中にエラーが発生しました。");
            }
        };

        verifyLink();
    }, []);

    return (
        <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
            <Card className="w-full max-w-md shadow-lg">
                <CardHeader className="text-center space-y-2">
                    <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-2 
                        ${status === 'verifying' ? 'bg-blue-100' : 
                          status === 'success' ? 'bg-green-100' : 'bg-red-100'}`}>
                        {status === 'verifying' && <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />}
                        {status === 'success' && <MailCheck className="w-6 h-6 text-green-600" />}
                        {status === 'error' && <AlertCircle className="w-6 h-6 text-red-600" />}
                    </div>
                    <CardTitle className="text-xl font-bold text-slate-800">
                        {status === "verifying" && "認証を確認中..."}
                        {status === "success" && "認証成功"}
                        {status === "error" && "エラー"}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-2 text-center text-sm text-slate-600">
                    {status === "verifying" && (
                        <p>
                            リンクを確認しています。この画面のまましばらくお待ちください。
                        </p>
                    )}
                    {status === "success" && (
                        <p>
                            ログインが完了しました。まもなくメイン画面へ移動します。<br/>
                            移動しない場合はボタンを押してください。
                        </p>
                    )}
                    {status === "error" && (
                        <div className="space-y-4">
                            <p className="text-red-600 font-medium">{errorMessage}</p>
                            <Button 
                                variant="outline" 
                                className="w-full"
                                onClick={() => router.push("/login")}
                            >
                                ログイン画面に戻る
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

export default function VerifyPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
               <div className="animate-pulse flex items-center gap-2 text-slate-500">
                   <Loader2 className="w-5 h-5 animate-spin"/>
                   <span>読み込み中...</span>
               </div>
            </div>
        }>
            <VerifyContent />
        </Suspense>
    );
}
