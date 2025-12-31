import { NextResponse } from "next/server";

const ANKI_CONNECT_URL = "http://127.0.0.1:8765";

type AnkiConnectProxyRequest = {
  action: string;
  version?: number;
  params?: unknown;
};

export async function POST(request: Request) {
  let body: AnkiConnectProxyRequest;
  try {
    body = (await request.json()) as AnkiConnectProxyRequest;
  } catch {
    return NextResponse.json(
      { result: null, error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  if (!body?.action) {
    return NextResponse.json(
      { result: null, error: "Missing action" },
      { status: 400 },
    );
  }

  const payload = {
    action: body.action,
    version: 6,
    params: body.params ?? {},
  };

  try {
    const res = await fetch(ANKI_CONNECT_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      // don't cache in Next
      cache: "no-store",
    });

    const data = (await res.json()) as unknown;
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { result: null, error: `Proxy failed: ${message}` },
      { status: 502 },
    );
  }
}

