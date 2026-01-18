"use client";

import { useEffect, useMemo, useState } from "react";

type PromptFile = { path: string; bytes: number };

function removeIncludedTextBlock(source: string, fileText: string): string {
  const needle = `${fileText}\n`;
  const idx = source.indexOf(needle);
  if (idx === -1) return source;
  const before = source.slice(0, idx).trimEnd();
  const after = source.slice(idx + needle.length).trimStart();
  if (!before) return after;
  if (!after) return before;
  return `${before}\n\n${after}`;
}

export function PromptBuilderClient() {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<PromptFile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [filesError, setFilesError] = useState<string>("");
  const [appendError, setAppendError] = useState<string>("");
  const [appendedByPath, setAppendedByPath] = useState<Map<string, string>>(
    new Map()
  );
  const [viewOpen, setViewOpen] = useState(false);
  const [viewPath, setViewPath] = useState<string>("");
  const [viewText, setViewText] = useState<string>("");
  const [viewLoading, setViewLoading] = useState(false);
  const [viewSaving, setViewSaving] = useState(false);
  const [viewError, setViewError] = useState<string>("");

  const refreshFiles = async () => {
    setLoadingFiles(true);
    setFilesError("");
    try {
      const res = await fetch("/api/ai/prompt-files", { cache: "no-store" });
      const json = (await res.json()) as { files?: PromptFile[]; error?: string };
      if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
      if (!Array.isArray(json.files)) throw new Error("Unexpected response");
      setFiles(json.files);
    } catch (e) {
      setFilesError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingFiles(false);
    }
  };

  const openViewer = async (filePath: string) => {
    setViewOpen(true);
    setViewPath(filePath);
    setViewText("");
    setViewError("");
    setViewLoading(true);
    try {
      const res = await fetch(
        `/api/ai/prompt-file?path=${encodeURIComponent(filePath)}`,
        { cache: "no-store" }
      );
      const json = (await res.json()) as { text?: string; error?: string };
      if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
      setViewText(String(json.text ?? ""));
    } catch (e) {
      setViewError(e instanceof Error ? e.message : String(e));
    } finally {
      setViewLoading(false);
    }
  };

  const saveViewer = async () => {
    if (!viewPath) return;
    setViewSaving(true);
    setViewError("");
    try {
      const res = await fetch("/api/ai/prompt-file", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: viewPath, text: viewText }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
      await refreshFiles();
      setViewOpen(false);
    } catch (e) {
      setViewError(e instanceof Error ? e.message : String(e));
    } finally {
      setViewSaving(false);
    }
  };

  useEffect(() => {
    let canceled = false;
    fetch("/api/ai/prompt-files", { cache: "no-store" })
      .then(async (res) => {
        const json = (await res.json()) as { files?: PromptFile[]; error?: string };
        if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
        if (!Array.isArray(json.files)) throw new Error("Unexpected response");
        if (!canceled) setFiles(json.files);
      })
      .catch((e) => {
        if (!canceled) setFilesError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!canceled) setLoadingFiles(false);
      });
    return () => {
      canceled = true;
    };
  }, []);

  const filePathSet = useMemo(() => new Set(files.map((f) => f.path)), [files]);
  const selectedCount = useMemo(() => {
    let count = 0;
    for (const p of selected) if (filePathSet.has(p)) count += 1;
    return count;
  }, [filePathSet, selected]);
  const totalFiles = files.length;

  const sortedSelected = useMemo(
    () => Array.from(selected).filter((p) => filePathSet.has(p)).sort(),
    [filePathSet, selected]
  );
  const filteredFiles = useMemo(() => {
    const copy = [...files];
    copy.sort((a, b) => {
      const aSel = selected.has(a.path) ? 1 : 0;
      const bSel = selected.has(b.path) ? 1 : 0;
      if (aSel !== bSel) return bSel - aSel; // selected first
      return a.path.localeCompare(b.path);
    });
    return copy;
  }, [files, selected]);

  return (
      <div className="grid gap-4 rounded-3xl border border-card bg-card p-4 shadow-elevated sm:p-6">
      <div className="grid gap-4 lg:grid-cols-4">
        <div className="grid gap-3 lg:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="grid">
              <div className="text-sm font-semibold text-foreground">Prompt</div>
              <div className="text-xs text-muted">
                Write your draft prompt. File selection is for the next step.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setText("")}
                className="rounded-xl border border-card bg-background px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-card"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(text);
                }}
                disabled={!text.trim()}
                className="rounded-xl bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-[var(--primary-foreground)] shadow-elevated transition hover:opacity-95 disabled:opacity-60"
              >
                Copy
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-card bg-background shadow-elevated">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={18}
              spellCheck={false}
              className="w-full resize-y bg-transparent p-4 font-mono text-xs leading-6 text-foreground outline-none"
              placeholder="Write your prompt here…"
            />
          </div>

          {appendError ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700">
              {appendError}
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 lg:col-span-1">
          <div className="flex items-start justify-between gap-3">
            <div className="grid">
              <div className="text-sm font-semibold text-foreground">Prompt files</div>
              <div className="text-xs text-muted">
                {selectedCount} selected • {totalFiles} files
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={refreshFiles}
                disabled={loadingFiles}
                title="Refresh"
                aria-label="Refresh prompt files"
                className="inline-flex items-center justify-center rounded-xl border border-card bg-background p-2 text-foreground transition hover:bg-card disabled:opacity-60"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                  <path d="M21 3v6h-6" />
                </svg>
              </button>
              <div className="inline-flex items-center rounded-full border border-card bg-background px-2.5 py-1 text-[11px] font-semibold text-foreground">
                {selectedCount}/{totalFiles} files
              </div>
            </div>
          </div>

          {loadingFiles ? (
            <div className="rounded-2xl border border-card bg-background p-3 text-sm text-muted">
              Loading…
            </div>
          ) : filesError ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700">
              {filesError}
            </div>
          ) : (
            <div className="max-h-[520px] overflow-auto rounded-2xl border border-card bg-background">
              <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-card bg-background px-3 py-2">
                <div className="text-[11px] font-semibold text-muted">
                  {filteredFiles.length} shown
                </div>
                <div className="text-[11px] text-muted">Click to toggle</div>
              </div>
              <div className="grid gap-1 p-2">
                {filteredFiles.map((f) => {
                  const checked = selected.has(f.path);
                  return (
                    <label
                      key={f.path}
                      className={`flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 text-xs transition ${
                        checked
                          ? "bg-[var(--primary)]/10 text-foreground"
                          : "text-foreground hover:bg-card"
                      }`}
                      title={f.path}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setAppendError("");
                          const next = new Set(selected);
                          if (e.target.checked) next.add(f.path);
                          else next.delete(f.path);
                          setSelected(next);

                          if (e.target.checked) {
                            fetch(
                              `/api/ai/prompt-file?path=${encodeURIComponent(f.path)}`,
                              { cache: "no-store" }
                            )
                              .then(async (res) => {
                                const json = (await res.json()) as {
                                  path?: string;
                                  text?: string;
                                  error?: string;
                                };
                                if (!res.ok)
                                  throw new Error(
                                    json.error || `Request failed (${res.status})`
                                  );
                                const fileText = String(json.text ?? "").trim();
                                if (!fileText) return;
                                setAppendedByPath((prevMap) => {
                                  const nextMap = new Map(prevMap);
                                  nextMap.set(f.path, fileText);
                                  return nextMap;
                                });
                                setText((prev) => {
                                  const prefix = prev.trimEnd()
                                    ? `${prev.trimEnd()}\n\n`
                                    : "";
                                  return prefix + `${fileText}\n`;
                                });
                              })
                              .catch((err) => {
                                setAppendError(
                                  err instanceof Error ? err.message : String(err)
                                );
                              });
                          } else {
                            const fileText = appendedByPath.get(f.path);
                            if (fileText) {
                              setText((prev) => removeIncludedTextBlock(prev, fileText));
                              setAppendedByPath((prevMap) => {
                                const nextMap = new Map(prevMap);
                                nextMap.delete(f.path);
                                return nextMap;
                              });
                            }
                          }
                        }}
                        className="h-4 w-4 accent-[var(--primary)]"
                      />
                      <span className="min-w-0 flex-1 truncate">{f.path}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void openViewer(f.path);
                        }}
                        title="View / Edit"
                        aria-label={`View ${f.path}`}
                        className="inline-flex shrink-0 items-center justify-center rounded-lg border border-card bg-background p-1.5 text-foreground transition hover:bg-card"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="h-4 w-4"
                        >
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                        </svg>
                      </button>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {sortedSelected.length > 0 ? (
            <div className="rounded-2xl border border-card bg-background p-3 text-xs text-muted">
              First selected:{" "}
              <span className="font-mono text-foreground">{sortedSelected[0]}</span>
              {sortedSelected.length > 1 ? ` (+${sortedSelected.length - 1})` : ""}
            </div>
          ) : (
            <div className="rounded-2xl border border-card bg-background p-3 text-xs text-muted">
              Select files to include later.
            </div>
          )}
        </div>
      </div>

      {viewOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setViewOpen(false);
          }}
        >
          <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-card bg-card shadow-elevated">
            <div className="flex items-center justify-between gap-3 border-b border-card bg-background px-4 py-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground">Edit prompt file</div>
                <div className="truncate font-mono text-xs text-muted" title={viewPath}>
                  {viewPath}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewOpen(false)}
                  className="rounded-xl border border-card bg-background px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-card"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => void saveViewer()}
                  disabled={viewSaving || viewLoading}
                  className="rounded-xl bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-[var(--primary-foreground)] shadow-elevated transition hover:opacity-95 disabled:opacity-60"
                >
                  {viewSaving ? "Updating…" : "Update"}
                </button>
              </div>
            </div>

            <div className="grid gap-3 p-4">
              {viewError ? (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700">
                  {viewError}
                </div>
              ) : null}

              <div className="overflow-hidden rounded-2xl border border-card bg-background">
                <textarea
                  value={viewText}
                  onChange={(e) => setViewText(e.target.value)}
                  rows={18}
                  spellCheck={false}
                  disabled={viewLoading}
                  className="w-full resize-y bg-transparent p-4 font-mono text-xs leading-6 text-foreground outline-none disabled:opacity-60"
                  placeholder={viewLoading ? "Loading…" : ""}
                />
              </div>
              <div className="text-xs text-muted">
                Saving overwrites the file on disk.
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
