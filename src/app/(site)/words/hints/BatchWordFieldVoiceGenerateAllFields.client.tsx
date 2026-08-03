"use client";

import { useCallback, useState } from "react";

import { ActionIcon } from "@/components/icons";
import { WORD_AUDIO_FIELDS, type WordAudioFieldKey } from "@/lib/audio/wordFieldAudioNaming";

type StartOk = {
  ok: true;
  status?: { jobId?: string; running?: boolean; done?: boolean };
  error?: string;
};

type StartErr = {
  ok?: false;
  error?: string;
};

async function apiStartField(field: WordAudioFieldKey) {
  const res = await fetch("/api/words/field-voice-generate-all", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ field }),
  });
  const data = (await res.json().catch(() => null)) as (StartOk | StartErr) | null;
  if (!res.ok || data?.ok !== true) throw new Error(data?.error || `Request failed (${res.status})`);
  return data.status ?? null;
}

export default function BatchWordFieldVoiceGenerateAllFields() {
  const fields = WORD_AUDIO_FIELDS;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (busy) return;
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

      setStatusText(`started=${started.length}/${fields.length}${failed.length ? ` failed=${failed.length}` : ""}`);
      if (failed.length) setError(failed[0] ?? "Unknown error");
    } finally {
      setBusy(false);
    }
  }, [busy, fields]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void run()}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded border px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
        title="Generate audio for all fields (ALL)"
      >
        {busy ? <span className="animate-pulse opacity-70">…</span> : <ActionIcon name="sparkles" className="size-4" />}
        ALL fields
      </button>
      {statusText ? <span className="text-xs opacity-70">{statusText}</span> : null}
      {error ? <span className="max-w-[520px] truncate text-xs text-red-600" title={error}>{error}</span> : null}
    </div>
  );
}
