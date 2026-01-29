import { NextResponse } from "next/server";

import { gptChatWithUsage } from "@/lib/ai/model_runner/gpt";
import { prisma } from "@/lib/prisma";
import { normalizePromptForCache } from "@/lib/ai/prompt_cache/normalize";
import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { geminiGenerateWithExplicitCache } from "@/lib/ai/model_runner/gemini";

export const runtime = "nodejs";

const PROCESSING_PREFIX = "__PROCESSING__:";

async function readSystemPromptFromFile(): Promise<string> {
  const abs = path.join(process.cwd(), "src", "prompts", "tempSent.md");
  return readFile(abs, "utf8");
}

function extractJsonCandidate(text: string): unknown {
  const t = text.trim();
  if (!t) return null;

  // Prefer fenced blocks if present.
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence?.[1]) {
    const inner = fence[1].trim();
    try {
      return JSON.parse(inner);
    } catch {
      // fall through
    }
  }

  try {
    return JSON.parse(t);
  } catch {
    // fall through
  }

  // Try to salvage an array/object substring.
  const firstArray = t.indexOf("[");
  const lastArray = t.lastIndexOf("]");
  if (firstArray !== -1 && lastArray !== -1 && lastArray > firstArray) {
    const sub = t.slice(firstArray, lastArray + 1);
    try {
      return JSON.parse(sub);
    } catch {
      // fall through
    }
  }

  const firstObj = t.indexOf("{");
  const lastObj = t.lastIndexOf("}");
  if (firstObj !== -1 && lastObj !== -1 && lastObj > firstObj) {
    const sub = t.slice(firstObj, lastObj + 1);
    try {
      return JSON.parse(sub);
    } catch {
      // fall through
    }
  }

  return null;
}

function toTrimmedString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s : "";
}

export async function GET() {
  try {
    const [missingSentenceEnRow, processingRow] = await Promise.all([
      prisma.$queryRaw<Array<{ c: bigint }>>`
        SELECT COUNT(*) as c
        FROM Word
        WHERE sentence_en IS NULL OR TRIM(sentence_en) = ''
      `,
      prisma.$queryRaw<Array<{ c: bigint }>>`
        SELECT COUNT(*) as c
        FROM Word
        WHERE sentence_en LIKE ${`${PROCESSING_PREFIX}%`}
      `,
    ]);

    const missingSentenceEn = Number(missingSentenceEnRow?.[0]?.c ?? 0);
    const processing = Number(processingRow?.[0]?.c ?? 0);

    return NextResponse.json({ ok: true, missingSentenceEn, processing });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const obj = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  const mode = typeof obj?.mode === "string" ? obj.mode : "custom";
  const userText = typeof obj?.userText === "string" ? obj.userText : "Run the prompt.";
  const prompt =
    typeof obj?.prompt === "string"
      ? obj.prompt
      : mode === "next_missing_sentence_en"
        ? await readSystemPromptFromFile()
        : "";
  const cachedSystemPrompt = normalizePromptForCache(prompt);

  if (!prompt.trim()) {
    return NextResponse.json({ error: "`prompt` is required" }, { status: 400 });
  }

  try {
    if (process.env.NODE_ENV !== "production") {
      const hash = crypto.createHash("sha256").update(cachedSystemPrompt).digest("hex");
      console.log("sentence-fields cached system prompt:", {
        chars: cachedSystemPrompt.length,
        sha256: hash,
      });
    }

    if (mode === "next_missing_sentence_en") {
      const claimToken = `${PROCESSING_PREFIX}${crypto.randomUUID()}`;

      const claimed = await prisma.$executeRaw`
        UPDATE Word
        SET sentence_en = ${claimToken}
        WHERE sentence_en IS NULL OR TRIM(sentence_en) = ''
        ORDER BY id ASC
        LIMIT 1
      `;

      if (!claimed) {
        return NextResponse.json({ ok: true, done: true });
      }

      const item = await prisma.word.findFirst({
        where: { sentence_en: claimToken },
        select: {
          id: true,
          base_form: true,
          meaning_fa: true,
          pos: true,
          sentence_en: true,
          sentence_en_meaning_fa: true,
          other_meanings_fa: true,
        },
      });

      if (!item) {
        return NextResponse.json(
          { ok: false, error: "Claimed a row but failed to load it (unexpected)" },
          { status: 500 }
        );
      }

      const provider = "gemini";
      if (!process.env.GEMINI_API_KEY) {
        // Release claim before failing.
        await prisma.word.updateMany({
          where: { id: item.id, sentence_en: claimToken },
          data: { sentence_en: "" },
        });
        return NextResponse.json(
          { ok: false, error: "GEMINI_API_KEY is required (this endpoint is configured to use Gemini)." },
          { status: 500 }
        );
      }

      const modelInput = JSON.stringify([
        {
          id: item.id,
          base_form: item.base_form,
          meaning_fa: item.meaning_fa,
          pos: item.pos ?? null,
          sentence_en_meaning_fa: item.sentence_en_meaning_fa ?? null,
          other_meanings_fa: item.other_meanings_fa ?? null,
        },
      ]);

      try {
        const geminiRes = await geminiGenerateWithExplicitCache({
          systemPrompt: cachedSystemPrompt,
          userText: modelInput,
          cacheDisplayName: "sentence-fields-v1",
          ttlSeconds: 60 * 60 * 24,
        });

        const output = geminiRes.output ?? "";
        const usage = geminiRes.usage ?? null;

        const parsed = extractJsonCandidate(output);
        const arr = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
        const first = (arr[0] && typeof arr[0] === "object"
          ? (arr[0] as Record<string, unknown>)
          : null) as Record<string, unknown> | null;

        const returnedId = typeof first?.id === "number" ? first.id : Number(first?.id);
        if (!first || !Number.isFinite(returnedId) || returnedId !== item.id) {
          // Release claim so another attempt can retry.
          await prisma.word.updateMany({
            where: { id: item.id, sentence_en: claimToken },
            data: { sentence_en: "" },
          });
          return NextResponse.json({
            ok: true,
            item,
            input: modelInput,
            output,
            usage,
            provider,
            cache: geminiRes.cache ?? null,
            saved: null,
            parseError:
              "Could not parse a valid JSON output with matching `id` to update the DB (expected array/object including the same id).",
          });
        }

        const nextSentenceEn = toTrimmedString(first.sentence_en);
        const nextSentenceEnMeaningFa = toTrimmedString(first.sentence_en_meaning_fa);
        const nextOtherMeaningsFa = toTrimmedString(first.other_meanings_fa);

        const data: {
          sentence_en?: string;
          sentence_en_meaning_fa?: string | null;
          other_meanings_fa?: string | null;
        } = {};

        if (nextSentenceEn !== null) data.sentence_en = nextSentenceEn;
        if (nextSentenceEnMeaningFa !== null) {
          data.sentence_en_meaning_fa =
            nextSentenceEnMeaningFa === "" ? null : nextSentenceEnMeaningFa;
        }
        if (nextOtherMeaningsFa !== null) {
          data.other_meanings_fa = nextOtherMeaningsFa === "" ? null : nextOtherMeaningsFa;
        }

        const updated = Object.keys(data).length
          ? await prisma.word.update({
              where: { id: item.id },
              data,
              select: {
                id: true,
                base_form: true,
                meaning_fa: true,
                sentence_en: true,
                sentence_en_meaning_fa: true,
                other_meanings_fa: true,
              },
            })
          : await prisma.word.update({
              where: { id: item.id },
              data: { sentence_en: "" },
              select: {
                id: true,
                base_form: true,
                meaning_fa: true,
                sentence_en: true,
                sentence_en_meaning_fa: true,
                other_meanings_fa: true,
              },
            });

        return NextResponse.json({
          ok: true,
          item,
          input: modelInput,
          output,
          usage,
          provider,
          cache: geminiRes.cache ?? null,
          saved: updated,
        });
      } catch (e) {
        // Ensure the claimed row doesn't get stuck in PROCESSING state.
        await prisma.word.updateMany({
          where: { id: item.id, sentence_en: claimToken },
          data: { sentence_en: "" },
        });
        throw e;
      }
    }

    const { output, usage } = await gptChatWithUsage({
      systemPrompt: cachedSystemPrompt,
      itemString: userText,
      cacheRetention: "24h",
      promptCacheKey: "sentence-fields-v1",
    });
    return NextResponse.json({ ok: true, output, usage });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
