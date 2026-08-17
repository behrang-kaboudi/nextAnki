# Direct WordSense concept repair — batch-005

Work only on this batch. Read every record from:
`/Users/seyedbehrangkaboudi/Personal-Local/Projects/NextJS/Anki/prompt-responses/concept-repair/2026-08-15-direct-repair-212/batches/batch-005/input.json`

Write exactly these two artifacts in the same batch folder:
- `response.json`
- `self-qa.json`

Do not query any database, call any API, use the network, edit the input, inspect unrelated files, or mutate application data.

## Semantic contract

- `meaning_fa`, `other_meanings_fa`, and the supplied sentences define the target WordSense. Every `other_meanings_fa` value is an alternative Persian translation of the same target sense, not a separate sense.
- `sibling_senses` is exclusion context that helps identify other independent senses of the same English word. Do not import an independent sibling sense into the repaired concept.
- Preserve every correct, relevant idea from the current concept, though not necessarily word for word. You may add a small clarification only when supported by the target meanings and sentences.
- For `other_sense_reference`, remove every explanation, contrast, aside, or example that refers to another independent sense. The result must describe only the target sense.
- For `serious_fluency`, make the Persian complete, natural, connected, and correctly punctuated. If this is the only issue, make the smallest meaning-preserving rewrite.
- Produce one self-contained Persian concept of at most 50 whitespace-delimited words. Do not mention the English headword, sibling senses, the audit, the prompt, or phrases such as “در معنای دیگر”.
- Do not change meanings, POS, sentences, identifiers, workflow flags, statuses, relations, or any database field. Your output proposes only `concept_explained_fa`.

## `response.json` schema

Use exactly these top-level keys:

```json
{
  "reviewedIds": [1, 2],
  "results": [
    {
      "id": 1,
      "concept_explained_fa": "متن اصلاح‌شده"
    }
  ],
  "needsHumanReview": []
}
```

- `reviewedIds` must equal all input IDs in exact input order.
- Normally `results` must contain one corrected result for every input ID in the same order.
- Use exact result keys `id` and `concept_explained_fa`; copy no other input fields.
- If authoritative fields genuinely conflict and no safe concept can be written, omit that ID from `results` and add exactly `{ "id": number, "reason": "..." }` to `needsHumanReview`. Do not guess.
- `results` and `needsHumanReview` must be disjoint and together cover every reviewed ID exactly once.

## Mandatory self-QA

Review every record after generation for target-sense correctness, preservation of valid content, removal of independent senses, fluency, clarity, completeness, internal consistency, 50-word limit, exact schema, ID coverage, and exact ordering. Correct every defect before finalizing.

`self-qa.json` must contain: `batchId`, `inputCount`, `reviewedCount`, `resultCount`, `needsHumanReviewCount`, `recordScores`, `minimumScore`, `batchScore`, `checkedCriteria`, `defectsFound`, `correctionsMade`, and `status`. `recordScores` must contain exactly one `{ "id": number, "score": number, "status": "pass" }` for every input ID in order. No score or batch score may be below 8.0; otherwise correct the content and perform QA again. Use `status: "pass"` only when the entire batch passes and `needsHumanReview` is empty.

