"use client";

import { useCallback, useEffect, useState } from "react";

export type PendingAgentArtifact = {
  runId: string;
  stageId: string;
  itemCount: number;
  response?: unknown;
};

async function readPending(stageId: string, includeResponse: boolean) {
  const response = await fetch(
    `/api/v1/words-table-workflow/pending?stageId=${encodeURIComponent(stageId)}&includeResponse=${includeResponse ? "1" : "0"}`,
    { cache: "no-store" },
  );
  const json = await response.json() as { ok?: boolean; artifact?: PendingAgentArtifact | null; error?: string };
  if (!response.ok || !json.ok) throw new Error(json.error || "Could not load the saved agent response.");
  return json.artifact ?? null;
}

export function usePendingAgentArtifact(stageId: string) {
  const [artifact, setArtifact] = useState<PendingAgentArtifact | null>(null);
  const refresh = useCallback(async () => {
    const next = await readPending(stageId, false);
    setArtifact(next);
    return next;
  }, [stageId]);
  useEffect(() => {
    let cancelled = false;
    void readPending(stageId, false)
      .then((next) => { if (!cancelled) setArtifact(next); })
      .catch(() => { if (!cancelled) setArtifact(null); });
    return () => { cancelled = true; };
  }, [stageId]);
  const loadResponse = useCallback(async () => readPending(stageId, true), [stageId]);
  return { artifact, loadResponse, refresh };
}

export async function completeAgentArtifact(runId: string) {
  const response = await fetch("/api/v1/words-table-workflow/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ runId }),
  });
  const json = await response.json() as { ok?: boolean; error?: string };
  if (!response.ok || !json.ok) throw new Error(json.error || "Could not complete the saved agent response.");
}
