import { NextResponse } from "next/server";

import { gptChatWithUsage } from "@/lib/ai/model_runner/gpt";
import { prisma } from "@/lib/prisma";
import { normalizePromptForCache } from "@/lib/ai/prompt_cache/normalize";
import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { geminiGenerateWithExplicitCache } from "@/lib/ai/model_runner/gemini";
import { primarySentenceId } from "@/lib/words/sentenceIds";

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
    const [sentences, words] = await Promise.all([
      prisma.sentence.findMany({ select: { id: true, sentence_en: true } }),
      prisma.word.findMany({ select: { sentenceIds: true } }),
    ]);
    const missingIds = new Set(
      sentences.filter((sentence) => !sentence.sentence_en.trim()).map((sentence) => sentence.id),
    );
    const processingIds = new Set(
      sentences
        .filter((sentence) => sentence.sentence_en.startsWith(PROCESSING_PREFIX))
        .map((sentence) => sentence.id),
    );
    const primaryIds = words.map((word) => primarySentenceId(word.sentenceIds));
    const missingSentenceEn = primaryIds.filter((id) => id !== null && missingIds.has(id)).length;
    const processing = primaryIds.filter((id) => id !== null && processingIds.has(id)).length;

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
      const [missingSentences, candidateWords] = await Promise.all([
        prisma.sentence.findMany({ select: { id: true, sentence_en: true } }),
        prisma.word.findMany({
          orderBy: { anki_link_id: "asc" },
          select: {
            id: true,
            anki_link_id: true,
            sentenceIds: true,
            english: { select: { base_form: true } },
            meaning: { select: { canonical_text: true } },
            pos: true,
          },
        }),
      ]);
      const missingById = new Map(
        missingSentences
          .filter((sentence) => !sentence.sentence_en.trim())
          .map((sentence) => [sentence.id, sentence.sentence_en]),
      );
      const candidateWord = candidateWords.find((word) => {
        const id = primarySentenceId(word.sentenceIds);
        return id !== null && missingById.has(id);
      });
      const candidateSentenceId = candidateWord
        ? primarySentenceId(candidateWord.sentenceIds)
        : null;
      const candidate = candidateWord && candidateSentenceId
        ? {
            sentenceId: candidateSentenceId,
            initialSentenceEn: missingById.get(candidateSentenceId) ?? "",
            word: candidateWord,
          }
        : null;
      if (!candidate) {
        return NextResponse.json({ ok: true, done: true });
      }

      const claimed = await prisma.sentence.updateMany({
        where: {
          id: candidate.sentenceId,
          sentence_en: candidate.initialSentenceEn,
        },
        data: { sentence_en: claimToken },
      });

      if (!claimed.count) {
        return NextResponse.json({ ok: true, done: false, skipped: true });
      }

      const item = await prisma.sentence.findFirst({
        where: { id: candidate.sentenceId, sentence_en: claimToken },
        select: {
          id: true,
          sentence_en_meaning_fa: true,
        },
      });
      const word = candidate.word;
      if (!item || !word) {
        return NextResponse.json(
          { ok: false, error: "Claimed a row but failed to load it (unexpected)" },
          { status: 500 }
        );
      }

      const provider = "gemini";
      if (!process.env.GEMINI_API_KEY) {
        // Release claim before failing.
        await prisma.sentence.updateMany({
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
          id: word.id,
            base_form: word.english.base_form,
          meaning_fa: word.meaning?.canonical_text ?? "",
          pos: word.pos ?? null,
          sentence_en_meaning_fa: item.sentence_en_meaning_fa ?? null,
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
        if (!first || !Number.isFinite(returnedId) || returnedId !== word.id) {
          // Release claim so another attempt can retry.
          await prisma.sentence.updateMany({
            where: { id: item.id, sentence_en: claimToken },
            data: { sentence_en: "" },
          });
          return NextResponse.json({
            ok: true,
            item: { ...item, words: [word] },
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

        const sentenceData: {
          sentence_en?: string;
          sentence_en_meaning_fa?: string | null;
          sentence_en_audio_file_name?: null;
          sentence_en_meaning_fa_audio_file_name?: null;
        } = {};

        if (nextSentenceEn !== null) {
          sentenceData.sentence_en = nextSentenceEn;
          sentenceData.sentence_en_audio_file_name = null;
        }
        if (nextSentenceEnMeaningFa !== null) {
          sentenceData.sentence_en_meaning_fa =
            nextSentenceEnMeaningFa === "" ? null : nextSentenceEnMeaningFa;
          sentenceData.sentence_en_meaning_fa_audio_file_name = null;
        }
        const updated = await prisma.$transaction(async (tx) => {
          const savedSentence = Object.keys(sentenceData).length
            ? await tx.sentence.update({
                where: { id: item.id },
                data: sentenceData,
                select: {
                  sentence_en: true,
                  sentence_en_meaning_fa: true,
                },
              })
            : await tx.sentence.update({
                where: { id: item.id },
                data: { sentence_en: "" },
                select: {
                  sentence_en: true,
                  sentence_en_meaning_fa: true,
                },
              });

          const savedWord = await tx.word.findUnique({
            where: { id: word.id },
            select: {
              id: true,
              english: { select: { base_form: true } },
              meaning: { select: { canonical_text: true } },
            },
          });

          return {
            id: savedWord?.id ?? word.id,
            base_form: savedWord?.english.base_form ?? word.english.base_form,
            meaning_fa: savedWord?.meaning?.canonical_text ?? word.meaning?.canonical_text ?? "",
            sentence_en: savedSentence.sentence_en,
            sentence_en_meaning_fa: savedSentence.sentence_en_meaning_fa,
          };
        });

        return NextResponse.json({
          ok: true,
          item: { ...item, words: [word] },
          input: modelInput,
          output,
          usage,
          provider,
          cache: geminiRes.cache ?? null,
          saved: updated,
        });
      } catch (e) {
        // Ensure the claimed row doesn't get stuck in PROCESSING state.
        await prisma.sentence.updateMany({
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
