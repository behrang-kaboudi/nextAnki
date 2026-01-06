# راهنمای `ipaToTokenObjects` (با مثال برای همه‌ی نوع ورودی‌ها)

مسیر: `src/lib/ipa/ipaTokenizer.ts`  
تابع: `export function ipaToTokenObjects(ipa, opt?)`

این تابع یک رشته‌ی IPA را **توکنایز** می‌کند و خروجی را به صورت آرایه‌ای از آبجکت‌های توکن برمی‌گرداند.

---

## امضای تابع

```ts
ipaToTokenObjects(
  ipa: string,
  opt?: Partial<{
    keepBoundaries: boolean;
    keepStressTokens: boolean;
    attachStressToNext: boolean;
    assumeAdjacentAffricate: boolean;
    keepPositions: boolean;
  }>
): IpaToken[]
```

## پیش‌پردازش ورودی (قبل از توکنایز)

قبل از شروع، ورودی با `normalizeIPA` نرمال می‌شود:

- نرمال‌سازی یونیکد به `NFC`
- جایگزینی برخی کاراکترهای IPA:
  - `ʧ` → `tʃ`
  - `ʤ` → `dʒ`
  - `ɡ` → `g`
  - `ɚ` → `ər`
  - `ɝ` → `ɜr`
- حذف کامل `SPACING_MODIFIERS` (مثل `ʰ`, `ʷ`, `ʲ`, `ˠ`, `ˤ`, `ⁿ`, `ˡ`, `˞`, `ʼ`, `ˀ`)

بعد از آن رشته به `NFD` تبدیل می‌شود تا **دی‌اکریتیک‌های ترکیبی** (Combining Marks) جدا شوند.

این یعنی اگر در ورودی چیزی مثل `ã` (a + ◌̃) داشته باشید، در پردازش داخلی به دو کاراکتر تبدیل می‌شود: `a` و `̃`.

---

## انواع توکن خروجی (`IpaToken`)

### 1) `SEGMENT`
برای بخش‌های «صدایی» (حروف پایه + دی‌اکریتیک‌ها + طول + …).

شکل کلی:
```ts
{
  type: "SEGMENT",
  text: string,
  stress: "primary" | "secondary" | null,
  category: "UNKNOWN" | "AFFRICATE" | "VOWEL" | "CONSONANT" | "CLUSTER",
  baseSymbols: string[],
  tieBars: string[],
  diacritics: string[],
  modifiers: string[],
  lengthMarks: string[],
  isAffricate: boolean,
  start?: number,
  end?: number
}
```

نکته‌ها:
- `baseSymbols`: کاراکترهای «پایه» (نه استرس، نه boundary، نه tie-bar، نه combining mark، نه length).
- `diacritics`: هر چیزی که یونیکدیِ `\p{M}` باشد (مثل `̃`).
- `lengthMarks`: فقط `ː` و `ˑ`.
- `tieBars`: فقط `͡` و `͜`.
- `modifiers`: در عمل معمولاً خالی است چون `normalizeIPA` این دسته را از ورودی حذف می‌کند.

### 2) `STRESS`
برای علامت‌های تکیه:
- `ˈ` → `stress: "primary"`
- `ˌ` → `stress: "secondary"`

شکل کلی:
```ts
{ type: "STRESS", text: "ˈ" | "ˌ", stress: "primary" | "secondary", kind: "PRIMARY" | "SECONDARY", start?: number, end?: number }
```

### 3) `BOUNDARY`
برای جداکننده‌ها (اگر `keepBoundaries: true` باشد):
کاراکترهای مرزی شامل: `" "`, `.`, `|`, `/`, `[`, `]`, `(`, `)`, `{`, `}`, `‖`, `-`

شکل کلی:
```ts
{ type: "BOUNDARY", text: string, stress: null, kind: string, start?: number, end?: number }
```

### 4) `UNKNOWN`
هر کاراکتری که در هیچ دسته‌ای نیفتد (یا بعضی حالت‌های خاص مثل شروع رشته با دی‌اکریتیک).

شکل کلی:
```ts
{ type: "UNKNOWN", text: string, stress: null, start?: number, end?: number }
```

---

## گزینه‌ها (Options) و اثرشان

### `keepBoundaries` (پیش‌فرض: `false`)
- `false`: boundaryها توکن نمی‌شوند و فقط نقش جداکننده دارند.
- `true`: boundaryها به شکل توکن `BOUNDARY` وارد خروجی می‌شوند.

### `keepStressTokens` (پیش‌فرض: `true`)
- `true`: خود علامت استرس هم به شکل توکن `STRESS` وارد خروجی می‌شود.
- `false`: توکن `STRESS` ساخته نمی‌شود (ولی اگر `attachStressToNext: true` باشد، استرس هنوز به سگمنت بعدی می‌چسبد).

### `attachStressToNext` (پیش‌فرض: `true`)
- `true`: وقتی `ˈ/ˌ` دیده شود، مقدار آن در `pendingStress` ذخیره می‌شود و روی **سگمنت بعدی** در فیلد `stress` اعمال می‌شود.
- `false`: استرس فقط (در صورت `keepStressTokens`) به صورت توکن `STRESS` می‌آید و به سگمنت بعدی منتقل نمی‌شود.

### `assumeAdjacentAffricate` (پیش‌فرض: `true`)
- `true`: اگر دو «نماد پایه» پشت سر هم بیایند و در `KNOWN_AFFRICATES` باشند، یک سگمنت واحد ساخته می‌شود.
  - شناخته‌شده‌ها: `tʃ`, `dʒ`
- `false`: این دو نماد پایه جدا جدا سگمنت می‌شوند (مگر اینکه tie-bar بینشان باشد).

### `keepPositions` (پیش‌فرض: `true`)
- `true`: روی همه توکن‌ها `start/end` بر اساس **اندیس کاراکترها بعد از `NFD`** گذاشته می‌شود.
- `false`: خروجی بدون `start/end` است.

نکته‌ی مهم درباره‌ی `start/end`:
- شمارش بر اساس `Array.from(ipa.normalize("NFD"))` است (اندیس بر حسب یونیکد codepoint بعد از NFD)، نه بر اساس بایت یا `string.length` خام.

---

## رفتار توکنایزر روی «تمام نوع ورودی‌ها» (با مثال)

### A) ورودی خالی
```ts
ipaToTokenObjects("")
// []
```

### B) فقط boundaryها
پیش‌فرض `keepBoundaries=false`:
```ts
ipaToTokenObjects(" - ")
// []
```
با `keepBoundaries=true`:
```ts
ipaToTokenObjects(" - ", { keepBoundaries: true })
// [
//   { type:"BOUNDARY", text:" ", kind:"SPACE", ... },
//   { type:"BOUNDARY", text:"-", kind:"HYPHEN", ... },
//   { type:"BOUNDARY", text:" ", kind:"SPACE", ... }
// ]
```

### C) فقط استرس
```ts
ipaToTokenObjects("ˈ")
// [{ type:"STRESS", text:"ˈ", stress:"primary", kind:"PRIMARY", start:0, end:1 }]
```
اگر `keepStressTokens=false`:
```ts
ipaToTokenObjects("ˈ", { keepStressTokens: false })
// []
```

### D) استرس + سگمنت (چسباندن استرس به سگمنت بعدی)
پیش‌فرض (`attachStressToNext=true`):
```ts
ipaToTokenObjects("ˈa")
// [
//   { type:"STRESS", text:"ˈ", stress:"primary", ... },
//   { type:"SEGMENT", text:"a", stress:"primary", baseSymbols:["a"], ... }
// ]
```
اگر `attachStressToNext=false`:
```ts
ipaToTokenObjects("ˈa", { attachStressToNext: false })
// [
//   { type:"STRESS", text:"ˈ", stress:"primary", ... },
//   { type:"SEGMENT", text:"a", stress:null, baseSymbols:["a"], ... }
// ]
```
اگر هم‌زمان `keepStressTokens=false` و `attachStressToNext=true`:
```ts
ipaToTokenObjects("ˈa", { keepStressTokens: false, attachStressToNext: true })
// [
//   { type:"SEGMENT", text:"a", stress:"primary", baseSymbols:["a"], ... }
// ]
```

### E) نماد پایه‌ی تنها (مصوت / صامت)
```ts
ipaToTokenObjects("a")[0].category
// "VOWEL"

ipaToTokenObjects("t")[0].category
// "CONSONANT"
```

### F) دیفتانگ‌های شناخته‌شده (دو نماد پایه → یک سگمنت)
لیست نمونه: `aɪ`, `oʊ`, `eɪ`, ...
```ts
ipaToTokenObjects("aɪ")
// [{ type:"SEGMENT", text:"aɪ", baseSymbols:["a","ɪ"], category:"VOWEL", ... }]
```

### G) آفریکیت‌های شناخته‌شده (دو نماد پایه → یک سگمنت)
وقتی `assumeAdjacentAffricate=true` (پیش‌فرض):
```ts
ipaToTokenObjects("tʃ")
// [{ type:"SEGMENT", text:"tʃ", baseSymbols:["t","ʃ"], category:"CLUSTER", isAffricate:false, ... }]
```
نکته: این «یک سگمنت» است ولی چون tie-bar ندارد، `isAffricate` در این حالت `false` می‌ماند و `category` معمولاً `CLUSTER` است.

با `assumeAdjacentAffricate=false`:
```ts
ipaToTokenObjects("tʃ", { assumeAdjacentAffricate: false })
// [
//   { type:"SEGMENT", text:"t", baseSymbols:["t"], category:"CONSONANT", ... },
//   { type:"SEGMENT", text:"ʃ", baseSymbols:["ʃ"], category:"CONSONANT", ... }
// ]
```

### H) آفریکیت با tie-bar (درون یک سگمنت) → `isAffricate: true`
```ts
ipaToTokenObjects("t͡ʃ")
// [
//   {
//     type:"SEGMENT",
//     text:"t͡ʃ",
//     baseSymbols:["t","ʃ"],
//     tieBars:["͡"],
//     isAffricate:true,
//     category:"AFFRICATE",
//     ...
//   }
// ]
```

### I) دی‌اکریتیک ترکیبی (Combining Mark) داخل سگمنت
```ts
ipaToTokenObjects("ã")
// [{ type:"SEGMENT", text:"ã", baseSymbols:["a"], diacritics:["̃"], ... }]
```

### J) دی‌اکریتیک/طول/… بدون سگمنت قبلی → `UNKNOWN`
اگر رشته با دی‌اکریتیک شروع شود:
```ts
ipaToTokenObjects("̃a")
// [
//   { type:"UNKNOWN", text:"̃", ... },
//   { type:"SEGMENT", text:"a", ... }
// ]
```

### K) علامت طول (Length marks) به سگمنت قبلی می‌چسبد
```ts
ipaToTokenObjects("aː")
// [{ type:"SEGMENT", text:"aː", baseSymbols:["a"], lengthMarks:["ː"], ... }]
```
اگر طول قبل از هر سگمنت بیاید:
```ts
ipaToTokenObjects("ːa")
// [
//   { type:"UNKNOWN", text:"ː", ... },
//   { type:"SEGMENT", text:"a", ... }
// ]
```

### L) boundary به عنوان جداکننده (بدون تولید سگمنت)
```ts
ipaToTokenObjects("a b")
// [
//   { type:"SEGMENT", text:"a", ... },
//   { type:"SEGMENT", text:"b", ... }
// ]
```
با `keepBoundaries=true`:
```ts
ipaToTokenObjects("a b", { keepBoundaries: true })
// [
//   { type:"SEGMENT", text:"a", ... },
//   { type:"BOUNDARY", text:" ", kind:"SPACE", ... },
//   { type:"SEGMENT", text:"b", ... }
// ]
```

### M) کاراکتر ناشناخته
```ts
ipaToTokenObjects("a#b", { keepBoundaries: true })
// [
//   { type:"SEGMENT", text:"a", ... },
//   { type:"UNKNOWN", text:"#", ... },
//   { type:"SEGMENT", text:"b", ... }
// ]
```

### N) تاثیر `keepPositions`
```ts
ipaToTokenObjects("ã", { keepPositions: true })[0]
// start: 0, end: 2   (چون NFD: "a" + "̃")

ipaToTokenObjects("ã", { keepPositions: false })[0]
// بدون start/end
```

---

## چند نکته‌ی عملی

- اگر هدف شما فقط «سگمنت‌ها» است، مثل `getIpaSegments` می‌توانید فقط توکن‌های `type === "SEGMENT"` را نگه دارید و با `tok.baseSymbols.join("")` خروجی بگیرید.
- اگر برای هایلایت در UI به اندیس‌ها نیاز دارید، `keepPositions=true` را نگه دارید ولی یادتان باشد اندیس‌ها روی رشته‌ی `NFD` هستند.

