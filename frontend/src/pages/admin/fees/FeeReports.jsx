import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./FeeReports.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function FeeReports() {
    const navigate = useNavigate();

    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");

    useEffect(() => {
        fetchReports();
    }, []);

    const fetchReports = async () => {
        const token = localStorage.getItem("adminToken");

        if (!token) {
            navigate("/admin/login", { replace: true });
            return;
        }

        try {
            setLoading(true);
            setError("");

            const params = new URLSearchParams();
            if (fromDate) params.append("from_date", fromDate);
            if (toDate) params.append("to_date", toDate);

            const response = await fetch(
                `${API_URL}/api/admin/fees/reports?${params.toString()}`,
                {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                setError(data.message || "Failed to load fee reports.");
                return;
            }

            setReport(data.report || {});
        } catch (err) {
            console.error("Fee Reports Error:", err);
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

    const downloadReportCSV = () => {
        if (!report || !report.paymentsList || report.paymentsList.length === 0) {
            alert("No payment transactions to export.");
            return;
        }

        const headers = ["Receipt No", "Student Name", "Student ID", "Semester", "Academic Year", "Amount", "Method", "Razorpay ID", "Date"];
        const rows = report.paymentsList.map(p => [
            `"${p.receipt_no || "—"}"`,
            `"${p.student_name || "Unknown"}"`,
            `"${p.student_id || "—"}"`,
            `"${p.semester || "—"}"`,
            `"${p.academic_year || "—"}"`,
            p.amount || 0,
            `"${p.payment_method || "—"}"`,
            `"${p.razorpay_payment_id || "—"}"`,
            `"${formatDate(p.payment_date)}"`
        ]);

        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Hostel_Fee_Report_${fromDate || "all"}_to_${toDate || "now"}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const overall = report?.overall || {};
    const semesterBreakdown = report?.semesterBreakdown || [];
    const paymentsList = report?.paymentsList || [];

    const collectionRate = Number(overall.total_assigned || 0) > 0
        ? ((Number(overall.total_collected || 0) / Number(overall.total_assigned || 0)) * 100).toFixed(1)
        : 0;

    return (
        <div className="fee-reports-page">

            {/* SIDEBAR */}
            <aside className="fee-reports-sidebar">
                <div className="fee-reports-brand">
                    <div className="fee-reports-brand-icon">🏠</div>
                    <div>
                        <strong>Hostel</strong>
                        <span>Admin Panel</span>
                    </div>
                </div>

                <nav className="fee-reports-nav">
                    <button onClick={() => navigate("/admin/dashboard")}>📊 Dashboard</button>
                    <button onClick={() => navigate("/admin/students")}>🎓 Students</button>
                    <button onClick={() => navigate("/admin/rooms")}>🛏️ Rooms</button>
                    <button className="active" onClick={() => navigate("/admin/fees")}>💰 Fees</button>
                    <button onClick={() => navigate("/admin/profile")}>👤 Profile</button>
                </nav>

                <button className="fee-reports-logout" onClick={handleLogout}>
                    🚪 Logout
                </button>
            </aside>

            {/* MAIN CONTENT */}
            <main className="fee-reports-main">

                {/* HEADER */}
                <header className="fee-reports-header">
                    <div>
                        <span>FEES MANAGEMENT</span>
                        <h1>Fee Analytics & Reports</h1>
                        <p>Comprehensive collection statistics, semester reconciliations, and audit reports.</p>
                    </div>

                    <div className="fee-reports-header-actions">
                        <button className="fee-reports-export-btn" onClick={downloadReportCSV}>
                            📥 Export Ledger CSV
                        </button>
                        <button className="fee-reports-back-btn" onClick={() => navigate("/admin/fees")}>
                            ← Fees Dashboard
                        </button>
                    </div>
                </header>

                {/* SUBMODULE NAVIGATION TABS */}
                <div className="fee-reports-subnav">
                    <button onClick={() => navigate("/admin/fees")}>Dashboard</button>
                    <button onClick={() => navigate("/admin/fees/structures")}>Fee Structures</button>
                    <button onClick={() => navigate("/admin/fees/assign")}>Assign Fees</button>
                    <button onClick={() => navigate("/admin/fees/invoices")}>Invoices</button>
                    <button onClick={() => navigate("/admin/fees/pending")}>Pending Fees</button>
                    <button onClick={() => navigate("/admin/fees/records")}>Payment Records</button>
                    <button className="active" onClick={() => navigate("/admin/fees/reports")}>Reports</button>
                </div>

                {/* DATE RANGE FILTER */}
                <section className="fee-reports-filter-card">
                    <div className="fee-reports-date-inputs">
                        <div className="date-field">
                            <label>From Date</label>
                            <input
                                type="date"
                                value={fromDate}
                                onChange={(e) => setFromDate(e.target.value)}
                            />
                        </div>
                        <div className="date-field">
                            <label>To Date</label>
                            <input
                                type="date"
                                value={toDate}
                                onChange={(e) => setToDate(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="fee-reports-filter-btns">
                        <button className="filter-apply-btn" onClick={fetchReports}>
                            Filter Ledger
                        </button>
                        {(fromDate || toDate) && (
                            <button
                                className="filter-clear-btn"
                                onClick={() => {
                                    setFromDate("");
                                    setToDate("");
                                    setTimeout(fetchReports, 50);
                                }}
                            >
                                Clear Dates
                            </button>
                        )}
                    </div>
                </section>

                {/* ERROR OR LOADING OR CONTENT */}
                {loading ? (
                    <div className="fee-reports-loading">
                        <div className="fee-reports-spinner">⏳</div>
                        <p>Generating fee analytics and audit ledger...</p>
                    </div>
                ) : error ? (
                    <div className="fee-reports-error-page">
                        <div className="fee-reports-error-icon">⚠️</div>
                        <h2>Unable to Load Reports</h2>
                        <p>{error}</p>
                        <button onClick={fetchReports}>Try Again</button>
                    </div>
                ) : (
                    <>
                        {/* OVERALL METRICS */}
                        <section className="fee-reports-metrics-grid">
                            <div className="report-metric-card total">
                                <div className="metric-header">
                                    <span>TOTAL ASSIGNED</span>
                                    <div className="metric-icon">📑</div>
                                </div>
                                <strong>{formatCurrency(overall.total_assigned)}</strong>
                                <small>{overall.total_invoices || 0} Total Invoices</small>
                            </div>

                            <div className="report-metric-card collected">
                                <div className="metric-header">
                                    <span>TOTAL COLLECTED</span>
                                    <div className="metric-icon">✓</div>
                                </div>
                                <strong>{formatCurrency(overall.total_collected)}</strong>
                                <small>{collectionRate}% Collection Rate ({overall.paid_invoices || 0} Paid)</small>
                            </div>

                            <div className="report-metric-card pending">
                                <div className="metric-header">
                                    <span>OUTSTANDING BALANCE</span>
                                    <div className="metric-icon">⏳</div>
                                </div>
                                <strong>{formatCurrency(overall.total_outstanding)}</strong>
                                <small>{overall.unpaid_invoices || 0} Unpaid • {overall.partially_paid_invoices || 0} Partial</small>
                            </div>

                            <div className="report-metric-card overdue">
                                <div className="metric-header">
                                    <span>OVERDUE AMOUNT</span>
                                    <div className="metric-icon">⚠️</div>
                                </div>
                                <strong>{formatCurrency(overall.total_overdue)}</strong>
                                <small>{overall.overdue_invoices || 0} Overdue Invoices</small>
                            </div>
                        </section>

                        {/* SEMESTER BREAKDOWN TABLE */}
                        <section className="fee-reports-card">
                            <div className="fee-reports-card-header">
                                <div>
                                    <span>SEMESTER AUDIT</span>
                                    <h2>Semester Collection Breakdown</h2>
                                </div>
                                <div className="report-count-tag">
                                    {semesterBreakdown.length} Semesters
                                </div>
                            </div>

                            {semesterBreakdown.length === 0 ? (
                                <div className="fee-reports-empty">
                                    <p>No semester fee assignments recorded yet.</p>
                                </div>
                            ) : (
                                <div className="fee-reports-table-wrapper">
                                    <table className="fee-reports-table">
                                        <thead>
                                            <tr>
                                                <th>Academic Year</th>
                                                <th>Semester</th>
                                                <th>Invoices</th>
                                                <th>Total Assigned</th>
                                                <th>Total Collected</th>
                                                <th>Outstanding</th>
                                                <th>Collection %</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {semesterBreakdown.map((row, i) => {
                                                const assigned = Number(row.assigned || 0);
                                                const collected = Number(row.collected || 0);
                                                const outstanding = Number(row.outstanding || 0);
                                                const rate = assigned > 0 ? ((collected / assigned) * 100).toFixed(1) : 0;

                                                return (
                                                    <tr key={i}>
                                                        <td><strong>{row.academic_year}</strong></td>
                                                        <td>
                                                            <span className="sem-pill">{row.semester}</span>
                                                        </td>
                                                        <td>{row.total_invoices}</td>
                                                        <td><strong>{formatCurrency(assigned)}</strong></td>
                                                        <td style={{ color: "#166534" }}>{formatCurrency(collected)}</td>
                                                        <td style={{ color: outstanding > 0 ? "#dc2626" : "#475569" }}>
                                                            {formatCurrency(outstanding)}
                                                        </td>
                                                        <td>
                                                            <div className="rate-cell">
                                                                <div className="rate-bar-bg">
                                                                    <div className="rate-bar-fill" style={{ width: `${rate}%` }} />
                                                                </div>
                                                                <span>{rate}%</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </section>

                        {/* TRANSACTION LEDGER TABLE */}
                        <section className="fee-reports-card">
                            <div className="fee-reports-card-header">
                                <div>
                                    <span>VERIFIED PAYMENTS</span>
                                    <h2>Payment Transaction Ledger</h2>
                                    <p>List of successfully verified fee payments.</p>
                                </div>
                                <div className="report-count-tag">
                                    {paymentsList.length} Transactions
                                </div>
                            </div>

                            {paymentsList.length === 0 ? (
                                <div className="fee-reports-empty">
                                    <p>No payment transactions recorded for the selected period.</p>
                                </div>
                            ) : (
                                <div className="fee-reports-table-wrapper">
                                    <table className="fee-reports-table">
                                        <thead>
                                            <tr>
                                                <th>Receipt No</th>
                                                <th>Student</th>
                                                <th>Semester</th>
                                                <th>Invoice No</th>
                                                <th>Amount Paid</th>
                                                <th>Method</th>
                                                <th>Razorpay ID</th>
                                                <th>Payment Date</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {paymentsList.map((p, idx) => (
                                                <tr key={p.id || idx}>
                                                    <td>
                                                        <span className="ledger-receipt-no">{p.receipt_no || "—"}</span>
                                                    </td>
                                                    <td>
                                                        <strong>{p.student_name || "Unknown"}</strong>
                                                        <small style={{ display: "block", color: "#64748b" }}>ID: {p.student_id || "—"}</small>
                                                    </td>
                                                    <td>{p.semester || "Semester"}</td>
                                                    <td>
                                                        <code style={{ fontSize: "11px" }}>{p.invoice_no || "—"}</code>
                                                    </td>
                                                    <td>
                                                        <strong style={{ color: "#166534" }}>{formatCurrency(p.amount)}</strong>
                                                    </td>
                                                    <td>
                                                        <span className="ledger-method-tag">{p.payment_method || "Online"}</span>
                                                    </td>
                                                    <td>
                                                        <span className="ledger-mono-ref" title={p.razorpay_payment_id || ""}>
                                                            {p.razorpay_payment_id || "—"}
                                                        </span>
                                                    </td>
                                                    <td>{formatDate(p.payment_date)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </section>
                    </>
                )}

                {/* FOOTER */}
                <footer className="fee-reports-footer">
                    <span>© 2026 Hostel Management System</span>
                    <span>Admin Panel</span>
                </footer>
            </main>
        </div>
    );
}

export default FeeReports;

