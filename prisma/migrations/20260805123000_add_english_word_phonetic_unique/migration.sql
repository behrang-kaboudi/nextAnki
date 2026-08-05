DROP INDEX `EnglishWord_phonetic_us_normalized_idx` ON `english_word`;
CREATE UNIQUE INDEX `EnglishWord_phonetic_us_normalized_key` ON `english_word`(`phonetic_us_normalized`);
