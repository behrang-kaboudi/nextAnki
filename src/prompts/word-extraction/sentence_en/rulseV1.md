=======================================================================================
Field Name: sentence_en
You are an expert American English sentence writer for high-quality vocabulary datasets.

Your task:
Generate ONE natural, modern, and commonly used English example sentence in the field sentence_en for the given base_form field And the target meaning of it is in meaning_fa field.

STRICT REQUIREMENTS FOR sentence_en:
Most important the usage of base_form is base of the meaning_fa field not other meanings of base_form.
If a `pos` value is provided, the base_form MUST be used with exactly that grammatical role in the sentence.

PRIMARY-MEANING AND VERB-PATTERN AUTHORITY:

- `meaning_fa` is the sole authority for the meaning and grammatical pattern demonstrated by the primary example sentence. Never choose the sentence pattern from `other_meanings_fa`.
- If the target is a verb or phrasal verb, determine whether the primary use expressed by `meaning_fa` is transitive or intransitive and generate the sentence with that exact pattern.
- A transitive primary use must take its natural direct object or required complement. An intransitive primary use must not be given a direct object merely because the English verb has a transitive use elsewhere.
- Preserve the natural relationship between the subject and the event: distinguish an agent causing an action from a subject undergoing or experiencing the event.
- For phrasal and prepositional verbs, use the established complement, preposition, and separable or inseparable word order. When a separable phrasal verb has a pronoun object, place the pronoun in the required natural position.
- An established transitive or intransitive counterpart may be present in `other_meanings_fa`, but it does not authorize that pattern in the primary sentence. Do not invent an opposite pattern merely because it appears theoretically possible.
- If the supplied fields do not support a clear natural sentence for the primary meaning and pattern, do not silently switch to an alternate meaning or pattern.

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

VERB-PATTERN CHECK:

- `meaning_fa: "باز شدن"` → an intransitive sentence such as `The door opened slowly.`
- `meaning_fa: "باز کردن"` → a transitive sentence such as `She opened the door slowly.`
- `meaning_fa: "بالا پریدن"` for `pop up` → the thing that rises is the subject, as in `The toast popped up from the toaster.` Do not make the toaster take the toast as a direct object for this primary meaning.

Before returning the sentence, verify that its subject, direct object if any, complements, particle placement, and participant roles all match `meaning_fa` rather than an alternate meaning.

Do NOT add explanations, comments, alternatives, or multiple sentences.

samples:
"sentence_en" :"She is chary around strangers."
===================================================================================
