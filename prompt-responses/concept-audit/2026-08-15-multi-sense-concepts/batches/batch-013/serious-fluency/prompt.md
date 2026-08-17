# Serious fluency audit — batch-013

Read only `/Users/seyedbehrangkaboudi/Personal-Local/Projects/NextJS/Anki/prompt-responses/concept-audit/2026-08-15-multi-sense-concepts/batches/batch-013/serious-fluency/input.json`. It is a JSON array whose records contain exactly `id` and `concept_explained_fa`. Do not access the database, APIs, network, or any other input. Do not modify any source record or any file outside `/Users/seyedbehrangkaboudi/Personal-Local/Projects/NextJS/Anki/prompt-responses/concept-audit/2026-08-15-multi-sense-concepts/batches/batch-013/serious-fluency`.

Review every input record. Add a record to `results` only when the Persian concept has a serious fluency or coherence defect that materially obstructs understanding when read aloud: broken or unfinished phrasing, unclear reference, unrelated fragments, or clauses mechanically joined without a clear semantic relation. Do not flag minor style, merely improvable wording, optional connectors, or harmless punctuation. Copy `id` and `concept_explained_fa` exactly; never rewrite the concept.

Write `/Users/seyedbehrangkaboudi/Personal-Local/Projects/NextJS/Anki/prompt-responses/concept-audit/2026-08-15-multi-sense-concepts/batches/batch-013/serious-fluency/response.json` as valid JSON with exactly:

```json
{"reviewedIds":[1,2],"results":[{"id":2,"concept_explained_fa":"exact original text"}]}
```

`reviewedIds` must contain every input ID exactly once in input order. `results` must be an ordered, unique subset of the input and contain only the two shown keys.

Independently review all decisions and write `/Users/seyedbehrangkaboudi/Personal-Local/Projects/NextJS/Anki/prompt-responses/concept-audit/2026-08-15-multi-sense-concepts/batches/batch-013/serious-fluency/qa.json` with `batchId`, `issueType`, `inputCount`, `reviewedCount`, `resultCount`, `recordScores` containing exactly one `{ "id", "score" }` item per input ID, `minimumScore`, `batchScore`, `checkedCriteria`, `defectsFound`, `correctionsMade`, and `status`. Scores measure the quality of each classification, not the quality of the original concept. Revisit any classification below 8.0; `status` may be `pass` only when every record and the batch score at least 8.0.

Before finishing, validate complete ordered coverage, unique IDs, exact copied concepts, allowed keys, result-subset membership, QA score coverage, and the 8.0 threshold. Do not produce or apply database changes. In the task reply, report only completion or a genuine blocker; the files are authoritative.
