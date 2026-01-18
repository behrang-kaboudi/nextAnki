-- Add column without data loss
ALTER TABLE `Word`
  ADD COLUMN `json_hint` VARCHAR(191) NULL;

