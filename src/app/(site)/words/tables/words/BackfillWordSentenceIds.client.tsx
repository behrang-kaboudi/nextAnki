"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function BackfillWordSentenceIds() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setRunning(true);
    setNotice(null);
    setError(null);
    try {
      const response = await fetch("/api/words/backfill-sentence-ids", {
        method: "POST",
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        updated?: number;
        error?: string;
      };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Backfill failed.");
      }
      setNotice(`${payload.updated ?? 0} Word record(s) updated.`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Backfill failed.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={running}
        onClick={run}
        className="rounded border px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
      >
        {running ? "Filling sentenceId…" : "Fill sentenceId (temporary)"}
      </button>
      {notice ? <span className="text-sm text-green-700 dark:text-green-300">{notice}</span> : null}
      {error ? <span className="text-sm text-red-700 dark:text-red-300">{error}</span> : null}
    </div>
  );
}
