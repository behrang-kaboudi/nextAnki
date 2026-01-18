-- Add composite unique constraint to prevent duplicates of (base_form, meaning_fa)
SET @__words_table_exists := (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name = 'Words'
);

SET @__sql := IF(
  @__words_table_exists > 0,
  'ALTER TABLE `Words` ADD CONSTRAINT `Words_base_form_meaning_fa_key` UNIQUE (`base_form`, `meaning_fa`);',
  'SELECT 1;'
);

PREPARE stmt FROM @__sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
