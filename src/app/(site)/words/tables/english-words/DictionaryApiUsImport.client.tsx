"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Report = { checked: number; foundUsPronunciation: number; updatedPhonetic: number; downloadedAudio: number; notFound: number; noUsPronunciation: number; rateLimited: number; failed: number; details: Array<{ id: number; base_form: string; outcome: string; detail: string }> };

export default function DictionaryApiUsImport() {
  const router = useRouter();
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const [report, setReport] = useState<Report | null>(null); const [more, setMore] = useState(false); const [afterId, setAfterId] = useState(0);
  const run = async () => {
    setBusy(true); setError(null); setReport(null);
    try {
      const response = await fetch("/api/words/english-words/dictionary-api-us-import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ afterId }) });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; report?: Report; nextAfterId?: number; remainingInNextRun?: boolean; error?: string } | null;
      if (!response.ok || !payload?.ok || !payload.report) throw new Error(payload?.error || "Import failed.");
      setReport(payload.report); setAfterId(payload.nextAfterId ?? afterId); setMore(Boolean(payload.remainingInNextRun)); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } finally { setBusy(false); }
  };
  return <section className="mt-4 rounded border border-sky-500/30 bg-sky-500/5 p-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-semibold">DictionaryAPI.dev — US pronunciation</h2><p className="mt-1 text-xs opacity-80">Checks the next 100 incomplete rows sequentially. It accepts only a phonetic + audio pair whose audio filename is marked US, fills only missing fields, and saves audio under the EnglishWord naming convention.</p></div><button type="button" disabled={busy} onClick={() => void run()} className="rounded border px-3 py-2 text-sm disabled:opacity-50">{busy ? "Checking…" : afterId ? "Download next 100" : "Download US audio & IPA"}</button></div>{error ? <p className="mt-3 rounded border border-red-500/30 bg-red-600/10 p-3 text-sm text-red-700">{error}</p> : null}{report ? <div className="mt-3 rounded border bg-background p-3 text-xs"><div className="grid gap-x-6 gap-y-1 sm:grid-cols-2"><span>Checked: <strong>{report.checked}</strong></span><span>US pair found: <strong>{report.foundUsPronunciation}</strong></span><span>phonetic_us filled: <strong>{report.updatedPhonetic}</strong></span><span>Audio downloaded: <strong>{report.downloadedAudio}</strong></span><span>Not found (404): <strong>{report.notFound}</strong></span><span>No US pair: <strong>{report.noUsPronunciation}</strong></span><span>Rate-limited (429): <strong>{report.rateLimited}</strong></span><span>Other failures: <strong>{report.failed}</strong></span></div>{more ? <p className="mt-2 font-semibold text-sky-700 dark:text-sky-300">More incomplete rows remain; run again for the next 100.</p> : null}{report.details.length ? <details className="mt-3"><summary className="cursor-pointer font-medium">Detailed report ({report.details.length})</summary><ul className="mt-2 max-h-48 space-y-1 overflow-auto font-mono">{report.details.map((item) => <li key={`${item.id}-${item.outcome}`}>#{item.id} {item.base_form} — {item.outcome}: {item.detail}</li>)}</ul></details> : null}</div> : null}</section>;
}
