"use client";

import { useEffect, useMemo, useState } from "react";

type PreviewItem = {
  id: number;
  prevJson: string | null;
  nextJson: string | null;
  changed: boolean;
};

function prettyJson(value: string | null) {
  const s = (value ?? "").trim();
  if (!s) return null;

  const normalized = s.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  try {
    return JSON.stringify(JSON.parse(normalized) as unknown, null, 2);
  } catch {
    return normalized;
  }
}


export default function JsonHintPreviewModal({
  wordId,
  currentJsonHint,
}: {
  wordId: number;
  currentJsonHint: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewItem | null>(null);

  const currentPretty = useMemo(
    () => prettyJson(currentJsonHint),
    [currentJsonHint],
  );
  const nextPretty = useMemo(() => prettyJson(preview?.nextJson ?? null), [preview?.nextJson]);

  async function loadPreview() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/words/json-hint-preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: [wordId] }),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; items?: PreviewItem[] }
        | null;
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? `Request failed (${res.status})`);
      const item = Array.isArray(json.items) ? json.items.find((x) => x?.id === wordId) ?? null : null;
      setPreview(item);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    void loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border px-2 py-1 text-[11px] hover:bg-black/5 dark:hover:bg-white/5"
        title="Compute json_hint preview for this row (no DB updates)"
      >
        Preview
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="flex w-full max-w-5xl flex-col rounded-2xl border border-card bg-background p-4 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-semibold">json_hint preview</div>
            <div className="mt-1 text-xs opacity-80">
              WordSense #{wordId} • {preview ? (preview.changed ? "changed" : "no change") : "—"}
              {loading ? " • loading…" : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadPreview()}
              disabled={loading}
              className="rounded border px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded border px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
            >
              Close
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-3 rounded border border-red-500/30 bg-red-600/10 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="grid gap-2">
            <div className="text-xs font-semibold text-muted">Current json_hint (DB)</div>
            <pre className="min-h-[16rem] whitespace-pre-wrap break-words rounded-xl border border-card bg-background p-3 font-mono text-xs text-foreground">
              {currentPretty ?? "—"}
            </pre>
          </div>
          <div className="grid gap-2">
            <div className="text-xs font-semibold text-muted">Computed preview</div>
            <pre className="min-h-[16rem] whitespace-pre-wrap break-words rounded-xl border border-card bg-background p-3 font-mono text-xs text-foreground">
              {nextPretty ?? (preview ? (preview.changed ? "—" : "No change") : "—")}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
