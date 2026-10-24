const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");

const {
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
} = require("../controllers/adminFeeController");

// =====================================================
// DASHBOARD & OVERVIEW
// =====================================================
router.get("/dashboard", authMiddleware, getFeesDashboard);
router.get("/payment-history", authMiddleware, getPaymentHistory);
router.get("/pending", authMiddleware, getPendingFees);
router.get("/reports", authMiddleware, getFeeReports);
router.get("/receipt/:receiptNo", authMiddleware, getReceiptDetails);

// =====================================================
// FEE STRUCTURES
// =====================================================
router.get("/structures", authMiddleware, getFeeStructures);
router.get("/structures/:id", authMiddleware, getFeeStructureById);
router.post("/structures", authMiddleware, createFeeStructure);
router.put("/structures/:id", authMiddleware, updateFeeStructure);
router.patch("/structures/:id/status", authMiddleware, toggleFeeStructureStatus);

// =====================================================
// ASSIGNMENT
// =====================================================
router.get("/eligible-students", authMiddleware, getEligibleStudents);
router.post("/assign", authMiddleware, assignFeeStructure);

// =====================================================
// INVOICES
// =====================================================
router.get("/invoices", authMiddleware, getInvoices);
router.get("/invoices/:id", authMiddleware, getInvoiceDetails);
router.put("/invoices/:id/revise", authMiddleware, reviseInvoice);
router.patch("/invoices/:id/cancel", authMiddleware, cancelInvoice);

// =====================================================
// STUDENT SPECIFIC
// =====================================================
router.get("/student/:id", authMiddleware, getStudentFeeDetails);

module.exports = router;
