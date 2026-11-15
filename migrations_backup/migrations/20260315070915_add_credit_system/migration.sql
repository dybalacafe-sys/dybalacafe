-- AlterTable
ALTER TABLE `Customer` ADD COLUMN `creditLimit` DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN `creditUsed` DOUBLE NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `TableSession` ADD COLUMN `creditAmount` DOUBLE NOT NULL DEFAULT 0,
    ADD COLUMN `creditPaid` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `paidAmount` DOUBLE NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `CreditPayment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sessionId` INTEGER NOT NULL,
    `amount` DOUBLE NOT NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `recordedById` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CreditPayment` ADD CONSTRAINT `CreditPayment_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `TableSession`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CreditPayment` ADD CONSTRAINT `CreditPayment_recordedById_fkey` FOREIGN KEY (`recordedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
