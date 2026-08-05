"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { ActionIcon } from "@/components/icons";

export default function EnglishWordJsonHintControls({ id, jsonHint }: { id: number; jsonHint: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (jsonHint?.trim()) return <span className="block truncate" title={jsonHint}>{jsonHint}</span>;
  const generate = async () => {
    if (busy) return;
    setBusy(true); setError(null);
    try { const response = await fetch(`/api/words/english-words/${id}/json-hint/generate`, { method: "POST" }); const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null; if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Could not generate json_hint."); router.refresh(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };
  return <div className="flex flex-wrap items-center gap-1"><span className="opacity-70">—</span><button type="button" onClick={() => void generate()} disabled={busy} aria-label="Generate json_hint" title="Generate json_hint" className="inline-flex rounded border p-1.5 transition active:scale-90 hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"><ActionIcon name="sparkles" /></button>{error ? <span className="max-w-48 truncate text-[11px] text-red-600" title={error}>{error}</span> : null}</div>;
}
