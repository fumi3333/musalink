"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogIn } from "lucide-react";

function LoginContent() {
  const { user, login, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParams = searchParams.get("redirect");

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

          <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-slate-50 px-2 text-slate-500">For Testing</span>
              </div>
          </div>

          <Button 
              variant="outline"
              className="w-full text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 border-dashed border-slate-300"
              onClick={() => {
                  // Safe call if debugLogin is not in interface yet or undefined
                  const authCtx = useAuth() as any;
                  if (authCtx.debugLogin) {
                      authCtx.debugLogin('buyer');
                  } else {
                      alert("Debug login not available");
                  }
              }}
              disabled={loading}
          >
              🧪 テスト用アカウントでログイン
          </Button>

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
