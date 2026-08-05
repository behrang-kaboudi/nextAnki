"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Result = {
  scanned: number;
  created: number;
  variantsAdded: number;
  unchanged: number;
  audioCopied: number;
  skippedNoPersianText: number;
  skippedDuplicateNormalizedText: number;
  skippedIpaConflict: number;
  skippedExistingAudio: number;
  skippedNoSourceAudio: number;
  failed: number;
  skipped: Array<{ wordId: number; meaningFa: string; reason: string }>;
};

type LinkResult = {
  scanned: number;
  linked: number;
  updated: number;
  unchanged: number;
  missingPrimaryMeaning: number;
  missingOtherMeanings: number;
  failed: number;
};

export default function ImportUnlinkedPersianMeanings() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [linkResult, setLinkResult] = useState<LinkResult | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    setLinkResult(null);
    try {
      const response = await fetch("/api/words/persian-words/import-unlinked-meanings", { method: "POST" });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; result?: Result; error?: string } | null;
      if (!response.ok || !payload?.ok || !payload.result) throw new Error(payload?.error || "Import failed.");
      setResult(payload.result);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const linkUnlinkedWords = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    setLinkResult(null);
    try {
      const response = await fetch("/api/words/link-unlinked-to-persian-words", { method: "POST" });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; result?: LinkResult; error?: string } | null;
      if (!response.ok || !payload?.ok || !payload.result) throw new Error(payload?.error || "Linking failed.");
      setLinkResult(payload.result);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  return <div className="mt-4 rounded border p-3">
    <h2 className="text-sm font-semibold">کارهای موقت</h2>
    <div className="mt-2 flex flex-wrap items-center gap-3">
      <button type="button" onClick={run} disabled={busy} className="rounded border px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5">
        {busy ? "Importing…" : "Import Unlinked Persian Meanings"}
      </button>
      <button type="button" onClick={linkUnlinkedWords} disabled={busy} className="rounded border px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5">
        {busy ? "Linking…" : "Fill empty meaningId values"}
      </button>
      <p className="text-xs opacity-70">meaning_fa و IPA رکوردهای بدون meaningId را به PersianWord منتقل می‌کند و صوت meaning_fa را کپی می‌کند.</p>
      <p className="text-xs opacity-70">برای Wordهای بدون meaningId، شناسهٔ معنی اصلی و شناسه‌های معانی دیگر را از PersianWord پیدا و ثبت می‌کند.</p>
    </div>
    {error ? <p className="mt-3 rounded border border-red-500/30 bg-red-600/10 p-2 text-sm text-red-700">{error}</p> : null}
    {result ? <>
      <p className="mt-3 text-sm">بررسی‌شده: {result.scanned} · جدید: {result.created} · variant: {result.variantsAdded} · بدون تغییر: {result.unchanged} · صوت کپی‌شده: {result.audioCopied} · IPA تکراری: {result.skippedIpaConflict} · خطا: {result.failed}</p>
      {result.skipped.length ? <div className="mt-3 overflow-hidden rounded border">
        <p className="border-b px-3 py-2 text-sm font-medium">مواردی که اضافه نشدند</p>
        <div className="max-h-72 overflow-auto"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-background"><tr className="border-b"><th className="px-3 py-2">Word id</th><th className="px-3 py-2">meaning_fa</th><th className="px-3 py-2">دلیل</th></tr></thead><tbody>
          {result.skipped.map((item) => <tr key={item.wordId} className="border-b align-top"><td className="px-3 py-2 font-mono">{item.wordId}</td><td className="px-3 py-2" dir="rtl">{item.meaningFa}</td><td className="px-3 py-2">{item.reason}</td></tr>)}
        </tbody></table></div>
      </div> : null}
    </> : null}
    {linkResult ? <p className="mt-3 text-sm">بررسی‌شده: {linkResult.scanned} · لینک‌شده: {linkResult.linked} · به‌روزرسانی‌شده: {linkResult.updated} · بدون تغییر: {linkResult.unchanged} · معنی اصلیِ پیدا نشده: {linkResult.missingPrimaryMeaning} · معنی فرعیِ پیدا نشده: {linkResult.missingOtherMeanings} · خطا: {linkResult.failed}</p> : null}
  </div>;
}
