const db = require("./config/database");

async function runMigration() {
    console.log("🚀 Starting Complete Harmonization for Fees Module on Aiven MySQL...");

    try {
        // =====================================================================
        // 1. fee_invoices Table Harmonization
        // =====================================================================
        console.log("➡️ [1/8] Harmonizing fee_invoices table...");
        const [invCols] = await db.query("SHOW COLUMNS FROM fee_invoices");
        const invColNames = invCols.map(c => c.Field);

        if (!invColNames.includes("invoice_no")) {
            console.log("   Adding column 'invoice_no'...");
            await db.query("ALTER TABLE fee_invoices ADD COLUMN invoice_no VARCHAR(60) NULL AFTER id");
        }
        if (!invColNames.includes("semester")) {
            console.log("   Adding column 'semester'...");
            await db.query("ALTER TABLE fee_invoices ADD COLUMN semester VARCHAR(50) NULL AFTER academic_year");
        }
        if (!invColNames.includes("remarks")) {
            console.log("   Adding column 'remarks'...");
            await db.query("ALTER TABLE fee_invoices ADD COLUMN remarks TEXT NULL AFTER status");
        }

        // Relax old strict columns to prevent insert errors
        if (invColNames.includes("invoice_number")) {
            await db.query("ALTER TABLE fee_invoices MODIFY COLUMN invoice_number VARCHAR(60) NULL");
        }
        if (invColNames.includes("fee_structure_id")) {
            await db.query("ALTER TABLE fee_invoices MODIFY COLUMN fee_structure_id INT UNSIGNED NULL");
        }
        if (invColNames.includes("semester_number")) {
            await db.query("ALTER TABLE fee_invoices MODIFY COLUMN semester_number TINYINT UNSIGNED NULL DEFAULT 1");
        }

        // Check if unique index on invoice_no exists
        const [invIndexes] = await db.query("SHOW INDEX FROM fee_invoices WHERE Key_name = 'idx_invoices_no'");
        if (invIndexes.length === 0) {
            await db.query("ALTER TABLE fee_invoices ADD UNIQUE INDEX idx_invoices_no (invoice_no)");
        }

        // Backfill any existing rows
        await db.query(`
            UPDATE fee_invoices
            SET
                invoice_no = COALESCE(invoice_no, invoice_number),
                semester = COALESCE(semester, CONCAT('Semester ', COALESCE(semester_number, 1)))
            WHERE invoice_no IS NULL OR semester IS NULL
        `);

        // Create synchronization triggers for fee_invoices
        await db.query("DROP TRIGGER IF EXISTS trg_fee_invoices_before_insert");
        await db.query(`
            CREATE TRIGGER trg_fee_invoices_before_insert
            BEFORE INSERT ON fee_invoices
            FOR EACH ROW
            BEGIN
                IF NEW.invoice_no IS NOT NULL AND NEW.invoice_number IS NULL THEN
                    SET NEW.invoice_number = NEW.invoice_no;
                ELSEIF NEW.invoice_number IS NOT NULL AND NEW.invoice_no IS NULL THEN
                    SET NEW.invoice_no = NEW.invoice_number;
                END IF;

                IF NEW.semester IS NOT NULL AND NEW.semester_number IS NULL THEN
                    SET NEW.semester_number = 1;
                ELSEIF NEW.semester_number IS NOT NULL AND NEW.semester IS NULL THEN
                    SET NEW.semester = CONCAT('Semester ', NEW.semester_number);
                END IF;
            END;
        `);

        await db.query("DROP TRIGGER IF EXISTS trg_fee_invoices_before_update");
        await db.query(`
            CREATE TRIGGER trg_fee_invoices_before_update
            BEFORE UPDATE ON fee_invoices
            FOR EACH ROW
            BEGIN
                IF NEW.invoice_no IS NOT NULL AND (NEW.invoice_number IS NULL OR NEW.invoice_number != NEW.invoice_no) THEN
                    SET NEW.invoice_number = NEW.invoice_no;
                ELSEIF NEW.invoice_number IS NOT NULL AND (NEW.invoice_no IS NULL OR NEW.invoice_no != NEW.invoice_number) THEN
                    SET NEW.invoice_no = NEW.invoice_number;
                END IF;

                IF NEW.semester IS NOT NULL AND NEW.semester_number IS NULL THEN
                    SET NEW.semester_number = 1;
                ELSEIF NEW.semester_number IS NOT NULL AND NEW.semester IS NULL THEN
                    SET NEW.semester = CONCAT('Semester ', NEW.semester_number);
                END IF;
            END;
        `);
        console.log("✅ fee_invoices synchronized with bidirectional triggers.");

        // =====================================================================
        // 2. fee_payments Table
        // =====================================================================
        console.log("➡️ [2/8] Verifying fee_payments table...");
        await db.query(`
            CREATE TABLE IF NOT EXISTS fee_payments (
                id INT AUTO_INCREMENT PRIMARY KEY,
                invoice_id INT NOT NULL,
                student_id INT NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                payment_method VARCHAR(50) NOT NULL DEFAULT 'Razorpay',
                payment_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                razorpay_order_id VARCHAR(100) NULL,
                razorpay_payment_id VARCHAR(100) NULL,
                razorpay_signature VARCHAR(255) NULL,
                receipt_no VARCHAR(50) NULL UNIQUE,
                status ENUM('Success', 'Pending', 'Failed') NOT NULL DEFAULT 'Pending',
                failure_reason TEXT NULL,
                notes TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_payments_invoice (invoice_id),
                INDEX idx_payments_student (student_id),
                INDEX idx_payments_status (status),
                INDEX idx_payments_razorpay_payment_id (razorpay_payment_id),
                INDEX idx_payments_order (razorpay_order_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
        `);
        console.log("✅ fee_payments verified.");

        // =====================================================================
        // 3. legacy fees Table
        // =====================================================================
        console.log("➡️ [3/8] Verifying legacy fees table...");
        await db.query(`
            CREATE TABLE IF NOT EXISTS fees (
                id INT AUTO_INCREMENT PRIMARY KEY,
                student_id INT NOT NULL,
                room_id INT NULL,
                amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                status VARCHAR(30) NOT NULL DEFAULT 'Pending',
                payment_method VARCHAR(50) NULL DEFAULT 'Razorpay',
                payment_date DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_fees_student (student_id),
                INDEX idx_fees_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
        `);
        console.log("✅ legacy fees verified.");

        // =====================================================================
        // 4. fee_structures Table Harmonization & Triggers
        // =====================================================================
        console.log("➡️ [4/8] Harmonizing fee_structures table...");
        const [structCols] = await db.query("SHOW COLUMNS FROM fee_structures");
        const structColNames = structCols.map(c => c.Field);

        if (!structColNames.includes("title")) {
            await db.query("ALTER TABLE fee_structures ADD COLUMN title VARCHAR(150) NULL AFTER id");
        }
        if (!structColNames.includes("semester")) {
            await db.query("ALTER TABLE fee_structures ADD COLUMN semester VARCHAR(50) NULL AFTER academic_year");
        }
        if (!structColNames.includes("is_active")) {
            await db.query("ALTER TABLE fee_structures ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER total_amount");
        }
        if (!structColNames.includes("description")) {
            await db.query("ALTER TABLE fee_structures ADD COLUMN description TEXT NULL AFTER is_active");
        }
        if (structColNames.includes("structure_name")) {
            await db.query("ALTER TABLE fee_structures MODIFY COLUMN structure_name VARCHAR(150) NULL");
        }
        if (structColNames.includes("semester_number")) {
            await db.query("ALTER TABLE fee_structures MODIFY COLUMN semester_number TINYINT UNSIGNED NULL DEFAULT 1");
        }

        await db.query(`
            UPDATE fee_structures
            SET
                title = COALESCE(title, structure_name, 'Standard Hostel Semester Fee'),
                semester = COALESCE(semester, CONCAT('Semester ', COALESCE(semester_number, 1)), 'Semester 1'),
                is_active = CASE WHEN status = 'inactive' THEN 0 ELSE 1 END,
                description = COALESCE(description, 'Initial standard semester hostel fee structure')
            WHERE title IS NULL OR semester IS NULL
        `);

        await db.query("DROP TRIGGER IF EXISTS trg_fee_structures_before_insert");
        await db.query(`
            CREATE TRIGGER trg_fee_structures_before_insert
            BEFORE INSERT ON fee_structures
            FOR EACH ROW
            BEGIN
                IF NEW.title IS NOT NULL AND NEW.structure_name IS NULL THEN
                    SET NEW.structure_name = NEW.title;
                ELSEIF NEW.structure_name IS NOT NULL AND NEW.title IS NULL THEN
                    SET NEW.title = NEW.structure_name;
                END IF;

                IF NEW.semester IS NOT NULL AND NEW.semester_number IS NULL THEN
                    SET NEW.semester_number = 1;
                ELSEIF NEW.semester_number IS NOT NULL AND NEW.semester IS NULL THEN
                    SET NEW.semester = CONCAT('Semester ', NEW.semester_number);
                END IF;

                IF NEW.is_active = 1 THEN
                    SET NEW.status = 'active';
                ELSE
                    SET NEW.status = 'inactive';
                END IF;
            END;
        `);

        await db.query("DROP TRIGGER IF EXISTS trg_fee_structures_before_update");
        await db.query(`
            CREATE TRIGGER trg_fee_structures_before_update
            BEFORE UPDATE ON fee_structures
            FOR EACH ROW
            BEGIN
                IF NEW.title IS NOT NULL AND (NEW.structure_name IS NULL OR NEW.structure_name != NEW.title) THEN
                    SET NEW.structure_name = NEW.title;
                ELSEIF NEW.structure_name IS NOT NULL AND (NEW.title IS NULL OR NEW.title != NEW.structure_name) THEN
                    SET NEW.title = NEW.structure_name;
                END IF;

                IF NEW.semester IS NOT NULL AND NEW.semester_number IS NULL THEN
                    SET NEW.semester_number = 1;
                ELSEIF NEW.semester_number IS NOT NULL AND NEW.semester IS NULL THEN
                    SET NEW.semester = CONCAT('Semester ', NEW.semester_number);
                END IF;

                IF NEW.is_active = 1 THEN
                    SET NEW.status = 'active';
                ELSE
                    SET NEW.status = 'inactive';
                END IF;
            END;
        `);
        console.log("✅ fee_structures synchronized with bidirectional triggers.");

        // =====================================================================
        // 5. fee_receipts Table Harmonization & Triggers
        // =====================================================================
        console.log("➡️ [5/8] Harmonizing fee_receipts table...");
        const [receiptCols] = await db.query("SHOW COLUMNS FROM fee_receipts");
        const receiptColNames = receiptCols.map(c => c.Field);

        if (!receiptColNames.includes("receipt_no")) {
            await db.query("ALTER TABLE fee_receipts ADD COLUMN receipt_no VARCHAR(60) NULL AFTER id");
        }
        if (!receiptColNames.includes("payment_date")) {
            await db.query("ALTER TABLE fee_receipts ADD COLUMN payment_date DATETIME NULL DEFAULT CURRENT_TIMESTAMP AFTER amount");
        }
        if (receiptColNames.includes("receipt_number")) {
            await db.query("ALTER TABLE fee_receipts MODIFY COLUMN receipt_number VARCHAR(60) NULL");
        }
        if (receiptColNames.includes("issued_at")) {
            await db.query("ALTER TABLE fee_receipts MODIFY COLUMN issued_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP");
        }

        const [receiptIndexes] = await db.query("SHOW INDEX FROM fee_receipts WHERE Key_name = 'idx_receipts_receipt_no'");
        if (receiptIndexes.length === 0) {
            await db.query("ALTER TABLE fee_receipts ADD UNIQUE INDEX idx_receipts_receipt_no (receipt_no)");
        }

        await db.query("DROP TRIGGER IF EXISTS trg_fee_receipts_before_insert");
        await db.query(`
            CREATE TRIGGER trg_fee_receipts_before_insert
            BEFORE INSERT ON fee_receipts
            FOR EACH ROW
            BEGIN
                IF NEW.receipt_no IS NOT NULL AND NEW.receipt_number IS NULL THEN
                    SET NEW.receipt_number = NEW.receipt_no;
                ELSEIF NEW.receipt_number IS NOT NULL AND NEW.receipt_no IS NULL THEN
                    SET NEW.receipt_no = NEW.receipt_number;
                END IF;

                IF NEW.payment_date IS NOT NULL AND NEW.issued_at IS NULL THEN
                    SET NEW.issued_at = NEW.payment_date;
                ELSEIF NEW.issued_at IS NOT NULL AND NEW.payment_date IS NULL THEN
                    SET NEW.payment_date = NEW.issued_at;
                END IF;
            END;
        `);

        await db.query("DROP TRIGGER IF EXISTS trg_fee_receipts_before_update");
        await db.query(`
            CREATE TRIGGER trg_fee_receipts_before_update
            BEFORE UPDATE ON fee_receipts
            FOR EACH ROW
            BEGIN
                IF NEW.receipt_no IS NOT NULL AND (NEW.receipt_number IS NULL OR NEW.receipt_number != NEW.receipt_no) THEN
                    SET NEW.receipt_number = NEW.receipt_no;
                ELSEIF NEW.receipt_number IS NOT NULL AND (NEW.receipt_no IS NULL OR NEW.receipt_no != NEW.receipt_number) THEN
                    SET NEW.receipt_no = NEW.receipt_number;
                END IF;

                IF NEW.payment_date IS NOT NULL AND (NEW.issued_at IS NULL OR NEW.issued_at != NEW.payment_date) THEN
                    SET NEW.issued_at = NEW.payment_date;
                ELSEIF NEW.issued_at IS NOT NULL AND (NEW.payment_date IS NULL OR NEW.payment_date != NEW.issued_at) THEN
                    SET NEW.payment_date = NEW.issued_at;
                END IF;
            END;
        `);
        console.log("✅ fee_receipts synchronized with bidirectional triggers.");

        // =====================================================================
        // 6. fee_audit_logs Table Harmonization
        // =====================================================================
        console.log("➡️ [6/8] Harmonizing fee_audit_logs table...");
        const [auditCols] = await db.query("SHOW COLUMNS FROM fee_audit_logs");
        const auditColNames = auditCols.map(c => c.Field);

        if (!auditColNames.includes("performed_by")) {
            await db.query("ALTER TABLE fee_audit_logs ADD COLUMN performed_by VARCHAR(100) NULL AFTER entity_id");
        }
        if (!auditColNames.includes("details")) {
            await db.query("ALTER TABLE fee_audit_logs ADD COLUMN details JSON NULL AFTER performed_by");
        }
        if (auditColNames.includes("admin_id")) {
            await db.query("ALTER TABLE fee_audit_logs MODIFY COLUMN admin_id INT NULL");
        }
        console.log("✅ fee_audit_logs verified.");

        // =====================================================================
        // 7. fee_email_logs Table Harmonization
        // =====================================================================
        console.log("➡️ [7/8] Harmonizing fee_email_logs table...");
        const [emailCols] = await db.query("SHOW COLUMNS FROM fee_email_logs");
        const emailColNames = emailCols.map(c => c.Field);

        if (!emailColNames.includes("receipt_no")) {
            await db.query("ALTER TABLE fee_email_logs ADD COLUMN receipt_no VARCHAR(60) NULL AFTER id");
        }
        if (!emailColNames.includes("error_message")) {
            await db.query("ALTER TABLE fee_email_logs ADD COLUMN error_message TEXT NULL");
        }
        if (emailColNames.includes("email_type")) {
            await db.query("ALTER TABLE fee_email_logs MODIFY COLUMN email_type VARCHAR(60) NULL DEFAULT 'receipt'");
        }
        if (emailColNames.includes("status")) {
            await db.query("ALTER TABLE fee_email_logs MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'sent'");
        }
        console.log("✅ fee_email_logs verified.");

        // =====================================================================
        // 8. Verify default fee structure and charges exist
        // =====================================================================
        console.log("➡️ [8/8] Verifying seed fee structure...");
        const [existingStruct] = await db.query("SELECT id FROM fee_structures WHERE id = 1");
        if (existingStruct.length === 0) {
            await db.query(`
                INSERT INTO fee_structures (id, title, structure_name, academic_year, semester, semester_number, total_amount, is_active, status, description)
                VALUES (1, 'Standard Hostel Semester Fee', 'Standard Hostel Semester Fee', '2026-2027', 'Semester 1', 1, 45000.00, 1, 'active', 'Initial standard semester hostel fee structure')
            `);

            await db.query(`
                INSERT INTO fee_structure_charges (fee_structure_id, charge_name, amount, is_active)
                VALUES
                    (1, 'Accommodation Charges', 25000.00, 1),
                    (1, 'Mess Charges', 15000.00, 1),
                    (1, 'Maintenance Charges', 2000.00, 1),
                    (1, 'Light Bill', 3000.00, 1)
            `);
            console.log("✅ Seed fee structure created.");
        } else {
            console.log("✅ Seed fee structure exists.");
        }

        console.log("🎉 Complete Safe Migration Finished Successfully!");
        process.exit(0);
    } catch (err) {
        console.error("❌ Migration failed with error:", err);
        process.exit(1);
    }
}

runMigration();

