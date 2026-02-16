// Next.js API Routeプロキシ: unlockTransaction
// ブラウザ → Next.jsサーバー → Cloud Functions の経路でCORSを回避
import { NextRequest, NextResponse } from "next/server";

// Cloud FunctionsのonCall関数のURL
const FUNCTION_URL = "https://us-central1-musa-link.cloudfunctions.net/unlockTransaction";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { transactionId, userId, paymentIntentId } = body;

        if (!transactionId || !userId) {
            return NextResponse.json(
                { error: "Missing transactionId or userId" },
                { status: 400 }
            );
        }

        // クライアントからのAuthorizationヘッダー（Firebase ID Token）を取得
        const authHeader = request.headers.get("Authorization");

        // onRequestへのリクエスト: dataラッパーなしのフラットなJSON
        // Authorizationヘッダーを転送して認証情報を渡す
        const response = await fetch(FUNCTION_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(authHeader ? { "Authorization": authHeader } : {}),
            },
            body: JSON.stringify({
                transactionId, 
                userId, 
                paymentIntentId 
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Cloud Function error:", response.status, errorText);

            // エラーレスポンスがJSONならパースして返す、そうでなければテキスト
            let errorMessage = "Unlock transaction failed";
            try {
                const errorJson = JSON.parse(errorText);
                if (errorJson.error && errorJson.error.message) {
                    errorMessage = errorJson.error.message;
                } else if (errorJson.error) {
                    errorMessage = typeof errorJson.error === 'string' ? errorJson.error : JSON.stringify(errorJson.error);
                }
            } catch (e) {
                errorMessage = `Cloud Function Error (${response.status}): ${errorText.substring(0, 200)}`;
            }

            return NextResponse.json(
                { error: errorMessage },
                { status: response.status }
            );
        }

        // onCallレスポンス: { result: {...} } でラップされている
        const data = await response.json();
        return NextResponse.json(data.result || data);
    } catch (error: any) {
        console.error("API Route error:", error);
        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}
