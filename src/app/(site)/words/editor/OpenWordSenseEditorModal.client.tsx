"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import WordEditorClient from "./[id]/word-sense-editor.client";
import type { WordEditorInitial } from "@/lib/words/editorPayload";

type LoadState =
  | { status: "idle"; item: null; error: null }
  | { status: "loading"; item: null; error: null }
  | { status: "ready"; item: WordEditorInitial; error: null }
  | { status: "error"; item: null; error: string };

export default function OpenWordSenseEditorModal({
  id,
  label,
}: {
  id: number;
  label: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [state, setState] = useState<LoadState>({ status: "idle", item: null, error: null });

  const close = useCallback(() => {
    if (dirty && !window.confirm("You have unsaved changes. Close without saving?")) return;
    setOpen(false);
  }, [dirty]);

  const openEditor = useCallback(() => {
    setDirty(false);
    setState({ status: "loading", item: null, error: null });
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();

    fetch(`/api/words/editor/${id}`, { signal: controller.signal })
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as
          | { ok?: boolean; item?: WordEditorInitial; error?: string }
          | null;
        if (!res.ok || json?.ok !== true || !json.item) {
          throw new Error(json?.error || `Request failed (${res.status})`);
        }
        setState({ status: "ready", item: json.item, error: null });
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        setState({ status: "error", item: null, error: e instanceof Error ? e.message : String(e) });
      });

    return () => controller.abort();
  }, [id, open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close, open]);

  return (
    <>
      <button
        type="button"
        onClick={openEditor}
        className="rounded border px-2 py-1 text-[11px] hover:bg-black/5 dark:hover:bg-white/5"
      >
        Open
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 bg-black/45 p-3 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`Edit word ${label}`}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="mx-auto flex h-full w-full max-w-[96rem] flex-col overflow-hidden rounded-2xl border border-card bg-background shadow-elevated">
            <div className="flex items-center justify-between gap-3 border-b border-card bg-background/95 px-4 py-3 backdrop-blur sm:px-5">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">
                  Edit WordSense #{id} — {label}
                </div>
                <div className="text-xs opacity-70">Loaded in-place from /words/editor</div>
              </div>
              <button
                type="button"
                onClick={close}
                className="rounded border px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
              >
                Close
              </button>
            </div>

            <div className="flex-1 overflow-auto p-3 sm:p-5">
              {state.status === "loading" ? (
                <div className="rounded border border-card p-4 text-sm opacity-75">Loading…</div>
              ) : null}
              {state.status === "error" ? (
                <div className="rounded border border-red-500/30 bg-red-600/10 p-4 text-sm text-red-700">
                  {state.error}
                </div>
              ) : null}
              {state.status === "ready" ? (
                <WordEditorClient
                  initial={state.item}
                  floatingActions={false}
                  onDirtyChange={setDirty}
                  onSaved={() => router.refresh()}
                  onSaveAndClose={() => setOpen(false)}
                />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
