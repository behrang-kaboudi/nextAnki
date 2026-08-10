"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { JOB_PROGRESS_TOPICS } from "@/lib/progress/topics";
import { useJobProgress } from "@/lib/progress/useJobProgress";
import { RemainingCountBadge } from "@/components/remaining-count";

type Mode = "missing" | "all";
type Status = {
  jobId: string;
  mode: Mode;
  running: boolean;
  done: boolean;
  error: string | null;
  totalCandidates: number;
  processedCandidates: number;
  generated: number;
  skippedNoPhonetic: number;
  currentId: number | null;
  currentText: string | null;
};

export default function BatchEnglishWordJsonHintGenerate({
  initialRemainingCount,
  initialTotalCount,
}: {
  initialRemainingCount: number;
  initialTotalCount: number;
}) {
  const router = useRouter();
  const { status } = useJobProgress<Status>(JOB_PROGRESS_TOPICS.englishWordJsonHint);
  const [startingMode, setStartingMode] = useState<Mode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refreshedJobRef = useRef<string | null>(null);

  const start = useCallback(async (mode: Mode) => {
    if (startingMode || status?.running) return;
    setStartingMode(mode);
    setError(null);
    try {
      const response = await fetch("/api/words/english-words/generate-missing-json-hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Could not start json_hint generation.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setStartingMode(null);
    }
  }, [startingMode, status?.running]);

  useEffect(() => {
    if (!status?.done || status.running || !status.jobId || refreshedJobRef.current === status.jobId) return;
    refreshedJobRef.current = status.jobId;
    router.refresh();
  }, [router, status]);

  const processed = status?.processedCandidates ?? 0;
  const total = status?.totalCandidates ?? 0;
  const remaining = Math.max(0, total - processed);
  const busy = Boolean(startingMode || status?.running);

  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">JSON hint</div>
          <div className="text-xs opacity-70">
            Generate missing handles only empty json_hint values; Generate all recalculates every EnglishWord record.
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void start("missing")}
            disabled={busy}
            className="rounded border px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
          >
            {status?.running && status.mode === "missing" ? "Generating missing json_hint…" : "Generate missing json_hint"}
            <RemainingCountBadge count={status?.running && status.mode === "missing" ? remaining : initialRemainingCount} />
          </button>
          <button
            type="button"
            onClick={() => void start("all")}
            disabled={busy}
            className="rounded border px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
          >
            {status?.running && status.mode === "all" ? "Generating all json_hint…" : "Generate all json_hint"}
            <RemainingCountBadge count={status?.running && status.mode === "all" ? remaining : initialTotalCount} />
          </button>
        </div>
      </div>
      {status ? (
        <div className="text-xs opacity-80">
          mode={status.mode} • done={processed.toLocaleString()}/{total.toLocaleString()} • remaining={remaining.toLocaleString()} • generated={status.generated.toLocaleString()} • skippedNoPhonetic={status.skippedNoPhonetic.toLocaleString()}
          {status.currentId ? <> • current=#{status.currentId} ({status.currentText ?? "—"})</> : null}
        </div>
      ) : null}
      {error || status?.error ? <div className="text-xs text-red-600">{error ?? status?.error}</div> : null}
    </section>
  );
}
