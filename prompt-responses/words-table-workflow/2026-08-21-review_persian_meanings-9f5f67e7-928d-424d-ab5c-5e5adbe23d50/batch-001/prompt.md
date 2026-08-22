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


══════════════════════════════════════
Field name: pos
RULES FOR pos

- Write the grammatical part of speech (POS) of the word from the field base_form.
- If the word has multiple possible parts of speech, choose only the one used in sentence_en, or infer it from the context of meaning_fa.
- This field is mandatory.
- Use a single short English word such as noun, verb, adjective, adverb, preposition, or phrasal verb.
- Do not use abbreviations or forms with periods (e.g., not "adj." or "v.").
  ══════════════════════════════════════

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

=======================================================================================
Field Name: sentence_en
You are an expert American English sentence writer for high-quality vocabulary datasets.

Your task:
Generate ONE natural, modern, and commonly used English example sentence in the field sentence_en for the given base_form field And the target meaning of it is in meaning_fa field.

STRICT REQUIREMENTS FOR sentence_en:
Most important the usage of base_form is base of the meaning_fa field not other meanings of base_form.
If a `pos` value is provided, the base_form MUST be used with exactly that grammatical role in the sentence.

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

Do NOT add explanations, comments, alternatives, or multiple sentences.

samples:
"sentence_en" :"She is chary around strangers."
===================================================================================

══════════════════════════════════════
field name: sentence_en_meaning_fa
RULES FOR sentence_en_meaning_fa
translation of sentence_en, strictly based on meaning_fa. - Translate sentence_en into Persian using ONLY the meaning_fa value. - Do NOT introduce any meaning, nuance, synonym, or interpretation
outside of meaning_fa.
samples:
"sentence_en_meaning_fa" :"او در برخورد با غریبه‌ها محتاط است."
══════════════════════════════════════

# مرور هماهنگی فیلدهای اصلی WordSense

هر ورودی یک WordSense موجود با یک `meaning_fa` پیشنهادی دارد. ابتدا اعتبار این معنی را طبق قواعد مشترک `meaning_fa` بررسی کن. پس از تأیید یا اصلاحِ بدون تغییر sense، `meaning_fa` نهایی هویت معنایی و مرجع قطعی این workflow است. سپس `concept_explained_fa`، `other_meanings_fa`، `pos`، جمله‌های انگلیسی و ترجمهٔ فارسی جمله‌ها را با همین معنی نهایی و `base_form` هماهنگ کن و مجموعهٔ معادل‌های فارسی همین sense را به‌اندازهٔ مفید و لازم کامل کن.

این workflow sense جدیدی برای کلمه حدس نمی‌زند، sense رکورد را عوض نمی‌کند، WordSense جدید نمی‌سازد و هیچ رکوردی را حذف نمی‌کند؛ اما باید معادل فارسی مهم و رایجی را که برای همین sense جا افتاده است به `other_meanings_fa` اضافه کند.

## ساختار ورودی

هر رکورد این اطلاعات کنترلی را دارد:

- `mode` همیشه `review` است؛
- `review_status` در این صف همیشه `PENDING` است؛
- `missing_fields` فیلدهای ناقص را نشان می‌دهد؛
- `requested_fields` فیلدهایی است که در این اجرا حتماً باید تکمیل شوند.

مقدار `other_meanings_fa: null` یعنی این فیلد هنوز تعیین نشده است. مقدار `other_meanings_fa: []` معتبر است و یعنی برای همین sense معادل جایگزین مفیدی وجود ندارد.

The meaning_fa must have one meaning only.
Meanings must be the meaning of the base_form. Do not use meanings of other forms like plurals, past tense, etc.So Meanings must match the base_form.
If there are multiple meanings for different forms, only use those that match the base_form.
Use the natural, common Persian equivalent instead of merely transliterating the English word. Keep a loanword only when it is genuinely established and natural in standard Persian.

1. The meaning must have same grammatical category as the base_form.
2. If meanings are corrupted or noisy, correct them.
3. Do not generate new meanings. Only use the meanings provided in the input.
4. Before writing `meaning_fa`, silently place the same `base_form`, with the same grammatical category and the same intended sense, in a different natural sentence that does not reuse the contextual words from the original sentence; the proposed meaning must remain valid in that new sentence.
5. Every semantic component of `meaning_fa` must be contributed by the `base_form` itself; do not include any component contributed only by any other word or phrase anywhere in the original sentence, regardless of its distance from the `base_form`.
6. Temporarily ignore the original sentence and translate the proposed `meaning_fa` by itself back into English; if the direct natural back-translation contains any content meaning not expressed by the `base_form` with the same grammatical category and intended sense, revise `meaning_fa`.

Apply this test to `meaning_fa` and independently to every item in `other_meanings_fa`.

Sample for semantic-component attribution and reverse translation:

base_form: care
proposed Persian meaning: مراقبت پزشکی
direct back-translation: medical care

The component `medical` is present in the Persian meaning but is not expressed by `care` itself. It comes from another word or from the sentence context. Therefore, `مراقبت پزشکی` is invalid for `care`; use `مراقبت`.


# Field rules: `other_meanings_fa`

## Core semantic rules for `other_meanings_fa`

These concept-based rules define whether a Persian alternative is valid. Workflow-specific instructions may decide whether to preserve an existing value, generate a new value, or combine existing values, but they must not weaken these semantic boundaries.
These rules are mandatory for every final `other_meanings_fa` array and override general preservation instructions. An item is not valid merely because it existed in the input. Remove any existing item that violates these rules; this is required cleanup, not loss of a valid meaning.
Evaluate every existing and newly proposed item independently against all core rules before applying any preservation rule. The fact that an item already exists in the input is not evidence of semantic validity.

- Every item must be a natural, common, and useful Persian word or short phrase for the exact same sense and grammatical role as `meaning_fa`.
- Use the supplied sentences and translations to identify the exact lexical sense. An alternative must remain a valid Persian equivalent when `base_form` is used with that same sense in other English sentences, without depending on the surrounding words or grammatical structure of the current sentence.
- Every semantic component of an item must be expressed by the `base_form` itself in the intended sense and grammatical role; no component may depend on another word or phrase from the original sentence.
- Temporarily ignore the original sentence and translate each item by itself back into English. If its most direct natural interpretation requires adding contextual information or produces a concept not expressed by the `base_form` in the intended sense and grammatical role, remove the item.
- An alternative does not need to replace `meaning_fa` word for word in the current Persian translation or fit there without a natural structural rewrite. Do not reject an otherwise valid equivalent solely because it fails that mechanical substitution test.
- Do not include `meaning_fa` itself, duplicates, spelling variants, explanations, context-only translations, rare or unhelpful expressions, broader or narrower concepts, related but non-equivalent meanings, or meanings from another sense or grammatical role.
- Do not include a mere transliteration merely as an additional label for the same sense. Prefer the natural, common Persian equivalent; keep a loanword only when it is genuinely established and natural in standard Persian.
- If no valid and useful alternative exists, use an empty array.
- Apply preservation only after an existing item has passed every core semantic rule. Preservation may tolerate differences in register, wording, or natural Persian grammatical structure, but never a difference in semantic scope.
- If any existing item fails a core semantic rule, remove it and return the complete final `other_meanings_fa` array, even when `requested_fields` is empty.


Preserve reasonable existing alternatives only after they have passed every core semantic rule. Apply a meaningful benefit of the doubt to a valid existing alternative when it is more colloquial, differs mildly in tone or register from `meaning_fa`, uses a different natural grammatical structure in Persian, or would require a natural structural rewrite in the current Persian translation. These differences are acceptable only when the item independently expresses the exact same lexical sense and grammatical role. Remove an existing alternative when it belongs to a different sense or grammatical role, has a broader or narrower semantic scope, depends only on the current context, is misleading or unnatural for this WordSense, or is a duplicate, spelling variant, definition, explanation, or rare/unhelpful expression.
This benefit of the doubt never permits preserving an item that violates the core rules, including a mere non-established transliteration.

Actively check whether the exact sense of the record is missing any important, common, natural, and meaningfully distinct Persian equivalent, even when the current array is already non-empty. Add a missing alternative when it is genuinely useful for understanding or actively recalling the English word in this exact sense; do not wait for `other_meanings_fa` to be null or empty.

- Valid alternatives may include a common synonym, a natural short phrase when no precise single-word equivalent exists, a useful formal or everyday equivalent, or a loanword that is genuinely established in standard Persian.
- Exact part-of-speech matching is not mechanical when natural Persian requires a short phrase or a different grammatical structure, but the alternative must preserve the same lexical role and sense.
- Each added alternative must contribute real learning value and be meaningfully distinct from the existing equivalents. Do not add optional synonyms merely to make the array longer.
- Usually return no more than five alternatives. This is a ceiling, not a target; return fewer whenever additional alternatives would be redundant, weak, uncommon, or unnecessary.

The value of `other_meanings_fa` must always be a JSON array of strings:

```json
"other_meanings_fa": ["ملاحظه‌کار", "بااحتیاط"]
```


این مرحله مرجع نهایی اعتبار معنایی `meaning_fa` و `other_meanings_fa` برای workflowهای بعدی است. آرایهٔ نهایی را طوری بررسی و کامل کن که مرحلهٔ Concept Merge بتواند تمام اعضای آن را معادل‌های تأییدشدهٔ همین sense بداند و مجبور به پاک‌سازی دوبارهٔ آن‌ها نباشد.

## مرجع تصمیم‌گیری

1. ابتدا `meaning_fa` پیشنهادی را طبق قواعد مشترک، در برابر خود `base_form`، نقش دستوری و تمام شواهد رکورد بررسی کن.
2. اگر `meaning_fa` معتبر است یا بدون تغییر sense اصلاح می‌شود، مقدار نهایی آن مرجع اصلی و ثابت ادامهٔ بررسی است.
3. اگر `concept_explained_fa` موجود و با معنی نهایی هماهنگ است، معنی و concept با هم هویت WordSense را روشن می‌کنند.
4. اگر concept خالی یا ناسازگار است، آن را براساس `meaning_fa` نهایی اصلاح یا تولید کن؛ معنی را برای هماهنگی با concept تغییر نده.
5. `other_meanings_fa` فقط باید معادل‌های طبیعی همان sense باشد. معانی متعلق به sense دیگر را حذف کن و معادل‌های مهم، رایج، طبیعی و واقعاً مفیدی را که جا افتاده‌اند اضافه کن؛ این بررسی حتی برای آرایهٔ موجود و غیرخالی الزامی است.
6. `pos` را از معنی و concept نهایی تشخیص بده. اگر `pos` فعلی اشتباه است، آن را اصلاح کن.
7. هر جمله باید `base_form` را با همان معنی و `pos` نهایی به‌کار ببرد. جمله اجازه ندارد معنی یا concept رکورد را تغییر دهد.
8. ترجمهٔ جمله باید دقیقاً همان کاربرد را منتقل کند.

## کامل‌بودن و ارزش آموزشی معنی‌های دیگر

1. فقط درست‌بودن مقادیر موجود را بررسی نکن؛ کامل‌بودن مجموعهٔ معادل‌های مفید همان sense را نیز بررسی کن.
2. یک معادل گمشده زمانی ارزش افزودن دارد که در فارسی معاصر رایج و طبیعی باشد، ترجمه‌ای مستقل و قابل استفاده برای همین sense باشد، با معادل‌های موجود تفاوت معنادار داشته باشد و برای فهم یا یادآوری فعال کلمه ارزش واقعی ایجاد کند.
3. صورت رسمی و روزمره، مترادف رایج، عبارت کوتاه طبیعی و وام‌واژهٔ واقعاً جاافتاده می‌توانند کنار هم بمانند، مشروط به اینکه همگی دقیقاً به همین sense و نقش لغوی تعلق داشته باشند.
4. تعریف، توضیح، ترجمهٔ وابسته به یک جمله، شکل صرفی کم‌ارزش، تفاوت صرفاً نگارشی و مترادف اختیاری یا ضعیف را فقط برای بیشترکردن تعداد اضافه نکن.
5. لازم نیست تمام مترادف‌های ممکن را گردآوری کنی و هیچ حداقل اجباری وجود ندارد؛ کیفیت و پوشش معادل‌های مهم بر تعداد مقدم است.
6. اگر افزودن یا حذف یک عضو لازم است، مقدار کامل و نهایی `other_meanings_fa` را برگردان، حتی اگر این فیلد در `requested_fields` نباشد.

نمونه‌ها:

- برای `spread` در کاربرد گسترش آتش، اگر `meaning_fa` برابر «گسترش یافتن» است، «پخش شدن» می‌تواند یک معادل رایج، متمایز و مفید باشد.
- برای `quantify` با معنی «کمّی کردن»، عبارت‌هایی مانند «به‌صورت عددی بیان کردن» یا «مقدار را تعیین کردن» فقط وقتی اضافه شوند که همان کاربرد را طبیعی و مستقل منتقل کنند.
- برای `collision` با معنی «تصادف» یا «برخورد»، عبارت «برخورد دو وسیلهٔ نقلیه با یکدیگر» را اضافه نکن، چون تعریف است نه معادل واژگانی مستقل.

## حفظ کانسپت معتبر و مرز دقیق sense

1. ابتدا sense دقیق رکورد را براساس `meaning_fa`، اعضای معتبر `other_meanings_fa`، `pos`، تمام جمله‌ها و ترجمه‌های آن‌ها مشخص کن.
2. اگر `concept_explained_fa` قبلی اطلاعات درست و مرتبطی دربارهٔ همین sense دارد، حفظ معنایی تمام آن اطلاعات الزامی است. لازم نیست عبارت‌ها کلمه‌به‌کلمه باقی بمانند؛ می‌توانی آن‌ها را طبیعی‌تر بازنویسی، یکپارچه یا با اطلاعات ضروری تکمیل کنی، اما نباید محتوای معتبرشان از بین برود.
3. concept موجود را صرفاً به دلیل امکان نوشتن توضیحی متفاوت، کوتاه‌تر یا بهتر تغییر نده.
4. اگر بخشی از concept قبلی مربوط به sense، نقش دستوری یا کاربرد دیگری از همان `base_form` است، حذف آن بخش الزامی است؛ حتی اگر آن اطلاعات دربارهٔ کلمه در کاربردی دیگر صحیح باشد.
5. اگر اطلاعات معتبر همین sense و اطلاعات خارج از آن در یک عبارت مخلوط شده‌اند، concept را بازنویسی کن: محتوای معتبر همین sense را نگه دار و فقط بخش‌های خارج از این sense را حذف کن.
6. concept نهایی باید توضیحی کامل و مستقل از همین WordSense باشد و حداکثر ۵۰ کلمه داشته باشد. به senseهای دیگر، نام کلمات انگلیسی دیگر یا مقایسهٔ مستقیم با آن‌ها اشاره نکن.
7. ویژگی‌های ذاتی و پایداری که به فهم و تشخیص همین sense کمک می‌کنند—مانند مصداق، موقعیت یا حوزهٔ کاربرد، رسمیت، شدت، بار معنایی یا الگوی دستوری—می‌توانند به‌صورت طبیعی حفظ یا اضافه شوند.
8. concept نهایی را یک جملهٔ کامل و روان بنویس؛ اطلاعات را با کلمات ربط و نقطه‌گذاری طبیعی یکپارچه کن، نه با عبارت‌های نیمه‌تمام یا ویرگول‌های زنجیره‌ای، و مطمئن شو هنگام بلندخوانی مستقل و روشن است.

## اصلاح بسیار محدود `meaning_fa`

معنی را فقط بدون تغییر sense اصلاح کن؛ مانند غلط املایی آشکار، فاصله یا نشانه‌گذاری زائد، صورت دستوری آشکارا نامناسب، عبارت فارسی کمی غیرطبیعی، یا جزئیات اضافه‌ای که برخلاف قواعد مشترک از کلمات دیگر جمله وارد معنی شده‌اند. حذف مؤلفه‌ای که خود `base_form` بیان نمی‌کند و فقط از کلمه یا عبارت دیگری در جمله آمده است، اصلاح همان sense محسوب می‌شود و تولید معنی جدید نیست. در این حالت `meaning_fa` و مقدار کامل و نهایی `other_meanings_fa` را با هم برگردان.
آوانویسی صرف را، بدون تغییر sense، با معادل طبیعی و رایج فارسی اصلاح کن؛ وام‌واژه را فقط وقتی نگه دار که در فارسی معیار واقعاً جاافتاده و طبیعی باشد.

این موارد ممنوع‌اند:

- جایگزین‌کردن معنی با sense دیگر؛
- انتخاب معنی رایج‌تر `base_form`؛
- تغییر معنی برای هماهنگ‌کردن آن با جمله، concept یا `pos` ناسازگار؛
- ترکیب چند sense در یک معنی.

اگر `meaning_fa` اساساً معنی `base_form` نیست، اصلاح آن به تغییر sense نیاز دارد، یا دربارهٔ حفظ همان sense اطمینان کافی نداری، هیچ فیلدی را تغییر نده و فقط این نتیجه را برگردان:

```json
{"id":25,"mode":"review","invalid_primary_meaning":true}
```

این رکورد بعد از اعمال پاسخ از صف AI خارج می‌شود و با وضعیت `NEEDS_ACTION_INVALID_PRIMARY` فقط در بخش «Needs Your Action» برای اصلاح، تأیید یا حذف دستی نمایش داده می‌شود.

## بررسی و جایگزینی جمله‌ها

- جملهٔ طبیعی و هماهنگ را صرفاً به دلیل امکان نوشتن جمله‌ای بهتر یا متفاوت‌تر تغییر نده.
- اگر جمله با معنی و concept هماهنگ است اما `pos` ذخیره‌شده اشتباه است، جمله را حفظ و `pos` را اصلاح کن.
- اگر `pos` با معنی و concept هماهنگ است اما جمله sense یا نقش دیگری را نشان می‌دهد، ID آن را در `invalid_sentence_ids` قرار بده.
- اگر حداقل یک ID در `invalid_sentence_ids` می‌گذاری، دقیقاً یک جملهٔ جایگزین جدید همراه ترجمهٔ فارسی در `sentences` برگردان.
- اگر جمله‌ای وجود ندارد، دقیقاً یک جملهٔ جدید همراه ترجمه بساز.
- جملهٔ موجود را بازنویسی نکن. فقط ترجمهٔ خالی یا نادرست آن را با همان `sentence_id` اصلاح کن.

جملهٔ جدید باید دقیقاً با قواعد فایل `sentence_en/rulseV1.md`، معنی مرجع و `pos` نهایی مطابقت داشته باشد.

## الزامات تکمیل

1. تمام فیلدهای `requested_fields` را حتماً برگردان.
2. اگر `other_meanings_fa` درخواست شده و معادل مفیدی وجود ندارد، `[]` برگردان.
3. اگر `sentence_en` درخواست شده، جملهٔ جدید باید هم‌زمان `sentence_en_meaning_fa` داشته باشد.
4. برای هر جملهٔ موجود بدون ترجمه، همان `sentence_id` و مقدار `sentence_en_meaning_fa` را برگردان؛ مگر اینکه آن جمله در `invalid_sentence_ids` باشد.
5. هر رکورد غیرمسدود باید پس از اعمال نتیجه دارای معنی، معانی دیگر تعیین‌شده، concept، `pos`، حداقل یک جمله و ترجمه برای تمام جمله‌های متصل باشد.
6. `other_meanings_fa` را برای هر رکورد از نظر کامل‌بودن فعالانه بررسی کن؛ اگر تغییر واقعی لازم است، آرایهٔ کامل نهایی را مستقل از `requested_fields` برگردان.
7. اگر `meaning_fa` را اصلاح می‌کنی، مقدار کامل و نهایی `other_meanings_fa` را نیز برگردان و تمام فیلدهای وابسته را با معنی نهایی هماهنگ کن.

## ساختار خروجی

فقط یک شیء JSON معتبر با دو کلید برگردان:

```json
{"reviewedIds":[1,2],"results":[]}
```

- `reviewedIds` باید تمام IDهای ورودی را دقیقاً یک بار و با همان ترتیب داشته باشد.
- `results` فقط رکوردهایی را دارد که به تکمیل، اصلاح، افزودن یا حذف یک معادل مهم، یا گزارش معنی نامعتبر نیاز دارند.
- هر `id` حداکثر یک بار در `results` ظاهر شود.

نمونهٔ اصلاح هماهنگی:

```json
{
  "id":2,
  "mode":"review",
  "other_meanings_fa":["معادل همان مفهوم"],
  "pos":"verb",
  "concept_explained_fa":"توضیح فارسی همان معنی و کاربرد آن.",
  "sentences":[
    {
      "sentence_id":null,
      "sentence_en":"A natural sentence using the intended sense.",
      "sentence_en_meaning_fa":"ترجمهٔ فارسی جملهٔ جدید."
    }
  ],
  "invalid_sentence_ids":[12]
}
```

## قوانین قطعی خروجی

- `mode` در تمام نتایج فقط `review` است.
- برای جملهٔ موجود، `sentence_id` را بدون تغییر تکرار کن؛ `sentence_en` آن را ننویس.
- برای جملهٔ جدید، `sentence_id` باید `null` باشد و متن و ترجمه هر دو وجود داشته باشند.
- در `invalid_sentence_ids` فقط ID جمله‌های همان رکورد را قرار بده.
- برای هر رکورد حداکثر یک جملهٔ جدید تولید کن.
- فیلد درخواست‌نشده را فقط برای اصلاح واقعی و ضروری برگردان.
- `base_form`، `missing_fields`، `requested_fields` و `review_status` را تکرار نکن.
- توضیح، Markdown یا متن خارج از JSON برنگردان.
- کنترل کن که concept نهایی تمام اطلاعات معتبر قبلی دربارهٔ همین sense را حفظ کرده، هیچ اشاره‌ای به senseهای دیگر ندارد و از ۵۰ کلمه بیشتر نیست.
- پیش از خروجی، تمام رکوردها و الزامات بالا را یک‌به‌یک کنترل کن.
