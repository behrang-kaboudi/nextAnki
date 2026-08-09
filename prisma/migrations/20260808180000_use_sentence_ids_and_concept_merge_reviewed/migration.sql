-- `sentenceIds[0]` is the primary sentence for a Word. Preserve any legacy
-- `sentenceId` value at the front of the JSON array before dropping the column.
UPDATE `word`
SET `sentenceIds` = CASE
  WHEN `sentenceId` IS NULL THEN COALESCE(`sentenceIds`, JSON_ARRAY())
  WHEN `sentenceIds` IS NULL OR JSON_TYPE(`sentenceIds`) <> 'ARRAY' THEN JSON_ARRAY(`sentenceId`)
  WHEN JSON_CONTAINS(`sentenceIds`, JSON_ARRAY(`sentenceId`), '$') THEN `sentenceIds`
  ELSE JSON_ARRAY_INSERT(`sentenceIds`, '$[0]', `sentenceId`)
END;

ALTER TABLE `word`
  ADD COLUMN `conceptMergeReviewed` BOOLEAN NOT NULL DEFAULT false;

-- Existing Words have already passed the historical merge workflow except for
-- the six records whose sentences were produced by the new custom extraction.
UPDATE `word` SET `conceptMergeReviewed` = true;
UPDATE `word`
SET `conceptMergeReviewed` = false
WHERE `id` IN (4912, 4910, 3736, 3497, 3344, 3342);

ALTER TABLE `word` DROP FOREIGN KEY `Word_sentenceId_fkey`;
DROP INDEX `Word_sentenceId_idx` ON `word`;
ALTER TABLE `word` DROP COLUMN `sentenceId`;
CREATE INDEX `Word_conceptMergeReviewed_idx` ON `word`(`conceptMergeReviewed`);
