"use client";

import { useState } from "react";

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

export default function JsonHintHelpModal() {
  const [open, setOpen] = useState(false);

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
                <div className="text-base font-semibold">راهنمای Generate json_hint (DB)</div>
                <div className="mt-1 text-xs opacity-80">
                  مسیر صفحه: <Code>/word-hints/json</Code>
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

            <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-auto text-sm leading-7">
              <section className="rounded border p-3">
                <div className="text-xs font-semibold">این دکمه دقیقاً چه کار می‌کند؟</div>
                <div className="mt-2 text-sm">
                  برای هر رکورد جدول <Code>Word</Code> (یا فقط رکوردهای مطابق Search)، مقدار{" "}
                  <Code>Word.json_hint</Code> را محاسبه می‌کند و اگر نتیجه با مقدار فعلی متفاوت باشد در دیتابیس ذخیره
                  می‌کند.
                </div>
                <div className="mt-2 text-xs opacity-80">
                  منبع محاسبه از منطق انتخاب تصویر/سمبل است (PictureWord + الگوریتم‌های setPictures).
                </div>
              </section>

              <section className="rounded border p-3">
                <div className="text-xs font-semibold">با رکوردهای از قبل موجود چه می‌کند؟</div>
                <div className="mt-2 text-sm">
                  <ul className="mt-2 list-disc space-y-1 ps-5 text-sm">
                    <li>
                      اگر خروجیِ جدید (بدون در نظر گرفتن <Code>generatedAtMs</Code>) با json_hint فعلی یکسان باشد:
                      هیچ تغییری در DB نمی‌دهد (Updated نمی‌شود).
                    </li>
                    <li>
                      اگر خروجی جدید متفاوت باشد: json_hint را بازنویسی می‌کند و فیلد{" "}
                      <Code>generatedAtMs</Code> را با زمان فعلی تنظیم می‌کند.
                    </li>
                    <li>
                      اگر برای یک Word نتواند hint بسازد (مثلاً{" "}
                      <Code>phonetic_us_normalized</Code> خالی باشد): json_hint را{" "}
                      <Code>null</Code> می‌کند (یعنی ممکن است json_hint قبلی پاک شود).
                    </li>
                  </ul>
                </div>
              </section>

              <section className="rounded border p-3">
                <div className="text-xs font-semibold">این کار روی Anki هم اثر می‌گذارد؟</div>
                <div className="mt-2 text-sm">
                  این دکمه فقط DB را تغییر می‌دهد و خودش هیچ چیزی را به Anki sync نمی‌کند. اما چون بعضی فیلدهای Anki
                  (مثل hintها) از <Code>json_hint</Code> خوانده می‌شوند، اگر بعداً job/صفحه‌های sync را اجرا کنی،
                  خروجی Anki هم می‌تواند تغییر کند.
                </div>
              </section>

              <section className="rounded border p-3">
                <div className="text-xs font-semibold">چه چیزهایی باعث تغییر خروجی می‌شوند؟</div>
                <div className="mt-2 text-sm">
                  حتی اگر روی خود Word چیزی تغییر نداده باشی، این‌ها می‌توانند json_hint را تغییر دهند:
                  <ul className="mt-2 list-disc space-y-1 ps-5 text-sm">
                    <li>تغییر در جدول <Code>PictureWord</Code> (اضافه/حذف/ویرایش)</li>
                    <li>تغییر در <Code>phonetic_us_normalized</Code> یا <Code>imageability</Code></li>
                    <li>تغییر در منطق انتخاب سمبل‌ها (کدهای <Code>src/lib/ipa/setPictures</Code>)</li>
                  </ul>
                </div>
              </section>

              <section className="rounded border p-3">
                <div className="text-xs font-semibold">Batch size و Stop</div>
                <div className="mt-2 text-sm">
                  <ul className="mt-2 list-disc space-y-1 ps-5 text-sm">
                    <li>
                      <Code>Batch size</Code> تعداد Wordهایی است که در هر درخواست به API اسکن می‌شوند.
                    </li>
                    <li>
                      <Code>Stop</Code> اجرای حلقه‌ی client را قطع می‌کند. (ممکن است batch جاری تمام شده باشد و بعد
                      متوقف شود.)
                    </li>
                  </ul>
                </div>
              </section>

              <section className="rounded border p-3">
                <div className="text-xs font-semibold">API مربوطه</div>
                <div className="mt-2 text-sm">
                  این دکمه به صورت batch روی API زیر کار می‌کند:
                  <div className="mt-2">
                    <Code>/api/words/json-hint-generate-all</Code>
                  </div>
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

