The meaning_fa must have one meaning only.
Meanings must be the meaning of the base_form. Do not use meanings of other forms like plurals, past tense, etc.So Meanings must match the base_form.
If there are multiple meanings for different forms, only use those that match the base_form.
Use the natural, common Persian equivalent instead of merely transliterating the English word. Keep a loanword only when it is genuinely established and natural in standard Persian.

1. The meaning must have same grammatical category as the base_form.
2. If meanings are corrupted or noisy, correct them.
3. Do not generate new meanings. Only use the meanings provided in the input.
4. For a verb or phrasal verb, identify the grammatical pattern of the intended primary use, including whether that use is transitive or intransitive. When a source sentence is supplied, its actual use selects the primary pattern. When no source sentence is supplied, use the pattern expressed by the intended primary Persian meaning and the established English use of the same sense.
5. Make the Persian dictionary form preserve that primary pattern naturally. For example, a causative or transitive use may require a form such as `کردن` or `دادن`, while an intransitive use may require `شدن`, `یافتن`, or another natural non-causative form. Do not apply these endings mechanically; preserve the real English meaning and argument structure.
6. If the same English verb has an established transitive and intransitive use for the same lexical sense, keep exactly one of them in `meaning_fa`: the one selected for the primary use. Do not combine both patterns in the primary meaning and do not invent the opposite pattern merely because it seems theoretically possible.
7. Before writing `meaning_fa`, silently place the same `base_form`, with the same grammatical category, primary grammatical pattern, and intended sense, in a different natural sentence that does not reuse the contextual words from the original sentence; the proposed meaning must remain valid in that new sentence.
8. Every semantic component of `meaning_fa` must be contributed by the `base_form` itself; do not include any component contributed only by any other word or phrase anywhere in the original sentence, regardless of its distance from the `base_form`.
9. Temporarily ignore the original sentence and translate the proposed `meaning_fa` by itself back into English; if the direct natural back-translation contains any content meaning or argument structure not expressed by the `base_form` with the same grammatical category, primary grammatical pattern, and intended sense, revise `meaning_fa`.
10. Apply the exact lexical-unit round-trip test: `base_form` -> `meaning_fa` -> English must return the same exact lexical unit as `base_form`.
11. If the most direct natural back-translation is a longer English expression containing `base_form`, the Persian meaning belongs to that longer expression and is invalid for the shorter `base_form`. If it returns only a shorter component of a multi-word `base_form`, the Persian meaning is incomplete for the full expression.

Apply this test to `meaning_fa` and independently to every item in `other_meanings_fa`.

Sample for semantic-component attribution and reverse translation:

base_form: care
proposed Persian meaning: مراقبت پزشکی
direct back-translation: medical care

The component `medical` is present in the Persian meaning but is not expressed by `care` itself. It comes from another word or from the sentence context. Therefore, `مراقبت پزشکی` is invalid for `care`; use `مراقبت`.

Sample for exact lexical-unit round-trip:

base_form: initiative
proposed Persian meaning: پیش‌قدم شدن
direct back-translation: take the initiative

The back-translation is a longer lexical unit, so `پیش‌قدم شدن` is invalid for `initiative` and belongs to `take the initiative`.
