ALTER TABLE `word_sense`
  ADD COLUMN `idiomReviewCompleted` BOOLEAN NOT NULL DEFAULT false;

-- A single-token base form does not need multi-word idiom/lexical-unit review.
-- Whitespace and hyphenated forms remain pending for the review workflow.
UPDATE `word_sense` AS `ws`
INNER JOIN `english_word` AS `ew` ON `ew`.`id` = `ws`.`englishId`
SET `ws`.`idiomReviewCompleted` = true
WHERE TRIM(`ew`.`base_form`) NOT REGEXP '[[:space:]]|-';

CREATE INDEX `WordSense_idiomReviewCompleted_idx`
  ON `word_sense`(`idiomReviewCompleted`);
