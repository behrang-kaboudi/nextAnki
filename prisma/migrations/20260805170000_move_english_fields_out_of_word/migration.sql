-- EnglishWord is the single source of truth for English-owned fields.
-- Word.englishId has already been backfilled before this migration.
ALTER TABLE `word` DROP FOREIGN KEY `word_englishId_fkey`;
DROP INDEX `Word_base_form_idx` ON `word`;

ALTER TABLE `word`
    MODIFY `englishId` INTEGER NOT NULL,
    DROP COLUMN `base_form`,
    DROP COLUMN `phonetic_us`,
    DROP COLUMN `phonetic_us_normalized`,
    DROP COLUMN `json_hint`;

ALTER TABLE `word`
    ADD CONSTRAINT `word_englishId_fkey`
    FOREIGN KEY (`englishId`) REFERENCES `english_word`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
