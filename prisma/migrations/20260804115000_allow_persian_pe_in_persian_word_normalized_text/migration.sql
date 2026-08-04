-- `پ` (U+067E) is one of the 33 permitted Persian letters.
ALTER TABLE `persian_word`
    DROP CHECK `persian_word_normalized_text_fa_only`;

ALTER TABLE `persian_word`
    ADD CONSTRAINT `persian_word_normalized_text_fa_only` CHECK (
        `normalized_text` REGEXP '^[اآبپتثجحخدذرزژسشصضطظعغفقکگلمنوهی]+$'
    );
