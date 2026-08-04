-- Empty (or NULL) IPA values may repeat. Every non-empty value is unique.
ALTER TABLE `persian_word`
    ADD COLUMN `meaning_fa_IPA_unique` VARCHAR(191)
        GENERATED ALWAYS AS (NULLIF(`meaning_fa_IPA`, '')) STORED,
    ADD UNIQUE INDEX `persian_word_meaning_fa_IPA_unique` (`meaning_fa_IPA_unique`);
