import Link from "next/link";

export default function HowToDoPage() {
  return (
    <main dir="rtl" lang="fa" className="mx-auto w-full max-w-3xl p-4 text-right">
      <h1 className="text-2xl font-semibold">راهنما (How to do)</h1>

      <div className="mt-4 space-y-4">
        <section className="rounded border p-4">
          <h2 className="text-base font-semibold">به عنوان راهنما</h2>
          <p className="mt-2 text-sm leading-7 opacity-90">
            این صفحه برای جمع کردن چند دستورالعمل کوتاه و کاربردی ساخته شده تا کارهای تکراری سریع‌تر انجام شود.
          </p>
        </section>

        <section className="rounded border p-4">
          <h2 className="text-base font-semibold">نحوه ویرایش فایل‌های صوتی</h2>
          <p className="mt-2 text-sm leading-7 opacity-90">
            برای ساخت/تغییر صوت‌ها (و اینکه بعداً روی Anki اعمال شوند) این ترتیب را انجام بده:
          </p>
          <ol className="mt-3 list-decimal space-y-2 ps-6 text-sm leading-7">
            <li>
              ویرایش (Generate/Record/Upload/Delete) صوت‌ها از صفحه‌ی{" "}
              <Link className="underline" href="/words/editor">
                /words/editor
              </Link>{" "}
              انجام شود (با این کار فیلد <span className="font-mono">updatedAt</span> هم به‌روز می‌شود).
            </li>
            <li>
              سینک فایل‌های صوتی از صفحه‌ی{" "}
              <a className="underline" href="/tests/sync/anki-words">
                /tests/sync/anki-words
              </a>
              .
            </li>
            <li>در نهایت سینک فیلد (به‌روزرسانی فیلد مربوطه در Anki).</li>
          </ol>
        </section>

        <section className="rounded border p-4">
          <h2 className="text-base font-semibold">لینک‌های سریع</h2>
          <p className="mt-2 text-sm leading-7 opacity-90">
            دسترسی مستقیم به صفحه‌های مربوطه:
          </p>
          <ul className="mt-3 list-disc space-y-2 ps-6 text-sm leading-7">
            <li>
              <Link className="underline" href="/words/editor">
                /words/editor
              </Link>
            </li>
            <li>
              <a className="underline" href="/tests/sync/anki-words">
                /tests/sync/anki-words
              </a>
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
