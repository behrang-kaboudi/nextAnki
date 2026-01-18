/*
  Warnings:

  - You are about to drop the `Words` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE `Word` ADD COLUMN `imageability` INTEGER NOT NULL DEFAULT 10;

-- DropTable
DROP TABLE `Words`;
