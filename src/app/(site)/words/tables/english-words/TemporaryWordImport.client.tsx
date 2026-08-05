"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Detail = { id: number; normalized_text: string; outcome: string; detail: string };
type Report = { checked: number; phoneticCopied: number; audioCopied: number; noMatchingWord: number; noWordPhonetic: number; noWordAudio: number; uniqueConflict: number; failed: number; details: Detail[] };
type Payload = { ok?: boolean; report?: Report; nextAfterId?: number; remainingInNextRun?: boolean; error?: string };

const emptyReport = (): Report => ({ checked: 0, phoneticCopied: 0, audioCopied: 0, noMatchingWord: 0, noWordPhonetic: 0, noWordAudio: 0, uniqueConflict: 0, failed: 0, details: [] });

function mergeReport(total: Report, next: Report): Report {
  return {
    checked: total.checked + next.checked,
    phoneticCopied: total.phoneticCopied + next.phoneticCopied,
    audioCopied: total.audioCopied + next.audioCopied,
    noMatchingWord: total.noMatchingWord + next.noMatchingWord,
    noWordPhonetic: total.noWordPhonetic + next.noWordPhonetic,
    noWordAudio: total.noWordAudio + next.noWordAudio,
    uniqueConflict: total.uniqueConflict + next.uniqueConflict,
    failed: total.failed + next.failed,
    details: [...total.details, ...next.details].slice(0, 30),
  };
}

export default function TemporaryWordImport() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);

  const run = async () => {
    if (!window.confirm("Process every EnglishWord record missing phonetic_us? This will automatically continue through all batches.")) return;
    setBusy(true); setError(null); setReport(null); setStatus("Starting…");
    let afterId = 0;
    let batchNumber = 0;
    let combined = emptyReport();
    try {
      while (true) {
        batchNumber += 1;
        setStatus(`Processing batch ${batchNumber} — ${combined.checked} rows checked…`);
        const response = await fetch("/api/words/english-words/scripts/import-from-word", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ afterId }) });
        const payload = (await response.json().catch(() => null)) as Payload | null;
        if (!response.ok || !payload?.ok || !payload.report) throw new Error(payload?.error || "Import failed.");
        combined = mergeReport(combined, payload.report);
        setReport(combined);
        afterId = payload.nextAfterId ?? afterId;
        if (!payload.remainingInNextRun || payload.report.checked === 0) break;
      }
      setStatus(`Completed — ${combined.checked} rows checked in ${batchNumber} batch(es).`);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setStatus(`Stopped after ${combined.checked} checked row(s).`);
    } finally { setBusy(false); }
  };

  return <section className="mt-4 rounded border border-violet-500/30 bg-violet-500/5 p-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-semibold">Temporary — copy from Word</h2><p className="mt-1 text-xs opacity-80">For every EnglishWord missing phonetic_us, finds a normalized Word.base_form match, copies its US IPA and latest base_form audio into this table’s audio location.</p></div><button type="button" disabled={busy} onClick={() => void run()} className="rounded border px-3 py-2 text-sm disabled:opacity-50">{busy ? "Copying all batches…" : "Copy IPA & audio from all Word matches"}</button></div>{status ? <p className="mt-3 text-sm opacity-80">{status}</p> : null}{error ? <p className="mt-3 rounded border border-red-500/30 bg-red-600/10 p-3 text-sm text-red-700">{error}</p> : null}{report ? <div className="mt-3 rounded border bg-background p-3 text-xs"><div className="grid gap-x-6 gap-y-1 sm:grid-cols-2"><span>Checked: <strong>{report.checked}</strong></span><span>phonetic_us copied: <strong>{report.phoneticCopied}</strong></span><span>Audio copied: <strong>{report.audioCopied}</strong></span><span>No matching Word: <strong>{report.noMatchingWord}</strong></span><span>Matching Word without IPA: <strong>{report.noWordPhonetic}</strong></span><span>Word without base_form audio: <strong>{report.noWordAudio}</strong></span><span>Unique IPA conflicts: <strong>{report.uniqueConflict}</strong></span><span>Other failures: <strong>{report.failed}</strong></span></div>{report.details.length ? <details className="mt-3"><summary className="cursor-pointer font-medium">Detailed report ({report.details.length}; first 30)</summary><ul className="mt-2 max-h-48 space-y-1 overflow-auto font-mono">{report.details.map((item) => <li key={`${item.id}-${item.outcome}`}>#{item.id} {item.normalized_text} — {item.outcome}: {item.detail}</li>)}</ul></details> : null}</div> : null}</section>;
}
