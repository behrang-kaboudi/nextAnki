CREATE TABLE `SentenceWordLink` (
    `sentenceId` INTEGER NOT NULL,
    `wordId` INTEGER NOT NULL,
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`sentenceId`, `wordId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `SentenceWordLink` (`sentenceId`, `wordId`, `isPrimary`, `createdAt`, `updatedAt`)
SELECT s.`id`, w.`id`, true, NOW(3), NOW(3)
FROM `Sentence` s
INNER JOIN `word` w ON w.`anki_link_id` = s.`anki_link_id`
WHERE s.`anki_link_id` IS NOT NULL;

CREATE INDEX `SentenceWordLink_wordId_isPrimary_idx` ON `SentenceWordLink`(`wordId`, `isPrimary`);
CREATE INDEX `SentenceWordLink_sentenceId_isPrimary_idx` ON `SentenceWordLink`(`sentenceId`, `isPrimary`);

ALTER TABLE `SentenceWordLink` ADD CONSTRAINT `SentenceWordLink_sentenceId_fkey`
FOREIGN KEY (`sentenceId`) REFERENCES `Sentence`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `SentenceWordLink` ADD CONSTRAINT `SentenceWordLink_wordId_fkey`
FOREIGN KEY (`wordId`) REFERENCES `word`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `Sentence` DROP FOREIGN KEY `Sentence_anki_link_id_fkey`;
DROP INDEX `Sentence_anki_link_id_key` ON `Sentence`;
ALTER TABLE `Sentence` DROP COLUMN `anki_link_id`;
