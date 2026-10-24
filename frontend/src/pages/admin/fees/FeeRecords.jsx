import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./FeeRecords.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function FeeRecords() {
    const navigate = useNavigate();

    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    // Receipt Modal State
    const [selectedReceipt, setSelectedReceipt] = useState(null);
    const [receiptLoading, setReceiptLoading] = useState(false);

    useEffect(() => {
        fetchFeeRecords();
    }, [statusFilter]);

    const fetchFeeRecords = async () => {
        const token = localStorage.getItem("adminToken");

        if (!token) {
            navigate("/admin/login", { replace: true });
            return;
        }

        try {
            setLoading(true);
            setError("");

            const params = new URLSearchParams();
            if (statusFilter !== "all") params.append("status", statusFilter);
            if (search) params.append("search", search);

            const response = await fetch(
                `${API_URL}/api/admin/fees/payment-history?${params.toString()}`,
                {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                setError(data.message || "Unable to load fee records.");
                return;
            }

            setRecords(Array.isArray(data.payments) ? data.payments : []);
        } catch (err) {
            console.error("Fee Records Error:", err);
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
        if (s === "success" || s === "paid" || s === "completed") return "status-paid";
        if (s === "failed") return "status-failed";
        return "status-pending";
    };

    const handleViewReceipt = async (receiptNo) => {
        if (!receiptNo) {
            alert("No receipt generated for this record.");
            return;
        }

        const token = localStorage.getItem("adminToken");
        try {
            setReceiptLoading(true);
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
            alert("Failed to load receipt details.");
        } finally {
            setReceiptLoading(false);
        }
    };

    const downloadRecordsCSV = () => {
        if (filteredRecords.length === 0) {
            alert("No records to export.");
            return;
        }

        const headers = ["Receipt No", "Student Name", "Student ID", "Invoice No", "Semester", "Amount", "Method", "Razorpay ID", "Date", "Status"];
        const rows = filteredRecords.map(r => [
            `"${r.receipt_no || "—"}"`,
            `"${r.student_name || "Unknown"}"`,
            `"${r.student_id || "—"}"`,
            `"${r.invoice_no || "—"}"`,
            `"${r.semester || "—"}"`,
            r.amount || 0,
            `"${r.payment_method || "—"}"`,
            `"${r.razorpay_payment_id || "—"}"`,
            `"${formatDate(r.payment_date)}"`,
            `"${r.status || "—"}"`
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Hostel_Fee_Records_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const filteredRecords = records.filter((record) => {
        const searchText = search.trim().toLowerCase();
        if (!searchText) return true;

        return (
            String(record.student_name || "").toLowerCase().includes(searchText) ||
            String(record.student_id || "").toLowerCase().includes(searchText) ||
            String(record.receipt_no || "").toLowerCase().includes(searchText) ||
            String(record.invoice_no || "").toLowerCase().includes(searchText) ||
            String(record.razorpay_payment_id || "").toLowerCase().includes(searchText) ||
            String(record.payment_method || "").toLowerCase().includes(searchText)
        );
    });

    const totalCollected = filteredRecords.reduce((total, record) => {
        const status = String(record.status || "").toLowerCase();
        if (status === "paid" || status === "success" || status === "completed") {
            return total + Number(record.amount || 0);
        }
        return total;
    }, 0);

    return (
        <div className="fee-records-page">

            {/* SIDEBAR */}
            <aside className="fee-records-sidebar">
                <div className="fee-records-brand">
                    <div className="fee-records-brand-icon">🏠</div>
                    <div>
                        <strong>Hostel</strong>
                        <span>Admin Panel</span>
                    </div>
                </div>

                <nav className="fee-records-nav">
                    <button onClick={() => navigate("/admin/dashboard")}>📊 Dashboard</button>
                    <button onClick={() => navigate("/admin/students")}>🎓 Students</button>
                    <button onClick={() => navigate("/admin/rooms")}>🛏️ Rooms</button>
                    <button className="active" onClick={() => navigate("/admin/fees")}>💰 Fees</button>
                    <button onClick={() => navigate("/admin/profile")}>👤 Profile</button>
                </nav>

                <button className="fee-records-logout" onClick={handleLogout}>
                    🚪 Logout
                </button>
            </aside>

            {/* MAIN */}
            <main className="fee-records-main">

                {/* HEADER */}
                <header className="fee-records-header">
                    <div>
                        <span>FEES MANAGEMENT</span>
                        <h1>Fee Payment Records</h1>
                        <p>Real-time audit log of all online and manual student fee payments.</p>
                    </div>

                    <div className="fee-records-header-actions">
                        <button className="fee-records-export-btn" onClick={downloadRecordsCSV}>
                            📥 Export CSV
                        </button>
                        <button className="fee-records-back-btn" onClick={() => navigate("/admin/fees")}>
                            ← Fees Dashboard
                        </button>
                    </div>
                </header>

                {/* SUBMODULE NAVIGATION TABS */}
                <div className="fee-records-subnav">
                    <button onClick={() => navigate("/admin/fees")}>Dashboard</button>
                    <button onClick={() => navigate("/admin/fees/structures")}>Fee Structures</button>
                    <button onClick={() => navigate("/admin/fees/assign")}>Assign Fees</button>
                    <button onClick={() => navigate("/admin/fees/invoices")}>Invoices</button>
                    <button onClick={() => navigate("/admin/fees/pending")}>Pending Fees</button>
                    <button className="active" onClick={() => navigate("/admin/fees/records")}>Payment Records</button>
                    <button onClick={() => navigate("/admin/fees/reports")}>Reports</button>
                </div>

                {/* SUMMARY */}
                <section className="fee-records-summary">
                    <div className="fee-records-summary-card">
                        <span>TOTAL TRANSACTIONS</span>
                        <strong>{filteredRecords.length}</strong>
                    </div>

                    <div className="fee-records-summary-card">
                        <span>TOTAL COLLECTED</span>
                        <strong>{formatCurrency(totalCollected)}</strong>
                    </div>

                    <div className="fee-records-summary-card">
                        <span>SHOWING</span>
                        <strong>{filteredRecords.length} / {records.length}</strong>
                    </div>
                </section>

                {/* FILTERS */}
                <section className="fee-records-filter-card">
                    <div className="fee-records-search">
                        <span>🔍</span>
                        <input
                            type="text"
                            placeholder="Search student, ID, receipt, or payment ref..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && fetchFeeRecords()}
                        />
                    </div>

                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                        <option value="all">All Status</option>
                        <option value="Success">Success / Paid</option>
                        <option value="Pending">Pending</option>
                        <option value="Failed">Failed</option>
                    </select>

                    <button className="fee-records-refresh-btn" onClick={fetchFeeRecords}>
                        ↻ Refresh
                    </button>
                </section>

                {/* RECORDS TABLE */}
                {loading ? (
                    <div className="fee-records-loading">
                        <div className="fee-records-spinner">⏳</div>
                        <p>Loading fee records...</p>
                    </div>
                ) : error ? (
                    <div className="fee-records-error-page">
                        <div className="fee-records-error-icon">⚠️</div>
                        <h2>Unable to Load Fee Records</h2>
                        <p>{error}</p>
                        <button onClick={fetchFeeRecords}>Try Again</button>
                    </div>
                ) : (
                    <section className="fee-records-card">
                        <div className="fee-records-card-header">
                            <div>
                                <span>PAYMENT HISTORY</span>
                                <h2>Transaction History</h2>
                            </div>
                            <div className="fee-records-count">
                                {filteredRecords.length} Records
                            </div>
                        </div>

                        {filteredRecords.length === 0 ? (
                            <div className="fee-records-empty">
                                <div className="fee-records-empty-icon">💳</div>
                                <h3>No Fee Records Found</h3>
                                <p>No payment records match your current search or filter.</p>
                            </div>
                        ) : (
                            <div className="fee-records-table-wrapper">
                                <table className="fee-records-table">
                                    <thead>
                                        <tr>
                                            <th>#</th>
                                            <th>Receipt No</th>
                                            <th>Student</th>
                                            <th>Invoice / Sem</th>
                                            <th>Amount</th>
                                            <th>Method</th>
                                            <th>Transaction / Ref ID</th>
                                            <th>Payment Date</th>
                                            <th>Status</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRecords.map((record, index) => (
                                            <tr key={record.id || index}>
                                                <td>{index + 1}</td>
                                                <td>
                                                    <span className="fee-records-receipt-num">
                                                        {record.receipt_no || "—"}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="fee-record-student">
                                                        <div className="fee-record-student-avatar">
                                                            {record.student_name?.charAt(0)?.toUpperCase() || "S"}
                                                        </div>
                                                        <div>
                                                            <strong>{record.student_name || "Unknown Student"}</strong>
                                                            <small>ID: {record.student_id || "—"}</small>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="fee-record-sem-cell">
                                                        <strong>{record.semester || "Semester"}</strong>
                                                        <small>{record.invoice_no || "—"}</small>
                                                    </div>
                                                </td>
                                                <td>
                                                    <strong className="fee-record-amount">
                                                        {formatCurrency(record.amount)}
                                                    </strong>
                                                </td>
                                                <td>
                                                    <span className="fee-record-method">
                                                        {record.payment_method || "Online"}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className="fee-record-ref" title={record.razorpay_payment_id || ""}>
                                                        {record.razorpay_payment_id || record.razorpay_order_id || "—"}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className="fee-record-date">
                                                        {formatDateTime(record.payment_date)}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`fee-record-status ${getStatusClass(record.status)}`}>
                                                        {record.status || "Success"}
                                                    </span>
                                                </td>
                                                <td>
                                                    {record.receipt_no ? (
                                                        <button
                                                            className="fee-records-view-btn"
                                                            onClick={() => handleViewReceipt(record.receipt_no)}
                                                        >
                                                            Receipt 📄
                                                        </button>
                                                    ) : (
                                                        <span className="fee-records-no-receipt">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                )}

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

                            <div className="receipt-modal-body" id="printable-receipt">
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
                                        <label>Student ID / College:</label>
                                        <strong>{selectedReceipt.student_id} ({selectedReceipt.college || "Hostel"})</strong>
                                    </div>
                                    <div>
                                        <label>Invoice No:</label>
                                        <strong>{selectedReceipt.invoice_no}</strong>
                                    </div>
                                    <div>
                                        <label>Academic Year / Sem:</label>
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

                                <div className="receipt-footer-note">
                                    <p>This is a computer-generated receipt for hostel fees paid under Hostel Management System. No physical signature is required.</p>
                                </div>
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
                <footer className="fee-records-footer">
                    <span>© 2026 Hostel Management System</span>
                    <span>Admin Panel</span>
                </footer>
            </main>
        </div>
    );
}

export default FeeRecords;
