## Core semantic rules for `other_meanings_fa`

These rules define whether a Persian alternative is valid. Workflow-specific instructions may decide whether to preserve an existing value, generate a new value, or combine existing values, but they must not weaken these semantic boundaries.
These rules are mandatory for every final `other_meanings_fa` array and override general preservation instructions. An item is not valid merely because it existed in the input. Remove any existing item that violates these rules; this is required cleanup, not loss of a valid meaning.

- Every item must be a natural, common, and useful Persian word or short phrase for the exact same sense and grammatical role as `meaning_fa`.
- When sentence translations are supplied, test the alternative at the position where the meaning of `base_form` is expressed. The alternative must work naturally in every supplied translation without rewriting the sentence or changing the central meaning.
- Do not include `meaning_fa` itself, duplicates, spelling variants, explanations, rare or unhelpful expressions, related but non-equivalent meanings, or meanings from another sense or grammatical role.
- Do not include a mere transliteration merely as an additional label for the same sense. Prefer the natural, common Persian equivalent; keep a loanword only when it is genuinely established and natural in standard Persian.
- If no valid and useful alternative exists, use an empty array.
