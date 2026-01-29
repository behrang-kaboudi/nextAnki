══════════════════════════════════════
RULES FOR meaning_fa
First, identify all the meanings provided in the input.
for each meaning, create a separate object in the output array.
The meaning_fa must have one meaning only.
Meanings must be the meaning of the base_form. Do not use meanings of other forms like plurals, past tense, etc.So Meanings must match the base_form.
If there are multiple meanings for different forms, only use those that match the base_form.

1. The meaning must have same grammatical category as the base_form.
2. If meanings are corrupted or noisy, correct them.
3. Do not generate new meanings. Only use the meanings provided in the input.
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
