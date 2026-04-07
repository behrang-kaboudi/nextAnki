-- CreateTable
CREATE TABLE `Sentence` (
    `anki_link_id` VARCHAR(191) NOT NULL,
    `sentence_en` VARCHAR(191) NOT NULL,
    `sentence_en_meaning_fa` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`anki_link_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Sentence` ADD CONSTRAINT `Sentence_anki_link_id_fkey` FOREIGN KEY (`anki_link_id`) REFERENCES `word`(`anki_link_id`) ON DELETE CASCADE ON UPDATE CASCADE;
