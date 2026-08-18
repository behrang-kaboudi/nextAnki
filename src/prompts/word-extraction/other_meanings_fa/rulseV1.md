# Field rules: `other_meanings_fa`

Preserve reasonable existing alternatives. Apply a small benefit of the doubt to values already present in other_meanings_fa: do not remove an existing alternative merely because it is slightly less exact, more colloquial, differs mildly in tone from meaning_fa, or would require a natural structural rewrite in the current Persian translation. Keep it when it is still a natural and useful equivalent of the same lexical sense and grammatical role beyond the wording of one sentence. Remove an existing alternative when it belongs to a different sense or grammatical role, depends only on the current context, is misleading or unnatural for this WordSense, or is a duplicate, spelling variant, explanation, or rare/unhelpful expression. This preservation rule applies only to existing alternatives; newly added alternatives must still satisfy the stricter rules below.
This benefit of the doubt never permits preserving an item that violates the core rules, including a mere non-established transliteration.

Actively check whether the exact sense of the record has useful alternative Persian equivalents, even when the current value is empty.

{{> word-extraction/_shared/other_meanings_fa_core_v1.md}}

- Usually return no more than three alternatives.

The value of `other_meanings_fa` must always be a JSON array of strings:

```json
"other_meanings_fa": ["ملاحظه‌کار", "بااحتیاط"]
```
