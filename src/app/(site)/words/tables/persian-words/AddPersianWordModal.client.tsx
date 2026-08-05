"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type AddResult = {
  action: "created" | "variant_added" | "unchanged";
  item: { id: number; canonical_text: string; normalized_text: string };
  canonicalText: string;
  normalizedText: string;
};

const actionText: Record<AddResult["action"], string> = {
  created: "رکورد جدید ساخته شد.",
  variant_added: "شکل نوشتاری جدید به آرایهٔ variantها اضافه شد.",
  unchanged: "هیچ تغییری لازم نبود؛ این شکل نوشتاری از قبل ثبت شده است.",
};

export default function AddPersianWordModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AddResult | null>(null);

  const close = () => {
    if (busy) return;
    setOpen(false);
    setError(null);
    setResult(null);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/words/persian-words", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | ({ ok: true } & AddResult)
        | null;
      if (!response.ok || !payload?.ok || !("action" in payload)) {
        const message = payload && "error" in payload ? payload.error : null;
        throw new Error(message || "ثبت کلمه ناموفق بود.");
      }
      setResult(payload);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  return <>
    <button type="button" onClick={() => setOpen(true)} className="rounded border px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5">
      افزودن کلمه
    </button>
    {open ? <div className="fixed inset-0 z-50 bg-black/45 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label="افزودن کلمهٔ فارسی" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <div className="mx-auto mt-[10vh] w-full max-w-lg rounded-2xl border border-card bg-background p-4 shadow-elevated">
        <div className="flex items-center justify-between gap-3"><h2 className="text-base font-semibold">افزودن کلمهٔ فارسی</h2><button type="button" onClick={close} disabled={busy} className="rounded border px-3 py-1.5 text-sm disabled:opacity-50">بستن</button></div>
        <label className="mt-4 grid gap-1 text-sm">کلمه یا عبارت
          <textarea autoFocus value={text} onChange={(event) => setText(event.target.value)} dir="rtl" rows={3} className="rounded border px-3 py-2 text-base" placeholder="مثلاً قرار دادن" />
        </label>
        <p className="mt-2 text-xs opacity-70">فرم کامل برای تشخیص رکورد و فرم نیمه برای canonical_text استفاده می‌شود. شکل خامِ متفاوت به variantها افزوده خواهد شد.</p>
        {error ? <div className="mt-3 rounded border border-red-500/30 bg-red-600/10 p-3 text-sm text-red-700">{error}</div> : null}
        {result ? <div className="mt-3 rounded border border-green-500/30 bg-green-600/10 p-3 text-sm"><p>{actionText[result.action]}</p><dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1"><dt>شناسه</dt><dd>{result.item.id}</dd><dt>canonical</dt><dd dir="rtl">{result.canonicalText}</dd><dt>normalized</dt><dd dir="rtl">{result.normalizedText}</dd></dl></div> : null}
        <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={close} disabled={busy} className="rounded border px-3 py-2 text-sm disabled:opacity-50">{result ? "تمام" : "انصراف"}</button><button type="button" onClick={submit} disabled={busy || !text} className="rounded border px-3 py-2 text-sm hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5">{busy ? "در حال ثبت…" : "تأیید و ثبت"}</button></div>
      </div>
    </div> : null}
  </>;
}
