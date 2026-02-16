
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { email, returnUrl, refreshUrl } = body;

    const baseUrl = process.env.FUNCTIONS_BASE_URL || "http://127.0.0.1:5001/musa-link/us-central1";
    const functionUrl = `${baseUrl}/executeStripeConnect`;
    
    // Proxy to Cloud Function
    const res = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader, // Forward Auth Token
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, returnUrl, refreshUrl }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      try {
          const errorJson = JSON.parse(errorText);
          return NextResponse.json({ error: errorJson.error || "Function Error" }, { status: res.status });
      } catch (e) {
          return NextResponse.json({ error: errorText || "Function Error" }, { status: res.status });
      }
    }

    const data = await res.json();
    return NextResponse.json(data);

  } catch (error: any) {
    console.error("API Route Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
