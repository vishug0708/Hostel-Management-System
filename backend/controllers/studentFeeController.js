const crypto = require("crypto");
const Razorpay = require("razorpay");
const db = require("../config/database");
const {
    generateReceiptNumber,
    sendFeePaymentReceiptEmail,
    logFeeAudit
} = require("../services/feeService");

// =======================================================================
// GET STUDENT INVOICES
// =======================================================================

const getMyInvoices = async (req, res) => {
    try {
        const studentId = Number(req.user?.id);
        if (!studentId) {
            return res.status(401).json({ success: false, message: "Authentication required." });
        }

        const [invoices] = await db.query(`
            SELECT
                fi.id,
                COALESCE(fi.invoice_no, fi.invoice_number, CONCAT('INV-', fi.id)) AS invoice_no,
                fi.student_id,
                fi.fee_structure_id,
                fi.academic_year,
                CONCAT('Semester ', fi.semester_number) AS semester,
                fi.semester_number,
                fi.total_amount,
                fi.paid_amount,
                fi.balance_amount,
                fi.issue_date,
                fi.due_date,
                fi.status,
                fi.remarks,
                fi.created_at,
                COALESCE(fs.title, fs.structure_name, 'Hostel Semester Fee') AS structure_title
            FROM fee_invoices fi
            LEFT JOIN fee_structures fs ON fs.id = fi.fee_structure_id
            WHERE fi.student_id = ?
              AND fi.status != 'Cancelled'
            ORDER BY fi.id DESC
        `, [studentId]);

        for (const inv of invoices) {
            const [items] = await db.query(`
                SELECT charge_name, amount
                FROM fee_invoice_items
                WHERE invoice_id = ?
            `, [inv.id]);
            inv.items = items;

            const [payments] = await db.query(`
                SELECT id, amount, payment_method, payment_date, receipt_no, status, razorpay_payment_id
                FROM fee_payments
                WHERE invoice_id = ? AND status = 'Success'
                ORDER BY payment_date DESC
            `, [inv.id]);
            inv.payments = payments;
        }

        // Aggregate summary
        const totalPayable = invoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);
        const totalPaid = invoices.reduce((sum, inv) => sum + Number(inv.paid_amount || 0), 0);
        const totalPending = invoices.reduce((sum, inv) => sum + Number(inv.balance_amount || 0), 0);

        return res.status(200).json({
            success: true,
            invoices,
            summary: {
                totalPayable,
                totalPaid,
                totalPending
            }
        });
    } catch (err) {
        console.error("Get My Invoices Error:", err);
        return res.status(500).json({ success: false, message: "Failed to fetch invoices.", error: err.message });
    }
};

// =======================================================================
// CREATE RAZORPAY TEST ORDER
// =======================================================================

const createPaymentOrder = async (req, res) => {
    try {
        const studentId = Number(req.user?.id);
        const rawInvoiceId = req.params?.invoiceId || req.body?.invoice_id || req.body?.invoiceId;
        const invoiceId = Number(rawInvoiceId);

        if (!studentId) {
            return res.status(401).json({ success: false, message: "Authentication required." });
        }

        if (!rawInvoiceId || isNaN(invoiceId) || invoiceId <= 0) {
            return res.status(400).json({ success: false, message: "Valid invoice ID is required." });
        }

        const [invRows] = await db.query(`
            SELECT
                fi.id,
                COALESCE(fi.invoice_no, fi.invoice_number, CONCAT('INV-', fi.id)) AS invoice_no,
                fi.total_amount,
                fi.paid_amount,
                fi.balance_amount,
                fi.status,
                CONCAT('Semester ', fi.semester_number) AS semester,
                fi.semester_number,
                s.name AS student_name,
                s.email AS student_email,
                s.mobile AS student_mobile
            FROM fee_invoices fi
            JOIN students s ON s.id = fi.student_id
            WHERE fi.id = ? AND fi.student_id = ?
        `, [invoiceId, studentId]);

        if (invRows.length === 0) {
            return res.status(404).json({ success: false, message: "Invoice not found or unauthorized access." });
        }

        const invoice = invRows[0];

        if (invoice.status === "Paid" || Number(invoice.balance_amount || 0) <= 0) {
            return res.status(400).json({ success: false, message: "This invoice is already fully paid." });
        }

        if (invoice.status === "Cancelled") {
            return res.status(400).json({ success: false, message: "This invoice has been cancelled." });
        }

        const balanceAmount = Number(invoice.balance_amount);
        const amountInPaise = Math.round(balanceAmount * 100);

        const keyId = process.env.RAZORPAY_KEY_ID;
        const keySecret = process.env.RAZORPAY_KEY_SECRET;

        if (!keyId || !keySecret) {
            return res.status(500).json({
                success: false,
                message: "Razorpay test credentials are not configured on the server."
            });
        }

        const razorpay = new Razorpay({
            key_id: keyId,
            key_secret: keySecret
        });

        const order = await razorpay.orders.create({
            amount: amountInPaise,
            currency: "INR",
            receipt: `fee_${invoice.id}_${Date.now()}`,
            notes: {
                student_id: String(studentId),
                invoice_id: String(invoice.id),
                invoice_no: String(invoice.invoice_no),
                semester: String(invoice.semester)
            }
        });

        // Insert pending payment attempt
        await db.query(`
            INSERT INTO fee_payments
            (invoice_id, student_id, amount, payment_method, razorpay_order_id, status)
            VALUES (?, ?, ?, 'Razorpay Test', ?, 'Pending')
        `, [invoice.id, studentId, balanceAmount, order.id]);

        return res.status(200).json({
            success: true,
            key: keyId,
            key_id: keyId,
            order: {
                id: order.id,
                amount: order.amount,
                currency: order.currency
            },
            order_id: order.id,
            amount: order.amount,
            currency: order.currency,
            invoice_id: invoice.id,
            invoice_no: invoice.invoice_no,
            semester: invoice.semester,
            student: {
                name: invoice.student_name || "",
                email: invoice.student_email || "",
                mobile: invoice.student_mobile || ""
            }
        });
    } catch (err) {
        console.error("Create Fee Razorpay Order Error:", err);
        return res.status(500).json({
            success: false,
            message: "Unable to create payment order.",
            error: err.message
        });
    }
};

// =======================================================================
// VERIFY RAZORPAY PAYMENT
// =======================================================================

const verifyPayment = async (req, res) => {
    let connection;
    try {
        const studentId = Number(req.user?.id);
        const rawInvoiceId = req.body?.invoice_id || req.body?.invoiceId || req.params?.invoiceId;
        const invoice_id = Number(rawInvoiceId);
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        } = req.body;

        if (!studentId) {
            return res.status(401).json({ success: false, message: "Authentication required." });
        }

        if (!invoice_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ success: false, message: "Incomplete payment verification payload." });
        }

        const keySecret = process.env.RAZORPAY_KEY_SECRET;
        const keyId = process.env.RAZORPAY_KEY_ID;

        if (!keyId || !keySecret) {
            return res.status(500).json({ success: false, message: "Razorpay credentials missing." });
        }

        // Idempotency check: has this payment already been verified?
        const [existingPayment] = await db.query(
            "SELECT * FROM fee_payments WHERE razorpay_payment_id = ? AND status = 'Success'",
            [razorpay_payment_id]
        );

        if (existingPayment.length > 0) {
            return res.status(200).json({
                success: true,
                message: "Payment is already verified.",
                receipt_no: existingPayment[0].receipt_no,
                receipt: {
                    receipt_no: existingPayment[0].receipt_no,
                    amount: existingPayment[0].amount,
                    invoice_id: existingPayment[0].invoice_id
                }
            });
        }

        // Fetch invoice
        const [invRows] = await db.query(`
            SELECT
                fi.id,
                COALESCE(fi.invoice_no, fi.invoice_number, CONCAT('INV-', fi.id)) AS invoice_no,
                fi.total_amount,
                fi.paid_amount,
                fi.balance_amount,
                fi.status,
                CONCAT('Semester ', fi.semester_number) AS semester,
                fi.semester_number,
                s.name,
                s.email,
                s.mobile,
                s.college,
                s.course
            FROM fee_invoices fi
            JOIN students s ON s.id = fi.student_id
            WHERE fi.id = ? AND fi.student_id = ?
        `, [invoice_id, studentId]);

        if (invRows.length === 0) {
            return res.status(404).json({ success: false, message: "Invoice not found or unauthorized access." });
        }

        const invoice = invRows[0];
        const expectedAmountInPaise = Math.round(Number(invoice.balance_amount) * 100);

        // Fetch order from Razorpay
        const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
        const order = await razorpay.orders.fetch(razorpay_order_id);

        if (!order || order.id !== razorpay_order_id || order.currency !== "INR") {
            return res.status(400).json({ success: false, message: "Razorpay order mismatch." });
        }

        // Verify Signature
        const generatedSignature = crypto
            .createHmac("sha256", keySecret)
            .update(`${order.id}|${razorpay_payment_id}`)
            .digest("hex");

        if (generatedSignature !== razorpay_signature) {
            return res.status(400).json({ success: false, message: "Invalid Razorpay payment signature." });
        }

        // Fetch payment entity from Razorpay
        const payment = await razorpay.payments.fetch(razorpay_payment_id);
        if (!payment || payment.id !== razorpay_payment_id || payment.status !== "captured") {
            return res.status(400).json({ success: false, message: "Payment has not been captured by Razorpay." });
        }

        const paidAmount = Number(payment.amount) / 100;
        const newPaidTotal = Number(invoice.paid_amount || 0) + paidAmount;
        const newBalance = Math.max(Number(invoice.total_amount) - newPaidTotal, 0);
        const newStatus = newBalance <= 0 ? "Paid" : "Partially Paid";

        // Begin DB Transaction
        connection = await db.getConnection();
        await connection.beginTransaction();

        // 1. Update or Insert fee_payments record
        const [updatePayResult] = await connection.query(`
            UPDATE fee_payments
            SET status = 'Success', razorpay_signature = ?, payment_date = NOW(), amount = ?
            WHERE razorpay_order_id = ? AND student_id = ?
        `, [razorpay_signature, paidAmount, razorpay_order_id, studentId]);

        let paymentId;
        if (updatePayResult.affectedRows === 0) {
            const [newPay] = await connection.query(`
                INSERT INTO fee_payments
                (invoice_id, student_id, amount, payment_method, razorpay_order_id, razorpay_payment_id, razorpay_signature, status, payment_date)
                VALUES (?, ?, ?, 'Razorpay Test', ?, ?, ?, 'Success', NOW())
            `, [invoice.id, studentId, paidAmount, razorpay_order_id, razorpay_payment_id, razorpay_signature]);
            paymentId = newPay.insertId;
        } else {
            const [payRow] = await connection.query(
                "SELECT id FROM fee_payments WHERE razorpay_order_id = ? LIMIT 1",
                [razorpay_order_id]
            );
            paymentId = payRow[0]?.id;
            await connection.query(
                "UPDATE fee_payments SET razorpay_payment_id = ? WHERE id = ?",
                [razorpay_payment_id, paymentId]
            );
        }

        // 2. Generate unique receipt number
        const receiptNo = generateReceiptNumber(paymentId);
        await connection.query("UPDATE fee_payments SET receipt_no = ? WHERE id = ?", [receiptNo, paymentId]);

        // 3. Create fee_receipts entry
        await connection.query(`
            INSERT INTO fee_receipts (receipt_no, payment_id, invoice_id, student_id, amount, payment_date)
            VALUES (?, ?, ?, ?, ?, NOW())
        `, [receiptNo, paymentId, invoice.id, studentId, paidAmount]);

        // 4. Update Invoice Balance & Status
        await connection.query(`
            UPDATE fee_invoices
            SET paid_amount = ?, balance_amount = ?, status = ?
            WHERE id = ?
        `, [newPaidTotal, newBalance, newStatus, invoice.id]);

        // 5. Update legacy fees table
        await connection.query(`
            INSERT INTO fees (student_id, amount, status, payment_method, payment_date)
            VALUES (?, ?, ?, 'Razorpay', CURDATE())
        `, [studentId, paidAmount, newStatus === "Paid" ? "Paid" : "Pending"]);

        await connection.commit();

        // 6. Fetch items for email and dispatch confirmation
        const [chargeItems] = await db.query(
            "SELECT charge_name, amount FROM fee_invoice_items WHERE invoice_id = ?",
            [invoice.id]
        );

        sendFeePaymentReceiptEmail({
            student: invoice,
            invoice: { ...invoice, balance_amount: newBalance },
            payment: { amount: paidAmount, payment_method: "Razorpay Test", razorpay_payment_id, razorpay_order_id, payment_date: new Date() },
            receiptNo,
            charges: chargeItems
        }).catch((err) => console.error("Async Receipt Email Error:", err));

        await logFeeAudit({
            action: "ONLINE_FEE_PAYMENT_VERIFIED",
            entityType: "fee_payments",
            entityId: paymentId,
            performedBy: `Student #${studentId}`,
            details: { invoice_id: invoice.id, receiptNo, amount: paidAmount, razorpay_payment_id }
        });

        return res.status(200).json({
            success: true,
            message: "Payment successfully verified and receipt generated.",
            receipt_no: receiptNo,
            receipt: {
                receipt_no: receiptNo,
                amount: paidAmount,
                invoice_id: invoice.id
            },
            status: newStatus,
            paid_amount: paidAmount,
            remaining_balance: newBalance
        });
    } catch (err) {
        if (connection) await connection.rollback();
        console.error("Razorpay Fee Payment Verification Error:", err);
        return res.status(500).json({ success: false, message: "Payment verification failed.", error: err.message });
    } finally {
        if (connection) connection.release();
    }
};

// =======================================================================
// GET SINGLE RECEIPT
// =======================================================================

const getMyReceipt = async (req, res) => {
    try {
        const studentId = Number(req.user?.id);
        const { receiptNo } = req.params;

        const [receiptRows] = await db.query(`
            SELECT
                fr.receipt_no,
                fr.amount,
                fr.payment_date,
                fp.payment_method,
                fp.razorpay_payment_id,
                fp.razorpay_order_id,
                COALESCE(fi.invoice_no, fi.invoice_number, CONCAT('INV-', fi.id)) AS invoice_no,
                fi.academic_year,
                CONCAT('Semester ', fi.semester_number) AS semester,
                fi.semester_number,
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
            WHERE fr.receipt_no = ? AND fr.student_id = ?
        `, [receiptNo, studentId]);

        if (receiptRows.length === 0) {
            return res.status(404).json({ success: false, message: "Receipt not found." });
        }

        const receipt = receiptRows[0];
        const [items] = await db.query(
            "SELECT charge_name, amount FROM fee_invoice_items WHERE invoice_id = (SELECT invoice_id FROM fee_receipts WHERE receipt_no = ?)",
            [receiptNo]
        );
        receipt.items = items;

        return res.status(200).json({ success: true, receipt });
    } catch (err) {
        return res.status(500).json({ success: false, message: "Failed to fetch receipt.", error: err.message });
    }
};

module.exports = {
    getMyInvoices,
    createPaymentOrder,
    verifyPayment,
    getMyReceipt
};

