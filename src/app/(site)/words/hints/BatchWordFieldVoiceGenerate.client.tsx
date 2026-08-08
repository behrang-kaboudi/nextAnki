"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import type { WordAudioFieldKey } from "@/lib/audio/wordFieldAudioNaming";
import {
  WORD_AUDIO_FILENAME_SEPARATOR,
  WORD_AUDIO_PUBLIC_DIR_RELATIVE,
} from "@/lib/audio/wordFieldAudioNaming";
import { ActionIcon } from "@/components/icons";
import { wordFieldVoiceProgressTopic } from "@/lib/progress/topics";
import { useJobProgress } from "@/lib/progress/useJobProgress";
import { isSentenceAudioField, SENTENCE_AUDIO_FILENAME_SEPARATOR, SENTENCE_AUDIO_PUBLIC_DIR_RELATIVE } from "@/lib/audio/sentenceAudioNaming";

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

const FIELD_LABEL: Record<WordAudioFieldKey, string> = {
  base_form: "base_form",
  other_meanings_en: "other_meanings_en",
  concept_explained_fa: "concept_explained_fa",
  sentence_en: "sentence_en",
  sentence_en_meaning_fa: "sentence_en_meaning_fa",
};

export default function BatchWordFieldVoiceGenerate({
  field,
}: {
  field: WordAudioFieldKey;
}) {
  const router = useRouter();
  const sentenceOwned = isSentenceAudioField(field);
  const audioFolder = sentenceOwned ? SENTENCE_AUDIO_PUBLIC_DIR_RELATIVE : WORD_AUDIO_PUBLIC_DIR_RELATIVE;
  const separator = sentenceOwned ? SENTENCE_AUDIO_FILENAME_SEPARATOR : WORD_AUDIO_FILENAME_SEPARATOR;
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
        `missing=${nf.format(data.missingAudioWords ?? 0)}/${nf.format(data.totalWords ?? 0)} (${pct(data.missingOfTotalRatio ?? 0)}) ` +
        `eligible=${nf.format(data.eligibleWords ?? 0)} (missing of eligible: ${pct(data.missingOfEligibleRatio ?? 0)}) ` +
        `noText=${nf.format(data.noTextWords ?? 0)}`;
      setStatsText(msg);

      const RLM = "\u200F";
      window.alert(
        `${RLM}آمار صوت (${FIELD_LABEL[field]}):\n` +
          `${RLM}بدون صوت (فقط رکوردهای دارای متن): ${nf.format(data.missingAudioWords ?? 0)}\n` +
          `${RLM}کل رکوردها در دیتابیس: ${nf.format(data.totalWords ?? 0)}\n` +
          `${RLM}نسبت بدون صوت به کل: ${pct(data.missingOfTotalRatio ?? 0)}\n` +
          `${RLM}دارای متن (قابل تولید): ${nf.format(data.eligibleWords ?? 0)}\n` +
          `${RLM}بدون صوت نسبت به دارای متن: ${pct(data.missingOfEligibleRatio ?? 0)}`
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
      `done=${streamedStatus.processedCandidates}/${streamedStatus.totalCandidates} remaining=${remaining} currentId=${streamedStatus.currentId ?? "—"} generated=${streamedStatus.generated} skippedExists=${streamedStatus.skippedExists} zeroByte=${streamedStatus.zeroByteFound} regeneratedZeroByte=${streamedStatus.regeneratedZeroByte}`,
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
          aria-label={`Generate voices (ALL) — ${FIELD_LABEL[field]}`}
          title={`Generate voices (ALL) — ${FIELD_LABEL[field]}`}
          className="inline-flex items-center gap-1.5 rounded border px-2 py-1.5 text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
        >
          {busy || running ? (
            <span className="animate-pulse opacity-70">…</span>
          ) : (
            <ActionIcon name="sparkles" className="size-4" />
          )}
          <span className="text-[10px] font-semibold opacity-80">ALL</span>
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
        name:{" "}
        <span className="font-mono">
          {sentenceOwned ? "s" : "audioKey"}{separator}{sentenceOwned ? "Sentence.id" : "field"}{separator}{sentenceOwned ? "field" : "Date.now()"}{sentenceOwned ? <>{separator}Date.now().mp3</> : ".mp3"}
        </span>
      </div>
    </div>
  );
}
