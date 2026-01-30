"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { WordAudioFieldKey } from "@/lib/audio/wordFieldAudioNaming";
import {
  WORD_AUDIO_FILENAME_SEPARATOR,
  WORD_AUDIO_PUBLIC_DIR_RELATIVE,
} from "@/lib/audio/wordFieldAudioNaming";
import { ActionIcon } from "@/components/icons";

const FIELD_LABEL: Record<WordAudioFieldKey, string> = {
  base_form: "base_form",
  meaning_fa: "meaning_fa",
  other_meanings_fa: "other_meanings_fa",
  sentence_en: "sentence_en",
  sentence_en_meaning_fa: "sentence_en_meaning_fa",
};

export default function BatchWordFieldVoiceGenerate({
  field,
  candidates,
}: {
  field: WordAudioFieldKey;
  candidates: Array<{ id: number; text: string | null }>;
}) {
  const enabledCount = useMemo(
    () => candidates.map((c) => String(c.text ?? "").trim()).filter(Boolean).length,
    [candidates]
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [notifiedDoneJobId, setNotifiedDoneJobId] = useState<string | null>(null);

  const poll = useCallback(async () => {
    const res = await fetch(
      `/api/words/field-voice-generate-all?field=${encodeURIComponent(field)}`,
      { method: "GET" }
    );
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
  }, [field]);

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
      await poll();
      window.dispatchEvent(new CustomEvent("wordFieldVoice:updated", { detail: { field, all: true } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [busy, field, poll, running]);

  // keep UI in sync with server (resume after refresh)
  useEffect(() => {
    void poll().catch(() => null);
  }, [poll]);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => void poll().catch(() => null), 1000);
    return () => clearInterval(t);
  }, [poll, running]);

  useEffect(() => {
    if (running) return;
    if (!jobId) return;
    if (notifiedDoneJobId === jobId) return;
    window.dispatchEvent(new CustomEvent("wordFieldVoice:updated", { detail: { field, all: true } }));
    setNotifiedDoneJobId(jobId);
  }, [field, jobId, notifiedDoneJobId, running]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
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
        {jobId ? <span className="text-xs opacity-70">job: {jobId}</span> : null}
        <span className="text-xs opacity-70">{FIELD_LABEL[field]} • candidates: {enabledCount}</span>
      </div>
      {error ? (
        <div className="max-w-[520px] truncate text-xs text-red-600" title={error}>
          {error}
        </div>
      ) : null}
      {statusText ? <div className="text-xs opacity-80">{statusText}</div> : null}
      <div className="text-xs opacity-80">
        Folder: <span className="font-mono">public/{WORD_AUDIO_PUBLIC_DIR_RELATIVE}</span> •
        name:{" "}
        <span className="font-mono">
          anki_link_id{WORD_AUDIO_FILENAME_SEPARATOR}field{WORD_AUDIO_FILENAME_SEPARATOR}Date.now().mp3
        </span>
      </div>
    </div>
  );
}
