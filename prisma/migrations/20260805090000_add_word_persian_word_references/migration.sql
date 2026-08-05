-- Relate each Word to its primary PersianWord and retain IDs for other meanings.
ALTER TABLE `word`
    ADD COLUMN `meaningId` INTEGER NULL,
    ADD COLUMN `otherMeaningIds` JSON NULL,
    ADD INDEX `Word_meaningId_idx` (`meaningId`),
    ADD CONSTRAINT `Word_meaningId_fkey`
        FOREIGN KEY (`meaningId`) REFERENCES `persian_word`(`id`)
        ON DELETE SET NULL ON UPDATE CASCADE;
