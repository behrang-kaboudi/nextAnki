"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type FileInfo = {
  filename: string;
  timestampMs: number;
  size: number;
  publicPath: string;
};

type Group = {
  ankiLinkIdPart: string;
  field: string;
  keep: FileInfo;
  duplicates: FileInfo[];
};

function Code({ children }: { children: React.ReactNode }) {
  return (
    <span dir="ltr" className="rounded bg-black/5 px-1 py-0.5 font-mono text-[11px] dark:bg-white/10">
      {children}
    </span>
  );
}

function formatBytes(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  const fixed = i === 0 ? String(Math.trunc(v)) : v.toFixed(v >= 10 ? 1 : 2);
  return `${fixed} ${units[i]}`;
}

export default function WordFieldVoiceDuplicatesModal() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const duplicateFiles = useMemo(() => groups.reduce((sum, g) => sum + (g.duplicates?.length ?? 0), 0), [groups]);
  const duplicateBytes = useMemo(
    () => groups.reduce((sum, g) => sum + g.duplicates.reduce((s, f) => s + (f.size ?? 0), 0), 0),
    [groups]
  );

  const fetchGroups = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/words/field-voice-duplicates", { method: "GET" });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; groups?: Group[] }
        | null;
      if (!res.ok || data?.ok !== true) throw new Error(data?.error || `Request failed (${res.status})`);
      setGroups(Array.isArray(data.groups) ? data.groups : []);
    } catch (e) {
      setGroups([]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void fetchGroups();
  }, [fetchGroups, open]);

  const cleanup = useCallback(async () => {
    const ok = window.confirm("فایل‌های تکراری حذف شوند؟ (از هر فیلد فقط جدیدترین باقی می‌ماند)");
    if (!ok) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/words/field-voice-duplicates/cleanup", { method: "POST" });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string; deleted?: number; failed?: number; deletedBytes?: number }
        | null;
      if (!res.ok || data?.ok !== true) throw new Error(data?.error || `Request failed (${res.status})`);
      await fetchGroups();
      const deleted = typeof data.deleted === "number" ? data.deleted : 0;
      const failed = typeof data.failed === "number" ? data.failed : 0;
      const bytes = typeof data.deletedBytes === "number" ? data.deletedBytes : 0;
      if (failed > 0) setError(`حذف انجام شد، ولی ${failed} فایل حذف نشد. (deleted=${deleted}, freed=${formatBytes(bytes)})`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [fetchGroups]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
        title="List & cleanup duplicate audio files"
      >
        Duplicates
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div
            dir="rtl"
            lang="fa"
            className="flex h-[85vh] w-full max-w-4xl flex-col rounded border bg-background p-4 text-right shadow-lg"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold">فایل‌های تکراری صدا</div>
                <div className="mt-1 text-xs opacity-80">
                  معیار تکراری: <Code>(ankiLinkIdPart + field)</Code> بیش از 1 فایل داشته باشد؛ فقط جدیدترین نگه داشته می‌شود.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded border px-2 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/5"
              >
                Close
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm opacity-80">
                Groups: {groups.length} • Duplicate files: {duplicateFiles} • Est. free: {formatBytes(duplicateBytes)}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void fetchGroups()}
                  disabled={busy}
                  className="rounded border px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
                >
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={() => void cleanup()}
                  disabled={busy || duplicateFiles === 0}
                  className="rounded border px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
                >
                  حذف تکراری‌ها
                </button>
              </div>
            </div>

            {error ? (
              <div className="mt-3 rounded border border-red-500/40 bg-red-500/5 p-3 text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            ) : null}

            <div className="mt-4 min-h-0 flex-1 overflow-auto">
              {busy && groups.length === 0 ? (
                <div className="rounded border p-3 text-sm opacity-70">Loading…</div>
              ) : null}

              {groups.length === 0 && !busy ? (
                <div className="rounded border p-3 text-sm opacity-70">هیچ فایل تکراری پیدا نشد.</div>
              ) : null}

              <div className="space-y-3">
                {groups.map((g) => (
                  <div key={`${g.ankiLinkIdPart}::${g.field}`} className="rounded border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm">
                        <Code>{g.ankiLinkIdPart}</Code> • <Code>{g.field}</Code>
                      </div>
                      <div className="text-xs opacity-80">
                        duplicates: {g.duplicates.length}
                      </div>
                    </div>

                    <div className="mt-2 grid gap-2 md:grid-cols-2">
                      <div className="rounded border p-2">
                        <div className="text-xs font-semibold">Keep (newest)</div>
                        <div className="mt-1 text-xs">
                          <a className="font-mono underline" href={g.keep.publicPath} target="_blank" rel="noreferrer">
                            {g.keep.filename}
                          </a>
                          <div className="mt-1 opacity-70">
                            ts: <Code>{String(g.keep.timestampMs)}</Code> • size: {formatBytes(g.keep.size)}
                          </div>
                        </div>
                      </div>
                      <div className="rounded border p-2">
                        <div className="text-xs font-semibold">Delete</div>
                        <div className="mt-1 space-y-1 text-xs">
                          {g.duplicates.map((f) => (
                            <div key={f.filename} className="flex flex-wrap items-center justify-between gap-2">
                              <a className="max-w-full truncate font-mono underline" href={f.publicPath} target="_blank" rel="noreferrer">
                                {f.filename}
                              </a>
                              <span className="opacity-70">
                                {formatBytes(f.size)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded border px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

