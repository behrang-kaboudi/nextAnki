CREATE TEMPORARY TABLE `SentenceCanonical`
SELECT MIN(`id`) AS `keepId`, `sentence_en`
FROM `Sentence`
GROUP BY `sentence_en`;

CREATE TEMPORARY TABLE `SentenceMergedMeaning`
SELECT c.`keepId`, MAX(s.`sentence_en_meaning_fa`) AS `mergedMeaning`
FROM `Sentence` s
INNER JOIN `SentenceCanonical` c ON c.`sentence_en` = s.`sentence_en`
GROUP BY c.`keepId`;

CREATE TEMPORARY TABLE `SentenceRemap`
SELECT s.`id` AS `oldId`, c.`keepId`, s.`sentence_en`
FROM `Sentence` s
INNER JOIN `SentenceCanonical` c ON c.`sentence_en` = s.`sentence_en`
WHERE s.`id` <> c.`keepId`;

UPDATE `Sentence` keeper
INNER JOIN `SentenceMergedMeaning` merged ON merged.`keepId` = keeper.`id`
SET keeper.`sentence_en_meaning_fa` =
  CASE
    WHEN keeper.`sentence_en_meaning_fa` IS NULL OR TRIM(keeper.`sentence_en_meaning_fa`) = ''
      THEN merged.`mergedMeaning`
    ELSE keeper.`sentence_en_meaning_fa`
  END;

INSERT IGNORE INTO `SentenceWordLink` (`sentenceId`, `wordId`, `isPrimary`, `createdAt`, `updatedAt`)
SELECT remap.`keepId`, sw.`wordId`, sw.`isPrimary`, sw.`createdAt`, sw.`updatedAt`
FROM `SentenceWordLink` sw
INNER JOIN `SentenceRemap` remap ON remap.`oldId` = sw.`sentenceId`;

UPDATE `SentenceWordLink` keeper
INNER JOIN (
  SELECT remap.`keepId` AS `sentenceId`, sw.`wordId`
  FROM `SentenceWordLink` sw
  INNER JOIN `SentenceRemap` remap ON remap.`oldId` = sw.`sentenceId`
  WHERE sw.`isPrimary` = true
) mergedPrimary ON mergedPrimary.`sentenceId` = keeper.`sentenceId` AND mergedPrimary.`wordId` = keeper.`wordId`
SET keeper.`isPrimary` = true;

DELETE sw
FROM `SentenceWordLink` sw
INNER JOIN `SentenceRemap` remap ON remap.`oldId` = sw.`sentenceId`;

DELETE s
FROM `Sentence` s
INNER JOIN `SentenceRemap` remap ON remap.`oldId` = s.`id`;

DROP TEMPORARY TABLE `SentenceRemap`;
DROP TEMPORARY TABLE `SentenceMergedMeaning`;
DROP TEMPORARY TABLE `SentenceCanonical`;

CREATE UNIQUE INDEX `Sentence_sentence_en_key` ON `Sentence`(`sentence_en`);
