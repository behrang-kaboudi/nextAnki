"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Report = {
  scannedWordRows: number;
  matchedWordRows: number;
  updatedWordRows: number;
  unmatchedWordRows: number;
  skippedInvalidWordRows: number;
};

export default function TemporaryEnglishIdLinker() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);

  const run = async () => {
    if (!window.confirm("Link every Word to its matching EnglishWord using Word.base_form?")) return;
    setBusy(true);
    setError(null);
    setReport(null);
    try {
      const response = await fetch("/api/words/link-english-ids", { method: "POST" });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; report?: Report; error?: string } | null;
      if (!response.ok || !payload?.ok || !payload.report) throw new Error(payload?.error || "Linking failed.");
      setReport(payload.report);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  return <section className="mt-4 rounded border border-amber-500/30 bg-amber-500/5 p-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-semibold">Temporary English ID linker</h2><p className="mt-1 text-xs opacity-80">Reads all Word rows at once and sets <code>englishId</code> from the EnglishWord whose normalized text matches <code>base_form</code>.</p></div><button type="button" disabled={busy} onClick={() => void run()} className="rounded border px-3 py-2 text-sm disabled:opacity-50">{busy ? "Linking…" : "Fill all englishId values"}</button></div>{error ? <p className="mt-3 rounded border border-red-500/30 bg-red-600/10 p-3 text-sm text-red-700">{error}</p> : null}{report ? <div className="mt-3 grid gap-x-6 gap-y-1 rounded border bg-background p-3 text-xs sm:grid-cols-2"><span>Scanned Word rows: <strong>{report.scannedWordRows}</strong></span><span>Matched Word rows: <strong>{report.matchedWordRows}</strong></span><span>Updated Word rows: <strong>{report.updatedWordRows}</strong></span><span>Unmatched Word rows: <strong>{report.unmatchedWordRows}</strong></span><span>Skipped invalid rows: <strong>{report.skippedInvalidWordRows}</strong></span></div> : null}</section>;
}
