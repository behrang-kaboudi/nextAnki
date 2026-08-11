ALTER TABLE `word`
  ADD COLUMN `inflectionMergeReviewed` BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX `Word_inflectionMergeReviewed_idx`
  ON `word`(`inflectionMergeReviewed`);

CREATE TABLE `english_word_form` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `englishWordId` INTEGER NOT NULL,
  `form` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `EnglishWordForm_englishWordId_form_key`(`englishWordId`, `form`),
  INDEX `EnglishWordForm_form_idx`(`form`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `english_word_form`
  ADD CONSTRAINT `english_word_form_englishWordId_fkey`
  FOREIGN KEY (`englishWordId`) REFERENCES `english_word`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
