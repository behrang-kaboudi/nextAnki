"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { RemainingCountBadge } from "@/components/remaining-count";
import { SpecialCharactersBar } from "@/components/ipa/SpecialCharactersBar";

const IPA_CHARACTERS = ["æ", "ɑː", "ɒ", "ə", "ɪ", "iː", "ʊ", "uː", "ɜː", "ɔː", "ʃ", "ʒ", "tʃ", "dʒ", "ɣ", "x", "ɾ", "ʔ", "j"];
const PAGE_SIZES = [50, 100, 250, 500] as const;

type ReviewRow = {
  id: number;
  canonical_text: string;
  meaning_fa_IPA: string | null;
  meaning_fa_IPA_normalize: string | null;
  meaning_fa_IPA_confirmed: boolean;
};

type ConfirmScope = "page" | "all";

export default function PersianMeaningIpaReview({ pendingCount }: { pendingCount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(pendingCount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmScope, setConfirmScope] = useState<ConfirmScope | null>(null);
  const lastInputRef = useRef<HTMLInputElement | null>(null);
  const lastIdRef = useRef<number | null>(null);

  const load = async (requestedPage: number, requestedPageSize = pageSize) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/words/persian-words/meaning-fa-ipa-review?page=${requestedPage}&pageSize=${requestedPageSize}`,
        { cache: "no-store" },
      );
      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        total?: number;
        page?: number;
        pageCount?: number;
        items?: ReviewRow[];
      } | null;
      if (!response.ok || result?.ok !== true) throw new Error(result?.error || "Could not load Persian IPA review rows.");
      const nextRows = result.items ?? [];
      setRows(nextRows);
      setDrafts(Object.fromEntries(nextRows.map((row) => [row.id, row.meaning_fa_IPA ?? ""])));
      setTotal(result.total ?? 0);
      setPage(result.page ?? requestedPage);
      setPageCount(result.pageCount ?? 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const openModal = () => {
    setOpen(true);
    setNotice(null);
    void load(1);
  };

  const confirmRows = async (selectedRows: ReviewRow[]) => {
    if (!selectedRows.length) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const payload = selectedRows.map((row) => ({ id: row.id, meaning_fa_IPA: (drafts[row.id] ?? "").trim() }));
      if (payload.some((item) => !item.meaning_fa_IPA)) throw new Error("A Persian IPA value cannot be empty when it is confirmed.");
      const response = await fetch("/api/words/persian-words/meaning-fa-ipa/update-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        total?: number;
        updated?: number;
        results?: Array<{ ok: boolean; id: number; error?: string }>;
      } | null;
      if (!response.ok || result?.ok !== true) throw new Error(result?.error || "Could not confirm Persian IPA rows.");
      const failures = (result.results ?? []).filter((item) => !item.ok);
      setNotice(`Confirmed ${result.updated ?? 0}/${result.total ?? selectedRows.length}${failures.length ? ` · ${failures.length} failed` : ""}.`);
      if (failures.length) setError(failures.map((item) => `${item.id}: ${item.error ?? "Update failed"}`).join(" · "));
      router.refresh();
      await load(page);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const confirmAll = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/words/persian-words/meaning-fa-ipa-confirmed/confirm-all", { method: "POST" });
      const result = (await response.json().catch(() => null)) as { ok?: boolean; updated?: number; error?: string } | null;
      if (!response.ok || result?.ok !== true) throw new Error(result?.error || "Could not confirm all Persian IPA rows.");
      setNotice(`Confirmed ${result.updated ?? 0} Persian IPA rows.`);
      router.refresh();
      await load(1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const applyConfirmation = async () => {
    const scope = confirmScope;
    setConfirmScope(null);
    if (scope === "page") await confirmRows(rows);
    if (scope === "all") await confirmAll();
  };

  const insertCharacter = (character: string) => {
    const input = lastInputRef.current;
    const id = lastIdRef.current;
    if (!input || id === null) return;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const next = input.value.slice(0, start) + character + input.value.slice(end);
    setDrafts((current) => ({ ...current, [id]: next }));
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(start + character.length, start + character.length);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="rounded border px-3 py-2 text-sm transition active:scale-90 hover:bg-black/5 dark:hover:bg-white/5"
      >
        REVIEW PERSIAN IPA <RemainingCountBadge count={pendingCount} />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
          <div className="flex h-[90vh] w-full max-w-7xl flex-col gap-4 rounded-2xl border border-card bg-background p-6 shadow-elevated">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold">Persian IPA human review — PersianWord</div>
                <div className="mt-1 text-xs opacity-70">Only populated IPA values with meaning_fa_IPA_confirmed=false are listed. Each PersianWord appears once.</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" disabled={busy || !rows.length} onClick={() => setConfirmScope("page")} className="rounded border border-emerald-700 bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                  <span dir="rtl">تأیید این صفحه ({rows.length.toLocaleString()})</span>
                </button>
                <button type="button" disabled={busy || total === 0} onClick={() => setConfirmScope("all")} className="rounded border border-emerald-700 bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                  <span dir="rtl">تأیید همه مجموعه ({total.toLocaleString()})</span>
                </button>
                <button type="button" disabled={busy} onClick={() => setOpen(false)} className="rounded border px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5">Close</button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded border p-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span>Total pending: <strong>{total.toLocaleString()}</strong></span>
                <label className="flex items-center gap-2">Rows
                  <select value={pageSize} disabled={busy} onChange={(event) => { const next = Number(event.target.value); setPageSize(next); void load(1, next); }} className="rounded border px-2 py-1">
                    {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
                  </select>
                </label>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <button type="button" disabled={busy || page <= 1} onClick={() => void load(page - 1)} className="rounded border px-3 py-1 disabled:opacity-50">Prev</button>
                <span>Page <strong>{page.toLocaleString()}</strong> / {pageCount.toLocaleString()}</span>
                <button type="button" disabled={busy || page >= pageCount} onClick={() => void load(page + 1)} className="rounded border px-3 py-1 disabled:opacity-50">Next</button>
              </div>
            </div>

            {notice ? <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-2 text-sm text-emerald-800">{notice}</div> : null}
            {error ? <div className="rounded border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-700">{error}</div> : null}

            <SpecialCharactersBar characters={IPA_CHARACTERS} onPick={insertCharacter} title="Special characters" helpText="Focus an IPA field, then click a character." />

            <div className="min-h-0 flex-1 overflow-auto rounded border">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b"><th className="px-3 py-2">id</th><th className="px-3 py-2">canonical_text</th><th className="px-3 py-2">current IPA</th><th className="px-3 py-2">normalized</th><th className="px-3 py-2">review/edit</th><th className="px-3 py-2">action</th></tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b">
                      <td className="px-3 py-2 font-mono">{row.id}</td>
                      <td className="px-3 py-2 text-base" dir="rtl">{row.canonical_text}</td>
                      <td className="px-3 py-2 font-mono">{row.meaning_fa_IPA}</td>
                      <td className="px-3 py-2 font-mono">{row.meaning_fa_IPA_normalize ?? "—"}</td>
                      <td className="px-3 py-2"><input value={drafts[row.id] ?? ""} disabled={busy} onChange={(event) => setDrafts((current) => ({ ...current, [row.id]: event.target.value }))} onFocus={(event) => { lastInputRef.current = event.currentTarget; lastIdRef.current = row.id; }} className="w-72 rounded border px-2 py-1 font-mono" /></td>
                      <td className="px-3 py-2"><button type="button" disabled={busy} onClick={() => void confirmRows([row])} className="rounded border px-2 py-1 transition active:scale-90 hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5">Confirm</button></td>
                    </tr>
                  ))}
                  {!rows.length && !busy ? <tr><td colSpan={6} className="px-3 py-8 text-center opacity-70">No Persian IPA rows need human review.</td></tr> : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {confirmScope ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-2xl border border-card bg-background p-5 text-right shadow-elevated" dir="rtl">
            <h2 className="text-base font-semibold">{confirmScope === "page" ? "تأیید IPAهای همین صفحه؟" : "تأیید تمام IPAهای در انتظار؟"}</h2>
            <p className="mt-3 text-sm leading-6">
              {confirmScope === "page"
                ? `${rows.length.toLocaleString()} رکورد همین صفحه با مقادیر قابل مشاهده و ویرایش‌شده تأیید می‌شوند. صفحات دیگر بدون تغییر می‌مانند.`
                : `${total.toLocaleString()} PersianWord دارای IPA در کل مجموعه تأیید می‌شوند. تغییرات ذخیره‌نشدهٔ ورودی‌های صفحه اعمال نمی‌شوند.`}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={busy} onClick={() => setConfirmScope(null)} className="rounded border px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5">انصراف</button>
              <button type="button" disabled={busy} onClick={() => void applyConfirmation()} className="rounded border border-emerald-700 bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">{busy ? "در حال اعمال…" : "تأیید"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
