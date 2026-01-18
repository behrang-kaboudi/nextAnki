-- Rename column without data loss
ALTER TABLE `Word`
  CHANGE COLUMN `other_meanings` `other_meanings_fa` VARCHAR(191) NULL;

