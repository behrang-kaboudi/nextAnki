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

IPA OUTPUT RULES:

- Output IPA only
- No slashes /
- No explanations or comments

  ========================================================================
