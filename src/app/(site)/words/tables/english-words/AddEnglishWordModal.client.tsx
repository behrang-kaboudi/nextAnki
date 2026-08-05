"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddEnglishWordModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const response = await fetch("/api/words/english-words", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Could not add EnglishWord.");
      setText(""); setOpen(false); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } finally { setBusy(false); }
  };

  return <>
    <button type="button" onClick={() => setOpen(true)} className="rounded border px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5">Add English word</button>
    {open ? <div className="fixed inset-0 z-50 bg-black/45 p-3 backdrop-blur-sm" role="dialog" aria-modal="true" onMouseDown={(event) => event.target === event.currentTarget && !busy && setOpen(false)}>
      <div className="mx-auto mt-[15vh] w-full max-w-lg rounded-2xl border border-card bg-background p-4 shadow-elevated">
        <h2 className="text-base font-semibold">Add EnglishWord</h2>
        <label className="mt-4 grid gap-1 text-sm">Word or phrase<textarea autoFocus value={text} onChange={(event) => setText(event.target.value)} rows={3} className="rounded border px-3 py-2 text-base" placeholder="e.g. well-known" /></label>
        <p className="mt-2 text-xs opacity-70">The stored value is lowercase. Hyphens and spacing variants become one space.</p>
        {error ? <p className="mt-3 rounded border border-red-500/30 bg-red-600/10 p-3 text-sm text-red-700">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2"><button type="button" disabled={busy} onClick={() => setOpen(false)} className="rounded border px-3 py-2 text-sm">Cancel</button><button type="button" disabled={busy || !text.trim()} onClick={() => void submit()} className="rounded border px-3 py-2 text-sm disabled:opacity-50">{busy ? "Saving…" : "Save"}</button></div>
      </div>
    </div> : null}
  </>;
}
