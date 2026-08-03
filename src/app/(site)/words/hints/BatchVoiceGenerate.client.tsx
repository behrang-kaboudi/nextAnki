"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Row = { id: number; text: string | null };

export default function BatchVoiceGenerate({ rows }: { rows: Row[] }) {
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

  const poll = useCallback(async () => {
    const res = await fetch("/api/words/voice-generate-all", { method: "GET" });
    const data = (await res.json().catch(() => null)) as
      | {
          ok?: boolean;
          status?: {
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
        }
      | null;

    if (!res.ok || !data?.ok || !data.status) throw new Error("Failed to fetch status");

    setJobId(data.status.jobId);
    setRunning(Boolean(data.status.running));
    setError(data.status.error);

    const remaining = Math.max(
      0,
      (data.status.totalCandidates ?? 0) - (data.status.processedCandidates ?? 0)
    );
    setStatusText(
      `done=${data.status.processedCandidates}/${data.status.totalCandidates} remaining=${remaining} currentId=${data.status.currentId ?? "—"} generated=${data.status.generated} skippedExists=${data.status.skippedExists} zeroByte=${data.status.zeroByteFound} regeneratedZeroByte=${data.status.regeneratedZeroByte}`
    );
  }, []);

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
      await poll();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      // keep running state from poll
    }
  }, [poll, running]);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      void poll().then(() => {
        for (const r of items) {
          window.dispatchEvent(new CustomEvent("voice:updated", { detail: { id: r.id } }));
        }
      });
    }, 1000);
    return () => clearInterval(t);
  }, [items, poll, running]);

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
