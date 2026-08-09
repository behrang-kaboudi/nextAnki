import Link from "next/link";

import { PageHeader } from "@/components/page-header";

const workflowCard =
  "group grid min-h-72 content-between gap-8 rounded-3xl border border-card bg-card p-6 shadow-elevated transition hover:-translate-y-1 hover:border-[color-mix(in_oklab,var(--primary),transparent_45%)] hover:shadow-[0_22px_55px_rgba(0,0,0,0.14)] sm:p-8";

export default function WordExtractionHomePage() {
  return (
    <div className="grid gap-10">
      <PageHeader
        title="Word Extraction"
        subtitle="Choose whether you are creating vocabulary records or completing fields on records that already exist."
      />

      <section className="mx-auto grid w-full max-w-5xl gap-5 lg:grid-cols-2" aria-label="Word extraction workflows">
        <Link href="/words/extraction/new" className={workflowCard}>
          <div className="grid gap-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--primary)] text-xl font-bold text-[var(--primary-foreground)]">
              1
            </div>
            <div className="grid gap-3">
              <h2 className="text-2xl font-bold text-foreground">New Word Intake</h2>
              <p dir="rtl" className="text-right text-lg font-semibold leading-8 text-foreground">
                ورود کلمات جدید
              </p>
              <p dir="rtl" className="text-right text-sm leading-7 text-muted">
                لغت و معنی خام را پاک‌سازی کن، Base Form را تشخیص بده و برای هر معنی جملهٔ نمونه و ترجمه بساز.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-2 text-sm font-bold text-[var(--primary)]">
            Open new-word workflow
            <span aria-hidden="true" className="transition group-hover:translate-x-1">→</span>
          </span>
        </Link>

        <Link href="/words/extraction/custom" className={workflowCard}>
          <div className="grid gap-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--primary)] bg-[color-mix(in_oklab,var(--primary),transparent_90%)] text-xl font-bold text-[var(--primary)]">
              2
            </div>
            <div className="grid gap-3">
              <h2 className="text-2xl font-bold text-foreground">Complete Existing Words</h2>
              <p dir="rtl" className="text-right text-lg font-semibold leading-8 text-foreground">
                تکمیل اطلاعات کلمات موجود
              </p>
              <p dir="rtl" className="text-right text-sm leading-7 text-muted">
                رکوردهای موجود را بر اساس فیلدهای ناقص انتخاب کن و فقط همان اطلاعات موردنیاز را با AI تکمیل کن.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-2 text-sm font-bold text-[var(--primary)]">
            Open custom extraction
            <span aria-hidden="true" className="transition group-hover:translate-x-1">→</span>
          </span>
        </Link>
      </section>

      <aside className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 rounded-2xl border border-card bg-background px-5 py-4 text-sm leading-6 text-muted">
        <div>
          <p dir="rtl" className="text-right">
            ورود کلمات جدید رکورد می‌سازد؛ Custom Extraction فقط رکوردهای موجود را تکمیل یا اصلاح می‌کند.
          </p>
          <p dir="rtl" className="mt-1 text-right text-xs">
            نسخهٔ قبلی استخراج کلمات برای مرور و مقایسه همچنان در دسترس است.
          </p>
        </div>
        <Link
          href="/words/extraction/legacy"
          className="inline-flex min-h-10 items-center justify-center rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-900 transition hover:bg-amber-100"
        >
          Open legacy extraction
        </Link>
      </aside>
    </div>
  );
}
