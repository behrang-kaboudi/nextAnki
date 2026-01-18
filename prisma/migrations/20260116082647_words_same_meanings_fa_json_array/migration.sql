-- Migrate `sameMeanings_fa` from VARCHAR to JSON array of strings.
ALTER TABLE `Words` CHANGE `sameMeanings_fa` `sameMeanings_fa_text` VARCHAR(191) NULL;
ALTER TABLE `Words` ADD COLUMN `sameMeanings_fa` JSON NULL;

UPDATE `Words`
SET `sameMeanings_fa` =
  CASE
    WHEN `sameMeanings_fa_text` IS NULL OR `sameMeanings_fa_text` = '' THEN JSON_ARRAY()
    ELSE JSON_ARRAY(`sameMeanings_fa_text`)
  END;

ALTER TABLE `Words` DROP COLUMN `sameMeanings_fa_text`;
