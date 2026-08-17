"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function confirmationText(count: number) {
  return `DELETE UNLINKED SENTENCES ${count}`;
}

export default function DeleteUnreferencedSentences({ initialCount }: { initialCount: number }) {
  const router = useRouter();
  const [count, setCount] = useState(initialCount);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setCount(initialCount);
    const controller = new AbortController();
    void fetch("/api/sentences/unreferenced", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result = await response.json() as { ok?: boolean; count?: number };
        if (response.ok && result.ok && Number.isSafeInteger(result.count)) setCount(Number(result.count));
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [initialCount]);

  async function remove() {
    if (!count || deleting) return;
    const confirmed = window.confirm(
      `Permanently delete ${count.toLocaleString()} sentences that are not linked to any WordSense?\n\n` +
      "Their owned audio files will also be deleted. This cannot be undone.",
    );
    if (!confirmed) return;

    setDeleting(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/sentences/unreferenced", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedCount: count,
          confirmation: confirmationText(count),
        }),
      });
      const result = await response.json() as {
        ok?: boolean;
        result?: { deletedRows: number; cleanedAudioFiles: number; failedAudioFiles: number };
        error?: string;
      };
      if (!response.ok || !result.ok || !result.result) {
        throw new Error(result.error || "Could not delete the unlinked sentences.");
      }
      setCount(0);
      setNotice(
        `Deleted ${result.result.deletedRows.toLocaleString()} unlinked sentences. ` +
        `${result.result.cleanedAudioFiles.toLocaleString()} owned audio file(s) were cleaned up.` +
        (result.result.failedAudioFiles
          ? ` ${result.result.failedAudioFiles.toLocaleString()} audio file(s) could not be removed.`
          : ""),
      );
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="grid gap-1">
      <button
        type="button"
        disabled={count === 0 || deleting}
        onClick={() => void remove()}
        className="rounded border border-red-600 bg-red-600 px-3 py-2 text-sm text-white transition active:scale-90 hover:bg-red-700 disabled:opacity-50"
      >
        {deleting
          ? `Deleting ${count.toLocaleString()} unlinked sentences…`
          : `Delete unlinked sentences (${count.toLocaleString()})`}
      </button>
      {error ? <p className="max-w-md text-xs text-red-700 dark:text-red-300">{error}</p> : null}
      {notice ? <p className="max-w-md text-xs text-green-800 dark:text-green-200">{notice}</p> : null}
    </div>
  );
}
