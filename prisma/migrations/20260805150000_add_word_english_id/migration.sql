ALTER TABLE `word` ADD COLUMN `englishId` INTEGER NULL;
CREATE INDEX `Word_englishId_idx` ON `word`(`englishId`);
ALTER TABLE `word` ADD CONSTRAINT `word_englishId_fkey` FOREIGN KEY (`englishId`) REFERENCES `english_word`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
