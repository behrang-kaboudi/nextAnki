Review every record by comparing `base_form`, `meaning_fa`, `other_meanings_fa`, and `sentence_en`.

Return ONLY records that require correction or meaningful completion.

Return `[]` if every record is correct and sufficiently complete.

## Evaluation scope

Evaluate only the specific meaning and grammatical function of `base_form` used in `sentence_en`.

Do not evaluate or add meanings that belong only to other senses or contexts of the English word.

Use `sentence_en` to determine:

- the intended meaning;
- the part of speech;
- the grammatical function;
- whether a verb is transitive or intransitive;
- whether the expression is a phrasal verb, idiom, compound, or fixed expression.

## Invalid sentence usage

Also verify that `base_form` is used correctly in `sentence_en`.

The usage is invalid when `base_form`:

- does not semantically fit the sentence;
- has the wrong part of speech or grammatical function;
- is used with an incorrect grammatical pattern, complement, preposition, or transitivity;
- is incorrectly treated as or separated from a phrasal verb, idiom, compound, or fixed expression;
- makes the sentence unnatural, incoherent, or clearly different from the likely intended meaning.

If the use of `base_form` in `sentence_en` is clearly incorrect:

- return the record even if `meaning_fa` and `other_meanings_fa` are valid meanings of `base_form`;
- set `"sentence_en_valid"` to `false`;
- provide a natural corrected sentence in `"corrected_sentence_en"`;
- determine `meaning_fa` and `other_meanings_fa` according to the corrected sentence and its most likely intended meaning.

If `sentence_en` uses `base_form` correctly, set `"sentence_en_valid"` to `true` and If the record is returned for a Persian-meaning issue while `base_form` is used correctly in `sentence_en`, set `"sentence_en_valid"` to `true` and do not include `"corrected_sentence_en"`.

Include `"corrected_sentence_en"` only when `"sentence_en_valid"` is `false`.

Do not mark a sentence invalid merely because another wording would be more natural. Mark it invalid only when the use of `base_form` is semantically or grammatically incorrect.

## Return a record when

Return a record if at least one of the following is true:

1. `meaning_fa` does not correctly express the contextual meaning of `base_form`.

2. `meaning_fa` is understandable but unnatural, misleading, overly literal, grammatically unsuitable, or not an appropriate Persian dictionary-style equivalent.

3. `meaning_fa` or any item in `other_meanings_fa` contains a spelling, word-form, grammatical, or clear language error.

4. The contextual meaning is missing from both `meaning_fa` and `other_meanings_fa`.

5. An important, common, natural, and meaningfully distinct Persian equivalent for the same contextual sense is missing.

6. An existing item in `other_meanings_fa` is incorrect, misleading, unnatural, redundant, explanatory rather than translational, or unsuitable for the contextual sense.

7. The use of `base_form` in `sentence_en` is clearly semantically or grammatically incorrect, even if the Persian meanings themselves are valid meanings of the word in another context.

## Rules for `meaning_fa`

`meaning_fa` must:

`meaning_fa` must:

- be a reusable Persian equivalent of `base_form` for the specific lexical sense identified from `sentence_en`; assume that `base_form` is used with the same meaning in other English sentences, and ensure that the Persian equivalent remains valid without depending on the surrounding words or grammatical structure of the current sentence;
- be the most direct, natural, common, accurate, and context-appropriate Persian equivalent;
- independently represent the English word or expression, not merely complete the translation of the full sentence;
- use a concise dictionary-style form;
- preserve the part of speech or grammatical function when natural in Persian;
- use a short natural phrase when no precise single-word equivalent exists.

Do not use a noun merely because the full Persian sentence naturally uses a noun.

Examples:

- `dizzy` → `"دچار سرگیجه"` or `"سرگیجه دار"`, not `"سرگیجه"` alone.
- `collision` → `"تصادف"` or `"برخورد"`, not `"تصادف کردن"`.
- `quantify` → `"کمّی کردن"`, not `"کمیت"`.

Exact part-of-speech matching is not mandatory when Persian naturally requires a short phrase or a different grammatical structure.

Do not preserve an existing translation merely because it is loosely understandable.

Correct unnatural collocations and literal translations.

Do not use a definition or explanatory description when a normal Persian translation exists.

## Rules for `other_meanings_fa`

`other_meanings_fa` must contain only useful alternative Persian equivalents for the same specific contextual sense.

Add an alternative only when it:

- is common or genuinely useful for Persian learners;
- is natural as a standalone translation;
- remains a valid Persian equivalent when `base_form` is used with the same lexical sense in other English sentences, without depending on the surrounding words or grammatical structure of the current sentence;

- is meaningfully distinct from the existing equivalents;
- provides real learning value.

Do not require every possible synonym.

Do not add:

- rare, archaic, literary, regional, or unnecessarily formal alternatives;
- definitions or explanatory descriptions;
- broader or narrower concepts;
- meanings belonging to another sense of the English word;
- translations that work only in a different context;
- contextually weaker or less accurate alternatives;
- redundant near-synonyms that differ only stylistically;
- grammatical variations that add no meaningful value;
- explanations of `meaning_fa` rather than alternative translations.

Keep a maximum of 3 items in `other_meanings_fa`, unless more are genuinely necessary to cover clearly distinct, common, and useful equivalents.

Remove any existing item that violates these rules.

Do not return a record merely to reorder already correct equivalents.

## Completeness rule

Return a record when an important and commonly useful equivalent for the contextual sense is missing.

A missing equivalent is important enough to add only when it is:

- common in modern Persian;
- a natural direct translation;
- meaningfully different from the existing translations;
- useful for understanding or actively recalling the English word.

Do not return a record merely because additional optional synonyms could be added.

## Phrasal verbs and fixed expressions

Treat phrasal verbs, idioms, compounds, and fixed expressions as complete lexical units.

Do not translate their individual words separately.

Examples:

- `fill out` → `"پر کردن"` or `"تکمیل کردن"`
- `chill out` → `"آرام شدن"` or `"ریلکس کردن"`
- `turn out` in `"The cake turned out well."` → `"از آب درآمدن"`
- `dish out` in a food context → `"غذا کشیدن"` or `"سرو کردن"`

## Inflection rule

Evaluate the base meaning, not the tense, number, or inflected form used in `sentence_en`.

The Persian output should normally use a dictionary-style form:

- English verbs → Persian infinitive-style forms such as `"کردن"`, `"شدن"`, or `"بودن"`;
- English plural nouns → normally a singular Persian dictionary form, unless plurality is essential;
- English adjectives → an adjective or a natural descriptive phrase.

Examples:

- `spread` in `"The fire spread quickly."` → `"گسترش یافتن"`, not `"گسترش یافت"`.
- `expand` as a transitive verb → `"گسترش دادن"`.
- `expand` as an intransitive verb → `"گسترش یافتن"`.

## Persian quality

Use correct and standard Persian spelling.

Correct clear errors such as:

- `"مسیولیت"` → `"مسئولیت"`
- `"مطمین کردن"` → `"مطمئن کردن"`

Do not return a record solely to change optional punctuation, spacing style, or an acceptable orthographic variant when the original is correct and unambiguous.

## Output rules

- Preserve every returned `id` exactly.
- Include each incorrect record no more than once.
- Do not include correct records.
- Do not include `base_form`.
- Do not include the original `sentence_en` as a separate field.
- Include `corrected_sentence_en` only when the original sentence uses `base_form` incorrectly.

- Return valid JSON only.
- Do not include markdown, explanations, comments, headings, or text outside the JSON array.
- Use the applicable output structure shown below.
- Preserve the field order of the applicable structure.

When `sentence_en` uses `base_form` correctly:

[
{
"id": 1,
"meaning_fa": "corrected main meaning",
"other_meanings_fa": [
"useful alternative"
],
"sentence_en_valid": true
}
]

When `sentence_en` uses `base_form` incorrectly:

[
{
"id": 1,
"meaning_fa": "corrected main meaning based on the corrected sentence",
"other_meanings_fa": [
"useful alternative"
],
"sentence_en_valid": false,
"corrected_sentence_en": "A natural sentence that correctly uses base_form."
}
]

## Examples

### Example 1: missing important equivalent

INPUT:

[
{
"id": 1,
"base_form": "example",
"meaning_fa": "نمونه",
"other_meanings_fa": [],
"sentence_en": "This is an example."
}
]

OUTPUT:

[
{
"id": 1,
"meaning_fa": "مثال",
"other_meanings_fa": [
"نمونه"
]
}
]

### Example 2: incorrect contextual sense

INPUT:

[
{
"id": 2,
"base_form": "scale",
"meaning_fa": "مقیاس",
"other_meanings_fa": [],
"sentence_en": "The scale shows weight."
}
]

OUTPUT:

[
{
"id": 2,
"meaning_fa": "ترازو",
"other_meanings_fa": []
}
]

Do not add `"وسیله وزن کشی"` because it is an explanation, not a useful standalone translation.

### Example 3: useful alternative is missing

INPUT:

[
{
"id": 3,
"base_form": "spread",
"meaning_fa": "گسترش یافتن",
"other_meanings_fa": [],
"sentence_en": "The fire spread quickly."
}
]

OUTPUT:

[
{
"id": 3,
"meaning_fa": "گسترش یافتن",
"other_meanings_fa": [
"پخش شدن"
]
}
]

### Example 4: already correct and sufficient

INPUT:

[
{
"id": 4,
"base_form": "dizzy",
"meaning_fa": "دچار سرگیجه",
"other_meanings_fa": [],
"sentence_en": "He felt dizzy."
}
]

OUTPUT:

[]

Do not replace `"دچار سرگیجه"` with the noun `"سرگیجه"` merely because the full sentence can be translated as `"او احساس سرگیجه کرد."`

### Example 5: spelling correction

INPUT:

[
{
"id": 5,
"base_form": "obligation",
"meaning_fa": "وظیفه",
"other_meanings_fa": [
"تعهد",
"مسیولیت"
],
"sentence_en": "He felt a moral obligation to tell the truth."
}
]

OUTPUT:

[
{
"id": 5,
"meaning_fa": "وظیفه",
"other_meanings_fa": [
"تعهد",
"مسئولیت"
]
}
]

### Example 6: unnatural verb translation

INPUT:

[
{
"id": 6,
"base_form": "quantify",
"meaning_fa": "کمیت تعیین کردن",
"other_meanings_fa": [],
"sentence_en": "They quantified the risk."
}
]

OUTPUT:

[
{
"id": 6,
"meaning_fa": "کمّی کردن",
"other_meanings_fa": [
"به صورت عددی بیان کردن",
"مقدار را تعیین کردن"
]
}
]

### Example 7: do not add explanatory alternatives

INPUT:

[
{
"id": 7,
"base_form": "collision",
"meaning_fa": "تصادف",
"other_meanings_fa": [
"برخورد"
],
"sentence_en": "The collision blocked traffic."
}
]

OUTPUT:

[]

Do not add `"برخورد دو وسیله نقلیه با یکدیگر"` because it is an explanation, not a concise alternative translation.

Now review the following records:

{{INPUT_JSON}}
