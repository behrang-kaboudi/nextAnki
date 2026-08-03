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
  audioKey,
  text,
}: {
  field: WordAudioFieldKey;
  audioKey: string | null;
  text: string | null;
}) {
  const normalized = useMemo(() => String(text ?? "").trim(), [text]);
  const normalizedAudioKey = useMemo(() => {
    const value = typeof audioKey === "string" ? audioKey.trim() : "";
    return value ? value : null;
  }, [audioKey]);
  const enabled = Boolean(normalized && normalizedAudioKey);

  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publicPath, setPublicPath] = useState<string | null>(null);
  const [exists, setExists] = useState(false);
  const [size, setSize] = useState<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const exampleFilename = useMemo(
    () => buildWordFieldAudioFilenameTemplate({ audioKey: normalizedAudioKey ?? undefined, field }),
    [normalizedAudioKey, field]
  );

  const fetchLatest = useCallback(async () => {
    if (!normalizedAudioKey) {
      setPublicPath(null);
      setExists(false);
      setSize(0);
      return;
    }
    try {
      const res = await fetch(
        `/api/words/field-voice-file?audioKey=${encodeURIComponent(normalizedAudioKey)}&field=${encodeURIComponent(field)}`,
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
  }, [normalizedAudioKey, field]);

  const generate = useCallback(async () => {
    if (!enabled || busy || recording) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/words/field-voice-generate-one", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioKey: normalizedAudioKey, field, text: normalized }),
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
        new CustomEvent("wordFieldVoice:updated", { detail: { audioKey: normalizedAudioKey, field } })
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [normalizedAudioKey, busy, enabled, field, normalized, recording]);

  const deleteAll = useCallback(async () => {
    if (!enabled || busy || recording) return;
    const ok = window.confirm("تمام فایل‌های صوت این فیلد حذف شود؟");
    if (!ok) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/words/field-voice-delete-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioKey, field }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; deleted?: number; failed?: number }
        | null;
      if (!res.ok || data?.ok !== true) throw new Error(data?.error || `Request failed (${res.status})`);

      setPublicPath(null);
      setExists(false);
      setSize(0);
      window.dispatchEvent(new CustomEvent("wordFieldVoice:updated", { detail: { audioKey: normalizedAudioKey, field } }));
      void fetchLatest();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [normalizedAudioKey, busy, enabled, fetchLatest, field, recording]);

  const stopRecording = useCallback((opts?: { skipRecorderStop?: boolean }) => {
    if (!opts?.skipRecorderStop) {
      try {
        mediaRecorderRef.current?.stop();
      } catch {
        // ignore
      }
    }
    mediaRecorderRef.current = null;

    const stream = mediaStreamRef.current;
    if (stream) {
      for (const t of stream.getTracks()) t.stop();
    }
    mediaStreamRef.current = null;

    setRecording(false);
  }, []);

  const uploadRecording = useCallback(
    async (blob: Blob) => {
      if (!enabled) return;
      setBusy(true);
      setError(null);
      try {
        const form = new FormData();
        if (!normalizedAudioKey) throw new Error("Missing audioKey");
        form.set("audioKey", normalizedAudioKey);
        form.set("field", field);
        form.set("audio", blob, "recording.webm");

        const res = await fetch("/api/words/field-voice-upload-one", {
          method: "POST",
          body: form,
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

        window.dispatchEvent(new CustomEvent("wordFieldVoice:updated", { detail: { audioKey: normalizedAudioKey, field } }));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [normalizedAudioKey, enabled, field]
  );

  const startRecording = useCallback(async () => {
    if (!enabled || busy || recording) return;
    setError(null);

    if (!("mediaDevices" in navigator) || typeof navigator.mediaDevices?.getUserMedia !== "function") {
      setError("Recording not supported in this browser.");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      setError("Recording not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: false,
          echoCancellation: false,
          noiseSuppression: false,
        },
      });
      mediaStreamRef.current = stream;
      chunksRef.current = [];

      const preferredTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/ogg",
      ];
      const mimeType = preferredTypes.find((t) => MediaRecorder.isTypeSupported(t));

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.addEventListener("dataavailable", (evt) => {
        if (evt.data && evt.data.size > 0) chunksRef.current.push(evt.data);
      });

      recorder.addEventListener("stop", () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        chunksRef.current = [];
        stopRecording({ skipRecorderStop: true });
        void uploadRecording(blob);
      });

      setRecording(true);
      recorder.start();
    } catch (e) {
      stopRecording();
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [busy, enabled, recording, stopRecording, uploadRecording]);

  useEffect(() => {
    if (!enabled) return;
    void fetchLatest();
  }, [enabled, fetchLatest]);

  // refresh after other components generate
  useEffect(() => {
    if (!enabled) return;
    const onUpdated = (evt: Event) => {
      const detail = (evt as CustomEvent<{ audioKey?: unknown; field?: unknown; all?: unknown }>).detail;
      if (!detail) return;
      if (detail.field !== field) return;
      if (detail.all === true || detail.audioKey === audioKey) {
        void fetchLatest();
      }
    };
    window.addEventListener("wordFieldVoice:updated", onUpdated);
    return () => window.removeEventListener("wordFieldVoice:updated", onUpdated);
  }, [audioKey, enabled, fetchLatest, field]);

  useEffect(() => {
    return () => stopRecording();
  }, [stopRecording]);

  if (!enabled) return <span className="opacity-60">—</span>;

  return (
    <div className="flex items-center gap-2">
      {publicPath ? (
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
              if (!exists) return;
              if (el.paused) void el.play();
              else el.pause();
            }}
            disabled={!exists}
            className="inline-flex items-center rounded border p-1.5 text-[11px] hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
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
        disabled={busy || recording}
        title={`Folder: public/${WORD_AUDIO_PUBLIC_DIR_RELATIVE}\nExample: ${exampleFilename}`}
        aria-label="Generate audio"
        className="inline-flex items-center rounded border p-1.5 text-[11px] hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
      >
        {busy ? <span className="animate-pulse opacity-70">…</span> : <ActionIcon name="sparkles" className="size-4" />}
      </button>
      <button
        type="button"
        onClick={() => (recording ? stopRecording() : void startRecording())}
        disabled={busy}
        aria-label={recording ? "Stop recording" : "Record audio"}
        title={recording ? "Stop recording" : "Record from microphone"}
        className="inline-flex items-center rounded border p-1.5 text-[11px] hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
      >
        <ActionIcon name={recording ? "stop" : "mic"} className="size-4" />
      </button>
      <button
        type="button"
        onClick={() => void deleteAll()}
        disabled={busy || recording || !publicPath}
        aria-label="Delete all audio files"
        title="Delete all audio files for this field"
        className="inline-flex items-center rounded border p-1.5 text-[11px] hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
      >
        <ActionIcon name="trash" className="size-4" />
      </button>
      {error ? (
        <span className="max-w-[240px] truncate text-[11px] text-red-600" title={error}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
