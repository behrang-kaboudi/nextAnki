"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type ApiResponse =
  | {
      ok: true;
      q: string;
      processed: number;
      updated: number;
      batchFirstId: number | null;
      batchLastId: number | null;
      nextCursorId: number;
      done: boolean;
      tookMs: number;
      total: number | null;
    }
  | { ok: false; error: string };

export default function JsonHintGenerateAllButton({ q }: { q: string }) {
  const router = useRouter();
  const abortRef = useRef(false);
  const [running, setRunning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [onlyEmptyJsonHint, setOnlyEmptyJsonHint] = useState(false);
  const [scanBatch, setScanBatch] = useState(50);
  const [cursorId, setCursorId] = useState(0);
  const [processed, setProcessed] = useState(0);
  const [updated, setUpdated] = useState(0);
  const [batchFirstId, setBatchFirstId] = useState<number | null>(null);
  const [batchLastId, setBatchLastId] = useState<number | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [lastTookMs, setLastTookMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runAll() {
    if (running) return;

    abortRef.current = false;
    setRunning(true);
    setStopping(false);
    setError(null);
    setCursorId(0);
    setProcessed(0);
    setUpdated(0);
    setBatchFirstId(null);
    setBatchLastId(null);
    setTotal(null);
    setLastTookMs(null);

    let cursor = 0;
    let totalLocal: number | null = null;
    let done = false;

    try {
      while (!done) {
        if (abortRef.current) break;

        const params = new URLSearchParams();
        if (q.trim()) params.set("q", q.trim());
        params.set("cursorId", String(cursor));
        params.set(
          "scanBatch",
          String(Math.max(10, Math.min(500, Math.trunc(scanBatch || 0) || 50))),
        );
        if (totalLocal == null) params.set("includeTotal", "1");
        if (onlyEmptyJsonHint) params.set("onlyEmptyJsonHint", "1");

        const res = await fetch(
          `/api/words/json-hint-generate-all?${params.toString()}`,
          {
            method: "POST",
          },
        );
        const data = (await res.json().catch(() => null)) as ApiResponse | null;
        if (!res.ok || !data?.ok) {
          throw new Error(
            (data as { error?: string } | null)?.error ||
              `Request failed (${res.status})`,
          );
        }

        totalLocal = data.total ?? totalLocal;
        setTotal(totalLocal);

        setBatchFirstId(data.batchFirstId ?? null);
        setBatchLastId(data.batchLastId ?? null);
        setLastTookMs(Number.isFinite(data.tookMs) ? data.tookMs : null);

        cursor = data.nextCursorId ?? cursor;
        setCursorId(cursor);
        setProcessed((p) => p + (data.processed ?? 0));
        setUpdated((u) => u + (data.updated ?? 0));

        done = data.done;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
      setStopping(false);
      if (!abortRef.current) router.refresh();
    }
  }

  function stop() {
    abortRef.current = true;
    setStopping(true);
  }

  const totalDisplay = total ?? null;
  const processedDisplay =
    totalDisplay != null ? Math.min(processed, totalDisplay) : processed;
  const percent =
    totalDisplay && totalDisplay > 0
      ? Math.round((processedDisplay / totalDisplay) * 100)
      : null;
  const progressText = [
    totalDisplay != null
      ? `Processed: ${processedDisplay}/${totalDisplay}`
      : `Processed: ${processedDisplay}`,
    percent != null ? `${percent}%` : null,
    `Updated: ${updated}`,
    batchLastId != null
      ? `Current/LastId: ${batchLastId}`
      : `CursorId: ${cursorId}`,
    batchFirstId != null && batchLastId != null
      ? `Batch: ${batchFirstId}→${batchLastId}`
      : null,
    lastTookMs != null
      ? `Last: ${Math.max(0, Math.round(lastTookMs))}ms`
      : null,
    stopping ? "Stopping…" : null,
  ]
    .filter(Boolean)
    .join(" • ");

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void runAll()}
          disabled={running}
          className="rounded border px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
        >
          {running ? "Generating json_hint…" : "Generate json_hint (DB)"}
        </button>

        <button
          type="button"
          onClick={stop}
          disabled={!running || stopping}
          className="rounded border px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
        >
          Stop
        </button>

        <label className="inline-flex h-[42px] items-center gap-2 rounded border px-3 text-sm">
          <input
            type="checkbox"
            checked={onlyEmptyJsonHint}
            onChange={(e) => setOnlyEmptyJsonHint(e.target.checked)}
            disabled={running}
            className="h-4 w-4 rounded"
          />
          <span className="whitespace-nowrap leading-none">
            Only empty `json_hint`
          </span>
        </label>

        <label className="flex h-[42px] flex-row items-center gap-2 rounded border px-3 text-sm">
          <span className="whitespace-nowrap text-xs">Batch size</span>
          <input
            type="number"
            min={10}
            max={500}
            value={scanBatch}
            onChange={(e) => {
              const raw = Number(e.target.value);
              const next = Number.isFinite(raw) ? Math.trunc(raw) : 50;
              setScanBatch(Math.max(10, Math.min(500, next)));
            }}
            disabled={running}
            className="h-9 w-24 rounded border px-2 text-sm disabled:opacity-50"
          />
        </label>
      </div>

      <div className="basis-full text-xs opacity-80">
        {[
          progressText,
          q.trim() ? `Filter: ${q.trim()}` : null,
          onlyEmptyJsonHint ? "Mode: only null/empty json_hint" : null,
        ]
          .filter(Boolean)
          .join(" • ")}
      </div>
      {error ? (
        <div className="basis-full text-xs text-red-600">{error}</div>
      ) : null}
    </>
  );
}
