"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { JOB_PROGRESS_TOPICS } from "@/lib/progress/topics";
import { useJobProgress } from "@/lib/progress/useJobProgress";

type PersianWordAudioJobStatus = {
  jobId: string;
  running: boolean;
  done: boolean;
  error: string | null;
  totalCandidates: number;
  processedCandidates: number;
  generated: number;
  skippedNoText: number;
  currentId: number | null;
  currentText: string | null;
  currentFilename: string | null;
};

export default function BatchPersianWordAudioGenerate() {
  const router = useRouter();
  const { status } = useJobProgress<PersianWordAudioJobStatus>(JOB_PROGRESS_TOPICS.persianWordAudio);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshedJobRef = useRef<string | null>(null);

  const start = useCallback(async () => {
    if (starting || status?.running) return;
    setStarting(true);
    setError(null);
    try {
      const response = await fetch("/api/words/persian-words/generate-missing-audio", { method: "POST" });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Could not start audio generation.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setStarting(false);
    }
  }, [starting, status?.running]);

  useEffect(() => {
    if (!status?.done || status.running || !status.jobId || refreshedJobRef.current === status.jobId) return;
    refreshedJobRef.current = status.jobId;
    router.refresh();
  }, [router, status]);

  const processed = status?.processedCandidates ?? 0;
  const total = status?.totalCandidates ?? 0;
  const remaining = Math.max(0, total - processed);

  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Canonical-text audio</div>
          <div className="text-xs opacity-70">Creates or replaces audio when the file is missing or audio_source_text differs from canonical_text.</div>
        </div>
        <button type="button" onClick={() => void start()} disabled={starting || Boolean(status?.running)} className="rounded border px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5">
          {starting || status?.running ? "Generating audio…" : "Generate pending audio"}
        </button>
      </div>
      {status ? <div className="mt-2 text-xs opacity-80">
        done={processed}/{total} • remaining={remaining} • generated={status.generated} • skippedNoText={status.skippedNoText}
        {status.currentId ? <> • current=#{status.currentId} ({status.currentText ?? "—"})</> : null}
        {status.currentFilename ? <> • file={status.currentFilename}</> : null}
      </div> : null}
      {error || status?.error ? <div className="mt-2 text-xs text-red-600">{error ?? status?.error}</div> : null}
    </section>
  );
}
