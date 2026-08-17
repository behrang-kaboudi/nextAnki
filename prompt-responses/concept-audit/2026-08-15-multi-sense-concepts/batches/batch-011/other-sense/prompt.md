# Other-sense reference audit — batch-011

Read only `/Users/seyedbehrangkaboudi/Personal-Local/Projects/NextJS/Anki/prompt-responses/concept-audit/2026-08-15-multi-sense-concepts/batches/batch-011/other-sense/input.json`. It is a JSON array whose records contain exactly `id` and `concept_explained_fa`. Do not access the database, APIs, network, or any other input. Do not modify any source record or any file outside `/Users/seyedbehrangkaboudi/Personal-Local/Projects/NextJS/Anki/prompt-responses/concept-audit/2026-08-15-multi-sense-concepts/batches/batch-011/other-sense`.

Review every input record. Add a record to `results` only when the concept text itself clearly and explicitly combines or mentions another independent meaning/sense of the same base word, such as a meta-explanation that the word also means or refers to something else. Do not infer missing context, do not flag multiple facets or usage conditions of one sense, and exclude borderline or uncertain cases. Copy `id` and `concept_explained_fa` exactly; never rewrite the concept.

Write `/Users/seyedbehrangkaboudi/Personal-Local/Projects/NextJS/Anki/prompt-responses/concept-audit/2026-08-15-multi-sense-concepts/batches/batch-011/other-sense/response.json` as valid JSON with exactly:

```json
{"reviewedIds":[1,2],"results":[{"id":2,"concept_explained_fa":"exact original text"}]}
```

`reviewedIds` must contain every input ID exactly once in input order. `results` must be an ordered, unique subset of the input and contain only the two shown keys.

Independently review all decisions and write `/Users/seyedbehrangkaboudi/Personal-Local/Projects/NextJS/Anki/prompt-responses/concept-audit/2026-08-15-multi-sense-concepts/batches/batch-011/other-sense/qa.json` with `batchId`, `issueType`, `inputCount`, `reviewedCount`, `resultCount`, `recordScores` containing exactly one `{ "id", "score" }` item per input ID, `minimumScore`, `batchScore`, `checkedCriteria`, `defectsFound`, `correctionsMade`, and `status`. Scores measure the quality of each classification, not the quality of the original concept. Revisit any classification below 8.0; `status` may be `pass` only when every record and the batch score at least 8.0.

Before finishing, validate complete ordered coverage, unique IDs, exact copied concepts, allowed keys, result-subset membership, QA score coverage, and the 8.0 threshold. Do not produce or apply database changes. In the task reply, report only completion or a genuine blocker; the files are authoritative.
