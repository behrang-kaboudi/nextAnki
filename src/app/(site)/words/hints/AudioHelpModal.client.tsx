"use client";

import { useState } from "react";

import { ENGLISH_WORD_AUDIO_PUBLIC_DIR_RELATIVE } from "@/lib/audio/englishWordAudioNaming";
import { SENTENCE_AUDIO_PUBLIC_DIR_RELATIVE } from "@/lib/audio/sentenceAudioNaming";
import { WORD_AUDIO_FIELDS } from "@/lib/audio/wordAudioFields";
import { WORD_CONCEPT_AUDIO_PUBLIC_DIR_RELATIVE } from "@/lib/audio/wordConceptAudioNaming";

function Code({ children }: { children: React.ReactNode }) {
  return <span dir="ltr" className="rounded bg-black/5 px-1 py-0.5 font-mono text-[11px] dark:bg-white/10">{children}</span>;
}

export default function AudioHelpModal() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rounded border px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5">Help</button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div dir="rtl" lang="fa" className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-auto rounded border bg-background p-4 text-right shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold">راهنمای سیستم صوتی</div>
                <div className="mt-1 text-xs opacity-80">مسیر صفحه: <Code>/words/hints/audio</Code></div>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded border px-2 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/5">Close</button>
            </div>
            <div className="mt-4 space-y-4 text-sm leading-6">
              <section className="rounded border p-3">
                <div className="text-xs font-semibold">مالکیت فایل‌ها</div>
                <ul className="mt-2 list-disc space-y-1 ps-5">
                  <li><Code>base_form</Code>: جدول <Code>EnglishWord.audio_file_name</Code> در <Code>public/{ENGLISH_WORD_AUDIO_PUBLIC_DIR_RELATIVE}</Code></li>
                  <li><Code>concept_explained_fa</Code>: جدول <Code>Word.concept_explained_fa_audio_file_name</Code> در <Code>public/{WORD_CONCEPT_AUDIO_PUBLIC_DIR_RELATIVE}</Code></li>
                  <li><Code>sentence_en</Code> و <Code>sentence_en_meaning_fa</Code>: ستون‌های صوتی جدول <Code>Sentence</Code> در <Code>public/{SENTENCE_AUDIO_PUBLIC_DIR_RELATIVE}</Code></li>
                  <li><Code>other_meanings_en</Code> از <Code>Word.synonymIds</Code> ساخته می‌شود؛ فیلد <Code>other_meanings_en_audio</Code> نیز فایل صوتی <Code>EnglishWord</Code> هر synonym را به همان ترتیب می‌خواند.</li>
                </ul>
              </section>
              <section className="rounded border p-3">
                <div className="text-xs font-semibold">رفتار تولید</div>
                <div className="mt-2">تولید تکی، ضبط صدا و Batch همگی نام فایل جدید را در رکورد مالک ذخیره می‌کنند. هنگام جایگزینی، فایل قبلی همان رکورد حذف می‌شود. Batch فایل سالم موجود را دوباره تولید نمی‌کند و فایل گم‌شده یا صفر‌بایت را ترمیم می‌کند.</div>
              </section>
              <section className="rounded border p-3">
                <div className="text-xs font-semibold">فیلدهای قابل تولید</div>
                <div className="mt-2"><Code>{WORD_AUDIO_FIELDS.join(", ")}</Code></div>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
