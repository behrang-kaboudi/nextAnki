-- DropForeignKey
ALTER TABLE `Sentence` DROP FOREIGN KEY `Sentence_anki_link_id_fkey`;

-- AlterTable
ALTER TABLE `Sentence` DROP PRIMARY KEY,
    ADD COLUMN `id` INTEGER NOT NULL AUTO_INCREMENT FIRST,
    MODIFY `anki_link_id` VARCHAR(191) NULL,
    ADD PRIMARY KEY (`id`);

-- CreateIndex
CREATE UNIQUE INDEX `Sentence_anki_link_id_key` ON `Sentence`(`anki_link_id`);

-- AddForeignKey
ALTER TABLE `Sentence` ADD CONSTRAINT `Sentence_anki_link_id_fkey` FOREIGN KEY (`anki_link_id`) REFERENCES `word`(`anki_link_id`) ON DELETE CASCADE ON UPDATE CASCADE;
