-- Sentence owns one persisted audio filename for each text field.
ALTER TABLE `Sentence`
  ADD COLUMN `sentence_en_audio_file_name` VARCHAR(191) NULL,
  ADD COLUMN `sentence_en_meaning_fa_audio_file_name` VARCHAR(191) NULL;
