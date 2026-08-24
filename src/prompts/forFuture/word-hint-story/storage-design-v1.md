# Proposed WordSense Story Storage

## Recommendation

Store each generated story in its own `WordSenseStory` record. The authoritative
relationship is `wordSenseId`, because a story must identify a contextual sense,
not only an English spelling. `sentenceId` records which example sentence shaped
the story.

Do not duplicate `englishWordId` as a relational key in the story table. It is
already available through `WordSense.englishId`, and duplicating it would allow
the story's word and sense references to disagree.

## Proposed Prisma model

```prisma
model WordSenseStory {
  id              Int       @id @default(autoincrement())
  wordSenseId     Int
  sentenceId      Int?
  version         Int       @default(1)
  storyText       String    @db.Text
  selectedSymbols Json
  sourceSnapshot  Json
  promptVersion   String
  isActive        Boolean   @default(true)
  audio_file_name String?
  audio_source_text String? @db.Text
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  wordSense WordSense @relation(fields: [wordSenseId], references: [id], onDelete: Cascade)
  sentence  Sentence? @relation(fields: [sentenceId], references: [id], onDelete: SetNull)

  @@unique([wordSenseId, version], map: "WordSenseStory_wordSenseId_version_key")
  @@index([sentenceId], map: "WordSenseStory_sentenceId_idx")
  @@index([wordSenseId, isActive], map: "WordSenseStory_wordSenseId_isActive_idx")
  @@map("word_sense_story")
}
```

The corresponding back-relations would be:

```prisma
model WordSense {
  // Existing fields remain unchanged.
  stories WordSenseStory[]
}

model Sentence {
  // Existing fields remain unchanged.
  wordSenseStories WordSenseStory[]
}
```

## Field responsibilities

- `wordSenseId`: authoritative identity of the contextual English/Persian sense.
- `sentenceId`: exact sentence used as the story's semantic anchor; nullable so
  the story survives if the sentence relationship is later removed.
- `version`: permits reviewed revisions without overwriting prior stories.
- `storyText`: final compressed mixed-script Persian story.
- `selectedSymbols`: ordered symbol trace used in the story, including slot,
  exact token, `target_lang`, `target_ipa`, `fa`, and `en`.
- `sourceSnapshot`: immutable generation-time snapshot of the word, pronunciation,
  Persian meaning fields, concept, sentence, and original `json_hint`.
- `promptVersion`: identifies the generation rules, initially
  `word-hint-story-v1`.
- `isActive`: identifies the currently preferred version without deleting older
  reviewed versions.
- `audio_file_name`: owned audio filename for the final story.
- `audio_source_text`: exact story text used to generate the current audio, for
  missing-file and changed-text detection.

## Why both relations and snapshots are useful

The relational IDs answer which current WordSense and Sentence own the story.
The snapshot preserves exactly what the generator saw while that source remains
valid. If `json_hint` changes or is cleared, the database deletes every story
for WordSense records linked to that EnglishWord. If the WordSense is deleted,
its stories are deleted by the relation. A story whose pronunciation symbols no
longer exist must never remain visible as a current or historical story.

The application never rewrites a story after source invalidation. A replacement
story requires a separate Word Hint Story prompt run, a new response, its own QA
review, and an explicit Apply. Until then, the WordSense has no story and is not
an eligible story-audio record.

## Write invariant

Before inserting a story, verify that `sentenceId`, when present, occurs in the
selected WordSense's `sentenceIds`. Insert the final `story_text`, exact ordered
`selected_symbols`, complete source snapshot, and prompt version in one database
operation. Creating or activating a newer version must deactivate the older
active version for the same WordSense in the same transaction.

Batch Apply accepts a reviewed subset of the prepared response array. Only the
submitted items are inserted; omitted WordSense records remain unchanged and
continue to appear in the missing-story count. Audio generation considers only
active stored stories with non-empty `storyText`, never WordSense records that
do not yet have a story.
