import { NextResponse } from "next/server";
import { getIpaSegments } from "@/lib/ipa/normalize";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const input = url.searchParams.get("input") ?? "";
  const lengthParam = url.searchParams.get("length");
  const length = lengthParam ? Number(lengthParam) : 8;

  const safeLength = Number.isFinite(length) ? Math.max(0, Math.min(64, length)) : 8;

  const segments = getIpaSegments(input, safeLength);

  return NextResponse.json({
    input,
    length: safeLength,
    segments,
    joined: segments.join(""),
  });
}

