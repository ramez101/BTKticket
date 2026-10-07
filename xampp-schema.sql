CREATE DATABASE IF NOT EXISTS `btkticket` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `btkticket`;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `appointments`, `charge_day_blocks`, `charge_availabilities`, `tickets`, `daily_counters`, `holidays`, `service_hours`, `guichets`, `charges`, `agencies`;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE `agencies` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `city` VARCHAR(191) NOT NULL,
  `address` VARCHAR(191) NULL,
  `latitude` DOUBLE NULL,
  `longitude` DOUBLE NULL,
  `pin` VARCHAR(191) NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT TRUE,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `agencies_code_key` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `guichets` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `number` INT NOT NULL,
  `label` VARCHAR(191) NOT NULL,
  `agencyId` INT NOT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (`id`),
  UNIQUE KEY `guichets_agencyId_number_key` (`agencyId`, `number`),
  CONSTRAINT `guichets_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `agencies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `tickets` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `number` INT NOT NULL,
  `label` VARCHAR(191) NOT NULL,
  `service` VARCHAR(191) NOT NULL,
  `status` ENUM('WAITING', 'CALLED', 'SERVED', 'ABSENT') NOT NULL DEFAULT 'WAITING',
  `qrCode` VARCHAR(191) NULL,
  `agencyId` INT NOT NULL,
  `guichetId` INT NULL,
  `dayDate` VARCHAR(191) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `calledAt` DATETIME(3) NULL,
  `servedAt` DATETIME(3) NULL,
  `onHold` BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (`id`),
  CONSTRAINT `tickets_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `agencies` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `tickets_guichetId_fkey` FOREIGN KEY (`guichetId`) REFERENCES `guichets` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `daily_counters` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `agencyId` INT NOT NULL,
  `dayDate` VARCHAR(191) NOT NULL,
  `counter` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `daily_counters_agencyId_dayDate_key` (`agencyId`, `dayDate`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `holidays` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `date` VARCHAR(191) NOT NULL,
  `label` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `holidays_date_key` (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `charges` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `agencyId` INT NOT NULL,
  `email` VARCHAR(191) NULL,
  `phone` VARCHAR(191) NULL,
  `outlookEmail` VARCHAR(191) NULL,
  `outlookRefreshToken` VARCHAR(191) NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT TRUE,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `charges_code_key` (`code`),
  CONSTRAINT `charges_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `agencies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `charge_availabilities` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `chargeId` INT NOT NULL,
  `weekday` INT NOT NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT FALSE,
  `startTime` VARCHAR(191) NOT NULL DEFAULT '08:30',
  `endTime` VARCHAR(191) NOT NULL DEFAULT '16:00',
  `slotMinutes` INT NOT NULL DEFAULT 30,
  PRIMARY KEY (`id`),
  UNIQUE KEY `charge_availabilities_chargeId_weekday_key` (`chargeId`, `weekday`),
  CONSTRAINT `charge_availabilities_chargeId_fkey` FOREIGN KEY (`chargeId`) REFERENCES `charges` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `charge_day_blocks` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `chargeId` INT NOT NULL,
  `date` VARCHAR(191) NOT NULL,
  `startTime` VARCHAR(191) NULL,
  `endTime` VARCHAR(191) NULL,
  `allDay` BOOLEAN NOT NULL DEFAULT FALSE,
  `label` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `charge_day_blocks_chargeId_date_idx` (`chargeId`, `date`),
  CONSTRAINT `charge_day_blocks_chargeId_fkey` FOREIGN KEY (`chargeId`) REFERENCES `charges` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `appointments` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `reference` VARCHAR(191) NOT NULL,
  `chargeId` INT NOT NULL,
  `agencyId` INT NOT NULL,
  `date` VARCHAR(191) NOT NULL,
  `time` VARCHAR(191) NOT NULL,
  `customerName` VARCHAR(191) NOT NULL,
  `customerPhone` VARCHAR(191) NOT NULL,
  `customerEmail` VARCHAR(191) NULL,
  `subject` VARCHAR(191) NULL,
  `outlookEventId` VARCHAR(191) NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'CONFIRMED',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `appointments_reference_key` (`reference`),
  UNIQUE KEY `appointments_chargeId_date_time_key` (`chargeId`, `date`, `time`),
  CONSTRAINT `appointments_chargeId_fkey` FOREIGN KEY (`chargeId`) REFERENCES `charges` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `appointments_agencyId_fkey` FOREIGN KEY (`agencyId`) REFERENCES `agencies` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `service_hours` (
  `key` VARCHAR(191) NOT NULL DEFAULT 'default',
  `activeMode` VARCHAR(191) NOT NULL DEFAULT 'service',
  `singleSessionStart` VARCHAR(191) NOT NULL DEFAULT '08:00',
  `singleSessionEnd` VARCHAR(191) NOT NULL DEFAULT '16:30',
  `singleSessionStartMonth` VARCHAR(191) NULL,
  `singleSessionEndMonth` VARCHAR(191) NULL,
  `ramadanEnabled` BOOLEAN NOT NULL DEFAULT FALSE,
  `ramadanMonth` VARCHAR(191) NULL,
  `ramadanStartDate` VARCHAR(191) NULL,
  `ramadanEndDate` VARCHAR(191) NULL,
  `ramadanStartTime` VARCHAR(191) NOT NULL DEFAULT '08:00',
  `ramadanEndTime` VARCHAR(191) NOT NULL DEFAULT '14:00',
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
