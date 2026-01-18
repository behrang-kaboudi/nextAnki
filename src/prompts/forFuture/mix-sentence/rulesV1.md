-----------------------------------------------------mixed_sentence Rules and instructions:

Replace ONLY the English target word (base_form or any of its grammatical forms)
in "sentence_en" with the Persian expression that already appears inside
"meaning_fa" as the natural realized form of sentence_en_meaning_fa.
If the output mixed_sentence has more words than the meaning_fa it should be because of grammatical changes not because of adding extra words.
If it has extra words that are not part of grammatical changes it is wrong.
──────────────────────────────
RULES FOR EXTRACTION
──────────────────────────────
1. Detect the Persian segment in sentence_en_meaning_fa that expresses meaning_fa. Understand that grammatical accuracy. Remove any extra words that are not part of meaning_fa.
   - It may be a verb phrase (پیروی کنند / ترقی می‌دهد / غش کند / به تعویق انداختند)
   - Or a noun (دزدی / پاداش / نامه‌ها)
   - Or an adjective/adverb (باریک / نرم و پرمانند)

2. Convert meaning_fa based on the grammatical change. DO NOT ADD ANY NEW WORD TO meaning_fa and replace it in mixed_sentence accordingly.
   Do not modify anything other than base_form part.
   Do NOT use the infinitive.

3. Do NOT use the infinitive.
   Use only the realized surface form from sentence_en_meaning_fa.

──────────────────────────────
RULES FOR INSERTION
──────────────────────────────
1. Replace only the target English word or phrase in sentence_en with the created Persian chunk.
2. Do NOT change the word order, grammar, tense, punctuation, or any other part of the original English sentence except the changed part.
3. Produce exactly one mixed sentence that keeps the English structure but inserts the created Persian chunk.

«Grammatical completeness of Persian chunk is NOT required»
«Partial Persian fragments are allowed»
«Persian chunk may be syntactically incomplete»
«Object may be omitted even if required in Persian»

──────────────────────────────
SPECIAL RULE FOR LINKING VERBS (IMPORTANT)
──────────────────────────────
When the English sentence uses a linking verb such as:
"be", "become", "get", "go", "turn", "grow", "seem", "feel",
and the Persian chunk extracted from sentence_en_meaning_fa is a verb phrase
(e.g., کچل شد / عصبانی شد / پولدار شد),
THEN:
- Insert ONLY the adjectival (non-verbal) part of the Persian chunk.
- Remove the auxiliary verb (شد / گردید / می‌شود) before insertion.

Example:
sentence_en_meaning_fa: "او در سن کم کچل شد."
sentence_en: "He became bald at a young age."
→ mixed_sentence: "He became کچل at a young age."

──────────────────────────────
SPECIAL RULE FOR COPULA PHRASES (is/are/was/were)
──────────────────────────────
If the English sentence contains a copular verb such as:
"is", "are", "was", "were"
AND the extracted Persian chunk ends with a Persian copula
such as: "است", "هست", "بود", "هستند"

THEN:
- Remove the Persian copula.
- Insert only the adjectival part.

Example:
sentence_en_meaning_fa: "میزش همیشه مرتب است."
sentence_en: "Her desk is always neat."
→ mixed_sentence: "Her desk is always مرتب."

──────────────────────────────
SPECIAL RULE FOR PUNCTUATION
──────────────────────────────
If the extracted Persian chunk does NOT end with a punctuation mark inside sentence_en_meaning_fa,
then you must NOT add any punctuation to it.
Do not add characters such as ؟ . ! , or any other marks around the Persian chunk.
Insert it exactly as it appears.

Wrong:
"mixed_sentence": "Can you شرح دهی؟ this term?"

Correct:
"mixed_sentence": "Can you شرح دهی this term?"
