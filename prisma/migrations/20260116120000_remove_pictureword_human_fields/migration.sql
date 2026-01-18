-- Drop unused flags from PictureWord
ALTER TABLE `PictureWord`
  DROP COLUMN `canImagineAsHuman`,
  DROP COLUMN `canUseAsHumanAdj`;

