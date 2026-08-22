# Canonical Word Sense Intake Workflow Guide

{{> _core/american-english-policy-v1}}

## Purpose

Use this workflow when the user supplies an English word or phrase, usually with
an English sentence, and asks for its meaning in that specific context.

This guide is incremental. Only phases marked **ENABLED** may be executed.
Stop after the last enabled phase and report its result to the user. Do not
continue into a future phase merely because its intended behavior is documented
here.

## Input contract

The workflow input is:

- `target_word`: the exact English word or phrase to investigate.
- `sentence_en`: the sentence in which the target appears, when supplied. When
  it is omitted, the selected prompt package must generate one after the contextual
  sense, `pos`, and Persian meaning have been fixed.

Preserve the user's intended lexeme, sense, and grammatical role. Before lookup
or generation, normalize a non-American regional spelling to its contemporary
American canonical form and report that normalization. Do not replace the
target with an unrelated synonym or change its intended sense or grammatical
role.

If the spelling named by the user differs from the spelling in `sentence_en`,
identify the difference, determine the American canonical spelling, and use
that American form as the database lookup and candidate `base_form`. Do not
create parallel American and British entries for the same spelling variant.

## Single-item API handling for multiple inputs — ENABLED

The intake APIs in this guide accept one target or one `WordSense` mutation per
request. When the user supplies multiple words or phrases, extract every target
and keep its supplied sentence, meaning, and optional `pos` attached to that
target. Process every target independently and in the user's original order.

- Call the exact-search endpoint separately for each normalized `target_word`.
- Prepare and quality-review each existing selection, update proposal, or new
  candidate independently. One passing item must not hide another item's failure.
- The user-facing answer may show all reviewed proposals together so the user
  can approve all of them or name a subset.
- After explicit approval, call the applicable single-item `PATCH`, `POST`, or
  study-list endpoint separately for each approved item. Never send an array to
  an endpoint whose contract in this guide is single-item.
- Preserve stable labels and the user's input order when reporting per-item
  success or failure. A successful request for one item does not prove that a
  later item succeeded.

## Mandatory personal study-list destination — ENABLED

Every word or phrase the user submits through this meaning-learning workflow
must ultimately be represented by one exact contextual `WordSense.id` in
`data/study/behrang.json`, the personal study list for `behrang`.

- If Phase 1 returns one clear existing contextual match, Phase 4 may first
  propose a same-concept update and, after any separately required update
  confirmation, must add the selected stored ID through
  `POST /api/v1/study-lists/behrang`.
- If Phase 1 returns no matching base form, or Phase 4 finds that the base form
  exists but none of its stored concepts matches the requested contextual
  sense, Phase 2 must prepare and review the candidate. After the user explicitly authorizes its database insertion,
  Phase 3 must insert it with `study_now: true` and `study_user: "behrang"` so
  the resulting ID is added to the same list. A new record from this workflow
  must not be inserted with `study_now: false`.
- When the user supplies multiple words, process and verify each word
  independently. Every clearly selected or explicitly authorized newly created
  contextual sense must have its own positive integer ID in the list; do not
  treat one listed ID as covering another word or sense.

## Field prompt package and batch mode — ENABLED

Before generating any new contextual sense, retrieve the field rules from the
local prompt-package API. Do not rely only on general model knowledge or the
short field summaries in this guide.

Call:

```http
POST /api/ai/prompt-package
Content-Type: application/json
```

with a body containing the exact output fields required for the selected mode:

```json
{
  "fields": [
    "base_form",
    "pos",
    "meaning_fa",
    "other_meanings_fa",
    "concept_explained_fa",
    "sentence_en",
    "sentence_en_meaning_fa",
    "phonetic_us",
    "meaning_fa_IPA",
    "imageability",
    "learning_depth",
    "productive_target"
  ]
}
```

The API resolves each field through the registered prompt path, recursively
renders that file's `{{> ...}}` includes, applies the global American English
policy, and returns the individual rendered prompts, ordered source paths,
combined prompt, and exact output schema. The API only reads and packages local
prompt files. The agent or person consuming the response performs generation.

### Full mode for small requests

When 1 through 10 target words or phrases still require new contextual-sense
candidates after lookup and existing-concept selection, use full mode by
default. Request and produce all twelve fields shown above for every new
contextual sense. Review every item independently; one passing item must not
hide a failing item.

### Mode confirmation for larger requests

When more than 10 target words or phrases still require new contextual-sense
candidates, stop before candidate generation and ask the user to choose one of
these modes:

1. full mode, processed in independent batches of at most 10 items, with all
   twelve fields and complete per-item and per-batch QA; or
2. light mode, with only the seven core lexical fields and without
   `phonetic_us`, `meaning_fa_IPA`, `imageability`, `learning_depth`, or
   `productive_target`.

Do not infer the larger-request mode from prior preference. Do not mix full and
light items inside one batch. The lookup and contextual-decision stages may be
completed before this question, but no new candidate may be generated until
the user chooses the mode.

The study list stores IDs only. It is a pending-study queue, not proof of Anki
or `FilterKnowing` status. The existing reconciliation on the two Anki
management pages removes an ID automatically only after a matching Anki note
has a card in `WordsForNewStudy::FilterKnowing`. Do not remove an ID merely
because it exists elsewhere in Anki, and do not mutate Anki as part of study-list
enrollment.

### Mandatory enrollment confirmation in the answer — ENABLED

The user generally prefers each clearly identified contextual `WordSense` to be
placed in the personal study list for `behrang`. This preference determines the
recommended option, but it is not standing authorization to mutate the study
list.

- After identifying one clear existing contextual match, the same user-facing
  answer that reports the meaning and selected stored concept must explicitly
  ask: `آیا این WordSense را در فهرست مطالعهٔ بهرنگ قرار بدهم؟`
- When the selected stored concept has a safe same-concept update proposal, show
  the exact proposal and also ask: `آیا این به‌روزرسانی را روی WordSense اعمال
  کنم؟` Updating the database and enrolling the ID are separate confirmations;
  the user may approve either one, both, or neither.
- After preparing a reviewed new candidate, the answer must explicitly ask
  whether the user wants it inserted and placed in the personal study list for
  `behrang`.
- Never omit the confirmation question merely because the user usually prefers
  enrollment or because enrollment is the workflow's expected destination.
- Do not call a study-list mutation endpoint or insert a new `WordSense` until
  the user gives an explicit affirmative answer for the current item or batch.
- If the user confirms, continue with the applicable Phase 3 or Phase 4 mutation
  and its verification requirements. If the user declines, stop without changing
  the database or study list.

This confirmation gate overrides any later instruction in this guide that could
otherwise be read as requiring immediate insertion or enrollment before the
user answers the mandatory question.

## Phase 1 — Exact database lookup — ENABLED

### Objective

Determine whether the exact normalized `base_form` already has one or more
`WordSense` records in the local database. Return every stored sense so the user
can compare meanings and concepts.

### API

Call the read-only endpoint:

```http
GET /api/v1/word-senses/search?base_form=<URL_ENCODED_TARGET_WORD>
```

When running against the managed local development server, use its current
workspace URL and port. Do not assume port `3000`; obtain the active address
from the workspace development-server status.

### Required procedure

1. Determine the contemporary American canonical spelling of the target used
   in the supplied sentence.
2. If the user separately names a regional spelling variant, report its
   normalization and query only the American canonical form.
3. URL-encode each `base_form` query value.
4. Call the API without modifying the database, Anki, AnkiDroid, files, or any
   external service.
5. Verify the HTTP status and parse the JSON response.
6. Verify that `ok` is `true` before using the result.
7. Confirm that every returned item's `base_form` equals the response's
   normalized `base_form`. This endpoint is an exact lookup, not a substring
   search.
8. Preserve all returned senses and their order. Do not select, merge, delete,
   rewrite, or rank a sense during this phase.

### Response contract

The API returns:

```json
{
  "ok": true,
  "base_form": "example",
  "exists": true,
  "count": 1,
  "items": [
    {
      "id": 123,
      "anki_link_id": "123_0000000000000",
      "updated_at": "2026-08-22T12:00:00.000Z",
      "base_form": "example",
      "pos": "noun",
      "meaning_fa": "...",
      "other_meanings_fa": [],
      "concept_explained_fa": "...",
      "sentence_en": "...",
      "sentence_en_meaning_fa": "..."
    }
  ]
}
```

The seven lexical fields are:

1. `base_form`
2. `pos`
3. `meaning_fa`
4. `other_meanings_fa`
5. `concept_explained_fa`
6. `sentence_en`
7. `sentence_en_meaning_fa`

`id`, `anki_link_id`, and `updated_at` are identity/version metadata, not
additional lexical fields. Preserve `updated_at` exactly because an approved
update must send it back as `expected_updated_at`.

### Result interpretation

When `exists` is `true`:

- Report the normalized `base_form`, `count`, and the complete `items` array.
- Explain that these are database candidates only.
- Do not claim that any returned sense matches the user's sentence during this
  phase.
- Do not infer whether the sense exists in Anki or is in the study process.
- Continue to Phase 4 to compare every returned concept with the requested
  contextual sense. Phase 4 either selects one existing concept, reports an
  ambiguity, or routes a clear no-match result to Phase 2 as a new contextual
  sense for the existing base form.

When `exists` is `false`:

- Report the normalized `base_form` and the exact empty result.
- State only that no matching database `WordSense` was found.
- Continue to Phase 2 and generate the full- or light-mode candidate JSON for
  the contextual sense.

When the API returns an error or cannot be reached:

- Report the HTTP or connection error accurately.
- Do not reinterpret an error as `exists: false`.
- Do not continue to another phase.

### Phase 1 user-facing output

Show the actual JSON returned by the API in a JSON code block. Briefly summarize
whether the word exists and how many senses were returned. If multiple spellings
were queried, label and show each response separately.

## Phase 1 quality gate

Before presenting or consuming the result, review it for:

- correct target spelling;
- correct active local server;
- successful HTTP response;
- valid JSON;
- exact normalized `base_form` matching;
- complete preservation of every returned item;
- presence of all seven lexical fields in every item;
- a valid `updated_at` timestamp in every existing item;
- absence of unsupported claims about contextual match or Anki status.

The result must score at least 8.0/10 with no critical defect. If it fails, fix
the lookup or reporting error and review it again before continuing.

## Phase 2 — New contextual-sense candidate generation — ENABLED

### Entry condition

Execute this phase only when Phase 1 completed successfully and either:

1. the exact lookup response has `exists: false`; or
2. Phase 4 compared every stored concept for an existing base form and found
   no clear contextual match.

An existing `base_form` never blocks creation of a genuinely missing contextual
sense. Multiple plausible stored matches are ambiguity, not a no-match result;
report them and stop instead of generating a candidate.

### Objective

Generate one candidate JSON object for the exact meaning and grammatical role
of `target_word`. Use the supplied `sentence_en` as contextual evidence when it
exists. When it is omitted, generate `sentence_en` only after fixing the sense,
`pos`, and Persian meaning, following the retrieved `sentence_en` field prompt.
This phase creates reviewed JSON only. It must not insert, update, apply, sync,
or transfer anything.

### Output contract

In light mode, return exactly one valid JSON object with exactly these seven
keys in this order:

```json
{
  "base_form": "<normalized English base form>",
  "pos": "<part of speech for this contextual use>",
  "meaning_fa": "<one primary Persian equivalent for this exact sense>",
  "other_meanings_fa": ["<optional Persian alternative for the same sense>"],
  "concept_explained_fa": "<one Persian sentence explaining the exact concept>",
  "sentence_en": "<the supplied English sentence>",
  "sentence_en_meaning_fa": "<natural Persian translation of the sentence>"
}
```

In full mode, return exactly one valid JSON object with exactly these twelve
keys in this order:

```json
{
  "base_form": "<normalized English base form>",
  "pos": "<part of speech for this contextual use>",
  "meaning_fa": "<one primary Persian equivalent for this exact sense>",
  "other_meanings_fa": ["<optional Persian alternative for the same sense>"],
  "concept_explained_fa": "<one Persian sentence explaining the exact concept>",
  "sentence_en": "<supplied normalized sentence or newly generated example>",
  "sentence_en_meaning_fa": "<natural Persian translation of the sentence>",
  "phonetic_us": "<General American IPA without delimiters>",
  "meaning_fa_IPA": "<Standard Modern Tehrani Persian IPA without delimiters>",
  "imageability": 1,
  "learning_depth": 0.5,
  "productive_target": 1
}
```

Do not add `id`, `anki_link_id`, `study_timing`, confidence, explanations,
comments, Markdown keys, or any other property to the JSON object.

### Field rules

1. `base_form`
   - Use the normalized American dictionary form of the word used in
     `sentence_en`.
   - Convert British or other regional spelling variants to the contemporary
     American canonical spelling.
   - Do not change the intended lexeme or grammatical role.
2. `pos`
   - Return the grammatical role of the target in this sentence, in lowercase
     English, such as `noun`, `verb`, `adjective`, or `adverb`.
3. `meaning_fa`
   - Return exactly one natural, common Persian equivalent for this sense.
   - The meaning must have the same grammatical role as the target.
   - Context may select the sense but may not donate extra meaning.
4. `other_meanings_fa`
   - Return a JSON array of unique Persian alternatives for exactly the same
     sense and grammatical role.
   - Do not repeat `meaning_fa`.
   - Use `[]` when no useful alternative exists.
5. `concept_explained_fa`
   - Write one clear Persian sentence explaining the concept itself.
   - Distinguish the selected sense without importing accidental details from
     the supplied sentence.
6. `sentence_en`
   - When supplied, preserve the sentence's meaning, tone, polarity, and relevant
     context while normalizing non-American spelling, vocabulary, grammar, and
     punctuation to contemporary American English.
   - Do not otherwise rewrite, shorten, or replace the sentence.
   - When omitted, generate one sentence only after `base_form`, `pos`,
     `meaning_fa`, and the contextual concept are fixed. Follow the retrieved
     `sentence_en` prompt exactly.
7. `sentence_en_meaning_fa`
   - Translate the full supplied sentence naturally and accurately into
     Persian.
   - Preserve the target's selected sense and the sentence's tone and polarity.
   - Treat `meaning_fa` as the semantic anchor for the target sense, not as
     wording that must appear literally in the translation.
   - Natural Persian restructuring and inflection are required when literal
     insertion of `meaning_fa` would be ungrammatical or unnatural.

8. Full-mode enrichment fields
   - Follow the rendered field prompt returned by the prompt-package API for
     each value; those field prompts are authoritative for IPA notation and
     scoring semantics.
   - `phonetic_us` is required General American IPA for the contextual
     pronunciation and must not contain slash or bracket delimiters.
   - `meaning_fa_IPA` is required IPA for the exact primary Persian meaning in
     Standard Modern Tehrani Persian and must not contain slash delimiters.
   - `imageability` is an integer from 1 through 100.
   - `learning_depth` is `-100` or a finite number from 0 through 1.
   - `productive_target` is an integer from 1 through 101.

### Mandatory semantic rules

Before finalizing `meaning_fa`:

- Place the same `base_form`, grammatical role, and intended sense in a
  different natural sentence that does not reuse the supplied sentence's
  contextual words. The Persian meaning must remain valid.
- Ensure every semantic component of `meaning_fa` comes from the target word
  itself, not from another word or phrase in `sentence_en`.
- Translate `meaning_fa` by itself back into English. If its direct natural
  back-translation contains meaning not expressed by the target word in this
  sense and grammatical role, revise it.
- Prefer a natural, common Persian equivalent. Do not use a transliteration
  unless it is genuinely established in standard Persian.

Apply these existing project rules independently to every item in
`other_meanings_fa`:

{{> word-extraction/_shared/other_meanings_fa_core_v1}}

### Phase 2 quality gate

Review the complete candidate before showing or consuming it. Check:

- valid JSON with exactly the seven light-mode keys or twelve full-mode keys in
  the required order;
- successful retrieval and use of every requested field prompt and its
  recursively rendered includes;
- correct normalized base form and spelling convention;
- correct contextual part of speech;
- one primary Persian meaning only;
- semantic-component attribution and reverse translation for the primary and
  every alternative meaning;
- no duplicate, broader, narrower, contextual-only, or different-sense Persian
  alternatives;
- one clear Persian concept sentence for the same sense;
- preservation of the meaning and context of `sentence_en`, with only required
  American-English normalization;
- natural and complete Persian sentence translation;
- internal agreement among all seven fields.
- in full mode, valid American and Persian IPA plus all three in-range scores,
  with agreement among all twelve fields.

Score the candidate on correctness, completeness, contextual relevance,
internal consistency, clarity, and schema compliance. It must score at least
8.0/10 with no critical defect. Correct and review it again until it passes.

### Phase 2 stop condition

Show every final reviewed JSON object to the user and stop unless the user
explicitly instructs the model to insert that reviewed candidate. Generation
alone never authorizes insertion. State that the candidate is pending and has
not yet received a `WordSense.id`, so it cannot yet be placed in the personal
study list. When insertion is explicitly requested, continue to Phase 3 and
enroll the resulting ID with `study_now: true`.

## Phase 3 — Database insertion and personal study list — ENABLED

### Entry conditions

Execute this phase only when all of the following are true:

1. Phase 1 completed successfully and either returned `exists: false` or Phase
   4 established that the base form exists without the requested contextual
   concept.
2. Phase 2 produced a reviewed seven-field light candidate or twelve-field full
   candidate that passed its quality gate.
3. The user explicitly instructed the model to insert that candidate.
4. The request will use `study_now: true` and `study_user: "behrang"`; these
   values are mandatory for insertion through this meaning-learning workflow.

### API

Call:

```http
POST /api/v1/word-senses
Content-Type: application/json
```

Request body:

```json
{
  "sense": {
    "base_form": "<normalized English base form>",
    "pos": "<part of speech>",
    "meaning_fa": "<primary Persian meaning>",
    "other_meanings_fa": [],
    "concept_explained_fa": "<Persian concept explanation>",
    "sentence_en": "<original English sentence>",
    "sentence_en_meaning_fa": "<Persian sentence translation>",
    "phonetic_us": "<General American IPA>",
    "meaning_fa_IPA": "<Persian IPA>",
    "imageability": 1,
    "learning_depth": 0.5,
    "productive_target": 1
  },
  "study_now": true,
  "study_user": "behrang"
}
```

In full mode, `sense` must contain exactly the twelve fields shown above. In
light mode, omit all five enrichment fields so `sense` contains exactly the
seven core lexical fields. Partial enrichment is invalid. Workflow metadata
must remain outside `sense`.

When `study_now` is `true`, the API adds the returned `WordSense.id` to
`data/study/<study_user>.json`. The JSON file stores IDs only. The two Anki
management pages resolve those IDs through the database and automatically
remove an ID after a matching Anki note, identified by `anki_link_id`, has a
card in `WordsForNewStudy::FilterKnowing`.

This phase does not create, edit, move, answer, or sync an Anki card.

### Response handling

- Verify the HTTP status and require `ok: true`.
- Preserve and report `action`, `item.id`, `item.anki_link_id`, and `study`.
- `action: created` means a new WordSense was inserted.
- `action: existing` means the idempotency check reused an existing matching
  WordSense instead of creating a duplicate.
- Do not report study-list success unless `study.listed` is `true`.
- Treat any API or file-write error as a failure; do not claim that the ID was
  queued.

### Phase 3 quality gate

Before reporting success, verify:

- the submitted `sense` is exactly the reviewed Phase 2 object in its selected
  full or light mode;
- `study_now` and `study_user` match the user's instruction;
- the response has `ok: true` and a positive integer `item.id`;
- `item.anki_link_id` is non-empty;
- when `study_now` is true, `study.listed` is true and the response's ID list
  contains `item.id`;
- no claim is made that Anki was changed.

The result must score at least 8.0/10 with no critical defect.

### Phase 3 stop condition

Report the database result and whether the concept ID was added to the user's
study list, then stop. Anki transfer remains a separate explicit workflow.

## Phase 4 — Existing contextual sense selection, optional update, and study-list enrollment — ENABLED

### Entry condition

Execute this phase only when Phase 1 completed successfully and the exact
lookup response has `exists: true`. Phase 2 and Phase 3 do not run when one
stored concept clearly matches; they do run after a verified no-match result.

### Objective

Compare the supplied sentence with every returned database concept, select one
stored `WordSense` only when it clearly represents the same contextual sense
and grammatical role, propose a safe same-concept update when stored alternative
meanings are incomplete, and add that selected concept's `id` to the personal
study list after confirmation. Do not query or mutate Anki in this phase.

### Selection procedure

1. Compare the target's grammatical role and contextual meaning with every
   returned item's `pos`, `meaning_fa`, `other_meanings_fa`, and
   `concept_explained_fa`.
2. Use the supplied sentence only to select the sense. Do not import meaning
   from surrounding words into the target.
3. Select an item only when exactly one stored concept is a clear match.
4. If no item clearly matches, report that no stored contextual sense was
   selected, add no ID to the study list, and continue to Phase 2. Treat the
   missing concept like a new word while preserving the existing base form.
5. If multiple items remain plausible, report the ambiguity and the candidate
   IDs and stop without adding any ID to the study list.
6. If the selected item already represents the exact concept but is missing a
   natural Persian alternative for that same sense and grammatical role, prepare
   the single-item update proposal below. A different, broader, narrower, or
   context-only meaning is not an update; route a genuinely distinct sense to
   Phase 2 instead.
7. Preserve the selected database item exactly until the user explicitly
   confirms the displayed update. Do not merge, rewrite, insert, delete, or
   silently update any `WordSense` record.

### Existing-record update proposal and API

The enabled intake update is intentionally narrow: it may add or remove
`other_meanings_fa` values on one existing `WordSense`. It does not update the
primary meaning, base form, `pos`, concept, sentence, IPA, or learning scores.

Before any update, show this exact proposal shape with the selected Phase 1
values:

```json
{
  "action": "update",
  "word_sense_id": 123,
  "expected_updated_at": "2026-08-22T12:00:00.000Z",
  "changes": {
    "other_meanings_fa": {
      "add": ["به اندازه"],
      "remove": []
    }
  }
}
```

Use additive changes instead of resending the complete stored array. Do not
repeat the primary `meaning_fa`, do not add spelling-only or colloquial
duplicates, and do not place the same normalized meaning in both `add` and
`remove`. Use an empty array for the direction that has no change. If neither
direction has a justified change, do not propose an update.

After the user explicitly approves the current proposal, call:

```http
PATCH /api/v1/word-senses
Content-Type: application/json
```

with the single-item body below. Do not include `action` in the API body:

```json
{
  "id": 123,
  "expected_updated_at": "2026-08-22T12:00:00.000Z",
  "changes": {
    "other_meanings_fa": {
      "add": ["به اندازه"],
      "remove": []
    }
  }
}
```

Require HTTP success, `ok: true`, the same positive `item.id`, and `action`
equal to `updated` or `unchanged`. Require the returned
`item.other_meanings_fa` to reflect the approved addition/removal. A `409`
means the record changed after the proposal; search again, prepare a fresh
proposal, and request fresh confirmation instead of retrying the stale update.
An update response does not authorize or prove study-list enrollment.

### Study-list API

For the single clearly selected item, call:

```http
POST /api/v1/study-lists/behrang
Content-Type: application/json
```

with:

```json
{
  "wordSenseId": 123
}
```

Replace `123` with the selected returned item's exact positive integer `id`.
The operation is idempotent: an ID already present in the list remains present
only once.

### Response handling

- Verify the HTTP status, parse the JSON response, and require `ok: true`.
- Require `user` to equal `behrang` and `wordSenseId` to equal the selected ID.
- Require the returned `ids` array to contain the selected ID before reporting
  that it was added to the study list.
- Treat any API or file-write error as a failure. Do not claim that the concept
  was queued when the response cannot be verified.
- Adding the ID to the study list does not prove that the note is absent from
  Anki and does not create, move, edit, answer, or sync an Anki card.

### Existing automatic reconciliation contract

The shared pending-study component on both of these pages reconciles the study
list when the page opens and when the user selects `بررسی دوباره`:

- `/anki/cards/manager`
- `/anki/cards/knowing-filter`

It matches Anki notes by `anki_link_id` and the legacy `AnkiLinkId` field. If a
matching note has a card in `WordsForNewStudy::FilterKnowing`, the component
removes that `WordSense.id` from the study list through the existing `DELETE
/api/v1/study-lists/behrang` route. Otherwise the ID remains listed for the
separate transfer workflow. If Anki lookup or reconciliation fails, no ID may
be removed.

Here, automatic reconciliation means reconciliation on either page load or an
explicit recheck from either page; it is not a continuously running background
job.

### Phase 4 user-facing output

When an update was approved, show the actual update API response in a JSON code
block and report whether it was updated or already unchanged. When study-list
enrollment was approved, also show the actual study-list API response in a JSON
code block. Report the outcome of each requested operation separately. State
that Anki itself was not changed. Do not claim that the card is absent from or
present in `FilterKnowing`; the two management pages perform that check.

### Phase 4 quality gate

Before reporting success, verify:

- exactly one returned stored concept clearly matches the contextual sense and
  grammatical role;
- the selected ID and `expected_updated_at` came unchanged from the Phase 1
  response;
- any update contains only same-concept `other_meanings_fa` additions/removals,
  exactly matches the approved proposal, and has a verified `updated` or
  `unchanged` response;
- no new candidate or database record was generated when an existing concept
  was selected or the result remained ambiguous;
- the study-list response has `ok: true` and contains the selected ID;
- no unsupported Anki-status or Anki-mutation claim is made;
- the response clearly preserves study-list enrollment and Anki transfer as
  separate stages.

The result must score at least 8.0/10 with no critical defect. If selection is
uncertain, do not enqueue an ID; report the ambiguity instead.

### Phase 4 stop condition

When one concept is selected, report the contextual selection and each
confirmed update or study-list result, then stop. When no concept matches,
continue to Phase 2. Anki reconciliation and transfer remain separate workflows
performed from the two management pages.

## Future phases — NOT ENABLED

The following phases record the intended direction and will be completed in
later versions of this guide. Do not execute them under `guide-v1.md`:

### Phase 5 — Anki study-status check

For a selected existing `WordSense`, check the connected Anki collection using
its identity and report whether it is absent, queued, learning, reviewing, or
suspended.

### Phase 6 — Anki transfer

Handle the separate `study_timing` decision (`now` or `later`). If `now`, check
readiness and use the configured Anki structure and study preferences. Database
success and Anki success must be reported separately.

## Prohibited shortcuts

- Do not use a paid API or the user's separately billed API credits.
- Do not query Anki during Phase 1.
- Do not insert or update database records during Phase 1.
- Do not insert or update database records during Phase 2 without the explicit
  Phase 3 instruction.
- Do not generate a new candidate when one stored concept clearly matches or
  when multiple stored concepts remain plausible. Generate one when every
  stored concept was checked and none matches the requested contextual sense.
- Do not generate a new candidate without first retrieving the exact field
  prompt package for the selected full or light mode.
- Do not generate more than 10 full candidates in one QA batch.
- Do not query Anki before or during Phase 4; add only the selected WordSense ID
  to the personal study list and leave reconciliation to the two management
  pages.
- Do not call `PATCH /api/v1/word-senses` before showing the exact single-item
  proposal and receiving explicit confirmation for the current item or selected
  group of items.
- Do not use the update API to combine distinct senses or to change fields
  outside its documented `other_meanings_fa` add/remove contract.
- Do not add an ID when no stored contextual sense clearly matches or when
  multiple returned senses remain plausible.
- Do not collapse distinct spellings or distinct `WordSense` records.
- Do not proceed past the last enabled phase.

## Versioning rule

Update this guide in place while developing the current workflow. Create a new
version only when an older behavior must remain reproducible. Whenever a future
phase becomes enabled, change its status explicitly and add its complete API,
validation, stop conditions, error behavior, and quality gate before use.
