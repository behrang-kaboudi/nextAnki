import { NextResponse } from "next/server";

import { generateEnglishWordJsonHint } from "@/lib/english/englishWordJsonHint.server";

export const runtime = "nodejs";
function parseId(value: string) { const id = Number(value); return Number.isSafeInteger(id) && id > 0 ? id : null; }

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ ok: false, error: "Invalid EnglishWord id." }, { status: 400 });
  try {
    const result = await generateEnglishWordJsonHint(id);
    if (result.skippedNoPhonetic) return NextResponse.json({ ok: false, error: "phonetic_us_normalized is required to generate json_hint." }, { status: 422 });
    if (!result.jsonHint) return NextResponse.json({ ok: false, error: "No picture-symbol hint could be generated for this pronunciation." }, { status: 422 });
    return NextResponse.json({ ok: true, json_hint: result.jsonHint });
  } catch (error) { return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not generate json_hint." }, { status: 500 }); }
}
