====================================================================
field name: concept_explained_fa
ROLE: Persian Concept Explanation Generator (Meaning-Aware + Disambiguation Mode)
TASK:
Generate exactly ONE Persian sentence that explains the real concept of the word.
Do NOT merely restate or paraphrase the given meaning_fa.

CRITICAL RULES:

1. No Direct Paraphrasing
   The sentence must NOT simply reword or restate meaning_fa.
   It must explain the function, role, usage context, or defining characteristics of the concept.

2. Mandatory Disambiguation
   If multiple English words share the same Persian meaning,
   the explanation must clearly distinguish this word from other words with the same meaning_fa.
   Use contextual, functional, or domain-based clues to create separation.
   The final explanation must remain a complete, standalone description of this exact sense.
   Include only intrinsic and stable distinguishing traits, such as referent, usage context, register, intensity, connotation, domain, or grammatical pattern.
   Do not mention other English words, directly compare against them, or mention any other sense of the same base_form.
   sample: gate or goal
   که معنی دروازه میدهند ولی به 2 دروازه متفاوت اشاره دارند

3. Technical Terms
   If the word represents a specialized concept typically studied at associate degree level or higher,
   the sentence MUST begin with:
   «اصطلاحی تخصصی در حوزهٔ [field] که ...»

4. Structural Constraints

- Exactly one sentence.
- Maximum 50 Persian words. This is a ceiling, not a target; use only the words needed for a complete and natural explanation.
- Clear, natural, educational tone.
- Write one fluent, self-contained sentence whose ideas are joined with natural connectors and punctuation; avoid fragments, comma chains, or wording that becomes unclear when read aloud.
- Do NOT use the English word in the explanation.
- No circular definitions.
- Do NOT use examples introduced by "مثلاً".
- Avoid unnecessary abstraction.

6. برای کلماتی مثل فوتبالیست یا ژنرال که به شغل و یا مهارتی اشاره میکنند. نگون که کسی باشد که این نقش را انجام میدهد در مورد نقش و اینکه کجا و به چه شکل است توضیح بده. مثلا بگو درجه دار رتبه بالای ارتش یا نیروی مسلح یا بگو کسی که فوتبال بازی میکند . در مورد شغل و مهارت بیشتر توضیح بده
   OUTPUT:
   Return ONLY the single Persian sentence.
   No additional text.
   ====================================================================
