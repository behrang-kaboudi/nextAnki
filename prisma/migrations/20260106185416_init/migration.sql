-- CreateTable
CREATE TABLE `Theme` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `slug` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `variables` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Theme_slug_key`(`slug`),
    INDEX `Theme_isDefault_idx`(`isDefault`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `password` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Word` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `anki_link_id` VARCHAR(191) NOT NULL,
    `base_form` VARCHAR(191) NOT NULL,
    `phonetic_us` VARCHAR(191) NULL,
    `phonetic_us_normalized` VARCHAR(191) NULL,
    `meaning_fa` VARCHAR(191) NOT NULL,
    `meaning_fa_IPA` VARCHAR(191) NOT NULL,
    `meaning_fa_IPA_normalized` VARCHAR(191) NOT NULL DEFAULT '',
    `pos` VARCHAR(191) NULL,
    `concept_explained` VARCHAR(191) NULL,
    `concept_explained_fa` VARCHAR(191) NULL,
    `word_hint_story` VARCHAR(191) NULL,
    `sentence_en` VARCHAR(191) NOT NULL,
    `example_meaning_fa` VARCHAR(191) NULL,
    `explanation_for_sentence_meaning` VARCHAR(191) NULL,
    `learning_depth` DOUBLE NULL,
    `mixed_sentence` VARCHAR(191) NULL,
    `category` VARCHAR(191) NULL,
    `typeOfWordInDb` VARCHAR(191) NOT NULL DEFAULT 'temp',
    `hint_sentence` VARCHAR(191) NULL,
    `first_letter_en_hint` VARCHAR(191) NULL,
    `first_letter_fa_hint` VARCHAR(191) NULL,
    `hint_to_select` VARCHAR(191) NULL,
    `word_note` VARCHAR(191) NULL,
    `common_error` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Word_anki_link_id_key`(`anki_link_id`),
    INDEX `Word_base_form_idx`(`base_form`),
    INDEX `Word_typeOfWordInDb_idx`(`typeOfWordInDb`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IpaKeyword` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `number` INTEGER NOT NULL,
    `fa` VARCHAR(191) NOT NULL,
    `faPlain` VARCHAR(191) NOT NULL DEFAULT '',
    `ipa_fa` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `IpaKeyword_number_key`(`number`),
    INDEX `IpaKeyword_fa_idx`(`fa`),
    INDEX `IpaKeyword_faPlain_idx`(`faPlain`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PictureWord` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fa` VARCHAR(191) NOT NULL,
    `ipa_fa` VARCHAR(191) NOT NULL,
    `ipa_fa_normalized` VARCHAR(191) NOT NULL DEFAULT '',
    `phinglish` VARCHAR(191) NOT NULL,
    `en` VARCHAR(191) NOT NULL,
    `type` ENUM('noun', 'adding', 'animal', 'person', 'notPersonal', 'humanBody', 'relationalObj', 'personAdj', 'personAdj_adj', 'adj', 'food', 'place', 'accessory', 'tool') NOT NULL DEFAULT 'noun',
    `canBePersonal` BOOLEAN NOT NULL DEFAULT false,
    `ipaVerified` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PictureWord_fa_idx`(`fa`),
    INDEX `PictureWord_en_idx`(`en`),
    UNIQUE INDEX `PictureWord_fa_en_key`(`fa`, `en`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
