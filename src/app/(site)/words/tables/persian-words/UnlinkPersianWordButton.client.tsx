"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ModalPortal } from "@/components/modal-portal";

type WordReference = {
  id: number;
  base_form: string;
  roles: Array<"primary" | "secondary">;
};

export default function UnlinkPersianWordButton({ id, label, referenceCount }: { id: number; label: string; referenceCount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [references, setReferences] = useState<WordReference[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function openConfirmation() {
    if (busy || referenceCount === 0) return;
    setOpen(true);
    setBusy(true);
    setReferences([]);
    setError(null);
    try {
      const response = await fetch(`/api/words/persian-words/${id}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; references?: WordReference[]; error?: string } | null;
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Could not load PersianWord links.");
      const currentReferences = Array.isArray(payload.references) ? payload.references : [];
      setReferences(currentReferences);
      if (!currentReferences.length) router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    if (busy || !references.length) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/words/persian-words/${id}/unlink`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedPrimaryWordSenseIds: references.filter((reference) => reference.roles.includes("primary")).map((reference) => reference.id),
          expectedSecondaryWordSenseIds: references.filter((reference) => reference.roles.includes("secondary")).map((reference) => reference.id),
        }),
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Could not unlink PersianWord.");
      setOpen(false);
      setReferences([]);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  const primaryCount = references.filter((reference) => reference.roles.includes("primary")).length;
  const secondaryCount = references.filter((reference) => reference.roles.includes("secondary")).length;

  return <>
    <button
      type="button"
      onClick={() => void openConfirmation()}
      disabled={busy || referenceCount === 0}
      className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-40 dark:text-amber-300"
      title={referenceCount ? `Unlink from ${referenceCount} WordSense record(s)` : "This PersianWord is already unlinked"}
    >
      {busy && !open ? "…" : "Unlink"}
    </button>

    {open ? <ModalPortal><div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-labelledby={`unlink-persian-word-${id}`} onMouseDown={(event) => event.target === event.currentTarget && !busy && setOpen(false)}>
      <div className="flex max-h-[min(90dvh,48rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-amber-500/30 bg-background shadow-elevated">
        <div className="flex items-center justify-between gap-3 border-b border-card px-4 py-3 sm:px-6">
          <div>
            <h2 id={`unlink-persian-word-${id}`} className="text-lg font-bold">Unlink PersianWord #{id}</h2>
            <div className="text-sm opacity-75" dir="rtl">{label}</div>
          </div>
          <button type="button" disabled={busy} onClick={() => setOpen(false)} className="rounded border px-3 py-2 text-sm disabled:opacity-50">Close</button>
        </div>
        <div className="overflow-auto p-4 sm:p-6">
          {busy && !references.length ? <div className="rounded border p-4 text-sm opacity-75">Loading current links…</div> : null}
          {error ? <div className="mb-4 rounded border border-red-500/30 bg-red-600/10 p-3 text-sm text-red-700 dark:text-red-300">{error}</div> : null}
          {references.length ? <>
            <div className="rounded border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
              This removes this PersianWord from <strong>{references.length}</strong> WordSense record(s): <strong>{primaryCount}</strong> primary and <strong>{secondaryCount}</strong> secondary link(s).
              Primary links will become missing-primary records. No replacement meaning will be selected automatically.
            </div>
            <ul className="mt-4 max-h-64 space-y-1 overflow-auto rounded border p-3 font-mono text-xs">
              {references.map((reference) => <li key={reference.id}>#{reference.id} — {reference.base_form} <span className="opacity-70">({reference.roles.join(", ")})</span></li>)}
            </ul>
          </> : !busy ? <p className="text-sm opacity-75">No WordSense currently links to this PersianWord.</p> : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-card px-4 py-3 sm:px-6">
          <button type="button" disabled={busy} onClick={() => setOpen(false)} className="rounded border px-4 py-2 text-sm disabled:opacity-50">Cancel</button>
          <button type="button" disabled={busy || !references.length} onClick={() => void unlink()} className="rounded bg-amber-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {busy && references.length ? "Unlinking…" : references.length ? `Confirm Unlink (${references.length})` : "Confirm Unlink"}
          </button>
        </div>
      </div>
    </div></ModalPortal> : null}
  </>;
}
