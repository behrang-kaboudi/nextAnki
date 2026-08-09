# Field rules: `other_meanings_fa`

Actively check whether the exact sense of the record has useful alternative Persian equivalents, even when the current value is empty.

- Include only natural, common Persian words or short phrases for the same sense and grammatical role as `meaning_fa`.
- Each alternative must be able to replace `meaning_fa` naturally in the supplied sentence context without changing the sentence structure or intended meaning.
- Do not include `meaning_fa` itself, duplicates, spelling variants, explanations, rare words, or meanings that belong to another sense.
- Usually return no more than three alternatives.
- If no useful alternative exists, return an empty array.

The value of `other_meanings_fa` must always be a JSON array of strings:

```json
"other_meanings_fa": ["ملاحظه‌کار", "بااحتیاط"]
```
