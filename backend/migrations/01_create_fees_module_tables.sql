-- =======================================================================
-- MIGRATION: Complete Fees Management Module
-- Tables: fee_structures, fee_structure_charges, fee_invoices,
--         fee_invoice_items, fee_payments, fee_receipts,
--         fee_audit_logs, fee_email_logs
-- =======================================================================

-- 1. FEE STRUCTURES TABLE
CREATE TABLE IF NOT EXISTS `fee_structures` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `title` VARCHAR(150) NOT NULL,
    `academic_year` VARCHAR(20) NOT NULL,
    `semester` VARCHAR(50) NOT NULL,
    `total_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `description` TEXT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_fee_structures_year_sem` (`academic_year`, `semester`),
    INDEX `idx_fee_structures_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 2. FEE STRUCTURE CHARGES TABLE
CREATE TABLE IF NOT EXISTS `fee_structure_charges` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `fee_structure_id` INT NOT NULL,
    `charge_name` VARCHAR(100) NOT NULL,
    `amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`fee_structure_id`) REFERENCES `fee_structures`(`id`) ON DELETE CASCADE,
    INDEX `idx_structure_charges` (`fee_structure_id`, `is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 3. FEE INVOICES TABLE
CREATE TABLE IF NOT EXISTS `fee_invoices` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `invoice_no` VARCHAR(50) NOT NULL UNIQUE,
    `student_id` INT NOT NULL,
    `fee_structure_id` INT NULL,
    `academic_year` VARCHAR(20) NOT NULL,
    `semester` VARCHAR(50) NOT NULL,
    `total_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `paid_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `balance_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    `issue_date` DATE NOT NULL,
    `due_date` DATE NOT NULL,
    `status` ENUM('Unpaid', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled') NOT NULL DEFAULT 'Unpaid',
    `remarks` TEXT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_invoices_student` (`student_id`),
    INDEX `idx_invoices_status` (`status`),
    INDEX `idx_invoices_year_sem` (`academic_year`, `semester`),
    INDEX `idx_invoices_due_date` (`due_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 4. FEE INVOICE ITEMS TABLE
CREATE TABLE IF NOT EXISTS `fee_invoice_items` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `invoice_id` INT NOT NULL,
    `charge_name` VARCHAR(100) NOT NULL,
    `amount` DECIMAL(10,2) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`invoice_id`) REFERENCES `fee_invoices`(`id`) ON DELETE CASCADE,
    INDEX `idx_invoice_items` (`invoice_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 5. FEE PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS `fee_payments` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `invoice_id` INT NOT NULL,
    `student_id` INT NOT NULL,
    `amount` DECIMAL(10,2) NOT NULL,
    `payment_method` VARCHAR(50) NOT NULL DEFAULT 'Razorpay',
    `payment_date` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `razorpay_order_id` VARCHAR(100) NULL,
    `razorpay_payment_id` VARCHAR(100) NULL,
    `razorpay_signature` VARCHAR(255) NULL,
    `receipt_no` VARCHAR(50) NULL UNIQUE,
    `status` ENUM('Success', 'Pending', 'Failed') NOT NULL DEFAULT 'Pending',
    `failure_reason` TEXT NULL,
    `notes` TEXT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_payments_invoice` (`invoice_id`),
    INDEX `idx_payments_student` (`student_id`),
    INDEX `idx_payments_status` (`status`),
    INDEX `idx_payments_razorpay_payment_id` (`razorpay_payment_id`),
    INDEX `idx_payments_order` (`razorpay_order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 6. FEE RECEIPTS TABLE
CREATE TABLE IF NOT EXISTS `fee_receipts` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `receipt_no` VARCHAR(50) NOT NULL UNIQUE,
    `payment_id` INT NOT NULL,
    `invoice_id` INT NOT NULL,
    `student_id` INT NOT NULL,
    `amount` DECIMAL(10,2) NOT NULL,
    `payment_date` DATETIME NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_receipts_invoice` (`invoice_id`),
    INDEX `idx_receipts_student` (`student_id`),
    INDEX `idx_receipts_payment` (`payment_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 7. FEE AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS `fee_audit_logs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `action` VARCHAR(100) NOT NULL,
    `entity_type` VARCHAR(50) NOT NULL,
    `entity_id` INT NULL,
    `performed_by` VARCHAR(100) NOT NULL,
    `details` JSON NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_audit_entity` (`entity_type`, `entity_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 8. FEE EMAIL LOGS TABLE
CREATE TABLE IF NOT EXISTS `fee_email_logs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `receipt_no` VARCHAR(50) NULL,
    `student_id` INT NOT NULL,
    `recipient_email` VARCHAR(150) NOT NULL,
    `status` ENUM('Sent', 'Failed') NOT NULL,
    `error_message` TEXT NULL,
    `sent_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_email_logs_receipt` (`receipt_no`),
    INDEX `idx_email_logs_student` (`student_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- =======================================================================
-- INITIAL SEED: Standard Semester Fee Structure (₹45,000 total)
-- =======================================================================
INSERT INTO `fee_structures` (`id`, `title`, `academic_year`, `semester`, `total_amount`, `is_active`, `description`)
SELECT 1, 'Standard Hostel Semester Fee', '2026-2027', 'Semester 1', 45000.00, 1, 'Initial standard semester hostel fee structure'
WHERE NOT EXISTS (SELECT 1 FROM `fee_structures` WHERE `id` = 1);

INSERT INTO `fee_structure_charges` (`fee_structure_id`, `charge_name`, `amount`, `is_active`)
SELECT 1, 'Accommodation Charges', 25000.00, 1
WHERE NOT EXISTS (SELECT 1 FROM `fee_structure_charges` WHERE `fee_structure_id` = 1 AND `charge_name` = 'Accommodation Charges');

INSERT INTO `fee_structure_charges` (`fee_structure_id`, `charge_name`, `amount`, `is_active`)
SELECT 1, 'Mess Charges', 15000.00, 1
WHERE NOT EXISTS (SELECT 1 FROM `fee_structure_charges` WHERE `fee_structure_id` = 1 AND `charge_name` = 'Mess Charges');

INSERT INTO `fee_structure_charges` (`fee_structure_id`, `charge_name`, `amount`, `is_active`)
SELECT 1, 'Maintenance Charges', 2000.00, 1
WHERE NOT EXISTS (SELECT 1 FROM `fee_structure_charges` WHERE `fee_structure_id` = 1 AND `charge_name` = 'Maintenance Charges');

INSERT INTO `fee_structure_charges` (`fee_structure_id`, `charge_name`, `amount`, `is_active`)
SELECT 1, 'Light Bill', 3000.00, 1
WHERE NOT EXISTS (SELECT 1 FROM `fee_structure_charges` WHERE `fee_structure_id` = 1 AND `charge_name` = 'Light Bill');

