-- The normalized IPA is intentionally lossy (for example, it folds consonant
-- length), so pronunciation identity must use the standardized source IPA.
ALTER TABLE `persian_word`
  DROP INDEX `PersianWord_normalized_text_meaning_fa_IPA_normalize_key`,
  ADD UNIQUE INDEX `PersianWord_normalized_text_meaning_fa_IPA_key`
    (`normalized_text`, `meaning_fa_IPA`);
