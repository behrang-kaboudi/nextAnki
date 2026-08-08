"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { getEnglishWordAudioPublicPath } from "@/lib/audio/englishWordAudioNaming";
import { ModalPortal } from "@/components/modal-portal";

export type EnglishWord = {
  id: number;
  base_form: string;
  phonetic_us: string | null;
  phonetic_us_confirmed: boolean;
  phonetic_us_normalized: string | null;
  json_hint: string | null;
  audio_file_name: string | null;
};

export default function EnglishWordRowActions({ item: initialItem, showAudio = true, showActions = true, showDelete = true, editTrigger, editTriggerClassName }: { item: EnglishWord; showAudio?: boolean; showActions?: boolean; showDelete?: boolean; editTrigger?: ReactNode; editTriggerClassName?: string }) {
  const router = useRouter();
  const [item, setItem] = useState(initialItem);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = async (url: string, init?: RequestInit) => {
    const response = await fetch(url, init);
    const payload = (await response.json().catch(() => null)) as { ok?: boolean; item?: EnglishWord; filename?: string; error?: string } | null;
    if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Request failed.");
    return payload;
  };
  const save = async () => {
    setBusy(true); setError(null);
    try {
      const payload = await request(`/api/words/english-words/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(item) });
      if (!payload.item) throw new Error("No saved record returned.");
      setItem(payload.item); setOpen(false); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } finally { setBusy(false); }
  };
  const generateAudio = async () => {
    setBusy(true); setError(null);
    try { const payload = await request(`/api/words/english-words/${item.id}/audio/generate`, { method: "POST" }); setItem((current) => ({ ...current, audio_file_name: payload.filename ?? current.audio_file_name })); router.refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } finally { setBusy(false); }
  };
  const deleteAudio = async () => {
    if (!item.audio_file_name || !window.confirm("Delete this audio file?")) return;
    setBusy(true); setError(null);
    try { await request(`/api/words/english-words/${item.id}/audio/delete`, { method: "POST" }); setItem((current) => ({ ...current, audio_file_name: null })); router.refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!window.confirm(`Delete ${item.base_form}?`)) return;
    setBusy(true); setError(null);
    try { await request(`/api/words/english-words/${item.id}`, { method: "DELETE" }); router.refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } finally { setBusy(false); }
  };

  return <div className="flex flex-wrap items-center gap-1">
    {showAudio ? <>{item.audio_file_name ? <audio controls preload="none" className="h-7 max-w-36" src={getEnglishWordAudioPublicPath(item.audio_file_name)} /> : null}<button type="button" disabled={busy} onClick={() => void generateAudio()} className="rounded border px-2 py-1 text-[11px] disabled:opacity-50">Generate audio</button><button type="button" disabled={busy || !item.audio_file_name} onClick={() => void deleteAudio()} className="rounded border px-2 py-1 text-[11px] disabled:opacity-50">Delete audio</button></> : null}
    {showActions ? <><button type="button" disabled={busy} onClick={() => { setOpen(true); setError(null); }} className={editTriggerClassName ?? "rounded border px-2 py-1 text-[11px]"}>{editTrigger ?? "Edit"}</button>{showDelete ? <button type="button" disabled={busy} onClick={() => void remove()} className="rounded border px-2 py-1 text-[11px] text-red-700 disabled:opacity-50">Delete</button> : null}</> : null}
    {error ? <span className="max-w-48 truncate text-[11px] text-red-600" title={error}>{error}</span> : null}
    {open ? <ModalPortal><div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" onMouseDown={(event) => event.target === event.currentTarget && !busy && setOpen(false)}>
      <div className="flex h-[min(92dvh,54rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-card bg-background shadow-elevated">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-card bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
          <div><h2 className="text-base font-semibold">Edit EnglishWord #{item.id}</h2><p className="text-xs opacity-70">Edit EnglishWord fields without leaving the Word record.</p></div>
          <button type="button" disabled={busy} onClick={() => setOpen(false)} className="rounded border px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5">Close</button>
        </div>
        <div className="flex-1 overflow-auto p-4 sm:p-6"><div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">base_form<input value={item.base_form} onChange={(event) => setItem((current) => ({ ...current, base_form: event.target.value }))} className="rounded border px-3 py-2" /></label>
          <label className="grid gap-1 text-sm">phonetic_us<input value={item.phonetic_us ?? ""} onChange={(event) => setItem((current) => ({ ...current, phonetic_us: event.target.value || null }))} className="rounded border px-3 py-2" /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={item.phonetic_us_confirmed} onChange={(event) => setItem((current) => ({ ...current, phonetic_us_confirmed: event.target.checked }))} /> phonetic_us confirmed</label>
          <label className="grid gap-1 text-sm">phonetic_us_normalized <span className="rounded border bg-black/5 px-3 py-2 font-mono text-xs opacity-70">Recalculated when saved: {item.phonetic_us_normalized ?? "—"}</span></label>
          <label className="grid gap-1 text-sm sm:col-span-2">json_hint<textarea value={item.json_hint ?? ""} onChange={(event) => setItem((current) => ({ ...current, json_hint: event.target.value || null }))} rows={14} className="min-h-64 resize-y rounded border px-3 py-2 font-mono text-xs" /></label>
          <p className="text-xs opacity-70 sm:col-span-2">The English text is normalized on every save.</p>
          {error ? <p className="rounded border border-red-500/30 bg-red-600/10 p-3 text-sm text-red-700 sm:col-span-2">{error}</p> : null}
        </div></div>
        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-card bg-background/95 px-4 py-3 sm:px-6"><button type="button" disabled={busy} onClick={() => setOpen(false)} className="rounded border px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5">Cancel</button><button type="button" disabled={busy} onClick={() => void save()} className="rounded bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50">{busy ? "Saving…" : "Save"}</button></div>
      </div>
    </div></ModalPortal> : null}
  </div>;
}
