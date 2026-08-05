CREATE TABLE `word_removed_field_archive` (
    `wordId` INTEGER NOT NULL,
    `concept_explained` VARCHAR(191) NULL,
    `word_hint_story` VARCHAR(191) NULL,
    `explanation_for_sentence_meaning` VARCHAR(191) NULL,
    `mixed_sentence` VARCHAR(191) NULL,
    `typeOfWordInDb` VARCHAR(191) NOT NULL,
    `hint_sentence` VARCHAR(191) NULL,
    `first_letter_en_hint` VARCHAR(191) NULL,
    `first_letter_fa_hint` VARCHAR(191) NULL,
    `word_note` VARCHAR(191) NULL,
    `common_error` VARCHAR(191) NULL,
    `archivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`wordId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `word_removed_field_archive` (
    `wordId`, `concept_explained`, `word_hint_story`, `explanation_for_sentence_meaning`,
    `mixed_sentence`, `typeOfWordInDb`, `hint_sentence`, `first_letter_en_hint`,
    `first_letter_fa_hint`, `word_note`, `common_error`
)
SELECT
    `id`, `concept_explained`, `word_hint_story`, `explanation_for_sentence_meaning`,
    `mixed_sentence`, `typeOfWordInDb`, `hint_sentence`, `first_letter_en_hint`,
    `first_letter_fa_hint`, `word_note`, `common_error`
FROM `word`;

ALTER TABLE `word`
    DROP INDEX `Word_typeOfWordInDb_idx`,
    DROP COLUMN `concept_explained`,
    DROP COLUMN `word_hint_story`,
    DROP COLUMN `explanation_for_sentence_meaning`,
    DROP COLUMN `mixed_sentence`,
    DROP COLUMN `typeOfWordInDb`,
    DROP COLUMN `hint_sentence`,
    DROP COLUMN `first_letter_en_hint`,
    DROP COLUMN `first_letter_fa_hint`,
    DROP COLUMN `word_note`,
    DROP COLUMN `common_error`;
