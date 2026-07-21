import { NextResponse } from "next/server";
import {
  forwardAnkiConnectRequest,
  type RawAnkiConnectRequest,
} from "@/lib/anki";

export async function POST(request: Request) {
  let body: RawAnkiConnectRequest;
  try {
    body = (await request.json()) as RawAnkiConnectRequest;
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

  try {
    const data = await forwardAnkiConnectRequest(body);
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { result: null, error: `Proxy failed: ${message}` },
      { status: 502 },
    );
  }
}
