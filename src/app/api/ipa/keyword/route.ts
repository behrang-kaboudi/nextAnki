import { NextRequest, NextResponse } from "next/server";

import { getKeyWord } from "@/lib/ipa";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const ipa = (req.nextUrl.searchParams.get("ipa") ?? "").trim();

  if (!ipa) {
    return NextResponse.json(
      { ok: false, error: "Missing required query param: ipa" },
      { status: 400 }
    );
  }

  try {
    const startedAt = Date.now();
    const keyword = await getKeyWord(ipa, { pickOne: true });
    const ms = Date.now() - startedAt;

    return NextResponse.json({
      ok: true,
      ipa,
      ms,
      keyword,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, ipa, error: message }, { status: 500 });
  }
}
