const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");

const {
    getMyInvoices,
    createPaymentOrder,
    verifyPayment,
    getMyReceipt
} = require("../controllers/studentFeeController");

// =====================================================
// STUDENT FEES & ONLINE PAYMENT
// =====================================================

router.get("/my-invoices", authMiddleware, getMyInvoices);
router.post("/create-order/:invoiceId", authMiddleware, createPaymentOrder);
router.post("/verify-payment", authMiddleware, verifyPayment);
router.get("/receipt/:receiptNo", authMiddleware, getMyReceipt);

module.exports = router;

