"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ActionIcon } from "@/components/icons/ActionIcon";
import { PageHeader } from "@/components/page-header";

type AudioFile = { name: string; size: number; modifiedAt: string; url: string };
type ApiPayload = { ok?: boolean; error?: string; files?: AudioFile[] };
type SortMode = "name" | "newest" | "largest";

const inputClass = "h-11 w-full rounded-xl border border-card bg-background px-3 text-sm outline-none transition focus:border-foreground/30 focus:ring-4 focus:ring-[var(--ring)]";
const textButton = "inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-card bg-background px-4 text-sm font-semibold transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-white/5";
const primaryButton = "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] shadow-elevated transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50";
const iconButton = "inline-flex rounded-xl border border-card bg-background p-2 transition active:scale-90 hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/5";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function extensionOf(name: string) {
  return name.split(".").pop()?.toUpperCase() || "AUDIO";
}

async function readPayload(response: Response) {
  const payload = (await response.json()) as ApiPayload;
  if (!response.ok || !payload.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload;
}

function ToolCard({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="grid content-start gap-4 rounded-2xl border border-card bg-card p-5 shadow-elevated">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{eyebrow}</p>
        <h2 className="mt-1 text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function SharedAudioManager() {
  const [files, setFiles] = useState<AudioFile[]>([]);
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("name");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [renaming, setRenaming] = useState("");
  const [nextName, setNextName] = useState("");
  const [playing, setPlaying] = useState("");
  const [silenceName, setSilenceName] = useState("silence-custom.mp3");
  const [silenceDuration, setSilenceDuration] = useState("1");
  const [recordingName, setRecordingName] = useState("recording-new.mp3");
  const [recordingTarget, setRecordingTarget] = useState("");
  const [editingFile, setEditingFile] = useState<AudioFile | null>(null);
  const [editDuration, setEditDuration] = useState(0);
  const [trimStart, setTrimStart] = useState("0");
  const [trimEnd, setTrimEnd] = useState("");
  const [volumePercent, setVolumePercent] = useState("100");
  const [fadeInSeconds, setFadeInSeconds] = useState("0");
  const [fadeOutSeconds, setFadeOutSeconds] = useState("0");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/anki/shared-audio", { cache: "no-store" });
      const payload = await readPayload(response);
      setFiles(payload.files ?? []);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Could not load audio files.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => () => {
    audioRef.current?.pause();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      recorder.stop();
    }
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  function releaseRecordingStream() {
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;
    recorderRef.current = null;
  }

  async function uploadRecording(blob: Blob, name: string, replaceName?: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      const form = new FormData();
      form.set("action", "recording");
      form.set("file", blob, "recording.webm");
      form.set("name", name);
      if (replaceName) form.set("replaceName", replaceName);
      await readPayload(await fetch("/api/anki/shared-audio", { method: "POST", body: form }));
      if (playing === name) { audioRef.current?.pause(); setPlaying(""); }
      setNotice(replaceName ? `${name} was replaced with the new recording.` : `${name} was recorded and saved.`);
      if (!replaceName) setRecordingName(`recording-${Date.now()}.mp3`);
      await refresh();
    } catch (recordError) {
      setError(recordError instanceof Error ? recordError.message : "Could not save the recording.");
    } finally {
      setBusy(false);
    }
  }

  async function startRecording(name: string, replace = false) {
    const targetName = name.trim();
    if (!targetName.toLowerCase().endsWith(".mp3")) {
      setError("Recorded audio filenames must use the .mp3 extension.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Recording is not supported in this browser.");
      return;
    }
    setError(""); setNotice("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { autoGainControl: false, echoCancellation: false, noiseSuppression: false } });
      recordingStreamRef.current = stream;
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/ogg"].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      recordingChunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size > 0) recordingChunksRef.current.push(event.data); };
      recorder.onerror = () => { releaseRecordingStream(); setRecordingTarget(""); setError("Recording failed."); };
      recorder.onstop = () => {
        const blob = new Blob(recordingChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        recordingChunksRef.current = [];
        releaseRecordingStream();
        setRecordingTarget("");
        if (blob.size > 0) void uploadRecording(blob, targetName, replace ? targetName : undefined);
        else setError("The recording is empty.");
      };
      setRecordingTarget(replace ? targetName : "__new__");
      recorder.start();
    } catch (recordError) {
      releaseRecordingStream();
      setRecordingTarget("");
      setError(recordError instanceof Error ? recordError.message : "Microphone permission was denied.");
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }

  function play(file: AudioFile) {
    if (playing === file.name) {
      audioRef.current?.pause();
      setPlaying("");
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(`${file.url}?v=${encodeURIComponent(file.modifiedAt)}`);
    audio.onended = () => setPlaying("");
    audio.onerror = () => { setPlaying(""); setError("Could not play this audio file."); };
    audioRef.current = audio;
    setPlaying(file.name);
    void audio.play().catch(() => setPlaying(""));
  }

  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const form = new FormData();
      form.set("file", file);
      await readPayload(await fetch("/api/anki/shared-audio", { method: "POST", body: form }));
      setNotice(`${file.name} was uploaded.`);
      await refresh();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally { setBusy(false); }
  }

  async function createSilence(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      await readPayload(await fetch("/api/anki/shared-audio", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "silence", name: silenceName, durationSeconds: silenceDuration }),
      }));
      setNotice(`${silenceName} was created.`);
      await refresh();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Could not create silence.");
    } finally { setBusy(false); }
  }

  async function rename(currentName: string) {
    const cleanedName = nextName.trim();
    if (!cleanedName) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await readPayload(await fetch("/api/anki/shared-audio", {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "rename", currentName, nextName: cleanedName }),
      }));
      setRenaming("");
      setNotice(`${currentName} was renamed to ${cleanedName}.`);
      await refresh();
    } catch (renameError) {
      setError(renameError instanceof Error ? renameError.message : "Rename failed.");
    } finally { setBusy(false); }
  }

  function openEditor(file: AudioFile) {
    audioRef.current?.pause();
    setPlaying("");
    setEditingFile(file);
    setEditDuration(0);
    setTrimStart("0");
    setTrimEnd("");
    setVolumePercent("100");
    setFadeInSeconds("0");
    setFadeOutSeconds("0");
    setError("");
    setNotice("");
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editingFile) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await readPayload(await fetch("/api/anki/shared-audio", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "edit",
          name: editingFile.name,
          startSeconds: trimStart,
          endSeconds: trimEnd,
          volumePercent,
          fadeInSeconds,
          fadeOutSeconds,
        }),
      }));
      setNotice(`${editingFile.name} was edited successfully.`);
      setEditingFile(null);
      await refresh();
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : "Could not edit the audio file.");
    } finally { setBusy(false); }
  }

  async function remove(name: string) {
    if (!window.confirm(`Delete ${name}? This cannot be undone.`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await readPayload(await fetch("/api/anki/shared-audio", {
        method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }),
      }));
      if (playing === name) { audioRef.current?.pause(); setPlaying(""); }
      if (editingFile?.name === name) setEditingFile(null);
      setNotice(`${name} was deleted.`);
      await refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Delete failed.");
    } finally { setBusy(false); }
  }

  const normalizedQuery = query.trim().toLowerCase();
  const visibleFiles = useMemo(() => files
    .filter((file) => !normalizedQuery || file.name.toLowerCase().includes(normalizedQuery))
    .sort((a, b) => {
      if (sortMode === "newest") return new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime();
      if (sortMode === "largest") return b.size - a.size;
      return a.name.localeCompare(b.name);
    }), [files, normalizedQuery, sortMode]);
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const latestFile = [...files].sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime())[0];
  const controlsDisabled = busy || Boolean(recordingTarget);

  return (
    <div className="grid gap-7">
      <PageHeader title="Audio Studio" subtitle="Record, organize, refine, and prepare reusable audio files for Anki media sync." />

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-card bg-card p-4 shadow-elevated">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Library</p>
          <p className="mt-2 text-3xl font-semibold">{files.length}</p>
          <p className="mt-1 text-sm text-muted">audio files</p>
        </div>
        <div className="rounded-2xl border border-card bg-card p-4 shadow-elevated">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Storage</p>
          <p className="mt-2 text-3xl font-semibold">{formatBytes(totalSize)}</p>
          <p className="mt-1 text-sm text-muted">in the shared folder</p>
        </div>
        <div className="min-w-0 rounded-2xl border border-card bg-card p-4 shadow-elevated">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Latest update</p>
          <p className="mt-2 truncate font-mono text-sm font-semibold" title={latestFile?.name}>{latestFile?.name || "—"}</p>
          <p className="mt-2 text-sm text-muted">{latestFile ? formatDate(latestFile.modifiedAt) : "No files yet"}</p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <ToolCard eyebrow="Import" title="Upload a file" description="Add an existing audio file while keeping its original filename.">
          <label className={`${primaryButton} cursor-pointer ${controlsDisabled ? "pointer-events-none opacity-50" : ""}`}>
            Upload audio
            <input type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm,.aac,.flac" className="sr-only" onChange={(event) => void upload(event)} disabled={controlsDisabled} />
          </label>
          <p className="text-xs leading-5 text-muted">MP3, WAV, M4A, OGG, WebM, AAC, or FLAC</p>
        </ToolCard>

        <ToolCard eyebrow="Microphone" title="Record new audio" description="Record in the browser and save a normalized MP3 file.">
          <label className="grid gap-1.5 text-sm font-medium">
            Filename
            <input value={recordingName} onChange={(event) => setRecordingName(event.target.value)} className={inputClass} required disabled={controlsDisabled} />
          </label>
          <button type="button" className={recordingTarget === "__new__" ? primaryButton : textButton} onClick={() => recordingTarget === "__new__" ? stopRecording() : void startRecording(recordingName)} disabled={busy || Boolean(recordingTarget && recordingTarget !== "__new__")}>
            <ActionIcon name={recordingTarget === "__new__" ? "stop" : "mic"} />
            {recordingTarget === "__new__" ? "Stop and save" : "Start recording"}
          </button>
        </ToolCard>

        <ToolCard eyebrow="Utility" title="Create silence" description="Generate a precise silent MP3 for card timing and spacing.">
          <form onSubmit={(event) => void createSilence(event)} className="grid gap-3">
            <label className="grid gap-1.5 text-sm font-medium">
              Filename
              <input value={silenceName} onChange={(event) => setSilenceName(event.target.value)} className={inputClass} required disabled={controlsDisabled} />
            </label>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <label className="grid gap-1.5 text-sm font-medium">
                Duration in seconds
                <input type="number" min="0.1" max="300" step="0.1" value={silenceDuration} onChange={(event) => setSilenceDuration(event.target.value)} className={inputClass} required disabled={controlsDisabled} />
              </label>
              <button type="submit" className={`${textButton} self-end`} disabled={controlsDisabled}>Create</button>
            </div>
          </form>
        </ToolCard>
      </section>

      {recordingTarget ? (
        <div className="flex items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-700 dark:text-red-300">
          <span className="size-2 animate-pulse rounded-full bg-red-500" />
          Recording is active. Select Stop when you are finished.
        </div>
      ) : null}
      {notice ? <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300">{notice}</div> : null}
      {error ? <div role="alert" className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</div> : null}

      {editingFile ? (
        <section className="overflow-hidden rounded-3xl border border-card bg-card shadow-elevated">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-card bg-background/60 p-5">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Audio editor</p>
              <h2 className="mt-1 truncate font-mono text-lg font-semibold">{editingFile.name}</h2>
              <p className="mt-1 text-sm text-muted">Trim the clip, adjust volume, and add smooth fades.</p>
            </div>
            <button type="button" className={textButton} onClick={() => setEditingFile(null)} disabled={busy}>Close editor</button>
          </div>
          <form onSubmit={(event) => void saveEdit(event)} className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.8fr)]">
            <div className="grid content-start gap-4 rounded-2xl border border-card bg-background p-4">
              <audio
                className="w-full"
                controls
                preload="metadata"
                src={`${editingFile.url}?v=${encodeURIComponent(editingFile.modifiedAt)}`}
                onLoadedMetadata={(event) => {
                  const duration = event.currentTarget.duration;
                  if (Number.isFinite(duration)) {
                    setEditDuration(duration);
                    setTrimEnd(duration.toFixed(2));
                  }
                }}
              />
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div className="rounded-xl border border-card bg-card p-3"><p className="text-xs text-muted">Duration</p><p className="mt-1 font-semibold">{editDuration ? `${editDuration.toFixed(2)}s` : "Reading…"}</p></div>
                <div className="rounded-xl border border-card bg-card p-3"><p className="text-xs text-muted">Format</p><p className="mt-1 font-semibold">{extensionOf(editingFile.name)}</p></div>
                <div className="rounded-xl border border-card bg-card p-3"><p className="text-xs text-muted">Size</p><p className="mt-1 font-semibold">{formatBytes(editingFile.size)}</p></div>
                <div className="rounded-xl border border-card bg-card p-3"><p className="text-xs text-muted">Edited length</p><p className="mt-1 font-semibold">{Math.max(0, Number(trimEnd || editDuration) - Number(trimStart || 0)).toFixed(2)}s</p></div>
              </div>
              <p className="text-xs leading-5 text-muted">Saving replaces this shared file atomically. The filename stays unchanged, so existing Anki references remain valid.</p>
            </div>
            <div className="grid content-start gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-medium">Trim start (seconds)<input type="number" min="0" step="0.01" max={editDuration || undefined} value={trimStart} onChange={(event) => setTrimStart(event.target.value)} className={inputClass} required /></label>
                <label className="grid gap-1.5 text-sm font-medium">Trim end (seconds)<input type="number" min="0.01" step="0.01" max={editDuration || undefined} value={trimEnd} onChange={(event) => setTrimEnd(event.target.value)} className={inputClass} required /></label>
                <label className="grid gap-1.5 text-sm font-medium">Volume (%)<input type="number" min="0" max="300" step="1" value={volumePercent} onChange={(event) => setVolumePercent(event.target.value)} className={inputClass} required /></label>
                <div />
                <label className="grid gap-1.5 text-sm font-medium">Fade in (seconds)<input type="number" min="0" step="0.01" value={fadeInSeconds} onChange={(event) => setFadeInSeconds(event.target.value)} className={inputClass} required /></label>
                <label className="grid gap-1.5 text-sm font-medium">Fade out (seconds)<input type="number" min="0" step="0.01" value={fadeOutSeconds} onChange={(event) => setFadeOutSeconds(event.target.value)} className={inputClass} required /></label>
              </div>
              <div className="flex flex-wrap justify-end gap-2 border-t border-card pt-4">
                <button type="button" className={textButton} onClick={() => { setTrimStart("0"); setTrimEnd(editDuration ? editDuration.toFixed(2) : ""); setVolumePercent("100"); setFadeInSeconds("0"); setFadeOutSeconds("0"); }} disabled={busy}>Reset</button>
                <button type="submit" className={primaryButton} disabled={busy || !trimEnd}>{busy ? "Saving…" : "Save audio edits"}</button>
              </div>
            </div>
          </form>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-3xl border border-card bg-card shadow-elevated">
        <div className="grid gap-4 border-b border-card p-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Shared library</p>
            <h2 className="mt-1 text-xl font-semibold">Your audio files</h2>
            <p className="mt-1 text-sm text-muted">Play, refine, re-record, rename, or remove any stored file.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(16rem,1fr)_10rem]">
            <label className="grid gap-1.5 text-sm font-medium">
              Search
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search filenames…" className={inputClass} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Sort by
              <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} className={inputClass}>
                <option value="name">Filename</option>
                <option value="newest">Newest</option>
                <option value="largest">Largest</option>
              </select>
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="border-b border-card bg-background/60 text-xs uppercase tracking-wide text-muted">
              <tr><th className="px-5 py-3">File</th><th className="px-4 py-3">Size</th><th className="px-4 py-3">Modified</th><th className="px-5 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-card">
              {visibleFiles.map((file) => (
                <tr key={file.name} className={`transition hover:bg-background/70 ${editingFile?.name === file.name ? "bg-background" : ""}`}>
                  <td className="px-5 py-3.5">
                    {renaming === file.name ? (
                      <form onSubmit={(event) => { event.preventDefault(); void rename(file.name); }} className="flex items-center gap-2">
                        <input value={nextName} onChange={(event) => setNextName(event.target.value)} className={`${inputClass} min-w-72 font-mono`} autoFocus aria-label={`New filename for ${file.name}`} />
                        <button className={primaryButton} disabled={busy}>Save</button>
                        <button type="button" className={textButton} onClick={() => setRenaming("")} disabled={busy}>Cancel</button>
                      </form>
                    ) : (
                      <div className="flex min-w-0 items-center gap-3">
                        <button type="button" onClick={() => play(file)} disabled={controlsDisabled} className={`grid size-10 shrink-0 place-items-center rounded-xl border transition ${playing === file.name ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]" : "border-card bg-background hover:bg-black/5 dark:hover:bg-white/5"}`} aria-label={playing === file.name ? `Pause ${file.name}` : `Play ${file.name}`} title={playing === file.name ? "Pause" : "Play"}>
                          <ActionIcon name={playing === file.name ? "pause" : "play"} />
                        </button>
                        <div className="min-w-0">
                          <p className="truncate font-mono text-xs font-semibold" title={file.name}>{file.name}</p>
                          <span className="mt-1 inline-flex rounded-md border border-card bg-background px-1.5 py-0.5 text-[10px] font-semibold text-muted">{extensionOf(file.name)}</span>
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-muted">{formatBytes(file.size)}</td>
                  <td className="px-4 py-3.5 text-muted">{formatDate(file.modifiedAt)}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex justify-end gap-1.5">
                      <button type="button" className={iconButton} onClick={() => openEditor(file)} disabled={controlsDisabled} aria-label={`Edit audio ${file.name}`} title="Open audio editor"><ActionIcon name="sparkles" /></button>
                      <button type="button" className={iconButton} onClick={() => recordingTarget === file.name ? stopRecording() : void startRecording(file.name, true)} disabled={busy || Boolean(recordingTarget && recordingTarget !== file.name)} aria-label={recordingTarget === file.name ? `Stop recording ${file.name}` : `Record replacement for ${file.name}`} title={recordingTarget === file.name ? "Stop and replace" : "Record a replacement"}><ActionIcon name={recordingTarget === file.name ? "stop" : "mic"} /></button>
                      <button type="button" className={iconButton} onClick={() => { setRenaming(file.name); setNextName(file.name); }} disabled={controlsDisabled || renaming === file.name} aria-label={`Rename ${file.name}`} title="Rename file"><ActionIcon name="edit" /></button>
                      <button type="button" className={`${iconButton} hover:border-red-500/40 hover:text-red-600`} onClick={() => void remove(file.name)} disabled={controlsDisabled} aria-label={`Delete ${file.name}`} title="Delete file"><ActionIcon name="trash" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && visibleFiles.length === 0 ? <tr><td colSpan={4} className="px-4 py-14 text-center text-muted">No matching audio files.</td></tr> : null}
              {loading ? <tr><td colSpan={4} className="px-4 py-14 text-center text-muted">Loading audio library…</td></tr> : null}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-card bg-background/40 px-5 py-3 text-xs text-muted">
          <span>{visibleFiles.length} of {files.length} files</span>
          <span>Managed folder: public/audio/anki-media · filenames must be unique across public/audio</span>
        </div>
      </section>
    </div>
  );
}
