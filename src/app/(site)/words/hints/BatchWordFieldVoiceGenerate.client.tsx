"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import type { WordAudioBatchFieldKey } from "@/lib/audio/wordAudioFields";
import { ENGLISH_WORD_AUDIO_PUBLIC_DIR_RELATIVE } from "@/lib/audio/englishWordAudioNaming";
import { PERSIAN_WORD_AUDIO_PUBLIC_DIR_RELATIVE } from "@/lib/audio/persianWordAudioNaming";
import { ActionIcon } from "@/components/icons";
import { wordFieldVoiceProgressTopic } from "@/lib/progress/topics";
import { useJobProgress } from "@/lib/progress/useJobProgress";
import { isSentenceAudioField, SENTENCE_AUDIO_PUBLIC_DIR_RELATIVE } from "@/lib/audio/sentenceAudioNaming";
import { isWordConceptAudioField, WORD_CONCEPT_AUDIO_PUBLIC_DIR_RELATIVE } from "@/lib/audio/wordConceptAudioNaming";

type WordFieldVoiceStatus = {
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

const FIELD_LABEL: Record<WordAudioBatchFieldKey, string> = {
  base_form: "base_form",
  canonical_text: "canonical_text",
  concept_explained_fa: "concept_explained_fa",
  sentence_en: "sentence_en",
  sentence_en_meaning_fa: "sentence_en_meaning_fa",
};

export default function BatchWordFieldVoiceGenerate({
  field,
}: {
  field: WordAudioBatchFieldKey;
}) {
  const router = useRouter();
  const audioFolder = isSentenceAudioField(field)
    ? SENTENCE_AUDIO_PUBLIC_DIR_RELATIVE
    : field === "base_form"
      ? ENGLISH_WORD_AUDIO_PUBLIC_DIR_RELATIVE
      : field === "canonical_text"
        ? PERSIAN_WORD_AUDIO_PUBLIC_DIR_RELATIVE
      : isWordConceptAudioField(field)
        ? WORD_CONCEPT_AUDIO_PUBLIC_DIR_RELATIVE
        : "audio";
  const { status: streamedStatus } = useJobProgress<WordFieldVoiceStatus>(
    wordFieldVoiceProgressTopic(field),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [statsBusy, setStatsBusy] = useState(false);
  const [statsText, setStatsText] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [notifiedDoneJobId, setNotifiedDoneJobId] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (statsBusy) return;
    setStatsBusy(true);
    try {
      const res = await fetch(`/api/words/field-voice-stats?field=${encodeURIComponent(field)}`, {
        method: "GET",
        headers: { "Cache-Control": "no-store" },
      });
      const data = (await res.json().catch(() => null)) as
        | {
            ok?: boolean;
            error?: string;
            totalWords?: number;
            eligibleWords?: number;
            withAudioWords?: number;
            currentAudioWords?: number;
            staleAudioWords?: number;
            missingAudioWords?: number;
            noTextWords?: number;
            missingOfTotalRatio?: number;
            missingOfEligibleRatio?: number;
          }
        | null;
      if (!res.ok || data?.ok !== true) throw new Error(data?.error || `Request failed (${res.status})`);

      const nf = new Intl.NumberFormat();
      const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
      const msg =
        `field=${FIELD_LABEL[field]} | ` +
        `pending=${nf.format(data.missingAudioWords ?? 0)}/${nf.format(data.totalWords ?? 0)} (${pct(data.missingOfTotalRatio ?? 0)}) ` +
        `stale=${nf.format(data.staleAudioWords ?? 0)} eligible=${nf.format(data.eligibleWords ?? 0)} (pending of eligible: ${pct(data.missingOfEligibleRatio ?? 0)}) ` +
        `noText=${nf.format(data.noTextWords ?? 0)}`;
      setStatsText(msg);

      const RLM = "\u200F";
      window.alert(
        `${RLM}آمار صوت (${FIELD_LABEL[field]}):\n` +
          `${RLM}نیازمند تولید یا بازتولید: ${nf.format(data.missingAudioWords ?? 0)}\n` +
          `${RLM}دارای صوت قدیمی: ${nf.format(data.staleAudioWords ?? 0)}\n` +
          `${RLM}کل رکوردها در دیتابیس: ${nf.format(data.totalWords ?? 0)}\n` +
          `${RLM}نسبت نیازمند تولید به کل: ${pct(data.missingOfTotalRatio ?? 0)}\n` +
          `${RLM}دارای متن (قابل تولید): ${nf.format(data.eligibleWords ?? 0)}\n` +
          `${RLM}نیازمند تولید نسبت به دارای متن: ${pct(data.missingOfEligibleRatio ?? 0)}`
      );
    } catch (e) {
      setStatsText(null);
      window.alert(e instanceof Error ? e.message : String(e));
    } finally {
      setStatsBusy(false);
    }
  }, [field, statsBusy]);

  const generateAll = useCallback(async () => {
    if (busy || running) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/words/field-voice-generate-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; status?: { jobId?: string } }
        | null;
      if (!res.ok || data?.ok !== true) throw new Error(data?.error || `Request failed (${res.status})`);
      setJobId(data.status?.jobId ?? null);
      window.dispatchEvent(new CustomEvent("wordFieldVoice:updated", { detail: { field, all: true } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [busy, field, running]);

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
      `done=${streamedStatus.processedCandidates}/${streamedStatus.totalCandidates} remaining=${remaining} currentId=${streamedStatus.currentId ?? "—"} generated=${streamedStatus.generated} zeroByte=${streamedStatus.zeroByteFound} regeneratedZeroByte=${streamedStatus.regeneratedZeroByte}`,
    );
  }, [streamedStatus]);

  useEffect(() => {
    if (running) return;
    if (!jobId) return;
    if (notifiedDoneJobId === jobId) return;
    window.dispatchEvent(new CustomEvent("wordFieldVoice:updated", { detail: { field, all: true } }));
    setNotifiedDoneJobId(jobId);
    router.refresh();
  }, [field, jobId, notifiedDoneJobId, router, running]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="rounded border px-2 py-1 text-xs font-semibold">
          {FIELD_LABEL[field]}
        </span>
        <button
          type="button"
          onClick={() => void generateAll()}
          disabled={busy || running}
          aria-label={`Generate missing or outdated voices — ${FIELD_LABEL[field]}`}
          title={`Generate missing or outdated voices — ${FIELD_LABEL[field]}`}
          className="inline-flex items-center gap-1.5 rounded border px-2 py-1.5 text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
        >
          {busy || running ? (
            <span className="animate-pulse opacity-70">…</span>
          ) : (
            <ActionIcon name="sparkles" className="size-4" />
          )}
          <span className="text-[10px] font-semibold opacity-80">PENDING</span>
        </button>
        <button
          type="button"
          onClick={() => void fetchStats()}
          disabled={statsBusy}
          aria-label={`Audio stats — ${FIELD_LABEL[field]}`}
          title={`Audio stats — ${FIELD_LABEL[field]}`}
          className="inline-flex items-center rounded border px-2 py-1.5 text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
        >
          {statsBusy ? <span className="animate-pulse opacity-70">…</span> : <span className="text-[10px] font-semibold opacity-80">STATS</span>}
        </button>
        {jobId ? <span className="text-xs opacity-70">job: {jobId}</span> : null}
      </div>
      {error ? (
        <div className="max-w-[520px] truncate text-xs text-red-600" title={error}>
          {error}
        </div>
      ) : null}
      {statusText ? <div className="text-xs opacity-80">{statusText}</div> : null}
      {statsText ? <div className="text-xs opacity-80">{statsText}</div> : null}
      <div className="text-xs opacity-80">
        Folder: <span className="font-mono">public/{audioFolder}</span> •
        owner and filename are persisted in the database
      </div>
    </div>
  );
}
