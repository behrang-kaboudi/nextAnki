-- Persian homographs may share their written form while differing by pronunciation.
-- IPA values may also legitimately be shared by unrelated Persian words.
ALTER TABLE `persian_word`
  DROP INDEX `persian_word_meaning_fa_IPA_unique`,
  DROP COLUMN `meaning_fa_IPA_unique`,
  ADD UNIQUE INDEX `PersianWord_normalized_text_meaning_fa_IPA_normalize_key`
    (`normalized_text`, `meaning_fa_IPA_normalize`);
