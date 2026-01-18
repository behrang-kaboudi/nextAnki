-- Add column without data loss
ALTER TABLE `Word`
  ADD COLUMN `other_meanings` VARCHAR(191) NULL;

