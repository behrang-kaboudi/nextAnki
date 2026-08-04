-- CreateTable
CREATE TABLE `persian_word` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `canonical_text` VARCHAR(191) NOT NULL,
    `normalized_text` VARCHAR(191) NOT NULL,
    `not_normalized_texts` JSON NOT NULL,
    `meaning_fa_IPA` VARCHAR(191) NULL,
    `meaning_fa_IPA_normalize` VARCHAR(191) NULL,
    `audio_file_name` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PersianWord_canonical_text_idx`(`canonical_text`),
    INDEX `PersianWord_normalized_text_idx`(`normalized_text`),
    CONSTRAINT `persian_word_normalized_text_fa_only` CHECK (
        `normalized_text` REGEXP '^[ابتثجحخدذرزژسشصضطظعغفقکگلمنوهی]+$'
    ),
    CONSTRAINT `persian_word_not_normalized_texts_array` CHECK (
        JSON_TYPE(`not_normalized_texts`) = 'ARRAY'
    ),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Every array item must be a string and must occur only once.
CREATE TRIGGER `persian_word_validate_not_normalized_texts_insert`
BEFORE INSERT ON `persian_word`
FOR EACH ROW
BEGIN
    IF EXISTS (
        SELECT 1
        FROM JSON_TABLE(
            NEW.`not_normalized_texts`,
            '$[*]' COLUMNS (`value` JSON PATH '$')
        ) AS `items`
        WHERE JSON_TYPE(`items`.`value`) <> 'STRING'
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'not_normalized_texts items must be strings';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM JSON_TABLE(
            NEW.`not_normalized_texts`,
            '$[*]' COLUMNS (`value` VARCHAR(191) PATH '$')
        ) AS `items`
    ) <> (
        SELECT COUNT(DISTINCT `items`.`value`)
        FROM JSON_TABLE(
            NEW.`not_normalized_texts`,
            '$[*]' COLUMNS (`value` VARCHAR(191) PATH '$')
        ) AS `items`
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'not_normalized_texts items must be unique';
    END IF;
END;

CREATE TRIGGER `persian_word_validate_not_normalized_texts_update`
BEFORE UPDATE ON `persian_word`
FOR EACH ROW
BEGIN
    IF EXISTS (
        SELECT 1
        FROM JSON_TABLE(
            NEW.`not_normalized_texts`,
            '$[*]' COLUMNS (`value` JSON PATH '$')
        ) AS `items`
        WHERE JSON_TYPE(`items`.`value`) <> 'STRING'
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'not_normalized_texts items must be strings';
    END IF;

    IF (
        SELECT COUNT(*)
        FROM JSON_TABLE(
            NEW.`not_normalized_texts`,
            '$[*]' COLUMNS (`value` VARCHAR(191) PATH '$')
        ) AS `items`
    ) <> (
        SELECT COUNT(DISTINCT `items`.`value`)
        FROM JSON_TABLE(
            NEW.`not_normalized_texts`,
            '$[*]' COLUMNS (`value` VARCHAR(191) PATH '$')
        ) AS `items`
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'not_normalized_texts items must be unique';
    END IF;
END;
