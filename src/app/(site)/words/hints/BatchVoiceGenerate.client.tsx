"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { JOB_PROGRESS_TOPICS } from "@/lib/progress/topics";
import { useJobProgress } from "@/lib/progress/useJobProgress";

type Row = { id: number; text: string | null };

type VoiceJobStatus = {
  jobId: string;
  running: boolean;
  done: boolean;
  error: string | null;
  totalCandidates: number;
  processedCandidates: number;
  generated: number;
  skippedExists: number;
  skippedNoText: number;
  zeroByteFound: number;
  regeneratedZeroByte: number;
  currentId: number | null;
};

export default function BatchVoiceGenerate({ rows }: { rows: Row[] }) {
  const { status: streamedStatus } = useJobProgress<VoiceJobStatus>(
    JOB_PROGRESS_TOPICS.wordVoice,
  );
  const items = useMemo(
    () =>
      rows
        .map((r) => ({ id: r.id, hintPhrase: String(r.text ?? "").trim() }))
        .filter((r) => Boolean(r.hintPhrase)),
    [rows]
  );

  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const lastAudioRefreshAtRef = useRef(0);
  const lastProcessedRef = useRef(-1);

  const run = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setError(null);
    setStatusText(null);

    try {
      const res = await fetch("/api/words/voice-generate-all", { method: "POST" });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; status?: { jobId?: string } }
        | null;

      if (!res.ok || !data?.ok) throw new Error(data?.error || `Request failed (${res.status})`);
      setJobId(data.status?.jobId ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [running]);

  useEffect(() => {
    if (!streamedStatus) return;
    setJobId(streamedStatus.jobId);
    setRunning(Boolean(streamedStatus.running));
    setError(streamedStatus.error);
    const remaining = Math.max(
      0,
      streamedStatus.totalCandidates - streamedStatus.processedCandidates,
    );
    setStatusText(
      `done=${streamedStatus.processedCandidates}/${streamedStatus.totalCandidates} remaining=${remaining} currentId=${streamedStatus.currentId ?? "—"} generated=${streamedStatus.generated} skippedExists=${streamedStatus.skippedExists} zeroByte=${streamedStatus.zeroByteFound} regeneratedZeroByte=${streamedStatus.regeneratedZeroByte}`,
    );

    const now = Date.now();
    const processedChanged =
      streamedStatus.processedCandidates !== lastProcessedRef.current;
    const refreshDue = now - lastAudioRefreshAtRef.current >= 1_000;
    if (processedChanged && (refreshDue || !streamedStatus.running)) {
      lastProcessedRef.current = streamedStatus.processedCandidates;
      lastAudioRefreshAtRef.current = now;
      for (const item of items) {
        window.dispatchEvent(
          new CustomEvent("voice:updated", { detail: { id: item.id } }),
        );
      }
    }
  }, [items, streamedStatus]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void run()}
          disabled={running || items.length === 0}
          className="rounded border px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
        >
          {running ? "Generating voices (ALL)…" : "Generate voices (ALL)"}
        </button>
        {jobId ? <span className="text-xs opacity-70">job: {jobId}</span> : null}
        {error ? (
          <span className="max-w-[320px] truncate text-xs text-red-600" title={error}>
            {error}
          </span>
        ) : null}
      </div>
      {statusText ? <div className="text-xs opacity-80">{statusText}</div> : null}
    </div>
  );
}
