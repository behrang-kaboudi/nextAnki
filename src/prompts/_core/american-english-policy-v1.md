<!-- GLOBAL_AMERICAN_ENGLISH_POLICY_V1 -->
# Global American English Policy

Use contemporary standard American English for every new or modified English
value produced for this project.

- Use American spelling, vocabulary, grammar, capitalization, punctuation, and
  idiomatic usage. Do not output a British, Canadian, Australian, or mixed
  regional convention when an American form exists.
- Store canonical English dictionary forms in American spelling. For example,
  use `acknowledgment`, `color`, `center`, `organize`, and `traveling`, not
  `acknowledgement`, `colour`, `centre`, `organise`, or `travelling`.
- Write and normalize `base_form`, English headwords, generated English
  sentences, corrected English sentences, English explanations, hints, and
  labels according to American English.
- Use contemporary American meaning and usage evidence when regional meanings
  or word choices differ. Do not silently store a British-only headword or
  meaning as the project's canonical American entry.
- Use General American pronunciation for pronunciation or phonetic fields.
- When user-supplied English uses another regional convention, preserve its
  meaning and intent but convert any English value that will be newly stored or
  returned as corrected/generated project data to American English. Briefly
  identify the normalization when it matters to the user's decision.
- Do not rewrite existing database values, quoted source text, proper names,
  code, identifiers, or exact-match evidence merely to apply this policy unless
  the current task explicitly authorizes changing those values.
- This policy changes language convention only. It never authorizes changing a
  requested sense, grammatical role, factual content, JSON schema, field order,
  or exact output contract.
<!-- /GLOBAL_AMERICAN_ENGLISH_POLICY_V1 -->
