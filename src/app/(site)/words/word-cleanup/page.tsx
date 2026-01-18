"use client";

import { useMemo, useState } from "react";

import { PageHeader } from "@/components/page-header";

type MissingNote = {
  noteId: number;
  modelName: string;
  anki_link_id: string;
  base_form: string;
  meaning_fa: string;
};

export default function WordCleanupPage() {
  const [query, setQuery] = useState<string>("");
  const [limitText, setLimitText] = useState("5000");

  const limit = useMemo(() => {
    const trimmed = limitText.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return null;
    return Math.max(1, Math.trunc(n));
  }, [limitText]);

  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<MissingNote[] | null>(null);
  const missingIdsText = useMemo(() => (missing ? missing.map((m) => m.anki_link_id).join("\n") : ""), [missing]);

  async function onFetch() {
    setError(null);
    setMissing(null);
    setBusy(true);
    try {
      const res = await fetch("/api/word/anki-missing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: query.trim() || undefined, limit }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; missing?: MissingNote[] };
      if (!res.ok) throw new Error(json.error ?? `Fetch failed (${res.status})`);
      setMissing(Array.isArray(json.missing) ? json.missing : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteAllFromAnki() {
    if (!missing?.length) return;
    const ok = window.confirm(`Delete ${missing.length} note(s) from Anki? This cannot be undone.`);
    if (!ok) return;

    setError(null);
    setDeleting(true);
    try {
      const noteIds = missing.map((m) => m.noteId);
      const res = await fetch("/api/word/anki-missing/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ noteIds }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; deleted?: number };
      if (!res.ok) throw new Error(json.error ?? `Delete failed (${res.status})`);
      await onFetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleting(false);
    }
  }

  async function copyMissingIds() {
    if (!missingIdsText) return;
    await navigator.clipboard.writeText(missingIdsText);
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Anki Notes Missing in DB (Word)"
        subtitle="Reads notes from AnkiConnect and lists those whose `anki_link_id` does not exist in the `Word` table."
      />

      <div className="grid gap-3 rounded-2xl border border-card bg-card p-6 shadow-elevated">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-muted">Missing: {missing?.length ?? 0}</div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onFetch}
              disabled={busy || deleting || limit === null}
              className="inline-flex items-center justify-center rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] shadow-elevated transition disabled:opacity-60"
            >
              {busy ? "Loading…" : "Fetch"}
            </button>
            <button
              type="button"
              onClick={copyMissingIds}
              disabled={busy || deleting || !missing?.length}
              className="inline-flex items-center justify-center rounded-xl border border-card bg-background px-4 py-2 text-sm font-semibold text-foreground shadow-elevated transition disabled:opacity-60"
            >
              Copy IDs
            </button>
            <button
              type="button"
              onClick={onDeleteAllFromAnki}
              disabled={busy || deleting || !missing?.length}
              className="inline-flex items-center justify-center rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-elevated transition disabled:opacity-60"
              title="Deletes these notes from Anki via AnkiConnect"
            >
              {deleting ? "Deleting…" : `Delete from Anki (${missing?.length ?? 0})`}
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="grid gap-2">
            <div className="text-xs font-semibold text-neutral-700">Anki query (optional)</div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-10 w-full rounded-xl border border-card bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-neutral-400"
              placeholder='Default: note:"Meta-LEX-vR9" deck:"TempFor1WordsForNewStudy"'
            />
          </div>
          <div className="grid gap-2">
            <div className="text-xs font-semibold text-neutral-700">Limit</div>
            <input
              value={limitText}
              onChange={(e) => setLimitText(e.target.value)}
              className="h-10 w-full rounded-xl border border-card bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-neutral-400"
              placeholder="5000"
              inputMode="numeric"
            />
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</div>
        ) : null}
      </div>

      {missing ? (
        <div className="overflow-hidden rounded-2xl border border-card bg-card shadow-elevated">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-card bg-background px-4 py-3">
            <div className="text-sm font-semibold text-foreground">Missing notes</div>
            <div className="text-xs text-muted">{missing.length} row(s)</div>
          </div>
          <div className="overflow-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b border-card">
                  <th className="whitespace-nowrap px-3 py-2 font-semibold text-neutral-700">anki_link_id</th>
                  <th className="whitespace-nowrap px-3 py-2 font-semibold text-neutral-700">base_form</th>
                  <th className="whitespace-nowrap px-3 py-2 font-semibold text-neutral-700">meaning_fa</th>
                  <th className="whitespace-nowrap px-3 py-2 font-semibold text-neutral-700">noteId</th>
                  <th className="whitespace-nowrap px-3 py-2 font-semibold text-neutral-700">modelName</th>
                </tr>
              </thead>
              <tbody>
                {missing.map((m) => (
                  <tr key={`${m.noteId}-${m.anki_link_id}`} className="border-b border-card bg-red-50">
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-neutral-800">{m.anki_link_id}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-neutral-900">{m.base_form}</td>
                    <td className="max-w-[420px] truncate px-3 py-2 text-neutral-900" title={m.meaning_fa}>
                      {m.meaning_fa}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-neutral-700">{m.noteId}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-neutral-700">{m.modelName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
