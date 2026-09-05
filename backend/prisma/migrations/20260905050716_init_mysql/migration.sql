-- CreateTable
CREATE TABLE `facility` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('HOSPITAL', 'TREATMENT_FACILITY') NOT NULL,
    `registration_number` VARCHAR(191) NOT NULL,
    `address` VARCHAR(191) NOT NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `geofence_radius_m` INTEGER NULL,
    `authorized_category_ids` JSON NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'SUSPENDED') NOT NULL DEFAULT 'PENDING',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `facility_registration_number_key`(`registration_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user` (
    `id` VARCHAR(191) NOT NULL,
    `facility_id` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `password_hash` VARCHAR(191) NOT NULL,
    `role` ENUM('HOSPITAL_ADMIN', 'HOSPITAL_STAFF', 'COLLECTION_STAFF', 'TRANSPORT_PERSONNEL', 'TREATMENT_FACILITY_STAFF', 'GOVERNMENT_AUTHORITY', 'SUPER_ADMIN') NOT NULL,
    `status` ENUM('ACTIVE', 'DEACTIVATED') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `last_login_at` DATETIME(3) NULL,

    UNIQUE INDEX `user_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_token` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `token_hash` VARCHAR(191) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `refresh_token_token_hash_key`(`token_hash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `waste_category` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `color_code` VARCHAR(191) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `waste_category_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `compliance_rule` (
    `id` VARCHAR(191) NOT NULL,
    `waste_category_id` VARCHAR(191) NOT NULL,
    `stage` ENUM('COLLECTION', 'TRANSPORT', 'TREATMENT') NOT NULL,
    `max_duration_hours` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `compliance_rule_waste_category_id_stage_key`(`waste_category_id`, `stage`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `waste_batch` (
    `id` VARCHAR(191) NOT NULL,
    `waste_id` VARCHAR(191) NOT NULL,
    `category_id` VARCHAR(191) NOT NULL,
    `hospital_id` VARCHAR(191) NOT NULL,
    `department` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(65, 30) NOT NULL,
    `unit` ENUM('KG', 'COUNT') NOT NULL,
    `generated_by_user_id` VARCHAR(191) NOT NULL,
    `generated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` ENUM('REGISTERED', 'QR_ASSIGNED', 'COLLECTED', 'IN_TRANSIT', 'RECEIVED', 'TREATED', 'VERIFIED_CLOSED', 'VIOLATION') NOT NULL DEFAULT 'REGISTERED',
    `photo_url` VARCHAR(191) NULL,
    `current_custodian_user_id` VARCHAR(191) NULL,
    `current_latitude` DOUBLE NULL,
    `current_longitude` DOUBLE NULL,
    `idempotency_key` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `waste_batch_waste_id_key`(`waste_id`),
    UNIQUE INDEX `waste_batch_idempotency_key_key`(`idempotency_key`),
    INDEX `waste_batch_status_idx`(`status`),
    INDEX `waste_batch_hospital_id_status_idx`(`hospital_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `qr_code` (
    `id` VARCHAR(191) NOT NULL,
    `waste_batch_id` VARCHAR(191) NOT NULL,
    `code_value` VARCHAR(191) NOT NULL,
    `generated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `generated_by_user_id` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `qr_code_waste_batch_id_key`(`waste_batch_id`),
    UNIQUE INDEX `qr_code_code_value_key`(`code_value`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `custody_event` (
    `id` VARCHAR(191) NOT NULL,
    `waste_batch_id` VARCHAR(191) NOT NULL,
    `event_type` ENUM('REGISTERED', 'QR_ASSIGNED', 'COLLECTION_ACCEPTED', 'TRANSPORT_STARTED', 'TRANSPORT_UPDATED', 'ARRIVAL_VERIFIED', 'TREATMENT_CONFIRMED', 'VERIFIED_CLOSED') NOT NULL,
    `from_user_id` VARCHAR(191) NULL,
    `to_user_id` VARCHAR(191) NULL,
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,
    `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `notes` VARCHAR(191) NULL,
    `photo_url` VARCHAR(191) NULL,

    INDEX `custody_event_waste_batch_id_occurred_at_idx`(`waste_batch_id`, `occurred_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `vehicle` (
    `id` VARCHAR(191) NOT NULL,
    `registration_number` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `capacity` DOUBLE NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',

    UNIQUE INDEX `vehicle_registration_number_key`(`registration_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transport_assignment` (
    `id` VARCHAR(191) NOT NULL,
    `waste_batch_id` VARCHAR(191) NOT NULL,
    `vehicle_id` VARCHAR(191) NOT NULL,
    `driver_user_id` VARCHAR(191) NOT NULL,
    `start_time` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expected_facility_id` VARCHAR(191) NOT NULL,
    `end_time` DATETIME(3) NULL,
    `status` ENUM('IN_PROGRESS', 'ARRIVED', 'ABANDONED') NOT NULL DEFAULT 'IN_PROGRESS',

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `gps_ping` (
    `id` VARCHAR(191) NOT NULL,
    `transport_assignment_id` VARCHAR(191) NOT NULL,
    `latitude` DOUBLE NOT NULL,
    `longitude` DOUBLE NOT NULL,
    `recorded_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `gps_ping_transport_assignment_id_recorded_at_idx`(`transport_assignment_id`, `recorded_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `alert` (
    `id` VARCHAR(191) NOT NULL,
    `waste_batch_id` VARCHAR(191) NULL,
    `type` ENUM('DISPOSAL_DELAY', 'UNAUTHORIZED_LOCATION', 'ROUTE_DEVIATION', 'MISSING_SCAN') NOT NULL,
    `severity` ENUM('LOW', 'MEDIUM', 'HIGH') NOT NULL,
    `status` ENUM('OPEN', 'INVESTIGATING', 'RESOLVED') NOT NULL DEFAULT 'OPEN',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resolved_at` DATETIME(3) NULL,
    `resolved_by_user_id` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,

    INDEX `alert_status_type_idx`(`status`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_log` (
    `id` VARCHAR(191) NOT NULL,
    `actor_user_id` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `entity_type` VARCHAR(191) NOT NULL,
    `entity_id` VARCHAR(191) NOT NULL,
    `metadata` JSON NULL,
    `ip_address` VARCHAR(191) NULL,
    `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_log_entity_type_entity_id_idx`(`entity_type`, `entity_id`),
    INDEX `audit_log_occurred_at_idx`(`occurred_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notification` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `message` VARCHAR(191) NOT NULL,
    `read_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notification_user_id_read_at_idx`(`user_id`, `read_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user` ADD CONSTRAINT `user_facility_id_fkey` FOREIGN KEY (`facility_id`) REFERENCES `facility`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refresh_token` ADD CONSTRAINT `refresh_token_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `compliance_rule` ADD CONSTRAINT `compliance_rule_waste_category_id_fkey` FOREIGN KEY (`waste_category_id`) REFERENCES `waste_category`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `waste_batch` ADD CONSTRAINT `waste_batch_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `waste_category`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `waste_batch` ADD CONSTRAINT `waste_batch_hospital_id_fkey` FOREIGN KEY (`hospital_id`) REFERENCES `facility`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `waste_batch` ADD CONSTRAINT `waste_batch_generated_by_user_id_fkey` FOREIGN KEY (`generated_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `qr_code` ADD CONSTRAINT `qr_code_waste_batch_id_fkey` FOREIGN KEY (`waste_batch_id`) REFERENCES `waste_batch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `qr_code` ADD CONSTRAINT `qr_code_generated_by_user_id_fkey` FOREIGN KEY (`generated_by_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `custody_event` ADD CONSTRAINT `custody_event_waste_batch_id_fkey` FOREIGN KEY (`waste_batch_id`) REFERENCES `waste_batch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `custody_event` ADD CONSTRAINT `custody_event_from_user_id_fkey` FOREIGN KEY (`from_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `custody_event` ADD CONSTRAINT `custody_event_to_user_id_fkey` FOREIGN KEY (`to_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transport_assignment` ADD CONSTRAINT `transport_assignment_waste_batch_id_fkey` FOREIGN KEY (`waste_batch_id`) REFERENCES `waste_batch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transport_assignment` ADD CONSTRAINT `transport_assignment_vehicle_id_fkey` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicle`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transport_assignment` ADD CONSTRAINT `transport_assignment_driver_user_id_fkey` FOREIGN KEY (`driver_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transport_assignment` ADD CONSTRAINT `transport_assignment_expected_facility_id_fkey` FOREIGN KEY (`expected_facility_id`) REFERENCES `facility`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gps_ping` ADD CONSTRAINT `gps_ping_transport_assignment_id_fkey` FOREIGN KEY (`transport_assignment_id`) REFERENCES `transport_assignment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alert` ADD CONSTRAINT `alert_waste_batch_id_fkey` FOREIGN KEY (`waste_batch_id`) REFERENCES `waste_batch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alert` ADD CONSTRAINT `alert_resolved_by_user_id_fkey` FOREIGN KEY (`resolved_by_user_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notification` ADD CONSTRAINT `notification_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
