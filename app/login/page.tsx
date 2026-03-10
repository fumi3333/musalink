"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { sendLoginLink } from "@/lib/auth";
import { ALLOWED_DOMAIN } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { LogIn } from "lucide-react";

function LoginContent() {
  const { user, login, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParams = searchParams.get("redirect");

  const [email, setEmail] = useState("");
  const [isSendingLink, setIsSendingLink] = useState(false);
  const [linkSent, setLinkSent] = useState(false);

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.endsWith(`@${ALLOWED_DOMAIN}`)) {
        toast.error(`武蔵野大学のメールアドレス（@${ALLOWED_DOMAIN}）を入力してください。`);
        return;
    }
    setIsSendingLink(true);
    try {
        await sendLoginLink(email.trim());
        setLinkSent(true);
        toast.success("ログイン用のリンクを送信しました。受信トレイをご確認ください。");
    } catch (error: any) {
        toast.error(error.message || "リンクの送信に失敗しました。");
    } finally {
        setIsSendingLink(false);
    }
  };

  useEffect(() => {
    if (user && !loading) {
      // Prevent open redirect: only allow relative paths starting with /
      if (redirectParams && redirectParams.startsWith('/') && !redirectParams.startsWith('//')) {
        router.push(redirectParams);
      } else {
        router.push("/items");
      }
    }
  }, [user, loading, router, redirectParams]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-pulse text-slate-400">読み込み中...</div>
      </div>
    );
  }

  // If already logged in, the effect above will redirect.
  // While redirecting, show nothing or spinner
  if (user) return null;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-violet-100 rounded-full flex items-center justify-center mb-2">
            <LogIn className="w-6 h-6 text-violet-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-slate-800">
            ログインが必要です
          </CardTitle>
          <p className="text-slate-500 text-sm">
            この機能を利用するには、<br />
            武蔵野大学のGoogleアカウントでログインしてください。
          </p>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <Button
            onClick={login}
            className="w-full h-12 text-lg font-bold bg-violet-600 hover:bg-violet-700 shadow-md transition-all"
          >
            Googleでログイン
          </Button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-50 px-2 text-slate-500">
                または
              </span>
            </div>
          </div>

          {!linkSent ? (
              <form onSubmit={handleSendLink} className="space-y-3">
                <p className="text-xs text-slate-500 text-center mb-2">Googleログインができない場合（大学メール向け）</p>
                <Input 
                    type="email" 
                    placeholder={`...@${ALLOWED_DOMAIN}`} 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-white"
                />
                <Button 
                    type="submit" 
                    variant="outline" 
                    className="w-full border-violet-200 hover:bg-violet-50 text-violet-700"
                    disabled={isSendingLink}
                >
                    {isSendingLink ? "送信中..." : "ログインリンクをメールで送信"}
                </Button>
              </form>
          ) : (
              <div className="p-4 bg-green-50/50 text-green-800 rounded-lg text-sm text-center border border-green-200">
                  <p className="font-medium mb-1">リンクを送信しました</p>
                  <p className="text-xs text-green-700 mb-3 opacity-90">
                    「{email}」の受信トレイからURLをクリックしてログインを完了してください。
                  </p>
                  <Button variant="outline" size="sm" className="h-8 text-xs bg-white text-green-700 hover:text-green-800 hover:bg-green-50 border-green-200" onClick={() => setLinkSent(false)}>
                    戻る
                  </Button>
              </div>
          )}

          <div className="my-6 p-4 bg-slate-50 rounded text-[10px] text-slate-500 leading-relaxed border border-slate-200">
              <p className="font-bold mb-1">【重要事項・免責】</p>
              <ul className="list-disc pl-4 space-y-1">
                  <li>本アプリは武蔵野大学の学生有志による<strong>非公式プロジェクト</strong>です。大学とは一切関係ありません。</li>
                  <li>ユーザー間の金銭・商品トラブルについて、運営は一切の責任を負いません。</li>
                  <li>本番利用において、実際にクレジットカード決済を行う場合は自己責任でご利用ください。</li>
                  <li>不適切な利用が確認された場合、予告なくアカウントを停止します。</li>
              </ul>
          </div>
          <div className="text-center">
            <Button
              variant="link"
              className="text-slate-400 text-xs"
              onClick={() => router.push("/")}
            >
              トップページに戻る
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>読み込み中...</div>}>
      <LoginContent />
    </Suspense>
  );
}
