══════════════════════════════════════
Field name: learning_depth
learning_depth:
Determine how SERIOUSLY a non-specialist learner should study the exact WordSense shown in the input.
Use its Persian meaning, part of speech, concept explanation, and example sentence. Do not score a different or more common meaning of the same base_form.

The score must reflect whether the word:

- must be actively memorized,
- must be understood accurately,
- or only needs general awareness.
  learning_depth = -100 → completely excluded from learning
  learning_depth ∈ [0.00, 1.00] → indicates the REQUIRED DEPTH of learning. 1. 0.00 – 0.30 → general awareness is enough (concept-level only) 2. 0.30 – 0.55 → general understanding needed (no active memorization) 3. 0.55 – 0.75 → accurate understanding required (important, not core) 4. 0.75 – 1.00 → active memorization is essential (core vocabulary)
  EVALUATION CRITERIA:
  Consider ALL of the following:

1. Is the word commonly used in everyday speech?
2. Is it mostly heard from experts (doctors, lawyers, news)?
3. Would misunderstanding this word cause real confusion or problems?
4. Does a simpler alternative exist for daily speech?
5. Is this word essential for basic communication?
   ══════════════════════════════════════
