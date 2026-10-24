import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./MyFees.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function MyFees() {
    const navigate = useNavigate();
    const sidebarRef = useRef(null);
    const mobileMenuButtonRef = useRef(null);

    const [student, setStudent] = useState(null);
    const [invoices, setInvoices] = useState([]);
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [menuOpen, setMenuOpen] = useState(false);

    // Active tab in page: "invoices" or "history"
    const [activeTab, setActiveTab] = useState("invoices");

    // Processing payment state
    const [processingInvoiceId, setProcessingInvoiceId] = useState(null);

    // Receipt Modal state
    const [selectedReceipt, setSelectedReceipt] = useState(null);
    const [receiptLoading, setReceiptLoading] = useState(false);

    // Success notification
    const [successMessage, setSuccessMessage] = useState("");

    useEffect(() => {
        const studentRaw = localStorage.getItem("student");
        const token = localStorage.getItem("studentToken");

        if (!token) {
            navigate("/student/login", { replace: true });
            return;
        }

        if (studentRaw) {
            try {
                setStudent(JSON.parse(studentRaw));
            } catch (e) {
                console.error("Error parsing student session:", e);
            }
        }

        fetchMyFees();
    }, []);

    // Close mobile menu on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                menuOpen &&
                sidebarRef.current &&
                !sidebarRef.current.contains(event.target) &&
                mobileMenuButtonRef.current &&
                !mobileMenuButtonRef.current.contains(event.target)
            ) {
                setMenuOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [menuOpen]);

    const fetchMyFees = async () => {
        const token = localStorage.getItem("studentToken");
        if (!token) {
            navigate("/student/login", { replace: true });
            return;
        }

        try {
            setLoading(true);
            setError("");

            const response = await fetch(`${API_URL}/api/student/fees/my-invoices`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                setError(data.message || "Unable to load student fees.");
                return;
            }

            if (data.student) {
                setStudent(prev => ({ ...prev, ...data.student }));
            }
            setInvoices(Array.isArray(data.invoices) ? data.invoices : []);
            setPayments(Array.isArray(data.payments) ? data.payments : []);
        } catch (err) {
            console.error("Fetch Student Fees Error:", err);
            setError("Cannot connect to server to fetch fees.");
        } finally {
            setLoading(false);
        }
    };

    const handleNavigation = (path) => {
        setMenuOpen(false);
        navigate(path);
    };

    const handleLogout = () => {
        setMenuOpen(false);
        localStorage.removeItem("studentToken");
        localStorage.removeItem("student");
        navigate("/student/login", { replace: true });
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

    const getStudentPhoto = () => {
        if (!student?.photo) return null;
        const photo = String(student.photo).trim();
        if (photo.startsWith("data:") || photo.startsWith("blob:") || photo.startsWith("http://") || photo.startsWith("https://")) {
            return photo;
        }
        const normalized = photo.replace(/^\/+/, "");
        if (normalized.startsWith("uploads/")) {
            return `${API_URL}/${normalized}`;
        }
        return `${API_URL}/uploads/students/${normalized}`;
    };

    const loadRazorpayScript = () => {
        return new Promise((resolve) => {
            if (window.Razorpay) {
                resolve(true);
                return;
            }
            const script = document.createElement("script");
            script.src = "https://checkout.razorpay.com/v1/checkout.js";
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
        });
    };

    const handlePayFee = async (inv) => {
        const token = localStorage.getItem("studentToken");
        if (!token) {
            navigate("/student/login", { replace: true });
            return;
        }

        try {
            setProcessingInvoiceId(inv.id);
            setError("");

            // 1. Load Razorpay SDK
            const resScript = await loadRazorpayScript();
            if (!resScript) {
                alert("Failed to load Razorpay payment gateway. Please check your internet connection.");
                setProcessingInvoiceId(null);
                return;
            }

            // 2. Create Order on backend
            const orderRes = await fetch(`${API_URL}/api/student/fees/create-order`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    invoice_id: inv.id,
                    amount: inv.balance_amount
                })
            });

            const orderData = await orderRes.json();
            if (!orderRes.ok || !orderData.success) {
                alert(orderData.message || "Failed to initialize fee payment order.");
                setProcessingInvoiceId(null);
                return;
            }

            const { order, key } = orderData;

            // 3. Open Razorpay Checkout modal
            const options = {
                key: key || "rzp_test_placeholder",
                amount: order.amount,
                currency: "INR",
                name: "Hostel Management System",
                description: `Hostel Fee - ${inv.semester} (${inv.invoice_no})`,
                order_id: order.id,
                handler: async function (response) {
                    try {
                        setLoading(true);
                        // 4. Verify Payment on backend
                        const verifyRes = await fetch(`${API_URL}/api/student/fees/verify-payment`, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${token}`
                            },
                            body: JSON.stringify({
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature,
                                invoice_id: inv.id,
                                amount: inv.balance_amount
                            })
                        });

                        const verifyData = await verifyRes.json();
                        if (verifyRes.ok && verifyData.success) {
                            setSuccessMessage(`Payment of ${formatCurrency(inv.balance_amount)} completed successfully! Receipt No: ${verifyData.receipt?.receipt_no || "Issued"}`);
                            await fetchMyFees();
                            if (verifyData.receipt?.receipt_no) {
                                handleViewReceipt(verifyData.receipt.receipt_no);
                            }
                        } else {
                            alert(verifyData.message || "Payment verification failed. Please contact hostel rector.");
                        }
                    } catch (verifyErr) {
                        console.error("Payment Verification Error:", verifyErr);
                        alert("An error occurred while verifying your payment.");
                    } finally {
                        setLoading(false);
                    }
                },
                prefill: {
                    name: student?.name || "",
                    email: student?.email || "",
                    contact: student?.mobile || ""
                },
                theme: {
                    color: "#0f766e"
                },
                modal: {
                    ondismiss: function () {
                        setProcessingInvoiceId(null);
                    }
                }
            };

            const rzp = new window.Razorpay(options);
            rzp.on("payment.failed", function (failResponse) {
                alert(`Payment failed: ${failResponse.error?.description || "Transaction declined"}`);
                setProcessingInvoiceId(null);
            });
            rzp.open();
        } catch (payErr) {
            console.error("Payment Initiate Error:", payErr);
            alert("Failed to start payment process. Please try again.");
        } finally {
            setProcessingInvoiceId(null);
        }
    };

    const handleViewReceipt = async (receiptNo) => {
        if (!receiptNo) return;
        const token = localStorage.getItem("studentToken");
        try {
            setReceiptLoading(true);
            const res = await fetch(`${API_URL}/api/student/fees/my-receipt/${encodeURIComponent(receiptNo)}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setSelectedReceipt(data.receipt);
            } else {
                alert(data.message || "Unable to retrieve receipt.");
            }
        } catch (e) {
            console.error("View Receipt Error:", e);
        } finally {
            setReceiptLoading(false);
        }
    };

    // Calculate totals
    const totalAssigned = invoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);
    const totalPaid = invoices.reduce((sum, inv) => sum + Number(inv.paid_amount || 0), 0);
    const totalPending = invoices.reduce((sum, inv) => sum + Number(inv.balance_amount || 0), 0);
    const profilePhoto = getStudentPhoto();

    return (
        <div className="myfees-page">

            {/* MOBILE TOP HEADER */}
            <header className="myfees-mobile-header">
                <div className="myfees-mobile-left">
                    <button
                        ref={mobileMenuButtonRef}
                        type="button"
                        className="myfees-mobile-menu"
                        onClick={() => setMenuOpen((open) => !open)}
                        aria-label="Toggle student menu"
                    >
                        ☰
                    </button>
                    <div className="myfees-mobile-brand">
                        <div className="myfees-mobile-brand-icon">🏠</div>
                        <div>
                            <strong>Hostel</strong>
                            <span>Student Portal</span>
                        </div>
                    </div>
                </div>

                <button
                    type="button"
                    className="myfees-mobile-photo"
                    onClick={() => navigate("/student/profile")}
                    aria-label="Open student profile"
                >
                    {profilePhoto ? (
                        <img
                            src={profilePhoto}
                            alt="Student profile"
                            onError={(e) => { e.currentTarget.style.display = "none"; }}
                        />
                    ) : (
                        "👤"
                    )}
                </button>
            </header>

            {/* DESKTOP & MOBILE SIDEBAR */}
            <aside ref={sidebarRef} className={`myfees-sidebar ${menuOpen ? "mobile-open" : ""}`}>
                <div className="myfees-sidebar-brand">
                    <div className="myfees-brand-icon">🏠</div>
                    <div>
                        <strong>Hostel</strong>
                        <span>Student Portal</span>
                    </div>
                </div>

                <nav className="myfees-sidebar-nav">
                    <button type="button" className="myfees-nav-item" onClick={() => handleNavigation("/student/dashboard")}>
                        <span>📊</span> Dashboard
                    </button>
                    <button type="button" className="myfees-nav-item" onClick={() => handleNavigation("/student/profile")}>
                        <span>👤</span> My Profile
                    </button>
                    <button type="button" className="myfees-nav-item" onClick={() => handleNavigation("/student/room")}>
                        <span>🛏️</span> My Room
                    </button>
                    <button type="button" className="myfees-nav-item" onClick={() => handleNavigation("/student/gatepass")}>
                        <span>🎫</span> Gate Pass
                    </button>
                    <button type="button" className="myfees-nav-item" onClick={() => handleNavigation("/student/complaints")}>
                        <span>🛠️</span> Complaints
                    </button>
                    <button type="button" className="myfees-nav-item active" onClick={() => handleNavigation("/student/fees")}>
                        <span>💰</span> My Fees
                    </button>
                </nav>

                <div className="myfees-sidebar-footer">
                    <button type="button" className="myfees-logout-btn" onClick={handleLogout}>
                        <span>🚪</span> Logout
                    </button>
                </div>
            </aside>

            {/* BACKDROP FOR MOBILE SIDEBAR */}
            {menuOpen && (
                <div className="myfees-backdrop" onClick={() => setMenuOpen(false)} />
            )}

            {/* MAIN CONTENT */}
            <main className="myfees-main">

                {/* DESKTOP TOP BAR */}
                <div className="myfees-desktop-topbar">
                    <div className="myfees-title-block">
                        <span>STUDENT PORTAL</span>
                        <h1>Hostel Fees & Payments</h1>
                        <p>View assigned semester fee invoices, detailed breakdowns, and pay online securely.</p>
                    </div>

                    <div className="myfees-desktop-profile">
                        <div className="myfees-profile-meta">
                            <strong>{student?.name || "Student"}</strong>
                            <small>{student?.room_no ? `Room ${student.room_no}` : "Hostel Resident"}</small>
                        </div>
                        <div className="myfees-desktop-avatar" onClick={() => navigate("/student/profile")}>
                            {profilePhoto ? (
                                <img
                                    src={profilePhoto}
                                    alt="Student Avatar"
                                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                                />
                            ) : (
                                <span>{student?.name?.charAt(0)?.toUpperCase() || "S"}</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* SUCCESS ALERT */}
                {successMessage && (
                    <div className="myfees-success-banner">
                        <span className="success-icon">✓</span>
                        <div className="success-content">
                            <strong>Payment Successful!</strong>
                            <p>{successMessage}</p>
                        </div>
                        <button className="banner-dismiss" onClick={() => setSuccessMessage("")}>✕</button>
                    </div>
                )}

                {/* SUMMARY METRICS CARDS */}
                <section className="myfees-summary-grid">
                    <div className="myfees-metric-card total">
                        <div className="metric-icon">📑</div>
                        <div>
                            <span>TOTAL ASSIGNED</span>
                            <strong>{formatCurrency(totalAssigned)}</strong>
                        </div>
                    </div>

                    <div className="myfees-metric-card paid">
                        <div className="metric-icon">✓</div>
                        <div>
                            <span>AMOUNT PAID</span>
                            <strong>{formatCurrency(totalPaid)}</strong>
                        </div>
                    </div>

                    <div className="myfees-metric-card pending">
                        <div className="metric-icon">⏳</div>
                        <div>
                            <span>PENDING BALANCE</span>
                            <strong style={{ color: totalPending > 0 ? "#dc2626" : "#166534" }}>
                                {formatCurrency(totalPending)}
                            </strong>
                        </div>
                    </div>
                </section>

                {/* TABS */}
                <div className="myfees-tabs-bar">
                    <button
                        className={`tab-btn ${activeTab === "invoices" ? "active" : ""}`}
                        onClick={() => setActiveTab("invoices")}
                    >
                        📋 Semester Invoices ({invoices.length})
                    </button>
                    <button
                        className={`tab-btn ${activeTab === "history" ? "active" : ""}`}
                        onClick={() => setActiveTab("history")}
                    >
                        💳 Payment History & Receipts ({payments.length})
                    </button>
                </div>

                {/* ERROR OR LOADING */}
                {loading ? (
                    <div className="myfees-loading-box">
                        <div className="myfees-spinner">⏳</div>
                        <p>Loading hostel fee details...</p>
                    </div>
                ) : error ? (
                    <div className="myfees-error-box">
                        <div className="error-icon">⚠️</div>
                        <h3>Unable to Load Fees</h3>
                        <p>{error}</p>
                        <button onClick={fetchMyFees}>Try Again</button>
                    </div>
                ) : (
                    <>
                        {/* INVOICES VIEW */}
                        {activeTab === "invoices" && (
                            <section className="myfees-invoices-section">
                                {invoices.length === 0 ? (
                                    <div className="myfees-empty-box">
                                        <div className="empty-icon">✓</div>
                                        <h3>No Invoices Assigned</h3>
                                        <p>You currently do not have any pending or assigned hostel fee invoices.</p>
                                    </div>
                                ) : (
                                    <div className="invoices-list">
                                        {invoices.map((inv) => {
                                            const isPaid = inv.status === "Paid" || Number(inv.balance_amount) <= 0;
                                            const isOverdue = inv.status === "Overdue" || (inv.due_date && new Date(inv.due_date) < new Date() && Number(inv.balance_amount) > 0);

                                            return (
                                                <article className="invoice-card" key={inv.id}>
                                                    <div className="invoice-card-header">
                                                        <div className="header-left">
                                                            <span className="invoice-sem-pill">{inv.semester} • {inv.academic_year}</span>
                                                            <h3>{inv.fee_structure_name || "Semester Fee Structure"}</h3>
                                                            <small>Invoice No: <code>{inv.invoice_no}</code> • Due Date: {formatDate(inv.due_date)}</small>
                                                        </div>

                                                        <div className="header-right">
                                                            <span className={`invoice-status-tag ${isPaid ? "paid" : isOverdue ? "overdue" : "pending"}`}>
                                                                {isPaid ? "Paid in Full" : isOverdue ? "Overdue" : inv.status || "Unpaid"}
                                                            </span>
                                                            <strong className="invoice-price">{formatCurrency(inv.total_amount)}</strong>
                                                        </div>
                                                    </div>

                                                    {/* ITEMIZED CHARGES BREAKDOWN */}
                                                    <div className="invoice-breakdown-box">
                                                        <span className="breakdown-title">Itemized Fee Particulars:</span>
                                                        <div className="breakdown-grid">
                                                            {inv.items && inv.items.length > 0 ? (
                                                                inv.items.map((item, i) => (
                                                                    <div className="breakdown-row" key={i}>
                                                                        <span className="charge-title">{item.charge_name}</span>
                                                                        <span className="charge-price">{formatCurrency(item.amount)}</span>
                                                                    </div>
                                                                ))
                                                            ) : (
                                                                <div className="breakdown-row">
                                                                    <span>Standard Semester Hostel Fee</span>
                                                                    <span>{formatCurrency(inv.total_amount)}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* INVOICE FOOTER WITH PAYMENT BUTTON */}
                                                    <div className="invoice-card-footer">
                                                        <div className="invoice-balance-info">
                                                            <span>Paid: <strong>{formatCurrency(inv.paid_amount)}</strong></span>
                                                            <span>Outstanding: <strong style={{ color: Number(inv.balance_amount) > 0 ? "#dc2626" : "#166534" }}>{formatCurrency(inv.balance_amount)}</strong></span>
                                                        </div>

                                                        <div className="invoice-actions">
                                                            {isPaid ? (
                                                                <div className="paid-badge-container">
                                                                    <span className="paid-checkmark">✓ All Fees Settled</span>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    className="pay-now-btn"
                                                                    disabled={processingInvoiceId === inv.id}
                                                                    onClick={() => handlePayFee(inv)}
                                                                >
                                                                    {processingInvoiceId === inv.id ? (
                                                                        "Processing Gateway..."
                                                                    ) : (
                                                                        `Pay Now ${formatCurrency(inv.balance_amount)} →`
                                                                    )}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </article>
                                            );
                                        })}
                                    </div>
                                )}
                            </section>
                        )}

                        {/* PAYMENT HISTORY & RECEIPTS VIEW */}
                        {activeTab === "history" && (
                            <section className="myfees-history-section">
                                {payments.length === 0 ? (
                                    <div className="myfees-empty-box">
                                        <div className="empty-icon">💳</div>
                                        <h3>No Payment Records Found</h3>
                                        <p>You haven't made any fee payments yet. Once you complete a payment, the receipt will be available here.</p>
                                    </div>
                                ) : (
                                    <div className="history-table-container">
                                        <table className="myfees-table">
                                            <thead>
                                                <tr>
                                                    <th>#</th>
                                                    <th>Receipt No</th>
                                                    <th>Semester / Invoice</th>
                                                    <th>Amount Paid</th>
                                                    <th>Method</th>
                                                    <th>Transaction Reference</th>
                                                    <th>Payment Date</th>
                                                    <th>Status</th>
                                                    <th>Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {payments.map((p, idx) => (
                                                    <tr key={p.id || idx}>
                                                        <td>{idx + 1}</td>
                                                        <td>
                                                            <span className="history-receipt-pill">
                                                                {p.receipt_no || "—"}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <strong>{p.semester || "Semester"}</strong>
                                                            <small style={{ display: "block", color: "#64748b" }}>{p.invoice_no || "—"}</small>
                                                        </td>
                                                        <td>
                                                            <strong style={{ color: "#166534" }}>
                                                                {formatCurrency(p.amount)}
                                                            </strong>
                                                        </td>
                                                        <td>
                                                            <span className="method-badge">{p.payment_method || "Online"}</span>
                                                        </td>
                                                        <td>
                                                            <span className="ref-mono" title={p.razorpay_payment_id || ""}>
                                                                {p.razorpay_payment_id || p.razorpay_order_id || "—"}
                                                            </span>
                                                        </td>
                                                        <td>{formatDateTime(p.payment_date)}</td>
                                                        <td>
                                                            <span className="history-status-success">
                                                                {p.status || "Success"}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            {p.receipt_no ? (
                                                                <button
                                                                    type="button"
                                                                    className="view-receipt-btn"
                                                                    onClick={() => handleViewReceipt(p.receipt_no)}
                                                                >
                                                                    View Receipt 📄
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
                        )}
                    </>
                )}

                {/* RECEIPT MODAL */}
                {selectedReceipt && (
                    <div className="student-receipt-modal-backdrop" onClick={() => setSelectedReceipt(null)}>
                        <div className="student-receipt-modal-box" onClick={(e) => e.stopPropagation()}>
                            <div className="student-receipt-header">
                                <div>
                                    <span className="receipt-hostel-tag">OFFICIAL FEE RECEIPT</span>
                                    <h2>Hostel Management System</h2>
                                    <p>Campus Hostel Fee Payment Receipt</p>
                                </div>
                                <button className="receipt-close-cross" onClick={() => setSelectedReceipt(null)}>✕</button>
                            </div>

                            <div className="student-receipt-body" id="student-printable-receipt">
                                <div className="receipt-meta-grid">
                                    <div>
                                        <small>Receipt No:</small>
                                        <strong>{selectedReceipt.receipt_no}</strong>
                                    </div>
                                    <div>
                                        <small>Date & Time:</small>
                                        <strong>{formatDateTime(selectedReceipt.payment_date)}</strong>
                                    </div>
                                    <div>
                                        <small>Student Name:</small>
                                        <strong>{selectedReceipt.student_name}</strong>
                                    </div>
                                    <div>
                                        <small>Student ID / College:</small>
                                        <strong>#{selectedReceipt.student_id} • {selectedReceipt.college || "Campus Hostel"}</strong>
                                    </div>
                                    <div>
                                        <small>Invoice Reference:</small>
                                        <strong>{selectedReceipt.invoice_no}</strong>
                                    </div>
                                    <div>
                                        <small>Academic Year / Sem:</small>
                                        <strong>{selectedReceipt.academic_year} • {selectedReceipt.semester}</strong>
                                    </div>
                                    <div>
                                        <small>Payment Mode:</small>
                                        <strong>{selectedReceipt.payment_method}</strong>
                                    </div>
                                    <div>
                                        <small>Razorpay Ref:</small>
                                        <strong className="receipt-mono">{selectedReceipt.razorpay_payment_id || "N/A"}</strong>
                                    </div>
                                </div>

                                <div className="receipt-highlight-amount">
                                    <span>AMOUNT PAID</span>
                                    <strong>{formatCurrency(selectedReceipt.amount)}</strong>
                                    <p>Status: Payment Verified & Recorded</p>
                                </div>

                                {selectedReceipt.invoice_items && selectedReceipt.invoice_items.length > 0 && (
                                    <div className="receipt-items-container">
                                        <h4>Fee Breakdown for {selectedReceipt.semester}</h4>
                                        <table className="receipt-items-table">
                                            <thead>
                                                <tr>
                                                    <th>Particulars</th>
                                                    <th style={{ textAlign: "right" }}>Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedReceipt.invoice_items.map((item, idx) => (
                                                    <tr key={idx}>
                                                        <td>{item.charge_name}</td>
                                                        <td style={{ textAlign: "right" }}>{formatCurrency(item.amount)}</td>
                                                    </tr>
                                                ))}
                                                <tr className="table-total-row">
                                                    <td>Total Invoice Fee</td>
                                                    <td style={{ textAlign: "right" }}>{formatCurrency(selectedReceipt.invoice_total)}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                <div className="receipt-footer-disclaimer">
                                    <p>This is a computer-generated receipt for fee payment made under Hostel Management System. An email copy has also been dispatched to your registered email address.</p>
                                </div>
                            </div>

                            <div className="student-receipt-actions">
                                <button type="button" className="receipt-print-action" onClick={() => window.print()}>
                                    🖨️ Print Receipt
                                </button>
                                <button type="button" className="receipt-close-action" onClick={() => setSelectedReceipt(null)}>
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* FOOTER */}
                <footer className="myfees-footer">
                    <span>© 2026 Hostel Management System</span>
                    <span>Student Portal</span>
                </footer>
            </main>
        </div>
    );
}

export default MyFees;

