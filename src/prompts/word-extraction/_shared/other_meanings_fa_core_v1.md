## Core semantic rules for `other_meanings_fa`

These concept-based rules define whether a Persian alternative is valid. Workflow-specific instructions may decide whether to preserve an existing value, generate a new value, or combine existing values, but they must not weaken these semantic boundaries.
These rules are mandatory for every final `other_meanings_fa` array and override general preservation instructions. An item is not valid merely because it existed in the input. Remove any existing item that violates these rules; this is required cleanup, not loss of a valid meaning.
Evaluate every existing and newly proposed item independently against all core rules before applying any preservation rule. The fact that an item already exists in the input is not evidence of semantic validity.

- Every item must be a natural, common, and useful Persian word or short phrase for the exact same sense and grammatical role as `meaning_fa`.
- Use the supplied sentences and translations to identify the exact lexical sense. An alternative must remain a valid Persian equivalent when `base_form` is used with that same sense in other English sentences, without depending on the surrounding words or grammatical structure of the current sentence.
- Every semantic component of an item must be expressed by the `base_form` itself in the intended sense and grammatical role; no component may depend on another word or phrase from the original sentence.
- Temporarily ignore the original sentence and translate each item by itself back into English. If its most direct natural interpretation requires adding contextual information or produces a concept not expressed by the `base_form` in the intended sense and grammatical role, remove the item.
- An alternative does not need to replace `meaning_fa` word for word in the current Persian translation or fit there without a natural structural rewrite. Do not reject an otherwise valid equivalent solely because it fails that mechanical substitution test.
- Do not include `meaning_fa` itself, duplicates, spelling variants, explanations, context-only translations, rare or unhelpful expressions, broader or narrower concepts, related but non-equivalent meanings, or meanings from another sense or grammatical role.
- Do not include a mere transliteration merely as an additional label for the same sense. Prefer the natural, common Persian equivalent; keep a loanword only when it is genuinely established and natural in standard Persian.
- If no valid and useful alternative exists, use an empty array.
- Apply preservation only after an existing item has passed every core semantic rule. Preservation may tolerate differences in register, wording, or natural Persian grammatical structure, but never a difference in semantic scope.
- If any existing item fails a core semantic rule, remove it and return the complete final `other_meanings_fa` array, even when `requested_fields` is empty.
