CREATE TABLE `word_field_maintenance_operation` (
    `id` VARCHAR(36) NOT NULL,
    `field` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `affectedRows` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'completed',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `undoneAt` DATETIME(3) NULL,

    INDEX `WordFieldMaintenanceOperation_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `word_field_maintenance_snapshot` (
    `operationId` VARCHAR(36) NOT NULL,
    `wordId` INTEGER NOT NULL,
    `data` JSON NOT NULL,

    PRIMARY KEY (`operationId`, `wordId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `word_field_maintenance_snapshot`
    ADD CONSTRAINT `word_field_maintenance_snapshot_operationId_fkey`
    FOREIGN KEY (`operationId`) REFERENCES `word_field_maintenance_operation`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
