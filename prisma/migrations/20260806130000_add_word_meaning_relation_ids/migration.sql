-- Stores unique Word.id values. Application writes keep both arrays self-free,
-- bidirectional, and keep synonymIds as a subset of comparedMeaningWordIds.
ALTER TABLE `word`
    ADD COLUMN `comparedMeaningWordIds` JSON NULL,
    ADD COLUMN `synonymIds` JSON NULL;
