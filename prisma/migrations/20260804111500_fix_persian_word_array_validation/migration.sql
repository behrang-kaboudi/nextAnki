-- JSON values are compared without narrowing them to VARCHAR(191), so long
-- alternate spellings are also checked in full.
DROP TRIGGER `persian_word_validate_not_normalized_texts_insert`;
DROP TRIGGER `persian_word_validate_not_normalized_texts_update`;

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
            '$[*]' COLUMNS (`value` JSON PATH '$')
        ) AS `items`
    ) <> (
        SELECT COUNT(DISTINCT JSON_UNQUOTE(`items`.`value`))
        FROM JSON_TABLE(
            NEW.`not_normalized_texts`,
            '$[*]' COLUMNS (`value` JSON PATH '$')
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
            '$[*]' COLUMNS (`value` JSON PATH '$')
        ) AS `items`
    ) <> (
        SELECT COUNT(DISTINCT JSON_UNQUOTE(`items`.`value`))
        FROM JSON_TABLE(
            NEW.`not_normalized_texts`,
            '$[*]' COLUMNS (`value` JSON PATH '$')
        ) AS `items`
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'not_normalized_texts items must be unique';
    END IF;
END;
