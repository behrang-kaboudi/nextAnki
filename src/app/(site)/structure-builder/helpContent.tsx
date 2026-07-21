import { AnkiNoteTypes } from "@/lib/anki";

import type { HelpKey } from "./types";

export const structureBuilderHelpContent: Record<HelpKey, { title: string; body: React.ReactNode }> = {
  create: {
    title: "Create Structure",
    body: (
      <div className="space-y-2 text-sm leading-6">
        <p>همه‌ی Stepها (1 تا 4) را پشت سر هم اجرا می‌کند و نتیجه را در Log می‌نویسد.</p>
        <p className="text-xs opacity-80">
          پیش‌نیاز: Anki باز باشد، افزونه‌ی AnkiConnect فعال باشد و در Step 3 دسترسی (Permission) را در Anki تایید
          کرده باشی.
        </p>
      </div>
    ),
  },
  step1: {
    title: "Step 1: Ensure Decks",
    body: (
      <div className="space-y-2 text-sm leading-6">
        <p>دک‌های اصلی و زیر-دک‌ها را چک می‌کند و اگر وجود نداشته باشند می‌سازد.</p>
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
        <p>Deck Configهای مورد نیاز را ایجاد/پیدا می‌کند و روی Deckهای مربوطه اعمال می‌کند.</p>
        <p className="text-xs opacity-80">
          اگر بعد از اجرا یک هشدار قرمز دیدی، یعنی برای deckِ Rahnama باید دو interval را دستی در Anki بررسی/تنظیم
          کنی.
        </p>
      </div>
    ),
  },
  step3: {
    title: "Step 3: Ensure Note Type",
    body: (
      <div className="space-y-2 text-sm leading-6">
        <p>Note Type با نام {AnkiNoteTypes.META_LEX_VR9} را می‌سازد/بررسی می‌کند.</p>
        <p>
          سپس فیلدها را دقیقاً مطابق <span className="font-mono">WordAnkiConstants.noteFields</span> سینک می‌کند:
          فیلد اضافه را حذف می‌کند، فیلدهای کم را اضافه می‌کند و ترتیب را هم دقیقاً همان ترتیب ثابت‌ها قرار می‌دهد.
        </p>
        <p className="text-xs opacity-80">
          اگر یک فیلد جدید (مثلاً <span className="font-mono">other_meanings_fa</span>) به noteFields اضافه کردی،
          همین Step را اجرا کن تا در Anki هم ساخته شود.
        </p>
      </div>
    ),
  },
  step4: {
    title: "Step 4: Ensure Templates",
    body: (
      <div className="space-y-2 text-sm leading-6">
        <p>Templateهای کارت‌ها (EnToFa / FaToEn / Emla / Rahnama) را برای Note Type تنظیم/ایجاد می‌کند.</p>
        <p className="text-xs opacity-80">اگر خروجی کارت‌ها درست نیست، بعد از Step 3 معمولاً اجرای Step 4 کافی است.</p>
      </div>
    ),
  },
};
