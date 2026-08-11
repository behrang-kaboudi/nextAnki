-- CreateTable
CREATE TABLE `table_field_maintenance_operation` (
    `id` VARCHAR(36) NOT NULL,
    `model` VARCHAR(191) NOT NULL,
    `field` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `affectedRows` INTEGER NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'completed',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `undoneAt` DATETIME(3) NULL,

    INDEX `TableFieldMaintenanceOperation_model_createdAt_idx`(`model`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `table_field_maintenance_snapshot` (
    `operationId` VARCHAR(36) NOT NULL,
    `recordId` INTEGER NOT NULL,
    `data` JSON NOT NULL,

    PRIMARY KEY (`operationId`, `recordId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `table_field_maintenance_snapshot` ADD CONSTRAINT `table_field_maintenance_snapshot_operationId_fkey` FOREIGN KEY (`operationId`) REFERENCES `table_field_maintenance_operation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
