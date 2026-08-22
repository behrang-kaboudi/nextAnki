══════════════════════════════════════
field name: sentence_en_meaning_fa
RULES FOR sentence_en_meaning_fa

Translate the complete `sentence_en` naturally and accurately into contemporary standard Persian.

SENSE ANCHORING

1. Use `base_form`, `meaning_fa`, `pos`, and the supplied context to identify the exact intended sense of the target word or phrase.
2. `meaning_fa` is a semantic anchor. It determines the intended sense, but its exact wording must not be mechanically inserted into the Persian sentence.
3. Preserve the same lexical sense and grammatical role of the target as used in `sentence_en`.
4. For idioms, phrasal verbs, compounds, and fixed expressions, translate the complete expression according to its contextual meaning rather than translating its components separately.

ACCURACY

5. Translate the complete sentence, not only the target word.
6. Preserve all meaning expressed by the English sentence, including:
   - participants and their relationships;
   - tense, aspect, modality, and polarity;
   - conditions, comparisons, causes, purposes, and time relationships;
   - degree, emphasis, tone, and register when relevant.
7. Do not add information, implications, intensity, certainty, or interpretation that the English sentence does not express.
8. Do not omit or weaken meaningful information from the English sentence.
9. Do not change the intended sense merely to produce a more common or easier Persian sentence.

NATURAL PERSIAN

10. Use natural Persian word order, grammar, verb conjugation, collocations, and idiomatic phrasing.
11. Freely restructure the sentence when necessary for natural Persian, provided that the complete meaning remains unchanged.
12. Convert dictionary forms such as Persian infinitives into the grammatically correct form required by the sentence.
13. Do not force `meaning_fa` into the translation when another inflected or structurally natural expression conveys exactly the same sense.
14. Avoid awkward word-for-word translation, translationese, unnatural nominalizations, and unnecessarily formal or archaic Persian.
15. Use contemporary standard Iranian Persian unless the English sentence clearly requires a different register.

EXISTING TRANSLATIONS

16. When an existing Persian translation is supplied, preserve it if it is complete, accurate, natural, and uses the target in the correct sense.
17. Do not rewrite a valid translation merely because another wording is possible.
18. Correct an existing translation only when it has a real semantic, grammatical, fluency, register, or completeness defect.

FINAL CHECK

Before returning the value, verify that:

- the full English sentence is represented;
- the target retains the intended `meaning_fa` sense;
- the Persian sentence is grammatically complete and natural;
- no dictionary-form infinitive has been inserted where a conjugated verb is required;
- no information has been added, removed, strengthened, or weakened.

Return exactly one Persian translation string and no explanation.

Example:

`sentence_en`: "She wore a clean shirt to the interview."
`meaning_fa`: "پوشیدن"

Incorrect:
"او یک پیراهن تمیز برای مصاحبه پوشیدن."

Correct:
"او برای مصاحبه یک پیراهن تمیز پوشید."
══════════════════════════════════════
