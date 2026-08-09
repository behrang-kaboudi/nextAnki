"use client";

import { useState } from "react";

type PromptSourcesButtonProps = {
  paths: readonly string[];
  inlinePromptParts?: readonly string[];
  label?: string;
};

export function PromptSourcesButton({
  paths,
  inlinePromptParts = [],
  label,
}: PromptSourcesButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const uniquePaths = [...new Set(paths.filter(Boolean))];
  const inlineParts = inlinePromptParts.map((part) => part.trim()).filter(Boolean);
  const fileOnly = inlineParts.length === 0;

  const copyPaths = async () => {
    await navigator.clipboard.writeText(uniquePaths.join("\n"));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`rounded border px-2 py-1 text-xs font-semibold transition hover:bg-black/5 dark:hover:bg-white/5 ${
          fileOnly
            ? "border-emerald-500/40 text-emerald-800 dark:text-emerald-300"
            : "border-red-500/50 bg-red-500/10 text-red-800 dark:text-red-300"
        }`}
      >
        {label ?? `PROMPT FILES (${uniquePaths.length})`}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Prompt sources"
          onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}
        >
          <div className="flex max-h-[85vh] w-full max-w-3xl flex-col gap-4 overflow-hidden rounded-2xl border border-card bg-background p-5 shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">Prompt sources</h2>
                <p className="mt-1 text-xs text-muted">
                  Files used to assemble this prompt. Runtime JSON and user input are not prompt source files.
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded border px-3 py-1.5 text-sm">
                Close
              </button>
            </div>

            <div
              role={fileOnly ? "status" : "alert"}
              className={`rounded-xl border p-3 text-sm font-semibold ${
                fileOnly
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                  : "border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-300"
              }`}
            >
              {fileOnly
                ? "FILE-ONLY PROMPT — no inline prompt instructions are registered for this flow."
                : "NON-FILE PROMPT DETECTED — move the instructions shown below into prompt files if this is an application-managed prompt."}
            </div>

            <div className="min-h-0 overflow-auto rounded-xl border border-card">
              {uniquePaths.length ? (
                <ol className="divide-y divide-card">
                  {uniquePaths.map((path, index) => (
                    <li key={path} className="flex gap-3 px-4 py-3 text-sm">
                      <span className="text-muted">{index + 1}.</span>
                      <code className="break-all font-mono text-xs">{path}</code>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="p-4 text-sm text-red-700">No prompt source file is registered.</p>
              )}
            </div>

            {!fileOnly ? (
              <div className="min-h-0 overflow-auto rounded-xl border border-red-500/30 bg-red-500/5 p-3">
                <div className="mb-2 text-xs font-semibold text-red-800">Non-file prompt text</div>
                {inlineParts.map((part, index) => (
                  <pre key={`${index}-${part}`} className="whitespace-pre-wrap break-words font-mono text-xs leading-5">
                    {part}
                  </pre>
                ))}
              </div>
            ) : null}

            <div className="flex justify-end">
              <button
                type="button"
                disabled={!uniquePaths.length}
                onClick={() => void copyPaths()}
                className="rounded border px-3 py-2 text-sm disabled:opacity-50"
              >
                {copied ? "Copied" : "Copy paths"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
