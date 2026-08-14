import "server-only";

import fs from "node:fs";
import path from "node:path";

import type { Prisma, WordSense } from "@prisma/client";

import type { AnkiNotesInfo } from "@/lib/anki";
import {
  parsePictureWordAudioFilename,
  pictureWordAudioKey,
} from "@/lib/audio/pictureWordAudioNaming";
import { getEnglishWordAudioAbsolutePath } from "@/lib/audio/englishWordAudioPaths.server";
import { getPersianWordAudioAbsolutePath } from "@/lib/audio/persianWordAudioPaths.server";
import { getWordSenseConceptAudioAbsolutePath } from "@/lib/audio/wordSenseConceptAudioPaths.server";
import { getSentenceAudioAbsolutePath } from "@/lib/audio/sentenceAudioPaths.server";
import { prisma } from "@/lib/prisma";
import {
  hydrateWordSenseWithPersianMeanings,
  type WordSenseWithPersianMeanings,
} from "@/lib/words/persianMeanings.server";
import {
  hydrateWordSenseWithEnglishFields,
  type WordSenseEnglishFields,
} from "@/lib/english/wordSenseEnglishFields.server";
import {
  hydrateWordSenseWithEnglishSynonyms,
  type WordSenseWithEnglishSynonyms,
} from "@/lib/words/englishSynonyms.server";
import {
  hydrateWordsWithPrimarySentence,
  type WordSenseWithPrimarySentence,
} from "@/lib/words/primarySentences.server";

import { IpaCandidate } from "../ipa/setPictures/types";

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
  const fa = String(IpaCandidate.fa ?? "").trim();
  const en = String(IpaCandidate.en ?? "").trim();

  if (targetLang !== "en") {
    if (!fa) return null;
    const persianWord = await prisma.persianWord.findFirst({
      where: { canonical_text: fa },
      select: { audio_file_name: true },
    });
    return persianWord?.audio_file_name
      ? getPersianWordAudioAbsolutePath(persianWord.audio_file_name)
      : null;
  }

  const whereCandidates: Prisma.WordSenseWhereInput[] = [];

  // Prefer strict match when we have both sides.
  if (en && fa)
    whereCandidates.push({
      english: { is: { base_form: en } },
      meaning: { is: { canonical_text: fa } },
    });

  // Fallback to whichever side is present. This is important because `target_lang`
  // controls which audio field we *want*, but the DB row can still be found via the other side.
  if (en) whereCandidates.push({ english: { is: { base_form: en } } });
  if (fa) whereCandidates.push({ meaning: { is: { canonical_text: fa } } });

  let row: { english: { audio_file_name: string | null } } | null = null;
  for (const where of whereCandidates) {
    row = await prisma.wordSense.findFirst({
      where,
      select: { english: { select: { audio_file_name: true } } },
    });
    if (row) break;
  }
  const filename = row?.english.audio_file_name ?? null;
  if (!filename) return null;
  const absPath = getEnglishWordAudioAbsolutePath(filename);
  try {
    return fs.statSync(absPath).size > 0 ? absPath : null;
  } catch {
    return null;
  }
}

function toSoundTagFromAbsPath(absPath: string | null): string {
  if (!absPath) return "";
  try {
    const stat = fs.statSync(absPath);
    if (!stat.isFile() || stat.size <= 0) return "";
  } catch {
    return "";
  }
  const filename = path.basename(absPath);
  return filename ? ` [sound:${filename}]` : "";
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

type WordForAnki = WordSense &
  WordSenseEnglishFields &
  Partial<
    Pick<
      WordSenseWithPersianMeanings<WordSense>,
      | "primaryPersianWord"
      | "otherPersianWords"
      | "meaning_fa"
      | "other_meanings_fa"
    >
  > &
  Partial<Pick<WordSenseWithEnglishSynonyms<WordSense>, "synonymEnglishWords">> &
  Partial<Pick<WordSenseWithPrimarySentence<WordSense>, "sentence">>;
export type WordAnkiFieldGenerator = (
  word: WordForAnki,
) => string | Promise<string>;

function persianWordAudioTag(filename: string | null | undefined): string {
  if (!filename) return "";
  return toSoundTagFromAbsPath(
    getPersianWordAudioAbsolutePath(filename),
  ).trim();
}

function englishWordAudioTag(filename: string | null | undefined): string {
  if (!filename) return "";
  return toSoundTagFromAbsPath(
    getEnglishWordAudioAbsolutePath(filename),
  ).trim();
}

function sentenceAudioTag(filename: string | null | undefined): string {
  if (!filename) return "";
  try {
    const stat = fs.statSync(getSentenceAudioAbsolutePath(filename));
    return stat.isFile() && stat.size > 0 ? `[sound:${filename}]` : "";
  } catch {
    return "";
  }
}

function getFirstPartSpell(word: string): string {
  return String(word ?? "")
    .trim()
    .slice(0, 3)
    .toUpperCase()
    .split("")
    .join("-");
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
  base_form_audio: (w) =>
    w.audio_file_name
      ? toSoundTagFromAbsPath(
          getEnglishWordAudioAbsolutePath(w.audio_file_name),
        )
      : "",
  "first-part-spell": (w) => getFirstPartSpell(w.base_form),
  "first-part-spell-audio": (w) => getFirstPartSpellAudio(w.base_form),
  phonetic_us: (w) => w.phonetic_us ?? "",
  pos: (w) => w.pos ?? "",
  meaning_fa: (w) => w.meaning_fa ?? "",
  meaning_fa_audio: (w) =>
    persianWordAudioTag(w.primaryPersianWord?.audio_file_name),
  other_meanings_fa: (w) => w.other_meanings_fa ?? "",
  other_meanings_fa_audio: (w) =>
    (w.otherPersianWords ?? [])
      .map((meaning) => persianWordAudioTag(meaning.audio_file_name))
      .filter(Boolean)
      .join(" "),
  other_meanings_en: (w) =>
    (w.synonymEnglishWords ?? [])
      .map((synonym) => synonym.base_form.trim())
      .filter(Boolean)
      .join(" - "),
  other_meanings_en_audio: (w) => {
    const audioTags = (w.synonymEnglishWords ?? [])
      .map((synonym) => englishWordAudioTag(synonym.audio_file_name))
      .filter(Boolean);

    return audioTags.length > 0
      ? ["[sound:bejoz.mp3]", ...audioTags].join(" ")
      : "";
  },
  concept_explained_fa: (w) => w.concept_explained_fa ?? "",
  concept_explained_fa_audio: (w) =>
    w.concept_explained_fa_audio_file_name
      ? toSoundTagFromAbsPath(
          getWordSenseConceptAudioAbsolutePath(
            w.concept_explained_fa_audio_file_name,
          ),
        )
      : "",
  sentence_en: (w) => w.sentence?.sentence_en ?? "",
  sentence_en_audio: (w) =>
    sentenceAudioTag(w.sentence?.sentence_en_audio_file_name),
  sentence_en_meaning_fa: (w) => w.sentence?.sentence_en_meaning_fa ?? "",
  sentence_en_meaning_fa_audio: (w) =>
    sentenceAudioTag(w.sentence?.sentence_en_meaning_fa_audio_file_name),

  // TODO: define the source-of-truth for this field (not currently present in DB schema).
  best_translate: () => "",

  // User-managed in Anki (personal notes); intentionally not sourced from DB.
  selfGuide: () => "",

  // This field intentionally stores the number of letters in the English base form.
  // It is not the free-text WordSense.hint_to_select sense-disambiguation hint.
  hint_to_select_letters: (w) => String(w.base_form.length ?? ""),

  phonetic_us_normalized: (w) => w.phonetic_us_normalized ?? "",
  learning_depth: (w) =>
    w.learning_depth == null ? "" : String(w.learning_depth),
  imageability: (w) => (w.imageability == null ? "" : String(w.imageability)),
  productive_target: (w) =>
    w.productive_target == null ? "" : String(w.productive_target),
  json_hint: (w) => w.json_hint ?? "",
  updatedAt: (w) => w.updatedAt.toISOString(),
} as const satisfies Record<string, WordAnkiFieldGenerator>;

export type WordAnkiManagedFieldName = keyof typeof WORD_ANKI_FIELD_GENERATORS;

// These are intentionally preserved in Anki and are not sourced from the current DB.
// Keeping the list explicit prevents a misspelled configured field from being ignored.
export const WORD_ANKI_PRESERVED_ONLY_FIELDS = [
  "first_letter_en_hint",
] as const;

export function getUnsupportedWordAnkiFieldNames(
  fields: readonly string[],
): string[] {
  const preserved = new Set<string>(WORD_ANKI_PRESERVED_ONLY_FIELDS);
  return fields.filter(
    (field) =>
      !Object.hasOwn(WORD_ANKI_FIELD_GENERATORS, field) &&
      !preserved.has(field),
  );
}

export function assertSupportedWordAnkiFieldNames(
  fields: readonly string[],
): void {
  const unsupported = getUnsupportedWordAnkiFieldNames(fields);
  if (unsupported.length) {
    throw new Error(
      `Configured Anki field(s) have no DB generator or preserved-field declaration: ${unsupported.join(", ")}`,
    );
  }
}

export function getWordAnkiManagedFieldNames(
  fields: readonly string[],
): WordAnkiManagedFieldName[] {
  return fields.filter(
    (field): field is keyof typeof WORD_ANKI_FIELD_GENERATORS =>
      Object.hasOwn(WORD_ANKI_FIELD_GENERATORS, field),
  );
}

export async function generateWordAnkiFieldsForMetaLexVr9(
  word: WordSense | WordForAnki,
  configuredFields: readonly string[],
): Promise<Record<string, string>> {
  const withEnglish =
    "base_form" in word
      ? (word as WordForAnki)
      : await hydrateWordSenseWithEnglishFields(word);
  const withMeanings =
    "primaryPersianWord" in withEnglish
      ? (withEnglish as WordForAnki)
      : await hydrateWordSenseWithPersianMeanings(withEnglish);
  const withSynonyms =
    "synonymEnglishWords" in withMeanings
      ? (withMeanings as WordForAnki)
      : await hydrateWordSenseWithEnglishSynonyms(withMeanings);
  const withSentence =
    "sentence" in withSynonyms
      ? (withSynonyms as WordForAnki)
      : (await hydrateWordsWithPrimarySentence([withSynonyms]))[0]!;
  const fields = getWordAnkiManagedFieldNames(configuredFields);
  return Promise.all(
    fields.map(
      async (f) =>
        [f, await WORD_ANKI_FIELD_GENERATORS[f](withSentence)] as const,
    ),
  ).then((entries) => Object.fromEntries(entries) as Record<string, string>);
}
