"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FocusEvent } from "react";

import WordFieldVoiceCell from "@/app/(site)/word-hints/WordFieldVoiceCell.client";
import { SpecialCharactersBar } from "@/components/ipa/SpecialCharactersBar";
import JsonHintPreviewModal from "./JsonHintPreviewModal.client";

const WORD_AUDIO_FIELDS = [
  "base_form",
  "meaning_fa",
  "other_meanings_fa",
  "other_meanings_en",
  "concept_explained_fa",
  "sentence_en",
  "sentence_en_meaning_fa",
] as const;

const IPA_SPECIAL_CHARACTERS = [
  "æ",
  "ɪ",
  "ɜ",
  "ə",
  "ʊ",
  "ʌ",
  "ʔ",
  "ʧ",
  "ʤ",
  "ɑ",
  "ɔ",
  "ŋ",
  "θ",
  "ð",
  "ʃ",
  "ʒ",
  "ɡ",
] as const;

export type WordEditorState = {
  id: number;
  anki_link_id: string;
  sentenceRecordId: number | null;

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
  other_meanings_en: string | null;
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

type EditableFieldKey =
  | "base_form"
  | "phonetic_us"
  | "meaning_fa"
  | "meaning_fa_IPA"
  | "pos"
  | "sentence_en"
  | "sentence_en_meaning_fa"
  | "other_meanings_fa"
  | "other_meanings_en"
  | "concept_explained_fa"
  | "phonetic_us_normalized"
  | "meaning_fa_IPA_normalized"
  | "phonetic_us_normalized"
  | "learning_depth"
  | "imageability"
  | "typeOfWordInDb"
  | "category"
  | "mixed_sentence"
  | "hint_sentence"
  | "word_hint_story"
  | "concept_explained"
  | "explanation_for_sentence_meaning"
  | "first_letter_en_hint"
  | "first_letter_fa_hint"
  | "hint_to_select"
  | "common_error"
  | "word_note";

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

export default function WordEditorClient({
  initial,
  floatingActions = true,
  onDirtyChange,
  onSaved,
}: {
  initial: WordEditorState;
  floatingActions?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onSaved?: (id: number) => void;
}) {
  type SaveOptions = { force?: boolean; audioUpdatedField?: (typeof WORD_AUDIO_FIELDS)[number] };

  const [baseline, setBaseline] = useState<WordEditorState>(initial);
  const [word, setWord] = useState<WordEditorState>(initial);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const pendingAudioSaveRef = useRef<{ field?: (typeof WORD_AUDIO_FIELDS)[number] } | null>(null);
  const saveRef = useRef<((opts?: SaveOptions) => Promise<void>) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [activeField, setActiveField] = useState<EditableFieldKey | null>(null);
  const lastFocusedInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const lastUrlRef = useRef<string>("");

  const dirty = useMemo(() => JSON.stringify(word) !== JSON.stringify(baseline), [word, baseline]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  function normalizeAudioText(value: string | null | undefined) {
    return String(value ?? "").trim();
  }

  const missingRequiredFields = useMemo(() => {
    const missing: string[] = [];
    if (!word.base_form.trim()) missing.push("base_form");
    if (!word.meaning_fa.trim()) missing.push("meaning_fa");
    if (!word.meaning_fa_IPA.trim()) missing.push("meaning_fa_IPA");
    if (!word.sentence_en.trim()) missing.push("sentence_en");
    if (!word.typeOfWordInDb.trim()) missing.push("typeOfWordInDb");
    return missing;
  }, [word.base_form, word.meaning_fa, word.meaning_fa_IPA, word.sentence_en, word.typeOfWordInDb]);

  const requiredOk = missingRequiredFields.length === 0;

  const registerFieldFocus = useCallback((field: EditableFieldKey) => {
    return (e: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      lastFocusedInputRef.current = e.currentTarget;
      setActiveField(field);
    };
  }, []);

  const insertSpecialChar = useCallback(
    (character: string) => {
      const element = lastFocusedInputRef.current;
      const field = activeField;
      if (!element || !field) return;

      const start = element.selectionStart ?? element.value.length;
      const end = element.selectionEnd ?? element.value.length;
      const nextValue = element.value.slice(0, start) + character + element.value.slice(end);
      const nextCursor = start + character.length;

      setWord((prev) => {
        const cur = prev as unknown as Record<string, unknown>;
        const existing = cur[field];
        if (typeof existing === "number") {
          const n = Number(nextValue);
          return { ...prev, [field]: Number.isFinite(n) ? n : existing } as WordEditorState;
        }
        if (existing === null) return { ...prev, [field]: nextValue } as WordEditorState;
        return { ...prev, [field]: nextValue } as WordEditorState;
      });

      requestAnimationFrame(() => {
        try {
          element.focus();
          element.setSelectionRange(nextCursor, nextCursor);
        } catch {
          // ignore
        }
      });
    },
    [activeField],
  );

  async function save(opts?: SaveOptions) {
    if (savingRef.current) {
      if (opts?.force) pendingAudioSaveRef.current = { field: opts.audioUpdatedField };
      return;
    }
    if (!opts?.force && (!dirty || !requiredOk)) {
      if (dirty && !requiredOk) {
        setWarning(`Please fill required fields before saving: ${missingRequiredFields.join(", ")}`);
      }
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setError(null);
    setWarning(null);
    setSavedAt(null);
    try {
      const audioFieldsChanged = WORD_AUDIO_FIELDS.filter((field) => {
        const before = normalizeAudioText((baseline as unknown as Record<string, string | null | undefined>)[field]);
        const after = normalizeAudioText((word as unknown as Record<string, string | null | undefined>)[field]);
        return before !== after;
      });
      const audioFieldsToDelete = opts?.audioUpdatedField
        ? audioFieldsChanged.filter((f) => f !== opts.audioUpdatedField)
        : audioFieldsChanged;

      const res = await fetch("/api/words/editor/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: word.id,
          data: {
            base_form: word.base_form,
            phonetic_us: word.phonetic_us,
            meaning_fa: word.meaning_fa,
            meaning_fa_IPA: word.meaning_fa_IPA,
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
            other_meanings_en: word.other_meanings_en,
            category: word.category,
            typeOfWordInDb: word.typeOfWordInDb,
            hint_sentence: word.hint_sentence,
            first_letter_en_hint: word.first_letter_en_hint,
            first_letter_fa_hint: word.first_letter_fa_hint,
            hint_to_select: word.hint_to_select,
            word_note: word.word_note,
            common_error: word.common_error,
            imageability: word.imageability,
          },
        }),
      });
      const json = (await res.json().catch(() => null)) as
        | {
            ok?: boolean;
            item?:
              | {
                  sentenceRecordId?: number | null;
                  updatedAt?: string;
                  phonetic_us_normalized?: string | null;
                  meaning_fa_IPA_normalized?: string;
                  json_hint?: string | null;
                }
              | null;
            error?: string;
          }
        | null;
      if (!res.ok || json?.ok !== true) throw new Error(json?.error || `Request failed (${res.status})`);
      const updatedAt = String(json?.item?.updatedAt ?? "");
      const phonetic_us_normalized =
        json?.item && "phonetic_us_normalized" in json.item ? (json.item.phonetic_us_normalized ?? null) : null;
      const meaning_fa_IPA_normalized =
        json?.item && "meaning_fa_IPA_normalized" in json.item
          ? String(json.item.meaning_fa_IPA_normalized ?? "")
          : "";
      const json_hint = json?.item && "json_hint" in json.item ? (json.item.json_hint ?? null) : null;
      const sentenceRecordId =
        json?.item && "sentenceRecordId" in json.item ? (json.item.sentenceRecordId ?? null) : word.sentenceRecordId;

      if (updatedAt) {
        setWord((prev) => ({
          ...prev,
          sentenceRecordId,
          updatedAt,
          phonetic_us_normalized,
          meaning_fa_IPA_normalized,
          json_hint,
        }));
        setBaseline({
          ...word,
          sentenceRecordId,
          updatedAt,
          phonetic_us_normalized,
          meaning_fa_IPA_normalized,
          json_hint,
        });
      } else {
        setBaseline({ ...word, sentenceRecordId, phonetic_us_normalized, meaning_fa_IPA_normalized, json_hint });
      }

      const getAudioKeyForField = (field: (typeof WORD_AUDIO_FIELDS)[number]) =>
        field === "sentence_en" || field === "sentence_en_meaning_fa"
          ? sentenceRecordId != null
            ? String(sentenceRecordId)
            : null
          : word.anki_link_id;

      if (audioFieldsToDelete.length) {
        const results = await Promise.allSettled(
          audioFieldsToDelete.map(async (field) => {
            const audioKey = getAudioKeyForField(field);
            if (!audioKey) return;
            const delRes = await fetch("/api/words/field-voice-delete-all", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ audioKey, field }),
            });
            const delJson = (await delRes.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
            if (!delRes.ok || delJson?.ok !== true) {
              throw new Error(delJson?.error || `Audio delete failed (${delRes.status}) for ${field}`);
            }
            window.dispatchEvent(
              new CustomEvent("wordFieldVoice:updated", {
                detail: { audioKey, field, source: "wordEditor:saveCleanup" },
              }),
            );
          }),
        );
        const failed = results.filter((r) => r.status === "rejected");
        if (failed.length) {
          setWarning(`Saved, but failed to delete some audio files (${failed.length}).`);
        }
      }

      setSavedAt(new Date().toISOString());
      onSaved?.(word.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      savingRef.current = false;
      setSaving(false);
      const pending = pendingAudioSaveRef.current;
      pendingAudioSaveRef.current = null;
      if (pending) {
        queueMicrotask(() => void save({ force: true, audioUpdatedField: pending.field }));
      }
    }
  }

  useEffect(() => {
    saveRef.current = save;
  });

  useEffect(() => {
    lastUrlRef.current = window.location.href;

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    };

    const onDocumentClickCapture = (e: MouseEvent) => {
      if (!dirty) return;
      if (e.defaultPrevented) return;

      const target = e.target as HTMLElement | null;
      const anchor = target?.closest?.("a") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target === "_blank") return;
      if (anchor.hasAttribute("download")) return;
      if (anchor.getAttribute("href")?.startsWith("#")) return;

      let url: URL | null = null;
      try {
        url = new URL(anchor.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;

      const ok = window.confirm("You have unsaved changes. Leave without saving?");
      if (!ok) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const onPopState = () => {
      if (!dirty) {
        lastUrlRef.current = window.location.href;
        return;
      }
      const ok = window.confirm("You have unsaved changes. Leave without saving?");
      if (ok) {
        lastUrlRef.current = window.location.href;
        return;
      }
      try {
        history.pushState(null, "", lastUrlRef.current || window.location.href);
      } catch {
        // ignore
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.altKey) return;
      const isSave = (e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S");
      if (!isSave) return;

      e.preventDefault();
      if (!dirty) return;
      void saveRef.current?.();
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onDocumentClickCapture, true);
    window.addEventListener("popstate", onPopState);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onDocumentClickCapture, true);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [dirty]);

  useEffect(() => {
    const onAudioUpdated = (evt: Event) => {
      const detail = (evt as CustomEvent<{ audioKey?: unknown; field?: unknown; source?: unknown }>).detail;
      if (!detail) return;
      if (detail.source === "wordEditor:saveCleanup") return;
      const fieldRaw = detail.field;
      const field = typeof fieldRaw === "string" && (WORD_AUDIO_FIELDS as readonly string[]).includes(fieldRaw) ? fieldRaw : null;
      if (!field) return;
      const expectedAudioKey =
        field === "sentence_en" || field === "sentence_en_meaning_fa"
          ? word.sentenceRecordId != null
            ? String(word.sentenceRecordId)
            : null
          : word.anki_link_id;
      if (!expectedAudioKey || detail.audioKey !== expectedAudioKey) return;
      void saveRef.current?.({ force: true, audioUpdatedField: field as SaveOptions["audioUpdatedField"] });
    };

    window.addEventListener("wordFieldVoice:updated", onAudioUpdated);
    return () => window.removeEventListener("wordFieldVoice:updated", onAudioUpdated);
  }, [word.anki_link_id, word.sentenceRecordId]);

  const statusText = saving
    ? "Saving…"
    : dirty
      ? requiredOk
        ? "Unsaved changes"
        : "Unsaved (required fields missing)"
      : "Saved";

  const statusMetaText = saving
    ? null
    : dirty
      ? requiredOk
        ? null
        : `missing: ${missingRequiredFields.join(", ")}`
      : `updatedAt: ${word.updatedAt}`;

  return (
    <div className="grid gap-4 pb-24">
      <div className="rounded-2xl border border-card bg-background p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm">
            <div className="font-mono text-xs opacity-80">anki_link_id: {word.anki_link_id}</div>
            <div className="font-mono text-xs opacity-80">createdAt: {word.createdAt}</div>
            <div className="font-mono text-xs opacity-80">updatedAt: {word.updatedAt}</div>
            <div className="font-mono text-xs opacity-80">
              phonetic_us_normalized: {word.phonetic_us_normalized ?? "—"}
            </div>
            <div className="font-mono text-xs opacity-80">
              meaning_fa_IPA_normalized: {word.meaning_fa_IPA_normalized}
            </div>
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
              disabled={saving || !dirty || !requiredOk}
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
        {warning ? (
          <div className="mt-3 rounded border border-yellow-500/30 bg-yellow-600/10 p-3 text-sm text-yellow-800 dark:text-yellow-200">
            {warning}
          </div>
        ) : null}
        {savedAt ? <div className="mt-3 text-xs opacity-70">Saved at {savedAt}</div> : null}
      </div>

      {floatingActions ? (
        <div className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-2xl border border-card bg-background/95 p-2 shadow-elevated backdrop-blur">
          <div className="hidden max-w-[34rem] text-xs opacity-70 sm:block">
            <div className="truncate">{statusText}</div>
            {statusMetaText ? <div className="truncate text-[11px] opacity-70">{statusMetaText}</div> : null}
          </div>
          <button
            type="button"
            onClick={() => setWord(baseline)}
            disabled={saving || !dirty}
            className="rounded-xl border px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !dirty || !requiredOk}
            className="rounded-xl bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      ) : null}

      <div className="grid gap-4 rounded-2xl border border-card bg-background p-4">
        <div className="text-sm font-semibold">Main fields</div>

        <SpecialCharactersBar
          characters={IPA_SPECIAL_CHARACTERS}
          onPick={insertSpecialChar}
          title="Special characters"
          helpText="Click a field, then click a character."
        />

        <div className="grid gap-4 md:grid-cols-2">
          <InputRow label="base_form">
            <div className="flex items-center gap-2">
              <input
                value={word.base_form}
                onChange={(e) => setWord((p) => ({ ...p, base_form: e.target.value }))}
                onFocus={registerFieldFocus("base_form")}
                className="w-full rounded border px-3 py-2 text-sm"
              />
              <WordFieldVoiceCell field="base_form" audioKey={word.anki_link_id} text={word.base_form} />
            </div>
          </InputRow>

          <InputRow label="phonetic_us">
            <input
              value={word.phonetic_us ?? ""}
              onChange={(e) => setWord((p) => ({ ...p, phonetic_us: asNullableString(e.target.value) }))}
              onFocus={registerFieldFocus("phonetic_us")}
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder="(nullable)"
            />
          </InputRow>

          <InputRow label="meaning_fa">
            <div className="flex items-center gap-2">
              <input
                value={word.meaning_fa}
                onChange={(e) => setWord((p) => ({ ...p, meaning_fa: e.target.value }))}
                onFocus={registerFieldFocus("meaning_fa")}
                className="w-full rounded border px-3 py-2 text-sm"
              />
              <WordFieldVoiceCell field="meaning_fa" audioKey={word.anki_link_id} text={word.meaning_fa} />
            </div>
          </InputRow>

          <InputRow label="pos">
            <input
              value={word.pos ?? ""}
              onChange={(e) => setWord((p) => ({ ...p, pos: asNullableString(e.target.value) }))}
              onFocus={registerFieldFocus("pos")}
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder="(nullable)"
            />
          </InputRow>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <InputRow label="meaning_fa_IPA">
            <textarea
              value={word.meaning_fa_IPA}
              onChange={(e) => setWord((p) => ({ ...p, meaning_fa_IPA: e.target.value }))}
              onFocus={registerFieldFocus("meaning_fa_IPA")}
              className="min-h-[84px] w-full rounded border px-3 py-2 text-sm"
            />
          </InputRow>

          <InputRow label="meaning_fa_IPA_normalized (auto)">
            <textarea
              value={word.meaning_fa_IPA_normalized}
              readOnly
              className="min-h-[84px] w-full rounded border bg-black/5 px-3 py-2 text-sm dark:bg-white/10"
            />
          </InputRow>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <InputRow label="sentence_en">
            <div className="flex items-center gap-2">
              <textarea
                value={word.sentence_en}
                onChange={(e) => setWord((p) => ({ ...p, sentence_en: e.target.value }))}
                onFocus={registerFieldFocus("sentence_en")}
                className="min-h-[84px] w-full rounded border px-3 py-2 text-sm"
              />
              <WordFieldVoiceCell
                field="sentence_en"
                audioKey={word.sentenceRecordId != null ? String(word.sentenceRecordId) : null}
                text={word.sentence_en}
              />
            </div>
          </InputRow>

          <InputRow label="sentence_en_meaning_fa">
            <div className="flex items-center gap-2">
              <textarea
                value={word.sentence_en_meaning_fa ?? ""}
                onChange={(e) => setWord((p) => ({ ...p, sentence_en_meaning_fa: asNullableString(e.target.value, { trim: false }) }))}
                onFocus={registerFieldFocus("sentence_en_meaning_fa")}
                className="min-h-[84px] w-full rounded border px-3 py-2 text-sm"
                placeholder="(nullable)"
              />
              <WordFieldVoiceCell
                field="sentence_en_meaning_fa"
                audioKey={word.sentenceRecordId != null ? String(word.sentenceRecordId) : null}
                text={word.sentence_en_meaning_fa}
              />
            </div>
          </InputRow>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <InputRow label="other_meanings_fa">
            <div className="flex items-center gap-2">
              <textarea
                value={word.other_meanings_fa ?? ""}
                onChange={(e) => setWord((p) => ({ ...p, other_meanings_fa: asNullableString(e.target.value, { trim: false }) }))}
                onFocus={registerFieldFocus("other_meanings_fa")}
                className="min-h-[84px] w-full rounded border px-3 py-2 text-sm"
                placeholder="(nullable)"
              />
              <WordFieldVoiceCell
                field="other_meanings_fa"
                audioKey={word.anki_link_id}
                text={word.other_meanings_fa}
              />
            </div>
          </InputRow>

          <InputRow label="other_meanings_en">
            <div className="grid gap-1">
              <div className="text-xs text-muted">
                Separate different English meanings with the <span className="font-mono">-</span> character.
              </div>
              <div className="flex items-center gap-2">
                <textarea
                  value={word.other_meanings_en ?? ""}
                  onChange={(e) =>
                    setWord((p) => ({
                      ...p,
                      other_meanings_en: asNullableString(e.target.value, { trim: false }),
                    }))
                  }
                  onFocus={registerFieldFocus("other_meanings_en")}
                  className="min-h-[84px] w-full rounded border px-3 py-2 text-sm"
                  placeholder="meaning one-meaning two (nullable)"
                />
                <WordFieldVoiceCell
                  field="other_meanings_en"
                  audioKey={word.anki_link_id}
                  text={word.other_meanings_en}
                />
              </div>
            </div>
          </InputRow>

          <InputRow label="concept_explained_fa">
            <div className="flex items-center gap-2">
              <textarea
                value={word.concept_explained_fa ?? ""}
                onChange={(e) => setWord((p) => ({ ...p, concept_explained_fa: asNullableString(e.target.value, { trim: false }) }))}
                onFocus={registerFieldFocus("concept_explained_fa")}
                className="min-h-[84px] w-full rounded border px-3 py-2 text-sm"
                placeholder="(nullable)"
              />
              <WordFieldVoiceCell
                field="concept_explained_fa"
                audioKey={word.anki_link_id}
                text={word.concept_explained_fa}
              />
            </div>
          </InputRow>
        </div>
      </div>

      <details className="rounded-2xl border border-card bg-background p-4">
        <summary className="cursor-pointer text-sm font-semibold">More fields</summary>
        <div className="mt-4 grid gap-4">
          <div className="grid gap-1">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-muted">json_hint (LongText) (read-only)</div>
              <JsonHintPreviewModal wordId={word.id} currentJsonHint={word.json_hint} />
            </div>
            <textarea
              value={word.json_hint ?? ""}
              readOnly
              className="min-h-[220px] w-full rounded border bg-black/5 px-3 py-2 font-mono text-xs dark:bg-white/10"
              placeholder="(nullable JSON)"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <InputRow label="phonetic_us_normalized (auto)">
              <input
                value={word.phonetic_us_normalized ?? ""}
                readOnly
                className="w-full rounded border bg-black/5 px-3 py-2 text-sm dark:bg-white/10"
                placeholder="(auto)"
              />
            </InputRow>

            <InputRow label="learning_depth">
              <input
                value={word.learning_depth == null ? "" : String(word.learning_depth)}
                onChange={(e) => setWord((p) => ({ ...p, learning_depth: asNullableNumber(e.target.value) }))}
                onFocus={registerFieldFocus("learning_depth")}
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
                onFocus={registerFieldFocus("imageability")}
                className="w-full rounded border px-3 py-2 text-sm"
                placeholder="(nullable number)"
              />
            </InputRow>

            <InputRow label="typeOfWordInDb">
              <input
                value={word.typeOfWordInDb}
                onChange={(e) => setWord((p) => ({ ...p, typeOfWordInDb: e.target.value }))}
                onFocus={registerFieldFocus("typeOfWordInDb")}
                className="w-full rounded border px-3 py-2 text-sm"
              />
            </InputRow>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <InputRow label="category">
              <input
                value={word.category ?? ""}
                onChange={(e) => setWord((p) => ({ ...p, category: asNullableString(e.target.value) }))}
                onFocus={registerFieldFocus("category")}
                className="w-full rounded border px-3 py-2 text-sm"
                placeholder="(nullable)"
              />
            </InputRow>

            <InputRow label="mixed_sentence">
              <input
                value={word.mixed_sentence ?? ""}
                onChange={(e) => setWord((p) => ({ ...p, mixed_sentence: asNullableString(e.target.value, { trim: false }) }))}
                onFocus={registerFieldFocus("mixed_sentence")}
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
                onFocus={registerFieldFocus("hint_sentence")}
                className="min-h-[84px] w-full rounded border px-3 py-2 text-sm"
                placeholder="(nullable)"
              />
            </InputRow>

            <InputRow label="word_hint_story">
              <textarea
                value={word.word_hint_story ?? ""}
                onChange={(e) => setWord((p) => ({ ...p, word_hint_story: asNullableString(e.target.value, { trim: false }) }))}
                onFocus={registerFieldFocus("word_hint_story")}
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
                onFocus={registerFieldFocus("concept_explained")}
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
                onFocus={registerFieldFocus("explanation_for_sentence_meaning")}
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
                onFocus={registerFieldFocus("first_letter_en_hint")}
                className="min-h-[84px] w-full rounded border px-3 py-2 text-sm"
                placeholder="(nullable)"
              />
            </InputRow>

            <InputRow label="first_letter_fa_hint">
              <textarea
                value={word.first_letter_fa_hint ?? ""}
                onChange={(e) => setWord((p) => ({ ...p, first_letter_fa_hint: asNullableString(e.target.value, { trim: false }) }))}
                onFocus={registerFieldFocus("first_letter_fa_hint")}
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
                onFocus={registerFieldFocus("hint_to_select")}
                className="w-full rounded border px-3 py-2 text-sm"
                placeholder="(nullable)"
              />
            </InputRow>

            <InputRow label="common_error">
              <input
                value={word.common_error ?? ""}
                onChange={(e) => setWord((p) => ({ ...p, common_error: asNullableString(e.target.value, { trim: false }) }))}
                onFocus={registerFieldFocus("common_error")}
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
                onFocus={registerFieldFocus("word_note")}
                className="min-h-[84px] w-full rounded border px-3 py-2 text-sm"
                placeholder="(nullable)"
              />
            </InputRow>
          </div>
        </div>
      </details>
    </div>
  );
}
