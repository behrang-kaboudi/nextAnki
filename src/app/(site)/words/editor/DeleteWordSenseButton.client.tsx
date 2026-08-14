"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeleteWordSenseButton({
  id,
  label,
}: {
  id: number;
  label: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (busy) return;
    const ok = window.confirm(`Delete this word?\n\n#${id} — ${label}\n\nThis will also delete its word audio files.`);
    if (!ok) return;

    setBusy(true);
    try {
      const res = await fetch("/api/words/editor/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || json?.ok !== true) throw new Error(json?.error || `Request failed (${res.status})`);
      router.refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void onDelete()}
      disabled={busy}
      className="rounded border border-red-500/30 bg-red-600/10 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-600/15 disabled:opacity-50 dark:text-red-300"
      title="Delete"
    >
      {busy ? "…" : "Delete"}
    </button>
  );
}

