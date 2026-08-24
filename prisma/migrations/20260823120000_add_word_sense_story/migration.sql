CREATE TABLE `word_sense_story` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `wordSenseId` INTEGER NOT NULL,
    `sentenceId` INTEGER NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `storyText` TEXT NOT NULL,
    `selectedSymbols` JSON NOT NULL,
    `sourceSnapshot` JSON NOT NULL,
    `promptVersion` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `audio_file_name` VARCHAR(191) NULL,
    `audio_source_text` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `WordSenseStory_sentenceId_idx`(`sentenceId`),
    INDEX `WordSenseStory_wordSenseId_isActive_idx`(`wordSenseId`, `isActive`),
    UNIQUE INDEX `WordSenseStory_wordSenseId_version_key`(`wordSenseId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `word_sense_story`
    ADD CONSTRAINT `word_sense_story_wordSenseId_fkey`
    FOREIGN KEY (`wordSenseId`) REFERENCES `word_sense`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `word_sense_story`
    ADD CONSTRAINT `word_sense_story_sentenceId_fkey`
    FOREIGN KEY (`sentenceId`) REFERENCES `Sentence`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
