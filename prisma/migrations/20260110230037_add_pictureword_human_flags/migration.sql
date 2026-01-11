-- AlterTable
ALTER TABLE `PictureWord` ADD COLUMN `canImagineAsHuman` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `canUseAsHumanAdj` BOOLEAN NOT NULL DEFAULT false;
