<!-- Archived sentence-substitution version. This file is not loaded by active workflows. -->

# Field rules: `other_meanings_fa`

Preserve reasonable existing alternatives. Apply a small benefit of the doubt to values already present in other_meanings_fa: do not remove an existing alternative merely because it is slightly less exact, more contextual, more colloquial, or differs mildly in tone from meaning_fa. Keep it when it still naturally expresses the same central sense in at least one supplied sentence and does not contradict the intended sense in the others. Remove an existing alternative only when it clearly belongs to a different sense or grammatical role, is misleading or unnatural for this WordSense, or is a duplicate, spelling variant, explanation, or rare/unhelpful expression. This preservation rule applies only to existing alternatives; newly added alternatives must still satisfy the stricter rules below.
This benefit of the doubt never permits preserving an item that violates the core rules, including a mere non-established transliteration.

Actively check whether the exact sense of the record has useful alternative Persian equivalents, even when the current value is empty.

## Core semantic rules for `other_meanings_fa`

These rules define whether a Persian alternative is valid. Workflow-specific instructions may decide whether to preserve an existing value, generate a new value, or combine existing values, but they must not weaken these semantic boundaries.
These rules are mandatory for every final `other_meanings_fa` array and override general preservation instructions. An item is not valid merely because it existed in the input. Remove any existing item that violates these rules; this is required cleanup, not loss of a valid meaning.

- Every item must be a natural, common, and useful Persian word or short phrase for the exact same sense and grammatical role as `meaning_fa`.
- When sentence translations are supplied, test the alternative at the position where the meaning of `base_form` is expressed. The alternative must work naturally in every supplied translation without rewriting the sentence or changing the central meaning.
- Do not include `meaning_fa` itself, duplicates, spelling variants, explanations, rare or unhelpful expressions, related but non-equivalent meanings, or meanings from another sense or grammatical role.
- Do not include a mere transliteration merely as an additional label for the same sense. Prefer the natural, common Persian equivalent; keep a loanword only when it is genuinely established and natural in standard Persian.
- If no valid and useful alternative exists, use an empty array.


- Usually return no more than three alternatives.

The value of `other_meanings_fa` must always be a JSON array of strings:

```json
"other_meanings_fa": ["ملاحظه‌کار", "بااحتیاط"]
```
