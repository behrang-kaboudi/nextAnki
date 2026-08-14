"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DeletePersianWordButton({ id, label }: { id: number; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (busy) return;
    if (!window.confirm(`Delete PersianWord #${id} — ${label}?\n\nThis cannot be undone.`)) return;

    setBusy(true);
    try {
      const response = await fetch(`/api/words/persian-words/${id}`, { method: "DELETE" });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; referencingWordIds?: number[] } | null;
      if (!response.ok || !payload?.ok) {
        const references = payload?.referencingWordIds?.length
          ? `\n\nReferenced by WordSense IDs: ${payload.referencingWordIds.join(", ")}`
          : "";
        throw new Error(`${payload?.error || `Request failed (${response.status})`}${references}`);
      }
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error));
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
      title="Delete PersianWord"
    >
      {busy ? "…" : "Delete"}
    </button>
  );
}
