const db = require("../config/database");
const { sendEmail } = require("./emailService");

// =======================================================================
// INITIALIZE FEE TABLES (SAFE & NON-DESTRUCTIVE)
// =======================================================================

async function initFeeTables() {
    try {
        // 1. Fee Structures
        await db.query(`
            CREATE TABLE IF NOT EXISTS fee_structures (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(150) NOT NULL,
                structure_name VARCHAR(150) NULL,
                academic_year VARCHAR(20) NOT NULL,
                semester VARCHAR(50) NOT NULL,
                semester_number TINYINT UNSIGNED NULL DEFAULT 1,
                total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                status ENUM('draft','active','inactive') NOT NULL DEFAULT 'active',
                description TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_fee_structures_year_sem (academic_year, semester),
                INDEX idx_fee_structures_active (is_active)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
        `);

        // Harmonize fee_structures columns if pre-existing
        try {
            const [structCols] = await db.query("SHOW COLUMNS FROM fee_structures");
            const names = structCols.map(c => c.Field);
            if (!names.includes("title")) await db.query("ALTER TABLE fee_structures ADD COLUMN title VARCHAR(150) NULL AFTER id");
            if (!names.includes("semester")) await db.query("ALTER TABLE fee_structures ADD COLUMN semester VARCHAR(50) NULL AFTER academic_year");
            if (!names.includes("is_active")) await db.query("ALTER TABLE fee_structures ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER total_amount");
            if (!names.includes("description")) await db.query("ALTER TABLE fee_structures ADD COLUMN description TEXT NULL AFTER is_active");
            if (names.includes("structure_name")) await db.query("ALTER TABLE fee_structures MODIFY COLUMN structure_name VARCHAR(150) NULL");
            if (names.includes("semester_number")) await db.query("ALTER TABLE fee_structures MODIFY COLUMN semester_number TINYINT UNSIGNED NULL DEFAULT 1");
            await db.query(`
                UPDATE fee_structures
                SET title = COALESCE(title, structure_name, 'Standard Hostel Semester Fee'),
                    semester = COALESCE(semester, CONCAT('Semester ', COALESCE(semester_number, 1)), 'Semester 1')
                WHERE title IS NULL OR semester IS NULL
            `);
        } catch (e) {
            console.warn("fee_structures harmonize notice:", e.message);
        }

        // 2. Fee Structure Charges
        await db.query(`
            CREATE TABLE IF NOT EXISTS fee_structure_charges (
                id INT AUTO_INCREMENT PRIMARY KEY,
                fee_structure_id INT NOT NULL,
                charge_name VARCHAR(150) NOT NULL,
                amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_structure_charges (fee_structure_id, is_active)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
        `);

        // 3. Fee Invoices
        await db.query(`
            CREATE TABLE IF NOT EXISTS fee_invoices (
                id INT AUTO_INCREMENT PRIMARY KEY,
                invoice_no VARCHAR(50) NOT NULL UNIQUE,
                invoice_number VARCHAR(60) NULL,
                student_id INT NOT NULL,
                fee_structure_id INT UNSIGNED NULL,
                academic_year VARCHAR(20) NOT NULL,
                semester VARCHAR(50) NOT NULL,
                semester_number TINYINT UNSIGNED NULL DEFAULT 1,
                total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                balance_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                issue_date DATE NOT NULL,
                due_date DATE NOT NULL,
                status ENUM('Unpaid', 'Pending', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled') NOT NULL DEFAULT 'Unpaid',
                remarks TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_invoices_student (student_id),
                INDEX idx_invoices_status (status),
                INDEX idx_invoices_year_sem (academic_year, semester),
                INDEX idx_invoices_due_date (due_date)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
        `);

        // Harmonize fee_invoices columns if pre-existing
        try {
            const [invCols] = await db.query("SHOW COLUMNS FROM fee_invoices");
            const names = invCols.map(c => c.Field);
            if (!names.includes("invoice_no")) await db.query("ALTER TABLE fee_invoices ADD COLUMN invoice_no VARCHAR(60) NULL AFTER id");
            if (!names.includes("semester")) await db.query("ALTER TABLE fee_invoices ADD COLUMN semester VARCHAR(50) NULL AFTER academic_year");
            if (!names.includes("remarks")) await db.query("ALTER TABLE fee_invoices ADD COLUMN remarks TEXT NULL AFTER status");
            if (names.includes("invoice_number")) await db.query("ALTER TABLE fee_invoices MODIFY COLUMN invoice_number VARCHAR(60) NULL");
            if (names.includes("fee_structure_id")) await db.query("ALTER TABLE fee_invoices MODIFY COLUMN fee_structure_id INT UNSIGNED NULL");
            if (names.includes("semester_number")) await db.query("ALTER TABLE fee_invoices MODIFY COLUMN semester_number TINYINT UNSIGNED NULL DEFAULT 1");
            await db.query(`
                UPDATE fee_invoices
                SET invoice_no = COALESCE(invoice_no, invoice_number),
                    semester = COALESCE(semester, CONCAT('Semester ', COALESCE(semester_number, 1)))
                WHERE invoice_no IS NULL OR semester IS NULL
            `);
        } catch (e) {
            console.warn("fee_invoices harmonize notice:", e.message);
        }

        // 4. Fee Invoice Items
        await db.query(`
            CREATE TABLE IF NOT EXISTS fee_invoice_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                invoice_id INT NOT NULL,
                charge_name VARCHAR(150) NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_invoice_items (invoice_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
        `);

        // 5. Fee Payments
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

        // 6. Fee Receipts
        await db.query(`
            CREATE TABLE IF NOT EXISTS fee_receipts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                receipt_no VARCHAR(60) NULL,
                receipt_number VARCHAR(60) NULL,
                payment_id INT NOT NULL,
                invoice_id INT NOT NULL,
                student_id INT NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                payment_date DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
                issued_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
                pdf_path VARCHAR(500) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_receipts_invoice (invoice_id),
                INDEX idx_receipts_student (student_id),
                INDEX idx_receipts_payment (payment_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
        `);

        // Harmonize fee_receipts columns
        try {
            const [receiptCols] = await db.query("SHOW COLUMNS FROM fee_receipts");
            const names = receiptCols.map(c => c.Field);
            if (!names.includes("receipt_no")) await db.query("ALTER TABLE fee_receipts ADD COLUMN receipt_no VARCHAR(60) NULL AFTER id");
            if (!names.includes("payment_date")) await db.query("ALTER TABLE fee_receipts ADD COLUMN payment_date DATETIME NULL DEFAULT CURRENT_TIMESTAMP AFTER amount");
            if (names.includes("receipt_number")) await db.query("ALTER TABLE fee_receipts MODIFY COLUMN receipt_number VARCHAR(60) NULL");
            if (names.includes("issued_at")) await db.query("ALTER TABLE fee_receipts MODIFY COLUMN issued_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP");
        } catch (e) {
            console.warn("fee_receipts harmonize notice:", e.message);
        }

        // 7. Fee Audit Logs
        await db.query(`
            CREATE TABLE IF NOT EXISTS fee_audit_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                action VARCHAR(100) NOT NULL,
                entity_type VARCHAR(50) NOT NULL,
                entity_id INT NULL,
                performed_by VARCHAR(100) NOT NULL,
                details JSON NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_audit_entity (entity_type, entity_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
        `);

        // Harmonize fee_audit_logs columns
        try {
            const [auditCols] = await db.query("SHOW COLUMNS FROM fee_audit_logs");
            const names = auditCols.map(c => c.Field);
            if (!names.includes("performed_by")) await db.query("ALTER TABLE fee_audit_logs ADD COLUMN performed_by VARCHAR(100) NULL AFTER entity_id");
            if (!names.includes("details")) await db.query("ALTER TABLE fee_audit_logs ADD COLUMN details JSON NULL AFTER performed_by");
            if (names.includes("admin_id")) await db.query("ALTER TABLE fee_audit_logs MODIFY COLUMN admin_id INT NULL");
            if (names.includes("entity_id")) await db.query("ALTER TABLE fee_audit_logs MODIFY COLUMN entity_id BIGINT UNSIGNED NULL");
        } catch (e) {
            console.warn("fee_audit_logs harmonize notice:", e.message);
        }

        // 8. Fee Email Logs
        await db.query(`
            CREATE TABLE IF NOT EXISTS fee_email_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                receipt_no VARCHAR(60) NULL,
                student_id INT NOT NULL,
                recipient_email VARCHAR(150) NOT NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'sent',
                error_message TEXT NULL,
                sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_email_logs_receipt (receipt_no),
                INDEX idx_email_logs_student (student_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
        `);

        // Harmonize fee_email_logs columns
        try {
            const [emailCols] = await db.query("SHOW COLUMNS FROM fee_email_logs");
            const names = emailCols.map(c => c.Field);
            if (!names.includes("receipt_no")) await db.query("ALTER TABLE fee_email_logs ADD COLUMN receipt_no VARCHAR(60) NULL AFTER id");
            if (!names.includes("error_message")) await db.query("ALTER TABLE fee_email_logs ADD COLUMN error_message TEXT NULL");
            if (names.includes("email_type")) await db.query("ALTER TABLE fee_email_logs MODIFY COLUMN email_type VARCHAR(60) NULL DEFAULT 'receipt'");
            if (names.includes("status")) await db.query("ALTER TABLE fee_email_logs MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'sent'");
        } catch (e) {
            console.warn("fee_email_logs harmonize notice:", e.message);
        }

        // 9. Legacy fees table (ensures zero crash on fallback queries)
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

        // 10. Check if standard initial fee structure exists
        const [existing] = await db.query("SELECT id FROM fee_structures WHERE id = 1");
        if (existing.length === 0) {
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
            console.log("✅ Standard Semester Fee Structure (₹45,000) seeded successfully.");
        }

        console.log("✅ Fees Module database tables verified & ready.");
    } catch (err) {
        console.warn("⚠️ Fee table initialization warning (will retry on query):", err.message);
    }
}

// Auto-run on load
initFeeTables();

// =======================================================================
// IDENTIFIER GENERATORS
// =======================================================================

function generateInvoiceNumber(id) {
    const year = new Date().getFullYear();
    const padded = String(id || Math.floor(1000 + Math.random() * 9000)).padStart(5, "0");
    return `INV-${year}-${padded}`;
}

function generateReceiptNumber(id) {
    const year = new Date().getFullYear();
    const padded = String(id || Math.floor(1000 + Math.random() * 9000)).padStart(5, "0");
    return `RCP-${year}-${padded}`;
}

// =======================================================================
// AUDIT LOGGER
// =======================================================================

async function logFeeAudit({
    action,
    entityType,
    entityId,
    performedBy = "Admin",
    details = {}
}) {
    try {
        await db.query(
            `INSERT INTO fee_audit_logs (action, entity_type, entity_id, performed_by, details)
             VALUES (?, ?, ?, ?, ?)`,
            [action, entityType, entityId, performedBy, JSON.stringify(details)]
        );
    } catch (err) {
        console.error("Fee Audit Log Error:", err.message);
    }
}

// =======================================================================
// RECEIPT HTML EMAIL BUILDER & SENDER
// =======================================================================

async function sendFeePaymentReceiptEmail({
    student,
    invoice,
    payment,
    receiptNo,
    charges = []
}) {
    if (!student?.email) return { success: false, message: "No student email provided" };

    const formattedAmount = Number(payment.amount).toLocaleString("en-IN", {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2
    });

    const paymentDateFormatted = new Date(payment.payment_date || Date.now()).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });

    const chargeRowsHtml = charges
        .map(
            (c) => `
            <tr>
                <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #334155;">
                    ${c.charge_name}
                </td>
                <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #0f172a; text-align: right; font-weight: 600;">
                    ₹${Number(c.amount).toLocaleString("en-IN")}
                </td>
            </tr>`
        )
        .join("");

    const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Fee Payment Receipt</title>
    </head>
    <body style="font-family: Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 620px; margin: 0 auto; background-color: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 4px 18px rgba(15,23,42,0.08); border: 1px solid #e2e8f0;">
            <!-- Header -->
            <tr>
                <td style="background-color: #0f172a; padding: 28px 30px; text-align: center; color: #ffffff;">
                    <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 0.5px;">VIRTUOUS HOSTEL</h1>
                    <p style="margin: 6px 0 0; font-size: 13px; color: #94a3b8;">Hostel Fees Payment Receipt</p>
                </td>
            </tr>

            <!-- Status Banner -->
            <tr>
                <td style="background-color: #f0fdf4; padding: 14px 30px; border-bottom: 1px solid #bbf7d0; text-align: center;">
                    <span style="display: inline-block; background-color: #16a34a; color: #ffffff; font-size: 12px; font-weight: 700; padding: 4px 14px; border-radius: 20px; text-transform: uppercase;">Payment Verified • Paid</span>
                </td>
            </tr>

            <!-- Key Meta Details -->
            <tr>
                <td style="padding: 24px 30px;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
                        <tr>
                            <td width="50%" style="font-size: 13px; color: #64748b; line-height: 1.6;">
                                <strong style="color: #0f172a; font-size: 15px;">${student.name || "Student"}</strong><br>
                                Student ID: #${student.id}<br>
                                Mobile: ${student.mobile || "—"}<br>
                                College: ${student.college || "—"} (${student.course || "—"})
                            </td>
                            <td width="50%" style="font-size: 13px; color: #64748b; line-height: 1.6; text-align: right;">
                                <strong>Receipt No:</strong> <span style="color: #0f766e; font-weight: 700;">${receiptNo}</span><br>
                                <strong>Invoice No:</strong> ${invoice.invoice_no}<br>
                                <strong>Semester:</strong> ${invoice.semester} (${invoice.academic_year})<br>
                                <strong>Date:</strong> ${paymentDateFormatted}
                            </td>
                        </tr>
                    </table>

                    <!-- Breakdown Table -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                        <thead>
                            <tr style="background-color: #f1f5f9;">
                                <th style="padding: 10px 14px; text-align: left; font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; border-bottom: 1px solid #cbd5e1;">Particulars</th>
                                <th style="padding: 10px 14px; text-align: right; font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; border-bottom: 1px solid #cbd5e1;">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${chargeRowsHtml.length > 0 ? chargeRowsHtml : `
                            <tr>
                                <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #334155;">Hostel Semester Fee</td>
                                <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #0f172a; text-align: right; font-weight: 600;">₹${formattedAmount}</td>
                            </tr>
                            `}
                            <tr style="background-color: #f8fafc;">
                                <td style="padding: 14px; font-size: 15px; font-weight: 800; color: #0f172a;">Total Amount Paid</td>
                                <td style="padding: 14px; font-size: 18px; font-weight: 800; color: #0f766e; text-align: right;">₹${formattedAmount}</td>
                            </tr>
                        </tbody>
                    </table>

                    <!-- Payment Details Card -->
                    <table width="100%" cellpadding="12" cellspacing="0" style="background-color: #f8fafc; border-radius: 8px; border: 1px dashed #cbd5e1; font-size: 12px; color: #475569; line-height: 1.7;">
                        <tr>
                            <td>
                                <strong>Payment Method:</strong> ${payment.payment_method || "Razorpay Test"}<br>
                                <strong>Razorpay Payment ID:</strong> ${payment.razorpay_payment_id || "N/A"}<br>
                                <strong>Razorpay Order ID:</strong> ${payment.razorpay_order_id || "N/A"}<br>
                                <strong>Remaining Balance:</strong> ₹${Number(invoice.balance_amount || 0).toLocaleString("en-IN")}
                            </td>
                        </tr>
                    </table>

                    <p style="margin: 24px 0 0; font-size: 12px; color: #94a3b8; text-align: center;">
                        This is an electronically generated receipt for your records. For questions, contact the Hostel Administration.
                    </p>
                </td>
            </tr>

            <!-- Footer -->
            <tr>
                <td style="background-color: #f1f5f9; padding: 16px 30px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0;">
                    © ${new Date().getFullYear()} Virtuous Hostel Management System. All rights reserved.
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;

    try {
        const sendResult = await sendEmail({
            to: student.email,
            subject: `Receipt: Fee Payment Confirmed - ${invoice.semester} (${receiptNo})`,
            html: emailHtml,
            text: `Dear ${student.name}, your payment of ₹${formattedAmount} for ${invoice.semester} has been received. Receipt No: ${receiptNo}.`
        });

        await db.query(
            `INSERT INTO fee_email_logs (receipt_no, student_id, recipient_email, status, error_message)
             VALUES (?, ?, ?, ?, ?)`,
            [receiptNo, student.id, student.email, sendResult.success ? "Sent" : "Failed", sendResult.message || null]
        );

        return sendResult;
    } catch (err) {
        console.error("Send Fee Receipt Email Error:", err.message);
        await db.query(
            `INSERT INTO fee_email_logs (receipt_no, student_id, recipient_email, status, error_message)
             VALUES (?, ?, ?, 'Failed', ?)`,
            [receiptNo, student.id, student.email, err.message]
        );
        return { success: false, error: err.message };
    }
}

module.exports = {
    initFeeTables,
    generateInvoiceNumber,
    generateReceiptNumber,
    logFeeAudit,
    sendFeePaymentReceiptEmail
};
