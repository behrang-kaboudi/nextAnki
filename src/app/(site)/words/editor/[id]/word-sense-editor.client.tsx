"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import WordFieldVoiceCell from "@/app/(site)/words/hints/WordFieldVoiceCell.client";
import SentenceEditorModal from "@/app/(site)/sentences/editor/SentenceEditorModal.client";
import EnglishWordRowActions from "@/app/(site)/words/tables/english-words/EnglishWordRowActions.client";
import OpenPersianWordEditorModal from "@/app/(site)/words/tables/persian-words/OpenPersianWordEditorModal.client";

const WORD_AUDIO_FIELDS = [
  "concept_explained_fa",
] as const;

export type WordEditorState = {
  id: number;
  anki_link_id: string;
  englishId: number;
  sentenceIds: number[];
  conceptMergeReviewed: boolean;
  meaningId: number | null;
  otherMeaningIds: number[];
  comparedMeaningWordIds: number[];
  synonymIds: number[];
  meanings_confirmed: boolean;
  english: {
    id: number;
    base_form: string;
    phonetic_us: string | null;
    phonetic_us_normalized: string | null;
    json_hint: string | null;
    audio_file_name: string | null;
  };
  meaningLabel: string | null;
  sentence: {
    id: number;
    sentence_en: string;
    sentence_en_meaning_fa: string | null;
    sentence_en_audio_file_name: string | null;
    sentence_en_meaning_fa_audio_file_name: string | null;
    createdAt: string;
    updatedAt: string;
  } | null;
  pos: string | null;
  concept_explained_fa: string | null;
  concept_explained_fa_audio_file_name: string | null;
  learning_depth: number | null;
  other_meanings_en: string | null;
  category: string | null;
  hint_to_select: string | null;
  imageability: number | null;
  productive_target: number | null;

  createdAt: string;
  updatedAt: string;
};

function InputRow({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 grid content-start gap-1 ${className}`}>
      <div className="text-xs font-semibold text-muted">{label}</div>
      {children}
    </div>
  );
}

const relationCardClass =
  "min-w-0 rounded-xl border border-card bg-background px-3 py-2.5 text-left shadow-sm";
const relationButtonClass = `${relationCardClass} w-full transition hover:border-foreground/30 hover:bg-black/[0.03] active:scale-[0.98] dark:hover:bg-white/[0.04]`;

function RelationCardContent({
  label,
  value,
  detail,
  editable = false,
}: {
  label: string;
  value: string;
  detail?: string;
  editable?: boolean;
}) {
  return (
    <span className="block min-w-0">
      <span className="flex items-center justify-between gap-2 text-xs font-semibold text-muted">
        {label}
        {editable ? <span className="text-[10px] font-medium text-foreground/60">Edit ↗</span> : null}
      </span>
      <span className="mt-1 block truncate font-mono text-base font-semibold" title={value}>
        {value}
      </span>
      {detail ? (
        <span className="mt-0.5 block truncate text-[11px] opacity-60" title={detail}>
          {detail}
        </span>
      ) : null}
    </span>
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

function parseIdList(raw: string): number[] | null {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  try {
    const values = trimmed.startsWith("[")
      ? (JSON.parse(trimmed) as unknown)
      : trimmed.split(/[\s,]+/).filter(Boolean).map(Number);
    if (
      !Array.isArray(values) ||
      !values.every(
        (value) => typeof value === "number" && Number.isInteger(value) && value > 0,
      ) ||
      new Set(values).size !== values.length
    ) {
      return null;
    }
    return values;
  } catch {
    return null;
  }
}

function IdListInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number[];
  onChange: (value: number[]) => void;
}) {
  const [draft, setDraft] = useState(() => value.join(", "));
  const parsed = useMemo(() => parseIdList(draft), [draft]);

  useEffect(() => {
    setDraft(value.join(", "));
  }, [value]);

  return (
    <InputRow label={label}>
      <input
        value={draft}
        onChange={(event) => {
          const nextDraft = event.target.value;
          setDraft(nextDraft);
          const nextValue = parseIdList(nextDraft);
          if (nextValue) onChange(nextValue);
        }}
        aria-invalid={parsed === null}
        className="w-full rounded border px-3 py-2 font-mono text-sm aria-invalid:border-red-500"
        placeholder="1, 2, 3 (empty array allowed)"
      />
      {parsed === null ? (
        <div className="text-xs text-red-600">
          Use unique positive integer IDs separated by commas, or a JSON array.
        </div>
      ) : null}
    </InputRow>
  );
}

export default function WordEditorClient({
  initial,
  floatingActions = true,
  onDirtyChange,
  onSaved,
  onSaveAndClose,
}: {
  initial: WordEditorState;
  floatingActions?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onSaved?: (id: number) => void;
  onSaveAndClose?: () => void;
}) {
  type SaveOptions = { force?: boolean; audioUpdatedField?: (typeof WORD_AUDIO_FIELDS)[number]; closeAfterSave?: boolean };

  const [baseline, setBaseline] = useState<WordEditorState>(initial);
  const [word, setWord] = useState<WordEditorState>(initial);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const pendingAudioSaveRef = useRef<{ field?: (typeof WORD_AUDIO_FIELDS)[number] } | null>(null);
  const saveRef = useRef<((opts?: SaveOptions) => Promise<void>) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const lastUrlRef = useRef<string>("");

  const dirty = useMemo(() => JSON.stringify(word) !== JSON.stringify(baseline), [word, baseline]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  function normalizeAudioText(value: string | null | undefined) {
    return String(value ?? "").trim();
  }

  async function save(opts?: SaveOptions) {
    if (savingRef.current) {
      if (opts?.force) pendingAudioSaveRef.current = { field: opts.audioUpdatedField };
      return;
    }
    if (!opts?.force && !dirty) return;

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
            pos: word.pos,
            concept_explained_fa: word.concept_explained_fa,
            learning_depth: word.learning_depth,
            other_meanings_en: word.other_meanings_en,
            category: word.category,
            hint_to_select: word.hint_to_select,
            imageability: word.imageability,
            productive_target: word.productive_target,
            sentenceIds: word.sentenceIds,
            otherMeaningIds: word.otherMeaningIds,
            comparedMeaningWordIds: word.comparedMeaningWordIds,
            synonymIds: word.synonymIds,
            meanings_confirmed: word.meanings_confirmed,
            conceptMergeReviewed: word.conceptMergeReviewed,
          },
        }),
      });
      const json = (await res.json().catch(() => null)) as
        | {
            ok?: boolean;
            item?: WordEditorState | null;
            error?: string;
          }
        | null;
      if (!res.ok || json?.ok !== true) throw new Error(json?.error || `Request failed (${res.status})`);
      const savedWord = json.item;

      if (savedWord) {
        setWord(savedWord);
        setBaseline(savedWord);
      } else {
        setBaseline(word);
      }

      if (audioFieldsToDelete.length) {
        const results = await Promise.allSettled(
          audioFieldsToDelete.map(async (field) => {
            const audioKey = String(word.id);
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
      if (opts?.closeAfterSave) onSaveAndClose?.();
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
      const expectedAudioKey = String(word.id);
      if (!expectedAudioKey || detail.audioKey !== expectedAudioKey) return;
      void saveRef.current?.({ force: true, audioUpdatedField: field as SaveOptions["audioUpdatedField"] });
    };

    window.addEventListener("wordFieldVoice:updated", onAudioUpdated);
    return () => window.removeEventListener("wordFieldVoice:updated", onAudioUpdated);
  }, [word.id]);

  const statusText = saving
    ? "Saving…"
    : dirty
      ? "Unsaved changes"
      : "Saved";

  const statusMetaText = saving
    ? null
    : dirty
      ? null
      : `updatedAt: ${word.updatedAt}`;

  return (
    <div className={`grid gap-3 ${floatingActions ? "pb-24" : "pb-2"}`}>
      <div className="sticky top-0 z-10 rounded-2xl border border-card bg-background/95 p-3 shadow-sm backdrop-blur sm:p-4">
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
            <div className={relationCardClass}>
              <RelationCardContent label="WordSense id" value={String(word.id)} detail="Current WordSense record" />
            </div>
            <div className={relationCardClass}>
              <RelationCardContent label="anki_link_id" value={word.anki_link_id} detail="External Anki identity" />
            </div>
            <EnglishWordRowActions
              item={word.english}
              showAudio={false}
              showDelete={false}
              editTriggerClassName={relationButtonClass}
              editTrigger={<RelationCardContent label="englishId" value={String(word.englishId)} detail={word.english.base_form} editable />}
            />
            {word.meaningId ? (
              <OpenPersianWordEditorModal
                id={word.meaningId}
                label={word.meaningLabel ?? `PersianWord ${word.meaningId}`}
                triggerClassName={relationButtonClass}
                trigger={<RelationCardContent label="meaningId" value={String(word.meaningId)} detail={word.meaningLabel ?? "PersianWord"} editable />}
              />
            ) : (
              <div className={`${relationCardClass} opacity-60`}>
                <RelationCardContent label="meaningId" value="—" detail="No linked PersianWord" />
              </div>
            )}
            <div className={relationCardClass}>
              <RelationCardContent
                label="sentenceIds[0]"
                value={word.sentenceIds[0] == null ? "—" : String(word.sentenceIds[0])}
                detail={word.sentence?.sentence_en ?? "No primary sentence"}
              />
              {word.sentence ? <div className="mt-2"><SentenceEditorModal item={word.sentence} /></div> : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-card pt-3">
            <div className="min-w-0 truncate font-mono text-[10px] opacity-60" title={`createdAt: ${word.createdAt} • updatedAt: ${word.updatedAt}`}>
              updatedAt: {word.updatedAt}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
            <span className={`text-xs ${dirty ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}`}>
              {statusText}
            </span>
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
              disabled={saving || !dirty}
              className="rounded bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            {onSaveAndClose ? <button
              type="button"
              onClick={() => void save({ closeAfterSave: true })}
              disabled={saving || !dirty}
              className="rounded bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save & Close"}
            </button> : null}
            </div>
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
            disabled={saving || !dirty}
            className="rounded-xl bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          {onSaveAndClose ? <button
            type="button"
            onClick={() => void save({ closeAfterSave: true })}
            disabled={saving || !dirty}
            className="rounded-xl bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save & Close"}
          </button> : null}
        </div>
      ) : null}

      <section className="grid gap-4 rounded-2xl border border-card bg-background p-3 sm:p-4">
        <div>
          <h2 className="text-sm font-semibold">Short fields</h2>
          <p className="mt-1 text-xs text-muted">Compact values share one row when space allows.</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
          <InputRow label="pos">
            <input value={word.pos ?? ""} onChange={(e) => setWord((p) => ({ ...p, pos: asNullableString(e.target.value) }))} className="w-full rounded border px-2.5 py-2 text-sm" placeholder="nullable" />
          </InputRow>
          <InputRow label="category">
            <input value={word.category ?? ""} onChange={(e) => setWord((p) => ({ ...p, category: asNullableString(e.target.value) }))} className="w-full rounded border px-2.5 py-2 text-sm" placeholder="nullable" />
          </InputRow>
          <InputRow label="learning_depth">
            <input type="number" step="any" value={word.learning_depth == null ? "" : String(word.learning_depth)} onChange={(e) => setWord((p) => ({ ...p, learning_depth: asNullableNumber(e.target.value) }))} className="w-full rounded border px-2.5 py-2 text-sm" placeholder="number" />
          </InputRow>
          <InputRow label="imageability (0–100)">
            <input type="number" min={0} max={100} step={1} value={word.imageability == null ? "" : String(word.imageability)} onChange={(e) => setWord((p) => ({ ...p, imageability: asNullableNumber(e.target.value) }))} className="w-full rounded border px-2.5 py-2 text-sm" placeholder="number" />
          </InputRow>
          <InputRow label="productive_target (0–101)">
            <input type="number" min={0} max={101} step={1} value={word.productive_target == null ? "" : String(word.productive_target)} onChange={(e) => setWord((p) => ({ ...p, productive_target: asNullableNumber(e.target.value) }))} className="w-full rounded border px-2.5 py-2 text-sm" placeholder="integer" />
          </InputRow>
          <InputRow label="meanings_confirmed">
            <label className="flex h-10 items-center gap-2 rounded border px-2.5 text-xs">
              <input type="checkbox" checked={word.meanings_confirmed} onChange={(e) => setWord((p) => ({ ...p, meanings_confirmed: e.target.checked }))} />
              <span>{word.meanings_confirmed ? "Confirmed" : "Not confirmed"}</span>
            </label>
          </InputRow>
          <InputRow label="conceptMergeReviewed">
            <label className="flex h-10 items-center gap-2 rounded border px-2.5 text-xs">
              <input type="checkbox" checked={word.conceptMergeReviewed} onChange={(e) => setWord((p) => ({ ...p, conceptMergeReviewed: e.target.checked }))} />
              <span>{word.conceptMergeReviewed ? "Reviewed" : "Pending"}</span>
            </label>
          </InputRow>
        </div>
      </section>

      <section className="grid gap-4 rounded-2xl border border-card bg-background p-3 sm:p-4">
        <div>
          <h2 className="text-sm font-semibold">Text fields</h2>
          <p className="mt-1 text-xs text-muted">Longer content keeps a wider editing area.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <InputRow label="other_meanings_en">
            <textarea value={word.other_meanings_en ?? ""} onChange={(e) => setWord((p) => ({ ...p, other_meanings_en: asNullableString(e.target.value, { trim: false }) }))} className="min-h-28 w-full resize-y rounded border px-3 py-2 text-sm" placeholder="nullable" />
          </InputRow>
          <InputRow label="concept_explained_fa">
            <div className="flex items-start gap-2">
              <textarea dir="rtl" value={word.concept_explained_fa ?? ""} onChange={(e) => setWord((p) => ({ ...p, concept_explained_fa: asNullableString(e.target.value, { trim: false }), conceptMergeReviewed: false }))} className="min-h-28 w-full resize-y rounded border px-3 py-2 text-sm" placeholder="nullable" />
              <WordFieldVoiceCell field="concept_explained_fa" audioKey={String(word.id)} text={word.concept_explained_fa} />
            </div>
          </InputRow>
          <InputRow label="hint_to_select" className="lg:col-span-2">
            <textarea value={word.hint_to_select ?? ""} onChange={(e) => setWord((p) => ({ ...p, hint_to_select: asNullableString(e.target.value, { trim: false }) }))} className="min-h-20 w-full resize-y rounded border px-3 py-2 text-sm" placeholder="nullable" />
          </InputRow>
        </div>
      </section>

      <section className="grid gap-4 rounded-2xl border border-card bg-background p-3 sm:p-4">
        <div>
          <h2 className="text-sm font-semibold">ID collections</h2>
          <p className="mt-1 text-xs text-muted">Enter comma-separated positive IDs or a JSON array.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <IdListInput label="otherMeaningIds" value={word.otherMeaningIds} onChange={(otherMeaningIds) => setWord((p) => ({ ...p, otherMeaningIds, meanings_confirmed: false, conceptMergeReviewed: false }))} />
          <IdListInput label="sentenceIds" value={word.sentenceIds} onChange={(sentenceIds) => setWord((p) => ({ ...p, sentenceIds, meanings_confirmed: false }))} />
          <IdListInput label="comparedMeaningWordIds" value={word.comparedMeaningWordIds} onChange={(comparedMeaningWordIds) => setWord((p) => ({ ...p, comparedMeaningWordIds }))} />
          <IdListInput label="synonymIds" value={word.synonymIds} onChange={(synonymIds) => setWord((p) => ({ ...p, synonymIds }))} />
        </div>
      </section>
    </div>
  );
}
