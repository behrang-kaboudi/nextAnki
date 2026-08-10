ALTER TABLE `word`
  ADD COLUMN `concept_explained_fa_audio_source_text` TEXT NULL AFTER `concept_explained_fa_audio_file_name`;

ALTER TABLE `english_word`
  ADD COLUMN `audio_source_text` TEXT NULL AFTER `audio_file_name`;

ALTER TABLE `Sentence`
  ADD COLUMN `sentence_en_audio_source_text` TEXT NULL AFTER `sentence_en_audio_file_name`,
  ADD COLUMN `sentence_en_meaning_fa_audio_source_text` TEXT NULL AFTER `sentence_en_meaning_fa_audio_file_name`;

ALTER TABLE `persian_word`
  ADD COLUMN `audio_source_text` TEXT NULL AFTER `audio_file_name`;

-- Existing owned audio is assumed to match the record's current text.
UPDATE `word`
SET `concept_explained_fa_audio_source_text` = TRIM(`concept_explained_fa`)
WHERE `concept_explained_fa_audio_file_name` IS NOT NULL
  AND `concept_explained_fa_audio_file_name` <> ''
  AND `concept_explained_fa` IS NOT NULL
  AND TRIM(`concept_explained_fa`) <> '';

UPDATE `english_word`
SET `audio_source_text` = TRIM(`base_form`)
WHERE `audio_file_name` IS NOT NULL
  AND `audio_file_name` <> ''
  AND TRIM(`base_form`) <> '';

UPDATE `Sentence`
SET `sentence_en_audio_source_text` = TRIM(`sentence_en`)
WHERE `sentence_en_audio_file_name` IS NOT NULL
  AND `sentence_en_audio_file_name` <> ''
  AND TRIM(`sentence_en`) <> '';

UPDATE `Sentence`
SET `sentence_en_meaning_fa_audio_source_text` = TRIM(`sentence_en_meaning_fa`)
WHERE `sentence_en_meaning_fa_audio_file_name` IS NOT NULL
  AND `sentence_en_meaning_fa_audio_file_name` <> ''
  AND `sentence_en_meaning_fa` IS NOT NULL
  AND TRIM(`sentence_en_meaning_fa`) <> '';

UPDATE `persian_word`
SET `audio_source_text` = TRIM(`canonical_text`)
WHERE `audio_file_name` IS NOT NULL
  AND `audio_file_name` <> ''
  AND TRIM(`canonical_text`) <> '';
