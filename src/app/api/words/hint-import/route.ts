import "server-only";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { formatPersonAdjJobFa, parseJsonHint } from "@/lib/words/formatJsonHintFa";

type PayloadItem = { id: number; hint_sentence: string };

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function asPositiveInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const i = Math.floor(value);
  return i > 0 ? i : null;
}

function replaceAliWith(sentence: string, replacement: string): string {
  const trimmedReplacement = replacement.trim();
  if (!trimmedReplacement) return sentence;

  // Replace standalone "علی" occurrences (incl. Persian ZWNJ around words)
  const re = /(^|[\s\u200c])علی(?=([\s\u200c]|$))/g;
  return sentence.replace(re, (_m, p1) => `${p1}${trimmedReplacement}`);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as unknown;
    if (!Array.isArray(body)) {
      return NextResponse.json({ ok: false, error: "Body must be an array" }, { status: 400 });
    }

    const items: PayloadItem[] = [];
    for (const row of body) {
      const id = asPositiveInt((row as { id?: unknown } | null)?.id);
      const hint_sentence = asNonEmptyString(
        (row as { hint_sentence?: unknown } | null)?.hint_sentence
      );
      if (!id || !hint_sentence) continue;
      items.push({ id, hint_sentence });
    }

    if (items.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No valid {id, hint_sentence} items" },
        { status: 400 }
      );
    }

    const results: { id: number; ok: boolean; error?: string }[] = [];
    for (const item of items) {
      try {
        const word = await prisma.word.findUnique({
          where: { id: item.id },
          select: { json_hint: true },
        });

        const personPhrase = formatPersonAdjJobFa(parseJsonHint(word?.json_hint ?? null));
        const finalSentence = personPhrase
          ? replaceAliWith(item.hint_sentence, personPhrase)
          : item.hint_sentence;

        await prisma.word.update({
          where: { id: item.id },
          data: { hint_sentence: finalSentence },
        });
        results.push({ id: item.id, ok: true });
      } catch (e) {
        results.push({ id: item.id, ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    }

    const okCount = results.filter((r) => r.ok).length;
    return NextResponse.json({ ok: true, total: results.length, okCount, results });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
