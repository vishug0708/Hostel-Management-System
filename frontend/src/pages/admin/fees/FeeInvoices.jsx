import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./FeeInvoices.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function FeeInvoices() {
    const navigate = useNavigate();

    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    // Filters
    const [academicYear, setAcademicYear] = useState("all");
    const [semester, setSemester] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);

    // Selected Invoice for details modal
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [detailsLoading, setDetailsLoading] = useState(false);

    // Revision state
    const [isRevising, setIsRevising] = useState(false);
    const [revisionItems, setRevisionItems] = useState([]);
    const [cancelModalOpen, setCancelModalOpen] = useState(false);
    const [cancelReason, setCancelReason] = useState("");

    useEffect(() => {
        fetchInvoices();
    }, [academicYear, semester, statusFilter, search, page]);

    const fetchInvoices = async () => {
        const token = localStorage.getItem("adminToken");
        if (!token) return navigate("/admin/login", { replace: true });

        try {
            setLoading(true);
            setError("");

            const params = new URLSearchParams({
                academic_year: academicYear,
                semester: semester,
                status: statusFilter,
                search: search.trim(),
                page,
                limit: 25
            });

            const res = await fetch(`${API_URL}/api/admin/fees/invoices?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                setError(data.message || "Failed to load invoices.");
                return;
            }

            setInvoices(data.invoices || []);
            setTotal(data.total || 0);
        } catch (err) {
            setError("Cannot connect to server.");
        } finally {
            setLoading(false);
        }
    };

    const handleOpenDetails = async (id) => {
        const token = localStorage.getItem("adminToken");
        if (!token) return;

        try {
            setDetailsLoading(true);
            setIsRevising(false);
            const res = await fetch(`${API_URL}/api/admin/fees/invoices/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setSelectedInvoice(data.invoice);
                setRevisionItems(data.invoice.items?.map(it => ({ ...it })) || []);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setDetailsLoading(false);
        }
    };

    const handleSaveRevision = async () => {
        if (!selectedInvoice) return;
        const token = localStorage.getItem("adminToken");
        if (!token) return;

        try {
            const res = await fetch(`${API_URL}/api/admin/fees/invoices/${selectedInvoice.id}/revise`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    items: revisionItems,
                    due_date: selectedInvoice.due_date,
                    remarks: selectedInvoice.remarks
                })
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                alert(data.message || "Failed to revise invoice.");
                return;
            }

            setSuccessMessage("✓ Invoice revised successfully.");
            setIsRevising(false);
            handleOpenDetails(selectedInvoice.id);
            fetchInvoices();
            setTimeout(() => setSuccessMessage(""), 4000);
        } catch (err) {
            console.error(err);
        }
    };

    const handleCancelInvoice = async () => {
        if (!selectedInvoice) return;
        const token = localStorage.getItem("adminToken");
        if (!token) return;

        try {
            const res = await fetch(`${API_URL}/api/admin/fees/invoices/${selectedInvoice.id}/cancel`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ reason: cancelReason })
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                alert(data.message || "Failed to cancel invoice.");
                return;
            }

            setSuccessMessage("✓ Invoice cancelled successfully.");
            setCancelModalOpen(false);
            setSelectedInvoice(null);
            fetchInvoices();
            setTimeout(() => setSuccessMessage(""), 4000);
        } catch (err) {
            console.error(err);
        }
    };

    const getStatusClass = (status) => {
        return String(status || "unpaid").toLowerCase().replace(/\s+/g, "-");
    };

    const handleLogout = () => {
        localStorage.removeItem("adminToken");
        localStorage.removeItem("admin");
        navigate("/admin/login", { replace: true });
    };

    return (
        <div className="feeinvoices-page">
            {/* SIDEBAR */}
            <aside className="feeinvoices-sidebar">
                <div className="feeinvoices-brand">
                    <div className="feeinvoices-brand-icon">🏠</div>
                    <div>
                        <strong>Hostel</strong>
                        <span>Admin Panel</span>
                    </div>
                </div>

                <nav className="feeinvoices-nav">
                    <button onClick={() => navigate("/admin/dashboard")}>📊 Dashboard</button>
                    <button onClick={() => navigate("/admin/students")}>🎓 Students</button>
                    <button onClick={() => navigate("/admin/rooms")}>🛏️ Rooms</button>
                    <button className="active" onClick={() => navigate("/admin/fees")}>💰 Fees</button>
                    <button onClick={() => navigate("/admin/profile")}>👤 Profile</button>
                </nav>

                <button className="feeinvoices-logout" onClick={handleLogout}>
                    🚪 Logout
                </button>
            </aside>

            {/* MAIN */}
            <main className="feeinvoices-main">
                <header className="feeinvoices-header">
                    <div>
                        <span className="eyebrow">FEES MANAGEMENT</span>
                        <h1>Invoice Management</h1>
                        <p>View, filter, inspect breakdowns, revise unpaid invoices, and track payments.</p>
                    </div>

                    <div style={{ display: "flex", gap: "10px" }}>
                        <button
                            style={{
                                padding: "10px 18px",
                                border: "none",
                                borderRadius: "8px",
                                background: "#0f766e",
                                color: "white",
                                fontSize: "13px",
                                fontWeight: "700",
                                cursor: "pointer"
                            }}
                            onClick={() => navigate("/admin/fees/assign")}
                        >
                            + Assign Fees
                        </button>
                        <button
                            style={{
                                padding: "10px 16px",
                                border: "1px solid #cbd5e1",
                                background: "#ffffff",
                                borderRadius: "9px",
                                fontSize: "13px",
                                fontWeight: "600",
                                cursor: "pointer"
                            }}
                            onClick={() => navigate("/admin/fees")}
                        >
                            ← Back to Dashboard
                        </button>
                    </div>
                </header>

                {successMessage && (
                    <div style={{ background: "#dcfce7", color: "#15803d", padding: "12px 18px", borderRadius: "8px", marginBottom: "20px", fontWeight: "600", border: "1px solid #bbf7d0" }}>
                        {successMessage}
                    </div>
                )}

                {error && (
                    <div style={{ background: "#fee2e2", color: "#b91c1c", padding: "12px 18px", borderRadius: "8px", marginBottom: "20px", fontWeight: "600", border: "1px solid #fecaca" }}>
                        ⚠️ {error}
                    </div>
                )}

                <div className="feeinvoices-card">
                    {/* FILTERS */}
                    <div className="feeinvoices-filter-bar">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by invoice #, student name, email..."
                            style={{ width: "260px" }}
                        />

                        <select value={academicYear} onChange={(e) => setAcademicYear(e.target.value)}>
                            <option value="all">All Academic Years</option>
                            <option value="2026-2027">2026-2027</option>
                            <option value="2025-2026">2025-2026</option>
                        </select>

                        <select value={semester} onChange={(e) => setSemester(e.target.value)}>
                            <option value="all">All Semesters</option>
                            <option value="Semester 1">Semester 1</option>
                            <option value="Semester 2">Semester 2</option>
                            <option value="Semester 3">Semester 3</option>
                            <option value="Semester 4">Semester 4</option>
                        </select>

                        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                            <option value="all">All Statuses</option>
                            <option value="Unpaid">Unpaid</option>
                            <option value="Partially Paid">Partially Paid</option>
                            <option value="Paid">Paid</option>
                            <option value="Overdue">Overdue</option>
                            <option value="Cancelled">Cancelled</option>
                        </select>

                        <span style={{ marginLeft: "auto", fontSize: "13px", color: "#64748b", fontWeight: "600" }}>
                            Total Records: {total}
                        </span>
                    </div>

                    {/* TABLE */}
                    <div style={{ overflowX: "auto" }}>
                        <table className="feeinvoices-table">
                            <thead>
                                <tr>
                                    <th>Invoice #</th>
                                    <th>Student</th>
                                    <th>Room</th>
                                    <th>Semester</th>
                                    <th>Total Payable</th>
                                    <th>Amount Paid</th>
                                    <th>Balance</th>
                                    <th>Due Date</th>
                                    <th>Status</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan="10" style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                                            Loading invoices...
                                        </td>
                                    </tr>
                                ) : invoices.length === 0 ? (
                                    <tr>
                                        <td colSpan="10" style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                                            No invoices found for the selected filters.
                                        </td>
                                    </tr>
                                ) : (
                                    invoices.map((inv) => (
                                        <tr key={inv.id}>
                                            <td>
                                                <strong style={{ color: "#0f766e" }}>{inv.invoice_no}</strong>
                                                <br />
                                                <small style={{ color: "#94a3b8" }}>Issued: {inv.issue_date}</small>
                                            </td>
                                            <td>
                                                <strong>{inv.student_name}</strong>
                                                <br />
                                                <small style={{ color: "#64748b" }}>ID #{inv.student_id} • {inv.course || "—"}</small>
                                            </td>
                                            <td>{inv.room_no || "—"}</td>
                                            <td>
                                                <strong>{inv.semester}</strong>
                                                <br />
                                                <small style={{ color: "#64748b" }}>{inv.academic_year}</small>
                                            </td>
                                            <td><strong>₹{Number(inv.total_amount).toLocaleString("en-IN")}</strong></td>
                                            <td style={{ color: "#16a34a", fontWeight: "700" }}>
                                                ₹{Number(inv.paid_amount).toLocaleString("en-IN")}
                                            </td>
                                            <td style={{ color: Number(inv.balance_amount) > 0 ? "#dc2626" : "#64748b", fontWeight: "700" }}>
                                                ₹{Number(inv.balance_amount).toLocaleString("en-IN")}
                                            </td>
                                            <td>{inv.due_date}</td>
                                            <td>
                                                <span className={`feeinvoices-badge ${getStatusClass(inv.status)}`}>
                                                    {inv.status}
                                                </span>
                                            </td>
                                            <td>
                                                <button
                                                    className="feeinvoices-action-btn"
                                                    onClick={() => handleOpenDetails(inv.id)}
                                                >
                                                    View Details →
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            {/* DETAILS MODAL */}
            {selectedInvoice && (
                <div className="feeinvoices-modal-overlay">
                    <div className="feeinvoices-modal">
                        <div className="feeinvoices-modal-header">
                            <div>
                                <h2>Invoice Details: {selectedInvoice.invoice_no}</h2>
                                <span className={`feeinvoices-badge ${getStatusClass(selectedInvoice.status)}`}>
                                    {selectedInvoice.status}
                                </span>
                            </div>
                            <button className="feeinvoices-close-btn" onClick={() => setSelectedInvoice(null)}>×</button>
                        </div>

                        {/* STUDENT & DATES META */}
                        <div className="feeinvoices-detail-grid">
                            <div>
                                <strong>Student: </strong> {selectedInvoice.student_name} (ID #{selectedInvoice.student_id})<br />
                                <strong>Email: </strong> {selectedInvoice.student_email || "—"}<br />
                                <strong>Mobile: </strong> {selectedInvoice.student_mobile || "—"}
                            </div>
                            <div>
                                <strong>Semester: </strong> {selectedInvoice.semester} ({selectedInvoice.academic_year})<br />
                                <strong>Issue Date: </strong> {selectedInvoice.issue_date}<br />
                                <strong>Due Date: </strong> {selectedInvoice.due_date}
                            </div>
                        </div>

                        {/* CHARGES BREAKDOWN */}
                        <h3 style={{ fontSize: "15px", margin: "14px 0 8px", color: "#0f172a" }}>
                            Itemized Charge Breakdown
                        </h3>

                        {isRevising ? (
                            <div style={{ background: "#f8fafc", padding: "14px", borderRadius: "8px", border: "1px solid #cbd5e1", marginBottom: "16px" }}>
                                <p style={{ fontSize: "12px", color: "#b45309", margin: "0 0 10px", fontWeight: "700" }}>
                                    ⚠️ Revising active unpaid invoice. Changes will be audited.
                                </p>
                                {revisionItems.map((item, idx) => (
                                    <div key={idx} style={{ display: "flex", gap: "10px", marginBottom: "8px" }}>
                                        <input
                                            type="text"
                                            value={item.charge_name}
                                            onChange={(e) => {
                                                const up = [...revisionItems];
                                                up[idx].charge_name = e.target.value;
                                                setRevisionItems(up);
                                            }}
                                            style={{ flex: 2, padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                                        />
                                        <input
                                            type="number"
                                            value={item.amount}
                                            onChange={(e) => {
                                                const up = [...revisionItems];
                                                up[idx].amount = Number(e.target.value);
                                                setRevisionItems(up);
                                            }}
                                            style={{ flex: 1, padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                                        />
                                    </div>
                                ))}
                                <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                                    <button
                                        style={{ padding: "6px 14px", background: "#0f766e", color: "white", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "700", fontSize: "12px" }}
                                        onClick={handleSaveRevision}
                                    >
                                        Save Revision
                                    </button>
                                    <button
                                        style={{ padding: "6px 14px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}
                                        onClick={() => setIsRevising(false)}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <table className="feeinvoices-charges-table">
                                <thead>
                                    <tr>
                                        <th>Particulars</th>
                                        <th style={{ textAlign: "right" }}>Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedInvoice.items?.map((it, idx) => (
                                        <tr key={idx}>
                                            <td>{it.charge_name}</td>
                                            <td style={{ textAlign: "right", fontWeight: "600" }}>
                                                ₹{Number(it.amount).toLocaleString("en-IN")}
                                            </td>
                                        </tr>
                                    ))}
                                    <tr style={{ background: "#f8fafc", fontWeight: "800" }}>
                                        <td>Total Payable</td>
                                        <td style={{ textAlign: "right", color: "#0f766e", fontSize: "15px" }}>
                                            ₹{Number(selectedInvoice.total_amount).toLocaleString("en-IN")}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>Amount Paid</td>
                                        <td style={{ textAlign: "right", color: "#16a34a", fontWeight: "700" }}>
                                            ₹{Number(selectedInvoice.paid_amount).toLocaleString("en-IN")}
                                        </td>
                                    </tr>
                                    <tr style={{ color: Number(selectedInvoice.balance_amount) > 0 ? "#dc2626" : "#64748b" }}>
                                        <td>Remaining Balance</td>
                                        <td style={{ textAlign: "right", fontWeight: "800" }}>
                                            ₹{Number(selectedInvoice.balance_amount).toLocaleString("en-IN")}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        )}

                        {/* PAYMENT HISTORY */}
                        <h3 style={{ fontSize: "15px", margin: "14px 0 8px", color: "#0f172a" }}>
                            Recorded Payments ({selectedInvoice.payments?.length || 0})
                        </h3>

                        {selectedInvoice.payments && selectedInvoice.payments.length > 0 ? (
                            <table className="feeinvoices-charges-table">
                                <thead>
                                    <tr>
                                        <th>Receipt #</th>
                                        <th>Date</th>
                                        <th>Method</th>
                                        <th>Razorpay ID</th>
                                        <th style={{ textAlign: "right" }}>Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedInvoice.payments.map((p, idx) => (
                                        <tr key={idx}>
                                            <td><strong style={{ color: "#0f766e" }}>{p.receipt_no || "N/A"}</strong></td>
                                            <td>{new Date(p.payment_date).toLocaleDateString("en-IN")}</td>
                                            <td>{p.payment_method}</td>
                                            <td><small>{p.razorpay_payment_id || "Direct"}</small></td>
                                            <td style={{ textAlign: "right", fontWeight: "700", color: "#16a34a" }}>
                                                ₹{Number(p.amount).toLocaleString("en-IN")}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 16px" }}>No payments recorded for this invoice yet.</p>
                        )}

                        {/* ACTIONS FOOTER */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #e2e8f0", paddingTop: "14px", marginTop: "14px" }}>
                            <div>
                                {selectedInvoice.status !== "Paid" && selectedInvoice.status !== "Cancelled" && (
                                    <>
                                        {!isRevising && (
                                            <button
                                                style={{ padding: "8px 14px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "#ffffff", cursor: "pointer", fontSize: "12px", marginRight: "8px" }}
                                                onClick={() => setIsRevising(true)}
                                            >
                                                ✏️ Revise Charges
                                            </button>
                                        )}
                                        {Number(selectedInvoice.paid_amount || 0) === 0 && (
                                            <button
                                                style={{ padding: "8px 14px", borderRadius: "6px", border: "none", background: "#fee2e2", color: "#b91c1c", cursor: "pointer", fontSize: "12px", fontWeight: "700" }}
                                                onClick={() => setCancelModalOpen(true)}
                                            >
                                                ✕ Cancel Invoice
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>

                            <button
                                style={{ padding: "8px 18px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "#ffffff", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}
                                onClick={() => setSelectedInvoice(null)}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CANCEL MODAL */}
            {cancelModalOpen && (
                <div className="feeinvoices-modal-overlay">
                    <div className="feeinvoices-modal" style={{ maxWidth: "420px" }}>
                        <h2 style={{ fontSize: "18px", margin: "0 0 8px", color: "#b91c1c" }}>Cancel Invoice Confirmation</h2>
                        <p style={{ fontSize: "13px", color: "#475569", margin: "0 0 14px" }}>
                            Are you sure you want to cancel invoice <strong>{selectedInvoice?.invoice_no}</strong>? This action cannot be undone and will be logged in the audit trail.
                        </p>
                        <div style={{ marginBottom: "14px" }}>
                            <label style={{ display: "block", fontSize: "12px", fontWeight: "700", marginBottom: "4px" }}>Reason for cancellation:</label>
                            <input
                                type="text"
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                                placeholder="e.g. Student cancelled admission"
                                style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", boxSizing: "border-box" }}
                            />
                        </div>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                            <button
                                style={{ padding: "8px 14px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "white", cursor: "pointer" }}
                                onClick={() => setCancelModalOpen(false)}
                            >
                                Back
                            </button>
                            <button
                                style={{ padding: "8px 18px", borderRadius: "6px", border: "none", background: "#b91c1c", color: "white", cursor: "pointer", fontWeight: "700" }}
                                onClick={handleCancelInvoice}
                            >
                                Confirm Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default FeeInvoices;

