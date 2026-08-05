"use client";

import { useCallback, useEffect, useRef, useState, type FocusEvent } from "react";
import { useRouter } from "next/navigation";

import { SpecialCharactersBar } from "@/components/ipa/SpecialCharactersBar";

import PersianWordAudioControls from "./PersianWordAudioControls.client";

const IPA_SPECIAL_CHARACTERS = ["æ", "ɪ", "ɜ", "ə", "ʊ", "ʌ", "ʔ", "ʧ", "ʤ", "ɑ", "ɔ", "ŋ", "θ", "ð", "ʃ", "ʒ", "ɡ"] as const;

type PersianWord = { id: number; canonical_text: string; normalized_text: string; not_normalized_texts: unknown; meaning_fa_IPA: string | null; meaning_fa_IPA_normalize: string | null; audio_file_name: string | null };
type WordReference = { id: number; base_form: string; roles: Array<"primary" | "secondary"> };

function stringArray(value: unknown): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : [];
}

export default function OpenPersianWordEditorModal({ id, label }: { id: number; label: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [item, setItem] = useState<PersianWord | null>(null);
  const [variants, setVariants] = useState("[]");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [references, setReferences] = useState<WordReference[]>([]);
  const lastFocusedInputRef = useRef<HTMLInputElement | null>(null);

  const close = useCallback(() => {
    if (dirty && !window.confirm("You have unsaved changes. Close without saving?")) return;
    setOpen(false);
  }, [dirty]);

  const openEditor = useCallback(() => {
    setOpen(true); setBusy(true); setError(null); setDirty(false); setItem(null);
  }, []);

  useEffect(() => {
    if (!open || !busy || item) return;
    const controller = new AbortController();
    fetch(`/api/words/persian-words/${id}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as { ok?: boolean; item?: PersianWord; references?: WordReference[]; error?: string } | null;
        if (!response.ok || !payload?.ok || !payload.item) throw new Error(payload?.error || "Could not load record.");
        setItem(payload.item);
        setReferences(Array.isArray(payload.references) ? payload.references : []);
        setVariants(JSON.stringify(stringArray(payload.item.not_normalized_texts), null, 2));
      })
      .catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : String(reason)); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [busy, id, item, open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && close();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close, open]);

  const update = <K extends keyof PersianWord>(key: K, value: PersianWord[K]) => {
    setItem((current) => current ? { ...current, [key]: value } : current);
    setDirty(true);
  };
  const registerIpaFocus = (event: FocusEvent<HTMLInputElement>) => { lastFocusedInputRef.current = event.currentTarget; };
  const insertSpecialChar = (character: string) => {
    const element = lastFocusedInputRef.current;
    if (!element) return;
    const start = element.selectionStart ?? element.value.length;
    const end = element.selectionEnd ?? element.value.length;
    const nextValue = element.value.slice(0, start) + character + element.value.slice(end);
    update("meaning_fa_IPA", nextValue);
    requestAnimationFrame(() => { element.focus(); element.setSelectionRange(start + character.length, start + character.length); });
  };

  const save = async (closeAfterSave = false) => {
    if (!item) return;
    let parsedVariants: unknown;
    try {
      parsedVariants = JSON.parse(variants);
      if (!Array.isArray(parsedVariants) || parsedVariants.some((value) => typeof value !== "string")) throw new Error();
    } catch { setError("Variants must be valid JSON: an array of strings."); return; }
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/words/persian-words/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...item, not_normalized_texts: parsedVariants }) });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; item?: PersianWord; error?: string } | null;
      if (!response.ok || !payload?.ok || !payload.item) throw new Error(payload?.error || "Could not save record.");
      setItem(payload.item); setVariants(JSON.stringify(stringArray(payload.item.not_normalized_texts), null, 2)); setDirty(false); router.refresh();
      if (closeAfterSave) setOpen(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } finally { setBusy(false); }
  };

  return <>
    <button type="button" onClick={openEditor} className="rounded border px-2 py-1 text-[11px] hover:bg-black/5 dark:hover:bg-white/5">Open</button>
    {open ? <div className="fixed inset-0 z-50 bg-black/45 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label={`Edit Persian word ${label}`} onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <div className="mx-auto flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-card bg-background shadow-elevated">
        <div className="flex items-center justify-between gap-3 border-b border-card px-4 py-3"><div className="min-w-0"><div className="truncate text-sm font-semibold">Edit PersianWord #{id} — {label}</div><div className="text-xs opacity-70">The normalized value is recalculated from canonical text when saved.</div></div><button type="button" onClick={close} className="rounded border px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5">Close</button></div>
        <div className="flex-1 overflow-auto p-4">
          {busy && !item ? <div className="rounded border p-4 text-sm opacity-75">Loading…</div> : null}
          {error ? <div className="mb-4 rounded border border-red-500/30 bg-red-600/10 p-3 text-sm text-red-700">{error}</div> : null}
          {item ? <div className="grid gap-4">
            <label className="grid gap-1 text-sm">Canonical text<input value={item.canonical_text} onChange={(event) => update("canonical_text", event.target.value)} dir="rtl" className="rounded border px-3 py-2 text-base" /></label>
            <label className="grid gap-1 text-sm">Normalized text <span className="rounded border bg-black/5 px-3 py-2 opacity-70" dir="rtl">{item.normalized_text}</span></label>
            <SpecialCharactersBar characters={IPA_SPECIAL_CHARACTERS} onPick={insertSpecialChar} title="Special characters" helpText="Click a field, then click a character." />
            <label className="grid gap-1 text-sm">Persian IPA<input value={item.meaning_fa_IPA ?? ""} onChange={(event) => update("meaning_fa_IPA", event.target.value || null)} onFocus={registerIpaFocus} className="rounded border px-3 py-2" /></label>
            <label className="grid gap-1 text-sm">Normalized Persian IPA <span className="rounded border bg-black/5 px-3 py-2 opacity-70">{item.meaning_fa_IPA_normalize ?? "—"}</span></label>
            <section className="rounded border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
              <div className="font-semibold">Affected Word records ({references.length})</div>
              <p className="mt-1 text-xs opacity-80">Saving text, IPA, or audio here updates the sync timestamp of every listed Word.</p>
              {references.length ? <ul className="mt-2 max-h-36 space-y-1 overflow-auto font-mono text-xs">{references.map((reference) => <li key={reference.id}>#{reference.id} — {reference.base_form} <span className="opacity-70">({reference.roles.join(", ")})</span></li>)}</ul> : <p className="mt-2 text-xs opacity-70">No Word is currently linked to this PersianWord.</p>}
            </section>
            <div className="flex flex-wrap items-end gap-2"><label className="grid flex-1 gap-1 text-sm">Audio file name <span className="rounded border bg-black/5 px-3 py-2 font-mono text-xs opacity-70">{item.audio_file_name ?? "—"}</span></label><PersianWordAudioControls id={id} filename={item.audio_file_name} onFilenameChange={(filename) => setItem((current) => current ? { ...current, audio_file_name: filename } : current)} /></div>
            <label className="grid gap-1 text-sm">Original variants (JSON array)<textarea value={variants} onChange={(event) => { setVariants(event.target.value); setDirty(true); }} rows={6} className="rounded border px-3 py-2 font-mono text-xs" /></label>
            <div className="flex justify-end gap-2"><button type="button" disabled={busy || !dirty} onClick={() => void save()} className="rounded border px-4 py-2 text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5">{busy ? "Saving…" : "Save"}</button><button type="button" disabled={busy || !dirty} onClick={() => void save(true)} className="rounded border px-4 py-2 text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5">{busy ? "Saving…" : "Save & Close"}</button></div>
          </div> : null}
        </div>
      </div>
    </div> : null}
  </>;
}
