"use client";

import { useState } from "react";

import { ModalPortal } from "@/components/modal-portal";
import type {
  PersianWordAmbiguity,
  PersianWordResolutionSelection,
} from "@/lib/words/persianWordResolution";

export function PersianWordResolutionModal({
  ambiguities,
  busy,
  description,
  onCancel,
  onConfirm,
}: {
  ambiguities: PersianWordAmbiguity[];
  busy: boolean;
  description?: string;
  onCancel: () => void;
  onConfirm: (selections: PersianWordResolutionSelection[]) => void;
}) {
  if (!ambiguities.length) return null;
  const dialogKey = ambiguities.map((item) => `${item.key}:${item.candidates.map((candidate) => candidate.id).join(",")}`).join("|");
  return <PersianWordResolutionDialog key={dialogKey} ambiguities={ambiguities} busy={busy} description={description} onCancel={onCancel} onConfirm={onConfirm} />;
}

function PersianWordResolutionDialog({
  ambiguities,
  busy,
  description,
  onCancel,
  onConfirm,
}: {
  ambiguities: PersianWordAmbiguity[];
  busy: boolean;
  description?: string;
  onCancel: () => void;
  onConfirm: (selections: PersianWordResolutionSelection[]) => void;
}) {
  const [selected, setSelected] = useState<Record<string, number>>({});
  const complete = ambiguities.every((item) => selected[item.key]);

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-labelledby="persian-word-resolution-title">
        <section className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-card bg-background shadow-elevated">
          <header className="border-b border-card p-5 sm:p-6">
            <h2 id="persian-word-resolution-title" dir="rtl" className="text-right text-xl font-bold text-foreground">تلفظ درست واژه را انتخاب کنید</h2>
            <p dir="rtl" className="mt-2 text-right text-sm leading-6 text-muted">{description ?? "برنامه عمداً import را متوقف کرده است. مفهوم و جمله را بخوانید، سپس تلفظی را انتخاب کنید که دقیقاً به همین کاربرد تعلق دارد."}</p>
          </header>
          <div className="grid gap-4 overflow-y-auto p-5 sm:p-6">
            {ambiguities.map((item) => (
              <fieldset key={item.key} className="rounded-2xl border border-card bg-card p-4">
                <legend className="px-2 text-xs font-semibold text-muted">{item.field === "meaning_fa" ? "معنی اصلی" : "معنی دیگر"}</legend>
                <div className="mb-4 grid gap-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <span dir="ltr" className="text-sm font-semibold text-foreground">{item.context.base_form}</span>
                    <span dir="rtl" className="text-xl font-bold text-foreground">{item.text}</span>
                  </div>
                  <div className="grid gap-2 rounded-xl border border-card bg-background p-3 text-sm sm:grid-cols-2">
                    <div><span className="text-xs text-muted">POS</span><div dir="ltr" className="mt-1">{item.context.pos || "—"}</div></div>
                    <div><span dir="rtl" className="block text-right text-xs text-muted">مفهوم</span><div dir="rtl" className="mt-1 text-right leading-6">{item.context.concept_explained_fa || "—"}</div></div>
                    <div><span className="text-xs text-muted">Example</span><div dir="ltr" className="mt-1 leading-6">{item.context.sentence_en || "—"}</div></div>
                    <div><span dir="rtl" className="block text-right text-xs text-muted">ترجمهٔ جمله</span><div dir="rtl" className="mt-1 text-right leading-6">{item.context.sentence_en_meaning_fa || "—"}</div></div>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {item.candidates.map((candidate) => (
                    <label key={candidate.id} className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 transition ${selected[item.key] === candidate.id ? "border-[var(--primary)] bg-[color-mix(in_oklab,var(--primary),transparent_90%)]" : "border-card bg-background hover:border-[var(--primary)]"}`}>
                      <input type="radio" name={item.key} checked={selected[item.key] === candidate.id} onChange={() => setSelected((current) => ({ ...current, [item.key]: candidate.id }))} className="h-4 w-4 accent-[var(--primary)]" />
                      <span className="flex min-w-0 flex-1 items-baseline justify-end gap-3">
                        <span dir="ltr" className="font-mono text-xs text-muted">#{candidate.id}</span>
                        <span dir="ltr" className="font-mono text-sm font-semibold text-foreground">{candidate.meaning_fa_IPA || "No IPA"}</span>
                        <span dir="rtl" className="text-lg font-semibold text-foreground">{candidate.canonical_text}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
          <footer className="flex flex-wrap justify-end gap-3 border-t border-card p-5">
            <button type="button" onClick={onCancel} disabled={busy} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-card bg-background px-5 py-2 text-sm font-semibold text-foreground transition hover:bg-card disabled:opacity-50"><span dir="rtl">انصراف</span></button>
            <button type="button" onClick={() => onConfirm(ambiguities.map((item) => ({ key: item.key, persianWordId: selected[item.key] })))} disabled={busy || !complete} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--primary)] px-5 py-2 text-sm font-bold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"><span dir="rtl">تأیید و ادامه</span></button>
          </footer>
        </section>
      </div>
    </ModalPortal>
  );
}
