# Independent QA and correction — batch-004

Independently review the complete batch using:
- source: `/Users/seyedbehrangkaboudi/Personal-Local/Projects/NextJS/Anki/prompt-responses/concept-repair/2026-08-15-direct-repair-212/batches/batch-004/input.json`
- proposed response: `/Users/seyedbehrangkaboudi/Personal-Local/Projects/NextJS/Anki/prompt-responses/concept-repair/2026-08-15-direct-repair-212/batches/batch-004/response.json`
- generator QA: `/Users/seyedbehrangkaboudi/Personal-Local/Projects/NextJS/Anki/prompt-responses/concept-repair/2026-08-15-direct-repair-212/batches/batch-004/self-qa.json`

Write exactly these two new artifacts in the same batch folder:
- `corrected-response.json`
- `qa.json`

Do not edit or replace the source input, `response.json`, or `self-qa.json`. Do not query any database, call any API, use the network, inspect unrelated files, or mutate application data.

Review every record from scratch. Treat `meaning_fa`, same-sense `other_meanings_fa`, and sentences as the target-sense anchors. Use `sibling_senses` only to recognize independent senses that must not appear. Preserve all correct target-sense content, remove every independent-sense reference, and require natural, complete Persian with appropriate connectors and punctuation. A `serious_fluency`-only record should receive the smallest meaning-preserving rewrite. Each concept must be self-contained, contain at most 50 whitespace-delimited words, and contain no meta-commentary or English headword.

Correct every substantive defect you find. `corrected-response.json` must use the exact three-key response schema `{ "reviewedIds", "results", "needsHumanReview" }`; preserve all input IDs in exact order, use exact result keys `{ "id", "concept_explained_fa" }`, keep results ordered, and require results plus human-review entries to cover every input exactly once without overlap. A genuine unresolved source conflict belongs in `needsHumanReview`; never hide uncertainty.

`qa.json` must contain: `batchId`, `inputCount`, `reviewedCount`, `resultCount`, `needsHumanReviewCount`, `recordScores`, `minimumScore`, `batchScore`, `checkedCriteria`, `defectsFound`, `correctionsMade`, and `status`. Score every input record independently for correctness, completeness, relevance, preservation, sense isolation, fluency, clarity, consistency, word limit, and schema. Include exactly one ordered `{ "id": number, "score": number, "status": "pass" }` per input. No record or batch may pass below 8.0. Correct and rescore until every record and the whole batch pass; use `status: "pass"` only when `needsHumanReview` is empty.

