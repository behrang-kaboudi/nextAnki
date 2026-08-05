ALTER TABLE `word` DROP FOREIGN KEY `word_englishWordId_fkey`;
DROP INDEX `Word_englishWordId_idx` ON `word`;
ALTER TABLE `word` DROP COLUMN `englishWordId`;
