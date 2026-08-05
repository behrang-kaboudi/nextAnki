import "server-only";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { normalizeJsonHintForCompare } from "@/lib/words/jsonHint";

export const runtime = "nodejs";

type JsonHintValue = string | null;

function jsonHintState(value: JsonHintValue) {
  const raw = value?.trim() ?? "";
  const comparable = normalizeJsonHintForCompare(value);
  return {
    comparable,
    empty: raw.length === 0,
    invalid: raw.length > 0 && comparable === null,
  };
}

export async function GET() {
  try {
    const englishWords = await prisma.englishWord.findMany({
      orderBy: { id: "asc" },
      select: {
        id: true,
        base_form: true,
        json_hint: true,
        words: {
          orderBy: { id: "asc" },
          select: { id: true, anki_link_id: true, base_form: true, json_hint: true },
        },
      },
    });

    const changes: Array<{
      englishWord: { id: number; baseForm: string; jsonHint: JsonHintValue };
      word: { id: number; ankiLinkId: string; baseForm: string; jsonHint: JsonHintValue };
      reasons: string[];
    }> = [];
    const unlinkedEnglishWords: Array<{ id: number; baseForm: string; jsonHint: JsonHintValue }> = [];
    let wordRows = 0;
    let matchingWordRows = 0;
    let englishWordsWithoutJsonHint = 0;
    let wordsWithoutJsonHint = 0;
    let invalidEnglishWordJsonHints = 0;
    let invalidWordJsonHints = 0;
    let englishWordsWithMultipleWords = 0;

    for (const englishWord of englishWords) {
      const englishState = jsonHintState(englishWord.json_hint);
      if (englishState.empty) englishWordsWithoutJsonHint += 1;
      if (englishState.invalid) invalidEnglishWordJsonHints += 1;
      if (englishWord.words.length === 0) {
        unlinkedEnglishWords.push({ id: englishWord.id, baseForm: englishWord.base_form, jsonHint: englishWord.json_hint });
        continue;
      }
      if (englishWord.words.length > 1) englishWordsWithMultipleWords += 1;

      for (const word of englishWord.words) {
        wordRows += 1;
        const wordState = jsonHintState(word.json_hint);
        if (wordState.empty) wordsWithoutJsonHint += 1;
        if (wordState.invalid) invalidWordJsonHints += 1;
        if (englishState.comparable === wordState.comparable) {
          matchingWordRows += 1;
          continue;
        }

        const reasons: string[] = [];
        if (englishState.empty) reasons.push("EnglishWord json_hint is empty");
        if (wordState.empty) reasons.push("Word json_hint is empty");
        if (englishState.invalid) reasons.push("EnglishWord json_hint is invalid JSON");
        if (wordState.invalid) reasons.push("Word json_hint is invalid JSON");
        if (reasons.length === 0) reasons.push("JSON content differs");
        changes.push({
          englishWord: { id: englishWord.id, baseForm: englishWord.base_form, jsonHint: englishWord.json_hint },
          word: { id: word.id, ankiLinkId: word.anki_link_id, baseForm: word.base_form, jsonHint: word.json_hint },
          reasons,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      report: {
        summary: {
          englishWords: englishWords.length,
          linkedEnglishWords: englishWords.length - unlinkedEnglishWords.length,
          unlinkedEnglishWords: unlinkedEnglishWords.length,
          englishWordsWithMultipleWords,
          comparedWordRows: wordRows,
          matchingWordRows,
          changedWordRows: changes.length,
          englishWordsWithoutJsonHint,
          wordsWithoutJsonHint,
          invalidEnglishWordJsonHints,
          invalidWordJsonHints,
        },
        changes,
        unlinkedEnglishWords,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
