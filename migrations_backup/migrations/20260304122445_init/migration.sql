-- AlterTable
ALTER TABLE `Customer` ADD COLUMN `points` DOUBLE NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `Sale` ADD COLUMN `customerId` INTEGER NULL,
    ADD COLUMN `pointsEarned` DOUBLE NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `permissions` JSON NOT NULL;

-- AddForeignKey
ALTER TABLE `Sale` ADD CONSTRAINT `Sale_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
