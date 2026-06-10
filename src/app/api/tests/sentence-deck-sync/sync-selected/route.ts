import { NextResponse } from "next/server";

import { syncSelectedSentencesToSentenceDeck } from "@/lib/anki/sentenceDeckSyncAllJob";

export const runtime = "nodejs";

function asSentenceEns(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;

  const out: string[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const sentenceEn = (item as { sentence_en?: unknown }).sentence_en;
    if (typeof sentenceEn !== "string") return null;
    out.push(sentenceEn);
  }

  return out;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    rows?: unknown;
    items?: unknown;
  } | null;

  const sentenceEns = asSentenceEns(body?.rows ?? body?.items);
  if (!sentenceEns) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Invalid body. Expected { "rows": [{ "sentence_en": "..." }] }.',
      },
      { status: 400 },
    );
  }

  const result = await syncSelectedSentencesToSentenceDeck(sentenceEns);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
