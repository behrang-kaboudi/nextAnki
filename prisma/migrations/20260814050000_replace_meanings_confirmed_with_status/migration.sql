ALTER TABLE `word_sense`
  ADD COLUMN `meaningReviewStatus` ENUM(
    'PENDING',
    'CONFIRMED',
    'NEEDS_ACTION_INVALID_PRIMARY',
    'NEEDS_ACTION_NORMALIZATION_CONFLICT',
    'NEEDS_ACTION_MISSING_PRIMARY'
  ) NOT NULL DEFAULT 'PENDING';

UPDATE `word_sense`
SET `meaningReviewStatus` = CASE
  WHEN `meaningId` IS NULL THEN 'NEEDS_ACTION_MISSING_PRIMARY'
  WHEN `meanings_confirmed` = TRUE THEN 'CONFIRMED'
  ELSE 'PENDING'
END;

CREATE INDEX `WordSense_meaningReviewStatus_idx`
  ON `word_sense`(`meaningReviewStatus`);

ALTER TABLE `word_sense` DROP COLUMN `meanings_confirmed`;
