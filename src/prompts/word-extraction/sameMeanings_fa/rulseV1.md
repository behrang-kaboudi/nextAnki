==============================================================================
sameMeanings_fa

You are given:

- meaning_fa (the main Persian meaning)
- sentence_en_meaning_fa (the Persian meaning of the example sentence)

Your task:
Generate a field called sameMeanings_fa as a SINGLE STRING.

STRICT RULES FOR sameMeanings_fa:

1. Include ONLY Persian words or very short phrases that:
   - can naturally REPLACE meaning_fa inside sentence_en_meaning_fa
   - keep the sentence fluent, idiomatic, and commonly used
   - preserve the same grammatical role (noun ↔ noun, adjective ↔ adjective)

2. Replacement test (MANDATORY):
   Mentally replace meaning_fa with each candidate.
   If a native Persian speaker would still accept the sentence as natural,
   keep the word.
   Otherwise, DISCARD it.

3. DO NOT include:
   - dictionary-only or abstract synonyms
   - words that require changing the verb, structure, or sentence logic
   - rare, literary, poetic, or academic words
   - explanations, paraphrases, or long phrases

4. If NO valid replacements exist:
   - output sameMeanings_fa as an EMPTY STRING ""
   - NOT null, NOT omitted

5. Formatting rules (MANDATORY):
   - Output MUST be a single string
   - Separate multiple meanings using ONLY the character \*
   - NO spaces before or after \*
   - NO leading or trailing spaces
   - NO duplicate or near-duplicate meanings

6. Output ONLY the string value.
   No comments. No explanations.

Output example:
sameMeanings_fa: "ملاحظه‌کار\*بااحتیاط"
===================================================================================
