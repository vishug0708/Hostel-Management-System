const db = require("../config/database");
const {
    generateInvoiceNumber,
    logFeeAudit
} = require("../services/feeService");

// =======================================================================
// A. FEES DASHBOARD
// =======================================================================

const getFeesDashboard = async (req, res) => {
    try {
        const { academic_year, semester } = req.query;

        let invoiceFilter = "WHERE 1=1";
        const invoiceParams = [];

        if (academic_year && academic_year !== "all") {
            invoiceFilter += " AND fi.academic_year = ?";
            invoiceParams.push(academic_year);
        }

        if (semester && semester !== "all") {
            invoiceFilter += " AND fi.semester = ?";
            invoiceParams.push(semester);
        }

        // 1. Total assigned fees and balances from fee_invoices (fallback to fees table if empty)
        const [invoiceStats] = await db.query(`
            SELECT
                COUNT(fi.id) AS total_invoices,
                COALESCE(SUM(CASE WHEN fi.status != 'Cancelled' THEN fi.total_amount ELSE 0 END), 0) AS total_assigned,
                COALESCE(SUM(CASE WHEN fi.status != 'Cancelled' THEN fi.paid_amount ELSE 0 END), 0) AS total_collected,
                COALESCE(SUM(CASE WHEN fi.status != 'Cancelled' THEN fi.balance_amount ELSE 0 END), 0) AS total_balance,
                COALESCE(SUM(CASE WHEN fi.status != 'Cancelled' AND fi.balance_amount > 0 AND fi.due_date < CURDATE() THEN fi.balance_amount ELSE 0 END), 0) AS overdue_fees,
                COALESCE(SUM(CASE WHEN fi.status != 'Cancelled' AND fi.balance_amount > 0 AND fi.due_date >= CURDATE() THEN fi.balance_amount ELSE 0 END), 0) AS pending_fees,
                COUNT(DISTINCT CASE WHEN fi.status = 'Paid' THEN fi.student_id END) AS paid_students_count,
                COUNT(DISTINCT CASE WHEN fi.status IN ('Unpaid', 'Partially Paid', 'Overdue') THEN fi.student_id END) AS pending_students_count
            FROM fee_invoices fi
            ${invoiceFilter}
        `, invoiceParams);

        // 2. Monthly Collection (current month)
        const [monthlyResult] = await db.query(`
            SELECT COALESCE(SUM(amount), 0) AS monthly_collected
            FROM fee_payments
            WHERE status = 'Success'
              AND MONTH(payment_date) = MONTH(CURDATE())
              AND YEAR(payment_date) = YEAR(CURDATE())
        `);

        // 3. Fallback check: if no fee_invoices exist yet, check legacy fees table
        let totalFees = Number(invoiceStats[0]?.total_assigned || 0);
        let collectedFees = Number(invoiceStats[0]?.total_collected || 0);
        let pendingFees = Number(invoiceStats[0]?.pending_fees || 0);
        let overdueFees = Number(invoiceStats[0]?.overdue_fees || 0);
        let paidStudents = Number(invoiceStats[0]?.paid_students_count || 0);
        let pendingStudents = Number(invoiceStats[0]?.pending_students_count || 0);

        const [studentCountResult] = await db.query("SELECT COUNT(*) AS count FROM students");
        const totalStudents = Number(studentCountResult[0]?.count || 0);

        if (Number(invoiceStats[0]?.total_invoices || 0) === 0) {
            // Use legacy tables calculation as fallback
            const [legacyStats] = await db.query(`
                SELECT
                    COALESCE((SELECT SUM(hostel_fee) FROM students), 0) AS legacyTotal,
                    COALESCE((SELECT SUM(amount) FROM fees WHERE LOWER(status) IN ('paid', 'success', 'completed')), 0) AS legacyCollected
            `);
            totalFees = Number(legacyStats[0]?.legacyTotal || 0);
            collectedFees = Number(legacyStats[0]?.legacyCollected || 0);
            pendingFees = Math.max(totalFees - collectedFees, 0);
        }

        // 4. Semester Summary breakdown
        const [semesterSummary] = await db.query(`
            SELECT
                academic_year,
                semester,
                COUNT(id) AS total_invoices,
                COALESCE(SUM(total_amount), 0) AS total_assigned,
                COALESCE(SUM(paid_amount), 0) AS total_collected,
                COALESCE(SUM(balance_amount), 0) AS total_pending
            FROM fee_invoices
            WHERE status != 'Cancelled'
            GROUP BY academic_year, semester
            ORDER BY academic_year DESC, semester ASC
            LIMIT 6
        `);

        // 5. Recent Payments
        let [recentPayments] = await db.query(`
            SELECT
                fp.id,
                fp.invoice_id,
                fp.student_id,
                fp.amount,
                fp.payment_method,
                fp.payment_date,
                fp.status,
                fp.receipt_no,
                fp.razorpay_payment_id,
                s.name AS student_name,
                s.email AS student_email,
                fi.invoice_no,
                fi.semester
            FROM fee_payments fp
            LEFT JOIN students s ON s.id = fp.student_id
            LEFT JOIN fee_invoices fi ON fi.id = fp.invoice_id
            WHERE fp.status = 'Success'
            ORDER BY fp.payment_date DESC, fp.id DESC
            LIMIT 10
        `);

        // Fallback to legacy fees table if no fee_payments rows yet
        if (!recentPayments || recentPayments.length === 0) {
            const [legacyPayments] = await db.query(`
                SELECT
                    f.id,
                    f.student_id,
                    f.room_id,
                    f.amount,
                    f.status,
                    f.payment_method,
                    f.payment_date,
                    s.name AS student_name,
                    s.email AS student_email
                FROM fees f
                LEFT JOIN students s ON s.id = f.student_id
                ORDER BY f.payment_date DESC, f.id DESC
                LIMIT 10
            `);
            recentPayments = legacyPayments;
        }

        return res.status(200).json({
            success: true,
            stats: {
                totalFees,
                collectedFees,
                pendingFees,
                overdueFees,
                monthlyCollection: Number(monthlyResult[0]?.monthly_collected || 0),
                totalStudents,
                paidStudents,
                pendingStudents
            },
            semesterSummary,
            recentPayments
        });
    } catch (err) {
        console.error("Fees Dashboard Error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to load fees dashboard.",
            error: err.message
        });
    }
};

// =======================================================================
// B. FEE STRUCTURE MANAGEMENT
// =======================================================================

const getFeeStructures = async (req, res) => {
    try {
        const [structures] = await db.query(`
            SELECT
                fs.*,
                COUNT(fi.id) AS assigned_invoices_count
            FROM fee_structures fs
            LEFT JOIN fee_invoices fi ON fi.fee_structure_id = fs.id AND fi.status != 'Cancelled'
            GROUP BY fs.id
            ORDER BY fs.id DESC
        `);

        for (const structure of structures) {
            const [charges] = await db.query(`
                SELECT id, charge_name, amount, is_active
                FROM fee_structure_charges
                WHERE fee_structure_id = ?
                ORDER BY id ASC
            `, [structure.id]);
            structure.charges = charges;
        }

        return res.status(200).json({
            success: true,
            structures
        });
    } catch (err) {
        console.error("Get Fee Structures Error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch fee structures.",
            error: err.message
        });
    }
};

const getFeeStructureById = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query("SELECT * FROM fee_structures WHERE id = ?", [id]);

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: "Fee structure not found." });
        }

        const structure = rows[0];
        const [charges] = await db.query(`
            SELECT id, charge_name, amount, is_active
            FROM fee_structure_charges
            WHERE fee_structure_id = ?
            ORDER BY id ASC
        `, [id]);
        structure.charges = charges;

        return res.status(200).json({ success: true, structure });
    } catch (err) {
        return res.status(500).json({ success: false, message: "Failed to fetch structure details.", error: err.message });
    }
};

const createFeeStructure = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const { title, academic_year, semester, charges, description, is_active } = req.body;

        if (!title || !academic_year || !semester) {
            return res.status(400).json({ success: false, message: "Title, academic year, and semester are required." });
        }

        if (!Array.isArray(charges) || charges.length === 0) {
            return res.status(400).json({ success: false, message: "At least one charge line item is required." });
        }

        let calculatedTotal = 0;
        for (const c of charges) {
            const amount = Number(c.amount || 0);
            if (amount < 0 || isNaN(amount)) {
                return res.status(400).json({ success: false, message: `Invalid amount for charge '${c.charge_name}'.` });
            }
            if (c.is_active !== false && c.is_active !== 0) {
                calculatedTotal += amount;
            }
        }

        await connection.beginTransaction();

        const [insertResult] = await connection.query(`
            INSERT INTO fee_structures (title, academic_year, semester, total_amount, is_active, description)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [title.trim(), academic_year.trim(), semester.trim(), calculatedTotal, is_active === false ? 0 : 1, description || null]);

        const structureId = insertResult.insertId;

        for (const c of charges) {
            await connection.query(`
                INSERT INTO fee_structure_charges (fee_structure_id, charge_name, amount, is_active)
                VALUES (?, ?, ?, ?)
            `, [structureId, c.charge_name.trim(), Number(c.amount || 0), c.is_active === false ? 0 : 1]);
        }

        await connection.commit();

        await logFeeAudit({
            action: "CREATE_FEE_STRUCTURE",
            entityType: "fee_structures",
            entityId: structureId,
            performedBy: req.user?.email || "Admin",
            details: { title, academic_year, semester, total_amount: calculatedTotal, charges_count: charges.length }
        });

        return res.status(201).json({
            success: true,
            message: "Fee structure created successfully.",
            structureId,
            total_amount: calculatedTotal
        });
    } catch (err) {
        await connection.rollback();
        console.error("Create Fee Structure Error:", err);
        return res.status(500).json({ success: false, message: "Failed to create fee structure.", error: err.message });
    } finally {
        connection.release();
    }
};

const updateFeeStructure = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const { id } = req.params;
        const { title, academic_year, semester, charges, description, is_active } = req.body;

        const [existing] = await connection.query("SELECT * FROM fee_structures WHERE id = ?", [id]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, message: "Fee structure not found." });
        }

        let calculatedTotal = 0;
        if (Array.isArray(charges)) {
            for (const c of charges) {
                const amount = Number(c.amount || 0);
                if (c.is_active !== false && c.is_active !== 0) {
                    calculatedTotal += amount;
                }
            }
        }

        await connection.beginTransaction();

        await connection.query(`
            UPDATE fee_structures
            SET title = ?, academic_year = ?, semester = ?, total_amount = ?, is_active = ?, description = ?
            WHERE id = ?
        `, [
            title ? title.trim() : existing[0].title,
            academic_year ? academic_year.trim() : existing[0].academic_year,
            semester ? semester.trim() : existing[0].semester,
            calculatedTotal > 0 ? calculatedTotal : existing[0].total_amount,
            is_active !== undefined ? (is_active ? 1 : 0) : existing[0].is_active,
            description !== undefined ? description : existing[0].description,
            id
        ]);

        if (Array.isArray(charges) && charges.length > 0) {
            await connection.query("DELETE FROM fee_structure_charges WHERE fee_structure_id = ?", [id]);
            for (const c of charges) {
                await connection.query(`
                    INSERT INTO fee_structure_charges (fee_structure_id, charge_name, amount, is_active)
                    VALUES (?, ?, ?, ?)
                `, [id, c.charge_name.trim(), Number(c.amount || 0), c.is_active === false ? 0 : 1]);
            }
        }

        await connection.commit();

        await logFeeAudit({
            action: "UPDATE_FEE_STRUCTURE",
            entityType: "fee_structures",
            entityId: id,
            performedBy: req.user?.email || "Admin",
            details: { title, total_amount: calculatedTotal }
        });

        return res.status(200).json({ success: true, message: "Fee structure updated successfully." });
    } catch (err) {
        await connection.rollback();
        console.error("Update Fee Structure Error:", err);
        return res.status(500).json({ success: false, message: "Failed to update fee structure.", error: err.message });
    } finally {
        connection.release();
    }
};

const toggleFeeStructureStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await db.query("SELECT is_active FROM fee_structures WHERE id = ?", [id]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: "Structure not found." });

        const newStatus = rows[0].is_active ? 0 : 1;
        await db.query("UPDATE fee_structures SET is_active = ? WHERE id = ?", [newStatus, id]);

        return res.status(200).json({
            success: true,
            message: `Fee structure marked as ${newStatus ? "Active" : "Inactive"}.`,
            is_active: newStatus
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: "Failed to toggle status.", error: err.message });
    }
};

// =======================================================================
// C. STUDENT FEE ASSIGNMENT
// =======================================================================

const getEligibleStudents = async (req, res) => {
    try {
        const { academic_year, semester, search } = req.query;

        let query = `
            SELECT
                s.id,
                s.name,
                s.email,
                s.mobile,
                s.college,
                s.course,
                s.hostel,
                r.room_no,
                r.block,
                ra.bed_no,
                ra.status AS allocation_status,
                (
                    SELECT fi.id
                    FROM fee_invoices fi
                    WHERE fi.student_id = s.id
                      AND fi.status != 'Cancelled'
                      ${academic_year ? "AND fi.academic_year = " + db.escape(academic_year) : ""}
                      ${semester ? "AND fi.semester = " + db.escape(semester) : ""}
                    LIMIT 1
                ) AS existing_invoice_id,
                (
                    SELECT fi.invoice_no
                    FROM fee_invoices fi
                    WHERE fi.student_id = s.id
                      AND fi.status != 'Cancelled'
                      ${academic_year ? "AND fi.academic_year = " + db.escape(academic_year) : ""}
                      ${semester ? "AND fi.semester = " + db.escape(semester) : ""}
                    LIMIT 1
                ) AS existing_invoice_no
            FROM students s
            LEFT JOIN room_allocation ra ON ra.student_id = s.id AND ra.status = 'Allocated'
            LEFT JOIN rooms r ON r.id = ra.room_id
            WHERE 1=1
        `;

        const params = [];
        if (search) {
            query += " AND (s.name LIKE ? OR s.email LIKE ? OR s.mobile LIKE ? OR s.id = ?)";
            const term = `%${search}%`;
            params.push(term, term, term, Number(search) || 0);
        }

        query += " ORDER BY s.name ASC";

        const [students] = await db.query(query, params);

        return res.status(200).json({ success: true, students });
    } catch (err) {
        console.error("Get Eligible Students Error:", err);
        return res.status(500).json({ success: false, message: "Failed to fetch eligible students.", error: err.message });
    }
};

const assignFeeStructure = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const {
            fee_structure_id,
            student_ids,
            academic_year,
            semester,
            issue_date,
            due_date,
            remarks
        } = req.body;

        if (!fee_structure_id || !Array.isArray(student_ids) || student_ids.length === 0) {
            return res.status(400).json({ success: false, message: "Fee structure and at least one student are required." });
        }

        if (!academic_year || !semester || !issue_date || !due_date) {
            return res.status(400).json({ success: false, message: "Academic year, semester, issue date, and due date are required." });
        }

        // Fetch structure and charges
        const [structRows] = await connection.query("SELECT * FROM fee_structures WHERE id = ?", [fee_structure_id]);
        if (structRows.length === 0) {
            return res.status(404).json({ success: false, message: "Selected fee structure does not exist." });
        }
        const structure = structRows[0];

        const [charges] = await connection.query(`
            SELECT charge_name, amount
            FROM fee_structure_charges
            WHERE fee_structure_id = ? AND is_active = 1
        `, [fee_structure_id]);

        if (charges.length === 0) {
            return res.status(400).json({ success: false, message: "Selected fee structure has no active charges." });
        }

        const totalAmount = charges.reduce((sum, c) => sum + Number(c.amount || 0), 0);

        // Check for duplicates
        const [duplicates] = await connection.query(`
            SELECT fi.student_id, s.name, fi.invoice_no
            FROM fee_invoices fi
            JOIN students s ON s.id = fi.student_id
            WHERE fi.student_id IN (?)
              AND fi.academic_year = ?
              AND fi.semester = ?
              AND fi.status != 'Cancelled'
        `, [student_ids, academic_year, semester]);

        if (duplicates.length > 0) {
            const names = duplicates.map(d => `${d.name} (${d.invoice_no})`).join(", ");
            return res.status(409).json({
                success: false,
                message: `The following students already have an invoice for ${semester} (${academic_year}): ${names}. Cancel or revise their existing invoice first.`
            });
        }

        await connection.beginTransaction();

        const createdInvoices = [];

        for (const studentId of student_ids) {
            // Reserve invoice row to get auto-increment ID
            const [insertRes] = await connection.query(`
                INSERT INTO fee_invoices
                (invoice_no, student_id, fee_structure_id, academic_year, semester, total_amount, paid_amount, balance_amount, issue_date, due_date, status, remarks)
                VALUES (?, ?, ?, ?, ?, ?, 0.00, ?, ?, ?, 'Unpaid', ?)
            `, [
                `TEMP-${Date.now()}-${studentId}`,
                studentId,
                fee_structure_id,
                academic_year,
                semester,
                totalAmount,
                totalAmount,
                issue_date,
                due_date,
                remarks || null
            ]);

            const invoiceId = insertRes.insertId;
            const finalInvoiceNo = generateInvoiceNumber(invoiceId);

            await connection.query("UPDATE fee_invoices SET invoice_no = ? WHERE id = ?", [finalInvoiceNo, invoiceId]);

            // Insert itemized charges
            for (const c of charges) {
                await connection.query(`
                    INSERT INTO fee_invoice_items (invoice_id, charge_name, amount)
                    VALUES (?, ?, ?)
                `, [invoiceId, c.charge_name, Number(c.amount || 0)]);
            }

            // Sync with legacy fees table for backward compatibility
            await connection.query(`
                INSERT INTO fees (student_id, amount, status, payment_date)
                VALUES (?, ?, 'Pending', ?)
            `, [studentId, totalAmount, issue_date]);

            // Also update student's hostel_fee column for legacy dashboard displays
            await connection.query(`
                UPDATE students
                SET hostel_fee = ?
                WHERE id = ?
            `, [totalAmount, studentId]);

            createdInvoices.push({ invoiceId, invoiceNo: finalInvoiceNo, studentId, totalAmount });
        }

        await connection.commit();

        await logFeeAudit({
            action: "ASSIGN_FEE_STRUCTURE",
            entityType: "fee_invoices",
            entityId: null,
            performedBy: req.user?.email || "Admin",
            details: {
                fee_structure_id,
                students_count: student_ids.length,
                academic_year,
                semester,
                totalAmount
            }
        });

        return res.status(201).json({
            success: true,
            message: `Successfully assigned fees and generated ${createdInvoices.length} invoices.`,
            count: createdInvoices.length,
            invoices: createdInvoices
        });
    } catch (err) {
        await connection.rollback();
        console.error("Assign Fee Structure Error:", err);
        return res.status(500).json({ success: false, message: "Failed to assign fees.", error: err.message });
    } finally {
        connection.release();
    }
};

// =======================================================================
// D. INVOICE MANAGEMENT
// =======================================================================

const getInvoices = async (req, res) => {
    try {
        const { academic_year, semester, status, search, page = 1, limit = 50 } = req.query;

        let whereClause = "WHERE 1=1";
        const params = [];

        if (academic_year && academic_year !== "all") {
            whereClause += " AND fi.academic_year = ?";
            params.push(academic_year);
        }

        if (semester && semester !== "all") {
            whereClause += " AND fi.semester = ?";
            params.push(semester);
        }

        if (status && status !== "all") {
            whereClause += " AND fi.status = ?";
            params.push(status);
        }

        if (search) {
            whereClause += " AND (fi.invoice_no LIKE ? OR s.name LIKE ? OR s.email LIKE ? OR s.mobile LIKE ?)";
            const term = `%${search}%`;
            params.push(term, term, term, term);
        }

        const offset = (Number(page) - 1) * Number(limit);

        const [invoices] = await db.query(`
            SELECT
                fi.*,
                s.name AS student_name,
                s.email AS student_email,
                s.mobile AS student_mobile,
                s.college,
                s.course,
                r.room_no,
                r.block
            FROM fee_invoices fi
            JOIN students s ON s.id = fi.student_id
            LEFT JOIN room_allocation ra ON ra.student_id = s.id AND ra.status = 'Allocated'
            LEFT JOIN rooms r ON r.id = ra.room_id
            ${whereClause}
            ORDER BY fi.id DESC
            LIMIT ? OFFSET ?
        `, [...params, Number(limit), Number(offset)]);

        const [countResult] = await db.query(`
            SELECT COUNT(fi.id) AS total
            FROM fee_invoices fi
            JOIN students s ON s.id = fi.student_id
            ${whereClause}
        `, params);

        return res.status(200).json({
            success: true,
            invoices,
            total: countResult[0]?.total || 0,
            page: Number(page),
            limit: Number(limit)
        });
    } catch (err) {
        console.error("Get Invoices Error:", err);
        return res.status(500).json({ success: false, message: "Failed to fetch invoices.", error: err.message });
    }
};

const getInvoiceDetails = async (req, res) => {
    try {
        const { id } = req.params;

        const [invRows] = await db.query(`
            SELECT
                fi.*,
                s.name AS student_name,
                s.email AS student_email,
                s.mobile AS student_mobile,
                s.college,
                s.course,
                s.hostel,
                r.room_no,
                r.block
            FROM fee_invoices fi
            JOIN students s ON s.id = fi.student_id
            LEFT JOIN room_allocation ra ON ra.student_id = s.id AND ra.status = 'Allocated'
            LEFT JOIN rooms r ON r.id = ra.room_id
            WHERE fi.id = ?
        `, [id]);

        if (invRows.length === 0) {
            return res.status(404).json({ success: false, message: "Invoice not found." });
        }

        const invoice = invRows[0];

        const [items] = await db.query(`
            SELECT id, charge_name, amount
            FROM fee_invoice_items
            WHERE invoice_id = ?
            ORDER BY id ASC
        `, [id]);

        const [payments] = await db.query(`
            SELECT id, amount, payment_method, payment_date, razorpay_order_id, razorpay_payment_id, receipt_no, status
            FROM fee_payments
            WHERE invoice_id = ?
            ORDER BY id DESC
        `, [id]);

        invoice.items = items;
        invoice.payments = payments;

        return res.status(200).json({ success: true, invoice });
    } catch (err) {
        console.error("Get Invoice Details Error:", err);
        return res.status(500).json({ success: false, message: "Failed to fetch invoice details.", error: err.message });
    }
};

const reviseInvoice = async (req, res) => {
    const connection = await db.getConnection();
    try {
        const { id } = req.params;
        const { items, due_date, remarks } = req.body;

        const [invRows] = await connection.query("SELECT * FROM fee_invoices WHERE id = ?", [id]);
        if (invRows.length === 0) return res.status(404).json({ success: false, message: "Invoice not found." });

        const invoice = invRows[0];
        if (invoice.status === "Paid") {
            return res.status(400).json({
                success: false,
                message: "Paid invoices cannot be revised. Historical financial integrity must be preserved."
            });
        }

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, message: "At least one charge line item is required." });
        }

        const newTotal = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const newBalance = Math.max(newTotal - Number(invoice.paid_amount || 0), 0);
        const newStatus = newBalance === 0 ? "Paid" : (Number(invoice.paid_amount) > 0 ? "Partially Paid" : "Unpaid");

        await connection.beginTransaction();

        await connection.query("DELETE FROM fee_invoice_items WHERE invoice_id = ?", [id]);

        for (const item of items) {
            await connection.query(`
                INSERT INTO fee_invoice_items (invoice_id, charge_name, amount)
                VALUES (?, ?, ?)
            `, [id, item.charge_name.trim(), Number(item.amount || 0)]);
        }

        await connection.query(`
            UPDATE fee_invoices
            SET total_amount = ?, balance_amount = ?, status = ?, due_date = COALESCE(?, due_date), remarks = COALESCE(?, remarks)
            WHERE id = ?
        `, [newTotal, newBalance, newStatus, due_date || null, remarks || null, id]);

        await connection.commit();

        await logFeeAudit({
            action: "REVISE_INVOICE",
            entityType: "fee_invoices",
            entityId: id,
            performedBy: req.user?.email || "Admin",
            details: { old_total: invoice.total_amount, new_total: newTotal, invoice_no: invoice.invoice_no }
        });

        return res.status(200).json({
            success: true,
            message: "Invoice revised successfully.",
            total_amount: newTotal,
            balance_amount: newBalance,
            status: newStatus
        });
    } catch (err) {
        await connection.rollback();
        console.error("Revise Invoice Error:", err);
        return res.status(500).json({ success: false, message: "Failed to revise invoice.", error: err.message });
    } finally {
        connection.release();
    }
};

const cancelInvoice = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const [invRows] = await db.query("SELECT * FROM fee_invoices WHERE id = ?", [id]);
        if (invRows.length === 0) return res.status(404).json({ success: false, message: "Invoice not found." });

        const invoice = invRows[0];
        if (invoice.status === "Paid" || Number(invoice.paid_amount || 0) > 0) {
            return res.status(400).json({ success: false, message: "Cannot cancel an invoice with recorded payments." });
        }

        await db.query(`
            UPDATE fee_invoices
            SET status = 'Cancelled', remarks = CONCAT(COALESCE(remarks, ''), ' [Cancelled: ', ?, ']')
            WHERE id = ?
        `, [reason || "Cancelled by admin", id]);

        await logFeeAudit({
            action: "CANCEL_INVOICE",
            entityType: "fee_invoices",
            entityId: id,
            performedBy: req.user?.email || "Admin",
            details: { invoice_no: invoice.invoice_no, reason }
        });

        return res.status(200).json({ success: true, message: "Invoice cancelled successfully." });
    } catch (err) {
        return res.status(500).json({ success: false, message: "Failed to cancel invoice.", error: err.message });
    }
};

// =======================================================================
// E. STUDENT-SPECIFIC FEE DETAILS (Fixes 404 for StudentFeeDetails.jsx)
// =======================================================================

const getStudentFeeDetails = async (req, res) => {
    try {
        const { id } = req.params;

        const [students] = await db.query(`
            SELECT
                s.id,
                s.name,
                s.email,
                s.mobile,
                s.college,
                s.course,
                s.hostel,
                s.hostel_fee,
                r.room_no,
                r.block,
                ra.bed_no
            FROM students s
            LEFT JOIN room_allocation ra ON ra.student_id = s.id AND ra.status = 'Allocated'
            LEFT JOIN rooms r ON r.id = ra.room_id
            WHERE s.id = ?
        `, [id]);

        if (students.length === 0) {
            return res.status(404).json({ success: false, message: "Student not found." });
        }

        const student = students[0];

        // Fetch invoices
        const [invoices] = await db.query(`
            SELECT *
            FROM fee_invoices
            WHERE student_id = ?
            ORDER BY id DESC
        `, [id]);

        for (const inv of invoices) {
            const [items] = await db.query(`
                SELECT charge_name, amount
                FROM fee_invoice_items
                WHERE invoice_id = ?
            `, [inv.id]);
            inv.items = items;
        }

        // Fetch payments
        const [payments] = await db.query(`
            SELECT
                fp.*,
                fi.invoice_no,
                fi.semester
            FROM fee_payments fp
            LEFT JOIN fee_invoices fi ON fi.id = fp.invoice_id
            WHERE fp.student_id = ?
            ORDER BY fp.payment_date DESC, fp.id DESC
        `, [id]);

        // Calculate aggregate sums
        let totalFee = 0;
        let paidAmount = 0;
        let pendingAmount = 0;

        if (invoices.length > 0) {
            for (const inv of invoices) {
                if (inv.status !== "Cancelled") {
                    totalFee += Number(inv.total_amount || 0);
                    paidAmount += Number(inv.paid_amount || 0);
                    pendingAmount += Number(inv.balance_amount || 0);
                }
            }
        } else {
            // Fallback to legacy
            totalFee = Number(student.hostel_fee || 0);
            paidAmount = payments.reduce((sum, p) => p.status === "Success" ? sum + Number(p.amount) : sum, 0);
            pendingAmount = Math.max(totalFee - paidAmount, 0);
        }

        student.paid_amount = paidAmount;
        student.pending_amount = pendingAmount;
        student.total_fee = totalFee;

        return res.status(200).json({
            success: true,
            student,
            invoices,
            payments
        });
    } catch (err) {
        console.error("Get Student Fee Details Error:", err);
        return res.status(500).json({ success: false, message: "Failed to load student fee details.", error: err.message });
    }
};

// =======================================================================
// F. PAYMENT HISTORY
// =======================================================================

const getPaymentHistory = async (req, res) => {
    try {
        const { search, status } = req.query;

        let query = `
            SELECT
                fp.id,
                fp.invoice_id,
                fp.student_id,
                fp.amount,
                fp.payment_method,
                fp.payment_date,
                fp.razorpay_order_id,
                fp.razorpay_payment_id,
                fp.receipt_no,
                fp.status,
                fp.failure_reason,
                s.name AS student_name,
                s.email AS student_email,
                s.mobile AS student_mobile,
                fi.invoice_no,
                fi.semester,
                fi.academic_year
            FROM fee_payments fp
            JOIN students s ON s.id = fp.student_id
            LEFT JOIN fee_invoices fi ON fi.id = fp.invoice_id
            WHERE 1=1
        `;

        const params = [];

        if (status && status !== "all") {
            query += " AND fp.status = ?";
            params.push(status);
        }

        if (search) {
            query += " AND (s.name LIKE ? OR s.email LIKE ? OR fp.receipt_no LIKE ? OR fp.razorpay_payment_id LIKE ? OR fi.invoice_no LIKE ?)";
            const term = `%${search}%`;
            params.push(term, term, term, term, term);
        }

        query += " ORDER BY fp.payment_date DESC, fp.id DESC LIMIT 100";

        let [payments] = await db.query(query, params);

        // Fallback to legacy payments if fee_payments is empty
        if (payments.length === 0) {
            const [legacy] = await db.query(`
                SELECT
                    f.id,
                    f.student_id,
                    f.room_id,
                    f.amount,
                    f.status,
                    f.payment_method,
                    f.payment_date,
                    s.name AS student_name,
                    s.email AS student_email,
                    s.mobile AS student_mobile
                FROM fees f
                LEFT JOIN students s ON s.id = f.student_id
                ORDER BY f.payment_date DESC, f.id DESC
            `);
            payments = legacy;
        }

        return res.status(200).json({ success: true, payments });
    } catch (err) {
        console.error("Get Payment History Error:", err);
        return res.status(500).json({ success: false, message: "Failed to load payment history.", error: err.message });
    }
};

// =======================================================================
// G. PENDING FEES
// =======================================================================

const getPendingFees = async (req, res) => {
    try {
        const { search, academic_year, semester } = req.query;

        let whereClause = "WHERE fi.status IN ('Unpaid', 'Partially Paid', 'Overdue') AND fi.balance_amount > 0";
        const params = [];

        if (academic_year && academic_year !== "all") {
            whereClause += " AND fi.academic_year = ?";
            params.push(academic_year);
        }

        if (semester && semester !== "all") {
            whereClause += " AND fi.semester = ?";
            params.push(semester);
        }

        if (search) {
            whereClause += " AND (s.name LIKE ? OR s.email LIKE ? OR s.mobile LIKE ? OR fi.invoice_no LIKE ?)";
            const term = `%${search}%`;
            params.push(term, term, term, term);
        }

        let [pendingInvoices] = await db.query(`
            SELECT
                fi.id AS invoice_id,
                fi.invoice_no,
                fi.academic_year,
                fi.semester,
                fi.total_amount,
                fi.paid_amount,
                fi.balance_amount AS pending_amount,
                fi.due_date,
                fi.status,
                s.id AS student_id,
                s.name,
                s.email,
                s.mobile,
                s.college,
                s.course,
                r.room_no,
                r.block
            FROM fee_invoices fi
            JOIN students s ON s.id = fi.student_id
            LEFT JOIN room_allocation ra ON ra.student_id = s.id AND ra.status = 'Allocated'
            LEFT JOIN rooms r ON r.id = ra.room_id
            ${whereClause}
            ORDER BY fi.balance_amount DESC, fi.due_date ASC
        `, params);

        // Fallback to legacy if no fee_invoices
        if (pendingInvoices.length === 0) {
            const [legacy] = await db.query(`
                SELECT
                    s.id AS student_id,
                    s.name,
                    s.email,
                    s.mobile,
                    s.hostel_fee,
                    COALESCE((SELECT SUM(f.amount) FROM fees f WHERE f.student_id = s.id AND LOWER(f.status) IN ('paid', 'success', 'completed')), 0) AS paid_amount
                FROM students s
                WHERE s.hostel_fee > 0
                HAVING paid_amount < s.hostel_fee
                ORDER BY (s.hostel_fee - paid_amount) DESC
            `);
            pendingInvoices = legacy.map(s => ({
                ...s,
                pending_amount: Math.max(Number(s.hostel_fee || 0) - Number(s.paid_amount || 0), 0)
            }));
        }

        return res.status(200).json({ success: true, students: pendingInvoices });
    } catch (err) {
        console.error("Get Pending Fees Error:", err);
        return res.status(500).json({ success: false, message: "Failed to load pending fees.", error: err.message });
    }
};

// =======================================================================
// H. FEE REPORTS & ANALYTICS
// =======================================================================

const getFeeReports = async (req, res) => {
    try {
        const { academic_year, semester, from_date, to_date } = req.query;

        let dateFilter = "";
        const dateParams = [];

        if (from_date && to_date) {
            dateFilter = "AND fp.payment_date BETWEEN ? AND ?";
            dateParams.push(from_date + " 00:00:00", to_date + " 23:59:59");
        }

        // 1. Overall stats
        const [overall] = await db.query(`
            SELECT
                COALESCE(SUM(total_amount), 0) AS total_assigned,
                COALESCE(SUM(paid_amount), 0) AS total_collected,
                COALESCE(SUM(balance_amount), 0) AS total_outstanding,
                COALESCE(SUM(CASE WHEN due_date < CURDATE() AND balance_amount > 0 THEN balance_amount ELSE 0 END), 0) AS total_overdue,
                COUNT(id) AS total_invoices,
                COUNT(CASE WHEN status = 'Paid' THEN 1 END) AS paid_invoices,
                COUNT(CASE WHEN status = 'Partially Paid' THEN 1 END) AS partially_paid_invoices,
                COUNT(CASE WHEN status = 'Unpaid' THEN 1 END) AS unpaid_invoices,
                COUNT(CASE WHEN status = 'Overdue' OR (due_date < CURDATE() AND status != 'Paid') THEN 1 END) AS overdue_invoices
            FROM fee_invoices
            WHERE status != 'Cancelled'
        `);

        // 2. Semester Wise collection
        const [semesterBreakdown] = await db.query(`
            SELECT
                academic_year,
                semester,
                COUNT(id) AS total_invoices,
                COALESCE(SUM(total_amount), 0) AS assigned,
                COALESCE(SUM(paid_amount), 0) AS collected,
                COALESCE(SUM(balance_amount), 0) AS outstanding
            FROM fee_invoices
            WHERE status != 'Cancelled'
            GROUP BY academic_year, semester
            ORDER BY academic_year DESC, semester ASC
        `);

        // 3. Date-wise payments
        const [paymentsList] = await db.query(`
            SELECT
                fp.id,
                fp.receipt_no,
                fp.payment_date,
                fp.amount,
                fp.payment_method,
                fp.razorpay_payment_id,
                s.name AS student_name,
                s.id AS student_id,
                fi.invoice_no,
                fi.semester,
                fi.academic_year
            FROM fee_payments fp
            JOIN students s ON s.id = fp.student_id
            LEFT JOIN fee_invoices fi ON fi.id = fp.invoice_id
            WHERE fp.status = 'Success'
            ${dateFilter}
            ORDER BY fp.payment_date DESC
            LIMIT 500
        `, dateParams);

        return res.status(200).json({
            success: true,
            report: {
                overall: overall[0] || {},
                semesterBreakdown,
                paymentsList
            }
        });
    } catch (err) {
        console.error("Get Fee Reports Error:", err);
        return res.status(500).json({ success: false, message: "Failed to load fee reports.", error: err.message });
    }
};

// =======================================================================
// I. RECEIPT DETAILS
// =======================================================================

const getReceiptDetails = async (req, res) => {
    try {
        const { receiptNo } = req.params;

        const [receiptRows] = await db.query(`
            SELECT
                fr.receipt_no,
                fr.amount,
                fr.payment_date,
                fp.payment_method,
                fp.razorpay_payment_id,
                fp.razorpay_order_id,
                fi.invoice_no,
                fi.academic_year,
                fi.semester,
                fi.total_amount AS invoice_total,
                fi.paid_amount AS invoice_paid,
                fi.balance_amount AS invoice_balance,
                s.id AS student_id,
                s.name AS student_name,
                s.email AS student_email,
                s.mobile AS student_mobile,
                s.college,
                s.course,
                s.hostel,
                r.room_no,
                r.block
            FROM fee_receipts fr
            JOIN fee_payments fp ON fp.id = fr.payment_id
            JOIN fee_invoices fi ON fi.id = fr.invoice_id
            JOIN students s ON s.id = fr.student_id
            LEFT JOIN room_allocation ra ON ra.student_id = s.id AND ra.status = 'Allocated'
            LEFT JOIN rooms r ON r.id = ra.room_id
            WHERE fr.receipt_no = ?
        `, [receiptNo]);

        if (receiptRows.length === 0) {
            return res.status(404).json({ success: false, message: "Receipt not found." });
        }

        const receipt = receiptRows[0];

        const [items] = await db.query(`
            SELECT charge_name, amount
            FROM fee_invoice_items
            WHERE invoice_id = (SELECT invoice_id FROM fee_receipts WHERE receipt_no = ?)
        `, [receiptNo]);

        receipt.items = items;

        return res.status(200).json({ success: true, receipt });
    } catch (err) {
        return res.status(500).json({ success: false, message: "Failed to fetch receipt.", error: err.message });
    }
};

module.exports = {
    getFeesDashboard,
    getFeeStructures,
    getFeeStructureById,
    createFeeStructure,
    updateFeeStructure,
    toggleFeeStructureStatus,
    getEligibleStudents,
    assignFeeStructure,
    getInvoices,
    getInvoiceDetails,
    reviseInvoice,
    cancelInvoice,
    getStudentFeeDetails,
    getPaymentHistory,
    getPendingFees,
    getFeeReports,
    getReceiptDetails
};
