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
              رکورد/آپلود صدا از صفحه‌ی{" "}
              <a className="underline" href="/word-hints/audio">
                /word-hints/audio
              </a>
              .
            </li>
            <li>
              رکورد/آپلود صدا از صفحه‌ی{" "}
              <a className="underline" href="/ipa/picture-words/audio">
                /ipa/picture-words/audio
              </a>
              .
            </li>
            <li>
              سینک فایل‌های صوتی از صفحه‌ی{" "}
              <a className="underline" href="/tests/sync-anki-words">
                /tests/sync-anki-words
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
              <a className="underline" href="/word-hints/audio">
                /word-hints/audio
              </a>
            </li>
            <li>
              <a className="underline" href="/ipa/picture-words/audio">
                /ipa/picture-words/audio
              </a>
            </li>
            <li>
              <a className="underline" href="/tests/sync-anki-words">
                /tests/sync-anki-words
              </a>
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
}
