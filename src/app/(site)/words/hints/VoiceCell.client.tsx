"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { buildHintSentenceAudioFilename } from "@/lib/audio/hintSentenceAudioNaming";

type Props = {
  wordId: number;
  text: string | null;
  generatedAtMs: number | null;
};

export default function VoiceCell({ wordId, text, generatedAtMs }: Props) {
  const hintPhrase = useMemo(() => String(text ?? "").trim(), [text]);
  const enabled = Boolean(hintPhrase);
  const [filename, setFilename] = useState<string | null>(null);
  const publicPath = useMemo(
    () => (filename ? `/audio/${encodeURIComponent(filename)}` : null),
    [filename]
  );

  const [busy, setBusy] = useState(false);
  const [exists, setExists] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkExists = useCallback(async () => {
    if (!enabled) return;
    if (!publicPath) {
      setExists(false);
      return;
    }
    try {
      const res = await fetch(publicPath, { method: "HEAD" });
      setExists(res.ok);
    } catch {
      setExists(false);
    }
  }, [enabled, publicPath]);

  const fetchLatest = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await fetch(
        `/api/words/voice-file?wordId=${encodeURIComponent(String(wordId))}`,
        { method: "GET" }
      );
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; filename?: string | null; publicPath?: string | null; error?: string }
        | null;
      if (!res.ok || !data?.ok) throw new Error(data?.error || `Request failed (${res.status})`);
      setFilename(typeof data.filename === "string" && data.filename.trim() ? data.filename : null);
    } catch {
      setFilename(null);
    }
  }, [enabled, wordId]);

  useEffect(() => {
    void fetchLatest();
  }, [fetchLatest]);

  useEffect(() => {
    void checkExists();
  }, [checkExists]);

  useEffect(() => {
    if (!enabled) return;
    const onUpdated = (evt: Event) => {
      const id = (evt as CustomEvent<{ id?: unknown }>).detail?.id;
      if (typeof id === "number" && id === wordId) {
        void fetchLatest().then(() => void checkExists());
      }
    };
    window.addEventListener("voice:updated", onUpdated);
    return () => window.removeEventListener("voice:updated", onUpdated);
  }, [checkExists, enabled, fetchLatest, wordId]);

  const generate = useCallback(async () => {
    if (!enabled || busy) return;
    setBusy(true);
    setError(null);
    try {
      const nextFilename = buildHintSentenceAudioFilename({
        id: wordId,
        timestampMs: generatedAtMs ?? Date.now(),
      });
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          filename: nextFilename,
          provider: "azure",
        }),
      });

      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; publicPath?: string; error?: string }
        | null;

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `TTS failed (${res.status})`);
      }

      setFilename(nextFilename);
      await checkExists();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [busy, checkExists, enabled, generatedAtMs, text, wordId]);

  if (!enabled) return <span className="opacity-60">—</span>;

  return (
    <div className="flex items-center gap-2">
      {exists && publicPath ? (
        <audio controls preload="none" src={publicPath} className="h-7 w-48" />
      ) : null}
      {!exists ? (
        <button
          type="button"
          onClick={generate}
          disabled={busy}
          className="rounded border px-2 py-1 text-[11px] hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
        >
          {busy ? "Generating…" : "Generate"}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => {
            if (busy) return;
            if (confirm("Regenerate this audio file?")) void generate();
          }}
          disabled={busy}
          className="rounded border px-2 py-1 text-[11px] opacity-70 hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
        >
          {busy ? "Generating…" : "Regenerate"}
        </button>
      )}
      {error ? (
        <span className="max-w-[260px] truncate text-[11px] text-red-600" title={error}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
