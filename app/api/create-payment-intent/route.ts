// Next.js API Routeプロキシ:
// ブラウザ → Next.jsサーバー → Cloud Functions の経路でCORSを回避
// Cloud FunctionsのonCall関数はサーバーサイドから呼び出すことでCORS制約を受けない
import { NextRequest, NextResponse } from "next/server";

// Cloud FunctionsのonCall関数のURL（直接POSTでonCallプロトコルに従う）
// Cloud FunctionsのonCall関数のURL（直接POSTでonCallプロトコルに従う）
const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "musa-link";
const REGION = "us-central1";
const BASE_URL = process.env.FUNCTIONS_BASE_URL || `https://${REGION}-${PROJECT_ID}.cloudfunctions.net`;
const FUNCTION_URL = `${BASE_URL}/createPaymentIntent`;

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { transactionId, userId } = body;

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
                userId 
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Cloud Function error:", response.status, errorText);
            
            // エラーレスポンスがJSONならパースして返す、そうでなければテキスト
            let errorMessage = "Payment intent creation failed";
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
