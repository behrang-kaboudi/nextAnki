import Link from "next/link";

import WordExtractionPage from "../new/WordExtractionPage.client";

export default function LegacyWordExtractionPage() {
  return (
    <div className="grid gap-6">
      <aside className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-amber-950 shadow-sm">
        <div>
          <p className="text-sm font-bold">Legacy Word Extraction</p>
          <p dir="rtl" className="mt-1 text-right text-xs leading-6 text-amber-900/75">
            این همان صفحهٔ قبلی است و برای مقایسه با طراحی جدید بدون تغییر نگه داشته شده است.
          </p>
        </div>
        <Link
          href="/words/extraction/new"
          className="inline-flex min-h-10 items-center justify-center rounded-xl bg-amber-950 px-4 py-2 text-xs font-bold text-white transition hover:bg-amber-800"
        >
          Open new design
        </Link>
      </aside>
      <WordExtractionPage />
    </div>
  );
}
