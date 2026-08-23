# Field rules: `other_meanings_fa`

{{> word-extraction/_shared/other_meanings_fa_core_v1.md}}

Preserve reasonable existing alternatives only after they have passed every core semantic rule. Apply a meaningful benefit of the doubt to a valid existing alternative when it is more colloquial, differs mildly in tone or register from `meaning_fa`, uses a different natural grammatical structure in Persian, or would require a natural structural rewrite in the current Persian translation. These differences are acceptable only when the item independently expresses the exact same lexical sense and part of speech. For verbs, the narrow transitive/intransitive exception in the shared core rules is also permitted. Remove an existing alternative when it belongs to a different lexical sense or part of speech, uses an unestablished verb pattern, has a broader or narrower semantic scope, depends only on the current context, is misleading or unnatural for this WordSense, or is a duplicate, spelling variant, definition, explanation, or rare/unhelpful expression.
This benefit of the doubt never permits preserving an item that violates the core rules, including a mere non-established transliteration.

Actively check whether the exact sense of the record is missing any important, common, natural, and meaningfully distinct Persian equivalent, even when the current array is already non-empty. Add a missing alternative when it is genuinely useful for understanding or actively recalling the English word in this exact sense; do not wait for `other_meanings_fa` to be null or empty.

- Valid alternatives may include a common synonym, a natural short phrase when no precise single-word equivalent exists, a useful formal or everyday equivalent, or a loanword that is genuinely established in standard Persian.
- Exact Persian surface-form matching is not mechanical when natural Persian requires a short phrase or a different grammatical structure, but the alternative must preserve the same lexical sense and part of speech. An alternate transitive or intransitive pattern is allowed only under the shared core exception and never controls the primary example sentence.
- Each added alternative must contribute real learning value and be meaningfully distinct from the existing equivalents. Do not add optional synonyms merely to make the array longer.
- Usually return no more than five alternatives. This is a ceiling, not a target; return fewer whenever additional alternatives would be redundant, weak, uncommon, or unnecessary.

The value of `other_meanings_fa` must always be a JSON array of strings:

```json
"other_meanings_fa": ["ملاحظه‌کار", "بااحتیاط"]
```
