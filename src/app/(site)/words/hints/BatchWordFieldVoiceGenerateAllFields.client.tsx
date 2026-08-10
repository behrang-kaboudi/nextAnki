"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { ActionIcon } from "@/components/icons";
import { RemainingCountBadge } from "@/components/remaining-count";
import { WORD_AUDIO_BATCH_FIELDS, type WordAudioBatchFieldKey } from "@/lib/audio/wordAudioFields";
import { wordFieldVoiceProgressTopic } from "@/lib/progress/topics";
import { useJobProgressStatuses } from "@/lib/progress/useJobProgress";

type FieldStatus = {
  jobId: string;
  running: boolean;
  done: boolean;
  error: string | null;
  totalCandidates: number;
  processedCandidates: number;
  generated: number;
  skippedNoText: number;
  currentId: number | null;
};

type StartOk = {
  ok: true;
  status?: FieldStatus;
  error?: string;
};

type StartErr = {
  ok?: false;
  error?: string;
};

async function apiStartField(field: WordAudioBatchFieldKey) {
  const res = await fetch("/api/words/field-voice-generate-all", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ field }),
  });
  const data = (await res.json().catch(() => null)) as (StartOk | StartErr) | null;
  if (!res.ok || data?.ok !== true) throw new Error(data?.error || `Request failed (${res.status})`);
  return data.status ?? null;
}

export default function BatchWordFieldVoiceGenerateAllFields({
  remainingCount,
}: {
  remainingCount: number;
}) {
  const router = useRouter();
  const fields = WORD_AUDIO_BATCH_FIELDS;
  const progressStore = useJobProgressStatuses();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [launchedJobIds, setLaunchedJobIds] = useState<Partial<Record<WordAudioBatchFieldKey, string>>>({});
  const refreshedRunRef = useRef<string | null>(null);

  const statuses = useMemo(
    () => fields.map((field) => ({
      field,
      status: progressStore.statuses[wordFieldVoiceProgressTopic(field)] as FieldStatus | undefined,
    })),
    [fields, progressStore.statuses],
  );
  const running = statuses.some(({ status }) => status?.running);
  const total = statuses.reduce((sum, { status }) => sum + (status?.totalCandidates ?? 0), 0);
  const processed = statuses.reduce((sum, { status }) => sum + (status?.processedCandidates ?? 0), 0);
  const generated = statuses.reduce((sum, { status }) => sum + (status?.generated ?? 0), 0);
  const remaining = Math.max(0, total - processed);
  const showProgress = running || Object.keys(launchedJobIds).length > 0;

  const run = useCallback(async () => {
    if (busy || running) return;
    const ok = window.confirm("برای همه‌ی فیلدها job تولید صوت اجرا شود؟");
    if (!ok) return;

    setBusy(true);
    setError(null);
    setStatusText(null);
    try {
      const results = await Promise.allSettled(
        fields.map(async (field) => {
          const status = await apiStartField(field);
          window.dispatchEvent(new CustomEvent("wordFieldVoice:updated", { detail: { field, all: true } }));
          return { field, status };
        })
      );

      const started: string[] = [];
      const failed: string[] = [];
      for (const r of results) {
        if (r.status === "fulfilled") {
          started.push(`${r.value.field}:${r.value.status?.jobId ?? "—"}`);
        } else {
          failed.push(r.reason instanceof Error ? r.reason.message : String(r.reason));
        }
      }

      setLaunchedJobIds(Object.fromEntries(
        results.flatMap((result) => result.status === "fulfilled" && result.value.status?.jobId
          ? [[result.value.field, result.value.status.jobId]]
          : []),
      ));

      setStatusText(`started=${started.length}/${fields.length}${failed.length ? ` failed=${failed.length}` : ""}`);
      if (failed.length) setError(failed[0] ?? "Unknown error");
    } finally {
      setBusy(false);
    }
  }, [busy, fields, running]);

  useEffect(() => {
    const launched = Object.entries(launchedJobIds) as Array<[WordAudioBatchFieldKey, string]>;
    if (!launched.length) return;
    const allFinished = launched.every(([field, jobId]) => {
      const status = progressStore.statuses[wordFieldVoiceProgressTopic(field)] as FieldStatus | undefined;
      return status?.jobId === jobId && status.done && !status.running;
    });
    if (!allFinished) return;
    const runKey = launched.map(([, jobId]) => jobId).sort().join("|");
    if (refreshedRunRef.current === runKey) return;
    refreshedRunRef.current = runKey;
    router.refresh();
  }, [launchedJobIds, progressStore.statuses, router]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void run()}
        disabled={busy || running}
        className="inline-flex items-center gap-1.5 rounded border px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
        title="Generate audio for all fields (ALL)"
      >
        {busy ? <span className="animate-pulse opacity-70">…</span> : <ActionIcon name="sparkles" className="size-4" />}
        {running ? "Generating all missing audio" : "Generate all missing audio"}
        <RemainingCountBadge count={running ? remaining : remainingCount} />
      </button>
      {statusText ? <span className="text-xs opacity-70">{statusText}</span> : null}
      {error ? <span className="max-w-[520px] truncate text-xs text-red-600" title={error}>{error}</span> : null}
      {showProgress ? (
        <div className="basis-full space-y-1 text-xs opacity-80">
          <div>
            done={processed.toLocaleString()}/{total.toLocaleString()} • remaining={remaining.toLocaleString()} • generated={generated.toLocaleString()}
          </div>
          {statuses.map(({ field, status }) => status ? (
            <div key={field}>
              {field}: {status.processedCandidates.toLocaleString()}/{status.totalCandidates.toLocaleString()}
              {" • "}remaining={Math.max(0, status.totalCandidates - status.processedCandidates).toLocaleString()}
              {" • "}generated={status.generated.toLocaleString()}
              {status.currentId ? ` • current=#${status.currentId}` : ""}
              {status.error ? ` • error=${status.error}` : ""}
            </div>
          ) : null)}
        </div>
      ) : null}
    </div>
  );
}
