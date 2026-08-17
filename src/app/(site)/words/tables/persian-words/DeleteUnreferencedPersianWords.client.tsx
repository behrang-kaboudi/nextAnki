"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function confirmationText(count: number) {
  return `DELETE UNUSED PERSIAN WORDS ${count}`;
}

export default function DeleteUnreferencedPersianWords({ initialCount }: { initialCount: number }) {
  const router = useRouter();
  const [count, setCount] = useState(initialCount);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setCount(initialCount);
    const controller = new AbortController();
    void fetch("/api/words/persian-words/unreferenced", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result = await response.json() as { ok?: boolean; count?: number };
        if (response.ok && result.ok && Number.isSafeInteger(result.count)) setCount(Number(result.count));
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [initialCount]);

  async function remove() {
    if (!count || deleting) return;
    setDeleting(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/words/persian-words/unreferenced", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedCount: count,
          confirmation: confirmationText(count),
        }),
      });
      const result = await response.json() as {
        ok?: boolean;
        result?: { deletedRows: number };
        error?: string;
      };
      if (!response.ok || !result.ok || !result.result) {
        throw new Error(result.error || "Could not delete the unused PersianWord records.");
      }
      setCount(0);
      setOpen(false);
      setNotice(`Deleted ${result.result.deletedRows.toLocaleString()} unused PersianWord records.`);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setDeleting(false);
    }
  }

  function close() {
    if (!deleting) setOpen(false);
  }

  return (
    <>
      <div className="grid gap-1">
        <button
          type="button"
          disabled={count === 0 || deleting}
          onClick={() => {
            setError(null);
            setOpen(true);
          }}
          className="rounded border border-red-600 bg-red-600 px-3 py-2 text-sm text-white transition active:scale-90 hover:bg-red-700 disabled:opacity-50"
        >
          {deleting
            ? `Deleting ${count.toLocaleString()} unused Persian words…`
            : `Delete unused Persian words (${count.toLocaleString()})`}
        </button>
        {notice ? <p className="max-w-md text-xs text-green-800 dark:text-green-200">{notice}</p> : null}
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-unused-persian-words-title"
          onMouseDown={(event) => event.target === event.currentTarget && close()}
        >
          <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-red-500/30 bg-background shadow-elevated">
            <div className="border-b border-red-500/20 bg-red-500/[0.06] px-5 py-5 sm:px-6">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-600 text-lg font-bold text-white">!</div>
                <div dir="rtl" className="min-w-0 text-right">
                  <h2 id="delete-unused-persian-words-title" className="text-lg font-bold text-red-700 dark:text-red-300">
                    حذف کلمات فارسی بلااستفاده
                  </h2>
                  <p className="mt-1 text-sm leading-6 opacity-75">
                    فقط رکوردهایی انتخاب شده‌اند که همهٔ شرایط زیر را هم‌زمان دارند.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4 px-5 py-5 sm:px-6">
              <div dir="rtl" className="flex items-center justify-between gap-4 rounded-xl border border-red-500/25 bg-red-500/[0.04] px-4 py-3 text-right">
                <span className="text-sm font-semibold">تعداد رکوردهای آمادهٔ حذف</span>
                <strong className="rounded-full bg-red-600 px-4 py-1.5 text-lg tabular-nums text-white">
                  {count.toLocaleString("fa-IR")}
                </strong>
              </div>

              <section dir="rtl" className="rounded-xl border p-4 text-right">
                <h3 className="text-sm font-bold">شرایط انتخاب این رکوردها</h3>
                <ul className="mt-3 space-y-2 text-sm leading-6">
                  <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600">✓</span><span>هیچ WordSense در فیلدهای معنی اصلی یا معنی‌های دیگر به آن‌ها اشاره نمی‌کند.</span></li>
                  <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600">✓</span><span>فیلد فایل صوتی آن‌ها خالی است.</span></li>
                  <li className="flex items-start gap-2"><span className="mt-0.5 text-emerald-600">✓</span><span>فیلدهای IPA و IPA نرمال‌شدهٔ آن‌ها خالی است.</span></li>
                </ul>
              </section>

              <div dir="rtl" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-right text-sm leading-6 text-amber-900 dark:text-amber-100">
                این حذف دائمی است و از همین صفحه قابل بازگردانی نیست. آیا حذف این {count.toLocaleString("fa-IR")} رکورد را تأیید می‌کنید؟
              </div>

              {error ? <div dir="rtl" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-right text-sm text-red-700 dark:text-red-300">{error}</div> : null}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t bg-black/[0.015] px-5 py-4 sm:flex-row sm:justify-end sm:px-6 dark:bg-white/[0.025]">
              <button type="button" disabled={deleting} onClick={close} className="rounded-xl border px-4 py-2.5 text-sm font-semibold transition hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5">
                <span dir="rtl">انصراف</span>
              </button>
              <button type="button" disabled={deleting} onClick={() => void remove()} className="rounded-xl border border-red-600 bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition active:scale-95 hover:bg-red-700 disabled:opacity-50">
                <span dir="rtl">{deleting ? "در حال حذف…" : `بله، حذف ${count.toLocaleString("fa-IR")} رکورد`}</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
