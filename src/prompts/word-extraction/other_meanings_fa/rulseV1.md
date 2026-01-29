==============================================================================
field name: other_meanings_fa

Your task:
Generate a field called other_meanings_fa as a SINGLE STRING.

STRICT RULES FOR other_meanings_fa:

1. Include ONLY Persian words or very short phrases that:
   - can naturally REPLACE meaning_fa inside sentence_en_meaning_fa
   - keep the sentence fluent, idiomatic, and commonly used
   - preserve the same grammatical role (noun ↔ noun, adjective ↔ adjective)

2. Replacement test (MANDATORY):
   Mentally replace meaning_fa with each candidate.
   If a native Persian speaker would still accept the sentence as natural,
   keep the word.
   Otherwise, DISCARD it.

3. Common-Name / Colloquial Equivalence Rule (MODE Y):
   - If meaning_fa has a widely used common-name or everyday colloquial equivalent
     that native speakers naturally use interchangeably,
     it MAY be included.
   - The alternative MUST:
     - fit the SAME sentence without changing verb or structure
     - be commonly understood (not rare, poetic, academic, or regional-only)
     - preserve the same grammatical role

4. DO NOT include:
   - dictionary-only or abstract synonyms
   - words that require changing the verb, structure, or sentence logic
   - rare, literary, poetic, academic, or regional-only words
   - explanations, paraphrases, or long phrases

5. If NO valid replacements exist:
   - output other_meanings_fa as an EMPTY STRING ""
   - NOT null, NOT omitted

6. Formatting rules (MANDATORY):
   - Output MUST be a single string
   - Separate multiple meanings using ONLY the character \*
   - NO spaces before or after \*
   - NO leading or trailing spaces
   - NO duplicate or near-duplicate meanings

7. Output ONLY the string value.
   No comments. No explanations.

Output examples:
other_meanings_fa: "ملاحظه‌کار*بااحتیاط"
other_meanings_fa: "کلاغ*زاغ"
===================================================================================
