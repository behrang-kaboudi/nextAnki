"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import WordFieldVoiceCell from "@/app/(site)/words/hints/WordFieldVoiceCell.client";
import { ActionIcon } from "@/components/icons/ActionIcon";

export type SentenceEditorItem = {
  id: number;
  sentence_en: string;
  sentence_en_meaning_fa: string | null;
  words: Array<{
    id: number;
    anki_link_id: string;
    base_form: string;
    meaning_fa: string;
    isPrimary: boolean;
  }>;
  createdAt: string;
  updatedAt: string;
};

function nullableText(value: string) {
  return value.trim().length ? value : null;
}

export default function SentenceEditorModal({ item, compact = false }: { item: SentenceEditorItem; compact?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sentenceEn, setSentenceEn] = useState(item.sentence_en);
  const [sentenceMeaning, setSentenceMeaning] = useState(item.sentence_en_meaning_fa ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const audioUpdatedFieldsRef = useRef(new Set<"sentence_en" | "sentence_en_meaning_fa">());

  const dirty = sentenceEn !== item.sentence_en || sentenceMeaning !== (item.sentence_en_meaning_fa ?? "");
  const requiredOk = sentenceEn.trim().length > 0;
  const audioKey = String(item.id);

  const linkedWordsText = useMemo(() => {
    if (!item.words.length) return "No linked words";
    return item.words
      .map((word) => `${word.base_form} (${word.meaning_fa})${word.isPrimary ? " primary" : ""}`)
      .join(" / ");
  }, [item.words]);

  const close = useCallback(() => {
    if (dirty && !window.confirm("You have unsaved changes. Close without saving?")) return;
    setOpen(false);
  }, [dirty]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close, open]);

  useEffect(() => {
    if (!open) return;
    const onAudioUpdated = (evt: Event) => {
      const detail = (evt as CustomEvent<{ audioKey?: unknown; field?: unknown }>).detail;
      if (detail?.audioKey !== audioKey) return;
      if (detail.field === "sentence_en" || detail.field === "sentence_en_meaning_fa") {
        audioUpdatedFieldsRef.current.add(detail.field);
      }
    };
    window.addEventListener("wordFieldVoice:updated", onAudioUpdated);
    return () => window.removeEventListener("wordFieldVoice:updated", onAudioUpdated);
  }, [audioKey, open]);

  async function save() {
    if (!dirty || !requiredOk || saving) return;
    setSaving(true);
    setError(null);
    setSavedAt(null);
    try {
      const res = await fetch("/api/sentences/editor/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          data: {
            sentence_en: sentenceEn,
            sentence_en_meaning_fa: nullableText(sentenceMeaning),
          },
        }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || json?.ok !== true) throw new Error(json?.error || `Request failed (${res.status})`);

      const changedAudioFields: Array<"sentence_en" | "sentence_en_meaning_fa"> = [];
      if (sentenceEn.trim() !== item.sentence_en.trim()) changedAudioFields.push("sentence_en");
      if (sentenceMeaning.trim() !== (item.sentence_en_meaning_fa ?? "").trim()) {
        changedAudioFields.push("sentence_en_meaning_fa");
      }

      await Promise.all(
        changedAudioFields
          .filter((field) => !audioUpdatedFieldsRef.current.has(field))
          .map(async (field) => {
            const delRes = await fetch("/api/words/field-voice-delete-all", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ audioKey, field }),
            });
            const delJson = (await delRes.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
            if (!delRes.ok || delJson?.ok !== true) {
              throw new Error(delJson?.error || `Audio delete failed (${delRes.status}) for ${field}`);
            }
            window.dispatchEvent(new CustomEvent("wordFieldVoice:updated", { detail: { audioKey, field } }));
          }),
      );

      audioUpdatedFieldsRef.current.clear();
      setSavedAt(new Date().toISOString());
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setSentenceEn(item.sentence_en);
          setSentenceMeaning(item.sentence_en_meaning_fa ?? "");
          setError(null);
          setSavedAt(null);
          setOpen(true);
        }}
        aria-label={`Edit sentence ${item.id}`}
        title={`Edit sentence ${item.id}`}
        className={compact
          ? "rounded border p-1.5 transition active:scale-90 hover:bg-black/5 dark:hover:bg-white/5"
          : "rounded border px-2 py-1 text-[11px] hover:bg-black/5 dark:hover:bg-white/5"}
      >
        {compact ? <ActionIcon name="edit" /> : "Open"}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 bg-black/45 p-3 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`Edit sentence ${item.id}`}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-card bg-background shadow-elevated">
            <div className="flex items-center justify-between gap-3 border-b border-card px-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">Edit Sentence #{item.id}</div>
                <div className="truncate text-xs opacity-70" title={linkedWordsText}>
                  {linkedWordsText}
                </div>
              </div>
              <button
                type="button"
                onClick={close}
                className="rounded border px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4">
              <div className="grid gap-4">
                <div className="rounded-2xl border border-card bg-background p-4">
                  <div className="grid gap-2 text-xs opacity-75">
                    <div className="font-mono">id: {item.id}</div>
                    <div className="font-mono">createdAt: {item.createdAt}</div>
                    <div className="font-mono">updatedAt: {item.updatedAt}</div>
                  </div>
                </div>

                <div className="grid gap-4 rounded-2xl border border-card bg-background p-4">
                  <div className="text-sm font-semibold">Sentence fields</div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="grid gap-1">
                      <span className="text-xs font-semibold text-muted">sentence_en</span>
                      <div className="flex items-center gap-2">
                        <textarea
                          value={sentenceEn}
                          onChange={(e) => setSentenceEn(e.target.value)}
                          className="min-h-[120px] w-full rounded border px-3 py-2 text-sm"
                        />
                        <WordFieldVoiceCell field="sentence_en" audioKey={audioKey} text={sentenceEn} />
                      </div>
                    </label>

                    <label className="grid gap-1">
                      <span className="text-xs font-semibold text-muted">sentence_en_meaning_fa</span>
                      <div className="flex items-center gap-2">
                        <textarea
                          value={sentenceMeaning}
                          onChange={(e) => setSentenceMeaning(e.target.value)}
                          className="min-h-[120px] w-full rounded border px-3 py-2 text-sm"
                          placeholder="(nullable)"
                        />
                        <WordFieldVoiceCell field="sentence_en_meaning_fa" audioKey={audioKey} text={sentenceMeaning} />
                      </div>
                    </label>
                  </div>
                </div>

                {error ? (
                  <div className="rounded border border-red-500/30 bg-red-600/10 p-3 text-sm text-red-700">
                    {error}
                  </div>
                ) : null}
                {savedAt ? <div className="text-xs opacity-70">Saved at {savedAt}</div> : null}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-card px-4 py-3">
              <div className="text-xs opacity-70">
                {saving ? "Saving..." : dirty ? (requiredOk ? "Unsaved changes" : "sentence_en is required") : "Saved"}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSentenceEn(item.sentence_en);
                    setSentenceMeaning(item.sentence_en_meaning_fa ?? "");
                  }}
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
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
