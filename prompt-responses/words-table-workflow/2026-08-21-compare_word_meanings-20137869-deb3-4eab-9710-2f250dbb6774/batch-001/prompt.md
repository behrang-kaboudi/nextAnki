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


به تو گروهی از رکوردهای کلمات انگلیسی داده می شود که احتمال دارد حداقل در یکی از معنی های خود، مفهوم مشترک یا نزدیک داشته باشند.
وظیفه تو مقایسه دقیق کلمات، استخراج معنی مشترک، مشخص کردن تفاوت های واقعی و تقویت مفهوم هر کلمه است.
هر گروه با `groupKey` مشخص شده و تمام رکوردهای آن از قبل دارای `persianWordId` و `pos` یکسان هستند. `groupKey`، `persianWordId` و `pos` را در خروجی همان گروه دقیقاً بدون تغییر برگردان.
هدف اصلی
برای هر جفت یا گروه با توجه به سوالات زیر و معیار ها فیلد های `synonymIds` و concept_explained_fa رو به روز کن در حقیق با کمک این دو فیلد میخواهیم با شنیدن معنی فارسی کلمه انگلیس درست رو از بین این کلمات درست تشخیص بدیم یعنی هر دو مکمل هم هستند.

1. آیا حداقل یک معنی مشترک یا نزدیک دارند؟
2. معنی مشترک دقیقا چیست؟
3. آیا در آن معنی قابل جایگزینی هستند؟
4. تفاوت آن ها در کدام ابعاد است؟
5. آیا concept فعلی هر کلمه برای فهم مستقل معنی و تفاوت آن کافی است؟
6. چه رابطه ای باید میان کلمات ثبت شود؟
7. آیا این کلمات انگلیسی قابلیت جایگزینی با هم رو دارند
   برابر بودن ترجمه فارسی به تنهایی برای مشترک دانستن معنی کافی نیست. معنی واقعی، کاربرد و مصداق کلمات را بررسی کن.
   واحد تحلیل
   مقایسه باید در سطح «معنی مشخص + نقش دستوری مشخص» انجام شود، نه فقط در سطح base_form.
   ممکن است دو کلمه فقط در یکی از معنی هایشان نزدیک باشند و در معنی های دیگر هیچ ارتباطی نداشته باشند.
   ابعاد بررسی تفاوت
   تمام ابعاد مرتبط را بررسی کن:
   • معنی مرکزی
   • مصداق واقعی
   • محیط و موقعیت استفاده
   • خانه یا مکان عمومی
   • رسمی، خنثی، محاوره ای، عامیانه، کتابی، تخصصی یا قدیمی بودن
   • تفاوت منطقه ای مانند آمریکایی، کانادایی یا بریتانیایی
   • بار مثبت، منفی، خنثی، مودبانه یا مستقیم
   • شدت
   • عمومی تر یا اختصاصی تر بودن
   • نقش و ساختار دستوری
   • حروف اضافه و الگوهای دستوری
   • هم آیی های طبیعی
   • گروه سنی یا حوزه تخصصی
   • میزان طبیعی بودن در انگلیسی معاصر آمریکای شمالی

   حفظ concept قبلی و مرز دقیق sense
   ابتدا sense دقیق هر رکورد را براساس `meaning_fa`، `other_meanings_fa` معتبر، `pos`، جمله‌ها و ترجمه‌های آن‌ها مشخص کن.
   اگر concept قبلی اطلاعات درست و مرتبطی درباره همین sense دارد، حفظ معنایی تمام آن اطلاعات الزامی است. لازم نیست عبارت‌ها کلمه‌به‌کلمه باقی بمانند؛ می‌توانی آن‌ها را طبیعی‌تر بازنویسی، یکپارچه یا با اطلاعات ضروری تکمیل کنی، اما نباید محتوای معتبرشان از بین برود.
   concept موجود را صرفاً به دلیل امکان نوشتن توضیحی متفاوت، کوتاه‌تر یا بهتر جایگزین نکن.
   اگر بخشی از concept مربوط به sense، نقش دستوری یا کاربرد دیگری از همان `base_form` است، حذف آن بخش الزامی است؛ حتی اگر آن اطلاعات درباره کلمه در کاربردی دیگر صحیح باشد.
   اگر اطلاعات معتبر همین sense و اطلاعات خارج از آن در یک عبارت مخلوط شده‌اند، concept را بازنویسی کن: محتوای معتبر را نگه دار و فقط بخش‌های خارج از این sense را حذف کن.

   اصلاح concept_explained_fa که فیلد فارسی است
   concept نهایی باید توضیحی کامل و مستقل از همین sense باشد. ویژگی‌های ذاتی و پایداری را که به تشخیص آن از هم‌معنی‌ها کمک می‌کنند—مانند مصداق، موقعیت کاربرد، رسمیت، شدت، بار معنایی، حوزه استفاده یا الگوی دستوری—به‌صورت طبیعی در همان توضیح حفظ یا اضافه کن. نیاز نیست تمایزهای بسیار ظریف را به زور وارد کنی، ولی توضیح باید برای فهم مستقل کلمه کافی باشد و به موارد مهم بررسی‌شده اشاره کند. از ۵۰ کلمه بیشتر نشود.
   تفاوتی را در concept ثبت کن که بدون دیدن گروه مقایسه نیز ویژگی واقعی و پایدار همین WordSense باشد. تفاوت‌های صرفاً زوجی یا وابسته به اعضای موقت گروه را در concept ذخیره نکن.
   concept نهایی را یک جملهٔ کامل و روان بنویس؛ اطلاعات را با کلمات ربط و نقطه‌گذاری طبیعی یکپارچه کن، نه با عبارت‌های نیمه‌تمام یا ویرگول‌های زنجیره‌ای، و مطمئن شو هنگام بلندخوانی مستقل و روشن است.
   مثلا مفهوم شیر خوراکی با شیر به عنوان حیوان خیلی زیاده پس اصلا نیازی نیست که به تفاوت ها اشاره بشه و بخوایم بگیم منظورمون این نیست
   به senseهای دیگر همین `base_form`، نام کلمات انگلیسی دیگر یا مقایسه مستقیم با آن‌ها اشاره نکن. هیچ واژه انگلیسی در این متن نباید بیاید، حتی به‌صورت پینگلیش.
   اصلاح synonymIds
   در `synonymIds` فقط مترادف‌های تقریباً کامل را قرار نده. هر WordSense از همین گروه را که دست‌کم در یک معنی یا کاربرد رایج، هم‌پوشانی معنایی قابل‌توجه، امکان جایگزینی کامل یا محدود، یا احتمال اشتباه آموزشی معقول با این رکورد دارد نیز ثبت کن. اگر مقایسه و توضیح تفاوت دو کلمه به زبان‌آموز کمک می‌کند کلمهٔ انگلیسی درست را انتخاب کند، با رویکردی نسبتاً گشاده رابطه را ثبت کن؛ حتی اگر آن دو در همهٔ جمله‌ها قابل‌جایگزینی نباشند یا در شدت، رسمیت، بار معنایی، موقعیت کاربرد یا دامنهٔ مصداق تفاوت داشته باشند. در موارد مرزی که نزدیکی معنایی واقعی و فایدهٔ آموزشی هر دو وجود دارند، ترجیح بده رابطه را ثبت کنی.
   بااین‌حال، صرف داشتن یک ترجمهٔ فارسی مشترک، قرارگرفتن در یک حوزه، همراه‌آمدن در یک موضوع، یا ارتباط کلی برای ورود به `synonymIds` کافی نیست. کلماتی را که معنی مرکزی متفاوت دارند و احتمال اشتباه واقعی میان آن‌ها پایین است وارد نکن. هدف ساختن مجموعه‌ای نسبتاً فراگیر از مترادف‌ها و همسایه‌های معنایی نزدیک و آموزنده است، نه فهرستی از همهٔ کلمات مرتبط.

برای خروجی فقط
آیدی رکورد - concept_explained_fa و synonymIds برای هر رکورد دسته بده.

## ساختار قطعی خروجی برای برنامه

فقط یک آرایه JSON معتبر و بدون Markdown برگردان. برای هر گروه ورودی دقیقاً یک آیتم و برای هر رکورد آن گروه دقیقاً یک آیتم در `records` برگردان:

[{"groupKey":"adjective:123","persianWordId":123,"pos":"adjective","records":[{"id":10,"concept_explained_fa":"توضیح فارسی حداکثر ۵۰ کلمه","synonymIds":[11]},{"id":11,"concept_explained_fa":"توضیح فارسی حداکثر ۵۰ کلمه","synonymIds":[10]}]}]

- ترتیب گروه‌ها و رکوردها را مطابق ورودی نگه دار.
- `groupKey`، `persianWordId` و `pos` هر گروه را دقیقاً مطابق ورودی و بدون تغییر برگردان.
- `synonymIds` فقط می‌تواند شامل ID سایر WordSenseهای همان گروه باشد.
- ID خود رکورد و ID تکراری در `synonymIds` قرار نده.
- رابطه‌ها را دوطرفه برگردان: اگر ID رکورد B در `synonymIds` رکورد A است، ID رکورد A نیز باید در `synonymIds` رکورد B باشد.
- حتی اگر هیچ تغییری در concept لازم نیست، مقدار نهایی `concept_explained_fa` را برگردان.
- کنترل کن که concept نهایی تمام اطلاعات معتبر قبلی درباره همین sense را حفظ کرده، هیچ اشاره‌ای به senseهای دیگر ندارد و از ۵۰ کلمه بیشتر نیست.
- هیچ فیلد یا متن دیگری برنگردان.

مثال ورودی و خروجی:

[ { "groupKey": "adjective:6", "persianWordId": 6, "pos": "adjective", "shared_persian_meaning": "محتاط", "records": [ { "id": 2, "word": "chary", "pos": "adjective", "meaning_fa": "محتاط", "other_meanings_fa": [], "concept_explained_fa": "رفتار محتاطانه و بااحتیاط، هشیار", "synonymIds": [] }, { "id": 2085, "word": "cautious", "pos": "adjective", "meaning_fa": "محتاط", "other_meanings_fa": [ "بااحتیاط" ], "concept_explained_fa": "مراقب، هوشیار", "synonymIds": [] } ] } ]

خروجی
[{"groupKey":"adjective:6","persianWordId":6,"pos":"adjective","records":[{"id":2,"concept_explained_fa":"محتاط و متمایل به خودداری، معمولا درباره پذیرش، اعتماد یا انجام کاری؛ تا حدی رسمی و کم کاربرد","synonymIds":[2085]},{"id":2085,"concept_explained_fa":"مراقب خطر یا پیامد احتمالی و پرهیزکننده از تصمیم یا اقدام عجولانه؛ واژه ای عمومی و خنثی","synonymIds":[2]}]}]

====================================================================>>>>>>>>>>
