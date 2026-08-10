"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

import { ModalPortal } from "@/components/modal-portal";

export type WordArrayRelationEntry = {
  id: number;
  baseForm: string | null;
  meaning: string | null;
  pos: string | null;
  conceptExplainedFa: string | null;
};

export default function WordArrayRelationModal({
  label,
  entries,
  children,
}: {
  label: string;
  entries: readonly WordArrayRelationEntry[];
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close, open]);

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Show Word records referenced by ${label}`}
        onClick={() => setOpen(true)}
        className="block max-w-full truncate text-left underline decoration-dotted underline-offset-4 hover:text-blue-700 dark:hover:text-blue-300"
      >
        {children}
      </button>

      {open ? (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-label={`Word records referenced by ${label}`}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) close();
            }}
          >
            <div className="flex max-h-[min(90dvh,48rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-card bg-background shadow-elevated">
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-card px-4 py-3 sm:px-6">
                <div className="min-w-0">
                  <div className="truncate text-base font-semibold">{label}</div>
                  <div className="text-xs opacity-70">
                    {entries.length} referenced Word {entries.length === 1 ? "record" : "records"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="rounded border px-3 py-2 text-sm transition active:scale-95 hover:bg-black/5 dark:hover:bg-white/5"
                >
                  Close
                </button>
              </div>

              <div className="overflow-auto p-3 sm:p-5">
                <table className="w-full min-w-[44rem] text-left text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="px-3 py-2">id</th>
                      <th className="px-3 py-2">base_form</th>
                      <th className="px-3 py-2">meaning</th>
                      <th className="px-3 py-2">pos</th>
                      <th className="px-3 py-2">concept_explained_fa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr key={entry.id} className="border-b align-top last:border-0">
                        <td className="whitespace-nowrap px-3 py-2 font-mono">{entry.id}</td>
                        <td className="px-3 py-2">{entry.baseForm ?? <span className="text-red-700">Missing Word</span>}</td>
                        <td className="px-3 py-2" dir="rtl">{entry.meaning ?? "—"}</td>
                        <td className="px-3 py-2">{entry.pos ?? "—"}</td>
                        <td className="max-w-md whitespace-pre-wrap px-3 py-2" dir="rtl">{entry.conceptExplainedFa ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </ModalPortal>
      ) : null}
    </>
  );
}
