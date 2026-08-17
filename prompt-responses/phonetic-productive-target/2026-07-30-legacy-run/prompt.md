به تو آرای ای از اشیا داده میشه. در خرجی باید آرایه ای از اشیا درست کنی با فیلد هایی که نحوه تولید اونها گفته شده و از فیلد های قبلی فقط فیلد آی دی رو در آرایه جدید بزاری
پس خروجی یعنی فیلد های جدید که نحوه تولید اونها گفته شده و فیلد آید متناظر.
خروجی به صورت فشرده در متن قابل کپی پیست باشه/
══════════════════════════════════════

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

══════════════════════════════════════
Field name: productive_target

productive_target:

Assign a `Productive Target` score from `0` to `101` for each specific meaning of a word.

`Productive Target` indicates how important it is for an average person to recall and use that word quickly, accurately, and naturally in spoken English.

Evaluate each meaning and each part of speech separately.

## Evaluation criteria

1. Base the evaluation on contemporary North American English and general usage across all age groups.

2. Consider how likely an average person is to encounter situations where they need to express this specific concept.

3. Determine whether the exact word is necessary or whether a simple, short, and natural alternative can express the same meaning. A suitable alternative should lower the score.

4. The most important factor is how frequently a person needs to express the concept, not how frequently they see or hear the word.

5. General and everyday words usually receive higher scores than specialized, scientific, literary, academic, technical, or regional words.

6. Consider the word's frequency and naturalness in everyday speech. Written frequency is not a primary factor.

7. Words usable across more situations and topics should receive higher scores.

8. Consider how much inability to produce the word would obstruct communication or create important consequences in health, safety, work, or everyday life.

9. Words that must be recalled quickly and without hesitation should receive higher scores.

10. Consider whether the word is still natural and common in contemporary North American English or whether speakers normally use another word instead.

11. Words used in more common and natural collocations should receive higher scores.

12. Words that can be used in more varied sentences and communicative contexts should receive higher scores.

## Final rules

- Evaluate only the specified meaning, part of speech, and usage shown in the example sentence.
- Do not confuse the importance of understanding a word with the importance of actively producing it.
- General familiarity alone is not enough for a high score.
- Give names of specific flowers, animals, objects, species, and similar items a high score only when there is a genuine need to produce them.
- Determine the score from the combined criteria, not from a single factor.
- Example: `stone` meaning a fruit seed should receive a low score because `pit` is normally used in North American English.
- The output must be one integer from `0` to `101`.

## Output

Write only one integer from `1` to `100`. Do not add any explanation, label, punctuation, percentage sign, or other text.

══════════════════════════════════════

[
  {
    "id": 3478,
    "base_form": "jasmine",
    "meaning_fa": "یاس",
    "sentence_en": "The garden smells sweet when the jasmine blooms."
  },
  {
    "id": 3477,
    "base_form": "jade",
    "meaning_fa": "یشم",
    "sentence_en": "She wore a jade necklace passed down from her grandmother."
  },
  {
    "id": 3476,
    "base_form": "alfalfa",
    "meaning_fa": "یونجه",
    "sentence_en": "The farmer planted alfalfa to feed the cattle."
  },
  {
    "id": 3475,
    "base_form": "dragon",
    "meaning_fa": "اژدها",
    "sentence_en": "The story tells of a dragon guarding the mountain cave."
  },
  {
    "id": 3474,
    "base_form": "hazelnut",
    "meaning_fa": "فندق",
    "sentence_en": "She sprinkled chopped hazelnuts over the chocolate cake."
  },
  {
    "id": 3473,
    "base_form": "almond",
    "meaning_fa": "بادام",
    "sentence_en": "He grabbed a handful of almonds as a quick snack."
  },
  {
    "id": 3472,
    "base_form": "walnut",
    "meaning_fa": "گردو",
    "sentence_en": "She cracked a walnut and added it to the salad."
  },
  {
    "id": 3471,
    "base_form": "ignorance",
    "meaning_fa": "نادانی",
    "sentence_en": "They suffered because of their ignorance of the law."
  },
  {
    "id": 3470,
    "base_form": "faloodeh",
    "meaning_fa": "فالوده",
    "sentence_en": "We ate cold faloodeh on a hot summer afternoon."
  },
  {
    "id": 3469,
    "base_form": "pistachio",
    "meaning_fa": "پسته",
    "sentence_en": "She added crushed pistachio on top of the dessert."
  },
  {
    "id": 3468,
    "base_form": "witch",
    "meaning_fa": "ساحره",
    "sentence_en": "The villagers feared the witch who lived in the woods."
  },
  {
    "id": 3467,
    "base_form": "illusionist",
    "meaning_fa": "شعبده باز",
    "sentence_en": "The illusionist made the card disappear instantly."
  },
  {
    "id": 3466,
    "base_form": "magician",
    "meaning_fa": "جادوگر",
    "sentence_en": "The magician pulled a coin from the boy’s ear."
  },
  {
    "id": 3465,
    "base_form": "hunter",
    "meaning_fa": "صیاد",
    "sentence_en": "The hunter waited quietly near the edge of the forest."
  },
  {
    "id": 3464,
    "base_form": "detention center",
    "meaning_fa": "بازداشتگاه",
    "sentence_en": "He was held overnight at the detention center."
  },
  {
    "id": 3463,
    "base_form": "bathhouse",
    "meaning_fa": "گرمابه",
    "sentence_en": "The old bathhouse near the market is still open."
  },
  {
    "id": 3462,
    "base_form": "interpretation",
    "meaning_fa": "تفسیر",
    "sentence_en": "His interpretation of the contract caused a long debate."
  },
  {
    "id": 3461,
    "base_form": "mace",
    "meaning_fa": "گرز",
    "sentence_en": "The warrior raised his mace before charging into battle."
  },
  {
    "id": 3460,
    "base_form": "chute",
    "meaning_fa": "کانال دفع زباله",
    "sentence_en": "She dropped the trash bag down the apartment chute."
  },
  {
    "id": 3459,
    "base_form": "septon",
    "meaning_fa": "کشیش مرد",
    "sentence_en": "The septon led the prayer in the small village chapel."
  },
  {
    "id": 3458,
    "base_form": "ought",
    "meaning_fa": "باید",
    "sentence_en": "You ought to call your mother tonight."
  },
  {
    "id": 3457,
    "base_form": "rubber band",
    "meaning_fa": "کش",
    "sentence_en": "She wrapped a rubber band around the papers."
  },
  {
    "id": 3456,
    "base_form": "snack",
    "meaning_fa": "میان وعده",
    "sentence_en": "I grabbed a quick snack between meetings."
  },
  {
    "id": 3455,
    "base_form": "rich",
    "meaning_fa": "چرب",
    "sentence_en": "The sauce is too rich for my taste."
  },
  {
    "id": 3454,
    "base_form": "rich",
    "meaning_fa": "غنی",
    "sentence_en": "This soil is rich in nutrients."
  },
  {
    "id": 3453,
    "base_form": "rich",
    "meaning_fa": "ثروتمند",
    "sentence_en": "He became rich after selling his tech startup."
  },
  {
    "id": 3452,
    "base_form": "beer",
    "meaning_fa": "آبجو",
    "sentence_en": "They grabbed a cold beer after the game."
  },
  {
    "id": 3451,
    "base_form": "whiskey",
    "meaning_fa": "ویسکی",
    "sentence_en": "My uncle keeps a bottle of whiskey in his cabinet."
  },
  {
    "id": 3450,
    "base_form": "vodka",
    "meaning_fa": "ودکا",
    "sentence_en": "He ordered vodka with soda at the bar."
  },
  {
    "id": 3449,
    "base_form": "wine",
    "meaning_fa": "شراب",
    "sentence_en": "She poured a glass of wine after work."
  },
  {
    "id": 3448,
    "base_form": "chameleon",
    "meaning_fa": "آفتاب پرست",
    "sentence_en": "The chameleon changed color in its terrarium."
  },
  {
    "id": 3447,
    "base_form": "alligator",
    "meaning_fa": "تمساح",
    "sentence_en": "We spotted an alligator near the water at dusk."
  },
  {
    "id": 3446,
    "base_form": "crocodile",
    "meaning_fa": "تمساح",
    "sentence_en": "A crocodile lay still in the sun at the zoo."
  },
  {
    "id": 3445,
    "base_form": "gecko",
    "meaning_fa": "مارمولک",
    "sentence_en": "A gecko clung to the wall by the porch light."
  },
  {
    "id": 3444,
    "base_form": "lizard",
    "meaning_fa": "سوسمار",
    "sentence_en": "A lizard darted across the sidewalk and vanished."
  },
  {
    "id": 3443,
    "base_form": "viper",
    "meaning_fa": "افعی",
    "sentence_en": "The viper exhibit made me step back instinctively."
  },
  {
    "id": 3442,
    "base_form": "cobra",
    "meaning_fa": "مار کبری",
    "sentence_en": "We saw a cobra at the zoo behind thick glass."
  },
  {
    "id": 3441,
    "base_form": "snake",
    "meaning_fa": "مار",
    "sentence_en": "A snake crossed the trail and disappeared quickly."
  },
  {
    "id": 3440,
    "base_form": "tortoise",
    "meaning_fa": "لاک پشت خشکی",
    "sentence_en": "The tortoise moved slowly across the backyard."
  },
  {
    "id": 3439,
    "base_form": "salamander",
    "meaning_fa": "سمندر",
    "sentence_en": "We found a salamander under a wet log."
  },
  {
    "id": 3438,
    "base_form": "toad",
    "meaning_fa": "وزغ",
    "sentence_en": "A toad sat under the porch light at night."
  },
  {
    "id": 3437,
    "base_form": "frog",
    "meaning_fa": "قورباغه",
    "sentence_en": "A frog jumped into the water as we walked by."
  },
  {
    "id": 3436,
    "base_form": "pufferfish",
    "meaning_fa": "ماهی بادکنکی",
    "sentence_en": "We saw a pufferfish puff up in the aquarium."
  },
  {
    "id": 3435,
    "base_form": "swordfish",
    "meaning_fa": "ماهی شمشیر",
    "sentence_en": "We ordered swordfish at the restaurant by the pier."
  },
  {
    "id": 3434,
    "base_form": "trout",
    "meaning_fa": "ماهی قزل آلا",
    "sentence_en": "He caught a trout and let it go."
  },
  {
    "id": 3433,
    "base_form": "salmon",
    "meaning_fa": "سالمون",
    "sentence_en": "She baked salmon with lemon and dill."
  },
  {
    "id": 3432,
    "base_form": "tuna",
    "meaning_fa": "ماهی تن",
    "sentence_en": "We grilled tuna steaks and made a salad."
  },
  {
    "id": 3431,
    "base_form": "eel",
    "meaning_fa": "مارماهی",
    "sentence_en": "An eel slid out from under the rocks."
  },
  {
    "id": 3430,
    "base_form": "turtle",
    "meaning_fa": "لاک پشت",
    "sentence_en": "We saw a turtle swimming near the rocks."
  },
  {
    "id": 3429,
    "base_form": "seahorse",
    "meaning_fa": "اسب دریایی",
    "sentence_en": "The seahorse tank was my favorite part of the aquarium."
  },
  {
    "id": 3428,
    "base_form": "jellyfish",
    "meaning_fa": "عروس دریایی",
    "sentence_en": "A jellyfish drifted close, so we stayed back."
  },
  {
    "id": 3427,
    "base_form": "starfish",
    "meaning_fa": "ستاره دریایی",
    "sentence_en": "We spotted a starfish clinging to a rock."
  },
  {
    "id": 3426,
    "base_form": "clam",
    "meaning_fa": "صدف",
    "sentence_en": "We ordered steamed clam and shared them."
  },
  {
    "id": 3425,
    "base_form": "lobster",
    "meaning_fa": "لابستر",
    "sentence_en": "He treated us to lobster at a seaside restaurant."
  },
  {
    "id": 3424,
    "base_form": "shrimp",
    "meaning_fa": "میگو",
    "sentence_en": "She ordered shrimp tacos for lunch."
  },
  {
    "id": 3423,
    "base_form": "crab",
    "meaning_fa": "خرچنگ",
    "sentence_en": "A crab scuttled sideways across the tide pools."
  },
  {
    "id": 3422,
    "base_form": "octopus",
    "meaning_fa": "هشت پا",
    "sentence_en": "We saw an octopus hiding in a tank at the aquarium."
  },
  {
    "id": 3421,
    "base_form": "squid",
    "meaning_fa": "ماهی مرکب",
    "sentence_en": "The restaurant served fried squid with lemon."
  },
  {
    "id": 3420,
    "base_form": "octopus",
    "meaning_fa": "اختاپوس",
    "sentence_en": "We saw an octopus hiding in a tank at the aquarium."
  },
  {
    "id": 3419,
    "base_form": "dolphin",
    "meaning_fa": "دلفین",
    "sentence_en": "A dolphin surfaced next to our boat and splashed."
  },
  {
    "id": 3418,
    "base_form": "whale",
    "meaning_fa": "نهنگ",
    "sentence_en": "We saw a whale from the shore on vacation."
  },
  {
    "id": 3417,
    "base_form": "shark",
    "meaning_fa": "کوسه",
    "sentence_en": "The kids stared at the shark at the aquarium."
  },
  {
    "id": 3416,
    "base_form": "fish",
    "meaning_fa": "ماهی",
    "sentence_en": "We watched fish swim in the clear water."
  },
  {
    "id": 3415,
    "base_form": "finch",
    "meaning_fa": "سهره",
    "sentence_en": "A finch landed on the feeder and grabbed a seed."
  },
  {
    "id": 3414,
    "base_form": "partridge",
    "meaning_fa": "کبک",
    "sentence_en": "A partridge flushed from the grass near the trail."
  },
  {
    "id": 3413,
    "base_form": "pheasant",
    "meaning_fa": "قرقاول",
    "sentence_en": "A pheasant darted into the bushes and disappeared."
  },
  {
    "id": 3412,
    "base_form": "penguin",
    "meaning_fa": "پنگوئن",
    "sentence_en": "We watched a penguin swim at the aquarium."
  },
  {
    "id": 3411,
    "base_form": "ostrich",
    "meaning_fa": "شترمرغ",
    "sentence_en": "An ostrich ran across the enclosure at the zoo."
  },
  {
    "id": 3410,
    "base_form": "flamingo",
    "meaning_fa": "فلامینگو",
    "sentence_en": "We watched flamingo stand on one leg at the zoo."
  },
  {
    "id": 3409,
    "base_form": "pelican",
    "meaning_fa": "پلیکان",
    "sentence_en": "A pelican skimmed the water and caught a fish."
  },
  {
    "id": 3408,
    "base_form": "seagull",
    "meaning_fa": "مرغ دریایی",
    "sentence_en": "A seagull stole my fries at the beach."
  },
  {
    "id": 3407,
    "base_form": "woodpecker",
    "meaning_fa": "دارکوب",
    "sentence_en": "A woodpecker hammered on the tree by our fence."
  },
  {
    "id": 3406,
    "base_form": "parrot",
    "meaning_fa": "طوطی",
    "sentence_en": "The parrot copied my laugh and scared me."
  },
  {
    "id": 3405,
    "base_form": "canary",
    "meaning_fa": "قناری",
    "sentence_en": "My aunt keeps a canary in the living room."
  },
  {
    "id": 3404,
    "base_form": "nightingale",
    "meaning_fa": "بلبل",
    "sentence_en": "A nightingale sang outside while we sat on the porch."
  },
  {
    "id": 3403,
    "base_form": "peacock",
    "meaning_fa": "طاووس",
    "sentence_en": "We saw a peacock at the zoo showing its feathers."
  },
  {
    "id": 3402,
    "base_form": "owl",
    "meaning_fa": "جغد",
    "sentence_en": "An owl hooted in the woods behind our house."
  },
  {
    "id": 3401,
    "base_form": "hawk",
    "meaning_fa": "باز",
    "sentence_en": "A hawk perched on the pole near the field."
  },
  {
    "id": 3400,
    "base_form": "falcon",
    "meaning_fa": "شاهین",
    "sentence_en": "A falcon dove fast and grabbed its prey."
  },
  {
    "id": 3399,
    "base_form": "eagle",
    "meaning_fa": "عقاب",
    "sentence_en": "We saw an eagle circling above the lake."
  },
  {
    "id": 3398,
    "base_form": "jackdaw",
    "meaning_fa": "زاغ",
    "sentence_en": "A jackdaw perched on the roof and called loudly."
  },
  {
    "id": 3397,
    "base_form": "crow",
    "meaning_fa": "کلاغ",
    "sentence_en": "A crow dropped a nut on the road to crack it."
  },
  {
    "id": 3396,
    "base_form": "sparrow",
    "meaning_fa": "گنجشک",
    "sentence_en": "A sparrow hopped along the sidewalk near my feet."
  },
  {
    "id": 3395,
    "base_form": "dove",
    "meaning_fa": "قمری",
    "sentence_en": "A dove cooed softly in the tree outside."
  },
  {
    "id": 3394,
    "base_form": "pigeon",
    "meaning_fa": "کبوتر",
    "sentence_en": "A pigeon strutted around looking for crumbs."
  },
  {
    "id": 3393,
    "base_form": "turkey",
    "meaning_fa": "بوقلمون",
    "sentence_en": "A turkey crossed the road and held up traffic."
  },
  {
    "id": 3392,
    "base_form": "goose",
    "meaning_fa": "غاز",
    "sentence_en": "A goose hissed when we got too close."
  },
  {
    "id": 3391,
    "base_form": "duck",
    "meaning_fa": "اردک",
    "sentence_en": "A duck waddled toward the pond with its babies."
  },
  {
    "id": 3390,
    "base_form": "chick",
    "meaning_fa": "جوجه",
    "sentence_en": "A chick followed its mom across the yard."
  },
  {
    "id": 3389,
    "base_form": "rooster",
    "meaning_fa": "خروس",
    "sentence_en": "The rooster started crowing before the sun came up."
  },
  {
    "id": 3388,
    "base_form": "chicken",
    "meaning_fa": "مرغ",
    "sentence_en": "A chicken wandered into the yard and pecked around."
  },
  {
    "id": 3387,
    "base_form": "bird",
    "meaning_fa": "پرنده",
    "sentence_en": "A bird chirped outside my window at dawn."
  },
  {
    "id": 3386,
    "base_form": "water buffalo",
    "meaning_fa": "گاومیش",
    "sentence_en": "We saw a water buffalo on a farm tour."
  },
  {
    "id": 3385,
    "base_form": "buffalo",
    "meaning_fa": "بوفالو",
    "sentence_en": "We saw buffalo crossing the road in the park."
  },
  {
    "id": 3384,
    "base_form": "gazelle",
    "meaning_fa": "آهو",
    "sentence_en": "We saw a gazelle at the zoo."
  },
  {
    "id": 3383,
    "base_form": "deer",
    "meaning_fa": "گوزن",
    "sentence_en": "We saw a deer at the zoo."
  },
  {
    "id": 3382,
    "base_form": "otter",
    "meaning_fa": "سمور",
    "sentence_en": "We saw an otter at the zoo."
  },
  {
    "id": 3381,
    "base_form": "weasel",
    "meaning_fa": "راسو",
    "sentence_en": "We saw a weasel at the zoo."
  },
  {
    "id": 3380,
    "base_form": "koala",
    "meaning_fa": "کوالا",
    "sentence_en": "We saw a koala at the zoo."
  },
  {
    "id": 3379,
    "base_form": "kangaroo",
    "meaning_fa": "کانگورو",
    "sentence_en": "We saw a kangaroo at the zoo."
  },
  {
    "id": 3378,
    "base_form": "chimpanzee",
    "meaning_fa": "شامپانزه",
    "sentence_en": "We saw a chimpanzee at the zoo."
  },
  {
    "id": 3377,
    "base_form": "gorilla",
    "meaning_fa": "گوریل",
    "sentence_en": "We saw a gorilla at the zoo."
  },
  {
    "id": 3376,
    "base_form": "monkey",
    "meaning_fa": "میمون",
    "sentence_en": "We saw a monkey at the zoo."
  },
  {
    "id": 3375,
    "base_form": "giraffe",
    "meaning_fa": "زرافه",
    "sentence_en": "We saw a giraffe at the zoo."
  },
  {
    "id": 3374,
    "base_form": "hippopotamus",
    "meaning_fa": "اسب آبی",
    "sentence_en": "We saw a hippopotamus at the zoo."
  },
  {
    "id": 3373,
    "base_form": "rhinoceros",
    "meaning_fa": "کرگدن",
    "sentence_en": "We saw a rhinoceros at the zoo."
  },
  {
    "id": 3372,
    "base_form": "elephant",
    "meaning_fa": "فیل",
    "sentence_en": "We saw an elephant at the zoo."
  },
  {
    "id": 3371,
    "base_form": "leopard",
    "meaning_fa": "پلنگ",
    "sentence_en": "We saw a leopard at the zoo."
  },
  {
    "id": 3370,
    "base_form": "cheetah",
    "meaning_fa": "یوزپلنگ",
    "sentence_en": "We saw a cheetah at the zoo."
  },
  {
    "id": 3369,
    "base_form": "tiger",
    "meaning_fa": "ببر",
    "sentence_en": "We saw a tiger at the zoo."
  },
  {
    "id": 3368,
    "base_form": "lion",
    "meaning_fa": "شیر",
    "sentence_en": "We saw a lion at the zoo."
  },
  {
    "id": 3367,
    "base_form": "panda",
    "meaning_fa": "پاندا",
    "sentence_en": "We saw a panda at the zoo."
  },
  {
    "id": 3366,
    "base_form": "bear",
    "meaning_fa": "خرس",
    "sentence_en": "We saw a bear at the zoo."
  },
  {
    "id": 3365,
    "base_form": "jackal",
    "meaning_fa": "شغال",
    "sentence_en": "We saw a jackal at the zoo."
  },
  {
    "id": 3364,
    "base_form": "wolf",
    "meaning_fa": "گرگ",
    "sentence_en": "We saw a wolf at the zoo."
  },
  {
    "id": 3363,
    "base_form": "fox",
    "meaning_fa": "روباه",
    "sentence_en": "We saw a fox at the zoo."
  },
  {
    "id": 3362,
    "base_form": "hedgehog",
    "meaning_fa": "خارپشت",
    "sentence_en": "I spotted a hedgehog near the trash cans."
  },
  {
    "id": 3361,
    "base_form": "hamster",
    "meaning_fa": "همستر",
    "sentence_en": "My friend has a hamster at home."
  },
  {
    "id": 3360,
    "base_form": "squirrel",
    "meaning_fa": "سنجاب",
    "sentence_en": "I spotted a squirrel near the trash cans."
  },
  {
    "id": 3359,
    "base_form": "rat",
    "meaning_fa": "موش صحرایی",
    "sentence_en": "I spotted a rat near the trash cans."
  },
  {
    "id": 3358,
    "base_form": "mouse",
    "meaning_fa": "موش",
    "sentence_en": "I spotted a mouse near the trash cans."
  },
  {
    "id": 3357,
    "base_form": "rabbit",
    "meaning_fa": "خرگوش",
    "sentence_en": "My friend has a rabbit at home."
  },
  {
    "id": 3356,
    "base_form": "pig",
    "meaning_fa": "خوک",
    "sentence_en": "We saw a pig on a farm tour."
  },
  {
    "id": 3355,
    "base_form": "donkey",
    "meaning_fa": "الاغ",
    "sentence_en": "We saw a donkey on a farm tour."
  },
  {
    "id": 3354,
    "base_form": "donkey",
    "meaning_fa": "خر",
    "sentence_en": "We saw a donkey on a farm tour."
  },
  {
    "id": 3353,
    "base_form": "camel",
    "meaning_fa": "شتر",
    "sentence_en": "We saw a camel on a farm tour."
  },
  {
    "id": 3352,
    "base_form": "goat",
    "meaning_fa": "بز",
    "sentence_en": "We saw a goat on a farm tour."
  },
  {
    "id": 3351,
    "base_form": "sheep",
    "meaning_fa": "گوسفند",
    "sentence_en": "We saw a sheep on a farm tour."
  },
  {
    "id": 3350,
    "base_form": "horse",
    "meaning_fa": "اسب",
    "sentence_en": "We saw a horse on a farm tour."
  },
  {
    "id": 3349,
    "base_form": "cat",
    "meaning_fa": "گربه",
    "sentence_en": "My friend has a cat at home."
  },
  {
    "id": 3348,
    "base_form": "dog",
    "meaning_fa": "سگ",
    "sentence_en": "My friend has a dog at home."
  },
  {
    "id": 3347,
    "base_form": "rhubarb",
    "meaning_fa": "ریواس",
    "sentence_en": "He baked rhubarb into a tart last weekend."
  },
  {
    "id": 3346,
    "base_form": "fennel",
    "meaning_fa": "رازیانه",
    "sentence_en": "She sliced fennel thin and added lemon."
  },
  {
    "id": 3345,
    "base_form": "celery",
    "meaning_fa": "کرفس",
    "sentence_en": "He chopped celery for the chicken salad."
  },
  {
    "id": 3344,
    "base_form": "soybean",
    "meaning_fa": "سویا",
    "sentence_en": "Tofu is made from soybean and water."
  },
  {
    "id": 3343,
    "base_form": "mung",
    "meaning_fa": "ماش",
    "sentence_en": "She soaked mung beans overnight for tomorrow."
  },
  {
    "id": 3342,
    "base_form": "pinto bean",
    "meaning_fa": "لوبیا چیتی",
    "sentence_en": "He cooked pinto bean with rice and salsa."
  },
  {
    "id": 3341,
    "base_form": "lentil",
    "meaning_fa": "عدس",
    "sentence_en": "She made lentil soup for dinner."
  },
  {
    "id": 3340,
    "base_form": "fava",
    "meaning_fa": "باقلا",
    "sentence_en": "He ordered fava beans as a side dish."
  },
  {
    "id": 3339,
    "base_form": "corn",
    "meaning_fa": "ذرت",
    "sentence_en": "We grilled corn and ate it with butter."
  },
  {
    "id": 3338,
    "base_form": "bean",
    "meaning_fa": "لوبیا",
    "sentence_en": "He made a bean salad for lunch today."
  },
  {
    "id": 3337,
    "base_form": "okra",
    "meaning_fa": "بامیه",
    "sentence_en": "They cooked okra with tomatoes and spices."
  },
  {
    "id": 3336,
    "base_form": "squash",
    "meaning_fa": "کدو تنبل",
    "sentence_en": "He baked squash with butter and brown sugar."
  },
  {
    "id": 3335,
    "base_form": "pumpkin",
    "meaning_fa": "کدو حلوایی",
    "sentence_en": "She made pumpkin soup when it got cold."
  },
  {
    "id": 3334,
    "base_form": "zucchini",
    "meaning_fa": "کدو سبز",
    "sentence_en": "We grilled zucchini and ate it with dinner."
  },
  {
    "id": 3333,
    "base_form": "pepper",
    "meaning_fa": "فلفل",
    "sentence_en": "He added pepper to the soup and tasted again."
  },
  {
    "id": 3332,
    "base_form": "red pepper",
    "meaning_fa": "فلفل قرمز",
    "sentence_en": "She roasted red pepper and made a quick sauce."
  },
  {
    "id": 3331,
    "base_form": "green pepper",
    "meaning_fa": "فلفل سبز",
    "sentence_en": "He diced green pepper for the omelet."
  },
  {
    "id": 3330,
    "base_form": "bell pepper",
    "meaning_fa": "فلفل دلمه ای",
    "sentence_en": "She chopped bell pepper for the fajitas."
  },
  {
    "id": 3329,
    "base_form": "cucumber",
    "meaning_fa": "خیار",
    "sentence_en": "She added cucumber to the salad for crunch."
  },
  {
    "id": 3328,
    "base_form": "tomato",
    "meaning_fa": "گوجه فرنگی",
    "sentence_en": "He sliced a tomato for the sandwich at lunch."
  },
  {
    "id": 3327,
    "base_form": "avocado",
    "meaning_fa": "آووکادو",
    "sentence_en": "He mashed an avocado for toast."
  },
  {
    "id": 3326,
    "base_form": "olive",
    "meaning_fa": "زیتون",
    "sentence_en": "She ate an olive and made a face."
  },
  {
    "id": 3325,
    "base_form": "oleaster",
    "meaning_fa": "سنجد",
    "sentence_en": "She ate an oleaster for a quick snack."
  },
  {
    "id": 3324,
    "base_form": "hawthorn",
    "meaning_fa": "زالزالک",
    "sentence_en": "She ate a hawthorn for a quick snack."
  },
  {
    "id": 3323,
    "base_form": "medlar",
    "meaning_fa": "ازگیل",
    "sentence_en": "She ate a medlar for a quick snack."
  },
  {
    "id": 3322,
    "base_form": "quince",
    "meaning_fa": "به",
    "sentence_en": "She ate a quince for a quick snack."
  },
  {
    "id": 3321,
    "base_form": "melon",
    "meaning_fa": "طالبی",
    "sentence_en": "We cut up a melon and put it in the fridge."
  },
  {
    "id": 3320,
    "base_form": "watermelon",
    "meaning_fa": "هندوانه",
    "sentence_en": "We cut up a watermelon for the picnic."
  },
  {
    "id": 3319,
    "base_form": "melon",
    "meaning_fa": "خربزه",
    "sentence_en": "We cut up a melon and put it in the fridge."
  },
  {
    "id": 3318,
    "base_form": "cantaloupe",
    "meaning_fa": "طالبی",
    "sentence_en": "She ate a cantaloupe for a quick snack."
  },
  {
    "id": 3317,
    "base_form": "passion fruit",
    "meaning_fa": "پشن فروت",
    "sentence_en": "She ate a passion fruit for a quick snack."
  },
  {
    "id": 3316,
    "base_form": "dragon fruit",
    "meaning_fa": "دراگون فروت",
    "sentence_en": "She ate a dragon fruit for a quick snack."
  },
  {
    "id": 3315,
    "base_form": "lychee",
    "meaning_fa": "لیچی",
    "sentence_en": "She ate a lychee for a quick snack."
  },
  {
    "id": 3314,
    "base_form": "coconut",
    "meaning_fa": "نارگیل",
    "sentence_en": "He cracked a coconut and drank the water."
  },
  {
    "id": 3313,
    "base_form": "guava",
    "meaning_fa": "گواوا",
    "sentence_en": "She ate a guava for a quick snack."
  },
  {
    "id": 3312,
    "base_form": "papaya",
    "meaning_fa": "پاپایا",
    "sentence_en": "She ate a papaya for a quick snack."
  },
  {
    "id": 3311,
    "base_form": "mango",
    "meaning_fa": "انبه",
    "sentence_en": "She ate a mango for a quick snack."
  },
  {
    "id": 3310,
    "base_form": "pineapple",
    "meaning_fa": "آناناس",
    "sentence_en": "She ate a pineapple for a quick snack."
  },
  {
    "id": 3309,
    "base_form": "kiwi",
    "meaning_fa": "کیوی",
    "sentence_en": "She ate a kiwi for a quick snack."
  },
  {
    "id": 3308,
    "base_form": "cranberry",
    "meaning_fa": "کرنبری",
    "sentence_en": "She ate a cranberry for a quick snack."
  },
  {
    "id": 3307,
    "base_form": "blueberry",
    "meaning_fa": "بلوبری",
    "sentence_en": "She ate a blueberry for a quick snack."
  },
  {
    "id": 3306,
    "base_form": "blackberry",
    "meaning_fa": "شاه توت",
    "sentence_en": "She ate a blackberry for a quick snack."
  },
  {
    "id": 3305,
    "base_form": "raspberry",
    "meaning_fa": "تمشک",
    "sentence_en": "She ate a raspberry for a quick snack."
  },
  {
    "id": 3304,
    "base_form": "strawberry",
    "meaning_fa": "توت فرنگی",
    "sentence_en": "She ate a strawberry for a quick snack."
  },
  {
    "id": 3303,
    "base_form": "mulberry",
    "meaning_fa": "توت",
    "sentence_en": "She ate a mulberry for a quick snack."
  },
  {
    "id": 3302,
    "base_form": "persimmon",
    "meaning_fa": "خرمالو",
    "sentence_en": "She ate a persimmon for a quick snack."
  },
  {
    "id": 3301,
    "base_form": "date",
    "meaning_fa": "خرما",
    "sentence_en": "He ate a date with his afternoon tea."
  },
  {
    "id": 3300,
    "base_form": "fig",
    "meaning_fa": "انجیر",
    "sentence_en": "She sliced a fig and added it to yogurt."
  },
  {
    "id": 3299,
    "base_form": "pomegranate",
    "meaning_fa": "انار",
    "sentence_en": "She ate a pomegranate for a quick snack."
  },
  {
    "id": 3298,
    "base_form": "sour cherry",
    "meaning_fa": "آلبالو",
    "sentence_en": "She ate a sour cherry for a quick snack."
  },
  {
    "id": 3297,
    "base_form": "apricot",
    "meaning_fa": "زردآلو",
    "sentence_en": "She ate an apricot for a quick snack."
  },
  {
    "id": 3296,
    "base_form": "nectarine",
    "meaning_fa": "شلیل",
    "sentence_en": "She ate a nectarine for a quick snack."
  },
  {
    "id": 3295,
    "base_form": "peach",
    "meaning_fa": "هلو",
    "sentence_en": "She ate a peach for a quick snack."
  },
  {
    "id": 3294,
    "base_form": "greengage",
    "meaning_fa": "آلوچه",
    "sentence_en": "She ate a greengage for a quick snack."
  },
  {
    "id": 3293,
    "base_form": "plum",
    "meaning_fa": "آلو",
    "sentence_en": "She ate a plum for a quick snack."
  },
  {
    "id": 3292,
    "base_form": "raisin",
    "meaning_fa": "کشمش",
    "sentence_en": "A raisin fell off my cookie and rolled away."
  },
  {
    "id": 3291,
    "base_form": "grape",
    "meaning_fa": "انگور",
    "sentence_en": "She ate a grape for a quick snack."
  },
  {
    "id": 3290,
    "base_form": "bitter orange",
    "meaning_fa": "نارنج",
    "sentence_en": "She ate a bitter orange for a quick snack."
  },
  {
    "id": 3289,
    "base_form": "grapefruit",
    "meaning_fa": "گریپ فروت",
    "sentence_en": "She ate a grapefruit for a quick snack."
  },
  {
    "id": 3288,
    "base_form": "sweet lemon",
    "meaning_fa": "لیمو شیرین",
    "sentence_en": "She ate a sweet lemon for a quick snack."
  },
  {
    "id": 3287,
    "base_form": "lemon",
    "meaning_fa": "لیمو ترش",
    "sentence_en": "She ate a lemon for a quick snack."
  },
  {
    "id": 3286,
    "base_form": "mandarin",
    "meaning_fa": "نارنگی",
    "sentence_en": "She ate a mandarin for a quick snack."
  },
  {
    "id": 3285,
    "base_form": "orange",
    "meaning_fa": "پرتقال",
    "sentence_en": "She ate an orange for a quick snack."
  },
  {
    "id": 3284,
    "base_form": "banana",
    "meaning_fa": "موز",
    "sentence_en": "She ate a banana for a quick snack."
  },
  {
    "id": 3283,
    "base_form": "pear",
    "meaning_fa": "گلابی",
    "sentence_en": "She ate a pear for a quick snack."
  },
  {
    "id": 3282,
    "base_form": "apple",
    "meaning_fa": "سیب",
    "sentence_en": "She ate an apple for a quick snack."
  },
  {
    "id": 3281,
    "base_form": "tide",
    "meaning_fa": "مد",
    "sentence_en": "The tide was high, so the beach was narrow."
  },
  {
    "id": 3280,
    "base_form": "tide",
    "meaning_fa": "جزر",
    "sentence_en": "The tide was high, so the beach was narrow."
  },
  {
    "id": 3279,
    "base_form": "wave",
    "meaning_fa": "موج",
    "sentence_en": "A wave knocked him off balance in the surf."
  },
  {
    "id": 3278,
    "base_form": "landslide",
    "meaning_fa": "رانش زمین",
    "sentence_en": "A landslide blocked the highway after heavy rain."
  },
  {
    "id": 3277,
    "base_form": "frost",
    "meaning_fa": "یخبندان",
    "sentence_en": "The frost covered the windshield this morning."
  },
  {
    "id": 3276,
    "base_form": "blizzard",
    "meaning_fa": "بوران",
    "sentence_en": "The blizzard shut down schools for two days."
  },
  {
    "id": 3275,
    "base_form": "shower",
    "meaning_fa": "رگبار",
    "sentence_en": "We waited out a quick shower under the awning."
  },
  {
    "id": 3274,
    "base_form": "cloud",
    "meaning_fa": "ابر",
    "sentence_en": "A dark cloud moved over the stadium."
  },
  {
    "id": 3273,
    "base_form": "tsunami",
    "meaning_fa": "سونامی",
    "sentence_en": "A tsunami warning sent everyone to higher ground."
  },
  {
    "id": 3272,
    "base_form": "flood",
    "meaning_fa": "سیل",
    "sentence_en": "The flood closed the main road into town."
  },
  {
    "id": 3271,
    "base_form": "earthquake",
    "meaning_fa": "زلزله",
    "sentence_en": "The earthquake woke us up at 3 a.m."
  },
  {
    "id": 3270,
    "base_form": "lightning",
    "meaning_fa": "برق",
    "sentence_en": "The lightning lit up the sky behind the clouds."
  },
  {
    "id": 3269,
    "base_form": "thunder",
    "meaning_fa": "رعد",
    "sentence_en": "The thunder shook the windows in the middle of night."
  },
  {
    "id": 3268,
    "base_form": "storm",
    "meaning_fa": "طوفان",
    "sentence_en": "A storm rolled in right after sunset."
  },
  {
    "id": 3267,
    "base_form": "wind",
    "meaning_fa": "باد",
    "sentence_en": "The wind slammed the door shut."
  },
  {
    "id": 3266,
    "base_form": "fog",
    "meaning_fa": "مه",
    "sentence_en": "The fog was thick, so we drove slowly."
  },
  {
    "id": 3265,
    "base_form": "snow",
    "meaning_fa": "برف",
    "sentence_en": "The snow started falling before the game ended."
  },
  {
    "id": 3264,
    "base_form": "rain",
    "meaning_fa": "باران",
    "sentence_en": "We got caught in the rain without an umbrella."
  },
  {
    "id": 3263,
    "base_form": "muscle",
    "meaning_fa": "ماهیچه",
    "sentence_en": "My muscle soreness peaked the next day."
  },
  {
    "id": 3262,
    "base_form": "vein",
    "meaning_fa": "رگ",
    "sentence_en": "A vein stood out on his forearm."
  },
  {
    "id": 3261,
    "base_form": "toe",
    "meaning_fa": "انگشت پا",
    "sentence_en": "I stubbed my toe on the coffee table."
  },
  {
    "id": 3260,
    "base_form": "heel",
    "meaning_fa": "پاشنه",
    "sentence_en": "Her heel started hurting after the long walk."
  },
  {
    "id": 3259,
    "base_form": "sole",
    "meaning_fa": "کف پا",
    "sentence_en": "The sole on my shoe is worn out."
  },
  {
    "id": 3258,
    "base_form": "foot",
    "meaning_fa": "پا",
    "sentence_en": "He stepped wrong and twisted his foot."
  },
  {
    "id": 3257,
    "base_form": "ankle",
    "meaning_fa": "مچ پا",
    "sentence_en": "He twisted his ankle on the stairs."
  },
  {
    "id": 3256,
    "base_form": "calf",
    "meaning_fa": "ساق پا",
    "sentence_en": "My calf cramped halfway through the run."
  },
  {
    "id": 3255,
    "base_form": "knee",
    "meaning_fa": "زانو",
    "sentence_en": "She injured her knee during practice last week."
  },
  {
    "id": 3254,
    "base_form": "thigh",
    "meaning_fa": "ران",
    "sentence_en": "He felt a cramp in his thigh mid-run."
  },
  {
    "id": 3253,
    "base_form": "nail",
    "meaning_fa": "ناخن",
    "sentence_en": "He broke a nail opening the package."
  },
  {
    "id": 3252,
    "base_form": "thumb",
    "meaning_fa": "انگشت شست",
    "sentence_en": "He jammed his thumb playing basketball."
  },
  {
    "id": 3251,
    "base_form": "finger",
    "meaning_fa": "انگشت",
    "sentence_en": "She cut her finger while chopping onions."
  },
  {
    "id": 3250,
    "base_form": "hand",
    "meaning_fa": "دست",
    "sentence_en": "He raised his hand to ask a question."
  },
  {
    "id": 3248,
    "base_form": "elbow",
    "meaning_fa": "آرنج",
    "sentence_en": "He bumped his elbow on the table edge."
  },
  {
    "id": 3247,
    "base_form": "forearm",
    "meaning_fa": "ساعد",
    "sentence_en": "A bruise spread across his forearm overnight."
  },
  {
    "id": 3246,
    "base_form": "arm",
    "meaning_fa": "بازو",
    "sentence_en": "He broke his arm skateboarding last summer."
  },
  {
    "id": 3245,
    "base_form": "part",
    "meaning_fa": "فرق مو",
    "sentence_en": "She switched her part to the other side."
  },
  {
    "id": 3244,
    "base_form": "hairline",
    "meaning_fa": "خط مو",
    "sentence_en": "His hairline has changed a lot over the years."
  },
  {
    "id": 3243,
    "base_form": "mustache",
    "meaning_fa": "سبیل",
    "sentence_en": "He shaved his mustache for the first time."
  },
  {
    "id": 3242,
    "base_form": "beard",
    "meaning_fa": "ریش",
    "sentence_en": "He trimmed his beard in the bathroom mirror."
  },
  {
    "id": 3241,
    "base_form": "jaw",
    "meaning_fa": "فک",
    "sentence_en": "My jaw hurts when I chew, so I stopped."
  },
  {
    "id": 3240,
    "base_form": "chin",
    "meaning_fa": "چانه",
    "sentence_en": "He rested his chin on his hand."
  },
  {
    "id": 3239,
    "base_form": "cheek",
    "meaning_fa": "گونه",
    "sentence_en": "She kissed him on the cheek goodbye."
  },
  {
    "id": 3238,
    "base_form": "teeth",
    "meaning_fa": "دندان ها",
    "sentence_en": "Brush your teeth before you go to sleep."
  },
  {
    "id": 3237,
    "base_form": "lip",
    "meaning_fa": "لب",
    "sentence_en": "Her lip split in the cold wind."
  },
  {
    "id": 3236,
    "base_form": "nostril",
    "meaning_fa": "سوراخ بینی",
    "sentence_en": "He has a tiny scar near his nostril."
  },
  {
    "id": 3235,
    "base_form": "eyelash",
    "meaning_fa": "مژه",
    "sentence_en": "I got an eyelash stuck in my eye again."
  },
  {
    "id": 3234,
    "base_form": "eyebrow",
    "meaning_fa": "ابرو",
    "sentence_en": "He raised an eyebrow when he heard the news."
  },
  {
    "id": 3233,
    "base_form": "forehead",
    "meaning_fa": "پیشانی",
    "sentence_en": "Sweat dripped down his forehead during the run."
  },
  {
    "id": 3232,
    "base_form": "face",
    "meaning_fa": "صورت",
    "sentence_en": "She washed her face before going to bed."
  },
  {
    "id": 3231,
    "base_form": "side",
    "meaning_fa": "پهلو",
    "sentence_en": "He slept on his side to breathe easier."
  },
  {
    "id": 3230,
    "base_form": "back",
    "meaning_fa": "پشت",
    "sentence_en": "My back hurts after sitting all day."
  },
  {
    "id": 3229,
    "base_form": "waist",
    "meaning_fa": "کمر",
    "sentence_en": "The belt sits high on my waist."
  },
  {
    "id": 3228,
    "base_form": "abdomen",
    "meaning_fa": "شکم",
    "sentence_en": "He had pain in his abdomen after lunch."
  },
  {
    "id": 3227,
    "base_form": "chest",
    "meaning_fa": "سینه",
    "sentence_en": "She felt tightness in her chest and sat down."
  },
  {
    "id": 3226,
    "base_form": "shoulder",
    "meaning_fa": "شانه",
    "sentence_en": "He hurt his shoulder lifting that heavy box."
  },
  {
    "id": 3225,
    "base_form": "neck",
    "meaning_fa": "گردن",
    "sentence_en": "My neck feels stiff after sleeping wrong."
  },
  {
    "id": 3224,
    "base_form": "antenna",
    "meaning_fa": "شاخک",
    "sentence_en": "The insect's antenna twitched as it crawled away."
  },
  {
    "id": 3223,
    "base_form": "bird foot",
    "meaning_fa": "پنجه پرنده",
    "sentence_en": "A bird foot print marked the fresh snow."
  },
  {
    "id": 3222,
    "base_form": "talon",
    "meaning_fa": "چنگال",
    "sentence_en": "The hawk's talon gripped the branch tightly."
  },
  {
    "id": 3221,
    "base_form": "gill",
    "meaning_fa": "آبشش",
    "sentence_en": "The fish moved its gill quickly in the bucket."
  },
  {
    "id": 3220,
    "base_form": "scale",
    "meaning_fa": "پولک",
    "sentence_en": "The fish scale shimmered in the sunlight."
  },
  {
    "id": 3219,
    "base_form": "shell",
    "meaning_fa": "لاک",
    "sentence_en": "She found a shell in the wet sand."
  },
  {
    "id": 3218,
    "base_form": "shell",
    "meaning_fa": "پوسته",
    "sentence_en": "She found a shell in the wet sand."
  },
  {
    "id": 3217,
    "base_form": "hump",
    "meaning_fa": "کوهان",
    "sentence_en": "The camel's hump swayed as it walked."
  },
  {
    "id": 3216,
    "base_form": "mane",
    "meaning_fa": "یال",
    "sentence_en": "The horse's mane blew in the wind."
  },
  {
    "id": 3215,
    "base_form": "whisker",
    "meaning_fa": "سبیل (حیوانات)",
    "sentence_en": "One whisker on the cat was bent."
  },
  {
    "id": 3214,
    "base_form": "antler",
    "meaning_fa": "شاخک",
    "sentence_en": "The deer had a big antler on each side."
  },
  {
    "id": 3213,
    "base_form": "horn",
    "meaning_fa": "شاخ",
    "sentence_en": "The goat lowered its horn and backed away."
  },
  {
    "id": 3212,
    "base_form": "trunk",
    "meaning_fa": "خرطوم",
    "sentence_en": "The elephant lifted its trunk and sprayed water."
  },
  {
    "id": 3211,
    "base_form": "fang",
    "meaning_fa": "نیش",
    "sentence_en": "The snake showed its fang for a second."
  },
  {
    "id": 3210,
    "base_form": "beak",
    "meaning_fa": "منقار",
    "sentence_en": "The bird tapped its beak against the window."
  },
  {
    "id": 3209,
    "base_form": "tongue",
    "meaning_fa": "زبان",
    "sentence_en": "She bit her tongue while laughing."
  },
  {
    "id": 3208,
    "base_form": "tooth",
    "meaning_fa": "دندان",
    "sentence_en": "I chipped a tooth on a popcorn kernel."
  },
  {
    "id": 3207,
    "base_form": "mouth",
    "meaning_fa": "دهان",
    "sentence_en": "He burned his mouth on the hot pizza."
  },
  {
    "id": 3206,
    "base_form": "snout",
    "meaning_fa": "پوزه",
    "sentence_en": "The pig pushed its snout through the fence."
  },
  {
    "id": 3205,
    "base_form": "nose",
    "meaning_fa": "بینی",
    "sentence_en": "My nose was red from the cold wind outside."
  },
  {
    "id": 3204,
    "base_form": "ear",
    "meaning_fa": "گوش",
    "sentence_en": "My ear popped on the flight and hurt for hours."
  },
  {
    "id": 3203,
    "base_form": "eye",
    "meaning_fa": "چشم",
    "sentence_en": "Something got in my eye, so I rinsed it."
  },
  {
    "id": 3202,
    "base_form": "head",
    "meaning_fa": "سر",
    "sentence_en": "He hit his head on the low doorway."
  },
  {
    "id": 3201,
    "base_form": "tail",
    "meaning_fa": "دم",
    "sentence_en": "The dog wagged its tail when I came home."
  },
  {
    "id": 3200,
    "base_form": "fin",
    "meaning_fa": "باله",
    "sentence_en": "A fin cut through the water near the boat."
  },
  {
    "id": 3199,
    "base_form": "wing",
    "meaning_fa": "بال",
    "sentence_en": "The bird flapped its wing and took off."
  },
  {
    "id": 3198,
    "base_form": "hoof",
    "meaning_fa": "سم",
    "sentence_en": "The horse's hoof left prints in the mud."
  },
  {
    "id": 3197,
    "base_form": "claw",
    "meaning_fa": "چنگال",
    "sentence_en": "The cat's claw snagged my sweater sleeve."
  },
  {
    "id": 3196,
    "base_form": "paw",
    "meaning_fa": "پنجه",
    "sentence_en": "The puppy put its paw on my shoe."
  },
  {
    "id": 3195,
    "base_form": "leg",
    "meaning_fa": "پا",
    "sentence_en": "He bruised his leg playing basketball last night."
  },
  {
    "id": 3194,
    "base_form": "hide",
    "meaning_fa": "پوست ضخیم",
    "sentence_en": "The drum was stretched tight with deer hide."
  },
  {
    "id": 3193,
    "base_form": "hair",
    "meaning_fa": "مو",
    "sentence_en": "Her hair was still wet after the shower."
  },
  {
    "id": 3192,
    "base_form": "skin",
    "meaning_fa": "پوست",
    "sentence_en": "My skin gets dry in winter, so I moisturize."
  },
  {
    "id": 3191,
    "base_form": "body",
    "meaning_fa": "بدن",
    "sentence_en": "After the workout, my whole body felt sore."
  },
  {
    "id": 3190,
    "base_form": "seismic zone",
    "meaning_fa": "زمین لرزه خیز",
    "sentence_en": "Building codes are stricter in a seismic zone."
  },
  {
    "id": 3189,
    "base_form": "fault",
    "meaning_fa": "گسل",
    "sentence_en": "This region sits on a major fault line."
  },
  {
    "id": 3188,
    "base_form": "crater",
    "meaning_fa": "دهانه آتشفشان",
    "sentence_en": "We looked down into the crater from the rim."
  },
  {
    "id": 3187,
    "base_form": "volcano",
    "meaning_fa": "آتشفشان",
    "sentence_en": "The volcano was smoking when we arrived."
  },
  {
    "id": 3186,
    "base_form": "peninsula",
    "meaning_fa": "شبه جزیره",
    "sentence_en": "They drove down the peninsula to see the sunset."
  },
  {
    "id": 3185,
    "base_form": "cape",
    "meaning_fa": "دماغه",
    "sentence_en": "The lighthouse sits on a windy cape."
  },
  {
    "id": 3184,
    "base_form": "rocky coast",
    "meaning_fa": "ساحل صخره ای",
    "sentence_en": "We walked along the rocky coast at low tide."
  },
  {
    "id": 3183,
    "base_form": "beach",
    "meaning_fa": "ساحل",
    "sentence_en": "We spent the afternoon at the beach."
  },
  {
    "id": 3182,
    "base_form": "archipelago",
    "meaning_fa": "مجمع الجزایر",
    "sentence_en": "The archipelago has dozens of small islands."
  },
  {
    "id": 3181,
    "base_form": "island",
    "meaning_fa": "جزیره",
    "sentence_en": "We took a ferry to the island."
  },
  {
    "id": 3180,
    "base_form": "pole",
    "meaning_fa": "قطب",
    "sentence_en": "The compass needle points toward the pole."
  },
  {
    "id": 3179,
    "base_form": "permafrost",
    "meaning_fa": "زمین یخ زده",
    "sentence_en": "Up north, permafrost makes it hard to build roads."
  },
  {
    "id": 3178,
    "base_form": "iceberg",
    "meaning_fa": "کوه یخی",
    "sentence_en": "An iceberg drifted past the ship in silence."
  },
  {
    "id": 3177,
    "base_form": "glacier",
    "meaning_fa": "یخچال طبیعی",
    "sentence_en": "They hiked to the glacier with a guide."
  },
  {
    "id": 3176,
    "base_form": "delta",
    "meaning_fa": "دلتا",
    "sentence_en": "The river forms a delta near the coast."
  },
  {
    "id": 3175,
    "base_form": "gulf",
    "meaning_fa": "خلیج",
    "sentence_en": "A storm formed over the gulf overnight."
  },
  {
    "id": 3174,
    "base_form": "stream",
    "meaning_fa": "نهر",
    "sentence_en": "We followed the stream up into the woods."
  },
  {
    "id": 3173,
    "base_form": "marsh",
    "meaning_fa": "باتلاق",
    "sentence_en": "Mosquitoes were brutal near the marsh at dusk."
  },
  {
    "id": 3172,
    "base_form": "swamp",
    "meaning_fa": "مرداب",
    "sentence_en": "They kayaked through the swamp at sunrise."
  },
  {
    "id": 3171,
    "base_form": "wetland",
    "meaning_fa": "تالاب",
    "sentence_en": "The wetland trail was closed after the flooding."
  },
  {
    "id": 3170,
    "base_form": "ocean",
    "meaning_fa": "اقیانوس",
    "sentence_en": "The ocean looked calm until the wind picked up."
  },
  {
    "id": 3169,
    "base_form": "grassland",
    "meaning_fa": "چمنزار",
    "sentence_en": "We drove through open grassland for miles."
  },
  {
    "id": 3168,
    "base_form": "pasture",
    "meaning_fa": "مرتع",
    "sentence_en": "Cows grazed in the pasture behind the barn."
  },
  {
    "id": 3167,
    "base_form": "thicket",
    "meaning_fa": "بیشه",
    "sentence_en": "A rabbit vanished into the thicket in seconds."
  },
  {
    "id": 3166,
    "base_form": "rainforest",
    "meaning_fa": "جنگل بارانی",
    "sentence_en": "The rainforest was humid and full of insects."
  },
  {
    "id": 3165,
    "base_form": "forest",
    "meaning_fa": "جنگل",
    "sentence_en": "We walked through the forest and heard birds everywhere."
  },
  {
    "id": 3164,
    "base_form": "sinkhole",
    "meaning_fa": "گودال طبیعی",
    "sentence_en": "A sinkhole opened near the road after the rain."
  },
  {
    "id": 3163,
    "base_form": "pit",
    "meaning_fa": "چاله",
    "sentence_en": "He dug a pit for the campfire."
  },
  {
    "id": 3162,
    "base_form": "precipice",
    "meaning_fa": "پرتگاه",
    "sentence_en": "He stood near the precipice and looked down."
  },
  {
    "id": 3161,
    "base_form": "cliff",
    "meaning_fa": "صخره",
    "sentence_en": "Stay back from the cliff near the edge."
  },
  {
    "id": 3160,
    "base_form": "gorge",
    "meaning_fa": "تنگه",
    "sentence_en": "We stopped to look down into the gorge."
  },
  {
    "id": 3159,
    "base_form": "lowland",
    "meaning_fa": "جلگه",
    "sentence_en": "Fog settled over the lowland by morning."
  },
  {
    "id": 3158,
    "base_form": "desert",
    "meaning_fa": "کویر",
    "sentence_en": "We crossed the desert with extra water and snacks."
  },
  {
    "id": 3157,
    "base_form": "desert",
    "meaning_fa": "بیابان",
    "sentence_en": "We crossed the desert with extra water and snacks."
  },
  {
    "id": 3156,
    "base_form": "plateau",
    "meaning_fa": "فلات",
    "sentence_en": "The town sits on a high plateau."
  },
  {
    "id": 3155,
    "base_form": "plain",
    "meaning_fa": "دشت",
    "sentence_en": "They drove across a wide plain for hours."
  },
  {
    "id": 3154,
    "base_form": "mountain range",
    "meaning_fa": "کوهستان",
    "sentence_en": "The mountain range looked pink at sunset."
  },
  {
    "id": 3153,
    "base_form": "jewelry",
    "meaning_fa": "جواهر",
    "sentence_en": "She keeps her jewelry in a small box at home."
  },
  {
    "id": 3152,
    "base_form": "printed statement",
    "meaning_fa": "صورت حساب چاپی",
    "sentence_en": "She requested a printed statement for her records."
  },
  {
    "id": 3151,
    "base_form": "bill",
    "meaning_fa": "قبض",
    "sentence_en": "I paid the bill online this morning."
  },
  {
    "id": 3150,
    "base_form": "document",
    "meaning_fa": "سند",
    "sentence_en": "Sign the document and email it back today."
  },
  {
    "id": 3149,
    "base_form": "security certificate",
    "meaning_fa": "اوراق بهادار (فیزیکی)",
    "sentence_en": "He stored the security certificate in a safe at home."
  },
  {
    "id": 3148,
    "base_form": "bank slip",
    "meaning_fa": "فیش بانکی",
    "sentence_en": "He filled out a bank slip at the counter."
  },
  {
    "id": 3147,
    "base_form": "receipt",
    "meaning_fa": "رسید",
    "sentence_en": "Keep the receipt in case you need a return."
  },
  {
    "id": 3146,
    "base_form": "check",
    "meaning_fa": "چک",
    "sentence_en": "She wrote a check for the rent."
  },
  {
    "id": 3145,
    "base_form": "card holder",
    "meaning_fa": "جاکارتی",
    "sentence_en": "He keeps his ID in a slim card holder."
  },
  {
    "id": 3144,
    "base_form": "gift",
    "meaning_fa": "هدیه",
    "sentence_en": "I brought a small gift for your new place."
  },
  {
    "id": 3143,
    "base_form": "paper money",
    "meaning_fa": "پول کاغذی",
    "sentence_en": "He prefers paper money when he tips in cash."
  },
  {
    "id": 3142,
    "base_form": "change",
    "meaning_fa": "پول خرد",
    "sentence_en": "Do you have any change for the parking meter?"
  },
  {
    "id": 3141,
    "base_form": "coin",
    "meaning_fa": "سکه",
    "sentence_en": "He found a coin under the couch cushion."
  },
  {
    "id": 3140,
    "base_form": "money",
    "meaning_fa": "پول",
    "sentence_en": "I don't carry much money in cash anymore."
  },
  {
    "id": 3139,
    "base_form": "life jacket",
    "meaning_fa": "جلیقه نجات",
    "sentence_en": "Put on a life jacket before getting in the boat."
  },
  {
    "id": 3138,
    "base_form": "kickboard",
    "meaning_fa": "تخته شنا",
    "sentence_en": "The coach handed me a kickboard for swim drills."
  },
  {
    "id": 3137,
    "base_form": "ice skates",
    "meaning_fa": "اسکیت یخی",
    "sentence_en": "She rented ice skates for the first time."
  },
  {
    "id": 3136,
    "base_form": "shin guard",
    "meaning_fa": "محافظ ساق",
    "sentence_en": "Wear a shin guard when you play soccer."
  },
  {
    "id": 3135,
    "base_form": "mouthguard",
    "meaning_fa": "محافظ دهان",
    "sentence_en": "He forgot his mouthguard and had to sit out."
  },
  {
    "id": 3134,
    "base_form": "punching bag",
    "meaning_fa": "کیسه بوکس",
    "sentence_en": "She hit the punching bag to blow off stress."
  },
  {
    "id": 3133,
    "base_form": "gym machine",
    "meaning_fa": "دستگاه بدنسازی",
    "sentence_en": "He waited for the gym machine to open up."
  },
  {
    "id": 3132,
    "base_form": "yoga mat",
    "meaning_fa": "مت یوگا",
    "sentence_en": "I rolled out my yoga mat in the living room."
  },
  {
    "id": 3131,
    "base_form": "exercise ball",
    "meaning_fa": "توپ بدنسازی",
    "sentence_en": "He sits on an exercise ball at his desk."
  },
  {
    "id": 3130,
    "base_form": "jump rope",
    "meaning_fa": "طناب ورزشی",
    "sentence_en": "She did jump rope in the driveway after school."
  },
  {
    "id": 3129,
    "base_form": "resistance band",
    "meaning_fa": "کش ورزشی",
    "sentence_en": "I use a resistance band for shoulder rehab."
  },
  {
    "id": 3128,
    "base_form": "weight plate",
    "meaning_fa": "صفحه وزنه",
    "sentence_en": "He added another weight plate to the bar."
  },
  {
    "id": 3127,
    "base_form": "barbell",
    "meaning_fa": "هالتر",
    "sentence_en": "He loaded plates onto the barbell for deadlifts."
  },
  {
    "id": 3126,
    "base_form": "dumbbell",
    "meaning_fa": "دمبل",
    "sentence_en": "He did curls with a heavy dumbbell at home."
  },
  {
    "id": 3125,
    "base_form": "target",
    "meaning_fa": "هدف تیراندازی",
    "sentence_en": "She aimed at the target and took a deep breath."
  },
  {
    "id": 3124,
    "base_form": "goal",
    "meaning_fa": "دروازه",
    "sentence_en": "He scored a goal in the last minute."
  },
  {
    "id": 3123,
    "base_form": "net",
    "meaning_fa": "تور",
    "sentence_en": "The ball hit the net and bounced back."
  },
  {
    "id": 3122,
    "base_form": "cricket bat",
    "meaning_fa": "چوب کریکت",
    "sentence_en": "He bought a cricket bat and a new helmet."
  },
  {
    "id": 3121,
    "base_form": "hockey stick",
    "meaning_fa": "چوب هاکی",
    "sentence_en": "He taped his hockey stick before practice."
  },
  {
    "id": 3120,
    "base_form": "golf club",
    "meaning_fa": "چوب گلف",
    "sentence_en": "She left her golf club in the trunk overnight."
  },
  {
    "id": 3119,
    "base_form": "baseball bat",
    "meaning_fa": "چوب بیسبال",
    "sentence_en": "He grabbed his baseball bat and headed to the field."
  },
  {
    "id": 3118,
    "base_form": "pick",
    "meaning_fa": "مضراب",
    "sentence_en": "I dropped my pick and couldn't find it anywhere."
  },
  {
    "id": 3117,
    "base_form": "oboe",
    "meaning_fa": "ابوا",
    "sentence_en": "He warmed up his oboe before the concert."
  },
  {
    "id": 3115,
    "base_form": "trumpet",
    "meaning_fa": "ترومپت",
    "sentence_en": "The trumpet was loud in the small studio."
  },
  {
    "id": 3114,
    "base_form": "saxophone",
    "meaning_fa": "ساکسوفون",
    "sentence_en": "He bought a saxophone and started lessons."
  },
  {
    "id": 3113,
    "base_form": "clarinet",
    "meaning_fa": "کلارینت",
    "sentence_en": "The clarinet solo got a big cheer."
  },
  {
    "id": 3112,
    "base_form": "ney",
    "meaning_fa": "نی",
    "sentence_en": "He played the ney in a quiet room."
  },
  {
    "id": 3111,
    "base_form": "flute",
    "meaning_fa": "فلوت",
    "sentence_en": "She brought her flute to band practice today."
  },
  {
    "id": 3110,
    "base_form": "cajon",
    "meaning_fa": "کاخن",
    "sentence_en": "He sat on the cajon and kept the groove steady."
  },
  {
    "id": 3109,
    "base_form": "frame drum",
    "meaning_fa": "دایره",
    "sentence_en": "She grabbed a frame drum and joined the circle."
  },
  {
    "id": 3108,
    "base_form": "tombak",
    "meaning_fa": "تنبک",
    "sentence_en": "He practiced tombak rhythms for hours at home."
  },
  {
    "id": 3107,
    "base_form": "daf",
    "meaning_fa": "دف",
    "sentence_en": "She played the daf at her cousin's wedding."
  },
  {
    "id": 3106,
    "base_form": "accordion",
    "meaning_fa": "آکاردئون",
    "sentence_en": "He played the accordion on the street corner."
  },
  {
    "id": 3105,
    "base_form": "organ",
    "meaning_fa": "ارگ",
    "sentence_en": "The organ echoed through the church during rehearsal."
  },
  {
    "id": 3104,
    "base_form": "piano",
    "meaning_fa": "پیانو",
    "sentence_en": "She played the piano in the lobby for tips."
  },
  {
    "id": 3103,
    "base_form": "harp",
    "meaning_fa": "چنگ",
    "sentence_en": "A harp filled the room with calm music."
  },
  {
    "id": 3102,
    "base_form": "qanun",
    "meaning_fa": "قانون",
    "sentence_en": "The qanun sounded bright in the live recording."
  },
  {
    "id": 3100,
    "base_form": "setar",
    "meaning_fa": "سه تار",
    "sentence_en": "She learned setar from her grandfather."
  },
  {
    "id": 3099,
    "base_form": "tar",
    "meaning_fa": "تار",
    "sentence_en": "He played the tar at the family gathering."
  },
  {
    "id": 3098,
    "base_form": "violin",
    "meaning_fa": "ویولن",
    "sentence_en": "She practiced the violin before school every day."
  },
  {
    "id": 3097,
    "base_form": "guitar",
    "meaning_fa": "گیتار",
    "sentence_en": "He brought his guitar to rehearsal after work."
  },
  {
    "id": 3096,
    "base_form": "banner",
    "meaning_fa": "بنر",
    "sentence_en": "They hung a banner outside the store for the sale."
  },
  {
    "id": 3095,
    "base_form": "billboard",
    "meaning_fa": "تابلو تبلیغاتی",
    "sentence_en": "A huge billboard went up on the highway overnight."
  },
  {
    "id": 3094,
    "base_form": "pipe",
    "meaning_fa": "لوله",
    "sentence_en": "A pipe burst under the sink overnight."
  },
  {
    "id": 3093,
    "base_form": "cable",
    "meaning_fa": "کابل",
    "sentence_en": "The cable behind my desk came loose again."
  },
  {
    "id": 3092,
    "base_form": "manhole",
    "meaning_fa": "دریچه",
    "sentence_en": "Workers lifted the manhole cover to fix the leak."
  },
  {
    "id": 3091,
    "base_form": "turnstile",
    "meaning_fa": "گیت ورودی",
    "sentence_en": "He tapped his card and pushed through the turnstile."
  },
  {
    "id": 3090,
    "base_form": "ticket",
    "meaning_fa": "بلیت",
    "sentence_en": "I bought a ticket and joined the line."
  },
  {
    "id": 3089,
    "base_form": "temple",
    "meaning_fa": "معبد",
    "sentence_en": "We walked to the temple early to avoid crowds."
  },
  {
    "id": 3088,
    "base_form": "synagogue",
    "meaning_fa": "کنیسه",
    "sentence_en": "He went to the synagogue with his grandparents."
  },
  {
    "id": 3087,
    "base_form": "church",
    "meaning_fa": "کلیسا",
    "sentence_en": "They got married at a small church near the river."
  },
  {
    "id": 3086,
    "base_form": "shrine",
    "meaning_fa": "امامزاده",
    "sentence_en": "People left flowers at the shrine by the hillside."
  },
  {
    "id": 3085,
    "base_form": "mosque",
    "meaning_fa": "مسجد",
    "sentence_en": "We visited the mosque during our trip downtown."
  },
  {
    "id": 3084,
    "base_form": "center",
    "meaning_fa": "مرکز",
    "sentence_en": "The community center hosts classes on weeknights."
  },
  {
    "id": 3083,
    "base_form": "emergency room",
    "meaning_fa": "اورژانس",
    "sentence_en": "We waited in the emergency room for two hours."
  },
  {
    "id": 3082,
    "base_form": "laboratory",
    "meaning_fa": "آزمایشگاه",
    "sentence_en": "They sent the sample to the laboratory for testing."
  },
  {
    "id": 3081,
    "base_form": "dental clinic",
    "meaning_fa": "دندانپزشکی",
    "sentence_en": "I have a cleaning at the dental clinic tomorrow."
  },
  {
    "id": 3080,
    "base_form": "pharmacy",
    "meaning_fa": "داروخانه",
    "sentence_en": "The pharmacy closes at nine tonight."
  },
  {
    "id": 3079,
    "base_form": "doctor's office",
    "meaning_fa": "مطب",
    "sentence_en": "The doctor's office asked me to fill out forms."
  },
  {
    "id": 3078,
    "base_form": "clinic",
    "meaning_fa": "کلینیک",
    "sentence_en": "The clinic called to confirm my appointment."
  },
  {
    "id": 3077,
    "base_form": "clinic",
    "meaning_fa": "درمانگاه",
    "sentence_en": "I made an appointment at the clinic for next week."
  },
  {
    "id": 3076,
    "base_form": "hospital",
    "meaning_fa": "بیمارستان",
    "sentence_en": "He was taken to the hospital for a broken arm."
  },
  {
    "id": 3075,
    "base_form": "classroom",
    "meaning_fa": "کلاس",
    "sentence_en": "The classroom got quiet when the teacher walked in."
  },
  {
    "id": 3074,
    "base_form": "kindergarten",
    "meaning_fa": "مهدکودک",
    "sentence_en": "Her son starts kindergarten in the fall."
  },
  {
    "id": 3073,
    "base_form": "bookstore",
    "meaning_fa": "کتابفروشی",
    "sentence_en": "We browsed the bookstore for an hour."
  },
  {
    "id": 3072,
    "base_form": "library",
    "meaning_fa": "کتابخانه",
    "sentence_en": "I returned the books to the library before work."
  },
  {
    "id": 3071,
    "base_form": "training institute",
    "meaning_fa": "آموزشگاه",
    "sentence_en": "He enrolled in a training institute for web development."
  },
  {
    "id": 3070,
    "base_form": "faculty",
    "meaning_fa": "دانشکده",
    "sentence_en": "He works on the faculty and teaches two classes."
  },
  {
    "id": 3069,
    "base_form": "university",
    "meaning_fa": "دانشگاه",
    "sentence_en": "She got into the university she really wanted."
  },
  {
    "id": 3068,
    "base_form": "high school",
    "meaning_fa": "دبیرستان",
    "sentence_en": "He met his best friend in high school."
  },
  {
    "id": 3067,
    "base_form": "elementary school",
    "meaning_fa": "دبستان",
    "sentence_en": "She teaches at an elementary school on the east side."
  },
  {
    "id": 3066,
    "base_form": "school",
    "meaning_fa": "مدرسه",
    "sentence_en": "The school starts at eight, so set an alarm."
  },
  {
    "id": 3065,
    "base_form": "cafeteria",
    "meaning_fa": "سلف سرویس",
    "sentence_en": "I ate in the cafeteria because the line was short."
  },
  {
    "id": 3064,
    "base_form": "traditional restaurant",
    "meaning_fa": "سفره خانه",
    "sentence_en": "They took us to a traditional restaurant near the old square."
  },
  {
    "id": 3063,
    "base_form": "teahouse",
    "meaning_fa": "چایخانه",
    "sentence_en": "We sat in a teahouse and talked for hours."
  },
  {
    "id": 3062,
    "base_form": "coffeehouse",
    "meaning_fa": "قهوه خانه",
    "sentence_en": "He works from a coffeehouse when he's tired of home."
  },
  {
    "id": 3061,
    "base_form": "cafe",
    "meaning_fa": "کافه",
    "sentence_en": "Let's meet at the cafe across from the library."
  },
  {
    "id": 3060,
    "base_form": "fast food",
    "meaning_fa": "فست فود",
    "sentence_en": "We grabbed fast food on the way to the game."
  },
  {
    "id": 3059,
    "base_form": "restaurant",
    "meaning_fa": "رستوران",
    "sentence_en": "We tried a new restaurant that just opened."
  },
  {
    "id": 3058,
    "base_form": "chain store",
    "meaning_fa": "فروشگاه زنجیره ای",
    "sentence_en": "I prefer the local cafe over a chain store."
  },
  {
    "id": 3057,
    "base_form": "mall",
    "meaning_fa": "پاساژ",
    "sentence_en": "The mall was packed because it was raining."
  },
  {
    "id": 3056,
    "base_form": "mall",
    "meaning_fa": "مرکز خرید",
    "sentence_en": "We met at the mall and grabbed lunch first."
  },
  {
    "id": 3055,
    "base_form": "market",
    "meaning_fa": "بازارچه",
    "sentence_en": "The market had fresh tomatoes and local cheese."
  },
  {
    "id": 3054,
    "base_form": "bazaar",
    "meaning_fa": "بازار",
    "sentence_en": "We wandered through the bazaar and bought spices."
  },
  {
    "id": 3053,
    "base_form": "bakery",
    "meaning_fa": "نانوایی",
    "sentence_en": "The bakery smells amazing early in the morning."
  },
  {
    "id": 3052,
    "base_form": "supermarket",
    "meaning_fa": "سوپرمارکت",
    "sentence_en": "I ran into my neighbor at the supermarket."
  },
  {
    "id": 3051,
    "base_form": "shop",
    "meaning_fa": "مغازه",
    "sentence_en": "There's a small shop on the corner with great coffee."
  },
  {
    "id": 3050,
    "base_form": "store",
    "meaning_fa": "فروشگاه",
    "sentence_en": "This store closes at nine, so let's go now."
  },
  {
    "id": 3049,
    "base_form": "car wash",
    "meaning_fa": "کارواش",
    "sentence_en": "I took the car to a car wash after the storm."
  },
  {
    "id": 3048,
    "base_form": "auto repair",
    "meaning_fa": "تعمیرگاه خودرو",
    "sentence_en": "Auto repair is expensive if you wait too long."
  },
  {
    "id": 3047,
    "base_form": "repair shop",
    "meaning_fa": "تعمیرگاه",
    "sentence_en": "My phone is at the repair shop for a new screen."
  },
  {
    "id": 3046,
    "base_form": "locksmith",
    "meaning_fa": "کلیدسازی",
    "sentence_en": "A locksmith came out and opened the door."
  },
  {
    "id": 3045,
    "base_form": "shoe repair",
    "meaning_fa": "کفاشی",
    "sentence_en": "This shoe repair place can fix heels fast."
  },
  {
    "id": 3044,
    "base_form": "tailor shop",
    "meaning_fa": "خیاطی",
    "sentence_en": "The tailor shop fixed my pants hem in a day."
  },
  {
    "id": 3043,
    "base_form": "laundry",
    "meaning_fa": "لباسشویی",
    "sentence_en": "I dropped my clothes off at the laundry on Elm."
  },
  {
    "id": 3042,
    "base_form": "dry cleaner",
    "meaning_fa": "خشکشویی",
    "sentence_en": "I dropped my suit off at the dry cleaner."
  },
  {
    "id": 3041,
    "base_form": "barber shop",
    "meaning_fa": "سلمانی",
    "sentence_en": "He gets his hair cut at the barber shop."
  },
  {
    "id": 3040,
    "base_form": "beauty salon",
    "meaning_fa": "سالن زیبایی",
    "sentence_en": "They went to a beauty salon before the wedding."
  },
  {
    "id": 3039,
    "base_form": "hair salon",
    "meaning_fa": "آرایشگاه",
    "sentence_en": "She booked a haircut at the hair salon nearby."
  },
  {
    "id": 3038,
    "base_form": "dealership",
    "meaning_fa": "نمایندگی فروش",
    "sentence_en": "He bought his truck at a dealership outside town."
  },
  {
    "id": 3037,
    "base_form": "agency",
    "meaning_fa": "نمایندگی",
    "sentence_en": "She booked the trip through a local agency."
  },
  {
    "id": 3036,
    "base_form": "notary",
    "meaning_fa": "دفتر اسناد رسمی",
    "sentence_en": "We need a notary to sign these forms today."
  },
  {
    "id": 3035,
    "base_form": "insurance",
    "meaning_fa": "بیمه",
    "sentence_en": "Our insurance covered most of the repair costs."
  },
  {
    "id": 3034,
    "base_form": "bank",
    "meaning_fa": "بانک",
    "sentence_en": "I stopped by the bank to deposit a check."
  },
  {
    "id": 3033,
    "base_form": "office",
    "meaning_fa": "اداره",
    "sentence_en": "I have to go to the office to renew my ID."
  },
  {
    "id": 3032,
    "base_form": "company",
    "meaning_fa": "شرکت",
    "sentence_en": "Her company is hiring for a new sales role."
  },
  {
    "id": 3031,
    "base_form": "office",
    "meaning_fa": "دفتر",
    "sentence_en": "I left my laptop at the office last night."
  },
  {
    "id": 3030,
    "base_form": "factory",
    "meaning_fa": "کارخانه",
    "sentence_en": "My cousin works at a factory that makes tires."
  },
  {
    "id": 3029,
    "base_form": "restroom",
    "meaning_fa": "دستشویی",
    "sentence_en": "Is there a restroom near the front entrance?"
  },
  {
    "id": 3028,
    "base_form": "parking",
    "meaning_fa": "پارکینگ",
    "sentence_en": "There's no parking on this block after 6 p.m."
  },
  {
    "id": 3027,
    "base_form": "playground",
    "meaning_fa": "زمین بازی",
    "sentence_en": "The kids ran to the playground after school."
  },
  {
    "id": 3026,
    "base_form": "park",
    "meaning_fa": "پارک",
    "sentence_en": "Let's walk through the park before it gets dark."
  },
  {
    "id": 3025,
    "base_form": "square",
    "meaning_fa": "میدان",
    "sentence_en": "They met in the square to watch the parade."
  },
  {
    "id": 3024,
    "base_form": "street",
    "meaning_fa": "خیابان",
    "sentence_en": "The coffee shop is across the street."
  },
  {
    "id": 3023,
    "base_form": "alley",
    "meaning_fa": "کوچه",
    "sentence_en": "We took the alley to avoid the traffic on Main."
  },
  {
    "id": 3022,
    "base_form": "neighborhood",
    "meaning_fa": "محله",
    "sentence_en": "This neighborhood is quiet, but it's close to everything."
  },
  {
    "id": 3021,
    "base_form": "apartment",
    "meaning_fa": "آپارتمان",
    "sentence_en": "She rents an apartment near the subway station."
  },
  {
    "id": 3020,
    "base_form": "centipede",
    "meaning_fa": "صدپا",
    "sentence_en": "A centipede darted across the bathroom floor."
  },
  {
    "id": 3019,
    "base_form": "millipede",
    "meaning_fa": "هزارپا",
    "sentence_en": "I found a millipede under the flower pot."
  },
  {
    "id": 3018,
    "base_form": "slug",
    "meaning_fa": "حلزون بی صدف",
    "sentence_en": "A slug left a shiny trail on the patio."
  },
  {
    "id": 3017,
    "base_form": "snail",
    "meaning_fa": "حلزون",
    "sentence_en": "A snail inched across the sidewalk after the storm."
  },
  {
    "id": 3016,
    "base_form": "leech",
    "meaning_fa": "زالو",
    "sentence_en": "A leech latched onto my leg in the lake."
  },
  {
    "id": 3015,
    "base_form": "scorpion",
    "meaning_fa": "عقرب",
    "sentence_en": "We spotted a scorpion near the tent and backed up."
  },
  {
    "id": 3014,
    "base_form": "spider",
    "meaning_fa": "عنکبوت",
    "sentence_en": "A spider built a web in the corner of the shower."
  },
  {
    "id": 3013,
    "base_form": "louse",
    "meaning_fa": "شپش",
    "sentence_en": "They checked his hair and found a louse."
  },
  {
    "id": 3012,
    "base_form": "flea",
    "meaning_fa": "کک",
    "sentence_en": "The vet said our dog might have a flea."
  },
  {
    "id": 3011,
    "base_form": "aphid",
    "meaning_fa": "شته",
    "sentence_en": "These aphids are ruining my roses in the backyard."
  },
  {
    "id": 3010,
    "base_form": "beetle",
    "meaning_fa": "سوسک",
    "sentence_en": "A shiny beetle crawled under the log in seconds."
  },
  {
    "id": 3009,
    "base_form": "cricket",
    "meaning_fa": "جیرجیرک",
    "sentence_en": "I could hear a cricket outside my window all night."
  },
  {
    "id": 3008,
    "base_form": "grasshopper",
    "meaning_fa": "ملخ",
    "sentence_en": "A grasshopper jumped out of the grass by my shoe."
  },
  {
    "id": 3007,
    "base_form": "mosquito",
    "meaning_fa": "پشه",
    "sentence_en": "I got a mosquito bite while we were camping."
  },
  {
    "id": 3006,
    "base_form": "fly",
    "meaning_fa": "مگس",
    "sentence_en": "A fly kept buzzing around the kitchen all morning."
  },
  {
    "id": 3005,
    "base_form": "butterfly",
    "meaning_fa": "پروانه",
    "sentence_en": "A butterfly fluttered past the window right at sunrise."
  },
  {
    "id": 3004,
    "base_form": "wasp",
    "meaning_fa": "زنبور وحشی",
    "sentence_en": "A wasp flew into the car and we panicked."
  },
  {
    "id": 3003,
    "base_form": "honeybee",
    "meaning_fa": "زنبور عسل",
    "sentence_en": "A honeybee landed on the lavender and stayed there."
  },
  {
    "id": 3002,
    "base_form": "ant",
    "meaning_fa": "مورچه",
    "sentence_en": "An ant crawled across my desk while I was working."
  },
  {
    "id": 3001,
    "base_form": "insect",
    "meaning_fa": "حشره",
    "sentence_en": "A strange insect landed on my arm in the garden."
  },
  {
    "id": 3000,
    "base_form": "hockey",
    "meaning_fa": "هاکی",
    "sentence_en": "He plays hockey on a local team every winter."
  },
  {
    "id": 2999,
    "base_form": "figure skating",
    "meaning_fa": "پاتیناژ",
    "sentence_en": "She watches figure skating every time the Olympics come on."
  },
  {
    "id": 2998,
    "base_form": "fencing",
    "meaning_fa": "شمشیربازی",
    "sentence_en": "He started fencing and loves the fast footwork."
  },
  {
    "id": 2997,
    "base_form": "polo",
    "meaning_fa": "چوگان",
    "sentence_en": "We watched polo and cheered when his team scored."
  },
  {
    "id": 2996,
    "base_form": "horse riding",
    "meaning_fa": "سوارکاری",
    "sentence_en": "She went horse riding on vacation and felt amazing."
  },
  {
    "id": 2995,
    "base_form": "darts",
    "meaning_fa": "دارت",
    "sentence_en": "We played darts and kept missing the bullseye."
  },
  {
    "id": 2994,
    "base_form": "snooker",
    "meaning_fa": "اسنوکر",
    "sentence_en": "He watched snooker highlights and learned the rules."
  },
  {
    "id": 2993,
    "base_form": "billiards",
    "meaning_fa": "بیلیارد",
    "sentence_en": "They played billiards at the bar after the show."
  },
  {
    "id": 2992,
    "base_form": "bowling",
    "meaning_fa": "بولینگ",
    "sentence_en": "We went bowling and laughed at our terrible scores."
  },
  {
    "id": 2991,
    "base_form": "archery",
    "meaning_fa": "تیر و کمان",
    "sentence_en": "She practices archery in her backyard with a target."
  },
  {
    "id": 2990,
    "base_form": "shooting",
    "meaning_fa": "تیراندازی",
    "sentence_en": "He went shooting at the range with his coworkers."
  },
  {
    "id": 2989,
    "base_form": "skydiving",
    "meaning_fa": "چتربازی",
    "sentence_en": "She went skydiving for her birthday and loved it."
  },
  {
    "id": 2988,
    "base_form": "bungee jumping",
    "meaning_fa": "بانجی جامپینگ",
    "sentence_en": "He went bungee jumping, and he screamed the whole time."
  },
  {
    "id": 2987,
    "base_form": "rafting",
    "meaning_fa": "رفتینگ",
    "sentence_en": "They booked rafting on the river for Saturday."
  },
  {
    "id": 2986,
    "base_form": "caving",
    "meaning_fa": "غارنوردی",
    "sentence_en": "We went caving and wore helmets with headlamps."
  },
  {
    "id": 2985,
    "base_form": "rock climbing",
    "meaning_fa": "صخره نوردی",
    "sentence_en": "She went rock climbing outside and loved the views."
  },
  {
    "id": 2984,
    "base_form": "paragliding",
    "meaning_fa": "پاراگلایدر",
    "sentence_en": "They went paragliding over the coast and filmed it."
  },
  {
    "id": 2983,
    "base_form": "snowboarding",
    "meaning_fa": "اسنوبورد",
    "sentence_en": "He loves snowboarding, but he hates the icy days."
  },
  {
    "id": 2982,
    "base_form": "snow skiing",
    "meaning_fa": "اسکی روی برف",
    "sentence_en": "She tried snow skiing for the first time last winter."
  },
  {
    "id": 2981,
    "base_form": "skiing",
    "meaning_fa": "اسکی",
    "sentence_en": "We planned a skiing trip as soon as it snowed."
  },
  {
    "id": 2980,
    "base_form": "scootering",
    "meaning_fa": "اسکوترسواری",
    "sentence_en": "The kids were scootering down the sidewalk after school."
  },
  {
    "id": 2979,
    "base_form": "skateboarding",
    "meaning_fa": "اسکیت بورد",
    "sentence_en": "He practices skateboarding in the park near my place."
  },
  {
    "id": 2978,
    "base_form": "skating",
    "meaning_fa": "اسکیت",
    "sentence_en": "We went skating and rented skates at the rink."
  },
  {
    "id": 2977,
    "base_form": "cycling",
    "meaning_fa": "دوچرخه سواری",
    "sentence_en": "She got into cycling and rides with a group."
  },
  {
    "id": 2976,
    "base_form": "jet skiing",
    "meaning_fa": "جت اسکی",
    "sentence_en": "He went jet skiing and came back soaked."
  },
  {
    "id": 2975,
    "base_form": "kayaking",
    "meaning_fa": "قایق کایاک",
    "sentence_en": "I went kayaking at sunrise and it was peaceful."
  },
  {
    "id": 2974,
    "base_form": "canoeing",
    "meaning_fa": "قایق کانو",
    "sentence_en": "They went canoeing down the river with friends."
  },
  {
    "id": 2973,
    "base_form": "boating",
    "meaning_fa": "قایق رانی",
    "sentence_en": "We went boating on the lake and grilled after."
  },
  {
    "id": 2972,
    "base_form": "kitesurfing",
    "meaning_fa": "کایت سواری",
    "sentence_en": "She loves kitesurfing when the wind is strong."
  },
  {
    "id": 2971,
    "base_form": "surfing",
    "meaning_fa": "موج سواری",
    "sentence_en": "We tried surfing, but the waves were too small."
  },
  {
    "id": 2970,
    "base_form": "diving",
    "meaning_fa": "غواصی",
    "sentence_en": "He signed up for diving lessons before the trip."
  },
  {
    "id": 2969,
    "base_form": "crawl",
    "meaning_fa": "شنا کرال",
    "sentence_en": "He practiced the crawl in the lane closest to the wall."
  },
  {
    "id": 2968,
    "base_form": "swimming",
    "meaning_fa": "شنا",
    "sentence_en": "We went swimming at the pool after work."
  },
  {
    "id": 2967,
    "base_form": "gymnastics",
    "meaning_fa": "ژیمناستیک",
    "sentence_en": "My niece does gymnastics and loves the balance beam."
  },
  {
    "id": 2966,
    "base_form": "Pilates",
    "meaning_fa": "پیلاتس",
    "sentence_en": "He started Pilates for his core and posture."
  },
  {
    "id": 2965,
    "base_form": "yoga",
    "meaning_fa": "یوگا",
    "sentence_en": "She does yoga in the morning to loosen up."
  },
  {
    "id": 2964,
    "base_form": "CrossFit",
    "meaning_fa": "کراس فیت",
    "sentence_en": "I tried CrossFit once, and I was sore for days."
  },
  {
    "id": 2963,
    "base_form": "fitness",
    "meaning_fa": "فیتنس",
    "sentence_en": "She focuses on fitness, not the number on the scale."
  },
  {
    "id": 2962,
    "base_form": "bodybuilding",
    "meaning_fa": "بدنسازی",
    "sentence_en": "He's into bodybuilding and tracks every meal."
  },
  {
    "id": 2961,
    "base_form": "rock climbing",
    "meaning_fa": "سنگ نوردی",
    "sentence_en": "We went rock climbing indoors because it was freezing."
  },
  {
    "id": 2960,
    "base_form": "mountaineering",
    "meaning_fa": "کوهنوردی",
    "sentence_en": "He got into mountaineering and bought gear for the cold."
  },
  {
    "id": 2959,
    "base_form": "walking",
    "meaning_fa": "پیاده روی",
    "sentence_en": "We went walking after dinner to clear our heads."
  },
  {
    "id": 2958,
    "base_form": "marathon",
    "meaning_fa": "دو ماراتن",
    "sentence_en": "She's training for a marathon in October."
  },
  {
    "id": 2957,
    "base_form": "sprint",
    "meaning_fa": "دو سرعت",
    "sentence_en": "He trained to sprint faster for track season."
  },
  {
    "id": 2956,
    "base_form": "running",
    "meaning_fa": "دو",
    "sentence_en": "I go running before breakfast when the streets are empty."
  },
  {
    "id": 2955,
    "base_form": "aikido",
    "meaning_fa": "آیکیدو",
    "sentence_en": "She likes aikido because it's focused on control."
  },
  {
    "id": 2954,
    "base_form": "kendo",
    "meaning_fa": "کندو",
    "sentence_en": "He practices kendo at a dojo across town."
  },
  {
    "id": 2953,
    "base_form": "wrestling",
    "meaning_fa": "کشتی",
    "sentence_en": "My brother did wrestling in high school and loved it."
  },
  {
    "id": 2952,
    "base_form": "kickboxing",
    "meaning_fa": "کیک بوکسینگ",
    "sentence_en": "He joined kickboxing for cardio and stress relief."
  },
  {
    "id": 2951,
    "base_form": "boxing",
    "meaning_fa": "بوکس",
    "sentence_en": "She does boxing workouts to blow off steam."
  },
  {
    "id": 2950,
    "base_form": "judo",
    "meaning_fa": "جودو",
    "sentence_en": "He tried judo once and got thrown immediately."
  },
  {
    "id": 2949,
    "base_form": "taekwondo",
    "meaning_fa": "تکواندو",
    "sentence_en": "She earned her next belt in taekwondo last month."
  },
  {
    "id": 2948,
    "base_form": "karate",
    "meaning_fa": "کاراته",
    "sentence_en": "He signed up for karate classes with his daughter."
  },
  {
    "id": 2947,
    "base_form": "racquetball",
    "meaning_fa": "راکِت بال",
    "sentence_en": "We played racquetball and my legs were sore after."
  },
  {
    "id": 2946,
    "base_form": "squash",
    "meaning_fa": "اسکواش",
    "sentence_en": "He started squash to get a tougher workout."
  },
  {
    "id": 2945,
    "base_form": "badminton",
    "meaning_fa": "بدمینتون",
    "sentence_en": "She plays badminton with her neighbors in the driveway."
  },
  {
    "id": 2944,
    "base_form": "ping-pong",
    "meaning_fa": "پینگ پنگ",
    "sentence_en": "We played ping-pong while the pizza was in the oven."
  },
  {
    "id": 2943,
    "base_form": "table tennis",
    "meaning_fa": "تنیس روی میز",
    "sentence_en": "They set up table tennis in the break room."
  },
  {
    "id": 2942,
    "base_form": "tennis",
    "meaning_fa": "تنیس",
    "sentence_en": "We booked a court to play tennis after work."
  },
  {
    "id": 2941,
    "base_form": "water polo",
    "meaning_fa": "واترپلو",
    "sentence_en": "My cousin plays water polo, and he's insanely fit."
  },
  {
    "id": 2939,
    "base_form": "golf",
    "meaning_fa": "گلف",
    "sentence_en": "She plays golf early on Saturdays when it's quiet."
  },
  {
    "id": 2938,
    "base_form": "cricket",
    "meaning_fa": "کریکت",
    "sentence_en": "He explained cricket to me during the match."
  },
  {
    "id": 2937,
    "base_form": "softball",
    "meaning_fa": "سافتبال",
    "sentence_en": "Our office team plays softball on Thursday nights."
  },
  {
    "id": 2936,
    "base_form": "baseball",
    "meaning_fa": "بیسبال",
    "sentence_en": "We watched baseball and ate hot dogs at the stadium."
  },
  {
    "id": 2935,
    "base_form": "rugby",
    "meaning_fa": "راگبی",
    "sentence_en": "He got into rugby after moving to a new city."
  },
  {
    "id": 2934,
    "base_form": "handball",
    "meaning_fa": "هندبال",
    "sentence_en": "She learned handball in college and still plays sometimes."
  },
  {
    "id": 2933,
    "base_form": "beach volleyball",
    "meaning_fa": "والیبال ساحلی",
    "sentence_en": "We joined a beach volleyball game near the pier."
  },
  {
    "id": 2932,
    "base_form": "volleyball",
    "meaning_fa": "والیبال",
    "sentence_en": "They play volleyball at the beach every Sunday."
  },
  {
    "id": 2931,
    "base_form": "basketball",
    "meaning_fa": "بسکتبال",
    "sentence_en": "He plays basketball on weekends at the community center."
  },
  {
    "id": 2930,
    "base_form": "futsal",
    "meaning_fa": "فوتسال",
    "sentence_en": "We played futsal in the gym because it was raining."
  },
  {
    "id": 2929,
    "base_form": "soccer",
    "meaning_fa": "فوتبال",
    "sentence_en": "My kids play soccer in the park after school."
  },
  {
    "id": 2928,
    "base_form": "infusion",
    "meaning_fa": "دمنوش",
    "sentence_en": "The cafe offered a chamomile infusion instead of tea."
  },
  {
    "id": 2927,
    "base_form": "herbal tea",
    "meaning_fa": "چای گیاهی",
    "sentence_en": "She drinks herbal tea before bed to relax."
  },
  {
    "id": 2926,
    "base_form": "sparkling water",
    "meaning_fa": "آب گازدار",
    "sentence_en": "I like sparkling water with lemon."
  },
  {
    "id": 2925,
    "base_form": "soft drink",
    "meaning_fa": "نوشابه گازدار",
    "sentence_en": "They only serve soft drinks and coffee at this cafe."
  },
  {
    "id": 2924,
    "base_form": "soda",
    "meaning_fa": "نوشابه",
    "sentence_en": "He opened a soda and took a long sip."
  },
  {
    "id": 2923,
    "base_form": "milkshake",
    "meaning_fa": "میلک شیک",
    "sentence_en": "We split a milkshake at the diner."
  },
  {
    "id": 2922,
    "base_form": "smoothie",
    "meaning_fa": "اسموتی",
    "sentence_en": "She made a smoothie with banana and peanut butter."
  },
  {
    "id": 2921,
    "base_form": "juice",
    "meaning_fa": "آبمیوه",
    "sentence_en": "I poured orange juice into a glass."
  },
  {
    "id": 2920,
    "base_form": "yogurt drink",
    "meaning_fa": "دوغ",
    "sentence_en": "We had yogurt drink with kebab at lunch."
  },
  {
    "id": 2919,
    "base_form": "chocolate milk",
    "meaning_fa": "شیر کاکائو",
    "sentence_en": "He bought chocolate milk after practice."
  },
  {
    "id": 2918,
    "base_form": "milk",
    "meaning_fa": "شیر",
    "sentence_en": "The kids drank milk with their cookies."
  },
  {
    "id": 2917,
    "base_form": "latte",
    "meaning_fa": "قهوه لاته",
    "sentence_en": "She ordered a latte with oat milk."
  },
  {
    "id": 2916,
    "base_form": "espresso",
    "meaning_fa": "قهوه اسپرسو",
    "sentence_en": "I grabbed an espresso before my morning meeting."
  },
  {
    "id": 2915,
    "base_form": "coffee",
    "meaning_fa": "قهوه",
    "sentence_en": "He can't start the day without coffee."
  },
  {
    "id": 2914,
    "base_form": "mineral water",
    "meaning_fa": "آب معدنی",
    "sentence_en": "She ordered mineral water instead of soda."
  },
  {
    "id": 2913,
    "base_form": "jelly",
    "meaning_fa": "ژله",
    "sentence_en": "The kids ate jelly cups for dessert."
  },
  {
    "id": 2912,
    "base_form": "pudding",
    "meaning_fa": "پودینگ",
    "sentence_en": "She made pudding and chilled it in the fridge."
  },
  {
    "id": 2911,
    "base_form": "dessert",
    "meaning_fa": "دسر",
    "sentence_en": "We had dessert after dinner, even though we were full."
  },
  {
    "id": 2910,
    "base_form": "cutlet",
    "meaning_fa": "کتلت",
    "sentence_en": "He ordered a cutlet sandwich on his lunch break."
  },
  {
    "id": 2909,
    "base_form": "cutlet",
    "meaning_fa": "کوکو",
    "sentence_en": "She made cutlets and served them with pickles."
  },
  {
    "id": 2908,
    "base_form": "grilled chicken",
    "meaning_fa": "جوجه کباب",
    "sentence_en": "He meal-prepped grilled chicken for the week."
  },
  {
    "id": 2907,
    "base_form": "kebab",
    "meaning_fa": "کباب",
    "sentence_en": "We grabbed kebab from the spot near the metro."
  },
  {
    "id": 2906,
    "base_form": "mixed rice",
    "meaning_fa": "پلو مخلوط",
    "sentence_en": "They served mixed rice with chicken and dried fruit."
  },
  {
    "id": 2905,
    "base_form": "noodles",
    "meaning_fa": "نودل",
    "sentence_en": "I made noodles with soy sauce and scallions."
  },
  {
    "id": 2904,
    "base_form": "lasagna",
    "meaning_fa": "لازانیا",
    "sentence_en": "His lasagna takes hours, but it's worth it."
  },
  {
    "id": 2903,
    "base_form": "pasta",
    "meaning_fa": "ماکارونی",
    "sentence_en": "We cooked pasta and ate on the balcony."
  },
  {
    "id": 2902,
    "base_form": "fruit salad",
    "meaning_fa": "سالاد میوه",
    "sentence_en": "She brought fruit salad to the picnic."
  },
  {
    "id": 2901,
    "base_form": "salad",
    "meaning_fa": "سالاد",
    "sentence_en": "I ordered a salad because I wanted something light."
  },
  {
    "id": 2900,
    "base_form": "boiled egg",
    "meaning_fa": "تخم مرغ آب پز",
    "sentence_en": "She packed a boiled egg for a quick snack."
  },
  {
    "id": 2899,
    "base_form": "fried egg",
    "meaning_fa": "نیمرو",
    "sentence_en": "He likes a fried egg on top of his rice."
  },
  {
    "id": 2898,
    "base_form": "omelet",
    "meaning_fa": "املت",
    "sentence_en": "I made an omelet with spinach and feta."
  },
  {
    "id": 2897,
    "base_form": "stew",
    "meaning_fa": "خورشت",
    "sentence_en": "The stew smelled amazing while it simmered all afternoon."
  },
  {
    "id": 2896,
    "base_form": "thick soup",
    "meaning_fa": "آش",
    "sentence_en": "She made thick soup with beans and herbs for dinner."
  },
  {
    "id": 2895,
    "base_form": "soup",
    "meaning_fa": "سوپ",
    "sentence_en": "I heated soup when I got home late."
  },
  {
    "id": 2894,
    "base_form": "hot dog",
    "meaning_fa": "هات داگ",
    "sentence_en": "The kids asked for hot dogs after the baseball game."
  },
  {
    "id": 2893,
    "base_form": "hamburger",
    "meaning_fa": "همبرگر",
    "sentence_en": "He grilled a hamburger and added extra pickles."
  },
  {
    "id": 2892,
    "base_form": "sandwich",
    "meaning_fa": "ساندویچ",
    "sentence_en": "I packed a sandwich for the drive."
  },
  {
    "id": 2891,
    "base_form": "pizza",
    "meaning_fa": "پیتزا",
    "sentence_en": "We ordered pizza and watched the game at home."
  },
  {
    "id": 2890,
    "base_form": "biscuit",
    "meaning_fa": "بیسکویت",
    "sentence_en": "She served biscuits with honey and fried chicken."
  },
  {
    "id": 2889,
    "base_form": "cookie",
    "meaning_fa": "کلوچه",
    "sentence_en": "He ate a warm cookie right out of the oven."
  },
  {
    "id": 2888,
    "base_form": "cake",
    "meaning_fa": "کیک",
    "sentence_en": "They brought cake to the office for her birthday."
  },
  {
    "id": 2887,
    "base_form": "pilaf",
    "meaning_fa": "پلو",
    "sentence_en": "Her mom makes pilaf with carrots and raisins."
  },
  {
    "id": 2886,
    "base_form": "steamed rice",
    "meaning_fa": "چلو",
    "sentence_en": "He ordered steamed rice with the spicy curry."
  },
  {
    "id": 2885,
    "base_form": "rice",
    "meaning_fa": "برنج",
    "sentence_en": "We had rice with grilled fish for dinner."
  },
  {
    "id": 2884,
    "base_form": "toast",
    "meaning_fa": "نان تست",
    "sentence_en": "She made toast and jam for a quick breakfast."
  },
  {
    "id": 2883,
    "base_form": "bread",
    "meaning_fa": "نان",
    "sentence_en": "I picked up fresh bread on my way home."
  },
  {
    "id": 2882,
    "base_form": "eco-lodge",
    "meaning_fa": "اقامتگاه بوم گردی",
    "sentence_en": "We stayed at an eco-lodge surrounded by rainforest."
  },
  {
    "id": 2881,
    "base_form": "hostel",
    "meaning_fa": "هاستل",
    "sentence_en": "He saved money by staying in a hostel downtown."
  },
  {
    "id": 2880,
    "base_form": "inn",
    "meaning_fa": "مسافرخانه",
    "sentence_en": "The inn served breakfast and had a fireplace in the lobby."
  },
  {
    "id": 2879,
    "base_form": "guesthouse",
    "meaning_fa": "مهمان پذیر",
    "sentence_en": "We stayed in a cozy guesthouse run by a local family."
  },
  {
    "id": 2878,
    "base_form": "hotel",
    "meaning_fa": "هتل",
    "sentence_en": "We booked a hotel near the airport for one night."
  },
  {
    "id": 2877,
    "base_form": "museum",
    "meaning_fa": "موزه",
    "sentence_en": "The museum had a new exhibit on space travel."
  },
  {
    "id": 2876,
    "base_form": "zoo",
    "meaning_fa": "باغ وحش",
    "sentence_en": "My nephew wanted to see the lions at the zoo."
  },
  {
    "id": 2875,
    "base_form": "amusement park",
    "meaning_fa": "شهربازی",
    "sentence_en": "We spent all day at the amusement park."
  },
  {
    "id": 2874,
    "base_form": "stadium",
    "meaning_fa": "ورزشگاه",
    "sentence_en": "The stadium was loud when the home team scored."
  },
  {
    "id": 2873,
    "base_form": "gym",
    "meaning_fa": "باشگاه ورزشی",
    "sentence_en": "I go to the gym before work three days a week."
  },
  {
    "id": 2872,
    "base_form": "club",
    "meaning_fa": "باشگاه",
    "sentence_en": "They met at a club that plays old-school hip-hop."
  },
  {
    "id": 2871,
    "base_form": "concert",
    "meaning_fa": "کنسرت",
    "sentence_en": "We bought tickets for the concert months in advance."
  },
  {
    "id": 2870,
    "base_form": "theater",
    "meaning_fa": "تئاتر",
    "sentence_en": "We saw a play at the theater downtown."
  },
  {
    "id": 2869,
    "base_form": "cinema",
    "meaning_fa": "سینما",
    "sentence_en": "Let's go to the cinema after dinner on Friday."
  },
  {
    "id": 2868,
    "base_form": "plant",
    "meaning_fa": "کارخانه",
    "sentence_en": "They opened a new plant to assemble electric motors."
  },
  {
    "id": 2867,
    "base_form": "power plant",
    "meaning_fa": "نیروگاه",
    "sentence_en": "A power plant supplies electricity to the whole region."
  },
  {
    "id": 2866,
    "base_form": "refinery",
    "meaning_fa": "پالایشگاه",
    "sentence_en": "The refinery runs day and night outside town."
  },
  {
    "id": 2865,
    "base_form": "warehouse shed",
    "meaning_fa": "سوله",
    "sentence_en": "They stored the lumber in a warehouse shed out back."
  },
  {
    "id": 2864,
    "base_form": "workshop",
    "meaning_fa": "کارگاه",
    "sentence_en": "He spent Saturday in the workshop fixing his bike."
  },
  {
    "id": 2863,
    "base_form": "dock",
    "meaning_fa": "اسکله",
    "sentence_en": "We tied the boat to the dock behind the restaurant."
  },
  {
    "id": 2862,
    "base_form": "port",
    "meaning_fa": "بندر",
    "sentence_en": "The ship docked at the port just before sunrise."
  },
  {
    "id": 2861,
    "base_form": "airport",
    "meaning_fa": "فرودگاه",
    "sentence_en": "We got to the airport early to avoid long lines."
  },
  {
    "id": 2860,
    "base_form": "terminal",
    "meaning_fa": "پایانه",
    "sentence_en": "Our flight leaves from Terminal B, so let's hurry."
  },
  {
    "id": 2859,
    "base_form": "bus stop",
    "meaning_fa": "ایستگاه اتوبوس",
    "sentence_en": "The bus stop is across the street from the pharmacy."
  },
  {
    "id": 2858,
    "base_form": "station",
    "meaning_fa": "ایستگاه",
    "sentence_en": "I'll meet you at the station near the courthouse."
  },
  {
    "id": 2857,
    "base_form": "signal light",
    "meaning_fa": "چراغ راهنما",
    "sentence_en": "His signal light is out, so he needs a new bulb."
  },
  {
    "id": 2856,
    "base_form": "streetlight",
    "meaning_fa": "چراغ خیابان",
    "sentence_en": "The streetlight outside flickered all night."
  },
  {
    "id": 2855,
    "base_form": "speed bump",
    "meaning_fa": "سرعت گیر",
    "sentence_en": "Slow down; there's a speed bump ahead."
  },
  {
    "id": 2854,
    "base_form": "crosswalk",
    "meaning_fa": "خط عابر پیاده",
    "sentence_en": "She waited at the crosswalk before stepping out."
  },
  {
    "id": 2853,
    "base_form": "pedestrian crossing sign",
    "meaning_fa": "تابلو عبور عابر پیاده",
    "sentence_en": "A pedestrian crossing sign warned drivers near the school."
  },
  {
    "id": 2852,
    "base_form": "stop sign",
    "meaning_fa": "تابلو ایست",
    "sentence_en": "He rolled past the stop sign and got honked at."
  },
  {
    "id": 2851,
    "base_form": "road sign",
    "meaning_fa": "تابلو راهنمایی",
    "sentence_en": "The road sign said the exit was two miles."
  },
  {
    "id": 2850,
    "base_form": "traffic light",
    "meaning_fa": "چراغ راهنمایی",
    "sentence_en": "The traffic light turned yellow, so he braked."
  },
  {
    "id": 2849,
    "base_form": "warning light",
    "meaning_fa": "چراغ هشدار",
    "sentence_en": "The warning light kept blinking on the dashboard."
  },
  {
    "id": 2848,
    "base_form": "warning signboard",
    "meaning_fa": "تابلو هشدار",
    "sentence_en": "A warning signboard told drivers to slow down."
  },
  {
    "id": 2847,
    "base_form": "safety barrier",
    "meaning_fa": "مانع ایمنی",
    "sentence_en": "They moved the safety barrier to reopen the lane."
  },
  {
    "id": 2846,
    "base_form": "traffic cone",
    "meaning_fa": "مخروط ایمنی",
    "sentence_en": "A traffic cone blocked off the wet cement."
  },
  {
    "id": 2845,
    "base_form": "vest",
    "meaning_fa": "جلیقه",
    "sentence_en": "He wore a vest over his dress shirt."
  },
  {
    "id": 2844,
    "base_form": "ear protection",
    "meaning_fa": "گوشی صداگیر",
    "sentence_en": "Use ear protection when the drill is running."
  },
  {
    "id": 2843,
    "base_form": "face shield",
    "meaning_fa": "محافظ صورت",
    "sentence_en": "He lowered his face shield before grinding metal."
  },
  {
    "id": 2842,
    "base_form": "respirator",
    "meaning_fa": "ماسک تنفسی",
    "sentence_en": "He used a respirator while sanding the old paint."
  },
  {
    "id": 2841,
    "base_form": "safety goggles",
    "meaning_fa": "عینک ایمنی",
    "sentence_en": "She wore safety goggles while cutting the tile."
  },
  {
    "id": 2840,
    "base_form": "safety gloves",
    "meaning_fa": "دستکش ایمنی",
    "sentence_en": "He put on safety gloves before handling chemicals."
  },
  {
    "id": 2839,
    "base_form": "hard hat",
    "meaning_fa": "کلاه ایمنی ساختمانی",
    "sentence_en": "Everyone wore a hard hat on the construction site."
  },
  {
    "id": 2838,
    "base_form": "splint",
    "meaning_fa": "آتل",
    "sentence_en": "The EMT secured a splint before moving his arm."
  },
  {
    "id": 2837,
    "base_form": "elastic bandage",
    "meaning_fa": "باند کشی",
    "sentence_en": "He wrapped an elastic bandage around his wrist."
  },
  {
    "id": 2836,
    "base_form": "hot water bottle",
    "meaning_fa": "کیسه آب گرم",
    "sentence_en": "She used a hot water bottle for her cramps."
  },
  {
    "id": 2835,
    "base_form": "ice pack",
    "meaning_fa": "کیسه یخ",
    "sentence_en": "He put an ice pack on his swollen knee."
  },
  {
    "id": 2834,
    "base_form": "first aid kit",
    "meaning_fa": "جعبه کمک های اولیه",
    "sentence_en": "Keep a first aid kit in your car."
  },
  {
    "id": 2833,
    "base_form": "stethoscope",
    "meaning_fa": "گوشی پزشکی",
    "sentence_en": "The doctor listened with a stethoscope and nodded."
  },
  {
    "id": 2832,
    "base_form": "tweezers",
    "meaning_fa": "پنس",
    "sentence_en": "The nurse used tweezers to remove the tiny piece."
  },
  {
    "id": 2831,
    "base_form": "antiseptic solution",
    "meaning_fa": "بتادین",
    "sentence_en": "He dabbed antiseptic solution on the scrape."
  },
  {
    "id": 2830,
    "base_form": "alcohol",
    "meaning_fa": "الکل",
    "sentence_en": "She cleaned the thermometer with alcohol before using it."
  },
  {
    "id": 2829,
    "base_form": "mask",
    "meaning_fa": "ماسک",
    "sentence_en": "He wore a mask on the subway during flu season."
  },
  {
    "id": 2828,
    "base_form": "blood pressure monitor",
    "meaning_fa": "فشارسنج",
    "sentence_en": "He used a blood pressure monitor every morning."
  },
  {
    "id": 2827,
    "base_form": "syrup",
    "meaning_fa": "شربت",
    "sentence_en": "The cough syrup tasted sweet but worked fast."
  },
  {
    "id": 2826,
    "base_form": "capsule",
    "meaning_fa": "کپسول",
    "sentence_en": "She swallowed the capsule and chased it with juice."
  },
  {
    "id": 2825,
    "base_form": "pill",
    "meaning_fa": "قرص",
    "sentence_en": "He took a pill with a glass of water."
  },
  {
    "id": 2824,
    "base_form": "ampoule",
    "meaning_fa": "آمپول",
    "sentence_en": "The pharmacist showed me the ampoule before opening it."
  },
  {
    "id": 2823,
    "base_form": "needle",
    "meaning_fa": "سوزن",
    "sentence_en": "He hates needles, so he looked away."
  },
  {
    "id": 2822,
    "base_form": "syringe",
    "meaning_fa": "سرنگ",
    "sentence_en": "The nurse filled a syringe and checked the label."
  },
  {
    "id": 2821,
    "base_form": "gauze",
    "meaning_fa": "گاز استریل",
    "sentence_en": "The nurse covered the wound with sterile gauze."
  },
  {
    "id": 2820,
    "base_form": "adhesive bandage",
    "meaning_fa": "چسب زخم",
    "sentence_en": "She put an adhesive bandage on the cut."
  },
  {
    "id": 2819,
    "base_form": "bandage",
    "meaning_fa": "باند",
    "sentence_en": "He wrapped a bandage around his ankle."
  },
  {
    "id": 2818,
    "base_form": "tissue",
    "meaning_fa": "دستمال",
    "sentence_en": "She handed me a tissue during the movie."
  },
  {
    "id": 2817,
    "base_form": "soap dispenser",
    "meaning_fa": "پمپ صابون",
    "sentence_en": "The soap dispenser is clogged again."
  },
  {
    "id": 2816,
    "base_form": "container",
    "meaning_fa": "قوطی",
    "sentence_en": "Put the leftovers in a container with a lid."
  },
  {
    "id": 2815,
    "base_form": "tweezers",
    "meaning_fa": "موچین",
    "sentence_en": "I used tweezers to pull out a splinter."
  },
  {
    "id": 2814,
    "base_form": "nail file",
    "meaning_fa": "سوهان ناخن",
    "sentence_en": "She used a nail file to smooth a rough edge."
  },
  {
    "id": 2813,
    "base_form": "nail clipper",
    "meaning_fa": "ناخن گیر",
    "sentence_en": "I keep a nail clipper in my travel bag."
  },
  {
    "id": 2812,
    "base_form": "hair trimmer",
    "meaning_fa": "ماشین اصلاح",
    "sentence_en": "He used a hair trimmer to clean up the sides."
  },
  {
    "id": 2811,
    "base_form": "razor",
    "meaning_fa": "تیغ",
    "sentence_en": "He nicked his chin with a razor."
  },
  {
    "id": 2810,
    "base_form": "foundation",
    "meaning_fa": "کرم پودر",
    "sentence_en": "This foundation matches my skin tone perfectly."
  },
  {
    "id": 2809,
    "base_form": "face powder",
    "meaning_fa": "پنکیک",
    "sentence_en": "She used face powder to reduce shine."
  },
  {
    "id": 2808,
    "base_form": "nail polish",
    "meaning_fa": "لاک ناخن",
    "sentence_en": "Her nail polish chipped the next day."
  },
  {
    "id": 2807,
    "base_form": "eyeshadow",
    "meaning_fa": "سایه چشم",
    "sentence_en": "He bought eyeshadow for a costume party."
  },
  {
    "id": 2806,
    "base_form": "mascara",
    "meaning_fa": "ریمل",
    "sentence_en": "She put on mascara before the video call."
  },
  {
    "id": 2805,
    "base_form": "lipstick",
    "meaning_fa": "رژ لب",
    "sentence_en": "She reapplied lipstick in the car mirror."
  },
  {
    "id": 2804,
    "base_form": "cologne",
    "meaning_fa": "ادکلن",
    "sentence_en": "He put on cologne before going out to dinner."
  },
  {
    "id": 2803,
    "base_form": "perfume",
    "meaning_fa": "عطر",
    "sentence_en": "Her perfume was light, not overwhelming."
  },
  {
    "id": 2802,
    "base_form": "lotion",
    "meaning_fa": "لوسیون",
    "sentence_en": "This lotion smells nice and isn't greasy."
  },
  {
    "id": 2801,
    "base_form": "cream",
    "meaning_fa": "کرم",
    "sentence_en": "She put cream on her hands before bed."
  },
  {
    "id": 2800,
    "base_form": "toilet paper",
    "meaning_fa": "دستمال توالت",
    "sentence_en": "We ran out of toilet paper at the worst time."
  },
  {
    "id": 2799,
    "base_form": "tissue",
    "meaning_fa": "دستمال کاغذی",
    "sentence_en": "He grabbed a tissue and wiped his nose."
  },
  {
    "id": 2798,
    "base_form": "hand towel",
    "meaning_fa": "حوله دستی",
    "sentence_en": "Please use the hand towel by the sink."
  },
  {
    "id": 2797,
    "base_form": "tower",
    "meaning_fa": "دکل",
    "sentence_en": "You can see the tower from miles away."
  },
  {
    "id": 2796,
    "base_form": "pole",
    "meaning_fa": "ستون",
    "sentence_en": "A streetlight pole was leaning after the storm."
  },
  {
    "id": 2795,
    "base_form": "guardrail",
    "meaning_fa": "نرده خیابان",
    "sentence_en": "The car scraped the guardrail and left a long mark."
  },
  {
    "id": 2794,
    "base_form": "bridge",
    "meaning_fa": "پل",
    "sentence_en": "Traffic backed up as we crossed the bridge."
  },
  {
    "id": 2793,
    "base_form": "fountain",
    "meaning_fa": "آبخوری",
    "sentence_en": "The kids lined up at the fountain for water."
  },
  {
    "id": 2792,
    "base_form": "recycling bin",
    "meaning_fa": "سطل بازیافت",
    "sentence_en": "Put the bottles in the recycling bin, not trash."
  },
  {
    "id": 2791,
    "base_form": "towel",
    "meaning_fa": "حوله",
    "sentence_en": "I grabbed a towel and dried my hands."
  },
  {
    "id": 2790,
    "base_form": "mouthwash",
    "meaning_fa": "دهان شویه",
    "sentence_en": "She swished mouthwash for thirty seconds and spit it out."
  },
  {
    "id": 2789,
    "base_form": "dental floss",
    "meaning_fa": "نخ دندان",
    "sentence_en": "He keeps dental floss in his desk at work."
  },
  {
    "id": 2788,
    "base_form": "hair conditioner",
    "meaning_fa": "نرم کننده مو",
    "sentence_en": "I leave the hair conditioner in for two minutes."
  },
  {
    "id": 2787,
    "base_form": "shampoo",
    "meaning_fa": "شامپو",
    "sentence_en": "This shampoo makes my hair feel really clean."
  },
  {
    "id": 2786,
    "base_form": "liquid soap",
    "meaning_fa": "مایع دستشویی",
    "sentence_en": "The liquid soap ran out, so I refilled it."
  },
  {
    "id": 2785,
    "base_form": "soap",
    "meaning_fa": "صابون",
    "sentence_en": "I washed my hands with soap and warm water."
  },
  {
    "id": 2784,
    "base_form": "false ceiling",
    "meaning_fa": "سقف کاذب",
    "sentence_en": "They hid the wiring behind a false ceiling."
  },
  {
    "id": 2783,
    "base_form": "baseboard",
    "meaning_fa": "قرنیز",
    "sentence_en": "The baseboard was scuffed when we moved the couch."
  },
  {
    "id": 2782,
    "base_form": "wall light",
    "meaning_fa": "دیوارکوب",
    "sentence_en": "They installed a wall light by the mirror."
  },
  {
    "id": 2781,
    "base_form": "ceiling light",
    "meaning_fa": "چراغ سقفی",
    "sentence_en": "The ceiling light flickers when it's windy."
  },
  {
    "id": 2780,
    "base_form": "power outlet",
    "meaning_fa": "پریز برق",
    "sentence_en": "There's a power outlet next to the nightstand."
  },
  {
    "id": 2779,
    "base_form": "light switch",
    "meaning_fa": "کلید برق",
    "sentence_en": "The light switch is behind the door."
  },
  {
    "id": 2778,
    "base_form": "curtain rod",
    "meaning_fa": "میله پرده",
    "sentence_en": "The curtain rod fell when the screw popped out."
  },
  {
    "id": 2777,
    "base_form": "window frame",
    "meaning_fa": "قاب پنجره",
    "sentence_en": "The window frame is rotting from water damage."
  },
  {
    "id": 2776,
    "base_form": "threshold",
    "meaning_fa": "آستانه",
    "sentence_en": "He paused at the threshold before stepping inside."
  },
  {
    "id": 2775,
    "base_form": "edge",
    "meaning_fa": "لبه",
    "sentence_en": "She sat on the edge of the bed."
  },
  {
    "id": 2774,
    "base_form": "door",
    "meaning_fa": "درِ",
    "sentence_en": "He knocked on the door and waited quietly."
  },
  {
    "id": 2773,
    "base_form": "entrance",
    "meaning_fa": "ورودی",
    "sentence_en": "The entrance is around the side of the building."
  },
  {
    "id": 2772,
    "base_form": "corner",
    "meaning_fa": "گوشه",
    "sentence_en": "The cat hid in the corner during the fireworks."
  },
  {
    "id": 2771,
    "base_form": "room",
    "meaning_fa": "اتاق",
    "sentence_en": "This room gets a lot of afternoon sunlight."
  },
  {
    "id": 2770,
    "base_form": "storage room",
    "meaning_fa": "انباری",
    "sentence_en": "We keep extra chairs in the storage room."
  },
  {
    "id": 2769,
    "base_form": "parking area",
    "meaning_fa": "پارکینگ",
    "sentence_en": "Meet me in the parking area behind the store."
  },
  {
    "id": 2768,
    "base_form": "ramp",
    "meaning_fa": "رمپ",
    "sentence_en": "They built a ramp for wheelchair access."
  },
  {
    "id": 2767,
    "base_form": "entrance canopy",
    "meaning_fa": "سردر",
    "sentence_en": "The entrance canopy kept us dry in the rain."
  },
  {
    "id": 2766,
    "base_form": "facade",
    "meaning_fa": "نما",
    "sentence_en": "The facade was renovated to match the original design."
  },
  {
    "id": 2765,
    "base_form": "concrete",
    "meaning_fa": "بتن",
    "sentence_en": "The driveway is poured concrete, so it won't shift."
  },
  {
    "id": 2764,
    "base_form": "brick",
    "meaning_fa": "آجر",
    "sentence_en": "Their brick house stays cool in summer."
  },
  {
    "id": 2763,
    "base_form": "ceramic tile",
    "meaning_fa": "سرامیک",
    "sentence_en": "Ceramic tile is easy to wipe clean."
  },
  {
    "id": 2762,
    "base_form": "tile",
    "meaning_fa": "کاشی",
    "sentence_en": "One tile came loose in the shower."
  },
  {
    "id": 2761,
    "base_form": "flooring",
    "meaning_fa": "کف پوش",
    "sentence_en": "We picked vinyl flooring for the kitchen."
  },
  {
    "id": 2760,
    "base_form": "beam",
    "meaning_fa": "تیر",
    "sentence_en": "The beam cracked and the ceiling started sagging."
  },
  {
    "id": 2759,
    "base_form": "column",
    "meaning_fa": "ستون",
    "sentence_en": "A marble column stood at the entrance."
  },
  {
    "id": 2758,
    "base_form": "porch",
    "meaning_fa": "ایوان",
    "sentence_en": "He left the package on the front porch."
  },
  {
    "id": 2757,
    "base_form": "terrace",
    "meaning_fa": "تراس",
    "sentence_en": "They hosted dinner on the terrace at sunset."
  },
  {
    "id": 2756,
    "base_form": "balcony",
    "meaning_fa": "بالکن",
    "sentence_en": "We drank coffee on the balcony every morning."
  },
  {
    "id": 2755,
    "base_form": "stair railing",
    "meaning_fa": "نرده راه پله",
    "sentence_en": "The stair railing feels loose near the top."
  },
  {
    "id": 2754,
    "base_form": "railing",
    "meaning_fa": "نرده",
    "sentence_en": "He grabbed the railing as the bus stopped."
  },
  {
    "id": 2753,
    "base_form": "stairway",
    "meaning_fa": "راه پله",
    "sentence_en": "The stairway was blocked, so we used the elevator."
  },
  {
    "id": 2752,
    "base_form": "stairs",
    "meaning_fa": "پله کان",
    "sentence_en": "She ran up the stairs two at a time."
  },
  {
    "id": 2751,
    "base_form": "door frame",
    "meaning_fa": "چارچوب در",
    "sentence_en": "The door frame is cracked near the bottom."
  },
  {
    "id": 2750,
    "base_form": "roof",
    "meaning_fa": "سقف",
    "sentence_en": "The roof needs repairs after last night's storm."
  },
  {
    "id": 2749,
    "base_form": "ceiling",
    "meaning_fa": "سقف",
    "sentence_en": "A stain spread across the ceiling after the leak."
  },
  {
    "id": 2748,
    "base_form": "building",
    "meaning_fa": "ساختمان",
    "sentence_en": "That building used to be an old factory."
  },
  {
    "id": 2747,
    "base_form": "diesel",
    "meaning_fa": "گازوئیل",
    "sentence_en": "The generator runs on diesel during outages."
  },
  {
    "id": 2746,
    "base_form": "gasoline",
    "meaning_fa": "بنزین",
    "sentence_en": "Gasoline prices jumped again this week."
  },
  {
    "id": 2745,
    "base_form": "petroleum",
    "meaning_fa": "نفت",
    "sentence_en": "The country exports petroleum to fund its budget."
  },
  {
    "id": 2744,
    "base_form": "oil",
    "meaning_fa": "روغن",
    "sentence_en": "He checked the oil before the road trip."
  },
  {
    "id": 2743,
    "base_form": "crystal",
    "meaning_fa": "کریستال",
    "sentence_en": "Her crystal necklace sparkled under the lights."
  },
  {
    "id": 2742,
    "base_form": "glass",
    "meaning_fa": "شیشه",
    "sentence_en": "The glass cracked when it hit the tile floor."
  },
  {
    "id": 2741,
    "base_form": "silicone",
    "meaning_fa": "سیلیکون",
    "sentence_en": "Use silicone sealant around the sink to stop leaks."
  },
  {
    "id": 2740,
    "base_form": "fiberglass",
    "meaning_fa": "فایبرگلاس",
    "sentence_en": "They repaired the boat with fiberglass last weekend."
  },
  {
    "id": 2739,
    "base_form": "nylon",
    "meaning_fa": "نایلون",
    "sentence_en": "He packed a nylon jacket for the hike."
  },
  {
    "id": 2738,
    "base_form": "rubber",
    "meaning_fa": "لاستیک",
    "sentence_en": "The rubber sole kept me from slipping."
  },
  {
    "id": 2737,
    "base_form": "plastic",
    "meaning_fa": "پلاستیک",
    "sentence_en": "Please recycle the plastic bottle when you're done."
  },
  {
    "id": 2736,
    "base_form": "zinc",
    "meaning_fa": "روی",
    "sentence_en": "The roof has a zinc coating to prevent rust."
  },
  {
    "id": 2735,
    "base_form": "lead",
    "meaning_fa": "سرب",
    "sentence_en": "Old paint sometimes contained lead, so be careful."
  },
  {
    "id": 2734,
    "base_form": "gold",
    "meaning_fa": "طلا",
    "sentence_en": "He bought a gold chain for his anniversary."
  },
  {
    "id": 2733,
    "base_form": "silver",
    "meaning_fa": "نقره",
    "sentence_en": "She wears a silver ring every day."
  },
  {
    "id": 2732,
    "base_form": "bronze",
    "meaning_fa": "برنز",
    "sentence_en": "The bronze statue looked darker after the rain."
  },
  {
    "id": 2731,
    "base_form": "brass",
    "meaning_fa": "برنج (فلز)",
    "sentence_en": "The doorknob is brass, so it shines nicely."
  },
  {
    "id": 2730,
    "base_form": "copper",
    "meaning_fa": "مس",
    "sentence_en": "Copper pipes can turn green over time."
  },
  {
    "id": 2729,
    "base_form": "aluminum",
    "meaning_fa": "آلومینیوم",
    "sentence_en": "Aluminum foil is great for covering leftovers."
  },
  {
    "id": 2728,
    "base_form": "steel",
    "meaning_fa": "فولاد",
    "sentence_en": "The bridge is supported by thick steel beams."
  },
  {
    "id": 2727,
    "base_form": "iron",
    "meaning_fa": "آهن",
    "sentence_en": "The fence is made of iron and it's heavy."
  },
  {
    "id": 2726,
    "base_form": "yarn",
    "meaning_fa": "نخ",
    "sentence_en": "She bought yarn to knit a baby blanket."
  },
  {
    "id": 2725,
    "base_form": "silk",
    "meaning_fa": "ابریشم",
    "sentence_en": "She bought a silk blouse for the event."
  },
  {
    "id": 2724,
    "base_form": "fabric",
    "meaning_fa": "پارچه",
    "sentence_en": "This fabric feels soft against my skin."
  },
  {
    "id": 2723,
    "base_form": "linen",
    "meaning_fa": "کتان",
    "sentence_en": "He wore a linen shirt to the summer wedding."
  },
  {
    "id": 2722,
    "base_form": "cotton",
    "meaning_fa": "پنبه",
    "sentence_en": "I prefer cotton sheets in the summer."
  },
  {
    "id": 2721,
    "base_form": "bamboo",
    "meaning_fa": "بامبو",
    "sentence_en": "This cutting board is made from bamboo."
  },
  {
    "id": 2720,
    "base_form": "coal",
    "meaning_fa": "زغال سنگ",
    "sentence_en": "The museum displayed a chunk of coal from a mine."
  },
  {
    "id": 2719,
    "base_form": "gypsum",
    "meaning_fa": "گچ",
    "sentence_en": "They used gypsum to patch the damaged wall."
  },
  {
    "id": 2718,
    "base_form": "clay",
    "meaning_fa": "گل",
    "sentence_en": "She molded the clay into a small cup."
  },
  {
    "id": 2717,
    "base_form": "gravel",
    "meaning_fa": "شن",
    "sentence_en": "We spread gravel on the driveway to stop puddles."
  },
  {
    "id": 2716,
    "base_form": "dustpan",
    "meaning_fa": "خاک انداز",
    "sentence_en": "She used a dustpan to pick up the crumbs."
  },
  {
    "id": 2715,
    "base_form": "broom",
    "meaning_fa": "جارو",
    "sentence_en": "He swept the kitchen with a broom."
  },
  {
    "id": 2714,
    "base_form": "trash can",
    "meaning_fa": "سطل زباله",
    "sentence_en": "The trash can is full already."
  },
  {
    "id": 2713,
    "base_form": "trash",
    "meaning_fa": "زباله",
    "sentence_en": "Take the trash out before it starts smelling."
  },
  {
    "id": 2712,
    "base_form": "doormat",
    "meaning_fa": "پادری",
    "sentence_en": "Wipe your feet on the doormat."
  },
  {
    "id": 2711,
    "base_form": "coat rack",
    "meaning_fa": "چوب لباسی",
    "sentence_en": "Hang your jacket on the coat rack."
  },
  {
    "id": 2710,
    "base_form": "bedsheet",
    "meaning_fa": "ملحفه",
    "sentence_en": "He changed the bedsheet after spilling coffee."
  },
  {
    "id": 2709,
    "base_form": "blanket",
    "meaning_fa": "پتو",
    "sentence_en": "He pulled the blanket over his shoulders."
  },
  {
    "id": 2708,
    "base_form": "pillow",
    "meaning_fa": "بالش",
    "sentence_en": "I need a softer pillow for my neck."
  },
  {
    "id": 2707,
    "base_form": "lamp",
    "meaning_fa": "چراغ",
    "sentence_en": "Turn on the lamp; it's getting dark."
  },
  {
    "id": 2706,
    "base_form": "blinds",
    "meaning_fa": "کرکره",
    "sentence_en": "He tilted the blinds to let in light."
  },
  {
    "id": 2705,
    "base_form": "carpet",
    "meaning_fa": "موکت",
    "sentence_en": "We installed carpet in the kids’ room."
  },
  {
    "id": 2704,
    "base_form": "rug",
    "meaning_fa": "قالی",
    "sentence_en": "He shook out the rug on the porch."
  },
  {
    "id": 2703,
    "base_form": "bed",
    "meaning_fa": "تخت",
    "sentence_en": "He lay on the bed and scrolled his phone."
  },
  {
    "id": 2702,
    "base_form": "coffee table",
    "meaning_fa": "میز جلو مبلی",
    "sentence_en": "He set his coffee on the coffee table."
  },
  {
    "id": 2701,
    "base_form": "table",
    "meaning_fa": "میز",
    "sentence_en": "We ate dinner at the kitchen table."
  },
  {
    "id": 2700,
    "base_form": "surge protector",
    "meaning_fa": "محافظ برق",
    "sentence_en": "Use a surge protector for your computer."
  },
  {
    "id": 2699,
    "base_form": "power strip",
    "meaning_fa": "چندراهی برق",
    "sentence_en": "Plug the lamp into the power strip."
  },
  {
    "id": 2698,
    "base_form": "charger",
    "meaning_fa": "شارژر",
    "sentence_en": "I forgot my charger at the office."
  },
  {
    "id": 2697,
    "base_form": "fax",
    "meaning_fa": "فکس",
    "sentence_en": "They sent the form by fax yesterday."
  },
  {
    "id": 2696,
    "base_form": "photocopier",
    "meaning_fa": "دستگاه کپی",
    "sentence_en": "The photocopier jammed right before the meeting."
  },
  {
    "id": 2695,
    "base_form": "flashlight",
    "meaning_fa": "چراغ قوه",
    "sentence_en": "I grabbed a flashlight when the power went out."
  },
  {
    "id": 2694,
    "base_form": "shaver",
    "meaning_fa": "ریش تراش",
    "sentence_en": "His shaver died halfway through shaving."
  },
  {
    "id": 2693,
    "base_form": "hair dryer",
    "meaning_fa": "سشوار",
    "sentence_en": "She used a hair dryer before leaving."
  },
  {
    "id": 2692,
    "base_form": "mixer",
    "meaning_fa": "همزن",
    "sentence_en": "He used a mixer to whip the cream."
  },
  {
    "id": 2691,
    "base_form": "sewing machine",
    "meaning_fa": "چرخ خیاطی",
    "sentence_en": "She fixed the hem with her sewing machine."
  },
  {
    "id": 2690,
    "base_form": "iron",
    "meaning_fa": "اتو",
    "sentence_en": "He used an iron to smooth his shirt."
  },
  {
    "id": 2689,
    "base_form": "vacuum",
    "meaning_fa": "جاروبرقی",
    "sentence_en": "I need to vacuum the rug before guests arrive."
  },
  {
    "id": 2688,
    "base_form": "air conditioner",
    "meaning_fa": "کولر",
    "sentence_en": "The air conditioner isn't cooling the room."
  },
  {
    "id": 2687,
    "base_form": "heater",
    "meaning_fa": "بخاری",
    "sentence_en": "The heater stopped working last night."
  },
  {
    "id": 2686,
    "base_form": "fan",
    "meaning_fa": "پنکه",
    "sentence_en": "Turn on the fan; it’s getting hot."
  },
  {
    "id": 2685,
    "base_form": "scanner",
    "meaning_fa": "اسکنر",
    "sentence_en": "I used the scanner to digitize old photos."
  },
  {
    "id": 2684,
    "base_form": "printer",
    "meaning_fa": "پرینتر",
    "sentence_en": "The printer ran out of ink again."
  },
  {
    "id": 2683,
    "base_form": "mouse",
    "meaning_fa": "ماوس",
    "sentence_en": "I prefer a wireless mouse for my laptop."
  },
  {
    "id": 2682,
    "base_form": "keyboard",
    "meaning_fa": "کیبورد",
    "sentence_en": "My keyboard is sticky from spilled soda."
  },
  {
    "id": 2681,
    "base_form": "monitor",
    "meaning_fa": "مانیتور",
    "sentence_en": "I connected a second monitor for more space."
  },
  {
    "id": 2680,
    "base_form": "tablet",
    "meaning_fa": "تبلت",
    "sentence_en": "He reads the news on his tablet."
  },
  {
    "id": 2679,
    "base_form": "computer",
    "meaning_fa": "رایانه",
    "sentence_en": "My computer froze during the video call."
  },
  {
    "id": 2678,
    "base_form": "laptop",
    "meaning_fa": "لپ تاپ",
    "sentence_en": "She brought her laptop to the coffee shop."
  },
  {
    "id": 2677,
    "base_form": "projector",
    "meaning_fa": "ویدئو پروژکتور",
    "sentence_en": "We set up a projector for movie night."
  },
  {
    "id": 2676,
    "base_form": "speaker",
    "meaning_fa": "اسپیکر",
    "sentence_en": "This speaker is loud enough for the backyard."
  },
  {
    "id": 2675,
    "base_form": "radio",
    "meaning_fa": "رادیو",
    "sentence_en": "He turned on the radio during the drive."
  },
  {
    "id": 2674,
    "base_form": "trowel",
    "meaning_fa": "ماله",
    "sentence_en": "He used a trowel to spread the mortar."
  },
  {
    "id": 2673,
    "base_form": "hand rake",
    "meaning_fa": "چنگک",
    "sentence_en": "He loosened the soil with a hand rake."
  },
  {
    "id": 2672,
    "base_form": "pruning shears",
    "meaning_fa": "قیچی باغبانی",
    "sentence_en": "She trimmed the roses with pruning shears."
  },
  {
    "id": 2671,
    "base_form": "hand trowel",
    "meaning_fa": "بیلچه",
    "sentence_en": "I dug small holes with a hand trowel."
  },
  {
    "id": 2670,
    "base_form": "sandpaper",
    "meaning_fa": "سمباده",
    "sentence_en": "Use sandpaper to smooth the surface."
  },
  {
    "id": 2669,
    "base_form": "file",
    "meaning_fa": "سوهان",
    "sentence_en": "He smoothed the rough edge with a file."
  },
  {
    "id": 2668,
    "base_form": "drill bit",
    "meaning_fa": "مته",
    "sentence_en": "This drill bit is too small for the screw."
  },
  {
    "id": 2667,
    "base_form": "drill",
    "meaning_fa": "دریل",
    "sentence_en": "She used a drill to hang the shelf."
  },
  {
    "id": 2666,
    "base_form": "saw",
    "meaning_fa": "اره",
    "sentence_en": "He used a saw to cut the board."
  },
  {
    "id": 2665,
    "base_form": "utility knife",
    "meaning_fa": "کاتر",
    "sentence_en": "He opened the package with a utility knife."
  },
  {
    "id": 2664,
    "base_form": "clamp",
    "meaning_fa": "گیره",
    "sentence_en": "Hold the wood with a clamp while it dries."
  },
  {
    "id": 2663,
    "base_form": "needle-nose pliers",
    "meaning_fa": "دم باریک",
    "sentence_en": "She used needle-nose pliers to grab the tiny piece."
  },
  {
    "id": 2662,
    "base_form": "pliers",
    "meaning_fa": "انبردست",
    "sentence_en": "He held the wire steady with pliers."
  },
  {
    "id": 2661,
    "base_form": "hex key",
    "meaning_fa": "آچار آلن",
    "sentence_en": "I need a hex key for this bike seat."
  },
  {
    "id": 2660,
    "base_form": "adjustable wrench",
    "meaning_fa": "آچار فرانسه",
    "sentence_en": "An adjustable wrench works for different bolt sizes."
  },
  {
    "id": 2659,
    "base_form": "wrench",
    "meaning_fa": "آچار",
    "sentence_en": "He used a wrench to loosen the bolt."
  },
  {
    "id": 2658,
    "base_form": "screwdriver",
    "meaning_fa": "پیچ گوشتی",
    "sentence_en": "He tightened the screw with a screwdriver."
  },
  {
    "id": 2657,
    "base_form": "mallet",
    "meaning_fa": "چکش لاستیکی",
    "sentence_en": "Use a mallet to tap it into place."
  },
  {
    "id": 2656,
    "base_form": "hammer",
    "meaning_fa": "چکش",
    "sentence_en": "He grabbed a hammer and fixed the loose nail."
  },
  {
    "id": 2655,
    "base_form": "phone case",
    "meaning_fa": "کاور گوشی",
    "sentence_en": "Her phone case cracked when she dropped it."
  },
  {
    "id": 2654,
    "base_form": "glasses case",
    "meaning_fa": "جعبه عینک",
    "sentence_en": "Keep your glasses case in your bag."
  },
  {
    "id": 2653,
    "base_form": "umbrella",
    "meaning_fa": "چتر",
    "sentence_en": "I opened my umbrella before the rain got worse."
  },
  {
    "id": 2652,
    "base_form": "ID card",
    "meaning_fa": "کارت شناسایی",
    "sentence_en": "He showed his ID card at the front desk."
  },
  {
    "id": 2651,
    "base_form": "notebook",
    "meaning_fa": "دفترچه",
    "sentence_en": "She wrote the plan in her notebook."
  },
  {
    "id": 2650,
    "base_form": "trimmer",
    "meaning_fa": "ماشین اصلاح",
    "sentence_en": "He used a trimmer to tidy his beard."
  },
  {
    "id": 2649,
    "base_form": "razor",
    "meaning_fa": "تیغ اصلاح",
    "sentence_en": "He bought a new razor at the pharmacy."
  },
  {
    "id": 2648,
    "base_form": "brush",
    "meaning_fa": "برس",
    "sentence_en": "She cleaned the sink with a stiff brush."
  },
  {
    "id": 2647,
    "base_form": "comb",
    "meaning_fa": "شانه",
    "sentence_en": "He ran a comb through his hair."
  },
  {
    "id": 2646,
    "base_form": "toothpaste",
    "meaning_fa": "خمیر دندان",
    "sentence_en": "We ran out of toothpaste this morning."
  },
  {
    "id": 2645,
    "base_form": "toothbrush",
    "meaning_fa": "مسواک",
    "sentence_en": "I packed a toothbrush in my carry-on."
  },
  {
    "id": 2644,
    "base_form": "power bank",
    "meaning_fa": "پاوربانک",
    "sentence_en": "I brought a power bank for the road trip."
  },
  {
    "id": 2643,
    "base_form": "earphones",
    "meaning_fa": "هندزفری",
    "sentence_en": "She lost one earphone on the subway."
  },
  {
    "id": 2642,
    "base_form": "headphones",
    "meaning_fa": "هدفون",
    "sentence_en": "I put on headphones to focus at work."
  },
  {
    "id": 2641,
    "base_form": "smartwatch",
    "meaning_fa": "ساعت هوشمند",
    "sentence_en": "His smartwatch buzzed with a new message."
  },
  {
    "id": 2640,
    "base_form": "cellphone",
    "meaning_fa": "موبایل",
    "sentence_en": "I left my cellphone in the rideshare."
  },
  {
    "id": 2639,
    "base_form": "mobile phone",
    "meaning_fa": "گوشی",
    "sentence_en": "My mobile phone ran out of battery again."
  },
  {
    "id": 2638,
    "base_form": "clothing",
    "meaning_fa": "لباس",
    "sentence_en": "His clothing was still wet from the rain."
  },
  {
    "id": 2637,
    "base_form": "armband",
    "meaning_fa": "بازوبند",
    "sentence_en": "He wore an armband during the charity run."
  },
  {
    "id": 2636,
    "base_form": "chador",
    "meaning_fa": "چادر",
    "sentence_en": "She wore a chador to the ceremony."
  },
  {
    "id": 2635,
    "base_form": "bow tie",
    "meaning_fa": "پاپیون",
    "sentence_en": "He wore a bow tie to the gala."
  },
  {
    "id": 2634,
    "base_form": "tie",
    "meaning_fa": "کراوات",
    "sentence_en": "He loosened his tie after the meeting."
  },
  {
    "id": 2633,
    "base_form": "watch",
    "meaning_fa": "ساعت",
    "sentence_en": "My watch died, so I checked my phone."
  },
  {
    "id": 2632,
    "base_form": "sunglasses",
    "meaning_fa": "عینک آفتابی",
    "sentence_en": "He forgot his sunglasses in the car."
  },
  {
    "id": 2631,
    "base_form": "glasses",
    "meaning_fa": "عینک",
    "sentence_en": "I can't read without my glasses."
  },
  {
    "id": 2630,
    "base_form": "gloves",
    "meaning_fa": "دستکش",
    "sentence_en": "She put on gloves to shovel snow."
  },
  {
    "id": 2629,
    "base_form": "belt",
    "meaning_fa": "کمربند",
    "sentence_en": "He tightened his belt one notch."
  },
  {
    "id": 2628,
    "base_form": "scarf",
    "meaning_fa": "شال",
    "sentence_en": "He wrapped a scarf around his neck."
  },
  {
    "id": 2627,
    "base_form": "headscarf",
    "meaning_fa": "روسری",
    "sentence_en": "She adjusted her headscarf before leaving the house."
  },
  {
    "id": 2626,
    "base_form": "helmet",
    "meaning_fa": "کلاه ایمنی",
    "sentence_en": "Always wear a helmet when you ride."
  },
  {
    "id": 2625,
    "base_form": "cap",
    "meaning_fa": "کلاه کپ",
    "sentence_en": "She wore a cap on her morning run."
  },
  {
    "id": 2624,
    "base_form": "hat",
    "meaning_fa": "کلاه",
    "sentence_en": "He wore a hat to block the sun."
  },
  {
    "id": 2623,
    "base_form": "slippers",
    "meaning_fa": "دمپایی",
    "sentence_en": "He walked around the house in slippers."
  },
  {
    "id": 2622,
    "base_form": "sandals",
    "meaning_fa": "صندل",
    "sentence_en": "I wore sandals to the pool."
  },
  {
    "id": 2621,
    "base_form": "boots",
    "meaning_fa": "بوت",
    "sentence_en": "Her boots were soaked after the hike."
  },
  {
    "id": 2620,
    "base_form": "shoes",
    "meaning_fa": "کفش",
    "sentence_en": "Take off your shoes at the door, please."
  },
  {
    "id": 2619,
    "base_form": "tracksuit",
    "meaning_fa": "گرمکن",
    "sentence_en": "He showed up in a tracksuit and a cap."
  },
  {
    "id": 2618,
    "base_form": "sneakers",
    "meaning_fa": "کفش ورزشی",
    "sentence_en": "He wears sneakers to commute on foot."
  },
  {
    "id": 2617,
    "base_form": "sportswear",
    "meaning_fa": "لباس ورزشی",
    "sentence_en": "She packed sportswear for the morning workout."
  },
  {
    "id": 2616,
    "base_form": "uniform",
    "meaning_fa": "لباس فرم",
    "sentence_en": "Everyone wore the same uniform at the restaurant."
  },
  {
    "id": 2615,
    "base_form": "suit",
    "meaning_fa": "کت و شلوار",
    "sentence_en": "He wore a suit to the job interview."
  },
  {
    "id": 2614,
    "base_form": "cape",
    "meaning_fa": "شنل",
    "sentence_en": "The costume came with a bright red cape."
  },
  {
    "id": 2613,
    "base_form": "sweater",
    "meaning_fa": "پلیور",
    "sentence_en": "This sweater is itchy, but it’s warm."
  },
  {
    "id": 2612,
    "base_form": "raincoat",
    "meaning_fa": "بارانی",
    "sentence_en": "He grabbed a raincoat when the sky darkened."
  },
  {
    "id": 2611,
    "base_form": "coat",
    "meaning_fa": "پالتو",
    "sentence_en": "She buttoned her coat before stepping outside."
  },
  {
    "id": 2610,
    "base_form": "socks",
    "meaning_fa": "جوراب",
    "sentence_en": "I can't find a matching pair of socks."
  },
  {
    "id": 2609,
    "base_form": "undershirt",
    "meaning_fa": "زیرپوش",
    "sentence_en": "He wore an undershirt under his dress shirt."
  },
  {
    "id": 2608,
    "base_form": "bra",
    "meaning_fa": "سوتین",
    "sentence_en": "She found a bra that actually fits."
  },
  {
    "id": 2607,
    "base_form": "briefs",
    "meaning_fa": "شورت",
    "sentence_en": "He packed extra briefs for the weekend."
  },
  {
    "id": 2606,
    "base_form": "underwear",
    "meaning_fa": "لباس زیر",
    "sentence_en": "I need to buy new underwear soon."
  },
  {
    "id": 2605,
    "base_form": "jumpsuit",
    "meaning_fa": "لباس سرهمی",
    "sentence_en": "He showed up in a black jumpsuit."
  },
  {
    "id": 2604,
    "base_form": "gown",
    "meaning_fa": "لباس مجلسی",
    "sentence_en": "Her gown looked stunning under the lights."
  },
  {
    "id": 2603,
    "base_form": "dress",
    "meaning_fa": "لباس",
    "sentence_en": "She wore a dress to the wedding."
  },
  {
    "id": 2602,
    "base_form": "leggings",
    "meaning_fa": "لگینگ",
    "sentence_en": "She works out in leggings most days."
  },
  {
    "id": 2601,
    "base_form": "shorts",
    "meaning_fa": "شلوارک",
    "sentence_en": "He wore shorts because it was ninety degrees."
  },
  {
    "id": 2600,
    "base_form": "skirt",
    "meaning_fa": "دامن",
    "sentence_en": "Her skirt had deep pockets for her phone."
  },
  {
    "id": 2599,
    "base_form": "jeans",
    "meaning_fa": "شلوار جین",
    "sentence_en": "She bought new jeans for the trip."
  },
  {
    "id": 2598,
    "base_form": "pants",
    "meaning_fa": "شلوار",
    "sentence_en": "These pants are too tight now."
  },
  {
    "id": 2597,
    "base_form": "jacket",
    "meaning_fa": "کاپشن",
    "sentence_en": "His jacket kept him warm in the snow."
  },
  {
    "id": 2596,
    "base_form": "coat",
    "meaning_fa": "کت",
    "sentence_en": "He hung his coat on the back of the chair."
  },
  {
    "id": 2595,
    "base_form": "hoodie",
    "meaning_fa": "هودی",
    "sentence_en": "She zipped up her hoodie before heading out."
  },
  {
    "id": 2594,
    "base_form": "sweatshirt",
    "meaning_fa": "سویشرت",
    "sentence_en": "He wore a sweatshirt on the plane."
  },
  {
    "id": 2593,
    "base_form": "jacket",
    "meaning_fa": "ژاکت",
    "sentence_en": "Bring a jacket; it gets cold at night."
  },
  {
    "id": 2592,
    "base_form": "blouse",
    "meaning_fa": "بلوز",
    "sentence_en": "She picked a blouse that matched her skirt."
  },
  {
    "id": 2591,
    "base_form": "T-shirt",
    "meaning_fa": "تی شرت",
    "sentence_en": "I grabbed a T-shirt and jeans."
  },
  {
    "id": 2590,
    "base_form": "shirt",
    "meaning_fa": "پیراهن",
    "sentence_en": "He wore a clean shirt to the interview."
  },
  {
    "id": 2589,
    "base_form": "partition",
    "meaning_fa": "پارتیشن",
    "sentence_en": "They put up a partition for more privacy."
  },
  {
    "id": 2588,
    "base_form": "toolbox",
    "meaning_fa": "جعبه ابزار بزرگ",
    "sentence_en": "He keeps power tools in a large toolbox."
  },
  {
    "id": 2587,
    "base_form": "stove",
    "meaning_fa": "اجاق گاز",
    "sentence_en": "He left the pot on the stove too long."
  },
  {
    "id": 2586,
    "base_form": "dishwasher",
    "meaning_fa": "ماشین ظرفشویی",
    "sentence_en": "I loaded the dishwasher after dinner."
  },
  {
    "id": 2585,
    "base_form": "washing machine",
    "meaning_fa": "ماشین لباسشویی",
    "sentence_en": "The washing machine stopped mid-cycle again."
  },
  {
    "id": 2584,
    "base_form": "shoe rack",
    "meaning_fa": "جاکفشی",
    "sentence_en": "Leave your shoes on the shoe rack by the door."
  },
  {
    "id": 2583,
    "base_form": "display cabinet",
    "meaning_fa": "ویترین",
    "sentence_en": "She keeps her nice dishes in a display cabinet."
  },
  {
    "id": 2582,
    "base_form": "shelf",
    "meaning_fa": "قفسه",
    "sentence_en": "Put the spices on the top shelf."
  },
  {
    "id": 2581,
    "base_form": "closet",
    "meaning_fa": "کمد دیواری",
    "sentence_en": "I hung my coat back in the closet."
  },
  {
    "id": 2580,
    "base_form": "bookshelf",
    "meaning_fa": "کتابخانه",
    "sentence_en": "The bookshelf in my office is completely full."
  },
  {
    "id": 2579,
    "base_form": "desk",
    "meaning_fa": "میز",
    "sentence_en": "My desk is covered with sticky notes today."
  },
  {
    "id": 2578,
    "base_form": "wardrobe",
    "meaning_fa": "کمد",
    "sentence_en": "She put her coat in the wardrobe."
  },
  {
    "id": 2577,
    "base_form": "bench",
    "meaning_fa": "نیمکت",
    "sentence_en": "We sat on a bench and watched the game."
  },
  {
    "id": 2576,
    "base_form": "ottoman",
    "meaning_fa": "پاف",
    "sentence_en": "She put her feet up on the ottoman."
  },
  {
    "id": 2575,
    "base_form": "couch",
    "meaning_fa": "کاناپه",
    "sentence_en": "He fell asleep on the couch during the movie."
  },
  {
    "id": 2574,
    "base_form": "chair",
    "meaning_fa": "صندلی",
    "sentence_en": "That chair is surprisingly comfortable for long meetings."
  },
  {
    "id": 2573,
    "base_form": "sofa",
    "meaning_fa": "مبل",
    "sentence_en": "We bought a new sofa for the living room."
  },
  {
    "id": 2572,
    "base_form": "label",
    "meaning_fa": "برچسب",
    "sentence_en": "Put a label on each jar before you store it."
  },
  {
    "id": 2571,
    "base_form": "card",
    "meaning_fa": "کارت",
    "sentence_en": "I paid with my card at the register."
  },
  {
    "id": 2570,
    "base_form": "calculator",
    "meaning_fa": "ماشین حساب",
    "sentence_en": "I used a calculator to double-check the total."
  },
  {
    "id": 2569,
    "base_form": "highlighter",
    "meaning_fa": "هایلایتر",
    "sentence_en": "He used a highlighter to mark the key points."
  },
  {
    "id": 2568,
    "base_form": "ink pad",
    "meaning_fa": "استامپ",
    "sentence_en": "The ink pad was dry, so the stamp looked faint."
  },
  {
    "id": 2567,
    "base_form": "stamp",
    "meaning_fa": "مهر",
    "sentence_en": "She pressed the stamp onto the ink pad."
  },
  {
    "id": 2566,
    "base_form": "calendar",
    "meaning_fa": "تقویم",
    "sentence_en": "I added the meeting to my calendar."
  },
  {
    "id": 2565,
    "base_form": "box cutter",
    "meaning_fa": "کاتر",
    "sentence_en": "He opened the box with a box cutter."
  },
  {
    "id": 2564,
    "base_form": "tape",
    "meaning_fa": "نوارچسب",
    "sentence_en": "I used tape to seal the package."
  },
  {
    "id": 2563,
    "base_form": "pin",
    "meaning_fa": "سوزن",
    "sentence_en": "She used a pin to mark the spot on the map."
  },
  {
    "id": 2562,
    "base_form": "clip",
    "meaning_fa": "گیره",
    "sentence_en": "Use a clip to hold those receipts together."
  },
  {
    "id": 2561,
    "base_form": "staple",
    "meaning_fa": "سوزن منگنه",
    "sentence_en": "One staple got stuck and ripped the paper."
  },
  {
    "id": 2560,
    "base_form": "ring binder",
    "meaning_fa": "کلاسور",
    "sentence_en": "She organized her notes in a ring binder."
  },
  {
    "id": 2559,
    "base_form": "binder",
    "meaning_fa": "زونکن",
    "sentence_en": "I filed the forms in a big binder."
  },
  {
    "id": 2558,
    "base_form": "folder",
    "meaning_fa": "پوشه",
    "sentence_en": "Save the report in the shared folder."
  },
  {
    "id": 2557,
    "base_form": "ledger",
    "meaning_fa": "دفتر حساب",
    "sentence_en": "The accountant updated the ledger at the end of day."
  },
  {
    "id": 2556,
    "base_form": "sheet",
    "meaning_fa": "برگه",
    "sentence_en": "Please fill out this sheet and hand it back."
  },
  {
    "id": 2555,
    "base_form": "notepad",
    "meaning_fa": "دفترچه",
    "sentence_en": "He jotted the number on a notepad."
  },
  {
    "id": 2554,
    "base_form": "notebook",
    "meaning_fa": "دفتر",
    "sentence_en": "She keeps her recipes in a notebook."
  },
  {
    "id": 2553,
    "base_form": "paper",
    "meaning_fa": "کاغذ",
    "sentence_en": "I ran out of paper halfway through printing."
  },
  {
    "id": 2552,
    "base_form": "sharpener",
    "meaning_fa": "تراش",
    "sentence_en": "The pencil sharpener is jammed again."
  },
  {
    "id": 2551,
    "base_form": "eraser",
    "meaning_fa": "پاک کن",
    "sentence_en": "I need an eraser for these messy notes."
  },
  {
    "id": 2550,
    "base_form": "fountain pen",
    "meaning_fa": "خودنویس",
    "sentence_en": "He writes thank-you notes with a fountain pen."
  },
  {
    "id": 2549,
    "base_form": "marker",
    "meaning_fa": "ماژیک",
    "sentence_en": "She used a marker to label the boxes."
  },
  {
    "id": 2548,
    "base_form": "pencil",
    "meaning_fa": "مداد",
    "sentence_en": "He wrote the address down in pencil."
  },
  {
    "id": 2547,
    "base_form": "pen",
    "meaning_fa": "خودکار",
    "sentence_en": "Can I borrow a pen to sign this?"
  },
  {
    "id": 2546,
    "base_form": "toy piano",
    "meaning_fa": "پیانو",
    "sentence_en": "She played a tune on her toy piano."
  },
  {
    "id": 2545,
    "base_form": "drum",
    "meaning_fa": "طبل",
    "sentence_en": "The drummer hit the drum hard during the chorus."
  },
  {
    "id": 2544,
    "base_form": "gun",
    "meaning_fa": "تفنگ",
    "sentence_en": "The security guard carried a gun on his belt."
  },
  {
    "id": 2543,
    "base_form": "sword",
    "meaning_fa": "شمشیر",
    "sentence_en": "The actor lifted the sword for the final scene."
  },
  {
    "id": 2542,
    "base_form": "racket",
    "meaning_fa": "راکت",
    "sentence_en": "He restrung his racket before the match."
  },
  {
    "id": 2541,
    "base_form": "dominoes",
    "meaning_fa": "دومینو",
    "sentence_en": "We played dominoes at the kitchen table."
  },
  {
    "id": 2540,
    "base_form": "backgammon",
    "meaning_fa": "تخته نرد",
    "sentence_en": "My uncle loves playing backgammon on weekends."
  },
  {
    "id": 2539,
    "base_form": "chess",
    "meaning_fa": "شطرنج",
    "sentence_en": "They played chess for an hour after dinner."
  },
  {
    "id": 2538,
    "base_form": "puzzle",
    "meaning_fa": "پازل",
    "sentence_en": "We finished the puzzle while watching a movie."
  },
  {
    "id": 2537,
    "base_form": "hula hoop",
    "meaning_fa": "حلقه بازی",
    "sentence_en": "She kept the hula hoop spinning around her waist."
  },
  {
    "id": 2536,
    "base_form": "yo-yo",
    "meaning_fa": "یویو",
    "sentence_en": "He practiced tricks with his yo-yo after school."
  },
  {
    "id": 2535,
    "base_form": "spinning top",
    "meaning_fa": "فرفره",
    "sentence_en": "The spinning top wobbled and then fell over."
  },
  {
    "id": 2534,
    "base_form": "rope",
    "meaning_fa": "طناب",
    "sentence_en": "He tied the rope around the box to secure it."
  },
  {
    "id": 2533,
    "base_form": "kite",
    "meaning_fa": "بادبادک",
    "sentence_en": "Her kite flew high above the beach."
  },
  {
    "id": 2532,
    "base_form": "LEGO",
    "meaning_fa": "لگو",
    "sentence_en": "We built a LEGO car on the living room floor."
  },
  {
    "id": 2531,
    "base_form": "doll",
    "meaning_fa": "عروسک",
    "sentence_en": "My niece carries her doll everywhere she goes."
  },
  {
    "id": 2530,
    "base_form": "crane",
    "meaning_fa": "جرثقیل",
    "sentence_en": "A crane lifted the steel beam into place."
  },
  {
    "id": 2529,
    "base_form": "bulldozer",
    "meaning_fa": "بولدوزر",
    "sentence_en": "The bulldozer cleared the lot in an hour."
  },
  {
    "id": 2528,
    "base_form": "fire truck",
    "meaning_fa": "ماشین آتش نشانی",
    "sentence_en": "A fire truck raced past with its siren on."
  },
  {
    "id": 2527,
    "base_form": "ambulance",
    "meaning_fa": "آمبولانس",
    "sentence_en": "An ambulance arrived within minutes after the crash."
  },
  {
    "id": 2526,
    "base_form": "chariot",
    "meaning_fa": "ارابه",
    "sentence_en": "The museum had an ancient chariot on display."
  },
  {
    "id": 2525,
    "base_form": "carriage",
    "meaning_fa": "درشکه",
    "sentence_en": "We took a carriage ride through the park."
  },
  {
    "id": 2524,
    "base_form": "cart",
    "meaning_fa": "گاری",
    "sentence_en": "He pushed a cart full of groceries."
  },
  {
    "id": 2523,
    "base_form": "bike",
    "meaning_fa": "دوچرخه",
    "sentence_en": "I locked my bike outside the store."
  },
  {
    "id": 2522,
    "base_form": "skateboard",
    "meaning_fa": "اسکیت برد",
    "sentence_en": "He carried his skateboard into the coffee shop."
  },
  {
    "id": 2521,
    "base_form": "skates",
    "meaning_fa": "اسکیت",
    "sentence_en": "He laced up his skates and hit the rink."
  },
  {
    "id": 2520,
    "base_form": "drone",
    "meaning_fa": "هواپیمای بدون سرنشین",
    "sentence_en": "A drone recorded the race from above."
  },
  {
    "id": 2519,
    "base_form": "balloon",
    "meaning_fa": "بالن",
    "sentence_en": "We rode in a balloon at sunrise."
  },
  {
    "id": 2518,
    "base_form": "glider",
    "meaning_fa": "گلایدر",
    "sentence_en": "He watched a glider drift silently over the field."
  },
  {
    "id": 2517,
    "base_form": "helicopter",
    "meaning_fa": "بالگرد",
    "sentence_en": "A helicopter hovered over the highway."
  },
  {
    "id": 2516,
    "base_form": "airplane",
    "meaning_fa": "هواپیما",
    "sentence_en": "Our airplane landed a little early."
  },
  {
    "id": 2515,
    "base_form": "submarine",
    "meaning_fa": "زیردریایی",
    "sentence_en": "The submarine surfaced briefly before diving again."
  },
  {
    "id": 2514,
    "base_form": "cargo ship",
    "meaning_fa": "کشتی باری",
    "sentence_en": "A cargo ship waited offshore for its turn."
  },
  {
    "id": 2513,
    "base_form": "dhow",
    "meaning_fa": "لنج",
    "sentence_en": "We saw a dhow anchored near the harbor."
  },
  {
    "id": 2512,
    "base_form": "ship",
    "meaning_fa": "کشتی",
    "sentence_en": "The ship pulled into port at dawn."
  },
  {
    "id": 2511,
    "base_form": "boat",
    "meaning_fa": "قایق",
    "sentence_en": "We rented a small boat for the afternoon."
  },
  {
    "id": 2510,
    "base_form": "trailer",
    "meaning_fa": "تریلی",
    "sentence_en": "A trailer jackknifed on the highway during the storm."
  },
  {
    "id": 2509,
    "base_form": "subway",
    "meaning_fa": "مترو",
    "sentence_en": "I take the subway to Manhattan every day."
  },
  {
    "id": 2508,
    "base_form": "tram",
    "meaning_fa": "تراموا",
    "sentence_en": "We hopped on the tram to reach the museum."
  },
  {
    "id": 2507,
    "base_form": "taxi",
    "meaning_fa": "تاکسی",
    "sentence_en": "We called a taxi after the concert."
  },
  {
    "id": 2506,
    "base_form": "minibus",
    "meaning_fa": "مینی بوس",
    "sentence_en": "We took a minibus to the stadium."
  },
  {
    "id": 2505,
    "base_form": "bus",
    "meaning_fa": "اتوبوس",
    "sentence_en": "I missed the bus by thirty seconds."
  },
  {
    "id": 2504,
    "base_form": "pickup truck",
    "meaning_fa": "وانت",
    "sentence_en": "He loaded the boxes into his pickup truck."
  },
  {
    "id": 2503,
    "base_form": "truck",
    "meaning_fa": "کامیون",
    "sentence_en": "A truck delivered the couch this afternoon."
  },
  {
    "id": 2502,
    "base_form": "scooter",
    "meaning_fa": "اسکوتر",
    "sentence_en": "She rented a scooter to get around downtown."
  },
  {
    "id": 2501,
    "base_form": "motorcycle",
    "meaning_fa": "موتور",
    "sentence_en": "A motorcycle zipped past us at the light."
  },
  {
    "id": 2500,
    "base_form": "bicycle",
    "meaning_fa": "دوچرخه",
    "sentence_en": "He rides his bicycle to work most days."
  },
  {
    "id": 2499,
    "base_form": "vehicle",
    "meaning_fa": "خودرو",
    "sentence_en": "That vehicle is blocking the driveway."
  },
  {
    "id": 2498,
    "base_form": "car",
    "meaning_fa": "ماشین",
    "sentence_en": "My car wouldn't start this morning."
  },
  {
    "id": 2497,
    "base_form": "meteorite",
    "meaning_fa": "سنگ آسمانی",
    "sentence_en": "They found a meteorite in the desert."
  },
  {
    "id": 2496,
    "base_form": "shell",
    "meaning_fa": "صدف",
    "sentence_en": "She found a shell in the wet sand."
  },
  {
    "id": 2495,
    "base_form": "bone",
    "meaning_fa": "استخوان",
    "sentence_en": "The dog buried a bone in the backyard."
  },
  {
    "id": 2494,
    "base_form": "hide",
    "meaning_fa": "پوست",
    "sentence_en": "The drum was stretched tight with deer hide."
  },
  {
    "id": 2493,
    "base_form": "feather",
    "meaning_fa": "پر",
    "sentence_en": "A feather drifted down onto his jacket."
  },
  {
    "id": 2492,
    "base_form": "wool",
    "meaning_fa": "پشم",
    "sentence_en": "This sweater is made from soft wool."
  },
  {
    "id": 2491,
    "base_form": "waterfall",
    "meaning_fa": "آبشار",
    "sentence_en": "The waterfall was loud enough to drown out our voices."
  },
  {
    "id": 2490,
    "base_form": "pond",
    "meaning_fa": "برکه",
    "sentence_en": "Ducks were swimming in the pond."
  },
  {
    "id": 2489,
    "base_form": "lake",
    "meaning_fa": "دریاچه",
    "sentence_en": "We rented a cabin by the lake."
  },
  {
    "id": 2488,
    "base_form": "sea",
    "meaning_fa": "دریا",
    "sentence_en": "You could smell the sea from the boardwalk."
  },
  {
    "id": 2487,
    "base_form": "river",
    "meaning_fa": "رودخانه",
    "sentence_en": "The river rose overnight after the storm."
  },
  {
    "id": 2486,
    "base_form": "spring",
    "meaning_fa": "چشمه",
    "sentence_en": "We filled our bottles at a cold spring."
  },
  {
    "id": 2485,
    "base_form": "ground",
    "meaning_fa": "زمین",
    "sentence_en": "He dropped his phone and it hit the ground."
  },
  {
    "id": 2484,
    "base_form": "cave",
    "meaning_fa": "غار",
    "sentence_en": "They explored a cave with headlamps."
  },
  {
    "id": 2483,
    "base_form": "pebble",
    "meaning_fa": "سنگ ریزه",
    "sentence_en": "A pebble was stuck in my sandal."
  },
  {
    "id": 2482,
    "base_form": "rock",
    "meaning_fa": "صخره",
    "sentence_en": "We climbed onto a rock to get a better view."
  },
  {
    "id": 2481,
    "base_form": "hill",
    "meaning_fa": "تپه",
    "sentence_en": "We walked up the hill to catch our breath."
  },
  {
    "id": 2480,
    "base_form": "mountain",
    "meaning_fa": "کوه",
    "sentence_en": "They drove toward the mountain as the sun set."
  },
  {
    "id": 2479,
    "base_form": "acorn",
    "meaning_fa": "بلوط",
    "sentence_en": "A squirrel carried an acorn up the tree."
  },
  {
    "id": 2478,
    "base_form": "nut",
    "meaning_fa": "آجیل",
    "sentence_en": "He has a nut allergy, so he skips dessert."
  },
  {
    "id": 2477,
    "base_form": "pit",
    "meaning_fa": "هسته",
    "sentence_en": "She spit the cherry pit into a napkin."
  },
  {
    "id": 2476,
    "base_form": "seed",
    "meaning_fa": "دانه",
    "sentence_en": "A tiny seed sprouted in the pot."
  },
  {
    "id": 2475,
    "base_form": "fruit",
    "meaning_fa": "میوه",
    "sentence_en": "I always keep fresh fruit on the counter."
  },
  {
    "id": 2474,
    "base_form": "moss",
    "meaning_fa": "خزه",
    "sentence_en": "Moss covered the rocks by the creek."
  },
  {
    "id": 2473,
    "base_form": "shrub",
    "meaning_fa": "بوته",
    "sentence_en": "We planted a shrub near the front steps."
  },
  {
    "id": 2472,
    "base_form": "grass",
    "meaning_fa": "چمن",
    "sentence_en": "The grass is wet, so don't sit there."
  },
  {
    "id": 2471,
    "base_form": "bark",
    "meaning_fa": "پوست درخت",
    "sentence_en": "The bark felt rough under my fingers."
  },
  {
    "id": 2470,
    "base_form": "stem",
    "meaning_fa": "ساقه",
    "sentence_en": "Cut the stem and put the roses in water."
  },
  {
    "id": 2469,
    "base_form": "root",
    "meaning_fa": "ریشه",
    "sentence_en": "The root cracked the sidewalk over time."
  },
  {
    "id": 2468,
    "base_form": "leaf",
    "meaning_fa": "برگ",
    "sentence_en": "A yellow leaf floated down onto the sidewalk."
  },
  {
    "id": 2467,
    "base_form": "ice",
    "meaning_fa": "یخ",
    "sentence_en": "Put some ice in my drink, please."
  },
  {
    "id": 2466,
    "base_form": "salt",
    "meaning_fa": "نمک",
    "sentence_en": "Add a pinch of salt to the soup."
  },
  {
    "id": 2465,
    "base_form": "clay",
    "meaning_fa": "رس",
    "sentence_en": "She shaped the clay into a small bowl."
  },
  {
    "id": 2464,
    "base_form": "mud",
    "meaning_fa": "گل",
    "sentence_en": "My car was covered in mud after the rain."
  },
  {
    "id": 2463,
    "base_form": "sand",
    "meaning_fa": "ماسه",
    "sentence_en": "The kids built castles in the sand all afternoon."
  },
  {
    "id": 2462,
    "base_form": "sand",
    "meaning_fa": "شن",
    "sentence_en": "Sand got into my shoes at the beach."
  },
  {
    "id": 2461,
    "base_form": "water",
    "meaning_fa": "آب",
    "sentence_en": "Can you pour me a glass of water?"
  },
  {
    "id": 2460,
    "base_form": "safe",
    "meaning_fa": "گاوصندوق",
    "sentence_en": "She locked her passport in the safe."
  },
  {
    "id": 2459,
    "base_form": "mailbox",
    "meaning_fa": "جعبه پست",
    "sentence_en": "I checked the mailbox for your letter."
  },
  {
    "id": 2458,
    "base_form": "file",
    "meaning_fa": "فایل",
    "sentence_en": "I attached the file to the email."
  },
  {
    "id": 2457,
    "base_form": "cabinet",
    "meaning_fa": "کمد",
    "sentence_en": "The mugs are in the cabinet above the sink."
  },
  {
    "id": 2456,
    "base_form": "drawer",
    "meaning_fa": "کشو",
    "sentence_en": "I left the scissors in the top drawer."
  },
  {
    "id": 2455,
    "base_form": "silo",
    "meaning_fa": "سیلو",
    "sentence_en": "The farm stored grain in a tall silo."
  },
  {
    "id": 2454,
    "base_form": "tanker",
    "meaning_fa": "تانکر",
    "sentence_en": "A tanker truck blocked the road for a minute."
  },
  {
    "id": 2453,
    "base_form": "tank",
    "meaning_fa": "مخزن",
    "sentence_en": "The water tank behind the house started leaking."
  },
  {
    "id": 2452,
    "base_form": "barrel",
    "meaning_fa": "بشکه",
    "sentence_en": "They rolled the barrel into the storage room."
  },
  {
    "id": 2451,
    "base_form": "pencil case",
    "meaning_fa": "جامدادی",
    "sentence_en": "My pencil case is full of markers and pens."
  },
  {
    "id": 2450,
    "base_form": "wallet",
    "meaning_fa": "کیف پول",
    "sentence_en": "I can't find my wallet anywhere."
  },
  {
    "id": 2449,
    "base_form": "handbag",
    "meaning_fa": "کیف دستی",
    "sentence_en": "She tossed her phone into her handbag."
  },
  {
    "id": 2448,
    "base_form": "duffel bag",
    "meaning_fa": "ساک",
    "sentence_en": "He packed his duffel bag for the weekend trip."
  },
  {
    "id": 2447,
    "base_form": "backpack",
    "meaning_fa": "کوله پشتی",
    "sentence_en": "He slung his backpack over one shoulder."
  },
  {
    "id": 2446,
    "base_form": "suitcase",
    "meaning_fa": "چمدان",
    "sentence_en": "Her suitcase got lost on the flight."
  },
  {
    "id": 2445,
    "base_form": "jar",
    "meaning_fa": "شیشه در دار",
    "sentence_en": "He opened the jar and spread the jam."
  },
  {
    "id": 2444,
    "base_form": "can",
    "meaning_fa": "قوطی کنسرو",
    "sentence_en": "We opened a can of beans for dinner."
  },
  {
    "id": 2443,
    "base_form": "can",
    "meaning_fa": "قوطی",
    "sentence_en": "Grab a can of soda from the fridge."
  },
  {
    "id": 2442,
    "base_form": "flask",
    "meaning_fa": "فلاسک",
    "sentence_en": "He brought a flask of hot tea to work."
  },
  {
    "id": 2441,
    "base_form": "canteen",
    "meaning_fa": "قمقمه",
    "sentence_en": "He filled his canteen before the long hike."
  },
  {
    "id": 2440,
    "base_form": "chest",
    "meaning_fa": "صندوق",
    "sentence_en": "The old chest held blankets and winter clothes."
  },
  {
    "id": 2439,
    "base_form": "basket",
    "meaning_fa": "سبد",
    "sentence_en": "She carried the laundry basket up the stairs."
  },
  {
    "id": 2438,
    "base_form": "bucket",
    "meaning_fa": "سطل",
    "sentence_en": "He filled a bucket with soapy water."
  },
  {
    "id": 2437,
    "base_form": "bag",
    "meaning_fa": "کیف",
    "sentence_en": "He grabbed his bag and ran out the door."
  },
  {
    "id": 2436,
    "base_form": "bag",
    "meaning_fa": "کیسه",
    "sentence_en": "She put the apples in a paper bag."
  },
  {
    "id": 2435,
    "base_form": "stopwatch",
    "meaning_fa": "کرنومتر",
    "sentence_en": "She started the stopwatch as soon as he began running."
  },
  {
    "id": 2434,
    "base_form": "weight",
    "meaning_fa": "وزنه",
    "sentence_en": "He added another weight to the barbell."
  },
  {
    "id": 2433,
    "base_form": "scale",
    "meaning_fa": "ترازو",
    "sentence_en": "Step on the scale and tell me the number."
  },
  {
    "id": 2432,
    "base_form": "protractor",
    "meaning_fa": "زاویه سنج",
    "sentence_en": "Use a protractor to measure that angle."
  },
  {
    "id": 2431,
    "base_form": "measuring tape",
    "meaning_fa": "متر",
    "sentence_en": "I grabbed a measuring tape to check the window."
  },
  {
    "id": 2430,
    "base_form": "ruler",
    "meaning_fa": "خط کش",
    "sentence_en": "Can you pass me the ruler for this?"
  },
  {
    "id": 2429,
    "base_form": "chest",
    "meaning_fa": "صندوقچه",
    "sentence_en": "She stored old letters in a wooden chest."
  },
  {
    "id": 2428,
    "base_form": "box",
    "meaning_fa": "جعبه",
    "sentence_en": "I left the keys in a small box by the door."
  },
  {
    "id": 2427,
    "base_form": "pottery",
    "meaning_fa": "ظرف سفالی",
    "sentence_en": "We found handmade pottery at the weekend market."
  },
  {
    "id": 2426,
    "base_form": "wood",
    "meaning_fa": "چوب",
    "sentence_en": "The shelf is made of solid wood."
  },
  {
    "id": 2425,
    "base_form": "stone",
    "meaning_fa": "سنگ",
    "sentence_en": "She skipped a flat stone across the lake."
  },
  {
    "id": 2424,
    "base_form": "branch",
    "meaning_fa": "شاخه",
    "sentence_en": "A branch scraped the window in the wind."
  },
  {
    "id": 2423,
    "base_form": "curtain",
    "meaning_fa": "پرده",
    "sentence_en": "Please close the curtain; the sun is too bright."
  },
  {
    "id": 2422,
    "base_form": "tablecloth",
    "meaning_fa": "رومیزی",
    "sentence_en": "She spilled coffee on the white tablecloth."
  },
  {
    "id": 2421,
    "base_form": "cushion",
    "meaning_fa": "کوسن",
    "sentence_en": "He grabbed a cushion and sat on the floor."
  },
  {
    "id": 2420,
    "base_form": "crystal",
    "meaning_fa": "بلور",
    "sentence_en": "The crystal on the shelf caught the light."
  },
  {
    "id": 2419,
    "base_form": "dish",
    "meaning_fa": "ظرف",
    "sentence_en": "She washed every dish after dinner."
  },
  {
    "id": 2418,
    "base_form": "lantern",
    "meaning_fa": "فانوس",
    "sentence_en": "He carried a lantern down the dark path."
  },
  {
    "id": 2417,
    "base_form": "clock",
    "meaning_fa": "ساعت",
    "sentence_en": "The clock on the wall is five minutes fast."
  },
  {
    "id": 2416,
    "base_form": "mirror",
    "meaning_fa": "آینه",
    "sentence_en": "She checked her hair in the bathroom mirror."
  },
  {
    "id": 2415,
    "base_form": "poster",
    "meaning_fa": "پوستر",
    "sentence_en": "He taped a movie poster to his bedroom wall."
  },
  {
    "id": 2414,
    "base_form": "painting",
    "meaning_fa": "تابلو نقاشی",
    "sentence_en": "That painting looks perfect in the hallway."
  },
  {
    "id": 2413,
    "base_form": "wall art",
    "meaning_fa": "تابلو",
    "sentence_en": "We hung new wall art above the couch."
  },
  {
    "id": 2412,
    "base_form": "photo",
    "meaning_fa": "عکس",
    "sentence_en": "I found an old photo of us from high school."
  },
  {
    "id": 2411,
    "base_form": "frame",
    "meaning_fa": "قاب",
    "sentence_en": "He picked a wooden frame for the family photo."
  },
  {
    "id": 2410,
    "base_form": "table clock",
    "meaning_fa": "ساعت رومیزی",
    "sentence_en": "The table clock ticked softly all night."
  },
  {
    "id": 2409,
    "base_form": "glass sphere",
    "meaning_fa": "گوی شیشه ای",
    "sentence_en": "A glass sphere caught the sunlight on the shelf."
  },
  {
    "id": 2408,
    "base_form": "statuette",
    "meaning_fa": "تندیس",
    "sentence_en": "She won a tiny statuette at the film festival."
  },
  {
    "id": 2407,
    "base_form": "statue",
    "meaning_fa": "مجسمه",
    "sentence_en": "Tourists kept taking photos next to the statue."
  },
  {
    "id": 2406,
    "base_form": "candle holder",
    "meaning_fa": "جاشمعی",
    "sentence_en": "I bought a simple candle holder for the patio."
  },
  {
    "id": 2405,
    "base_form": "ceramic",
    "meaning_fa": "سفالی",
    "sentence_en": "He served soup in a ceramic bowl."
  },
  {
    "id": 2404,
    "base_form": "vase",
    "meaning_fa": "گلدان",
    "sentence_en": "She put the roses in a blue vase."
  },
  {
    "id": 2403,
    "base_form": "flower",
    "meaning_fa": "گل",
    "sentence_en": "She picked a flower from the garden."
  },
  {
    "id": 2402,
    "base_form": "clothes",
    "meaning_fa": "لباس",
    "sentence_en": "Her clothes were folded neatly on the chair."
  },
  {
    "id": 2401,
    "base_form": "child",
    "meaning_fa": "کودک",
    "sentence_en": "The child played quietly on the floor."
  },
  {
    "id": 2400,
    "base_form": "glass baking dish",
    "meaning_fa": "ظرف پیرکس",
    "sentence_en": "She baked lasagna in a glass baking dish."
  },
  {
    "id": 2399,
    "base_form": "loaf pan",
    "meaning_fa": "قالب نان",
    "sentence_en": "He poured dough into the loaf pan."
  },
  {
    "id": 2398,
    "base_form": "cake mold",
    "meaning_fa": "قالب کیک",
    "sentence_en": "The batter filled the cake mold."
  },
  {
    "id": 2397,
    "base_form": "tray",
    "meaning_fa": "سینی",
    "sentence_en": "She carried tea on a tray."
  },
  {
    "id": 2396,
    "base_form": "wok",
    "meaning_fa": "وُک",
    "sentence_en": "Vegetables cooked quickly in the wok."
  },
  {
    "id": 2395,
    "base_form": "cauldron",
    "meaning_fa": "دیگ",
    "sentence_en": "The stew simmered in a large cauldron."
  },
  {
    "id": 2394,
    "base_form": "frying pan",
    "meaning_fa": "ماهیتابه",
    "sentence_en": "She warmed the frying pan slowly."
  },
  {
    "id": 2393,
    "base_form": "non-stick pan",
    "meaning_fa": "تابه نچسب",
    "sentence_en": "Eggs slid easily in the non-stick pan."
  },
  {
    "id": 2392,
    "base_form": "pan",
    "meaning_fa": "تابه",
    "sentence_en": "He heated oil in the pan."
  },
  {
    "id": 2391,
    "base_form": "pressure cooker",
    "meaning_fa": "قابلمه زودپز",
    "sentence_en": "The pressure cooker shortened cooking time."
  },
  {
    "id": 2390,
    "base_form": "lidded pot",
    "meaning_fa": "قابلمه درب دار",
    "sentence_en": "She covered the stew in a lidded pot."
  },
  {
    "id": 2389,
    "base_form": "pot",
    "meaning_fa": "قابلمه",
    "sentence_en": "The pot boiled over on the stove."
  },
  {
    "id": 2388,
    "base_form": "pestle",
    "meaning_fa": "دسته هاون",
    "sentence_en": "He crushed garlic using the pestle."
  },
  {
    "id": 2387,
    "base_form": "mortar",
    "meaning_fa": "هاون",
    "sentence_en": "Spices sat inside a stone mortar."
  },
  {
    "id": 2386,
    "base_form": "scissors",
    "meaning_fa": "قیچی",
    "sentence_en": "She cut the package with scissors."
  },
  {
    "id": 2385,
    "base_form": "cutting board",
    "meaning_fa": "تخته برش",
    "sentence_en": "The cutting board was made of wood."
  },
  {
    "id": 2384,
    "base_form": "coarse grater",
    "meaning_fa": "رنده درشت",
    "sentence_en": "He chose a coarse grater for carrots."
  },
  {
    "id": 2383,
    "base_form": "fine grater",
    "meaning_fa": "رنده ریز",
    "sentence_en": "She used a fine grater for lemon zest."
  },
  {
    "id": 2382,
    "base_form": "grater",
    "meaning_fa": "رنده",
    "sentence_en": "He grated cheese using a grater."
  },
  {
    "id": 2381,
    "base_form": "peeler",
    "meaning_fa": "پوست کن",
    "sentence_en": "She peeled the apple with a peeler."
  },
  {
    "id": 2380,
    "base_form": "cleaver",
    "meaning_fa": "ساطور",
    "sentence_en": "The butcher lifted a heavy cleaver."
  },
  {
    "id": 2379,
    "base_form": "knife",
    "meaning_fa": "چاقو",
    "sentence_en": "He sharpened the knife carefully."
  },
  {
    "id": 2378,
    "base_form": "measuring cup",
    "meaning_fa": "پیمانه",
    "sentence_en": "She measured flour with a measuring cup."
  },
  {
    "id": 2377,
    "base_form": "scraper",
    "meaning_fa": "کاردک",
    "sentence_en": "He cleaned the bowl with a scraper."
  },
  {
    "id": 2376,
    "base_form": "hand whisk",
    "meaning_fa": "همزن دستی",
    "sentence_en": "She beat the eggs with a hand whisk."
  },
  {
    "id": 2375,
    "base_form": "tongs",
    "meaning_fa": "انبر",
    "sentence_en": "He grabbed the meat with tongs."
  },
  {
    "id": 2374,
    "base_form": "fork",
    "meaning_fa": "چنگال",
    "sentence_en": "She ate the salad with a fork."
  },
  {
    "id": 2373,
    "base_form": "slotted spatula",
    "meaning_fa": "کفگیر سوراخ دار",
    "sentence_en": "She lifted the fries with a slotted spatula."
  },
  {
    "id": 2372,
    "base_form": "spatula",
    "meaning_fa": "کفگیر",
    "sentence_en": "He flipped the eggs using a spatula."
  },
  {
    "id": 2371,
    "base_form": "spoon",
    "meaning_fa": "قاشق",
    "sentence_en": "She stirred the soup with a spoon."
  },
  {
    "id": 2370,
    "base_form": "lunch container",
    "meaning_fa": "ظرف غذا",
    "sentence_en": "He packed rice in a lunch container."
  },
  {
    "id": 2369,
    "base_form": "bottle",
    "meaning_fa": "بطری",
    "sentence_en": "She filled the bottle with water."
  },
  {
    "id": 2368,
    "base_form": "jar",
    "meaning_fa": "کوزه",
    "sentence_en": "He opened a jar of pickles."
  },
  {
    "id": 2367,
    "base_form": "airtight container",
    "meaning_fa": "ظرف درب دار",
    "sentence_en": "The cookies stayed fresh in an airtight container."
  },
  {
    "id": 2366,
    "base_form": "storage container",
    "meaning_fa": "ظرف نگهدارنده",
    "sentence_en": "She stored rice in a storage container."
  },
  {
    "id": 2365,
    "base_form": "soap dispenser",
    "meaning_fa": "جا مایعی",
    "sentence_en": "The soap dispenser sits next to the sink."
  },
  {
    "id": 2364,
    "base_form": "dish soap",
    "meaning_fa": "مایع ظرفشویی",
    "sentence_en": "She added dish soap to the sink."
  },
  {
    "id": 2363,
    "base_form": "scrubber",
    "meaning_fa": "ابر",
    "sentence_en": "The scrubber removed the burned spots."
  },
  {
    "id": 2362,
    "base_form": "sponge",
    "meaning_fa": "اسکاچ",
    "sentence_en": "She scrubbed the pan with a sponge."
  },
  {
    "id": 2361,
    "base_form": "colander",
    "meaning_fa": "آبکش",
    "sentence_en": "She drained the pasta in a colander."
  },
  {
    "id": 2360,
    "base_form": "kettle",
    "meaning_fa": "کتری",
    "sentence_en": "The kettle whistled on the stove."
  },
  {
    "id": 2359,
    "base_form": "deep fryer",
    "meaning_fa": "سرخ کن",
    "sentence_en": "They heated oil in the deep fryer."
  },
  {
    "id": 2358,
    "base_form": "rice cooker",
    "meaning_fa": "پلوپز",
    "sentence_en": "The rice cooker switched off automatically."
  },
  {
    "id": 2357,
    "base_form": "electric mixer",
    "meaning_fa": "همزن برقی",
    "sentence_en": "He used an electric mixer for the batter."
  },
  {
    "id": 2356,
    "base_form": "food processor",
    "meaning_fa": "غذاساز",
    "sentence_en": "The food processor chopped the vegetables evenly."
  },
  {
    "id": 2355,
    "base_form": "blender",
    "meaning_fa": "مخلوط کن",
    "sentence_en": "She blended the fruit in the blender."
  },
  {
    "id": 2354,
    "base_form": "electric kettle",
    "meaning_fa": "کتری برقی",
    "sentence_en": "The electric kettle boiled the water fast."
  },
  {
    "id": 2353,
    "base_form": "coffee maker",
    "meaning_fa": "قهوه ساز",
    "sentence_en": "He cleaned the coffee maker after use."
  },
  {
    "id": 2352,
    "base_form": "tea maker",
    "meaning_fa": "چای ساز",
    "sentence_en": "The tea maker finished brewing quickly."
  },
  {
    "id": 2351,
    "base_form": "toaster",
    "meaning_fa": "توستر",
    "sentence_en": "The toaster popped up the bread."
  },
  {
    "id": 2350,
    "base_form": "microwave",
    "meaning_fa": "مایکروویو",
    "sentence_en": "She reheated the leftovers in the microwave."
  },
  {
    "id": 2349,
    "base_form": "oven",
    "meaning_fa": "فر",
    "sentence_en": "The oven is preheating for dinner."
  },
  {
    "id": 2348,
    "base_form": "freezer",
    "meaning_fa": "فریزر",
    "sentence_en": "He stored the meat in the freezer."
  },
  {
    "id": 2347,
    "base_form": "saucer",
    "meaning_fa": "نعلبکی",
    "sentence_en": "The cup rested neatly on the saucer."
  },
  {
    "id": 2346,
    "base_form": "cup",
    "meaning_fa": "فنجان",
    "sentence_en": "She drank her coffee from a white cup."
  },
  {
    "id": 2345,
    "base_form": "glass",
    "meaning_fa": "لیوان",
    "sentence_en": "He filled the glass with cold water."
  },
  {
    "id": 2344,
    "base_form": "small bowl",
    "meaning_fa": "پیاله",
    "sentence_en": "The sauce sat in a small bowl."
  },
  {
    "id": 2343,
    "base_form": "bowl",
    "meaning_fa": "کاسه",
    "sentence_en": "She mixed the salad in a large bowl."
  },
  {
    "id": 2342,
    "base_form": "plate",
    "meaning_fa": "بشقاب",
    "sentence_en": "The plate was already on the table."
  },
  {
    "id": 2341,
    "base_form": "apron",
    "meaning_fa": "پیش بند",
    "sentence_en": "He put on an apron before cooking."
  },
  {
    "id": 2340,
    "base_form": "pot holder",
    "meaning_fa": "دستگیره",
    "sentence_en": "She grabbed the pot holder before lifting the pan."
  },
  {
    "id": 2339,
    "base_form": "pepper grinder",
    "meaning_fa": "فلفل ساب",
    "sentence_en": "He twisted the pepper grinder over the soup."
  },
  {
    "id": 2338,
    "base_form": "salt shaker",
    "meaning_fa": "نمکدان",
    "sentence_en": "She reached for the salt shaker during dinner."
  },
  {
    "id": 2337,
    "base_form": "Miss",
    "meaning_fa": "خانم",
    "sentence_en": "Miss Carter teaches math at the school."
  },
  {
    "id": 2336,
    "base_form": "pool",
    "meaning_fa": "استخر",
    "sentence_en": "The kids swam in the pool all afternoon."
  },
  {
    "id": 2335,
    "base_form": "bath",
    "meaning_fa": "حمام",
    "sentence_en": "She enjoyed a warm bath after work."
  },
  {
    "id": 2334,
    "base_form": "television",
    "meaning_fa": "تلویزیون",
    "sentence_en": "The television stayed on all night."
  },
  {
    "id": 2333,
    "base_form": "refrigerator",
    "meaning_fa": "یخچال",
    "sentence_en": "The refrigerator is full of groceries."
  },
  {
    "id": 2332,
    "base_form": "bed",
    "meaning_fa": "تختخواب",
    "sentence_en": "He lay down on the bed to rest."
  },
  {
    "id": 2331,
    "base_form": "shower",
    "meaning_fa": "دوش",
    "sentence_en": "I took a quick shower before work."
  },
  {
    "id": 2330,
    "base_form": "toilet",
    "meaning_fa": "توالت",
    "sentence_en": "The toilet stopped working this morning."
  },
  {
    "id": 2329,
    "base_form": "dining room",
    "meaning_fa": "اتاق غذاخوری",
    "sentence_en": "Dinner was served in the dining room."
  },
  {
    "id": 2328,
    "base_form": "bedroom",
    "meaning_fa": "اتاق خواب",
    "sentence_en": "The bedroom felt quiet and comfortable."
  },
  {
    "id": 2327,
    "base_form": "bathroom",
    "meaning_fa": "دستشویی",
    "sentence_en": "The bathroom is down the hall on the right."
  },
  {
    "id": 2326,
    "base_form": "bathroom",
    "meaning_fa": "حمام",
    "sentence_en": "The bathroom needs new tiles and paint."
  },
  {
    "id": 2325,
    "base_form": "floor",
    "meaning_fa": "کف",
    "sentence_en": "The floor was wet after the cleaning."
  },
  {
    "id": 2324,
    "base_form": "wall",
    "meaning_fa": "دیوار",
    "sentence_en": "A painting hung on the wall above."
  },
  {
    "id": 2323,
    "base_form": "window",
    "meaning_fa": "پنجره",
    "sentence_en": "He opened the window to get fresh air."
  },
  {
    "id": 2322,
    "base_form": "door",
    "meaning_fa": "در",
    "sentence_en": "She closed the door quietly behind her."
  },
  {
    "id": 2321,
    "base_form": "living room",
    "meaning_fa": "اتاق نشیمن",
    "sentence_en": "We watched a movie in the living room."
  },
  {
    "id": 2320,
    "base_form": "kitchen",
    "meaning_fa": "آشپزخانه",
    "sentence_en": "The kitchen smelled like fresh coffee."
  },
  {
    "id": 2319,
    "base_form": "home",
    "meaning_fa": "خانه",
    "sentence_en": "I finally felt relaxed when I got home."
  },
  {
    "id": 2318,
    "base_form": "house",
    "meaning_fa": "خانه",
    "sentence_en": "They bought a small house near the lake."
  },
  {
    "id": 2317,
    "base_form": "their",
    "meaning_fa": "صفت ملکی سوم شخص جمع",
    "sentence_en": "Their car broke down on the highway."
  },
  {
    "id": 2316,
    "base_form": "our",
    "meaning_fa": "صفت ملکی اول شخص جمع",
    "sentence_en": "Our flight was delayed because of weather."
  },
  {
    "id": 2315,
    "base_form": "her",
    "meaning_fa": "صفت ملکی سوم شخص مفرد مونث",
    "sentence_en": "She shared her notes with the class."
  },
  {
    "id": 2314,
    "base_form": "his",
    "meaning_fa": "صفت ملکی سوم شخص مفرد مذکر",
    "sentence_en": "He forgot his keys at home again."
  },
  {
    "id": 2313,
    "base_form": "your",
    "meaning_fa": "صفت ملکی دوم شخص مفرد و جمع",
    "sentence_en": "Please leave your bag by the door."
  },
  {
    "id": 2312,
    "base_form": "my",
    "meaning_fa": "صفت ملکی اول شخص مفرد",
    "sentence_en": "This is my seat near the window."
  },
  {
    "id": 2311,
    "base_form": "Mrs.",
    "meaning_fa": "خانم",
    "sentence_en": "Mrs. Adams called the school this morning."
  },
  {
    "id": 2310,
    "base_form": "Mr.",
    "meaning_fa": "آقا",
    "sentence_en": "Mr. Lee will join the meeting this afternoon."
  },
  {
    "id": 2309,
    "base_form": "people",
    "meaning_fa": "مردم",
    "sentence_en": "People gathered outside the building after work."
  },
  {
    "id": 2308,
    "base_form": "person",
    "meaning_fa": "فرد",
    "sentence_en": "That person left their phone on the table."
  },
  {
    "id": 2307,
    "base_form": "boy",
    "meaning_fa": "پسر",
    "sentence_en": "The boy kicked the ball across the yard."
  },
  {
    "id": 2306,
    "base_form": "girl",
    "meaning_fa": "دختر",
    "sentence_en": "The girl laughed while playing in the park."
  },
  {
    "id": 2305,
    "base_form": "woman",
    "meaning_fa": "زن",
    "sentence_en": "The woman opened the store early this morning."
  },
  {
    "id": 2304,
    "base_form": "man",
    "meaning_fa": "مرد",
    "sentence_en": "The man waited quietly at the bus stop."
  },
  {
    "id": 2303,
    "base_form": "pea",
    "meaning_fa": "نخودفرنگی",
    "sentence_en": "He picked a pea off his plate and laughed."
  },
  {
    "id": 2302,
    "base_form": "bow",
    "meaning_fa": "پاپیون",
    "sentence_en": "She tied a red bow around the gift box."
  },
  {
    "id": 2301,
    "base_form": "pie",
    "meaning_fa": "پای (کیک)",
    "sentence_en": "She baked an apple pie for the family dinner."
  },
  {
    "id": 2300,
    "base_form": "cow",
    "meaning_fa": "گاو",
    "sentence_en": "The cow stood quietly in the field chewing grass."
  },
  {
    "id": 2299,
    "base_form": "bee",
    "meaning_fa": "زنبور",
    "sentence_en": "A bee landed on my arm while I was gardening."
  },
  {
    "id": 2298,
    "base_form": "tea",
    "meaning_fa": "چای",
    "sentence_en": "I usually drink tea in the afternoon to relax."
  },
  {
    "id": 2297,
    "base_form": "egg",
    "meaning_fa": "تخم‌مرغ",
    "sentence_en": "She cracked an egg into the pan for breakfast."
  },
  {
    "id": 2296,
    "base_form": "toy",
    "meaning_fa": "اسباب‌بازی",
    "sentence_en": "The child refused to sleep without his favorite toy."
  },
  {
    "id": 2295,
    "base_form": "shoe",
    "meaning_fa": "کفش",
    "sentence_en": "This shoe hurts my heel after walking a few blocks."
  },
  {
    "id": 2294,
    "base_form": "key",
    "meaning_fa": "کلید",
    "sentence_en": "I left the key on the kitchen counter this morning."
  },
  {
    "id": 2293,
    "base_form": "plural",
    "meaning_fa": "جمع",
    "sentence_en": "Make sure to use the plural form of the noun here."
  },
  {
    "id": 2292,
    "base_form": "complete",
    "meaning_fa": "کامل کردن",
    "sentence_en": "It took him several months to complete the research project."
  },
  {
    "id": 2291,
    "base_form": "verb",
    "meaning_fa": "فعل",
    "sentence_en": "Every complete sentence must have at least one verb."
  },
  {
    "id": 2290,
    "base_form": "instruction",
    "meaning_fa": "دستور",
    "sentence_en": "You should follow every instruction carefully to avoid any mistakes."
  },
  {
    "id": 2289,
    "base_form": "period",
    "meaning_fa": "نقطه",
    "sentence_en": "You forgot to put a period at the end of that sentence."
  },
  {
    "id": 2287,
    "base_form": "add",
    "meaning_fa": "افزودن",
    "sentence_en": "You should add more details to your report."
  },
  {
    "id": 2286,
    "base_form": "language",
    "meaning_fa": "زبان",
    "sentence_en": "She is learning a new language to travel to France."
  },
  {
    "id": 2285,
    "base_form": "question mark",
    "meaning_fa": "علامت سوال",
    "sentence_en": "Don't forget to put a question mark at the end of your sentence."
  },
  {
    "id": 2284,
    "base_form": "question",
    "meaning_fa": "سوال",
    "sentence_en": "If you have a question about the project, feel free to ask."
  },
  {
    "id": 2283,
    "base_form": "fill in",
    "meaning_fa": "پر کردن",
    "sentence_en": "Please fill in your contact information on this application form."
  },
  {
    "id": 2282,
    "base_form": "answer",
    "meaning_fa": "پاسخ دادن",
    "sentence_en": "She didn't know how to answer his difficult question."
  },
  {
    "id": 2281,
    "base_form": "do homework",
    "meaning_fa": "تکلیف انجام دادن",
    "sentence_en": "I usually do my homework right after I get home from school."
  },
  {
    "id": 2280,
    "base_form": "noun",
    "meaning_fa": "اسم",
    "sentence_en": "The teacher asked the students to underline every noun in the paragraph."
  },
  {
    "id": 2278,
    "base_form": "mistake",
    "meaning_fa": "اشتباه",
    "sentence_en": "There is a small mistake in the final report."
  },
  {
    "id": 2277,
    "base_form": "correct",
    "meaning_fa": "صحیح",
    "sentence_en": "Please make sure all the information on this form is correct."
  },
  {
    "id": 2276,
    "base_form": "match",
    "meaning_fa": "جفت کردن",
    "sentence_en": "It takes forever to match all the socks after doing laundry."
  },
  {
    "id": 2275,
    "base_form": "grammar",
    "meaning_fa": "دستور زبان",
    "sentence_en": "Always check your grammar before submitting an important email."
  },
  {
    "id": 2274,
    "base_form": "singular",
    "meaning_fa": "مفرد",
    "sentence_en": "Make sure to use the singular form of the noun in this sentence."
  },
  {
    "id": 2273,
    "base_form": "word",
    "meaning_fa": "کلمه",
    "sentence_en": "I don't understand the meaning of this word."
  },
  {
    "id": 2272,
    "base_form": "subject",
    "meaning_fa": "فاعل",
    "sentence_en": "The subject of the sentence usually performs the action."
  },
  {
    "id": 2271,
    "base_form": "preposition",
    "meaning_fa": "حرف اضافه",
    "sentence_en": "Most English learners struggle with choosing the right preposition."
  },
  {
    "id": 2270,
    "base_form": "take a shower",
    "meaning_fa": "دوش گرفتن",
    "sentence_en": "He decided to take a shower after his long workout at the gym."
  },
  {
    "id": 2269,
    "base_form": "train",
    "meaning_fa": "قطار",
    "sentence_en": "I'm taking the morning train to the city for work."
  },
  {
    "id": 2268,
    "base_form": "example",
    "meaning_fa": "نمونه",
    "sentence_en": "Can you give me an example of how this software works?"
  },
  {
    "id": 2267,
    "base_form": "paragraph",
    "meaning_fa": "پاراگراف",
    "sentence_en": "Please read the first paragraph of the report out loud."
  },
  {
    "id": 2266,
    "base_form": "blank",
    "meaning_fa": "جای خالی",
    "sentence_en": "Please fill in the blank with your phone number."
  },
  {
    "id": 2265,
    "base_form": "phrase",
    "meaning_fa": "جمله‌واره",
    "sentence_en": "Try to include this specific phrase in your introductory paragraph."
  },
  {
    "id": 2264,
    "base_form": "sentence",
    "meaning_fa": "جمله",
    "sentence_en": "Please read the last sentence of the email again."
  },
  {
    "id": 2263,
    "base_form": "follow",
    "meaning_fa": "پیروی کردن",
    "sentence_en": "You must follow the instructions carefully to complete the task."
  },
  {
    "id": 2262,
    "base_form": "adverb",
    "meaning_fa": "قید",
    "sentence_en": "You should add an adverb to the sentence to describe the action better."
  },
  {
    "id": 2261,
    "base_form": "adjective",
    "meaning_fa": "صفت",
    "sentence_en": "An adjective usually comes before the noun in English."
  },
  {
    "id": 2259,
    "base_form": "demerit",
    "meaning_fa": "پوان منفی",
    "sentence_en": "The teacher gave him a demerit for talking during the lesson."
  },
  {
    "id": 2257,
    "base_form": "forth",
    "meaning_fa": "به جلو",
    "sentence_en": "She stepped forth from the crowd to voice her concerns."
  },
  {
    "id": 2256,
    "base_form": "requirements",
    "meaning_fa": "الزامات",
    "sentence_en": "The applicant did not meet the basic requirements for the job."
  },
  {
    "id": 2254,
    "base_form": "precisely",
    "meaning_fa": "دقیقا",
    "sentence_en": "That is precisely what I was trying to say."
  },
  {
    "id": 2244,
    "base_form": "redemption",
    "meaning_fa": "استرداد",
    "sentence_en": "The redemption of the bonds will take place at the end of the year."
  },
  {
    "id": 2242,
    "base_form": "cool off",
    "meaning_fa": "آرام کردن",
    "sentence_en": "Give him a chance to cool off before you ask any more questions."
  },
  {
    "id": 2238,
    "base_form": "verbal",
    "meaning_fa": "واژگانی",
    "sentence_en": "The test measures both mathematical and verbal ability."
  },
  {
    "id": 2235,
    "base_form": "anticipate",
    "meaning_fa": "انتظار داشتن",
    "sentence_en": "We don't anticipate any problems with the new software update."
  },
  {
    "id": 2234,
    "base_form": "utensil",
    "meaning_fa": "ابزار",
    "sentence_en": "She used a wooden utensil to stir the thick soup."
  },
  {
    "id": 2232,
    "base_form": "loot",
    "meaning_fa": "به تاراج بردن",
    "sentence_en": "Rioters began to loot the local stores during the citywide blackout."
  },
  {
    "id": 2229,
    "base_form": "rags",
    "meaning_fa": "لباس کهنه و پاره‌پاره",
    "sentence_en": "The homeless man was dressed in dirty rags."
  },
  {
    "id": 2224,
    "base_form": "reluctantly",
    "meaning_fa": "از روی کراهت",
    "sentence_en": "He reluctantly agreed to work overtime on a Friday night."
  },
  {
    "id": 2223,
    "base_form": "trauma",
    "meaning_fa": "آسیب جسمی",
    "sentence_en": "The patient suffered severe head trauma after the car accident."
  },
  {
    "id": 2220,
    "base_form": "liability",
    "meaning_fa": "مسئولیت",
    "sentence_en": "She has a legal liability to pay for the damages."
  },
  {
    "id": 2218,
    "base_form": "justice",
    "meaning_fa": "عدالت",
    "sentence_en": "The judge's decision was a victory for truth and justice."
  },
  {
    "id": 2217,
    "base_form": "jealous",
    "meaning_fa": "حسود",
    "sentence_en": "He has always been jealous of his brother's success."
  },
  {
    "id": 2216,
    "base_form": "isolate",
    "meaning_fa": "جدا کردن",
    "sentence_en": "The doctors had to isolate the patient to prevent the virus from spreading."
  },
  {
    "id": 2215,
    "base_form": "irritate",
    "meaning_fa": "آزار دادن",
    "sentence_en": "His constant whistling began to irritate everyone in the office."
  },
  {
    "id": 2214,
    "base_form": "invade",
    "meaning_fa": "حمله کردن",
    "sentence_en": "The army was prepared to invade the neighboring country at dawn."
  },
  {
    "id": 2213,
    "base_form": "intricate",
    "meaning_fa": "پیچیده",
    "sentence_en": "The watchmaker carefully assembled the intricate gears of the clock."
  },
  {
    "id": 2212,
    "base_form": "intolerable",
    "meaning_fa": "غیرقابل تحمل",
    "sentence_en": "The constant noise from the construction site became intolerable."
  },
  {
    "id": 2211,
    "base_form": "interrupt",
    "meaning_fa": "قطع کردن",
    "sentence_en": "I’m sorry to interrupt, but there’s a phone call for you."
  },
  {
    "id": 2210,
    "base_form": "interpret",
    "meaning_fa": "تفسیر کردن",
    "sentence_en": "Scientists are trying to interpret the data from the recent experiment."
  },
  {
    "id": 2209,
    "base_form": "intense",
    "meaning_fa": "شدید",
    "sentence_en": "The competition for the scholarship was very intense this year."
  },
  {
    "id": 2207,
    "base_form": "insult",
    "meaning_fa": "توهین کردن",
    "sentence_en": "Please don't insult my intelligence by lying to me."
  },
  {
    "id": 2206,
    "base_form": "insist",
    "meaning_fa": "اصرار کردن",
    "sentence_en": "I insisted on paying for the dinner myself."
  },
  {
    "id": 2205,
    "base_form": "inhabit",
    "meaning_fa": "سکونت داشتن",
    "sentence_en": "Several rare species of birds inhabit the island's coastal forests."
  },
  {
    "id": 2204,
    "base_form": "inferior",
    "meaning_fa": "پایین تر",
    "sentence_en": "The quality of this cheaper brand is clearly inferior to the original."
  },
  {
    "id": 2203,
    "base_form": "infect",
    "meaning_fa": "آلوده کردن",
    "sentence_en": "A single sneeze can infect everyone in the small room."
  },
  {
    "id": 2202,
    "base_form": "industrious",
    "meaning_fa": "کوشا",
    "sentence_en": "The most industrious employees are often rewarded with a year-end bonus."
  },
  {
    "id": 2201,
    "base_form": "indifferent",
    "meaning_fa": "بی تفاوت",
    "sentence_en": "He seemed completely indifferent to the news of his promotion."
  },
  {
    "id": 2200,
    "base_form": "indicate",
    "meaning_fa": "نشان دادن",
    "sentence_en": "The thermometer indicates that he has a slight fever."
  },
  {
    "id": 2199,
    "base_form": "impress",
    "meaning_fa": "تحت تاثیر قرار دادن",
    "sentence_en": "He tried to impress his boss with the new project results."
  },
  {
    "id": 2198,
    "base_form": "immense",
    "meaning_fa": "عظیم",
    "sentence_en": "The new museum is an immense building with dozens of galleries."
  },
  {
    "id": 2197,
    "base_form": "illusion",
    "meaning_fa": "توهم",
    "sentence_en": "He was under the illusion that he could finish the project alone."
  },
  {
    "id": 2196,
    "base_form": "ignorant",
    "meaning_fa": "نادان",
    "sentence_en": "He is not stupid, just ignorant of the current situation."
  },
  {
    "id": 2195,
    "base_form": "hurricane",
    "meaning_fa": "توفان شدید",
    "sentence_en": "The hurricane caused massive power outages across the entire state."
  },
  {
    "id": 2194,
    "base_form": "humid",
    "meaning_fa": "مرطوب",
    "sentence_en": "It’s so humid outside that my shirt is sticking to me."
  },
  {
    "id": 2193,
    "base_form": "humble",
    "meaning_fa": "فروتن",
    "sentence_en": "Despite his fame, he remains a very humble person."
  },
  {
    "id": 2192,
    "base_form": "hostile",
    "meaning_fa": "خصمانه",
    "sentence_en": "He gave me a hostile look during the meeting."
  },
  {
    "id": 2191,
    "base_form": "hazard",
    "meaning_fa": "خطر",
    "sentence_en": "Icy roads are a major hazard for drivers during the winter months."
  },
  {
    "id": 2190,
    "base_form": "hasty",
    "meaning_fa": "عجولانه",
    "sentence_en": "He regretted making a hasty decision without thinking it through."
  },
  {
    "id": 2189,
    "base_form": "grieve",
    "meaning_fa": "عزاداری کردن",
    "sentence_en": "She needs some time alone to grieve her father's passing."
  },
  {
    "id": 2188,
    "base_form": "grateful",
    "meaning_fa": "سپاسگزار",
    "sentence_en": "I am truly grateful for all the help you've given me."
  },
  {
    "id": 2187,
    "base_form": "gloomy",
    "meaning_fa": "تاریک و غمگین",
    "sentence_en": "The living room felt gloomy with all the curtains closed."
  },
  {
    "id": 2186,
    "base_form": "gleam",
    "meaning_fa": "درخشیدن",
    "sentence_en": "The polished floor gleamed in the sunlight."
  },
  {
    "id": 2185,
    "base_form": "gigantic",
    "meaning_fa": "غول پیکر",
    "sentence_en": "The company just built a gigantic warehouse on the edge of town."
  },
  {
    "id": 2183,
    "base_form": "frustrate",
    "meaning_fa": "ناامید کردن",
    "sentence_en": "The constant delays in the schedule really frustrate the team members."
  },
  {
    "id": 2182,
    "base_form": "frank",
    "meaning_fa": "صادق",
    "sentence_en": "He was completely frank with me about his reasons for leaving."
  },
  {
    "id": 2181,
    "base_form": "former",
    "meaning_fa": "قبلی",
    "sentence_en": "My former boss called me yesterday to offer a new job."
  },
  {
    "id": 2180,
    "base_form": "forgive",
    "meaning_fa": "بخشیدن",
    "sentence_en": "I find it hard to forgive people who lie to me."
  },
  {
    "id": 2179,
    "base_form": "forbid",
    "meaning_fa": "ممنوع کردن",
    "sentence_en": "The new law forbids smoking in all public parks."
  },
  {
    "id": 2177,
    "base_form": "feeble",
    "meaning_fa": "ضعیف",
    "sentence_en": "The old man was too feeble to walk without help."
  },
  {
    "id": 2176,
    "base_form": "fascinate",
    "meaning_fa": "مجذوب کردن",
    "sentence_en": "The mysteries of outer space continue to fascinate people of all ages."
  },
  {
    "id": 2175,
    "base_form": "famine",
    "meaning_fa": "قحطی",
    "sentence_en": "Millions of people are facing famine due to the ongoing war."
  },
  {
    "id": 2174,
    "base_form": "expose",
    "meaning_fa": "در معرض قرار دادن",
    "sentence_en": "Don't expose your skin to the sun for too long without sunscreen."
  },
  {
    "id": 2173,
    "base_form": "exclude",
    "meaning_fa": "حذف کردن",
    "sentence_en": "The researchers had to exclude several participants from the study."
  },
  {
    "id": 2172,
    "base_form": "excess",
    "meaning_fa": "زیادی",
    "sentence_en": "The store donates any excess of stock to local charities."
  },
  {
    "id": 2170,
    "base_form": "essential",
    "meaning_fa": "ضروری",
    "sentence_en": "Good communication is essential for a successful marriage."
  },
  {
    "id": 2169,
    "base_form": "errand",
    "meaning_fa": "کار کوتاه",
    "sentence_en": "I have a few errands to run this afternoon."
  },
  {
    "id": 2168,
    "base_form": "era",
    "meaning_fa": "دوران",
    "sentence_en": "The internet marked the beginning of a new era in communication."
  },
  {
    "id": 2166,
    "base_form": "enthusiasm",
    "meaning_fa": "اشتیاق",
    "sentence_en": "She showed great enthusiasm for the new project."
  },
  {
    "id": 2165,
    "base_form": "ensure",
    "meaning_fa": "اطمینان حاصل کردن",
    "sentence_en": "Please ensure the doors are locked before you leave the building."
  },
  {
    "id": 2164,
    "base_form": "enormous",
    "meaning_fa": "عظیم",
    "sentence_en": "The project required an enormous amount of time and effort."
  },
  {
    "id": 2163,
    "base_form": "enforce",
    "meaning_fa": "اجرا کردن (قانون)",
    "sentence_en": "The police will enforce the new speed limits starting next week."
  },
  {
    "id": 2162,
    "base_form": "endure",
    "meaning_fa": "تحمل کردن",
    "sentence_en": "He had to endure a lot of pain after the surgery."
  },
  {
    "id": 2160,
    "base_form": "emerge",
    "meaning_fa": "ظاهر شدن",
    "sentence_en": "The sun emerged from behind the thick clouds."
  },
  {
    "id": 2159,
    "base_form": "efficient",
    "meaning_fa": "کارآمد",
    "sentence_en": "She is an efficient assistant who manages the office perfectly."
  },
  {
    "id": 2158,
    "base_form": "edible",
    "meaning_fa": "قابل خوردن",
    "sentence_en": "Are you sure these wild berries are edible?"
  },
  {
    "id": 2157,
    "base_form": "duration",
    "meaning_fa": "مدت زمان",
    "sentence_en": "Please remain seated for the entire duration of the presentation."
  },
  {
    "id": 2156,
    "base_form": "duplicate",
    "meaning_fa": "کپی کردن",
    "sentence_en": "I need to duplicate these files for everyone in the meeting."
  },
  {
    "id": 2155,
    "base_form": "dread",
    "meaning_fa": "ترسیدن",
    "sentence_en": "I dread going to the dentist for my annual checkup."
  },
  {
    "id": 2154,
    "base_form": "dominate",
    "meaning_fa": "تسلط داشتن",
    "sentence_en": "She tends to dominate every conversation we have."
  },
  {
    "id": 2153,
    "base_form": "distress",
    "meaning_fa": "ناراحتی شدید",
    "sentence_en": "The news of the accident caused her great emotional distress."
  },
  {
    "id": 2152,
    "base_form": "distinguish",
    "meaning_fa": "تشخیص دادن",
    "sentence_en": "It is often hard to distinguish between the two different shades of blue."
  },
  {
    "id": 2151,
    "base_form": "distinct",
    "meaning_fa": "متمایز",
    "sentence_en": "The admin and customer areas have distinct layouts."
  },
  {
    "id": 2150,
    "base_form": "dissent",
    "meaning_fa": "مخالفت",
    "sentence_en": "There was significant dissent within the party regarding the new policy."
  },
  {
    "id": 2149,
    "base_form": "dismal",
    "meaning_fa": "تاریک و غمگین",
    "sentence_en": "The weather has been dismal and rainy all week."
  },
  {
    "id": 2147,
    "base_form": "disguise",
    "meaning_fa": "تغییر قیافه دادن",
    "sentence_en": "She disguised herself as a reporter to get into the press conference."
  },
  {
    "id": 2146,
    "base_form": "diminish",
    "meaning_fa": "کاهش دادن",
    "sentence_en": "The new law will diminish the influence of local government officials."
  },
  {
    "id": 2145,
    "base_form": "dictate",
    "meaning_fa": "دیکته کردن",
    "sentence_en": "The executive used a digital recorder to dictate her weekly report."
  },
  {
    "id": 2144,
    "base_form": "devour",
    "meaning_fa": "بلعیدن",
    "sentence_en": "He was so hungry that he devoured the whole pizza in minutes."
  },
  {
    "id": 2143,
    "base_form": "devote",
    "meaning_fa": "اختصاص دادن",
    "sentence_en": "She decided to devote her weekends to volunteering at the shelter."
  },
  {
    "id": 2142,
    "base_form": "detect",
    "meaning_fa": "تشخیص دادن",
    "sentence_en": "The new sensors can detect even the smallest gas leaks."
  },
  {
    "id": 2141,
    "base_form": "destiny",
    "meaning_fa": "سرنوشت",
    "sentence_en": "She felt it was her destiny to become a doctor."
  },
  {
    "id": 2139,
    "base_form": "desperate",
    "meaning_fa": "ناامید",
    "sentence_en": "He grew increasingly desperate as the search for his missing dog continued."
  },
  {
    "id": 2137,
    "base_form": "derive",
    "meaning_fa": "گرفتن",
    "sentence_en": "She derives a lot of pleasure from her morning walks."
  },
  {
    "id": 2136,
    "base_form": "deprive",
    "meaning_fa": "محروم کردن",
    "sentence_en": "The new law might deprive many citizens of their basic rights."
  },
  {
    "id": 2134,
    "base_form": "delicate",
    "meaning_fa": "ظریف",
    "sentence_en": "The lace on the wedding dress was incredibly delicate."
  },
  {
    "id": 2132,
    "base_form": "deliberate",
    "meaning_fa": "عمدی",
    "sentence_en": "He made a deliberate attempt to ignore my phone calls."
  },
  {
    "id": 2131,
    "base_form": "defend",
    "meaning_fa": "دفاع کردن",
    "sentence_en": "The soldiers were prepared to defend their country against any attack."
  },
  {
    "id": 2130,
    "base_form": "defeat",
    "meaning_fa": "شکست دادن",
    "sentence_en": "They worked hard to defeat their rivals in the championship match."
  },
  {
    "id": 2128,
    "base_form": "deceive",
    "meaning_fa": "فریب دادن",
    "sentence_en": "He tried to deceive his business partner about the company's actual profits."
  },
  {
    "id": 2127,
    "base_form": "curve",
    "meaning_fa": "منحنی",
    "sentence_en": "The road follows the natural curve of the coastline."
  },
  {
    "id": 2125,
    "base_form": "current",
    "meaning_fa": "جاری",
    "sentence_en": "Our current project will be finished by the end of this month."
  },
  {
    "id": 2123,
    "base_form": "cruel",
    "meaning_fa": "بی رحم",
    "sentence_en": "It was cruel of him to leave the dog outside in the cold."
  },
  {
    "id": 2122,
    "base_form": "crisis",
    "meaning_fa": "بحران",
    "sentence_en": "We need a leader who can stay calm during a crisis."
  },
  {
    "id": 2120,
    "base_form": "counsel",
    "meaning_fa": "مشاوره دادن",
    "sentence_en": "He spends his time counseling young people about their career paths."
  },
  {
    "id": 2119,
    "base_form": "council",
    "meaning_fa": "شورا",
    "sentence_en": "The city council is meeting today to discuss the new budget."
  },
  {
    "id": 2117,
    "base_form": "correspond",
    "meaning_fa": "مطابقت داشتن",
    "sentence_en": "The numbers on the receipt do not correspond with the bank statement."
  },
  {
    "id": 2115,
    "base_form": "core",
    "meaning_fa": "هسته",
    "sentence_en": "The Earth's core is made of solid iron and nickel."
  },
  {
    "id": 2114,
    "base_form": "cope",
    "meaning_fa": "کنار آمدن",
    "sentence_en": "She found it difficult to cope with the pressure of her new job."
  },
  {
    "id": 2113,
    "base_form": "convenient",
    "meaning_fa": "راحت",
    "sentence_en": "Is this a convenient time for us to talk?"
  },
  {
    "id": 2112,
    "base_form": "controversy",
    "meaning_fa": "بحث و جدل",
    "sentence_en": "The new housing development has caused a lot of controversy in the neighborhood."
  },
  {
    "id": 2111,
    "base_form": "contradict",
    "meaning_fa": "مخالف بودن",
    "sentence_en": "His actions often contradict his words."
  },
  {
    "id": 2109,
    "base_form": "considerable",
    "meaning_fa": "قابل توجه",
    "sentence_en": "The project will require a considerable amount of time and effort."
  },
  {
    "id": 2108,
    "base_form": "conquer",
    "meaning_fa": "فتح کردن",
    "sentence_en": "The army finally conquered the city after a long siege."
  },
  {
    "id": 2106,
    "base_form": "conflict",
    "meaning_fa": "درگیری",
    "sentence_en": "We need to find a way to resolve this conflict before it gets worse."
  },
  {
    "id": 2105,
    "base_form": "confess",
    "meaning_fa": "اعتراف کردن",
    "sentence_en": "He finally confessed to stealing the money from the office."
  },
  {
    "id": 2103,
    "base_form": "conclude",
    "meaning_fa": "نتیجه گرفتن",
    "sentence_en": "From the evidence, we can conclude that the fire was accidental."
  },
  {
    "id": 2102,
    "base_form": "compete",
    "meaning_fa": "رقابت کردن",
    "sentence_en": "Athletes from all over the world compete in the Olympic Games."
  },
  {
    "id": 2100,
    "base_form": "collide",
    "meaning_fa": "تصادف کردن",
    "sentence_en": "Two cars collided on the highway during the heavy rainstorm."
  },
  {
    "id": 2098,
    "base_form": "collapse",
    "meaning_fa": "فرو ریختن",
    "sentence_en": "The old building collapsed during the massive earthquake last night."
  },
  {
    "id": 2096,
    "base_form": "clash",
    "meaning_fa": "درگیر شدن",
    "sentence_en": "Protesters clashed with the police during the demonstration."
  },
  {
    "id": 2095,
    "base_form": "circulate",
    "meaning_fa": "گردش کردن",
    "sentence_en": "The ceiling fan helps to circulate the air in the room."
  },
  {
    "id": 2093,
    "base_form": "chief",
    "meaning_fa": "رئیس",
    "sentence_en": "The fire chief gave the order to evacuate the building immediately."
  },
  {
    "id": 2092,
    "base_form": "cherish",
    "meaning_fa": "عزیز داشتن",
    "sentence_en": "I will always cherish the memories of our summer vacation."
  },
  {
    "id": 2091,
    "base_form": "chase",
    "meaning_fa": "تعقیب کردن",
    "sentence_en": "The police had to chase the suspect through the crowded park."
  },
  {
    "id": 2090,
    "base_form": "chamber",
    "meaning_fa": "اتاق",
    "sentence_en": "The senators gathered in the main chamber to discuss the bill."
  },
  {
    "id": 2088,
    "base_form": "challenge",
    "meaning_fa": "چالش",
    "sentence_en": "Finding a new job in this economy is a real challenge."
  },
  {
    "id": 2087,
    "base_form": "celebrity",
    "meaning_fa": "شخص معروف",
    "sentence_en": "She became a global celebrity after her first movie role."
  },
  {
    "id": 2086,
    "base_form": "cease",
    "meaning_fa": "متوقف شدن",
    "sentence_en": "The heavy rain finally ceased after several hours."
  },
  {
    "id": 2085,
    "base_form": "cautious",
    "meaning_fa": "محتاط",
    "sentence_en": "You should be more cautious when walking alone at night."
  },
  {
    "id": 2084,
    "base_form": "casual",
    "meaning_fa": "غیررسمی",
    "sentence_en": "He usually wears casual clothes when he is not at work."
  },
  {
    "id": 2082,
    "base_form": "carve",
    "meaning_fa": "حکاکی کردن",
    "sentence_en": "The artist used a small knife to carve a bird from wood."
  },
  {
    "id": 2081,
    "base_form": "captive",
    "meaning_fa": "اسیر",
    "sentence_en": "The rebels released the captive after two weeks of negotiations."
  },
  {
    "id": 2077,
    "base_form": "adore",
    "meaning_fa": "عاشق بودن",
    "sentence_en": "Most people adore her for her incredible sense of humor."
  },
  {
    "id": 2076,
    "base_form": "competent",
    "meaning_fa": "لایق",
    "sentence_en": "She is a highly competent manager who knows how to handle stress."
  },
  {
    "id": 2074,
    "base_form": "asshole",
    "meaning_fa": "آدم عوضی",
    "sentence_en": "He was being a total asshole to the waiter last night."
  },
  {
    "id": 2072,
    "base_form": "ball",
    "meaning_fa": "توپ",
    "sentence_en": "The kids are playing with a ball in the backyard."
  },
  {
    "id": 2067,
    "base_form": "care",
    "meaning_fa": "مراقبت",
    "sentence_en": "The patient needs professional medical care to recover fully at home."
  },
  {
    "id": 2064,
    "base_form": "screening",
    "meaning_fa": "غربالگری",
    "sentence_en": "The doctor recommended a routine cancer screening for all patients over fifty."
  },
  {
    "id": 2063,
    "base_form": "crossing",
    "meaning_fa": "گذرگاه عابر",
    "sentence_en": "Always use the marked crossing to get to the other side of the street."
  },
  {
    "id": 2062,
    "base_form": "detour",
    "meaning_fa": "مسیر انحرافی",
    "sentence_en": "We had to take a detour because the main road was closed."
  },
  {
    "id": 2061,
    "base_form": "quit",
    "meaning_fa": "استعفا دادن",
    "sentence_en": "He quit his position at the bank to start his own business."
  },
  {
    "id": 2060,
    "base_form": "innovation",
    "meaning_fa": "نوآوری",
    "sentence_en": "Constant innovation is the key to staying competitive in today's market."
  },
  {
    "id": 2059,
    "base_form": "innovate",
    "meaning_fa": "نوآوری کردن",
    "sentence_en": "Companies must innovate constantly to stay ahead of their competitors."
  },
  {
    "id": 2058,
    "base_form": "bill",
    "meaning_fa": "صورتحساب",
    "sentence_en": "The waiter brought the bill as soon as we finished our meal."
  },
  {
    "id": 2057,
    "base_form": "collaborative",
    "meaning_fa": "مشارکتی",
    "sentence_en": "The team used a collaborative approach to solve the complex problem."
  },
  {
    "id": 2056,
    "base_form": "swipe",
    "meaning_fa": "کشیدن کارت",
    "sentence_en": "You need to swipe your card to enter the building."
  },
  {
    "id": 2055,
    "base_form": "discard",
    "meaning_fa": "دور انداختن",
    "sentence_en": "You should discard these old magazines to clear some space."
  },
  {
    "id": 2054,
    "base_form": "referee",
    "meaning_fa": "معرف",
    "sentence_en": "Please provide the names of two referees who can vouch for your work."
  },
  {
    "id": 2053,
    "base_form": "trivia",
    "meaning_fa": "اطلاعات کم‌اهمیت",
    "sentence_en": "He has an incredible memory for sports trivia."
  },
  {
    "id": 2052,
    "base_form": "redundancy",
    "meaning_fa": "تعدیل نیرو",
    "sentence_en": "Many workers are facing redundancy as the company struggles financially."
  },
  {
    "id": 2051,
    "base_form": "dole",
    "meaning_fa": "بیمه بیکاری",
    "sentence_en": "He has been on the dole for several months after losing his job."
  },
  {
    "id": 2050,
    "base_form": "cash in hand",
    "meaning_fa": "پرداخت نقدی",
    "sentence_en": "The seller requested cash in hand before handing over the keys."
  },
  {
    "id": 2049,
    "base_form": "sanitary towel",
    "meaning_fa": "نوار بهداشتی",
    "sentence_en": "She realized she forgot to pack sanitary towels for her trip."
  },
  {
    "id": 2048,
    "base_form": "empathy",
    "meaning_fa": "همدلی",
    "sentence_en": "She has a deep sense of empathy for people in need."
  },
  {
    "id": 2047,
    "base_form": "cure",
    "meaning_fa": "درمان کردن",
    "sentence_en": "Scientists are working hard to cure the common cold."
  },
  {
    "id": 2046,
    "base_form": "offensive",
    "meaning_fa": "توهین‌آمیز",
    "sentence_en": "His offensive comments during the meeting upset everyone."
  },
  {
    "id": 2045,
    "base_form": "greedy",
    "meaning_fa": "حریص",
    "sentence_en": "The greedy CEO refused to give his employees a raise."
  },
  {
    "id": 2044,
    "base_form": "picky",
    "meaning_fa": "سخت‌گیر",
    "sentence_en": "My sister is a very picky eater and hates vegetables."
  },
  {
    "id": 2043,
    "base_form": "permanent",
    "meaning_fa": "دائمی",
    "sentence_en": "She is looking for a permanent job after working as a freelancer."
  },
  {
    "id": 2042,
    "base_form": "extensible",
    "meaning_fa": "قابل گسترش",
    "sentence_en": "The new software architecture is highly extensible for future updates."
  },
  {
    "id": 2041,
    "base_form": "precise",
    "meaning_fa": "دقیق",
    "sentence_en": "We need the precise measurements before we start building the table."
  },
  {
    "id": 2040,
    "base_form": "embed",
    "meaning_fa": "جاسازی کردن",
    "sentence_en": "The jeweler will embed a small diamond in the center of the ring."
  },
  {
    "id": 2039,
    "base_form": "master",
    "meaning_fa": "مسلط شدن",
    "sentence_en": "It took him years to master the art of woodworking."
  },
  {
    "id": 2038,
    "base_form": "brush up",
    "meaning_fa": "مرور کردن",
    "sentence_en": "I need to brush up on my Spanish before the trip."
  },
  {
    "id": 2037,
    "base_form": "content",
    "meaning_fa": "محتوا",
    "sentence_en": "He creates high-quality content for his YouTube channel every week."
  },
  {
    "id": 2036,
    "base_form": "greatly",
    "meaning_fa": "بسیار",
    "sentence_en": "I greatly appreciate your help with the project."
  },
  {
    "id": 2035,
    "base_form": "variant",
    "meaning_fa": "گونه",
    "sentence_en": "Scientists are studying a more contagious variant of the virus."
  },
  {
    "id": 2034,
    "base_form": "inconvenience",
    "meaning_fa": "دردسر",
    "sentence_en": "I am sorry for the inconvenience caused by the late delivery."
  },
  {
    "id": 2033,
    "base_form": "cooperation",
    "meaning_fa": "همکاری",
    "sentence_en": "The project's success depended on the close cooperation of all team members."
  },
  {
    "id": 2032,
    "base_form": "inform",
    "meaning_fa": "اطلاع دادن",
    "sentence_en": "Please inform the office if you are going to be late."
  },
  {
    "id": 2030,
    "base_form": "conduct",
    "meaning_fa": "انجام دادن",
    "sentence_en": "The researchers will conduct a series of interviews next week."
  },
  {
    "id": 2029,
    "base_form": "soundtrack",
    "meaning_fa": "موسیقی متن",
    "sentence_en": "The movie's soundtrack became more popular than the film itself."
  },
  {
    "id": 2028,
    "base_form": "aggressive",
    "meaning_fa": "پرخاشگر",
    "sentence_en": "The aggressive driver started yelling at everyone in traffic."
  },
  {
    "id": 2027,
    "base_form": "narrowly",
    "meaning_fa": "به‌سختی",
    "sentence_en": "The candidate narrowly won the election by only a few votes."
  },
  {
    "id": 2026,
    "base_form": "genuinely",
    "meaning_fa": "واقعاً",
    "sentence_en": "He seemed genuinely interested in what I had to say."
  },
  {
    "id": 2025,
    "base_form": "involvement",
    "meaning_fa": "دخالت",
    "sentence_en": "The police found no evidence of his involvement in the crime."
  },
  {
    "id": 2024,
    "base_form": "circumstances",
    "meaning_fa": "شرایط",
    "sentence_en": "We had to cancel our plans due to unforeseen circumstances."
  },
  {
    "id": 2023,
    "base_form": "vary",
    "meaning_fa": "متفاوت بودن",
    "sentence_en": "Prices for the same hotel room vary depending on the season."
  },
  {
    "id": 2022,
    "base_form": "cut off",
    "meaning_fa": "قطع کردن",
    "sentence_en": "You should cut off the dead branches to help the tree grow."
  },
  {
    "id": 2021,
    "base_form": "get out of doing something",
    "meaning_fa": "طفره رفتن",
    "sentence_en": "He always tries to get out of doing the dishes after dinner."
  },
  {
    "id": 2020,
    "base_form": "settle",
    "meaning_fa": "اقامت کردن",
    "sentence_en": "After traveling for years, they finally settled in California."
  },
  {
    "id": 2019,
    "base_form": "descend",
    "meaning_fa": "پایین آمدن",
    "sentence_en": "The hikers started to descend the mountain before sunset."
  },
  {
    "id": 2018,
    "base_form": "get off",
    "meaning_fa": "پیاده شدن",
    "sentence_en": "We need to get off the bus at the next stop."
  },
  {
    "id": 2017,
    "base_form": "get on",
    "meaning_fa": "سوار شدن",
    "sentence_en": "We should get on the train before it leaves the station."
  },
  {
    "id": 2016,
    "base_form": "booth",
    "meaning_fa": "کیوسک",
    "sentence_en": "You can buy your tickets at the small booth near the entrance."
  },
  {
    "id": 2015,
    "base_form": "platform",
    "meaning_fa": "سکو",
    "sentence_en": "The train for New York is waiting at platform six."
  },
  {
    "id": 2014,
    "base_form": "express",
    "meaning_fa": "سریع‌السیر",
    "sentence_en": "I caught the morning express to get to the meeting on time."
  },
  {
    "id": 2013,
    "base_form": "compartment",
    "meaning_fa": "کوپه",
    "sentence_en": "We found our compartment and placed our luggage under the seat."
  },
  {
    "id": 2012,
    "base_form": "cab",
    "meaning_fa": "تاکسی",
    "sentence_en": "I took a cab to the airport because I was running late."
  },
  {
    "id": 2011,
    "base_form": "beforehand",
    "meaning_fa": "از پیش",
    "sentence_en": "Please let us know beforehand if you have any food allergies."
  },
  {
    "id": 2010,
    "base_form": "goods",
    "meaning_fa": "کالا",
    "sentence_en": "The store offers a wide variety of high-quality goods."
  },
  {
    "id": 2009,
    "base_form": "customs duty",
    "meaning_fa": "عوارض گمرکی",
    "sentence_en": "You have to pay customs duty on items worth over a thousand dollars."
  },
  {
    "id": 2008,
    "base_form": "duty-free",
    "meaning_fa": "معاف از عوارض",
    "sentence_en": "I bought this expensive bottle of perfume at the duty-free shop."
  },
  {
    "id": 2007,
    "base_form": "customs",
    "meaning_fa": "گمرک",
    "sentence_en": "The customs officers checked all the suitcases for illegal items."
  },
  {
    "id": 2006,
    "base_form": "declare",
    "meaning_fa": "اعلام کردن",
    "sentence_en": "The airline was forced to declare bankruptcy after the financial crisis."
  },
  {
    "id": 2005,
    "base_form": "conveyor",
    "meaning_fa": "نوار نقاله",
    "sentence_en": "Wait for your luggage to appear on the conveyor belt."
  },
  {
    "id": 2004,
    "base_form": "fetch",
    "meaning_fa": "آوردن",
    "sentence_en": "Could you please fetch me a glass of water from the kitchen?"
  },
  {
    "id": 2003,
    "base_form": "trolley",
    "meaning_fa": "چرخ‌دستی",
    "sentence_en": "She loaded her heavy suitcases onto the airport trolley."
  },
  {
    "id": 2002,
    "base_form": "baggage claim",
    "meaning_fa": "تحویل بار",
    "sentence_en": "We waited at the baggage claim for over thirty minutes."
  },
  {
    "id": 2001,
    "base_form": "co-wife",
    "meaning_fa": "هوو",
    "sentence_en": "She gets along surprisingly well with her co-wife."
  },
  {
    "id": 2000,
    "base_form": "co-pilot",
    "meaning_fa": "کمک‌خلبان",
    "sentence_en": "The co-pilot took over the controls while the captain rested."
  },
  {
    "id": 1999,
    "base_form": "departure lounge",
    "meaning_fa": "سالن خروج",
    "sentence_en": "We had a coffee in the departure lounge before boarding the plane."
  },
  {
    "id": 1998,
    "base_form": "boarding pass",
    "meaning_fa": "کارت پرواز",
    "sentence_en": "Please have your passport and boarding pass ready at the gate."
  },
  {
    "id": 1997,
    "base_form": "flight attendant",
    "meaning_fa": "مهماندار هواپیما",
    "sentence_en": "The flight attendant helped the passengers with their heavy luggage."
  },
  {
    "id": 1996,
    "base_form": "boarding",
    "meaning_fa": "سوار شدن",
    "sentence_en": "The gate agent announced that boarding for the flight has started."
  },
  {
    "id": 1995,
    "base_form": "excess weight",
    "meaning_fa": "بار اضافه",
    "sentence_en": "The airline charged her a fee for the excess weight of her luggage."
  },
  {
    "id": 1994,
    "base_form": "upright",
    "meaning_fa": "راست",
    "sentence_en": "She struggled to keep the heavy ladder upright in the wind."
  },
  {
    "id": 1993,
    "base_form": "extinguish",
    "meaning_fa": "خاموش کردن",
    "sentence_en": "Firefighters worked for several hours to extinguish the massive blaze."
  },
  {
    "id": 1992,
    "base_form": "round trip",
    "meaning_fa": "رفت و برگشت",
    "sentence_en": "We booked a round trip flight for our summer vacation in Hawaii."
  },
  {
    "id": 1991,
    "base_form": "area code",
    "meaning_fa": "پیش‌شماره",
    "sentence_en": "I didn't recognize the area code, so I didn't answer the call."
  },
  {
    "id": 1990,
    "base_form": "crossed lines",
    "meaning_fa": "خط رو خط شده",
    "sentence_en": "I think we have got our lines crossed regarding the meeting location."
  },
  {
    "id": 1989,
    "base_form": "prank",
    "meaning_fa": "شوخی عملی",
    "sentence_en": "The students got in trouble for their senior prank."
  },
  {
    "id": 1988,
    "base_form": "initially",
    "meaning_fa": "در ابتدا",
    "sentence_en": "Initially, the project was supposed to take only two weeks."
  },
  {
    "id": 1985,
    "base_form": "extract",
    "meaning_fa": "استخراج کردن",
    "sentence_en": "Companies extract oil from deep beneath the ocean floor."
  },
  {
    "id": 1984,
    "base_form": "slippery",
    "meaning_fa": "لغزنده",
    "sentence_en": "The sidewalk was extremely slippery after the freezing rain."
  },
  {
    "id": 1976,
    "base_form": "assets",
    "meaning_fa": "دارایی‌ها",
    "sentence_en": "The company had to sell its assets to pay off the debt."
  },
  {
    "id": 1975,
    "base_form": "broad",
    "meaning_fa": "گسترده",
    "sentence_en": "The new policy received broad support from the local community."
  },
  {
    "id": 1974,
    "base_form": "realization",
    "meaning_fa": "تحقق",
    "sentence_en": "The realization of his lifelong dream took years of hard work."
  },
  {
    "id": 1973,
    "base_form": "cohesive",
    "meaning_fa": "منسجم",
    "sentence_en": "They succeeded because they worked together as a cohesive unit."
  },
  {
    "id": 1972,
    "base_form": "turnaround",
    "meaning_fa": "چرخش نتیجه",
    "sentence_en": "The company's incredible turnaround this year saved it from bankruptcy."
  },
  {
    "id": 1971,
    "base_form": "innovative",
    "meaning_fa": "خلاق",
    "sentence_en": "She came up with an innovative solution to the storage problem."
  },
  {
    "id": 1970,
    "base_form": "revision",
    "meaning_fa": "بازبینی",
    "sentence_en": "The manager asked for a quick revision of the contract before signing."
  },
  {
    "id": 1969,
    "base_form": "initial",
    "meaning_fa": "اولیه",
    "sentence_en": "The initial reaction to the new policy was quite positive."
  },
  {
    "id": 1968,
    "base_form": "leverage",
    "meaning_fa": "اهرم فشار",
    "sentence_en": "The company used its market position to leverage a better deal."
  },
  {
    "id": 1967,
    "base_form": "comprehensive",
    "meaning_fa": "جامع",
    "sentence_en": "The company offers a comprehensive training program for new employees."
  },
  {
    "id": 1966,
    "base_form": "compelling",
    "meaning_fa": "قانع‌کننده",
    "sentence_en": "The lawyer presented a compelling argument to the jury."
  },
  {
    "id": 1965,
    "base_form": "diverse",
    "meaning_fa": "متنوع",
    "sentence_en": "The city has a diverse population with people from all over the world."
  },
  {
    "id": 1964,
    "base_form": "collaborate",
    "meaning_fa": "همکاری کردن",
    "sentence_en": "We should collaborate with the design team to finish the website."
  },
  {
    "id": 1963,
    "base_form": "stunning",
    "meaning_fa": "جذاب",
    "sentence_en": "She looked stunning in her new evening gown at the party."
  },
  {
    "id": 1962,
    "base_form": "informative",
    "meaning_fa": "آموزنده",
    "sentence_en": "The documentary was very informative and covered all the key details."
  },
  {
    "id": 1961,
    "base_form": "annoy",
    "meaning_fa": "اذیت کردن",
    "sentence_en": "The loud construction noise outside really annoys me when I'm working."
  },
  {
    "id": 1960,
    "base_form": "neutral",
    "meaning_fa": "خنثی",
    "sentence_en": "The journalist tried to remain neutral while reporting on the election."
  },
  {
    "id": 1959,
    "base_form": "lay",
    "meaning_fa": "قرار دادن",
    "sentence_en": "Please lay the book on the table when you are finished."
  },
  {
    "id": 1958,
    "base_form": "regards",
    "meaning_fa": "با احترام",
    "sentence_en": "The email closing was simply 'regards'."
  },
  {
    "id": 1957,
    "base_form": "in regard to",
    "meaning_fa": "در ارتباط با",
    "sentence_en": "I am calling in regard to the email you sent yesterday."
  },
  {
    "id": 1956,
    "base_form": "consistent",
    "meaning_fa": "ثابت",
    "sentence_en": "The baker provides consistent quality in all of his daily products."
  },
  {
    "id": 1955,
    "base_form": "issue",
    "meaning_fa": "مسئله",
    "sentence_en": "We need to discuss this important issue during our next meeting."
  },
  {
    "id": 1954,
    "base_form": "versus",
    "meaning_fa": "در برابر",
    "sentence_en": "We need to weigh the costs versus the benefits before deciding."
  },
  {
    "id": 1953,
    "base_form": "desirable",
    "meaning_fa": "مطلوب",
    "sentence_en": "The coastal area is a very desirable location for a summer home."
  },
  {
    "id": 1952,
    "base_form": "specify",
    "meaning_fa": "مشخص کردن",
    "sentence_en": "Please specify the exact date and time for our meeting."
  },
  {
    "id": 1951,
    "base_form": "accuse",
    "meaning_fa": "متهم کردن",
    "sentence_en": "Don't accuse me of lying just because you're angry."
  },
  {
    "id": 1950,
    "base_form": "substance",
    "meaning_fa": "ماده",
    "sentence_en": "Scientists are investigating a mysterious substance discovered in the cave."
  },
  {
    "id": 1949,
    "base_form": "indescribable",
    "meaning_fa": "وصف‌ناپذیر",
    "sentence_en": "The view from the top of the mountain was simply indescribable."
  },
  {
    "id": 1947,
    "base_form": "associated",
    "meaning_fa": "مرتبط",
    "sentence_en": "There are several health risks associated with a sedentary lifestyle."
  },
  {
    "id": 1943,
    "base_form": "torture",
    "meaning_fa": "شکنجه",
    "sentence_en": "The guards tortured the prisoner to get a confession."
  },
  {
    "id": 1942,
    "base_form": "detox",
    "meaning_fa": "سم‌زدایی",
    "sentence_en": "She plans to detox her body before starting a new diet."
  },
  {
    "id": 1941,
    "base_form": "practically",
    "meaning_fa": "عملاً",
    "sentence_en": "It is practically impossible to find a parking spot here."
  },
  {
    "id": 1940,
    "base_form": "scratch",
    "meaning_fa": "خاراندن",
    "sentence_en": "He had to scratch his arm after a mosquito bit him."
  },
  {
    "id": 1939,
    "base_form": "itch",
    "meaning_fa": "خارش کردن",
    "sentence_en": "My eyes always itch during allergy season."
  },
  {
    "id": 1938,
    "base_form": "assistance",
    "meaning_fa": "کمک",
    "sentence_en": "She asked for assistance when her car broke down on the highway."
  },
  {
    "id": 1937,
    "base_form": "drain",
    "meaning_fa": "تخلیه کردن",
    "sentence_en": "The plumber had to drain the sink to fix the pipe."
  },
  {
    "id": 1936,
    "base_form": "landfill",
    "meaning_fa": "محل دفن زباله",
    "sentence_en": "The city decided to build a new landfill outside of town."
  },
  {
    "id": 1935,
    "base_form": "embody",
    "meaning_fa": "در بر گرفتن",
    "sentence_en": "The latest smartphone model will embody several innovative features."
  },
  {
    "id": 1930,
    "base_form": "commodity",
    "meaning_fa": "کالا",
    "sentence_en": "The price of every basic commodity has increased significantly this year."
  },
  {
    "id": 1929,
    "base_form": "terms",
    "meaning_fa": "شرایط",
    "sentence_en": "Please read the terms of the agreement before you sign it."
  },
  {
    "id": 1928,
    "base_form": "mattress",
    "meaning_fa": "تشک",
    "sentence_en": "We decided to buy a new mattress for the guest room."
  },
  {
    "id": 1927,
    "base_form": "dust",
    "meaning_fa": "گرد و خاک",
    "sentence_en": "She wiped the dust off the coffee table before the guests arrived."
  },
  {
    "id": 1926,
    "base_form": "poverty",
    "meaning_fa": "فقر",
    "sentence_en": "Many families in this area are living in extreme poverty."
  },
  {
    "id": 1925,
    "base_form": "leftover",
    "meaning_fa": "باقی‌مانده",
    "sentence_en": "We used the leftover pizza for our lunch the next day."
  },
  {
    "id": 1924,
    "base_form": "heat up",
    "meaning_fa": "گرم کردن",
    "sentence_en": "I need to heat up some leftovers for dinner tonight."
  },
  {
    "id": 1923,
    "base_form": "stepchild",
    "meaning_fa": "فرزند ناتنی",
    "sentence_en": "She has a great relationship with her stepchild from a previous marriage."
  },
  {
    "id": 1922,
    "base_form": "sibling",
    "meaning_fa": "خواهر یا برادر",
    "sentence_en": "Growing up, I always wanted a sibling to play with."
  },
  {
    "id": 1921,
    "base_form": "tear",
    "meaning_fa": "پاره کردن",
    "sentence_en": "He accidentally tore his favorite shirt while climbing over the fence."
  },
  {
    "id": 1920,
    "base_form": "stove",
    "meaning_fa": "اجاق",
    "sentence_en": "I forgot to turn off the stove before leaving the house."
  },
  {
    "id": 1919,
    "base_form": "enlarge",
    "meaning_fa": "بزرگ کردن",
    "sentence_en": "The hotel plans to enlarge its lobby to accommodate more guests."
  },
  {
    "id": 1918,
    "base_form": "dairy",
    "meaning_fa": "لبنی",
    "sentence_en": "She decided to cut out all dairy products from her diet."
  },
  {
    "id": 1917,
    "base_form": "beverage",
    "meaning_fa": "نوشیدنی",
    "sentence_en": "We offer a wide variety of alcoholic and non-alcoholic beverages."
  },
  {
    "id": 1916,
    "base_form": "mention",
    "meaning_fa": "اشاره کردن",
    "sentence_en": "She forgot to mention that the meeting was canceled."
  },
  {
    "id": 1915,
    "base_form": "hang",
    "meaning_fa": "آویزان کردن",
    "sentence_en": "Please hang your coat on the hook by the door."
  },
  {
    "id": 1914,
    "base_form": "destructive",
    "meaning_fa": "ویرانگر",
    "sentence_en": "The storm caused destructive damage to many homes along the coast."
  },
  {
    "id": 1913,
    "base_form": "contract",
    "meaning_fa": "قرارداد بستن",
    "sentence_en": "The company decided to contract with a local firm for the construction."
  },
  {
    "id": 1912,
    "base_form": "yell",
    "meaning_fa": "داد زدن",
    "sentence_en": "Don't yell inside the house while the baby is sleeping."
  },
  {
    "id": 1911,
    "base_form": "incident",
    "meaning_fa": "حادثه",
    "sentence_en": "The police are currently investigating the incident that occurred downtown."
  },
  {
    "id": 1910,
    "base_form": "lively",
    "meaning_fa": "سرزنده",
    "sentence_en": "The city has a very lively atmosphere on the weekends."
  },
  {
    "id": 1909,
    "base_form": "regretful",
    "meaning_fa": "پشیمان",
    "sentence_en": "She looked quite regretful after turning down the job offer."
  },
  {
    "id": 1908,
    "base_form": "tropical",
    "meaning_fa": "گرمسیری",
    "sentence_en": "We are planning a vacation to a tropical island this summer."
  },
  {
    "id": 1907,
    "base_form": "auger",
    "meaning_fa": "مته مارپیچ",
    "sentence_en": "He used a hand auger to drill holes for the new fence posts."
  },
  {
    "id": 1906,
    "base_form": "vibrant",
    "meaning_fa": "سرزنده",
    "sentence_en": "She has such a vibrant personality that she lights up every room."
  },
  {
    "id": 1905,
    "base_form": "yield",
    "meaning_fa": "بازده",
    "sentence_en": "The annual yield from this investment was higher than expected."
  },
  {
    "id": 1904,
    "base_form": "clog",
    "meaning_fa": "گرفتگی",
    "sentence_en": "He used a plunger to clear the clog in the drain."
  },
  {
    "id": 1903,
    "base_form": "hassle",
    "meaning_fa": "دردسر",
    "sentence_en": "Dealing with the insurance company was such a hassle."
  },
  {
    "id": 1902,
    "base_form": "caregiver",
    "meaning_fa": "پرستار خانگی",
    "sentence_en": "Being a caregiver for an elderly parent can be very stressful."
  },
  {
    "id": 1901,
    "base_form": "death penalty",
    "meaning_fa": "مجازات اعدام",
    "sentence_en": "Several states have recently voted to abolish the death penalty."
  },
  {
    "id": 1900,
    "base_form": "martyr",
    "meaning_fa": "شهید",
    "sentence_en": "He died as a martyr fighting for his country's independence."
  },
  {
    "id": 1899,
    "base_form": "blow out",
    "meaning_fa": "پنچر شدن",
    "sentence_en": "The front tire blew out while we were driving down the highway."
  },
  {
    "id": 1898,
    "base_form": "staircase",
    "meaning_fa": "راه‌پله",
    "sentence_en": "We walked up the narrow wooden staircase to the second floor."
  },
  {
    "id": 1897,
    "base_form": "saint",
    "meaning_fa": "آدم مقدس",
    "sentence_en": "My grandmother was a total saint for raising six children on her own."
  },
  {
    "id": 1896,
    "base_form": "cannon",
    "meaning_fa": "توپ",
    "sentence_en": "The soldiers fired the cannon during the historic battle reenactment."
  },
  {
    "id": 1895,
    "base_form": "Line up by two",
    "meaning_fa": "به دو صف بشید",
    "sentence_en": "The teacher asked the children to line up by two for the field trip."
  },
  {
    "id": 1894,
    "base_form": "unless",
    "meaning_fa": "مگر اینکه",
    "sentence_en": "We won't go outside unless the weather clears up soon."
  },
  {
    "id": 1893,
    "base_form": "gotta",
    "meaning_fa": "باید",
    "sentence_en": "I gotta go now before I'm late for work."
  },
  {
    "id": 1892,
    "base_form": "kinda",
    "meaning_fa": "یه جورایی",
    "sentence_en": "It was kinda awkward when nobody laughed at his joke."
  },
  {
    "id": 1891,
    "base_form": "There you go",
    "meaning_fa": "بفرما",
    "sentence_en": "There you go, here is the extra blanket you asked for."
  },
  {
    "id": 1890,
    "base_form": "sparkling",
    "meaning_fa": "درخشان",
    "sentence_en": "The sunlight reflected off the sparkling diamond in the display case."
  }
]