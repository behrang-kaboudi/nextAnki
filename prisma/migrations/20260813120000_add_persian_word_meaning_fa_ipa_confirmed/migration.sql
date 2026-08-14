ALTER TABLE `persian_word`
  ADD COLUMN `meaning_fa_IPA_confirmed` BOOLEAN NOT NULL DEFAULT false,
  ADD INDEX `PersianWord_meaning_fa_IPA_confirmed_idx` (`meaning_fa_IPA_confirmed`);
