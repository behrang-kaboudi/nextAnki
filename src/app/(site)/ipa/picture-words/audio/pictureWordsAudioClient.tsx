"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const LS_PLAY_VOL = "audio.playVolume";
const LS_MIC_GAIN = "audio.micGain";
const LS_NORMALIZE = "audio.normalizeOnUpload";
const LS_DSP = "audio.dspOnRecord";

function loadNumber(key: string, fallback: number) {
  try {
    const v = Number(localStorage.getItem(key));
    return Number.isFinite(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

function loadBool(key: string, fallback: boolean) {
  try {
    const v = localStorage.getItem(key);
    if (v == null) return fallback;
    return v === "1";
  } catch {
    return fallback;
  }
}

function saveBool(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? "1" : "0");
  } catch {}
}

function saveNumber(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value));
  } catch {}
}

type Loudness = { rmsDb: number | null; peakDb: number | null };

type Row = {
  id: number;
  fa: string;
  ipa_fa: string;
  phinglish: string;
  en: string;
  type: string;
  ipaVerified: boolean;
  hasAudio: boolean;
  audioFile: string | null;
  audioUrl: string | null;
  loudness: Loudness;
};

type SortMode = "missingAudio" | "id" | "loudness";

function formatDb(v: number | null | undefined) {
  if (v == null) return "—";
  if (v === Infinity) return "inf";
  if (v === -Infinity) return "-inf";
  if (Number.isNaN(v)) return "—";
  return v.toFixed(1);
}

async function apiList(q: string, sort: SortMode) {
  const url = `/api/ipa/picture-words/audio/list?q=${encodeURIComponent(q)}&sort=${encodeURIComponent(sort)}`;
  const res = await fetch(url, { cache: "no-store" });
  const json = (await res.json()) as { rows: Row[]; error?: string };
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json.rows;
}

async function apiUpload(id: number, blob: Blob, normalize: boolean) {
  const fd = new FormData();
  fd.append("id", String(id));
  fd.append("file", blob, `${id}.webm`);
  if (normalize) fd.append("normalize", "1");
  const res = await fetch("/api/ipa/picture-words/audio/upload", { method: "POST", body: fd });
  const json = (await res.json()) as { ok?: boolean; error?: string; url?: string; file?: string; loudness?: Loudness };
  if (!res.ok || !json.ok) throw new Error(json.error || `Upload failed (${res.status})`);
  return json;
}

async function apiDeleteAudio(id: number) {
  const res = await fetch("/api/ipa/picture-words/audio/delete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id }),
  });
  const json = (await res.json()) as { ok?: boolean; error?: string; deleted?: number };
  if (!res.ok || !json.ok) throw new Error(json.error || `Delete failed (${res.status})`);
  return json;
}

async function apiUpdateIpa(id: number, ipa_fa: string) {
  const res = await fetch("/api/ipa/picture-words", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id, data: { ipa_fa } }),
  });
  const json = (await res.json()) as { row?: { ipa_fa?: string }; error?: string };
  if (!res.ok) throw new Error(json.error || `Update failed (${res.status})`);
  return json;
}

function KeyRow({
  item,
  onRefresh,
  playVolume,
  micGain,
  dspOnRecord,
  normalizeOnUpload,
}: {
  item: Row;
  onRefresh: () => void;
  playVolume: number;
  micGain: number;
  dspOnRecord: boolean;
  normalizeOnUpload: boolean;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const audioGraphRef = useRef<{ audioContext: AudioContext; stream: MediaStream } | null>(null);
  const playAfterStopRef = useRef(false);
  const previewUrlRef = useRef("");
  const cancelRecordingRef = useRef(false);

  const [localAudioUrl, setLocalAudioUrl] = useState(item.audioUrl || "");
  const [localLoudness, setLocalLoudness] = useState<Loudness>(item.loudness || { rmsDb: null, peakDb: null });
  const [ipaValue, setIpaValue] = useState(item.ipa_fa || "");
  const [ipaSaving, setIpaSaving] = useState(false);

  useEffect(() => setLocalAudioUrl(item.audioUrl || ""), [item.audioUrl]);
  useEffect(() => setLocalLoudness(item.loudness || { rmsDb: null, peakDb: null }), [item.loudness]);
  useEffect(() => setIpaValue(item.ipa_fa || ""), [item.ipa_fa]);

  useEffect(() => {
    return () => {
      try {
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      } catch {}
    };
  }, []);

  async function play() {
    if (isRecording) {
      playAfterStopRef.current = true;
      stopRecording();
      return;
    }
    const src = localAudioUrl;
    if (!src) return;
    const audio = new Audio(src);
    audio.volume = typeof playVolume === "number" ? playVolume : 1;
    await audio.play();
  }

  async function startRecording() {
    setError("");
    cancelRecordingRef.current = false;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        autoGainControl: false,
        echoCancellation: Boolean(dspOnRecord),
        noiseSuppression: Boolean(dspOnRecord),
      },
    });
    const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
    let recordStream: MediaStream = stream;

    try {
      const gainValue = typeof micGain === "number" ? micGain : 1;
      if (gainValue !== 1 && window.AudioContext) {
        const audioContext = new AudioContext();
        await audioContext.resume();
        const source = audioContext.createMediaStreamSource(stream);
        const gainNode = audioContext.createGain();
        gainNode.gain.value = gainValue;
        const destination = audioContext.createMediaStreamDestination();
        source.connect(gainNode);
        gainNode.connect(destination);
        recordStream = destination.stream;
        audioGraphRef.current = { audioContext, stream };
      }
    } catch {
      audioGraphRef.current = null;
    }

    const recorder = new MediaRecorder(recordStream, mimeType ? { mimeType } : {});
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = async () => {
      try {
        const g = audioGraphRef.current;
        if (g?.stream) g.stream.getTracks().forEach((t) => t.stop());
        else stream.getTracks().forEach((t) => t.stop());
        if (g?.audioContext) await g.audioContext.close();
      } catch {}
      audioGraphRef.current = null;

      if (cancelRecordingRef.current) {
        cancelRecordingRef.current = false;
        playAfterStopRef.current = false;
        chunksRef.current = [];
        return;
      }

      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      chunksRef.current = [];

      if (playAfterStopRef.current) {
        playAfterStopRef.current = false;
        try {
          if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
          previewUrlRef.current = URL.createObjectURL(blob);
          const audio = new Audio(previewUrlRef.current);
          audio.volume = typeof playVolume === "number" ? playVolume : 1;
          audio.play().catch(() => {});
        } catch {}
      }

      await uploadBlob(blob);
    };

    recorderRef.current = recorder;
    recorder.start();
    setIsRecording(true);
  }

  function stopRecording() {
    try {
      recorderRef.current?.stop();
    } catch {}
    setIsRecording(false);
  }

  function cancelRecording() {
    cancelRecordingRef.current = true;
    try {
      chunksRef.current = [];
    } catch {}
    try {
      recorderRef.current?.stop();
    } catch {}
    setIsRecording(false);
  }

  async function uploadBlob(blob: Blob) {
    try {
      setIsUploading(true);
      setError("");
      const res = await apiUpload(item.id, blob, normalizeOnUpload);
      setLocalAudioUrl(res.url || "");
      setLocalLoudness(res.loudness || { rmsDb: null, peakDb: null });
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload error");
    } finally {
      setIsUploading(false);
    }
  }

  const ipaDirty = (ipaValue || "").trim() !== String(item.ipa_fa || "").trim();

  async function saveIpa() {
    const newVal = (ipaValue || "").trim();
    if (!newVal) return;
    setIpaSaving(true);
    setError("");
    try {
      await apiUpdateIpa(item.id, newVal);
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save ipa");
    } finally {
      setIpaSaving(false);
    }
  }

  async function deleteAudio() {
    const ok = window.confirm(`Delete audio files for:\n\n${item.fa}\n${item.phinglish} / ${item.en}\n#${item.id}`);
    if (!ok) return;
    setError("");
    try {
      await apiDeleteAudio(item.id);
      setLocalAudioUrl("");
      setLocalLoudness({ rmsDb: null, peakDb: null });
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete audio");
    }
  }

  return (
    <div className={`rounded-2xl border border-card bg-card p-4 shadow-elevated ${item.hasAudio ? "" : "bg-red-50/40"}`}>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="text-xl font-semibold [direction:rtl]">{item.fa}</div>
          <div className="text-sm text-muted">—</div>
          <div className="text-base font-semibold">{item.en}</div>
          <div className="ml-auto text-xs text-muted">{item.phinglish}</div>
        </div>

        <div className="flex flex-nowrap items-center gap-2 overflow-x-auto">
          <input
            value={ipaValue}
            onChange={(e) => setIpaValue(e.target.value)}
            className="min-w-[220px] flex-1 rounded-xl border border-card bg-background px-3 py-2 font-mono text-base font-semibold"
            placeholder="ipa_fa…"
          />
          <button
            type="button"
            onClick={() => void saveIpa()}
            disabled={!ipaDirty || ipaSaving}
            className="whitespace-nowrap rounded-xl border border-card bg-background px-3 py-2 text-sm font-semibold text-foreground disabled:opacity-50"
            title="Save IPA"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => void deleteAudio()}
            className="whitespace-nowrap rounded-xl border border-card bg-background px-3 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
            title="Delete audio"
            disabled={isUploading || isRecording || (!item.hasAudio && !localAudioUrl)}
          >
            Delete audio
          </button>
          <button
            type="button"
            onClick={() => void play()}
            disabled={(!isRecording && !localAudioUrl) || isUploading}
            className="whitespace-nowrap rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] disabled:opacity-60"
          >
            Play
          </button>
          <button
            type="button"
            onClick={() => (isRecording ? stopRecording() : void startRecording())}
            disabled={isUploading}
            className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${isRecording ? "bg-orange-500" : "bg-purple-600"}`}
          >
            {isRecording ? "Stop" : "Record"}
          </button>
          {isRecording ? (
            <button
              type="button"
              onClick={() => cancelRecording()}
              disabled={isUploading}
              className="whitespace-nowrap rounded-xl border border-card bg-background px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-60"
            >
              Cancel
            </button>
          ) : null}
          {isUploading ? <div className="whitespace-nowrap text-sm text-muted">Uploading…</div> : null}
        </div>
      </div>

      {error ? <div className="mt-2 text-sm text-red-700">{error}</div> : null}

      {localAudioUrl ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="font-mono">{item.audioFile || localAudioUrl}</span>
          <span>| Vol (RMS/Peak dB): {formatDb(localLoudness?.rmsDb)} / {formatDb(localLoudness?.peakDb)}</span>
        </div>
      ) : null}
    </div>
  );
}

export function PictureWordsAudioClient() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("missingAudio");

  const [playVolume, setPlayVolume] = useState(() => loadNumber(LS_PLAY_VOL, 1));
  const [micGain, setMicGain] = useState(() => loadNumber(LS_MIC_GAIN, 3));
  const [normalizeOnUpload, setNormalizeOnUpload] = useState(() => loadBool(LS_NORMALIZE, false));
  const [dspOnRecord, setDspOnRecord] = useState(() => loadBool(LS_DSP, true));

  function forceMaxLevels() {
    setPlayVolume(1);
    setMicGain(3);
    saveNumber(LS_PLAY_VOL, 1);
    saveNumber(LS_MIC_GAIN, 3);
  }

  useEffect(() => {
    forceMaxLevels();
    setNormalizeOnUpload(false);
    saveBool(LS_NORMALIZE, false);
  }, []);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === LS_PLAY_VOL || e.key === LS_MIC_GAIN) forceMaxLevels();
      if (e.key === LS_NORMALIZE) setNormalizeOnUpload(loadBool(LS_NORMALIZE, false));
      if (e.key === LS_DSP) setDspOnRecord(loadBool(LS_DSP, true));
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const rows = await apiList(query, sortMode);
      setItems(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortMode]);

  const filtered = useMemo(() => items, [items]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const withAudio = filtered.reduce((acc, it) => acc + (it.hasAudio ? 1 : 0), 0);
    return { total, withAudio };
  }, [filtered]);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="text-2xl font-semibold">PictureWord Audio</div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-xl border border-card bg-background px-3 py-2 text-sm font-semibold text-foreground disabled:opacity-60"
        >
          Refresh
        </button>
        {loading ? <div className="text-sm text-muted">Loading…</div> : null}
        <div className="ml-auto text-sm text-muted">
          Total: {stats.total} | With audio: {stats.withAudio} | Missing: {stats.total - stats.withAudio}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-muted">
          Sort
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="ml-2 rounded-xl border border-card bg-background px-3 py-2 text-sm"
          >
            <option value="missingAudio">Missing audio first</option>
            <option value="id">Id</option>
            <option value="loudness">Loudness (RMS dB)</option>
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={normalizeOnUpload}
            onChange={(e) => {
              setNormalizeOnUpload(e.target.checked);
              saveBool(LS_NORMALIZE, e.target.checked);
            }}
          />
          Normalize (louder)
        </label>

        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={dspOnRecord}
            onChange={(e) => {
              setDspOnRecord(e.target.checked);
              saveBool(LS_DSP, e.target.checked);
            }}
          />
          Clean voice (DSP)
        </label>

        <label className="min-w-[260px] flex-1 text-sm text-muted">
          Input volume ({micGain.toFixed(2)}x)
          <input
            type="range"
            min={0.25}
            max={3}
            step={0.05}
            value={micGain}
            onChange={(e) => {
              const v = Number(e.target.value);
              setMicGain(v);
              saveNumber(LS_MIC_GAIN, v);
            }}
            className="w-full"
          />
        </label>

        <label className="min-w-[260px] flex-1 text-sm text-muted">
          Output volume ({Math.round(playVolume * 100)}%)
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={playVolume}
            onChange={(e) => {
              const v = Number(e.target.value);
              setPlayVolume(v);
              saveNumber(LS_PLAY_VOL, v);
            }}
            className="w-full"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-w-[320px] flex-1 rounded-xl border border-card bg-background px-3 py-2 text-sm"
          placeholder="Search (fa / ipa / phinglish / en / id)"
        />
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)] disabled:opacity-60"
        >
          Apply search
        </button>
      </div>

      {error ? <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700">{error}</div> : null}

      <div className="grid gap-3">
        {filtered.map((item) => (
          <KeyRow
            key={item.id}
            item={item}
            onRefresh={() => void load()}
            playVolume={playVolume}
            micGain={micGain}
            dspOnRecord={dspOnRecord}
            normalizeOnUpload={normalizeOnUpload}
          />
        ))}
      </div>
    </div>
  );
}
