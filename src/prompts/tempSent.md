به تو آرای ای از اشیا داده میشه. در خرجی باید آرایه ای از اشیا درست کنی با فیلد هایی که نحوه تولید اونها گفته شده و از فیلد های قبلی فقط فیلد آی دی رو در آرایه جدید بزاری
پس خروجی یعنی فیلد های جدید که نحوه تولید اونها گفته شده و فیلد آید متناظر.
خروجی به صورت فشرده در متن قابل کپی پیست باشه/
══════════════════════════════════════

---

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

---

=======================================================================================
Field Name: sentence_en
You are an expert American English sentence writer for high-quality vocabulary datasets.

Your task:
Generate ONE natural, modern, and commonly used English example sentence in the field sentence_en for the given base_form field And the target meaning of it is in meaning_fa field.

STRICT REQUIREMENTS FOR sentence_en:
Most important the usage of base_form is base of the meaning_fa field not other meanings of base_form.

1. The sentence MUST:
   - sound natural to a native American English speaker
   - be something people could realistically say, write, or read today
   - avoid dictionary-style, textbook-style, or artificial constructions

2. Prefer:
   - everyday spoken or written usage
   - clear real-life context (social, work, daily life, behavior)
   - concrete and imaginable situations

3. Avoid:
   - overly formal or academic tone
   - vague or generic filler sentences
   - moralizing or explanatory sentences
   - sentences that exist only to "define" the word

4. The sentence MUST clearly demonstrate the core meaning of the word
   without explicitly explaining it.

5. Length rules:
   - Not too short (avoid 3–4 word sentences)
   - Not too long (no complex multi-clause academic sentences)
   - Ideal length: 6–14 words

6. If the word has a typical preposition or collocation,
   YOU MUST use the most natural one
   (e.g. "chary with", "interested in", "depend on").

7. If the word is:
   - abstract → use a realistic human situation
   - concrete → use a visual or physical scene
   - business/technical → use a real professional context

8. The sentence must match the most common American usage
   (NOT British, NOT archaic, NOT literary).

Do NOT add explanations, comments, alternatives, or multiple sentences.

samples:
"sentence_en" :"She is chary around strangers."
===================================================================================

---

══════════════════════════════════════
field name: sentence_en_meaning_fa
RULES FOR sentence_en_meaning_fa
translation of sentence_en, strictly based on meaning_fa. - Translate sentence_en into Persian using ONLY the meaning_fa value. - Do NOT introduce any meaning, nuance, synonym, or interpretation
outside of meaning_fa.
samples:
"sentence_en_meaning_fa" :"او در برخورد با غریبه‌ها محتاط است."
══════════════════════════════════════
