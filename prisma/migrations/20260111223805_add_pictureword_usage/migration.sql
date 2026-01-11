-- AlterTable
ALTER TABLE `PictureWord` ADD COLUMN `usage` ENUM('Job', 'adj', 'person', 'free', 'notSet') NOT NULL DEFAULT 'notSet';
