-- Stores unique Sentence.id values for usages of a Word with its primary meaning.
ALTER TABLE `word`
    ADD COLUMN `sentenceIds` JSON NULL;
