"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  buildWordFieldAudioFilenameTemplate,
  type WordAudioFieldKey,
  getWordFieldAudioPublicPath,
  WORD_AUDIO_PUBLIC_DIR_RELATIVE,
} from "@/lib/audio/wordFieldAudioNaming";
import { ActionIcon } from "@/components/icons";

export default function WordFieldVoiceCell({
  field,
  ankiLinkId,
  text,
}: {
  field: WordAudioFieldKey;
  ankiLinkId: string;
  text: string | null;
}) {
  const normalized = useMemo(() => String(text ?? "").trim(), [text]);
  const enabled = Boolean(normalized);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publicPath, setPublicPath] = useState<string | null>(null);
  const [exists, setExists] = useState(false);
  const [size, setSize] = useState<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  const exampleFilename = useMemo(
    () => buildWordFieldAudioFilenameTemplate({ ankiLinkId, field }),
    [ankiLinkId, field]
  );

  const fetchLatest = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/words/field-voice-file?ankiLinkId=${encodeURIComponent(ankiLinkId)}&field=${encodeURIComponent(field)}`,
        { method: "GET" }
      );
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; filename?: string | null; publicPath?: string | null; size?: number; error?: string }
        | null;
      if (!res.ok || !data?.ok) throw new Error(data?.error || `Request failed (${res.status})`);
      const pp = typeof data.publicPath === "string" && data.publicPath.trim() ? data.publicPath : null;
      setPublicPath(pp);
      const nextSize = typeof data.size === "number" ? data.size : 0;
      setSize(nextSize);
      setExists(Boolean(pp) && nextSize > 0);
    } catch {
      setPublicPath(null);
      setExists(false);
      setSize(0);
    }
  }, [ankiLinkId, field]);

  const generate = useCallback(async () => {
    if (!enabled || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/words/field-voice-generate-one", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ankiLinkId, field, text: normalized }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; filename?: string; publicPath?: string; size?: number }
        | null;
      if (!res.ok || data?.ok !== true) throw new Error(data?.error || `Request failed (${res.status})`);
      const nextPublicPath =
        typeof data.publicPath === "string" && data.publicPath.trim()
          ? data.publicPath
          : typeof data.filename === "string" && data.filename.trim()
            ? getWordFieldAudioPublicPath(data.filename)
            : null;
      setPublicPath(nextPublicPath);
      const nextSize = typeof data.size === "number" ? data.size : 0;
      setSize(nextSize);
      setExists(Boolean(nextPublicPath) && nextSize > 0);
      window.dispatchEvent(
        new CustomEvent("wordFieldVoice:updated", { detail: { ankiLinkId, field } })
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [ankiLinkId, busy, enabled, field, normalized]);

  useEffect(() => {
    if (!enabled) return;
    void fetchLatest();
  }, [enabled, fetchLatest]);

  // refresh after other components generate
  useEffect(() => {
    if (!enabled) return;
    const onUpdated = (evt: Event) => {
      const detail = (evt as CustomEvent<{ ankiLinkId?: unknown; field?: unknown; all?: unknown }>).detail;
      if (!detail) return;
      if (detail.field !== field) return;
      if (detail.all === true || detail.ankiLinkId === ankiLinkId) {
        void fetchLatest();
      }
    };
    window.addEventListener("wordFieldVoice:updated", onUpdated);
    return () => window.removeEventListener("wordFieldVoice:updated", onUpdated);
  }, [ankiLinkId, enabled, fetchLatest, field]);

  if (!enabled) return <span className="opacity-60">—</span>;

  return (
    <div className="flex items-center gap-2">
      {exists && publicPath ? (
        <>
          <audio
            ref={audioRef}
            preload="none"
            src={publicPath}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
          />
          <button
            type="button"
            onClick={() => {
              const el = audioRef.current;
              if (!el) return;
              if (el.paused) void el.play();
              else el.pause();
            }}
            className="inline-flex items-center rounded border p-1.5 text-[11px] hover:bg-black/5 dark:hover:bg-white/5"
            title={`${playing ? "Pause" : "Play"}${size ? ` • ${size} bytes` : ""}`}
            aria-label={playing ? "Pause" : "Play"}
          >
            <ActionIcon name={playing ? "pause" : "play"} className="size-4" />
          </button>
        </>
      ) : null}
      <button
        type="button"
        onClick={() => void generate()}
        disabled={busy}
        title={`Folder: public/${WORD_AUDIO_PUBLIC_DIR_RELATIVE}\nExample: ${exampleFilename}`}
        aria-label="Generate audio"
        className="inline-flex items-center rounded border p-1.5 text-[11px] hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
      >
        {busy ? <span className="animate-pulse opacity-70">…</span> : <ActionIcon name="sparkles" className="size-4" />}
      </button>
      {error ? (
        <span className="max-w-[240px] truncate text-[11px] text-red-600" title={error}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
