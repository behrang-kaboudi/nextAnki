import "server-only";

import fs from "node:fs";
import path from "node:path";

import type { Prisma, Word } from "@prisma/client";

import type { AnkiNotesInfo } from "@/lib/anki";
import { WordAnkiConstants } from "@/lib/anki";
import {
  parsePictureWordAudioFilename,
  pictureWordAudioKey,
} from "@/lib/audio/pictureWordAudioNaming";
import type { WordAudioFieldKey } from "@/lib/audio/wordFieldAudioNaming";
import { getWordFieldAudioAbsolutePath } from "@/lib/audio/wordFieldAudioPaths.server";
import { getLatestWordFieldAudioFile } from "@/lib/words/wordFieldVoice";
import { prisma } from "@/lib/prisma";
import { findPrimarySentenceByAnkiLinkId } from "@/lib/sentences/sentenceRepo";

import { IpaCandidate, WordPictures } from "../ipa/setPictures/types";

export const WORD_ANKI_LINK_ID_FIELD = "anki_link_id" as const;

// These aliases exist because some Anki note types / exports may have different casing.
export const WORD_ANKI_LINK_ID_FIELD_ALIASES = [
  WORD_ANKI_LINK_ID_FIELD,
  "AnkiLinkId",
  "ankiLinkId",
] as const;

type PictureWordAudioIndex = Map<
  string,
  { filename: string; timestampMs: number; absPath: string }
>;

function safeSlugPart(input: string) {
  const s = (input ?? "").trim().toLowerCase();
  return s
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

function getPictureWordAudioIndex(): PictureWordAudioIndex {
  const g = globalThis as unknown as {
    __pictureWordAudioIndex?: PictureWordAudioIndex;
  };
  if (g.__pictureWordAudioIndex) return g.__pictureWordAudioIndex;

  const dir = path.join(process.cwd(), "public", "audio", "pictureWord");
  let files: string[] = [];
  try {
    files = fs.readdirSync(dir).filter((x) => x && !x.startsWith("."));
  } catch {
    g.__pictureWordAudioIndex = new Map();
    return g.__pictureWordAudioIndex;
  }

  const index: PictureWordAudioIndex = new Map();
  for (const filename of files) {
    const parsed = parsePictureWordAudioFilename(filename);
    if (!parsed.key) continue;
    const ts = parsed.timestampMs;
    if (ts == null) continue;

    const prev = index.get(parsed.key);
    if (prev && prev.timestampMs >= ts) continue;

    const absPath = path.join(dir, filename);
    let size = 0;
    try {
      size = fs.statSync(absPath).size;
    } catch {
      continue;
    }
    if (size <= 0) continue;

    index.set(parsed.key, { filename, timestampMs: ts, absPath });
  }

  g.__pictureWordAudioIndex = index;
  return index;
}

export async function selectFile(
  IpaCandidate: IpaCandidate,
): Promise<string | null> {
  if (IpaCandidate.source === "pictureWord") {
    const phinglish = String(IpaCandidate.phinglish ?? "").trim();
    const en = String(IpaCandidate.en ?? "").trim();
    if (!en) return null;

    const idx = getPictureWordAudioIndex();
    if (phinglish) {
      const key = pictureWordAudioKey(phinglish, en);
      const best = idx.get(key);
      if (best?.absPath) return best.absPath;
    }

    // Fallback: match by English slug only (in case `phinglish` isn't present in `json_hint` yet).
    const enSlug = safeSlugPart(en);
    if (!enSlug) return null;

    let best: { timestampMs: number; absPath: string } | null = null;
    for (const [key, value] of idx.entries()) {
      if (!key.endsWith(`__${enSlug}`)) continue;
      if (!best || value.timestampMs > best.timestampMs) {
        best = { timestampMs: value.timestampMs, absPath: value.absPath };
      }
    }
    return best?.absPath ?? null;
  }

  const targetLang = IpaCandidate.target_lang ?? "fa";
  const field: WordAudioFieldKey =
    targetLang === "en" ? "base_form" : "meaning_fa";

  const fa = String(IpaCandidate.fa ?? "").trim();
  const en = String(IpaCandidate.en ?? "").trim();

  const whereCandidates: Prisma.WordWhereInput[] = [];

  // Prefer strict match when we have both sides.
  if (en && fa) whereCandidates.push({ base_form: en, meaning_fa: fa });

  // Fallback to whichever side is present. This is important because `target_lang`
  // controls which audio field we *want*, but the DB row can still be found via the other side.
  if (en) whereCandidates.push({ base_form: en });
  if (fa) whereCandidates.push({ meaning_fa: fa });

  let row: Pick<Word, "anki_link_id" | "base_form"> | null = null;
  for (const where of whereCandidates) {
    row = await prisma.word.findFirst({
      where,
      select: { anki_link_id: true, base_form: true },
    });
    if (row) break;
  }

  const ankiLinkId = row?.anki_link_id ?? null;
  if (!ankiLinkId) return null;

  const latest = getLatestWordFieldAudioFile({ ankiLinkId, field });

  if (!latest || latest.size <= 0) return null;
  return getWordFieldAudioAbsolutePath(latest.filename);
}

function toSoundTagFromAbsPath(absPath: string | null): string {
  if (!absPath) return "";
  const filename = path.basename(absPath);
  return filename ? ` [sound:${filename}]` : "";
}

function formatFaEnText(candidate: Pick<IpaCandidate, "fa" | "en">): string {
  const fa = String(candidate.fa ?? "").trim();
  const en = String(candidate.en ?? "").trim();
  if (fa && en) return `${fa} — ${en}`;
  return fa || en || "";
}

async function buildHintLines(
  candidates: Array<IpaCandidate | null | undefined>,
): Promise<string> {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const cand of candidates) {
    if (!cand) continue;
    const key = `${cand.source}|${cand.fa}|${cand.en}|${cand.target_ipa}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const text = formatFaEnText(cand);
    if (!text) continue;

    const file = await selectFile(cand);
    out.push(`${text}${toSoundTagFromAbsPath(file)}`.trim());
  }

  return out.join("\n").trim();
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function getAnkiLinkIdFromNoteFields(
  note: AnkiNotesInfo[number],
): string | null {
  for (const key of WORD_ANKI_LINK_ID_FIELD_ALIASES) {
    const v = asNonEmptyString(note.fields?.[key]?.value);
    if (v) return v;
  }
  return null;
}

export type WordAnkiFieldGenerator = (word: Word) => string | Promise<string>;

async function getSentenceFields(ankiLinkId: string) {
  const sentence = await findPrimarySentenceByAnkiLinkId(ankiLinkId);
  return {
    id: sentence?.id ?? null,
    sentence_en: sentence?.sentence_en ?? "",
    sentence_en_meaning_fa: sentence?.sentence_en_meaning_fa ?? "",
  };
}

function latestAudioTag(audioKey: string, field: WordAudioFieldKey): string {
  const latest = getLatestWordFieldAudioFile({ audioKey, ankiLinkId: audioKey, field });
  if (!latest || latest.size <= 0) return "";
  return `[sound:${latest.filename}]`;
}

function getFirstPartSpell(word: string): string {
  return String(word ?? "").trim().slice(0, 3).toUpperCase().split("").join("-");
}

function getFirstPartSpellAudio(word: string): string {
  return String(word ?? "")
    .trim()
    .slice(0, 3)
    .toLowerCase()
    .split("")
    .filter((letter) => /^[a-z]$/.test(letter))
    .map((letter) => `[sound:alphabet-${letter}.mp3]`)
    .join(" ");
}

export const WORD_ANKI_FIELD_GENERATORS = {
  anki_link_id: (w) => w.anki_link_id,
  base_form: (w) => w.base_form,
  base_form_audio: (w) => latestAudioTag(w.anki_link_id, "base_form"),
  "first-part-spell": (w) => getFirstPartSpell(w.base_form),
  "first-part-spell-audio": (w) => getFirstPartSpellAudio(w.base_form),
  phonetic_us: (w) => w.phonetic_us ?? "",
  pos: (w) => w.pos ?? "",
  meaning_fa: (w) => w.meaning_fa,
  meaning_fa_audio: (w) => latestAudioTag(w.anki_link_id, "meaning_fa"),
  other_meanings_fa: (w) => w.other_meanings_fa ?? "",
  other_meanings_fa_audio: (w) => latestAudioTag(w.anki_link_id, "other_meanings_fa"),
  other_meanings_en: (w) => w.other_meanings_en ?? "",
  other_meanings_en_audio: (w) => latestAudioTag(w.anki_link_id, "other_meanings_en"),
  concept_explained_fa: (w) => w.concept_explained_fa ?? "",
  concept_explained_fa_audio: (w) => latestAudioTag(w.anki_link_id, "concept_explained_fa"),
  sentence_en: async (w) => {
    const sentence = await getSentenceFields(w.anki_link_id);
    return sentence.sentence_en;
  },
  sentence_en_audio: async (w) => {
    const sentence = await getSentenceFields(w.anki_link_id);
    return sentence.id != null ? latestAudioTag(String(sentence.id), "sentence_en") : "";
  },
  sentence_en_meaning_fa: async (w) => {
    const sentence = await getSentenceFields(w.anki_link_id);
    return sentence.sentence_en_meaning_fa;
  },
  sentence_en_meaning_fa_audio: async (w) => {
    const sentence = await getSentenceFields(w.anki_link_id);
    return sentence.id != null ? latestAudioTag(String(sentence.id), "sentence_en_meaning_fa") : "";
  },

  // TODO: define the source-of-truth for this field (not currently present in DB schema).
  best_translate: () => "",

  mixed_sentence: (w) => w.mixed_sentence ?? "",
  first_letter_fa_hint: async (w) => {
    const obj = JSON.parse(w.json_hint ?? "{}") as WordPictures;
    const cand = obj.persianImage ?? null;
    if (!cand) return "";
    const text = formatFaEnText(cand);
    const file = await selectFile(cand);
    return `${text}${toSoundTagFromAbsPath(file)}`.trim();
  },
  first_letter_en_hint: async (w) => {
    const obj = JSON.parse(w.json_hint ?? "{}") as WordPictures;
    return buildHintLines([obj.person, obj.adj, obj.job]);
  },

  // User-managed in Anki (personal notes); intentionally not sourced from DB.
  selfGuide: () => "",

  // Anki field name is `hint_to_select_letters`, but DB field is `hint_to_select`.
  hint_to_select_letters: (w) => String(w.base_form.length ?? ""),

  hint_sentence: (w) => w.hint_sentence ?? "",
  phonetic_us_normalized: (w) => w.phonetic_us_normalized ?? "",
  learning_depth: (w) =>
    w.learning_depth == null ? "" : String(w.learning_depth),
  imageability: (w) => (w.imageability == null ? "" : String(w.imageability)),
  json_hint: (w) => w.json_hint ?? "",
  updatedAt: (w) => w.updatedAt.toISOString(),
} as const satisfies Record<string, WordAnkiFieldGenerator>;

export function generateWordAnkiFieldsForMetaLexVr9(
  word: Word,
): Promise<Record<string, string>> {
  const fields = WordAnkiConstants.noteFields;
  return Promise.all(
    fields.map(
      async (f) => [f, await WORD_ANKI_FIELD_GENERATORS[f](word)] as const,
    ),
  ).then(
    (entries) =>
      Object.fromEntries(entries) as Record<string, string>,
  );
}
