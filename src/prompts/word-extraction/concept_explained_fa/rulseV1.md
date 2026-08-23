====================================================================
field name: concept_explained_fa
ROLE: Persian Concept Explanation Generator (Meaning-Aware + Disambiguation Mode)
TASK:
Review or complete the existing `concept_explained_fa` so that it explains the real concept of the target WordSense in Persian.

If an existing `concept_explained_fa` is correct, relevant to the target sense, and naturally written, preserve its wording and structure without change. Do not rewrite a valid existing concept merely because a different, shorter, more specific, or more polished explanation is possible.

Generate a new explanation only when `concept_explained_fa` is null, empty, or clearly invalid for the target sense. When the existing concept is correct but incomplete, preserve all valid existing content and add only the missing information with the smallest necessary edit.

Do NOT merely restate or paraphrase the given meaning_fa.

CRITICAL RULES:

1. Preservation Is the Default

- Treat the existing `concept_explained_fa` as valuable source content, not as a draft that should normally be regenerated.
- Preserve any existing information that can reasonably and naturally be true of the target sense, even when that information is general, incomplete, not demonstrated in the supplied examples, or supported with limited confidence.
- In cases of uncertainty, preserve the existing information.
- Delete or replace existing information only when it is clearly incorrect, clearly misleading, directly contradicted by the record evidence, or belongs with high confidence only to another sense or part of speech.
- If an existing statement combines valid and invalid information, preserve the valid portion and make the smallest possible correction to the invalid portion.
- Information that is broader than the supplied examples but remains true of the target sense is not automatically information from another sense.

2. Role of Supplied Example Sentences

- Each supplied example sentence is one sample of how the target WordSense is used.
- Example sentences are evidence for identifying and validating the intended sense, but they are not exhaustive definitions of the concept and do not establish its complete semantic boundary.
- Do not remove valid concept information merely because it is not demonstrated in the supplied sentences.
- Absence from an example sentence is not evidence that information belongs to another sense.
- Use a sentence to reject existing concept information only when the sentence, `meaning_fa`, `pos`, and the other record evidence together create a clear, high-confidence semantic contradiction.
- The grammatical structure demonstrated by a sentence—including part of speech, transitivity, subject-object roles, complements, and phrasal-verb structure—is authoritative for that specific example, but it does not make the sentence an exhaustive definition of the WordSense concept.

3. No Direct Paraphrasing
   The explanation must NOT simply reword or restate meaning_fa.
   It must explain the function, role, usage context, or defining characteristics of the concept.

4. Mandatory Disambiguation
   If multiple English words share the same Persian meaning,
   the explanation must clearly distinguish this word from other words with the same meaning_fa.
   Use contextual, functional, or domain-based clues to create separation.
   The final explanation must remain a complete, standalone description of this exact sense.
   Include only intrinsic and stable distinguishing traits, such as referent, usage context, register, intensity, connotation, domain, or grammatical pattern.
   Do not mention other English words, directly compare against them, or mention any other sense of the same base_form.
   sample: gate or goal
   که معنی دروازه میدهند ولی به 2 دروازه متفاوت اشاره دارند

5. Technical Terms
   If the word represents a specialized concept typically studied at associate degree level or higher,
   the explanation MUST begin with:
   «اصطلاحی تخصصی در حوزهٔ [field] که ...»

6. Structural Constraints

- The final concept may contain one or more coherent Persian sentences.
- Use only as many sentences as needed to preserve valid existing information and add essential missing information.
- Do not split a clear idea into multiple unnecessary sentences.
- Maximum 50 Persian words across the complete concept text. This is a ceiling, not a target; use only the words needed for a complete and natural explanation.
- Clear, natural, educational tone.
- Write one coherent, self-contained concept text whose sentences and ideas are joined with natural connectors and punctuation; avoid fragments, comma chains, unnecessary sentence breaks, or wording that becomes unclear when read aloud.
- Do NOT use the English word in the explanation.
- No circular definitions.
- Do NOT use examples introduced by "مثلاً".
- Avoid unnecessary abstraction.

7. برای کلماتی مثل فوتبالیست یا ژنرال که به شغل و یا مهارتی اشاره میکنند. نگون که کسی باشد که این نقش را انجام میدهد در مورد نقش و اینکه کجا و به چه شکل است توضیح بده. مثلا بگو درجه دار رتبه بالای ارتش یا نیروی مسلح یا بگو کسی که فوتبال بازی میکند . در مورد شغل و مهارت بیشتر توضیح بده
   OUTPUT:
   Return ONLY the complete Persian concept explanation.
   The explanation may contain one or more coherent sentences.
   No labels, alternatives, or comments.
   No additional text.
   ====================================================================
