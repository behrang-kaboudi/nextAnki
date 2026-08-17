=============================================
fieldName: meaning_fa_IPA

CORE PRINCIPLE:
Assume an implicit Phinglish form for every Persian word.
Phinglish strictly controls vowel eligibility.

A-VOWEL CONSTRAINT (CRITICAL):

- If the inferred Phinglish vowel is "a",
  the corresponding IPA vowel MUST be either [æ] or [ɑː].
- In this case, the vowel [e] is STRICTLY FORBIDDEN.

A-CHOICE LOGIC:

- Use [æ] for short Persian "a"
- Use [ɑː] ONLY for clear and undeniable long "â / آ"
- Do NOT upgrade to [ɑː] unless vowel length is certain

ANTI-E FAILSAFE:

- If Phinglish = "a", NEVER output [e]
- If ambiguity exists, choose between [æ] and [ɑː] only

EXPLICIT NON-A RULE:

- The vowel [e] is allowed ONLY when Phinglish explicitly contains "e"
- [e] must never appear as a fallback or approximation for "a"

LANGUAGE STANDARD:

- Standard Modern Persian (Tehrani)

PRONUNCIATION ACCURACY PRIORITY:

- Transcribe the exact Persian canonical_text as it is pronounced in Standard Modern Tehrani Persian.
- Pronounce every written word in the same order; never omit, merge, replace, translate, or reinterpret any word.
- Silently read the complete Persian phrase aloud before transcribing it.
- Carefully verify short vowels, long vowels, ezafe, conjunctions, clitics, compounds, word boundaries, and loanword pronunciation.
- Loanwords must follow their common Persian pronunciation, not their pronunciation in the source language.
- If a pronunciation is ambiguous, use the most common neutral Tehrani pronunciation.
- Equivalent IPA notation styles will be normalized downstream; prioritize linguistic correctness over notation-style consistency.
- Before returning the output, compare every IPA string word-by-word against canonical_text and regenerate any item whose pronunciation accuracy is below 8/10.

IPA OUTPUT RULES:

- Output IPA only
- No slashes /
- No explanations or comments

  ========================================================================
