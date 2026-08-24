# Word Hint Story Generation Guide

{{> _core/american-english-policy-v1}}

## Purpose

Create a short, coherent Persian mnemonic story that links:

1. the ordered sound symbols stored in an EnglishWord's `json_hint`;
2. the pronunciation of the target English word; and
3. the exact contextual meaning represented by one WordSense.

The story belongs to a WordSense, not merely to an English spelling. Different
senses of the same English word may require different stories because their
Persian meanings, concepts, and example sentences differ.

## Required input

Process exactly one record at a time. The input must contain:

```json
{
  "word_sense_id": 123,
  "english_word_id": 456,
  "english_word": "example",
  "phonetic_us": "...",
  "part_of_speech": "...",
  "meaning_fa": "...",
  "other_meanings_fa": [],
  "concept_explained_fa": "...",
  "sentence_id": 789,
  "sentence_en": "...",
  "sentence_fa": "...",
  "json_hint": {}
}
```

`word_sense_id` is the authoritative sense identity. `english_word_id` identifies
the shared English spelling and pronunciation record. `sentence_id`, when
present, identifies the example sentence used to shape the story event.

Do not generate a story when `json_hint` is missing, invalid, or contains no
usable sound symbol. Report that the record needs a valid hint instead of
inventing a symbol.

## Selecting symbols from `json_hint`

Ignore metadata properties such as `generatedAtMs`. Each remaining symbol
object may contain fields such as `fa`, `en`, `target_ipa`, `target_lang`,
`usage`, `source`, and `imageability`.

Use every usable symbol supplied by the hint, in its stored sound-segment order.
The hint may contain one symbol or several symbols. Never require, invent,
duplicate, or pad a second symbol when only one exists.

For each symbol, choose its visible story token with this exact rule:

```text
if target_lang == "en": selected_token = symbol.en
if target_lang == "fa": selected_token = symbol.fa
otherwise: fail validation and request a corrected hint
```

The selected token must appear in the final story exactly as stored, including
its script. Therefore an English-selected token remains written in English
inside the Persian story, while a Persian-selected token remains written in
Persian.

Never translate, transliterate, respell, inflect, replace, or reinterpret a
selected token. Preserve the symbol's original concept and visual referent.
For example, English `sieve` still represents the sieve object; it must not
become Persian `الک`, phonetic `سیو`, `سیب`, or the unrelated English verb
`save`.

## Two-pass story construction

### Pass 1: coherent semantic draft

First construct a complete causal scene internally. The scene must satisfy all
of these conditions:

- Every selected symbol participates actively in the event; merely listing or
  displaying a symbol is insufficient.
- Symbols appear or act in sound-segment order unless changing their order is
  unavoidable for Persian grammar. Even then, the retrieval order must remain
  unmistakable.
- The example sentence contributes its central situation, participant,
  contrast, action, or result. It need not be copied literally.
- The scene's consequence expresses the exact contextual WordSense.
- The story has a clear causal chain rather than disconnected images.

### Pass 2: controlled compression

After the complete scene is coherent, shorten it to a final story of preferably
two or three sentences. Remove decoration, repetition, and nonessential detail,
but preserve all of the following invariants:

1. every selected token, written exactly;
2. the tokens' mnemonic order;
3. the sentence-derived semantic anchor;
4. the event that communicates the contextual Persian meaning; and
5. the causal continuity connecting those elements.

Compression must not turn the result into a list of images or sacrifice the
reason one event leads to the next.

## Using the Persian meaning naturally

`meaning_fa`, `other_meanings_fa`, and `concept_explained_fa` constrain the
story's meaning; they are not immutable strings that must be copied verbatim.

The final story may adapt the Persian meaning to fit its characters and grammar:

- conjugate a verb for tense, person, and number;
- change singular to plural or plural to singular;
- use active or passive voice;
- express an adjective through the result of an action; or
- use a natural Persian paraphrase that preserves the same exact sense.

For example, `درک کردن` may become `متوجه این تغییر شدند`, and
`قانع‌کننده` may become `همه را قانع کرد`.

Never broaden, narrow, or replace the stored sense. A story for `تسکین دادن`
may say that pain decreased or was relieved, but it must not claim that the
underlying condition was completely cured.

## Output contract

Return one JSON object:

```json
{
  "word_sense_id": 123,
  "english_word_id": 456,
  "english_word": "example",
  "meaning_fa": "...",
  "sentence_id": 789,
  "selected_symbols": [
    {
      "slot": "person",
      "token": "...",
      "target_lang": "en",
      "target_ipa": "...",
      "fa": "...",
      "en": "..."
    }
  ],
  "story_text": "...",
  "prompt_version": "word-hint-story-v1",
  "qa": {
    "score": 0,
    "passed": false,
    "checks": {
      "sense_preserved": false,
      "all_symbols_exact": false,
      "symbol_order_preserved": false,
      "symbols_are_active": false,
      "sentence_anchor_preserved": false,
      "causal_continuity_preserved": false,
      "compact_and_natural": false
    }
  }
}
```

`selected_symbols` must be an ordered array even when it contains only one
item. Preserve the original symbol slot name in `slot`.

## Quality gate

Score each story from 0 to 10 for semantic correctness, exact symbol handling,
pronunciation coverage, sentence integration, causal coherence, compactness,
natural Persian, and schema compliance.

The story passes only when its score is at least 8.0 and every Boolean check in
the output is `true`. A critical symbol, sense, identity, or schema failure
cannot pass regardless of the numeric average. Revise and rescore a failing
story before returning it.
