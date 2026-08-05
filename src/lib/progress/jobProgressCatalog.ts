import "server-only";

import { getAnkiLinkIdDedupStatus } from "@/lib/anki/ankiLinkIdDedupJob";
import { getConceptExplainedFaSyncAllStatus } from "@/lib/anki/conceptExplainedFaSyncAllJob";
import { getFullSyncAllStatus } from "@/lib/anki/fullSyncAllJob";
import { getJsonHintSyncAllStatus } from "@/lib/anki/jsonHintSyncAllJob";
import { getMeaningFaSyncAllStatus } from "@/lib/anki/meaningFaSyncAllJob";
import { getMediaSyncAllStatus } from "@/lib/anki/mediaSyncAllJob";
import { getOtherMeaningsFaSyncAllStatus } from "@/lib/anki/otherMeaningsFaSyncAllJob";
import { getSentenceDeckSyncAllStatus } from "@/lib/anki/sentenceDeckSyncAllJob";
import { getSentenceEnMeaningFaSyncAllStatus } from "@/lib/anki/sentenceEnMeaningFaSyncAllJob";
import { getSentenceEnSyncAllStatus } from "@/lib/anki/sentenceEnSyncAllJob";
import { WORD_AUDIO_FIELDS } from "@/lib/audio/wordFieldAudioNaming";
import { getWordFieldVoiceJobStatus } from "@/lib/words/wordFieldVoiceGenerateJob";
import { getPersianWordAudioJobStatus } from "@/lib/persian/persianWordAudioGenerateJob";
import { getEnglishWordAudioJobStatus } from "@/lib/english/englishWordAudioGenerateJob";
import { getEnglishWordJsonHintJobStatus } from "@/lib/english/englishWordJsonHintGenerateJob";

import { JOB_PROGRESS_TOPICS, wordFieldVoiceProgressTopic } from "./topics";

type StatusGetter = () => unknown;

const statusGetters = new Map<string, StatusGetter>([
  [JOB_PROGRESS_TOPICS.ankiJsonHint, getJsonHintSyncAllStatus],
  [JOB_PROGRESS_TOPICS.ankiMedia, getMediaSyncAllStatus],
  [JOB_PROGRESS_TOPICS.ankiFull, getFullSyncAllStatus],
  [JOB_PROGRESS_TOPICS.ankiLinkIdDedup, getAnkiLinkIdDedupStatus],
  [JOB_PROGRESS_TOPICS.ankiOtherMeaningsFa, getOtherMeaningsFaSyncAllStatus],
  [JOB_PROGRESS_TOPICS.ankiConceptExplainedFa, getConceptExplainedFaSyncAllStatus],
  [JOB_PROGRESS_TOPICS.ankiMeaningFa, getMeaningFaSyncAllStatus],
  [JOB_PROGRESS_TOPICS.ankiSentenceEn, getSentenceEnSyncAllStatus],
  [JOB_PROGRESS_TOPICS.ankiSentenceEnMeaningFa, getSentenceEnMeaningFaSyncAllStatus],
  [JOB_PROGRESS_TOPICS.sentenceDeck, getSentenceDeckSyncAllStatus],
  [JOB_PROGRESS_TOPICS.persianWordAudio, getPersianWordAudioJobStatus],
  [JOB_PROGRESS_TOPICS.englishWordAudio, getEnglishWordAudioJobStatus],
  [JOB_PROGRESS_TOPICS.englishWordJsonHint, getEnglishWordJsonHintJobStatus],
]);

for (const field of WORD_AUDIO_FIELDS) {
  statusGetters.set(wordFieldVoiceProgressTopic(field), () =>
    getWordFieldVoiceJobStatus(field),
  );
}

export function getJobProgressSnapshot(): Record<string, unknown> {
  return Object.fromEntries(
    Array.from(statusGetters, ([topic, getStatus]) => [topic, getStatus()]),
  );
}
