"use client";

import { useMemo, useState } from "react";

import WordFieldVoiceCell from "@/app/(site)/word-hints/WordFieldVoiceCell.client";

type WordEditorState = {
  id: number;
  anki_link_id: string;

  base_form: string;
  phonetic_us: string | null;
  phonetic_us_normalized: string | null;
  meaning_fa: string;
  meaning_fa_IPA: string;
  meaning_fa_IPA_normalized: string;
  pos: string | null;
  concept_explained: string | null;
  concept_explained_fa: string | null;
  word_hint_story: string | null;
  sentence_en: string;
  sentence_en_meaning_fa: string | null;
  explanation_for_sentence_meaning: string | null;
  learning_depth: number | null;
  mixed_sentence: string | null;
  other_meanings_fa: string | null;
  category: string | null;
  typeOfWordInDb: string;
  hint_sentence: string | null;
  first_letter_en_hint: string | null;
  first_letter_fa_hint: string | null;
  hint_to_select: string | null;
  json_hint: string | null;
  word_note: string | null;
  common_error: string | null;
  imageability: number | null;

  createdAt: string;
  updatedAt: string;
};

function InputRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1">
      <div className="text-xs font-semibold text-muted">{label}</div>
      {children}
    </div>
  );
}

function asNullableString(raw: string, opts?: { trim?: boolean }) {
  const s = opts?.trim === false ? raw : raw.trim();
  return s.length ? s : null;
}

function asNullableNumber(raw: string) {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export default function WordEditorClient({ initial }: { initial: WordEditorState }) {
  const [baseline, setBaseline] = useState<WordEditorState>(initial);
  const [word, setWord] = useState<WordEditorState>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const dirty = useMemo(() => JSON.stringify(word) !== JSON.stringify(baseline), [word, baseline]);

  async function save() {
    if (saving) return;
    setSaving(true);
    setError(null);
    setSavedAt(null);
    try {
      const res = await fetch("/api/words/editor/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: word.id,
          data: {
            base_form: word.base_form,
            phonetic_us: word.phonetic_us,
            phonetic_us_normalized: word.phonetic_us_normalized,
            meaning_fa: word.meaning_fa,
            meaning_fa_IPA: word.meaning_fa_IPA,
            meaning_fa_IPA_normalized: word.meaning_fa_IPA_normalized,
            pos: word.pos,
            concept_explained: word.concept_explained,
            concept_explained_fa: word.concept_explained_fa,
            word_hint_story: word.word_hint_story,
            sentence_en: word.sentence_en,
            sentence_en_meaning_fa: word.sentence_en_meaning_fa,
            explanation_for_sentence_meaning: word.explanation_for_sentence_meaning,
            learning_depth: word.learning_depth,
            mixed_sentence: word.mixed_sentence,
            other_meanings_fa: word.other_meanings_fa,
            category: word.category,
            typeOfWordInDb: word.typeOfWordInDb,
            hint_sentence: word.hint_sentence,
            first_letter_en_hint: word.first_letter_en_hint,
            first_letter_fa_hint: word.first_letter_fa_hint,
            hint_to_select: word.hint_to_select,
            json_hint: word.json_hint,
            word_note: word.word_note,
            common_error: word.common_error,
            imageability: word.imageability,
          },
        }),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; item?: { updatedAt?: string } | null; error?: string }
        | null;
      if (!res.ok || json?.ok !== true) throw new Error(json?.error || `Request failed (${res.status})`);
      const updatedAt = String(json?.item?.updatedAt ?? "");
      if (updatedAt) {
        setWord((prev) => ({ ...prev, updatedAt }));
        setBaseline((prev) => ({ ...prev, ...word, updatedAt }));
      } else {
        setBaseline(word);
      }
      setSavedAt(new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-card bg-background p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm">
            <div className="font-mono text-xs opacity-80">anki_link_id: {word.anki_link_id}</div>
            <div className="font-mono text-xs opacity-80">createdAt: {word.createdAt}</div>
            <div className="font-mono text-xs opacity-80">updatedAt: {word.updatedAt}</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWord(baseline)}
              disabled={saving || !dirty}
              className="rounded border px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="rounded bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-3 rounded border border-red-500/30 bg-red-600/10 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        {savedAt ? <div className="mt-3 text-xs opacity-70">Saved at {savedAt}</div> : null}
      </div>

      <div className="grid gap-4 rounded-2xl border border-card bg-background p-4">
        <div className="text-sm font-semibold">Main fields</div>

        <div className="grid gap-4 md:grid-cols-2">
          <InputRow label="base_form">
            <div className="flex items-center gap-2">
              <input
                value={word.base_form}
                onChange={(e) => setWord((p) => ({ ...p, base_form: e.target.value }))}
                className="w-full rounded border px-3 py-2 text-sm"
              />
              <WordFieldVoiceCell field="base_form" ankiLinkId={word.anki_link_id} text={word.base_form} />
            </div>
          </InputRow>

          <InputRow label="phonetic_us">
            <input
              value={word.phonetic_us ?? ""}
              onChange={(e) => setWord((p) => ({ ...p, phonetic_us: asNullableString(e.target.value) }))}
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder="(nullable)"
            />
          </InputRow>

          <InputRow label="meaning_fa">
            <div className="flex items-center gap-2">
              <input
                value={word.meaning_fa}
                onChange={(e) => setWord((p) => ({ ...p, meaning_fa: e.target.value }))}
                className="w-full rounded border px-3 py-2 text-sm"
              />
              <WordFieldVoiceCell field="meaning_fa" ankiLinkId={word.anki_link_id} text={word.meaning_fa} />
            </div>
          </InputRow>

          <InputRow label="pos">
            <input
              value={word.pos ?? ""}
              onChange={(e) => setWord((p) => ({ ...p, pos: asNullableString(e.target.value) }))}
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder="(nullable)"
            />
          </InputRow>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <InputRow label="sentence_en">
            <div className="flex items-center gap-2">
              <textarea
                value={word.sentence_en}
                onChange={(e) => setWord((p) => ({ ...p, sentence_en: e.target.value }))}
                className="min-h-[84px] w-full rounded border px-3 py-2 text-sm"
              />
              <WordFieldVoiceCell field="sentence_en" ankiLinkId={word.anki_link_id} text={word.sentence_en} />
            </div>
          </InputRow>

          <InputRow label="sentence_en_meaning_fa">
            <div className="flex items-center gap-2">
              <textarea
                value={word.sentence_en_meaning_fa ?? ""}
                onChange={(e) => setWord((p) => ({ ...p, sentence_en_meaning_fa: asNullableString(e.target.value, { trim: false }) }))}
                className="min-h-[84px] w-full rounded border px-3 py-2 text-sm"
                placeholder="(nullable)"
              />
              <WordFieldVoiceCell
                field="sentence_en_meaning_fa"
                ankiLinkId={word.anki_link_id}
                text={word.sentence_en_meaning_fa}
              />
            </div>
          </InputRow>
        </div>
      </div>

      <details className="rounded-2xl border border-card bg-background p-4">
        <summary className="cursor-pointer text-sm font-semibold">More fields</summary>
        <div className="mt-4 grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <InputRow label="other_meanings_fa">
              <div className="flex items-center gap-2">
                <textarea
                  value={word.other_meanings_fa ?? ""}
                  onChange={(e) => setWord((p) => ({ ...p, other_meanings_fa: asNullableString(e.target.value, { trim: false }) }))}
                  className="min-h-[84px] w-full rounded border px-3 py-2 text-sm"
                  placeholder="(nullable)"
                />
                <WordFieldVoiceCell
                  field="other_meanings_fa"
                  ankiLinkId={word.anki_link_id}
                  text={word.other_meanings_fa}
                />
              </div>
            </InputRow>

            <InputRow label="concept_explained_fa">
              <div className="flex items-center gap-2">
                <textarea
                  value={word.concept_explained_fa ?? ""}
                  onChange={(e) => setWord((p) => ({ ...p, concept_explained_fa: asNullableString(e.target.value, { trim: false }) }))}
                  className="min-h-[84px] w-full rounded border px-3 py-2 text-sm"
                  placeholder="(nullable)"
                />
                <WordFieldVoiceCell
                  field="concept_explained_fa"
                  ankiLinkId={word.anki_link_id}
                  text={word.concept_explained_fa}
                />
              </div>
            </InputRow>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <InputRow label="meaning_fa_IPA">
              <textarea
                value={word.meaning_fa_IPA}
                onChange={(e) => setWord((p) => ({ ...p, meaning_fa_IPA: e.target.value }))}
                className="min-h-[84px] w-full rounded border px-3 py-2 text-sm"
              />
            </InputRow>

            <InputRow label="meaning_fa_IPA_normalized">
              <textarea
                value={word.meaning_fa_IPA_normalized}
                onChange={(e) => setWord((p) => ({ ...p, meaning_fa_IPA_normalized: e.target.value }))}
                className="min-h-[84px] w-full rounded border px-3 py-2 text-sm"
              />
            </InputRow>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <InputRow label="phonetic_us_normalized">
              <input
                value={word.phonetic_us_normalized ?? ""}
                onChange={(e) => setWord((p) => ({ ...p, phonetic_us_normalized: asNullableString(e.target.value) }))}
                className="w-full rounded border px-3 py-2 text-sm"
                placeholder="(nullable)"
              />
            </InputRow>

            <InputRow label="learning_depth">
              <input
                value={word.learning_depth == null ? "" : String(word.learning_depth)}
                onChange={(e) => setWord((p) => ({ ...p, learning_depth: asNullableNumber(e.target.value) }))}
                className="w-full rounded border px-3 py-2 text-sm"
                placeholder="(nullable number)"
              />
            </InputRow>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <InputRow label="imageability (0-100)">
              <input
                value={word.imageability == null ? "" : String(word.imageability)}
                onChange={(e) => setWord((p) => ({ ...p, imageability: asNullableNumber(e.target.value) }))}
                className="w-full rounded border px-3 py-2 text-sm"
                placeholder="(nullable number)"
              />
            </InputRow>

            <InputRow label="typeOfWordInDb">
              <input
                value={word.typeOfWordInDb}
                onChange={(e) => setWord((p) => ({ ...p, typeOfWordInDb: e.target.value }))}
                className="w-full rounded border px-3 py-2 text-sm"
              />
            </InputRow>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <InputRow label="category">
              <input
                value={word.category ?? ""}
                onChange={(e) => setWord((p) => ({ ...p, category: asNullableString(e.target.value) }))}
                className="w-full rounded border px-3 py-2 text-sm"
                placeholder="(nullable)"
              />
            </InputRow>

            <InputRow label="mixed_sentence">
              <input
                value={word.mixed_sentence ?? ""}
                onChange={(e) => setWord((p) => ({ ...p, mixed_sentence: asNullableString(e.target.value, { trim: false }) }))}
                className="w-full rounded border px-3 py-2 text-sm"
                placeholder="(nullable)"
              />
            </InputRow>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <InputRow label="hint_sentence">
              <textarea
                value={word.hint_sentence ?? ""}
                onChange={(e) => setWord((p) => ({ ...p, hint_sentence: asNullableString(e.target.value, { trim: false }) }))}
                className="min-h-[84px] w-full rounded border px-3 py-2 text-sm"
                placeholder="(nullable)"
              />
            </InputRow>

            <InputRow label="word_hint_story">
              <textarea
                value={word.word_hint_story ?? ""}
                onChange={(e) => setWord((p) => ({ ...p, word_hint_story: asNullableString(e.target.value, { trim: false }) }))}
                className="min-h-[84px] w-full rounded border px-3 py-2 text-sm"
                placeholder="(nullable)"
              />
            </InputRow>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <InputRow label="concept_explained">
              <textarea
                value={word.concept_explained ?? ""}
                onChange={(e) => setWord((p) => ({ ...p, concept_explained: asNullableString(e.target.value, { trim: false }) }))}
                className="min-h-[84px] w-full rounded border px-3 py-2 text-sm"
                placeholder="(nullable)"
              />
            </InputRow>

            <InputRow label="explanation_for_sentence_meaning">
              <textarea
                value={word.explanation_for_sentence_meaning ?? ""}
                onChange={(e) =>
                  setWord((p) => ({
                    ...p,
                    explanation_for_sentence_meaning: asNullableString(e.target.value, { trim: false }),
                  }))
                }
                className="min-h-[84px] w-full rounded border px-3 py-2 text-sm"
                placeholder="(nullable)"
              />
            </InputRow>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <InputRow label="first_letter_en_hint">
              <textarea
                value={word.first_letter_en_hint ?? ""}
                onChange={(e) => setWord((p) => ({ ...p, first_letter_en_hint: asNullableString(e.target.value, { trim: false }) }))}
                className="min-h-[84px] w-full rounded border px-3 py-2 text-sm"
                placeholder="(nullable)"
              />
            </InputRow>

            <InputRow label="first_letter_fa_hint">
              <textarea
                value={word.first_letter_fa_hint ?? ""}
                onChange={(e) => setWord((p) => ({ ...p, first_letter_fa_hint: asNullableString(e.target.value, { trim: false }) }))}
                className="min-h-[84px] w-full rounded border px-3 py-2 text-sm"
                placeholder="(nullable)"
              />
            </InputRow>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <InputRow label="hint_to_select">
              <input
                value={word.hint_to_select ?? ""}
                onChange={(e) => setWord((p) => ({ ...p, hint_to_select: asNullableString(e.target.value, { trim: false }) }))}
                className="w-full rounded border px-3 py-2 text-sm"
                placeholder="(nullable)"
              />
            </InputRow>

            <InputRow label="common_error">
              <input
                value={word.common_error ?? ""}
                onChange={(e) => setWord((p) => ({ ...p, common_error: asNullableString(e.target.value, { trim: false }) }))}
                className="w-full rounded border px-3 py-2 text-sm"
                placeholder="(nullable)"
              />
            </InputRow>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <InputRow label="word_note">
              <textarea
                value={word.word_note ?? ""}
                onChange={(e) => setWord((p) => ({ ...p, word_note: asNullableString(e.target.value, { trim: false }) }))}
                className="min-h-[84px] w-full rounded border px-3 py-2 text-sm"
                placeholder="(nullable)"
              />
            </InputRow>

            <InputRow label="json_hint (LongText)">
              <textarea
                value={word.json_hint ?? ""}
                onChange={(e) => setWord((p) => ({ ...p, json_hint: asNullableString(e.target.value, { trim: false }) }))}
                className="min-h-[160px] w-full rounded border px-3 py-2 font-mono text-xs"
                placeholder="(nullable JSON)"
              />
            </InputRow>
          </div>
        </div>
      </details>
    </div>
  );
}
