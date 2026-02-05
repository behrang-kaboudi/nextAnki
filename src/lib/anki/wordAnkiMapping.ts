import "server-only";

import type { Word } from "@prisma/client";

import type { AnkiNotesInfo } from "@/lib/AnkiConnect";
import { WordAnkiConstants, type WordNoteFieldName } from "@/lib/AnkiDeck";
import type { WordAudioFieldKey } from "@/lib/audio/wordFieldAudioNaming";
import { getLatestWordFieldAudioFile } from "@/lib/words/wordFieldVoice";

export const WORD_ANKI_LINK_ID_FIELD = "anki_link_id" as const;

// These aliases exist because some Anki note types / exports may have different casing.
export const WORD_ANKI_LINK_ID_FIELD_ALIASES = [
  WORD_ANKI_LINK_ID_FIELD,
  "AnkiLinkId",
  "ankiLinkId",
] as const;

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function getAnkiLinkIdFromNoteFields(note: AnkiNotesInfo[number]): string | null {
  for (const key of WORD_ANKI_LINK_ID_FIELD_ALIASES) {
    const v = asNonEmptyString(note.fields?.[key]?.value);
    if (v) return v;
  }
  return null;
}

export type WordAnkiFieldGenerator = (word: Word) => string;

function withLatestAudioTag(text: string, ankiLinkId: string, field: WordAudioFieldKey): string {
  const latest = getLatestWordFieldAudioFile({ ankiLinkId, field });
  if (!latest || latest.size <= 0) return text;

  const tag = `[sound:${latest.filename}]`;
  if (text.includes(tag)) return text;

  const base = text.trim();
  return base ? `${base} ${tag}` : tag;
}

export const WORD_ANKI_FIELD_GENERATORS = {
  anki_link_id: (w) => w.anki_link_id,
  base_form: (w) => withLatestAudioTag(w.base_form, w.anki_link_id, "base_form"),
  phonetic_us: (w) => w.phonetic_us ?? "",
  pos: (w) => w.pos ?? "",
  meaning_fa: (w) => withLatestAudioTag(w.meaning_fa, w.anki_link_id, "meaning_fa"),
  other_meanings_fa: (w) => withLatestAudioTag(w.other_meanings_fa ?? "", w.anki_link_id, "other_meanings_fa"),
  concept_explained_fa: (w) => w.concept_explained_fa ?? "",
  sentence_en: (w) => withLatestAudioTag(w.sentence_en ?? "", w.anki_link_id, "sentence_en"),
  sentence_en_meaning_fa: (w) =>
    withLatestAudioTag(w.sentence_en_meaning_fa ?? "", w.anki_link_id, "sentence_en_meaning_fa"),

  // TODO: define the source-of-truth for this field (not currently present in DB schema).
  best_translate: () => "",

  mixed_sentence: (w) => w.mixed_sentence ?? "",
  first_letter_fa_hint: (w) => w.first_letter_fa_hint ?? "",
  first_letter_en_hint: (w) => w.first_letter_en_hint ?? "",

  // Anki field name is `hint_to_select_letters`, but DB field is `hint_to_select`.
  hint_to_select_letters: (w) => w.hint_to_select ?? "",

  hint_sentence: (w) => w.hint_sentence ?? "",
  phonetic_us_normalized: (w) => w.phonetic_us_normalized ?? "",
  learning_depth: (w) => (w.learning_depth == null ? "" : String(w.learning_depth)),
} as const satisfies Record<WordNoteFieldName, WordAnkiFieldGenerator>;

export function generateWordAnkiFieldsForMetaLexVr9(word: Word): Record<WordNoteFieldName, string> {
  const fields = WordAnkiConstants.noteFields.META_LEX_VR9;
  return Object.fromEntries(fields.map((f) => [f, WORD_ANKI_FIELD_GENERATORS[f](word)])) as Record<
    WordNoteFieldName,
    string
  >;
}
