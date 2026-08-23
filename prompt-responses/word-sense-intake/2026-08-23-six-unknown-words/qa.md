# QA report

## Scope

Six full-mode WordSense candidates, reviewed independently and as one batch. No database or study-list mutation was performed.

## Per-item review

| Target | Score | Result | Review summary |
|---|---:|---|---|
| undermine | 9.4/10 | Pass | Transitive weakening sense, participant roles, Persian equivalents, example, translation, IPA, and scores agree. |
| deteriorate | 9.4/10 | Pass | Intransitive worsening sense is preserved across the meaning, sentence, and translation. |
| discrepancy | 9.3/10 | Pass | The noun denotes an unexpected mismatch between values or records expected to agree. |
| plausible | 9.5/10 | Pass | The selected adjective means seemingly reasonable or believable without claiming proven truth. |
| negligible | 9.4/10 | Pass | The adjective consistently expresses an amount or effect small enough to disregard. |
| concede | 9.4/10 | Pass | The selected transitive `concede that` sense expresses often-unwilling admission, not surrender or granting. |

## Checks completed for every item

- Exact normalized American `base_form` and correct contextual `pos`.
- Exactly twelve fields in the required order; no extra identity or workflow fields.
- One primary Persian meaning with only same-sense, nonduplicate alternatives.
- Primary meaning passed separate-sentence, semantic-attribution, back-translation, and exact lexical-unit checks.
- Verb transitivity and participant roles agree across `meaning_fa`, `sentence_en`, and `sentence_en_meaning_fa`.
- Concept explanation is standalone, disambiguating, natural Persian, and under 50 Persian words.
- Example is contemporary American English, natural, 6–14 words, and demonstrates the selected sense.
- Persian translation is complete, natural, and preserves tense, polarity, participants, and the selected sense.
- General American and Tehrani Persian IPA values are nonempty and contain no delimiters.
- `imageability`, `learning_depth`, and `productive_target` are within their required ranges and score only the selected sense.

## Batch result

- Score: 9.4/10
- Critical defects: none
- Schema/order coverage: 6 of 6 pass
- Semantic coverage: 6 of 6 pass
- Status: reviewed, explicitly approved, applied through six single-item API requests, and independently verified

## Application verification

- Six of six requests returned HTTP 201, `ok: true`, and `action: created`.
- Exact-search verification returned one stored WordSense for every target with IDs 45076 through 45081.
- The `behrang` study-list response contained all six required IDs.
- The first insertion response showed that ID 41952 was already absent from the live list. A temporary audit re-add was reversed after implementation inspection confirmed that the insertion endpoint could not have removed that ID; the final list contains exactly the six newly approved IDs.
- No Anki card operation or sync was performed.

## Lexical references

- Cambridge Dictionary: `undermine`, `deteriorate`, `discrepancy`, `plausible`, `negligible`, and `concede` definitions and American pronunciations.
- Merriam-Webster: `undermine` transitive gradual-weakening sense and pronunciation cross-check.
