Review every record by comparing `base_form`, `meaning_fa`, `other_meanings_fa`, and `sentence_en`.

Return ONLY records that require correction or meaningful completion.
Return `[]` if every record is correct and sufficiently complete.

اول جمله گفته شده رو بررسی کن:
یعنی بررسی کن که اصلا آیا استفاده این کلمه `base_form`
در این جمله `sentence_en` درست است یا خیر
Do not mark a sentence invalid merely because another wording would be more natural.
اگر غلط بود در خروجی برا این رکورد به شکل زیر میشه
{
"id": آیدی کلمه,
"sentence_en_valid": false
}

اگر استفاده درست بود مراحل زیر رو انجام بده و زیاد سخت گیری نکن ولی دقیق باش تو مفهوم چون باید `meaning_fa` و `other_meanings_fa` مفهوم مورد نظر جمله رو برسونن. دقت کن که نباید تعریف و توضیح مفهوم باشد بلکه باید ترجمه باشه

## Rules for `meaning_fa`

از خودت به این حالت بپرس که معنی `meaning_fa` کلمه `base_form` در جمله `sentence_en`
همین `meaning_fa` میشود.
یا به نوعی آیا این جمله مثلا مناسبی از معنی گفته شده برای این کلمه است یا خیر
حس انتقالی به شنونده رو هم د نظر بگیر.

## Rules for `other_meanings_fa`

`other_meanings_fa` must contain only useful alternative Persian equivalents for the same specific contextual sense.
میتونی موارد موجود رو تغییر بدی یا کم کنی یا زیاد .
اگر مقدار `meaning_fa` رو تغییر دادی و `meaning_fa` قبلی هنوز خیلی مربوط بود به این قسمت وارد کنی

## Return a record when

برا ی این قسمت
وقتی که حد اقل یکی از فیلد های `meaning_fa` یا `other_meanings_fa` تغییر کرده بود

## Output rules

- Preserve every returned `id` exactly.
- Include each incorrect record no more than once.
- Do not include correct records.
- Do not include `base_form`.
- Do not include the original `sentence_en` as a separate field.

- Return valid JSON only.

- Use the applicable output structure shown below.

بجز حالت خروجی گفته شده برای جمله اگر اصلاح دیگه بود به شکل زیر خروجی باشه

When `sentence_en` uses `base_form` correctly:

[
{
"id": آید کلمه,
"meaning_fa": "corrected main meaning",
"other_meanings_fa": [
"useful alternative"
],
}
]

{{INPUT_JSON}}
