# Word Hint Story Examples

These examples demonstrate symbol selection and final controlled compression.

## Example 1: all selected tokens are English

Input facts:

```json
{
  "word_sense_id": 30412,
  "english_word_id": 22693,
  "english_word": "perceive",
  "meaning_fa": "درک کردن",
  "sentence_id": 5606,
  "sentence_en": "I perceived a slight change in her tone.",
  "sentence_fa": "من تغییر جزئی‌ای را در لحن او درک کردم.",
  "json_hint": {
    "person": {
      "fa": "گلابی",
      "en": "pear",
      "target_ipa": "per",
      "target_lang": "en"
    },
    "job": {
      "fa": "الک",
      "en": "sieve",
      "target_ipa": "sɪv",
      "target_lang": "en"
    }
  }
}
```

Selected tokens: `pear`, then `sieve`.

Final story:

> یک **pear** سخنگو داخل یک **sieve** می‌افتد و لحن صدایش اندکی تغییر می‌کند. شنونده این تغییر ظریف را **درک می‌کند**.

## Example 2: mixed English and Persian selections

Input facts:

```json
{
  "word_sense_id": 43291,
  "english_word_id": 31294,
  "english_word": "subtle",
  "meaning_fa": "نامحسوس",
  "sentence_id": 29138,
  "sentence_en": "The updated logo has several subtle differences.",
  "sentence_fa": "نشان جدید چند تفاوت نامحسوس دارد.",
  "json_hint": {
    "person": {
      "fa": "نمک",
      "en": "salt",
      "target_ipa": "sʌlt",
      "target_lang": "en"
    },
    "job": {
      "fa": "تلفن",
      "en": "phone",
      "target_ipa": "telefon",
      "target_lang": "fa"
    }
  }
}
```

Selected tokens: `salt`, then `تلفن`.

Final story:

> چند دانه **salt** روی صفحهٔ **تلفن** می‌ریزند و لوگوی جدید را اندکی تغییر می‌دهند. تفاوت‌ها آن‌قدر **نامحسوس‌اند** که فقط با دقت دیده می‌شوند.

## One-symbol rule

When a valid `json_hint` contains only one usable symbol, use that one symbol
actively and return a one-item `selected_symbols` array. Do not invent a second
symbol merely to imitate the two-symbol examples above.
