import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./FeesDashboard.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function FeesDashboard() {
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [academicYear, setAcademicYear] = useState("all");
    const [semester, setSemester] = useState("all");

    const [stats, setStats] = useState({
        totalFees: 0,
        collectedFees: 0,
        pendingFees: 0,
        overdueFees: 0,
        monthlyCollection: 0,
        totalStudents: 0,
        paidStudents: 0,
        pendingStudents: 0
    });

    const [semesterSummary, setSemesterSummary] = useState([]);
    const [recentPayments, setRecentPayments] = useState([]);

    useEffect(() => {
        fetchFeesDashboard();
    }, [academicYear, semester]);

    const fetchFeesDashboard = async () => {
        const token = localStorage.getItem("adminToken");

        if (!token) {
            navigate("/admin/login", {
                replace: true
            });
            return;
        }

        try {
            setLoading(true);
            setError("");

            const queryParams = new URLSearchParams();
            if (academicYear !== "all") queryParams.append("academic_year", academicYear);
            if (semester !== "all") queryParams.append("semester", semester);

            const response = await fetch(
                `${API_URL}/api/admin/fees/dashboard?${queryParams.toString()}`,
                {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                setError(
                    data.message ||
                    "Unable to load fees dashboard."
                );
                return;
            }

            setStats({
                totalFees: data.stats?.totalFees || 0,
                collectedFees: data.stats?.collectedFees || 0,
                pendingFees: data.stats?.pendingFees || 0,
                overdueFees: data.stats?.overdueFees || 0,
                monthlyCollection: data.stats?.monthlyCollection || 0,
                totalStudents: data.stats?.totalStudents || 0,
                paidStudents: data.stats?.paidStudents || 0,
                pendingStudents: data.stats?.pendingStudents || 0
            });

            setSemesterSummary(
                Array.isArray(data.semesterSummary)
                    ? data.semesterSummary
                    : []
            );

            setRecentPayments(
                Array.isArray(data.recentPayments)
                    ? data.recentPayments
                    : []
            );
        } catch (err) {
            console.error("Fees Dashboard Error:", err);
            setError("Cannot connect to backend server.");
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("adminToken");
        localStorage.removeItem("admin");

        navigate("/admin/login", {
            replace: true
        });
    };

    const formatCurrency = (amount) => {
        return `₹${Number(amount || 0).toLocaleString("en-IN")}`;
    };

    const formatDate = (date) => {
        if (!date) {
            return "—";
        }

        const parsedDate = new Date(date);

        if (Number.isNaN(parsedDate.getTime())) {
            return date;
        }

        return parsedDate.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });
    };

    const getPaymentStatusClass = (status) => {
        return String(status || "pending")
            .toLowerCase()
            .replace(/\s+/g, "-");
    };

    const collectionPercentage =
        stats.totalFees > 0
            ? Math.min(
                (stats.collectedFees / stats.totalFees) * 100,
                100
            )
            : 0;

    if (loading && stats.totalStudents === 0) {
        return (
            <div className="fees-dashboard-loading">
                <div className="fees-dashboard-spinner">⏳</div>
                <p>Loading fees dashboard...</p>
            </div>
        );
    }

    if (error && stats.totalStudents === 0) {
        return (
            <div className="fees-dashboard-error-page">
                <div className="fees-dashboard-error-icon">⚠️</div>
                <h2>Unable to Load Fees Dashboard</h2>
                <p>{error}</p>
                <button onClick={fetchFeesDashboard}>Try Again</button>
            </div>
        );
    }

    return (
        <div className="fees-dashboard-page">
            {/* =================================================
                SIDEBAR
            ================================================= */}
            <aside className="fees-dashboard-sidebar">
                <div className="fees-dashboard-brand">
                    <div className="fees-dashboard-brand-icon">🏠</div>
                    <div>
                        <strong>Hostel</strong>
                        <span>Admin Panel</span>
                    </div>
                </div>

                <nav className="fees-dashboard-nav">
                    <button onClick={() => navigate("/admin/dashboard")}>
                        📊 Dashboard
                    </button>
                    <button onClick={() => navigate("/admin/students")}>
                        🎓 Students
                    </button>
                    <button onClick={() => navigate("/admin/rooms")}>
                        🛏️ Rooms
                    </button>
                    <button className="active" onClick={() => navigate("/admin/fees")}>
                        💰 Fees
                    </button>
                    <button onClick={() => navigate("/admin/profile")}>
                        👤 Profile
                    </button>
                </nav>

                <button className="fees-dashboard-logout" onClick={handleLogout}>
                    🚪 Logout
                </button>
            </aside>

            {/* =================================================
                MAIN
            ================================================= */}
            <main className="fees-dashboard-main">
                {/* =================================================
                    HEADER & FILTERS
                ================================================= */}
                <header className="fees-dashboard-header">
                    <div>
                        <span>FEES MANAGEMENT</span>
                        <h1>Fees Dashboard</h1>
                        <p>Monitor semester fee structures, student invoices, collections and pending balances.</p>
                    </div>

                    <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                        <select
                            value={academicYear}
                            onChange={(e) => setAcademicYear(e.target.value)}
                            style={{
                                padding: "8px 12px",
                                borderRadius: "8px",
                                border: "1px solid #cbd5e1",
                                background: "#ffffff",
                                fontSize: "13px",
                                fontWeight: "600",
                                color: "#1e293b"
                            }}
                        >
                            <option value="all">All Academic Years</option>
                            <option value="2026-2027">2026-2027</option>
                            <option value="2025-2026">2025-2026</option>
                        </select>

                        <select
                            value={semester}
                            onChange={(e) => setSemester(e.target.value)}
                            style={{
                                padding: "8px 12px",
                                borderRadius: "8px",
                                border: "1px solid #cbd5e1",
                                background: "#ffffff",
                                fontSize: "13px",
                                fontWeight: "600",
                                color: "#1e293b"
                            }}
                        >
                            <option value="all">All Semesters</option>
                            <option value="Semester 1">Semester 1</option>
                            <option value="Semester 2">Semester 2</option>
                            <option value="Semester 3">Semester 3</option>
                            <option value="Semester 4">Semester 4</option>
                        </select>

                        <button className="fees-dashboard-refresh-btn" onClick={fetchFeesDashboard}>
                            ↻ Refresh
                        </button>
                    </div>
                </header>

                {/* =================================================
                    SUMMARY CARDS
                ================================================= */}
                <section className="fees-summary-grid">
                    <div className="fees-summary-card total">
                        <div className="fees-summary-icon">💰</div>
                        <div>
                            <span>TOTAL FEES</span>
                            <h2>{formatCurrency(stats.totalFees)}</h2>
                            <p>Assigned semester fees</p>
                        </div>
                    </div>

                    <div className="fees-summary-card collected">
                        <div className="fees-summary-icon">✓</div>
                        <div>
                            <span>TOTAL COLLECTED</span>
                            <h2>{formatCurrency(stats.collectedFees)}</h2>
                            <p>Successfully verified payments</p>
                        </div>
                    </div>

                    <div className="fees-summary-card pending">
                        <div className="fees-summary-icon">⏳</div>
                        <div>
                            <span>PENDING FEES</span>
                            <h2>{formatCurrency(stats.pendingFees)}</h2>
                            <p>Outstanding balance</p>
                        </div>
                    </div>

                    <div className="fees-summary-card monthly">
                        <div className="fees-summary-icon">⚠️</div>
                        <div>
                            <span>OVERDUE FEES</span>
                            <h2 style={{ color: "#dc2626" }}>{formatCurrency(stats.overdueFees)}</h2>
                            <p>Past invoice due dates</p>
                        </div>
                    </div>
                </section>

                {/* =================================================
                    COLLECTION OVERVIEW
                ================================================= */}
                <section className="fees-overview-card">
                    <div className="fees-overview-header">
                        <div>
                            <span>COLLECTION OVERVIEW</span>
                            <h2>Fee Collection Status</h2>
                        </div>
                        <strong>{collectionPercentage.toFixed(1)}%</strong>
                    </div>

                    <div className="fees-progress-bar">
                        <div
                            className="fees-progress"
                            style={{ width: `${collectionPercentage}%` }}
                        />
                    </div>

                    <div className="fees-progress-info">
                        <span>Collected: {formatCurrency(stats.collectedFees)}</span>
                        <span>Pending: {formatCurrency(stats.pendingFees)}</span>
                    </div>
                </section>

                {/* =================================================
                    STUDENT FEE STATUS
                ================================================= */}
                <section className="student-fee-status-card">
                    <div className="student-fee-status-header">
                        <div>
                            <span>STUDENT PAYMENT STATUS</span>
                            <h2>Student Fee Overview</h2>
                        </div>
                    </div>

                    <div className="student-fee-status-grid">
                        <div className="student-fee-status-item">
                            <div className="status-item-icon">👨‍🎓</div>
                            <div>
                                <span>TOTAL STUDENTS</span>
                                <strong>{stats.totalStudents}</strong>
                            </div>
                        </div>

                        <div className="student-fee-status-item paid">
                            <div className="status-item-icon">✓</div>
                            <div>
                                <span>FULLY PAID</span>
                                <strong>{stats.paidStudents}</strong>
                            </div>
                        </div>

                        <div className="student-fee-status-item pending">
                            <div className="status-item-icon">⏳</div>
                            <div>
                                <span>PENDING / UNPAID</span>
                                <strong>{stats.pendingStudents}</strong>
                            </div>
                        </div>
                    </div>
                </section>

                {/* =================================================
                    QUICK ACTIONS
                ================================================= */}
                <section className="fees-quick-actions">
                    <div className="fees-section-title">
                        <div>
                            <span>MANAGEMENT</span>
                            <h2>Fee Management</h2>
                            <p>Create fee structures, assign fees, manage invoices and export reports.</p>
                        </div>
                    </div>

                    <div className="fees-action-grid">
                        <button onClick={() => navigate("/admin/fees/structures")}>
                            <span>📋</span>
                            <div>
                                <strong>Fee Structures</strong>
                                <small>Manage charges & structures</small>
                            </div>
                            <b>→</b>
                        </button>

                        <button onClick={() => navigate("/admin/fees/assign")}>
                            <span>➕</span>
                            <div>
                                <strong>Assign Fees</strong>
                                <small>Publish semester fees</small>
                            </div>
                            <b>→</b>
                        </button>

                        <button onClick={() => navigate("/admin/fees/invoices")}>
                            <span>📄</span>
                            <div>
                                <strong>Invoice Management</strong>
                                <small>View & revise invoices</small>
                            </div>
                            <b>→</b>
                        </button>

                        <button onClick={() => navigate("/admin/fees/pending")}>
                            <span>⏳</span>
                            <div>
                                <strong>Pending Fees</strong>
                                <small>Track outstanding balances</small>
                            </div>
                            <b>→</b>
                        </button>

                        <button onClick={() => navigate("/admin/fees/records")}>
                            <span>📜</span>
                            <div>
                                <strong>Payment History</strong>
                                <small>Verified transactions</small>
                            </div>
                            <b>→</b>
                        </button>

                        <button onClick={() => navigate("/admin/fees/reports")}>
                            <span>📊</span>
                            <div>
                                <strong>Fee Reports</strong>
                                <small>Collection analytics & CSV</small>
                            </div>
                            <b>→</b>
                        </button>
                    </div>
                </section>

                {/* =================================================
                    RECENT PAYMENTS
                ================================================= */}
                <section className="recent-payments-card">
                    <div className="recent-payments-header">
                        <div>
                            <span>RECENT ACTIVITY</span>
                            <h2>Recent Payments</h2>
                            <p>Latest verified fee transactions.</p>
                        </div>

                        <button onClick={() => navigate("/admin/fees/records")}>
                            View All →
                        </button>
                    </div>

                    {recentPayments.length === 0 ? (
                        <div className="no-payments">
                            <div>💳</div>
                            <h3>No Recent Payments</h3>
                            <p>Payment records will appear here as soon as verified transactions occur.</p>
                        </div>
                    ) : (
                        <div className="recent-payments-table-wrapper">
                            <table className="recent-payments-table">
                                <thead>
                                    <tr>
                                        <th>Student</th>
                                        <th>Invoice / Semester</th>
                                        <th>Amount</th>
                                        <th>Method</th>
                                        <th>Date</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {recentPayments.map((payment, index) => (
                                        <tr key={payment.id || index}>
                                            <td>
                                                <div className="payment-student">
                                                    <div className="payment-student-avatar">
                                                        {payment.student_name?.charAt(0)?.toUpperCase() || "S"}
                                                    </div>
                                                    <div>
                                                        <strong>{payment.student_name || "Unknown Student"}</strong>
                                                        <small>{payment.student_email || `ID #${payment.student_id}`}</small>
                                                    </div>
                                                </div>
                                            </td>

                                            <td>
                                                <strong>{payment.invoice_no || "General Fee"}</strong>
                                                <br />
                                                <small style={{ color: "#64748b" }}>{payment.semester || "Semester 1"}</small>
                                            </td>

                                            <td>
                                                <strong className="payment-amount">
                                                    {formatCurrency(payment.amount)}
                                                </strong>
                                            </td>

                                            <td>{payment.payment_method || "Razorpay"}</td>

                                            <td>{formatDate(payment.payment_date)}</td>

                                            <td>
                                                <span className={`payment-status ${getPaymentStatusClass(payment.status)}`}>
                                                    {payment.status || "Paid"}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}

export default FeesDashboard;
