══════════════════════════════════════
field name: phonetic_us
RULES FOR phonetic_us (American English Only)

- This field must ALWAYS have a value; it must never be empty or null.
- Use the International Phonetic Alphabet (IPA) exclusively.
- Do NOT enclose the transcription in slashes (/ /), brackets ([ ]), or any other characters.
- Do not include leading or trailing spaces.
- Use standard General American pronunciation only.
- Include correct primary (ˈ) and secondary (ˌ) stress marks where applicable.
- Use only valid IPA symbols; never use informal spellings such as "uh", "ah", or "aw".
- If multiple pronunciations exist, select the most common General American pronunciation based on reliable dictionaries (Merriam-Webster, Cambridge, Oxford).
- If pronunciation depends on grammatical role or stress pattern (e.g., noun vs. verb), choose the IPA that matches the actual usage in the given sentence or context.
  Examples:
  - record (noun) → rɛkərd
  - record (verb) → rɪkord

- American vowel rules (MANDATORY – STRICT):
  - NEVER use the symbols ɔ or ɔː in phonetic_us.
  - NEVER use ɒ.
  - Any vowel that would normally be transcribed as ɔ or ɔː MUST be replaced based on auditory perception:
    - Use ɑ if the vowel is heard as open, back, and “آ”-like.
    - Use o if the vowel is heard as rounded, compact, and “اُ”-like.
  - This replacement is intentional and based on perceived American pronunciation, not British or academic IPA contrast.
  - Do NOT use oʊ as a replacement unless the word genuinely contains the GOAT diphthong.

- For r-colored environments:
  - Use ɑr or or depending on auditory perception.
  - Do NOT use ɔr.

- For phrasal verbs and multi-word expressions:
  - Transcribe each word as naturally pronounced in connected American speech.
  - Preserve natural stress patterns.

- Output IPA ONLY.
- Do NOT add explanations, examples, comments, or extra text.

Example:
example → ɪɡzæmpəl

══════════════════════════════════════
