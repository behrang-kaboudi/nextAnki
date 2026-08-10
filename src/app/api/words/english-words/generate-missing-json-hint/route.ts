import { NextResponse } from "next/server";

import { getEnglishWordJsonHintJobStatus, startEnglishWordJsonHintJobIfNeeded, type EnglishWordJsonHintJobMode } from "@/lib/english/englishWordJsonHintGenerateJob";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { mode?: unknown } | null;
  const mode: EnglishWordJsonHintJobMode = body?.mode === "all" ? "all" : "missing";
  return NextResponse.json({ ok: true, status: startEnglishWordJsonHintJobIfNeeded(mode) });
}
export async function GET() { return NextResponse.json({ ok: true, status: getEnglishWordJsonHintJobStatus() }); }
