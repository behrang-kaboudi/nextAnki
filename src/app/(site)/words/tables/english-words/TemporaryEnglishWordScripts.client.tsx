"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Report = {
  scannedWordRows: number;
  normalizedUniqueTexts: number;
  createdEnglishWords: number;
  alreadyExistingEnglishWords: number;
  skippedInvalidWordRows: number;
  skippedExamples: Array<{ id: number; base_form: string }>;
};

export default function TemporaryEnglishWordScripts() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);

  const run = async () => {
    if (!window.confirm("Read every Word.base_form, normalize it, and create only missing EnglishWord records?")) return;
    setBusy(true); setError(null); setReport(null);
    try {
      const response = await fetch("/api/words/english-words/scripts/import-word-base-forms", { method: "POST" });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; report?: Report; error?: string } | null;
      if (!response.ok || !payload?.ok || !payload.report) throw new Error(payload?.error || "Script failed.");
      setReport(payload.report); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } finally { setBusy(false); }
  };

  return <section className="mt-4 rounded border border-amber-500/30 bg-amber-500/5 p-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-semibold">Temporary scripts</h2><p className="mt-1 text-xs opacity-80">Imports every <code>Word.base_form</code> after English normalization and creates only missing EnglishWord values.</p></div><button type="button" disabled={busy} onClick={() => void run()} className="rounded border px-3 py-2 text-sm disabled:opacity-50">{busy ? "Running…" : "Import Word.base_form"}</button></div>{error ? <p className="mt-3 rounded border border-red-500/30 bg-red-600/10 p-3 text-sm text-red-700">{error}</p> : null}{report ? <div className="mt-3 rounded border bg-background p-3 text-xs"><div className="grid gap-x-6 gap-y-1 sm:grid-cols-2"><span>Scanned Word rows: <strong>{report.scannedWordRows}</strong></span><span>Unique normalized texts: <strong>{report.normalizedUniqueTexts}</strong></span><span>Created EnglishWords: <strong>{report.createdEnglishWords}</strong></span><span>Already existing: <strong>{report.alreadyExistingEnglishWords}</strong></span><span>Skipped invalid rows: <strong>{report.skippedInvalidWordRows}</strong></span></div>{report.skippedExamples.length ? <p className="mt-2 font-mono">Skipped examples: {report.skippedExamples.map((item) => `#${item.id} ${item.base_form}`).join(" · ")}</p> : null}</div> : null}</section>;
}
