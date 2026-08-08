"use client";

import { useMemo, useState } from "react";

import {
  WORD_AUDIO_FIELDS,
  WORD_AUDIO_FILENAME_SEPARATOR,
  WORD_AUDIO_PUBLIC_DIR_RELATIVE,
} from "@/lib/audio/wordFieldAudioNaming";
import { SENTENCE_AUDIO_PUBLIC_DIR_RELATIVE } from "@/lib/audio/sentenceAudioNaming";

function Code({ children }: { children: React.ReactNode }) {
  return (
    <span
      dir="ltr"
      className="rounded bg-black/5 px-1 py-0.5 font-mono text-[11px] dark:bg-white/10"
    >
      {children}
    </span>
  );
}

export default function AudioHelpModal() {
  const [open, setOpen] = useState(false);

  const fieldsText = useMemo(() => WORD_AUDIO_FIELDS.join(", "), []);
  const filenameExample = useMemo(
    () => `anki_link_id${WORD_AUDIO_FILENAME_SEPARATOR}field${WORD_AUDIO_FILENAME_SEPARATOR}1700000000000.mp3`,
    []
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
      >
        Help
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            dir="rtl"
            lang="fa"
            className="flex h-[85vh] w-full max-w-3xl flex-col rounded border bg-background p-4 text-right shadow-lg"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold">راهنمای تولید صوت</div>
                <div className="mt-1 text-xs opacity-80">
                  مسیر صفحه: <Code>/words/hints/audio</Code>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded border px-2 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/5"
              >
                Close
              </button>
            </div>

            <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-auto text-sm leading-6">
              <section className="rounded border p-3">
                <div className="text-xs font-semibold">پوشه و مسیر فایل‌ها</div>
                <div className="mt-2 text-sm">
                  فایل‌های تولید شده در{" "}
                  <Code>
                    public/{WORD_AUDIO_PUBLIC_DIR_RELATIVE}
                  </Code>{" "}
                  ذخیره می‌شوند و از مسیر عمومی{" "}
                  <Code>
                    /{WORD_AUDIO_PUBLIC_DIR_RELATIVE}
                  </Code>{" "}
                  قابل دسترسی هستند.
                  صوت‌های <Code>sentence_en</Code> و <Code>sentence_en_meaning_fa</Code> مالکیت مستقل دارند، نامشان در جدول <Code>Sentence</Code> ثبت می‌شود و در <Code>public/{SENTENCE_AUDIO_PUBLIC_DIR_RELATIVE}</Code> قرار می‌گیرند.
                </div>
              </section>

              <section className="rounded border p-3">
                <div className="text-xs font-semibold">استاندارد نام‌گذاری (فرمت جدید)</div>
                <div className="mt-2 text-sm">
                  جداکننده‌ی استاندارد <Code>{WORD_AUDIO_FILENAME_SEPARATOR}</Code> است و نام فایل‌ها به شکل زیر ساخته
                  می‌شود:
                </div>
                <div dir="ltr" className="mt-2 rounded border bg-transparent p-3 text-left font-mono text-xs">
                  {filenameExample}
                </div>
                <div dir="ltr" className="mt-2 rounded border bg-transparent p-3 text-left font-mono text-xs">
                  s__Sentence.id__sentence_field__1700000000000.mp3
                </div>
                <div className="mt-2 text-xs opacity-80">
                  قسمت سوم timestamp است (مثل <Code>Date.now()</Code>) و فقط برای یکتایی فایل استفاده می‌شود.
                </div>
              </section>

              <section className="rounded border p-3">
                <div className="text-xs font-semibold">فرمت قدیمی (Legacy)</div>
                <div className="mt-2 text-sm">
                  فایل‌های قدیمی Sentence با migration به پوشهٔ اختصاصی منتقل شده‌اند و جدیدترین نام معتبر هر فیلد در رکورد Sentence ذخیره شده است.
                </div>
              </section>

              <section className="rounded border p-3">
                <div className="text-xs font-semibold">فیلدهای قابل تولید</div>
                <div className="mt-2 text-sm">
                  لیست فیلدها: <Code>{fieldsText}</Code>
                </div>
                <div className="mt-2 text-xs opacity-80">
                  هر دکمه‌ی ALL فقط برای همان field کار می‌کند (مثلاً <Code>base_form</Code> جدا از{" "}
                  <Code>sentence_en</Code>).
                </div>
              </section>

              <section className="rounded border p-3">
                <div className="text-xs font-semibold">رفتار دکمه‌ی ALL</div>
                <div className="mt-2 text-sm">
                  وقتی ALL را می‌زنید:
                  <ul className="mt-2 list-disc space-y-1 ps-5 text-sm">
                    <li>
                      اگر برای <Code>(anki_link_id + field)</Code> فایل موجود باشد و اندازه‌اش {">"} 0 باشد:{" "}
                      <Code>skippedExists</Code> (صوت جدید نمی‌سازد).
                    </li>
                    <li>
                      اگر فایل موجود باشد ولی اندازه‌اش 0 باشد: دوباره همان را تولید می‌کند (<Code>regeneratedZeroByte</Code>).
                    </li>
                    <li>اگر فایل نباشد: فایل جدید تولید می‌کند (<Code>generated</Code>).</li>
                    <li>اگر متن آن فیلد خالی باشد: اسکیپ می‌شود (<Code>skippedNoText</Code>).</li>
                  </ul>
                </div>
              </section>

              <section className="rounded border p-3">
                <div className="text-xs font-semibold">job id یعنی چی؟</div>
                <div className="mt-2 text-sm">
                  مثل <Code>word_field_voice_base_form_1770248978885</Code>:
                  <ul className="mt-2 list-disc space-y-1 ps-5 text-sm">
                    <li>
                      <Code>base_form</Code> نشان می‌دهد این job برای کدام field اجرا شده.
                    </li>
                    <li>عدد آخر timestamp شروع job است (برای یکتایی و پیگیری وضعیت).</li>
                  </ul>
                </div>
              </section>

              <section className="rounded border p-3">
                <div className="text-xs font-semibold">دکمه‌ی STATS</div>
                <div className="mt-2 text-sm">
                  STATS تعداد رکوردهای «دارای متن ولی بدون فایل صوت» را نسبت به کل رکوردهای دیتابیس نشان می‌دهد.
                </div>
              </section>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded border px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
