import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./StudentFeeDetails.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function StudentFeeDetails() {
    const navigate = useNavigate();
    const { id } = useParams();

    const [student, setStudent] = useState(null);
    const [invoices, setInvoices] = useState([]);
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Selected receipt for modal
    const [selectedReceipt, setSelectedReceipt] = useState(null);

    useEffect(() => {
        if (id) {
            fetchStudentFeeDetails();
        }
    }, [id]);

    const fetchStudentFeeDetails = async () => {
        const token = localStorage.getItem("adminToken");

        if (!token) {
            navigate("/admin/login", { replace: true });
            return;
        }

        try {
            setLoading(true);
            setError("");

            const response = await fetch(
                `${API_URL}/api/admin/fees/student/${id}`,
                {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                setError(data.message || "Unable to load student fee details.");
                return;
            }

            setStudent(data.student || null);
            setInvoices(Array.isArray(data.invoices) ? data.invoices : []);
            setPayments(Array.isArray(data.payments) ? data.payments : []);
        } catch (err) {
            console.error("Student Fee Details Error:", err);
            setError("Cannot connect to backend server.");
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("adminToken");
        localStorage.removeItem("admin");
        navigate("/admin/login", { replace: true });
    };

    const formatCurrency = (amount) => {
        return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
    };

    const formatDate = (date) => {
        if (!date) return "—";
        const d = new Date(date);
        return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    };

    const formatDateTime = (date) => {
        if (!date) return "—";
        const d = new Date(date);
        return Number.isNaN(d.getTime()) ? date : `${d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
    };

    const getStatusClass = (status) => {
        const s = String(status || "pending").toLowerCase();
        if (s === "paid" || s === "success") return "paid";
        if (s === "partially paid") return "partial";
        if (s === "overdue") return "overdue";
        return "pending";
    };

    const handleViewReceipt = async (receiptNo) => {
        if (!receiptNo) return;
        const token = localStorage.getItem("adminToken");
        try {
            const res = await fetch(`${API_URL}/api/admin/fees/receipt/${encodeURIComponent(receiptNo)}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setSelectedReceipt(data.receipt);
            } else {
                alert(data.message || "Receipt not found.");
            }
        } catch (e) {
            console.error("Fetch receipt error:", e);
        }
    };

    if (loading) {
        return (
            <div className="student-fee-details-loading">
                <div className="student-fee-details-spinner">⏳</div>
                <p>Loading student fee details...</p>
            </div>
        );
    }

    if (error || !student) {
        return (
            <div className="student-fee-details-error-page">
                <div className="student-fee-details-error-icon">⚠️</div>
                <h2>Unable to Load Student</h2>
                <p>{error || "Student fee details not found."}</p>
                <button onClick={() => navigate("/admin/fees")}>← Back to Fees</button>
            </div>
        );
    }

    const totalFee = Number(student.total_fee || student.hostel_fee || 0);
    const paidAmount = Number(student.paid_amount || 0);
    const pendingAmount = Number(student.pending_amount !== undefined ? student.pending_amount : Math.max(totalFee - paidAmount, 0));
    const paidPercentage = totalFee > 0 ? Math.min((paidAmount / totalFee) * 100, 100) : 0;
    const isFullyPaid = pendingAmount <= 0 && totalFee > 0;

    return (
        <div className="student-fee-details-page">

            {/* SIDEBAR */}
            <aside className="student-fee-details-sidebar">
                <div className="student-fee-details-brand">
                    <div className="student-fee-details-brand-icon">🏠</div>
                    <div>
                        <strong>Hostel</strong>
                        <span>Admin Panel</span>
                    </div>
                </div>

                <nav className="student-fee-details-nav">
                    <button onClick={() => navigate("/admin/dashboard")}>📊 Dashboard</button>
                    <button onClick={() => navigate("/admin/students")}>🎓 Students</button>
                    <button onClick={() => navigate("/admin/rooms")}>🛏️ Rooms</button>
                    <button className="active" onClick={() => navigate("/admin/fees")}>💰 Fees</button>
                    <button onClick={() => navigate("/admin/profile")}>👤 Profile</button>
                </nav>

                <button className="student-fee-details-logout" onClick={handleLogout}>
                    🚪 Logout
                </button>
            </aside>

            {/* MAIN */}
            <main className="student-fee-details-main">

                {/* HEADER */}
                <header className="student-fee-details-header">
                    <div>
                        <span>FEES MANAGEMENT</span>
                        <h1>Student Fee Ledger</h1>
                        <p>Complete semester fee invoices, itemized charges, and payment history.</p>
                    </div>

                    <div className="student-fee-details-actions">
                        <button className="student-fee-details-back-btn" onClick={() => navigate("/admin/fees")}>
                            ← Fees Dashboard
                        </button>
                    </div>
                </header>

                {/* SUBMODULE NAVIGATION TABS */}
                <div className="student-fee-subnav">
                    <button onClick={() => navigate("/admin/fees")}>Dashboard</button>
                    <button onClick={() => navigate("/admin/fees/structures")}>Fee Structures</button>
                    <button onClick={() => navigate("/admin/fees/assign")}>Assign Fees</button>
                    <button onClick={() => navigate("/admin/fees/invoices")}>Invoices</button>
                    <button onClick={() => navigate("/admin/fees/pending")}>Pending Fees</button>
                    <button onClick={() => navigate("/admin/fees/records")}>Payment Records</button>
                    <button onClick={() => navigate("/admin/fees/reports")}>Reports</button>
                </div>

                {/* STUDENT PROFILE CARD */}
                <section className="student-fee-profile-card">
                    <div className="student-fee-profile-avatar">
                        {student.photo ? (
                            <img
                                src={student.photo.startsWith("http") ? student.photo : `${API_URL}/uploads/${student.photo}`}
                                alt={student.name || "Student"}
                                onError={(e) => {
                                    e.currentTarget.style.display = "none";
                                    if (e.currentTarget.nextElementSibling) {
                                        e.currentTarget.nextElementSibling.style.display = "flex";
                                    }
                                }}
                            />
                        ) : null}
                        <div
                            className="student-fee-profile-fallback"
                            style={{ display: student.photo ? "none" : "flex" }}
                        >
                            {student.name?.charAt(0)?.toUpperCase() || "S"}
                        </div>
                    </div>

                    <div className="student-fee-profile-info">
                        <span>STUDENT PROFILE</span>
                        <h2>{student.name || "Unknown Student"}</h2>
                        <p>Student ID: #{student.id} • {student.college || "Hostel"}</p>
                    </div>

                    <div className="student-fee-profile-contact">
                        <div>
                            <small>Mobile</small>
                            <strong>{student.mobile || "—"}</strong>
                        </div>
                        <div>
                            <small>Email</small>
                            <strong>{student.email || "—"}</strong>
                        </div>
                        <div>
                            <small>Room Allocation</small>
                            <strong>{student.room_no ? `Room ${student.room_no} (${student.block || "Block"})` : "Not Allocated"}</strong>
                        </div>
                    </div>
                </section>

                {/* FEE SUMMARY CARDS */}
                <section className="student-fee-summary">
                    <div className="student-fee-summary-card total">
                        <div className="student-fee-summary-icon">💰</div>
                        <div>
                            <span>TOTAL ASSIGNED</span>
                            <strong>{formatCurrency(totalFee)}</strong>
                        </div>
                    </div>

                    <div className="student-fee-summary-card paid">
                        <div className="student-fee-summary-icon">✓</div>
                        <div>
                            <span>TOTAL PAID</span>
                            <strong>{formatCurrency(paidAmount)}</strong>
                        </div>
                    </div>

                    <div className="student-fee-summary-card pending">
                        <div className="student-fee-summary-icon">⏳</div>
                        <div>
                            <span>TOTAL PENDING</span>
                            <strong>{formatCurrency(pendingAmount)}</strong>
                        </div>
                    </div>

                    <div className="student-fee-summary-card status">
                        <div className="student-fee-summary-icon">{isFullyPaid ? "✓" : "!"}</div>
                        <div>
                            <span>STATUS</span>
                            <strong>{isFullyPaid ? "Fully Paid" : pendingAmount > 0 ? "Pending" : "No Fees"}</strong>
                        </div>
                    </div>
                </section>

                {/* PAYMENT PROGRESS */}
                <section className="student-fee-progress-card">
                    <div className="student-fee-progress-header">
                        <div>
                            <span>PAYMENT COMPLETION</span>
                            <h2>Overall Fee Progress</h2>
                        </div>
                        <strong>{paidPercentage.toFixed(1)}%</strong>
                    </div>

                    <div className="student-fee-progress-bar">
                        <div
                            className="student-fee-progress"
                            style={{ width: `${paidPercentage}%` }}
                        />
                    </div>

                    <div className="student-fee-progress-values">
                        <span>Paid: {formatCurrency(paidAmount)}</span>
                        <span>Remaining: {formatCurrency(pendingAmount)}</span>
                        <span>Total Assigned: {formatCurrency(totalFee)}</span>
                    </div>
                </section>

                {/* ASSIGNED INVOICES & ITEMIZED CHARGES */}
                <section className="student-fee-invoices-card">
                    <div className="student-fee-invoices-header">
                        <div>
                            <span>SEMESTER INVOICES</span>
                            <h2>Assigned Fee Structures & Invoices</h2>
                            <p>Itemized charges breakdown (Accommodation, Mess, Maintenance, Light Bill).</p>
                        </div>
                        <div className="student-fee-invoices-count">
                            {invoices.length} Invoices
                        </div>
                    </div>

                    {invoices.length === 0 ? (
                        <div className="student-payment-empty">
                            <div>📋</div>
                            <h3>No Semester Invoices Assigned</h3>
                            <p>No fee structure has been assigned to this student yet.</p>
                        </div>
                    ) : (
                        <div className="student-invoices-list">
                            {invoices.map((inv) => (
                                <div className="student-invoice-item-card" key={inv.id}>
                                    <div className="student-invoice-head">
                                        <div>
                                            <span className="invoice-sem-tag">{inv.semester} • {inv.academic_year}</span>
                                            <h3>{inv.fee_structure_name || "Semester Hostel Fee"}</h3>
                                            <small>Invoice: <code>{inv.invoice_no}</code> • Due: {formatDate(inv.due_date)}</small>
                                        </div>
                                        <div className="invoice-head-right">
                                            <span className={`invoice-status-pill ${getStatusClass(inv.status)}`}>
                                                {inv.status}
                                            </span>
                                            <strong className="invoice-total-badge">{formatCurrency(inv.total_amount)}</strong>
                                        </div>
                                    </div>

                                    {/* ITEMIZED CHARGES BREAKDOWN */}
                                    {inv.items && inv.items.length > 0 && (
                                        <div className="student-invoice-charges">
                                            <h4>Itemized Breakdown:</h4>
                                            <div className="charges-chips-grid">
                                                {inv.items.map((item, idx) => (
                                                    <div className="charge-chip" key={idx}>
                                                        <span>{item.charge_name}</span>
                                                        <strong>{formatCurrency(item.amount)}</strong>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="student-invoice-footer">
                                        <span>Paid: <strong>{formatCurrency(inv.paid_amount)}</strong></span>
                                        <span>Balance: <strong style={{ color: Number(inv.balance_amount) > 0 ? "#dc2626" : "#166534" }}>{formatCurrency(inv.balance_amount)}</strong></span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* PAYMENT HISTORY */}
                <section className="student-payment-history-card">
                    <div className="student-payment-history-header">
                        <div>
                            <span>TRANSACTIONS</span>
                            <h2>Payment History & Receipts</h2>
                            <p>All recorded payments for this student.</p>
                        </div>
                        <div className="student-payment-count">
                            {payments.length} Payments
                        </div>
                    </div>

                    {payments.length === 0 ? (
                        <div className="student-payment-empty">
                            <div>💳</div>
                            <h3>No Payment Records Found</h3>
                            <p>No payments have been recorded for this student yet.</p>
                        </div>
                    ) : (
                        <div className="student-payment-table-wrapper">
                            <table className="student-payment-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Receipt No</th>
                                        <th>Semester / Invoice</th>
                                        <th>Amount</th>
                                        <th>Payment Method</th>
                                        <th>Razorpay Ref</th>
                                        <th>Payment Date</th>
                                        <th>Status</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payments.map((p, index) => (
                                        <tr key={p.id || index}>
                                            <td>{index + 1}</td>
                                            <td>
                                                <span className="fee-mono-pill">{p.receipt_no || "—"}</span>
                                            </td>
                                            <td>{p.semester || "Semester"} ({p.invoice_no || "—"})</td>
                                            <td>
                                                <strong className="student-payment-amount">
                                                    {formatCurrency(p.amount)}
                                                </strong>
                                            </td>
                                            <td>{p.payment_method || "Online"}</td>
                                            <td>
                                                <small className="fee-ref-code">{p.razorpay_payment_id || p.razorpay_order_id || "—"}</small>
                                            </td>
                                            <td>{formatDateTime(p.payment_date)}</td>
                                            <td>
                                                <span className={`student-payment-status ${getStatusClass(p.status)}`}>
                                                    {p.status || "Success"}
                                                </span>
                                            </td>
                                            <td>
                                                {p.receipt_no ? (
                                                    <button
                                                        className="fee-receipt-btn"
                                                        onClick={() => handleViewReceipt(p.receipt_no)}
                                                    >
                                                        Receipt 📄
                                                    </button>
                                                ) : "—"}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                {/* RECEIPT MODAL */}
                {selectedReceipt && (
                    <div className="receipt-modal-backdrop" onClick={() => setSelectedReceipt(null)}>
                        <div className="receipt-modal-content" onClick={(e) => e.stopPropagation()}>
                            <div className="receipt-modal-header">
                                <div>
                                    <span className="receipt-badge">OFFICIAL FEE RECEIPT</span>
                                    <h2>Hostel Management System</h2>
                                    <p>Campus Hostel Fee Payment Receipt</p>
                                </div>
                                <button className="receipt-close-btn" onClick={() => setSelectedReceipt(null)}>✕</button>
                            </div>

                            <div className="receipt-modal-body">
                                <div className="receipt-info-grid">
                                    <div>
                                        <label>Receipt No:</label>
                                        <strong>{selectedReceipt.receipt_no}</strong>
                                    </div>
                                    <div>
                                        <label>Date & Time:</label>
                                        <strong>{formatDateTime(selectedReceipt.payment_date)}</strong>
                                    </div>
                                    <div>
                                        <label>Student Name:</label>
                                        <strong>{selectedReceipt.student_name}</strong>
                                    </div>
                                    <div>
                                        <label>Invoice No:</label>
                                        <strong>{selectedReceipt.invoice_no}</strong>
                                    </div>
                                    <div>
                                        <label>Semester:</label>
                                        <strong>{selectedReceipt.academic_year} • {selectedReceipt.semester}</strong>
                                    </div>
                                    <div>
                                        <label>Payment Method:</label>
                                        <strong>{selectedReceipt.payment_method}</strong>
                                    </div>
                                    <div>
                                        <label>Razorpay Payment ID:</label>
                                        <strong className="receipt-mono">{selectedReceipt.razorpay_payment_id || "N/A"}</strong>
                                    </div>
                                </div>

                                <div className="receipt-amount-box">
                                    <span>AMOUNT RECEIVED</span>
                                    <strong>{formatCurrency(selectedReceipt.amount)}</strong>
                                    <p>Status: Payment Confirmed (Test Mode)</p>
                                </div>

                                {selectedReceipt.invoice_items && selectedReceipt.invoice_items.length > 0 && (
                                    <div className="receipt-breakdown">
                                        <h4>Fee Breakdown for {selectedReceipt.semester}</h4>
                                        <table className="receipt-table">
                                            <thead>
                                                <tr>
                                                    <th>Particulars</th>
                                                    <th style={{ textAlign: "right" }}>Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedReceipt.invoice_items.map((item, i) => (
                                                    <tr key={i}>
                                                        <td>{item.charge_name}</td>
                                                        <td style={{ textAlign: "right" }}>{formatCurrency(item.amount)}</td>
                                                    </tr>
                                                ))}
                                                <tr className="receipt-table-total">
                                                    <td>Total Invoice Amount</td>
                                                    <td style={{ textAlign: "right" }}>{formatCurrency(selectedReceipt.invoice_total)}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            <div className="receipt-modal-actions">
                                <button className="receipt-print-btn" onClick={() => window.print()}>
                                    🖨️ Print Receipt
                                </button>
                                <button className="receipt-done-btn" onClick={() => setSelectedReceipt(null)}>
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* FOOTER */}
                <footer className="student-fee-details-footer">
                    <span>© 2026 Hostel Management System</span>
                    <span>Admin Panel</span>
                </footer>
            </main>
        </div>
    );
}

export default StudentFeeDetails;
