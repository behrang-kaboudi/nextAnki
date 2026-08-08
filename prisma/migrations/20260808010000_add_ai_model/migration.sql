CREATE TABLE `AiModel` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL DEFAULT 'lm_studio',
    `modelIdentifier` VARCHAR(191) NOT NULL,
    `baseUrl` VARCHAR(191) NOT NULL DEFAULT 'http://localhost:1234/v1',
    `systemPrompt` TEXT NULL,
    `settings` JSON NOT NULL,
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AiModel_name_key`(`name`),
    INDEX `AiModel_provider_isEnabled_idx`(`provider`, `isEnabled`),
    INDEX `AiModel_modelIdentifier_idx`(`modelIdentifier`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
