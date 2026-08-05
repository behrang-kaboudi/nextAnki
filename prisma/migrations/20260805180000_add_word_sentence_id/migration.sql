ALTER TABLE `word`
    ADD COLUMN `sentenceId` INTEGER NULL,
    ADD INDEX `Word_sentenceId_idx` (`sentenceId`),
    ADD CONSTRAINT `Word_sentenceId_fkey`
        FOREIGN KEY (`sentenceId`) REFERENCES `Sentence`(`id`)
        ON DELETE SET NULL ON UPDATE CASCADE;
