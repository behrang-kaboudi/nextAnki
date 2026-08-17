import assert from "node:assert/strict";
import test from "node:test";

import {
  REQUIRED_WORD_ANKI_FIELD_NAMES,
  getWordAnkiReadinessIssues,
} from "./wordAnkiSyncReadiness.ts";

function completeInput() {
  return {
    fields: Object.fromEntries(
      REQUIRED_WORD_ANKI_FIELD_NAMES.map((field) => [field, field === "learning_depth" ? "0" : "value"]),
    ),
    sourceTexts: {
      audio_source_text: "word",
      concept_explained_fa_audio_source_text: "concept",
      sentence_en_audio_source_text: "sentence",
      sentence_en_meaning_fa_audio_source_text: "translation",
    },
    scores: {
      learning_depth: 0,
      imageability: 0,
      productive_target: 0,
    },
  };
}

test("a complete study card is ready and zero scores are valid", () => {
  assert.deepEqual(getWordAnkiReadinessIssues(completeInput()), []);
});

test("missing content, audio output, and source text are reported", () => {
  const input = completeInput();
  input.fields.meaning_fa = " ";
  input.fields.sentence_en_audio = "";
  input.sourceTexts.audio_source_text = null;

  assert.deepEqual(getWordAnkiReadinessIssues(input), [
    { field: "meaning_fa", reason: "missing" },
    { field: "sentence_en_audio", reason: "missing" },
    { field: "audio_source_text", reason: "missing" },
  ]);
});

test("null and out-of-range scores are rejected", () => {
  const input = completeInput();
  input.scores.learning_depth = -100;
  input.scores.imageability = 101;
  input.scores.productive_target = null;

  assert.deepEqual(getWordAnkiReadinessIssues(input), [
    { field: "learning_depth", reason: "invalid" },
    { field: "imageability", reason: "invalid" },
    { field: "productive_target", reason: "invalid" },
  ]);
});
