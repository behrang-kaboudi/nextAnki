"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { ActionIcon } from "@/components/icons/ActionIcon";

type DeletePreview = {
  id: number;
  word: string;
  ankiLinkId: string;
  totalAudioFiles: number;
  audioFiles: Array<{ field: string; count: number; bytes: number }>;
  affectedWords: Array<{ id: number; word: string; removeFrom: string[] }>;
  sentence: {
    id: number;
    sentence_en: string;
    willBeDeleted: boolean;
    linkedWordCount: number;
  } | null;
};

const iconButtonClass =
  "rounded border p-1.5 text-red-700 transition active:scale-90 hover:bg-red-500/10 disabled:opacity-50 dark:text-red-300";
const textButtonClass =
  "rounded border px-3 py-2 text-sm transition active:scale-90 hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5";

function bytesLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DeleteWordSenseModalButton({ id, label }: { id: number; label: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [preview, setPreview] = useState<DeletePreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const showPreview = async () => {
    setOpen(true);
    setLoading(true);
    setPreview(null);
    setError(null);
    try {
      const response = await fetch("/api/words/editor/delete-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const result = (await response.json()) as { ok?: boolean; item?: DeletePreview; error?: string };
      if (!response.ok || !result.ok || !result.item) {
        throw new Error(result.error || "Could not prepare the deletion preview.");
      }
      setPreview(result.item);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch("/api/words/editor/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const result = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error || "Could not delete this WordSense.");
      setOpen(false);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setDeleting(false);
    }
  };

  const close = () => {
    if (!deleting) setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void showPreview()}
        className={iconButtonClass}
        aria-label={`Delete WordSense ${id} — ${label}`}
        title="Delete WordSense"
      >
        <ActionIcon name="trash" />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[70] bg-black/50 p-3 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`Confirm deletion of WordSense ${id}`}
          onMouseDown={(event) => event.target === event.currentTarget && close()}
        >
          <div className="mx-auto mt-[6vh] w-full max-w-2xl rounded-2xl border border-card bg-background p-5 shadow-elevated">
            <div>
              <h2 className="text-base font-semibold text-red-700 dark:text-red-300">Delete WordSense #{id} — {label}</h2>
              <p className="mt-1 text-sm opacity-75">Review every related change before confirming. This operation cannot be undone from this page.</p>
            </div>

            {loading ? <div className="mt-4 rounded border p-4 text-sm">Loading deletion details…</div> : null}
            {error ? <div className="mt-4 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700">{error}</div> : null}

            {preview ? (
              <div className="mt-4 max-h-[60vh] space-y-3 overflow-auto pr-1 text-sm">
                <section className="rounded border border-red-500/30 bg-red-500/5 p-3">
                  <div className="font-semibold">Items that will be deleted</div>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li>WordSense #{preview.id} — {preview.word}</li>
                    {preview.totalAudioFiles > 0 ? (
                      <li>
                        {preview.totalAudioFiles} WordSense audio file(s)
                        <ul className="mt-1 list-disc pl-5 text-xs opacity-75">
                          {preview.audioFiles.map((field) => (
                            <li key={field.field}>{field.field}: {field.count} file(s), {bytesLabel(field.bytes)}</li>
                          ))}
                        </ul>
                      </li>
                    ) : <li>No matching WordSense audio files</li>}
                    {preview.sentence?.willBeDeleted ? (
                      <li>Orphaned Sentence #{preview.sentence.id} — {preview.sentence.sentence_en}</li>
                    ) : null}
                  </ul>
                </section>

                {preview.sentence && !preview.sentence.willBeDeleted ? (
                  <section className="rounded border p-3">
                    Sentence #{preview.sentence.id} will remain because it is linked to {preview.sentence.linkedWordCount} WordSense records.
                  </section>
                ) : null}

                <section className="rounded border p-3">
                  <div className="font-semibold">References that will be removed (these WordSense records will not be deleted)</div>
                  {preview.affectedWords.length ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      {preview.affectedWords.map((word) => (
                        <li key={word.id}>WordSense #{word.id} — {word.word}: {word.removeFrom.join(" + ")}</li>
                      ))}
                    </ul>
                  ) : <div className="mt-2 opacity-70">No WordSense relationship arrays reference this ID.</div>}
                </section>
              </div>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={deleting} onClick={close} className={textButtonClass}>Cancel</button>
              <button
                type="button"
                disabled={loading || deleting || !preview}
                onClick={() => void confirmDelete()}
                className={`${textButtonClass} border-red-600 bg-red-600 text-white hover:bg-red-700`}
              >{deleting ? "Deleting…" : "Confirm deletion"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
