-- CreateTable
CREATE TABLE `Words` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `anki_link_id` VARCHAR(191) NOT NULL,
    `base_form` VARCHAR(191) NOT NULL,
    `phonetic_us` VARCHAR(191) NULL,
    `phonetic_us_normalized` VARCHAR(191) NULL,
    `meaning_fa` VARCHAR(191) NOT NULL,
    `meaning_fa_IPA` VARCHAR(191) NOT NULL,
    `meaning_fa_IPA_normalized` VARCHAR(191) NOT NULL DEFAULT '',
    `pos` VARCHAR(191) NULL,
    `sameMeanings` VARCHAR(191) NULL,
    `sentence_en` VARCHAR(191) NOT NULL,
    `sentence_meaning_fa` VARCHAR(191) NULL,
    `learning_depth` DOUBLE NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Words_anki_link_id_key`(`anki_link_id`),
    INDEX `Words_base_form_idx`(`base_form`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
