-- AlterTable
ALTER TABLE `PictureWord` MODIFY `type` ENUM('noun', 'adding', 'animal', 'person', 'notPersonal', 'humanBody', 'relationalObj', 'personAdj', 'personAdj_adj', 'adj', 'food', 'place', 'accessory', 'tool', 'sport') NOT NULL DEFAULT 'noun';
