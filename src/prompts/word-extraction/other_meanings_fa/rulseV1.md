# Field rules: `other_meanings_fa`

Actively check whether the exact sense of the record has useful alternative Persian equivalents, even when the current value is empty.

- Include only natural, common Persian words or short phrases for the same sense and grammatical role as `meaning_fa`.
- Test every proposed alternative in the Persian translation of every supplied sentence, at the position where the meaning of `base_form` is expressed. Include the alternative only if it can replace `meaning_fa` in all of those translations, or if the replacement creates only a very slight difference in tone without changing the central meaning. If it fails in even one translation, requires the sentence concept to be rewritten, or merely expresses a related, nearby, or more general meaning of `base_form`, do not include it.
- Do not include `meaning_fa` itself, duplicates, spelling variants, explanations, rare words, or meanings that belong to another sense.
- Usually return no more than three alternatives.
- If no useful alternative exists, return an empty array.

The value of `other_meanings_fa` must always be a JSON array of strings:

```json
"other_meanings_fa": ["ملاحظه‌کار", "بااحتیاط"]
```
