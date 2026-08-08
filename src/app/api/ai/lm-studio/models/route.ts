import { NextResponse } from "next/server";

import { discoverLmStudioModels } from "@/lib/ai/lmStudio";
import { requireApiRole } from "@/lib/auth/apiAuth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireApiRole("admin");
  if (!auth.ok) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: auth.status });
  try {
    const baseUrl = new URL(request.url).searchParams.get("baseUrl") ?? "";
    return NextResponse.json({ ok: true, models: await discoverLmStudioModels(baseUrl) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not connect to LM Studio.";
    const friendly = message.includes("fetch failed") || message.includes("ECONNREFUSED")
      ? "Could not connect to LM Studio. Start its local server and check the Base URL."
      : message;
    return NextResponse.json({ ok: false, error: friendly }, { status: 502 });
  }
}
