-- Renames the existing column in place, preserving every EnglishWord value.
ALTER TABLE `english_word` RENAME COLUMN `normalized_text` TO `base_form`;

ALTER TABLE `english_word`
  RENAME INDEX `EnglishWord_normalized_text_key` TO `EnglishWord_base_form_key`;
