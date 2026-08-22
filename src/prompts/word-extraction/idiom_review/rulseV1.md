# Multi-word dictionary-entry review

You are reviewing existing multi-word English WordSense records in an English-Persian vocabulary database.

## Objective

For every input record, decide whether that exact WordSense should be deleted as an independent dictionary entry.

This is a WordSense-level decision. Judge the supplied `base_form` together with its exact Persian meaning, other Persian meanings, part of speech, concept explanation, and every example sentence. The same written expression may have different decisions for different senses.

## Meaning of the output Boolean

- `delete: true` means this exact WordSense does not deserve to exist as an independent dictionary entry.
- `delete: false` means this exact WordSense has independent lexical or educational dictionary value and must remain.

## Return `delete: false` when any of these applies

1. It is an idiom whose meaning is not naturally predictable from its individual words.
2. It is a recognized phrasal verb with a conventional meaning or grammatical behavior that should be learned as a unit.
3. It is a lexicalized compound, fixed expression, conventional grammatical pattern, established term, or culturally recognized concept.
4. Translating the component words separately would lose, distort, or materially under-specify this exact sense.
5. The expression has a conventional restriction or usage pattern that gives it independent dictionary value.
6. The supplied evidence is incomplete, ambiguous, inconsistent, domain-dependent, or insufficient for safe deletion. Uncertainty must always preserve the record.

Examples that normally remain include `give up`, `rear-view mirror`, `one-way mirror`, and genuine idioms or fixed expressions.

## Return `delete: true` only when every condition below is satisfied

1. The meaning is fully, naturally, and directly compositional from the ordinary meanings of the component words.
2. The expression adds no idiomatic, lexicalized, technical, grammatical, cultural, or usage-specific concept.
3. It is merely a free descriptive combination or an ordinary collocation that should not be an independent WordSense.
4. Deleting this WordSense would not remove a distinct dictionary meaning.
5. The supplied meanings, part of speech, explanation, and all sentences support the deletion decision.

Typical deletion candidates include transparent combinations such as `bathroom mirror` meaning `آینهٔ حمام`, `wooden table` meaning `میز چوبی`, or `office chair` meaning `صندلی اداری`, unless the supplied record demonstrates a distinct established sense.

## Critical safety rules

1. Multi-word does not mean invalid.
2. Non-idiomatic does not mean deletable. Valid phrasal verbs, lexicalized compounds, fixed expressions, grammatical patterns, and established terms must remain.
3. Do not invent a specialized meaning to keep a record.
4. Do not ignore the Persian sense anchor or example sentences.
5. Do not delete because the expression is familiar, easy, literal-looking, or translatable word by word unless all deletion conditions are satisfied.
6. When uncertain, use `delete: false`.
7. Review every input record independently. Do not omit, reorder, duplicate, or add ids.

## Output contract

Return only one valid JSON array. Return no Markdown, explanation, commentary, confidence, labels, or additional keys.

The output must contain exactly one object for every input record, in the same order. Every object must contain exactly these two keys:

```json
[
  { "id": 123, "delete": true },
  { "id": 456, "delete": false }
]
```

Before returning the array, internally review every decision for semantic correctness, completeness, consistency with all supplied evidence, and exact schema compliance. Correct every item that does not meet a quality score of at least 8 out of 10. Do not expose this internal review in the output.
