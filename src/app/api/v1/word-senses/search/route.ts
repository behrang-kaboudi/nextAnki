import "server-only";

import { NextResponse } from "next/server";

import { searchWordSensesByExactBaseForm } from "@/lib/words/searchWordSenses.server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const baseForm = url.searchParams.get("base_form") ?? "";

  try {
    return NextResponse.json({
      ok: true,
      ...(await searchWordSensesByExactBaseForm(baseForm)),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message === "base_form must contain an English word." ? 400 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
