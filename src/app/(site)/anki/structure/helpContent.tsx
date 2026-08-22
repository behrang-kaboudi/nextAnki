import { AnkiNoteTypes } from "@/lib/anki";

import type { HelpKey } from "./types";

export const structureBuilderHelpContent: Record<HelpKey, { title: string; body: React.ReactNode }> = {
  create: {
    title: "Create Structure",
    body: (
      <div className="space-y-2 text-sm leading-6">
        <p>همه‌ی Stepها (1 تا 6) را پشت سر هم اجرا می‌کند و نتیجه را در Log می‌نویسد.</p>
        <p className="text-xs opacity-80">
          پیش‌نیاز: Anki باز باشد، افزونه‌ی AnkiConnect فعال باشد و در Step 3 دسترسی (Permission) را در Anki تأیید
          کرده باشی.
        </p>
      </div>
    ),
  },
  step1: {
    title: "Step 1: Ensure Decks",
    body: (
      <div className="space-y-2 text-sm leading-6">
        <p>تمام دک‌هایی را که در تب «دک‌ها» گزینهٔ مدیریت‌شدن دارند بررسی می‌کند و موارد مفقود را می‌سازد.</p>
        <p className="text-xs opacity-80">
          افزودن یا حذف دک از تنظیمات کاملاً داینامیک است. حذف دک از این صفحه، خود دک موجود در Anki را حذف نمی‌کند.
        </p>
        <p className="text-xs opacity-80">
          این Step فقط ساختار Deck را می‌سازد (تنظیمات و Note Type را تغییر نمی‌دهد).
        </p>
      </div>
    ),
  },
  step2: {
    title: "Step 2: Ensure Deck Configs",
    body: (
      <div className="space-y-2 text-sm leading-6">
        <p>تمام Deck Configهای تعریف‌شده را ایجاد/پیدا می‌کند و روی دک انتخاب‌شده برای هر Config اعمال می‌کند.</p>
        <p className="text-xs opacity-80">
          نام Config، دک متصل، تعداد کارت جدید، مرور روزانه، Learning/Relearning steps و intervalها همگی قابل ویرایش‌اند.
        </p>
        <p className="text-xs opacity-80">
          برای Configهایی که Graduating یا Easy interval دارند، بعد از اجرا مقدار نهایی را در خود Anki نیز بررسی کنید.
        </p>
      </div>
    ),
  },
  step3: {
    title: "Step 3: Ensure Card Types",
    body: (
      <div className="space-y-2 text-sm leading-6">
        <p>Card Typeهای تعریف‌شده در تب «Card Typeها و Templateها» را با Note Type انتخابی هماهنگ می‌کند.</p>
        <p>
          پیش از ساخت Card Type، فیلدهای مفقودی که Templateها به آن‌ها نیاز دارند اضافه می‌شوند تا Anki هنگام
          اعتبارسنجی Template با خطای «Field not found» متوقف نشود.
        </p>
        <p>
          اگر Note Type وجود نداشته باشد، همراه فیلدها و Card Typeهای فعلی ساخته می‌شود. Card Type مفقود اضافه و
          Card Type اضافه حذف می‌شود.
        </p>
        <p className="text-xs font-semibold text-red-700">
          حذف Card Type از تنظیمات و سپس اجرای این Step می‌تواند Card Type و کارت‌های مرتبط را در Anki حذف کند.
          پیش از اجرا حتماً «فقط بررسی» را بزنید.
        </p>
      </div>
    ),
  },
  step4: {
    title: "Step 4: Ensure Note Fields",
    body: (
      <div className="space-y-2 text-sm leading-6">
        <p>
          فیلدهای Note Type فعال را دقیقاً مطابق لیست قابل‌مرتب‌سازی صفحه همگام می‌کند: فیلد اضافه را حذف، فیلد
          مفقود را اضافه و ترتیب را اصلاح می‌کند.
        </p>
        <p className="text-xs font-semibold text-red-700">
          حذف فیلد از تنظیمات و اجرای Step 4، آن فیلد و محتوایش را از Anki حذف می‌کند.
        </p>
        <p className="text-xs opacity-80">
          این Step هیچ Card Typeای ایجاد نمی‌کند. اگر Note Type وجود نداشته باشد، متوقف می‌شود و از شما می‌خواهد
          ابتدا Step 3 را اجرا کنید.
        </p>
      </div>
    ),
  },
  step5: {
    title: "Step 5: Ensure Template Content",
    body: (
      <div className="space-y-2 text-sm leading-6">
        <p>محتوای Front و Back هر Card Type را با Template ویرایش‌شده در صفحه هماهنگ می‌کند.</p>
        <p className="text-xs opacity-80">
          این Step Card Type جدید نمی‌سازد. اگر نوعی مفقود باشد، بدون تغییر متوقف می‌شود و اجرای Step 3 را پیشنهاد
          می‌کند.
        </p>
      </div>
    ),
  },
  step6: {
    title: "Step 6: Move Default Cards to Temp",
    body: (
      <div className="space-y-2 text-sm leading-6">
        <p>
          کارت‌های Note Type فعال را که دقیقاً داخل دک مبدأ انتخاب‌شده هستند پیدا می‌کند و به دک مقصد انتخاب‌شده
          انتقال می‌دهد.
        </p>
        <p className="text-xs opacity-80">
          بررسی دقیق نام دک قبل و بعد از انتقال انجام می‌شود تا کارت‌های زیردک‌های مشابه اشتباهی جابه‌جا نشوند.
        </p>
      </div>
    ),
  },
  copyTemplates: {
    title: "Copy Templates from Anki",
    body: (
      <div className="space-y-2 text-sm leading-6">
        <p>
          Templateهای فعلی Note Type با نام {AnkiNoteTypes.META_LEX_VR9} را از Anki می‌خواند و در تنظیمات
          Structure Builder ذخیره می‌کند.
        </p>
        <p className="text-xs opacity-80">
          این عملیات Templateهای ذخیره‌شده در Structure Builder را بازنویسی می‌کند و فقط در محیط development در دسترس است.
        </p>
      </div>
    ),
  },
};
