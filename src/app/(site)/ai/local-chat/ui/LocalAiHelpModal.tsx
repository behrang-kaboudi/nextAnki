"use client";

import { useEffect, useState } from "react";

import { ActionIcon } from "@/components/icons/ActionIcon";
import { ModalPortal } from "@/components/modal-portal";

function Code({ children }: { children: React.ReactNode }) {
  return (
    <span dir="ltr" className="rounded bg-black/5 px-1.5 py-0.5 font-mono text-[11px] dark:bg-white/10">
      {children}
    </span>
  );
}

export function LocalAiHelpModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-card bg-background/70 px-2.5 py-1 text-[11px] font-semibold text-foreground transition hover:bg-black/5 active:scale-95 dark:hover:bg-white/5"
      >
        <ActionIcon name="help" className="size-3.5" />
        راهنما
      </button>

      {open ? (
        <ModalPortal>
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="local-ai-help-title"
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) setOpen(false);
            }}
          >
            <div dir="rtl" lang="fa" className="w-full max-w-lg rounded-2xl border border-card bg-background p-5 text-right shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 id="local-ai-help-title" className="text-lg font-semibold text-foreground">راه‌اندازی LM Studio</h2>
                  <p className="mt-1 text-xs leading-5 text-muted">LM Studio مدل را اجرا می‌کند و این صفحه از طریق API به آن وصل می‌شود.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-card px-2.5 py-1.5 text-xs text-foreground transition hover:bg-black/5 dark:hover:bg-white/5"
                >
                  بستن
                </button>
              </div>

              <ol className="mt-5 grid gap-3 text-sm leading-6 text-foreground">
                <li className="rounded-xl border border-card bg-card p-3"><strong>۱.</strong> در تب Discover یک مدل <Code>Chat / Instruct</Code> دانلود و Load کنید؛ مدل‌های Embedding برای چت نیستند.</li>
                <li className="rounded-xl border border-card bg-card p-3"><strong>۲.</strong> در تب Developer گزینهٔ <Code>Start Server</Code> را روشن کنید. آدرس معمول <Code>http://localhost:1234/v1</Code> است.</li>
                <li className="rounded-xl border border-card bg-card p-3"><strong>۳.</strong> در این صفحه روی <Code>Discover loaded models</Code> بزنید، مدل را انتخاب و سپس Add کنید.</li>
                <li className="rounded-xl border border-card bg-card p-3"><strong>۴.</strong> تنظیمات مدل را ذخیره کنید و از پنل سمت راست چت را شروع کنید.</li>
              </ol>

              <p className="mt-4 rounded-xl bg-amber-500/10 p-3 text-xs leading-5 text-amber-800 dark:text-amber-200">
                اگر مدل پیدا نشد، روشن بودن Server، پورت و Load بودن یک مدل Chat را بررسی کنید. هنگام استفاده، سرویس LM Studio باید در حال اجرا بماند.
              </p>
            </div>
          </div>
        </ModalPortal>
      ) : null}
    </>
  );
}
