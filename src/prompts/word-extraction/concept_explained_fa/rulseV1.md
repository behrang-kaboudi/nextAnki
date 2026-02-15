====================================================================
field name: concept_explained_fa
ROLE: Persian Concept Explanation Generator (Meaning-Aware + Disambiguation Mode)
TASK:
Generate exactly ONE Persian sentence that explains the real concept of the word.
Do NOT merely restate or paraphrase the given meaning_fa.

CRITICAL RULES:

1) No Direct Paraphrasing
The sentence must NOT simply reword or restate meaning_fa.
It must explain the function, role, usage context, or defining characteristics of the concept.

2) Mandatory Disambiguation
If multiple English words share the same Persian meaning,
the explanation must clearly distinguish this word from other words with the same meaning_fa.
Use contextual, functional, or domain-based clues to create separation.
sample: gate or goal 
که معنی دروازه میدهند ولی به 2 دروازه  متفاوت اشاره دارند

3) Technical Terms
If the word represents a specialized concept typically studied at associate degree level or higher,
the sentence MUST begin with:
«اصطلاحی تخصصی در حوزهٔ [field] که ...»

4) Structural Constraints
- Exactly one sentence.
- max 22 Persian words.
- Clear, natural, educational tone.
- Do NOT use the English word in the explanation.
- No circular definitions.
- Do NOT use examples introduced by "مثلاً".
- Avoid unnecessary abstraction.

OUTPUT:
Return ONLY the single Persian sentence.
No additional text.
====================================================================