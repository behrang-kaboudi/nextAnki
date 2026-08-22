The meaning_fa must have one meaning only.
Meanings must be the meaning of the base_form. Do not use meanings of other forms like plurals, past tense, etc.So Meanings must match the base_form.
If there are multiple meanings for different forms, only use those that match the base_form.
Use the natural, common Persian equivalent instead of merely transliterating the English word. Keep a loanword only when it is genuinely established and natural in standard Persian.

1. The meaning must have same grammatical category as the base_form.
2. If meanings are corrupted or noisy, correct them.
3. Do not generate new meanings. Only use the meanings provided in the input.
4. Before writing `meaning_fa`, silently place the same `base_form`, with the same grammatical category and the same intended sense, in a different natural sentence that does not reuse the contextual words from the original sentence; the proposed meaning must remain valid in that new sentence.
5. Every semantic component of `meaning_fa` must be contributed by the `base_form` itself; do not include any component contributed only by any other word or phrase anywhere in the original sentence, regardless of its distance from the `base_form`.
6. Temporarily ignore the original sentence and translate the proposed `meaning_fa` by itself back into English; if the direct natural back-translation contains any content meaning not expressed by the `base_form` with the same grammatical category and intended sense, revise `meaning_fa`.

Apply this test to `meaning_fa` and independently to every item in `other_meanings_fa`.

Sample for semantic-component attribution and reverse translation:

base_form: care
proposed Persian meaning: مراقبت پزشکی
direct back-translation: medical care

The component `medical` is present in the Persian meaning but is not expressed by `care` itself. It comes from another word or from the sentence context. Therefore, `مراقبت پزشکی` is invalid for `care`; use `مراقبت`.
