-- AlterTable
ALTER TABLE `user`
    ADD COLUMN `email_verified` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `email_verified_at` DATETIME(3) NULL,
    ADD COLUMN `email_verification_token_hash` VARCHAR(191) NULL,
    ADD COLUMN `email_verification_expires_at` DATETIME(3) NULL,
    ADD COLUMN `password_reset_token_hash` VARCHAR(191) NULL,
    ADD COLUMN `password_reset_expires_at` DATETIME(3) NULL,
    ADD COLUMN `must_change_password` BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX `user_email_verification_token_hash_key` ON `user`(`email_verification_token_hash`);

-- CreateIndex
CREATE UNIQUE INDEX `user_password_reset_token_hash_key` ON `user`(`password_reset_token_hash`);
