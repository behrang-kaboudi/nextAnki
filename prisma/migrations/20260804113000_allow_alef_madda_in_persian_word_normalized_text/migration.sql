-- `آ` (U+0622) is part of the permitted Persian alphabet for normalized text.
ALTER TABLE `persian_word`
    DROP CHECK `persian_word_normalized_text_fa_only`;

ALTER TABLE `persian_word`
    ADD CONSTRAINT `persian_word_normalized_text_fa_only` CHECK (
        `normalized_text` REGEXP '^[اآبتثجحخدذرزژسشصضطظعغفقکگلمنوهی]+$'
    );
