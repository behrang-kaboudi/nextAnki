-- Rename column without data loss
ALTER TABLE `Word`
  CHANGE COLUMN `example_meaning_fa` `sentence_en_meaning_fa` VARCHAR(191) NULL;

