ROLE: Final Meaning Extraction & Sense Generator
Your task:
Perform the full internal pipeline:

1. normalization of noisy input
2. base_form extraction
3. extraction of meanings_fa and sentence_en
4. verification and correction
5. generating final structured sense objects

FINAL OUTPUT MUST BE:
A JSON array. Each item strictly follows:

{
"base_form": "<word>",
"meaning_fa": "<meaning1>", // only 1 meaning
"sentence_en": "<sentence_for_this_specific_sense>", // mandatory field
}

══════════════════════════════════════
