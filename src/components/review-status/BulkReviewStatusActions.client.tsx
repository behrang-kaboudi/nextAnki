"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActionIcon } from "@/components/icons/ActionIcon";

type BulkAction = "confirm" | "reset";

type Props = {
  pendingCount: number;
  pendingUnit: string;
  confirmEndpoint: string;
  resetEndpoint: string;
  confirmSubject: string;
  confirmWarning: string;
  resetSubject: string;
  resetWarning: string;
  resetHelpLabel?: string;
  resetHelpText?: string;
};

const buttonClass =
  "rounded border px-2 py-1 text-xs font-semibold transition active:scale-90 disabled:opacity-50";

export function BulkReviewStatusActions({
  pendingCount,
  pendingUnit,
  confirmEndpoint,
  resetEndpoint,
  confirmSubject,
  confirmWarning,
  resetSubject,
  resetWarning,
  resetHelpLabel,
  resetHelpText,
}: Props) {
  const router = useRouter();
  const [action, setAction] = useState<BulkAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isConfirm = action === "confirm";

  const apply = async () => {
    if (!action) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(
        action === "confirm" ? confirmEndpoint : resetEndpoint,
        { method: "POST" },
      );
      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
        updated?: number;
        reset?: number;
        error?: string;
      } | null;
      if (!response.ok || result?.ok !== true) {
        throw new Error(result?.error || "Could not update review statuses.");
      }
      const updated = result.updated ?? result.reset ?? 0;
      setNotice(
        action === "confirm"
          ? `${updated.toLocaleString()} وضعیت تأیید شد ✓`
          : `${updated.toLocaleString()} وضعیت بازنشانی شد ✓`,
      );
      setAction(null);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="inline-flex flex-col items-start gap-1" dir="rtl">
      <span className="inline-flex items-center gap-1">
        <button
          type="button"
          disabled={busy || pendingCount === 0}
          onClick={() => setAction("confirm")}
          className={`${buttonClass} border-emerald-700 bg-emerald-600 text-white hover:bg-emerald-700 dark:border-emerald-500 dark:bg-emerald-700 dark:hover:bg-emerald-600`}
        >
          تأیید همه
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setAction("reset")}
          className={`${buttonClass} border-red-700 bg-red-600 text-white hover:bg-red-700 dark:border-red-500 dark:bg-red-700 dark:hover:bg-red-600`}
        >
          RESET
        </button>
        {resetHelpLabel && resetHelpText ? (
          <span
            aria-label={resetHelpLabel}
            title={resetHelpText}
            className="inline-flex size-5 items-center justify-center rounded-full border border-red-500 text-red-700 dark:text-red-400"
          >
            <ActionIcon name="help" className="size-3.5" />
          </span>
        ) : null}
      </span>
      {notice ? <span className="text-xs text-emerald-700 dark:text-emerald-400">{notice}</span> : null}
      {error ? <span className="max-w-80 text-xs text-red-700 dark:text-red-400">{error}</span> : null}

      {action ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-card bg-background p-5 text-right shadow-elevated">
            <h2 className="text-base font-semibold">
              {isConfirm ? `تأیید همهٔ ${confirmSubject}؟` : `بازنشانی همهٔ ${resetSubject}؟`}
            </h2>
            <p className="mt-3 text-sm leading-6">
              {isConfirm
                ? `${pendingCount.toLocaleString()} ${pendingUnit} فعلی تأیید می‌شود. ${confirmWarning}`
                : resetWarning}
            </p>
            {error ? <p className="mt-3 text-sm text-red-700 dark:text-red-400">{error}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setAction(null)}
                className="rounded border px-3 py-2 text-sm transition active:scale-90 hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void apply()}
                className={`rounded border px-3 py-2 text-sm font-semibold text-white transition active:scale-90 disabled:opacity-50 ${
                  isConfirm
                    ? "border-emerald-700 bg-emerald-600 hover:bg-emerald-700"
                    : "border-red-700 bg-red-600 hover:bg-red-700"
                }`}
              >
                {busy
                  ? "در حال اعمال…"
                  : isConfirm
                    ? "تأیید همه"
                    : "تأیید بازنشانی"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
