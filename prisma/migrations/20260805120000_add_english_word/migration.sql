CREATE TABLE `english_word` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `normalized_text` VARCHAR(191) NOT NULL,
    `phonetic_us` VARCHAR(191) NULL,
    `phonetic_us_normalized` VARCHAR(191) NULL,
    `json_hint` LONGTEXT NULL,
    `audio_file_name` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `EnglishWord_normalized_text_key`(`normalized_text`),
    INDEX `EnglishWord_phonetic_us_normalized_idx`(`phonetic_us_normalized`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `word` ADD COLUMN `englishWordId` INTEGER NULL;
CREATE INDEX `Word_englishWordId_idx` ON `word`(`englishWordId`);
ALTER TABLE `word` ADD CONSTRAINT `word_englishWordId_fkey` FOREIGN KEY (`englishWordId`) REFERENCES `english_word`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
