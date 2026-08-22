══════════════════════════════════════
RULES FOR meaning_fa
First, identify all the meanings provided in the input.
اگر معنی کلمه ای مشخص نشده بود مهمترین معنی برای اون کلمه رو بگو و در این صورت بیشتر از یک معنی برای کلمه نگو. یعنی معانی دیگر رو استخراج نکن.
for each meaning, create a separate object in the output array.
{{> word-extraction/_shared/meaning_fa_core_v1.md}}
   sample input:
   remark - / نظر اظهار نظر
   ❌ Wrong
   "meaning_fa": "نظر - اظهار نظر"
   ❌ Wrong
   "meaning_fa": "اظهار نظر کردن"
   ✅ Correct
   [
   { "meaning_fa": "نظر", ... },
   { "meaning_fa": "اظهار نظر", ... }
   ]
   ══════════════════════════════════════
