"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { ActionIcon } from "@/components/icons";
import { getWordSenseStoryAudioPublicPath } from "@/lib/audio/wordSenseStoryAudioNaming";

export default function StoryAudioControls({ id, filename: initialFilename }: { id: number; filename: string | null }) {
  const router = useRouter();
  const [filename, setFilename] = useState(initialFilename);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const updateFilename = useCallback((next: string | null) => { setFilename(next); router.refresh(); }, [router]);
  const releaseStream = useCallback(() => { for (const track of streamRef.current?.getTracks() ?? []) track.stop(); streamRef.current = null; recorderRef.current = null; setRecording(false); }, []);
  const request = useCallback(async (url: string, init?: RequestInit) => {
    const response = await fetch(url, init);
    const payload = (await response.json().catch(() => null)) as { ok?: boolean; filename?: string; error?: string } | null;
    if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Story audio request failed.");
    return payload;
  }, []);
  const uploadRecording = useCallback(async (blob: Blob) => {
    setBusy(true); setError(null); setNotice(null);
    try {
      const form = new FormData();
      form.set("audio", blob, "recording.webm");
      const payload = await request(`/api/words/word-sense-stories/${id}/audio`, { method: "POST", body: form });
      if (!payload.filename) throw new Error("Could not save recording.");
      updateFilename(payload.filename); setNotice("Recording saved ✓");
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  }, [id, request, updateFilename]);
  const startRecording = useCallback(async () => {
    if (recording || busy) return;
    setError(null); setNotice(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setError("Recording is not supported in this browser."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { autoGainControl: false, echoCancellation: false, noiseSuppression: false } });
      streamRef.current = stream; chunksRef.current = [];
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/ogg"].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunksRef.current.push(event.data); };
      recorder.onstop = () => { const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }); chunksRef.current = []; releaseStream(); if (blob.size > 0) void uploadRecording(blob); };
      recorder.start(); setRecording(true);
    } catch (reason) { releaseStream(); setError(reason instanceof Error ? reason.message : String(reason)); }
  }, [busy, recording, releaseStream, uploadRecording]);
  const stopRecording = useCallback(() => { try { if (recorderRef.current?.state === "recording") recorderRef.current.stop(); } catch { releaseStream(); } }, [releaseStream]);
  const generate = useCallback(async () => {
    if (busy || recording) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const payload = await request(`/api/words/word-sense-stories/${id}/audio/generate`, { method: "POST" });
      if (!payload.filename) throw new Error("Could not generate story audio.");
      updateFilename(payload.filename); setNotice("Audio generated ✓");
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  }, [busy, id, recording, request, updateFilename]);
  const deleteAudio = useCallback(async () => {
    if (!filename || busy || recording || !window.confirm("Delete this story audio file?")) return;
    setBusy(true); setError(null); setNotice(null);
    try { await request(`/api/words/word-sense-stories/${id}/audio/delete`, { method: "POST" }); updateFilename(null); setNotice("Audio deleted ✓"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  }, [busy, filename, id, recording, request, updateFilename]);
  useEffect(() => () => releaseStream(), [releaseStream]);

  return <div className="flex min-w-48 flex-wrap items-center gap-1">
    {filename ? <audio ref={audioRef} preload="none" src={getWordSenseStoryAudioPublicPath(filename)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} /> : null}
    <button type="button" onClick={() => { const audio = audioRef.current; if (!audio || !filename) return; if (audio.paused) void audio.play(); else audio.pause(); }} disabled={!filename || busy || recording} aria-label={playing ? "Pause story audio" : "Play story audio"} title={playing ? "Pause" : "Play"} className="inline-flex rounded border p-1.5 transition active:scale-90 hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"><ActionIcon name={playing ? "pause" : "play"} /></button>
    <button type="button" onClick={() => void generate()} disabled={busy || recording} aria-label="Generate story audio" title="Generate story audio and replace the previous file" className="inline-flex rounded border p-1.5 transition active:scale-90 hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"><ActionIcon name="sparkles" /></button>
    <button type="button" onClick={() => recording ? stopRecording() : void startRecording()} disabled={busy} aria-label={recording ? "Stop story recording" : "Record story audio"} title={recording ? "Stop recording" : "Record from microphone"} className="inline-flex rounded border p-1.5 transition active:scale-90 hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"><ActionIcon name={recording ? "stop" : "mic"} /></button>
    <button type="button" onClick={() => void deleteAudio()} disabled={!filename || busy || recording} aria-label="Delete story audio" title="Delete story audio" className="inline-flex rounded border p-1.5 transition active:scale-90 hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"><ActionIcon name="trash" /></button>
    {recording ? <span className="text-[11px] text-red-600">Recording…</span> : null}
    {notice ? <span className="text-[11px] text-emerald-700 dark:text-emerald-400">{notice}</span> : null}
    {error ? <span className="max-w-48 truncate text-[11px] text-red-600" title={error}>{error}</span> : null}
  </div>;
}
