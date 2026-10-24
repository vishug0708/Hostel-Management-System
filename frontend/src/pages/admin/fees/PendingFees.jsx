import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./PendingFees.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function PendingFees() {
    const navigate = useNavigate();

    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [academicYear, setAcademicYear] = useState("all");
    const [semester, setSemester] = useState("all");
    const [sortBy, setSortBy] = useState("highest");

    useEffect(() => {
        fetchPendingFees();
    }, [academicYear, semester]);

    const fetchPendingFees = async () => {
        const token = localStorage.getItem("adminToken");

        if (!token) {
            navigate("/admin/login", { replace: true });
            return;
        }

        try {
            setLoading(true);
            setError("");

            const params = new URLSearchParams();
            if (academicYear !== "all") params.append("academic_year", academicYear);
            if (semester !== "all") params.append("semester", semester);
            if (search) params.append("search", search);

            const response = await fetch(
                `${API_URL}/api/admin/fees/pending?${params.toString()}`,
                {
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                setError(data.message || "Unable to load pending fees.");
                return;
            }

            setStudents(Array.isArray(data.students) ? data.students : []);
        } catch (err) {
            console.error("Pending Fees Error:", err);
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

    const filteredStudents = students
        .filter((student) => {
            const searchText = search.trim().toLowerCase();
            if (!searchText) return true;

            return (
                String(student.name || "").toLowerCase().includes(searchText) ||
                String(student.student_id || "").toLowerCase().includes(searchText) ||
                String(student.mobile || "").toLowerCase().includes(searchText) ||
                String(student.email || "").toLowerCase().includes(searchText) ||
                String(student.invoice_no || "").toLowerCase().includes(searchText) ||
                String(student.room_no || "").toLowerCase().includes(searchText)
            );
        })
        .sort((a, b) => {
            const amountA = Number(a.pending_amount || 0);
            const amountB = Number(b.pending_amount || 0);

            if (sortBy === "lowest") return amountA - amountB;
            if (sortBy === "dueDate") {
                const dateA = new Date(a.due_date || "9999-12-31").getTime();
                const dateB = new Date(b.due_date || "9999-12-31").getTime();
                return dateA - dateB;
            }
            return amountB - amountA;
        });

    const totalPending = filteredStudents.reduce(
        (total, s) => total + Number(s.pending_amount || 0),
        0
    );

    const totalPaid = filteredStudents.reduce(
        (total, s) => total + Number(s.paid_amount || 0),
        0
    );

    const overdueCount = filteredStudents.filter(
        (s) => s.status === "Overdue" || (s.due_date && new Date(s.due_date) < new Date() && Number(s.pending_amount) > 0)
    ).length;

    return (
        <div className="pending-fees-page">

            {/* SIDEBAR */}
            <aside className="pending-fees-sidebar">
                <div className="pending-fees-brand">
                    <div className="pending-fees-brand-icon">🏠</div>
                    <div>
                        <strong>Hostel</strong>
                        <span>Admin Panel</span>
                    </div>
                </div>

                <nav className="pending-fees-nav">
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

                <button className="pending-fees-logout" onClick={handleLogout}>
                    🚪 Logout
                </button>
            </aside>

            {/* MAIN CONTENT */}
            <main className="pending-fees-main">

                {/* HEADER */}
                <header className="pending-fees-header">
                    <div>
                        <span>FEES MANAGEMENT</span>
                        <h1>Pending Fees Monitor</h1>
                        <p>Track all outstanding, partial, and overdue student hostel fees.</p>
                    </div>

                    <div className="pending-fees-header-actions">
                        <button className="pending-fees-back-btn" onClick={() => navigate("/admin/fees")}>
                            ← Fees Dashboard
                        </button>
                    </div>
                </header>

                {/* SUBMODULE NAVIGATION TABS */}
                <div className="pending-fees-subnav">
                    <button onClick={() => navigate("/admin/fees")}>Dashboard</button>
                    <button onClick={() => navigate("/admin/fees/structures")}>Fee Structures</button>
                    <button onClick={() => navigate("/admin/fees/assign")}>Assign Fees</button>
                    <button onClick={() => navigate("/admin/fees/invoices")}>Invoices</button>
                    <button className="active" onClick={() => navigate("/admin/fees/pending")}>Pending Fees</button>
                    <button onClick={() => navigate("/admin/fees/records")}>Payment Records</button>
                    <button onClick={() => navigate("/admin/fees/reports")}>Reports</button>
                </div>

                {/* SUMMARY CARDS */}
                <section className="pending-fees-summary">
                    <div className="pending-summary-card">
                        <div className="pending-summary-icon">⏳</div>
                        <div>
                            <span>TOTAL PENDING</span>
                            <strong>{formatCurrency(totalPending)}</strong>
                        </div>
                    </div>

                    <div className="pending-summary-card">
                        <div className="pending-summary-icon paid">💰</div>
                        <div>
                            <span>ALREADY COLLECTED</span>
                            <strong>{formatCurrency(totalPaid)}</strong>
                        </div>
                    </div>

                    <div className="pending-summary-card">
                        <div className="pending-summary-icon students">👨‍🎓</div>
                        <div>
                            <span>STUDENTS WITH PENDING</span>
                            <strong>{filteredStudents.length}</strong>
                        </div>
                    </div>

                    <div className="pending-summary-card">
                        <div className="pending-summary-icon overdue">⚠️</div>
                        <div>
                            <span>OVERDUE INVOICES</span>
                            <strong style={{ color: overdueCount > 0 ? "#dc2626" : "#0f172a" }}>
                                {overdueCount}
                            </strong>
                        </div>
                    </div>
                </section>

                {/* FILTERS */}
                <section className="pending-fees-filter">
                    <div className="pending-fees-search">
                        <span>🔍</span>
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && fetchPendingFees()}
                            placeholder="Search student, ID, room, or invoice..."
                        />
                    </div>

                    <select value={academicYear} onChange={(e) => setAcademicYear(e.target.value)}>
                        <option value="all">All Academic Years</option>
                        <option value="2025-2026">2025-2026</option>
                        <option value="2026-2027">2026-2027</option>
                    </select>

                    <select value={semester} onChange={(e) => setSemester(e.target.value)}>
                        <option value="all">All Semesters</option>
                        <option value="Semester 1">Semester 1</option>
                        <option value="Semester 2">Semester 2</option>
                        <option value="Semester 3">Semester 3</option>
                        <option value="Semester 4">Semester 4</option>
                        <option value="Semester 5">Semester 5</option>
                        <option value="Semester 6">Semester 6</option>
                        <option value="Semester 7">Semester 7</option>
                        <option value="Semester 8">Semester 8</option>
                    </select>

                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                        <option value="highest">Highest Pending</option>
                        <option value="lowest">Lowest Pending</option>
                        <option value="dueDate">Earliest Due Date</option>
                    </select>

                    <button className="pending-fees-refresh" onClick={fetchPendingFees}>
                        ↻ Refresh
                    </button>
                </section>

                {/* ERROR OR LOADING OR LIST */}
                {loading ? (
                    <div className="pending-fees-loading">
                        <div className="pending-fees-spinner">⏳</div>
                        <p>Loading pending fees...</p>
                    </div>
                ) : error ? (
                    <div className="pending-fees-error-page">
                        <div className="pending-fees-error-icon">⚠️</div>
                        <h2>Unable to Load Pending Fees</h2>
                        <p>{error}</p>
                        <button onClick={fetchPendingFees}>Try Again</button>
                    </div>
                ) : (
                    <section className="pending-fees-card">
                        <div className="pending-fees-card-header">
                            <div>
                                <span>OUTSTANDING INVOICES</span>
                                <h2>Pending Fee Breakdown</h2>
                            </div>
                            <div className="pending-fees-count">
                                {filteredStudents.length} Students
                            </div>
                        </div>

                        {filteredStudents.length === 0 ? (
                            <div className="pending-fees-empty">
                                <div className="pending-empty-icon">✓</div>
                                <h3>No Pending Fees</h3>
                                <p>All fees are settled or no students match the selected filters.</p>
                            </div>
                        ) : (
                            <div className="pending-students-list">
                                {filteredStudents.map((item, index) => {
                                    const totalFee = Number(item.total_amount || item.hostel_fee || 0);
                                    const paidAmount = Number(item.paid_amount || 0);
                                    const pendingAmount = Number(item.pending_amount || 0);
                                    const percentage = totalFee > 0 ? Math.min((paidAmount / totalFee) * 100, 100) : 0;
                                    const isOverdue = item.status === "Overdue" || (item.due_date && new Date(item.due_date) < new Date() && pendingAmount > 0);

                                    return (
                                        <article className="pending-student-card" key={item.invoice_id || item.student_id || index}>
                                            <div className="pending-student-info">
                                                <div className="pending-student-avatar">
                                                    {item.name?.charAt(0)?.toUpperCase() || "S"}
                                                </div>
                                                <div>
                                                    <h3>{item.name || "Unknown Student"}</h3>
                                                    <span>
                                                        ID: {item.student_id || "—"}
                                                        {item.room_no ? ` • Room ${item.room_no}` : ""}
                                                        {item.semester ? ` • ${item.semester}` : ""}
                                                    </span>
                                                    {item.invoice_no && (
                                                        <span className="pending-invoice-badge">
                                                            Inv: {item.invoice_no}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="pending-student-contact">
                                                <div>
                                                    <small>Due Date</small>
                                                    <strong style={{ color: isOverdue ? "#dc2626" : "inherit" }}>
                                                        {formatDate(item.due_date)} {isOverdue ? "(Overdue)" : ""}
                                                    </strong>
                                                </div>
                                                <div>
                                                    <small>Status</small>
                                                    <span className={`pending-status-pill ${isOverdue ? "overdue" : String(item.status || "unpaid").toLowerCase().replace(/\s+/g, "-")}`}>
                                                        {isOverdue ? "Overdue" : item.status || "Unpaid"}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="pending-student-fee">
                                                <div className="pending-fee-amount">
                                                    <small>PENDING</small>
                                                    <strong>{formatCurrency(pendingAmount)}</strong>
                                                </div>

                                                <div className="pending-fee-progress">
                                                    <div
                                                        className="pending-fee-progress-bar"
                                                        style={{ width: `${percentage}%` }}
                                                    />
                                                </div>

                                                <div className="pending-fee-values">
                                                    <span>Paid: {formatCurrency(paidAmount)}</span>
                                                    <span>Total: {formatCurrency(totalFee)}</span>
                                                </div>
                                            </div>

                                            <div className="pending-card-actions">
                                                <button
                                                    className="pending-action-btn"
                                                    onClick={() => navigate(`/admin/fees/student/${item.student_id || item.id}`)}
                                                >
                                                    View Details →
                                                </button>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                )}

                {/* FOOTER */}
                <footer className="pending-fees-footer">
                    <span>© 2026 Hostel Management System</span>
                    <span>Admin Panel</span>
                </footer>
            </main>
        </div>
    );
}

export default PendingFees;
