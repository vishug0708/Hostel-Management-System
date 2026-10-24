import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "./AssignFees.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function AssignFees() {
    const navigate = useNavigate();
    const location = useLocation();

    // Query param for pre-selected structure
    const queryParams = new URLSearchParams(location.search);
    const initialStructureId = queryParams.get("structureId") || "";

    const [structures, setStructures] = useState([]);
    const [students, setStudents] = useState([]);
    const [selectedStructureId, setSelectedStructureId] = useState(initialStructureId);
    const [selectedStudents, setSelectedStudents] = useState([]);

    const [academicYear, setAcademicYear] = useState("2026-2027");
    const [semester, setSemester] = useState("Semester 1");
    const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
    const [dueDate, setDueDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        return d.toISOString().slice(0, 10);
    });
    const [remarks, setRemarks] = useState("");

    const [search, setSearch] = useState("");
    const [filterOption, setFilterOption] = useState("eligible"); // 'eligible' (room allocated) or 'all'
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        fetchStudents();
    }, [academicYear, semester, search]);

    const fetchInitialData = async () => {
        const token = localStorage.getItem("adminToken");
        if (!token) return navigate("/admin/login", { replace: true });

        try {
            setLoading(true);
            const structRes = await fetch(`${API_URL}/api/admin/fees/structures`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const structData = await structRes.json();
            if (structRes.ok && structData.success) {
                const list = structData.structures || [];
                setStructures(list);
                if (!selectedStructureId && list.length > 0) {
                    setSelectedStructureId(String(list[0].id));
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchStudents = async () => {
        const token = localStorage.getItem("adminToken");
        if (!token) return;

        try {
            const params = new URLSearchParams({
                academic_year: academicYear,
                semester: semester,
                search: search.trim()
            });

            const res = await fetch(`${API_URL}/api/admin/fees/eligible-students?${params.toString()}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setStudents(data.students || []);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const selectedStructure = structures.find(s => String(s.id) === String(selectedStructureId));
    const feeAmount = Number(selectedStructure?.total_amount || 0);

    const filteredStudents = students.filter(s => {
        if (filterOption === "eligible") {
            return s.room_no; // Only students with an allocated room
        }
        return true;
    });

    const assignableStudents = filteredStudents.filter(s => !s.existing_invoice_id);

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            setSelectedStudents(assignableStudents.map(s => s.id));
        } else {
            setSelectedStudents([]);
        }
    };

    const handleToggleStudent = (id) => {
        if (selectedStudents.includes(id)) {
            setSelectedStudents(selectedStudents.filter(sId => sId !== id));
        } else {
            setSelectedStudents([...selectedStudents, id]);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem("adminToken");
        if (!token) return navigate("/admin/login", { replace: true });

        if (!selectedStructureId) {
            setError("Please select a fee structure.");
            return;
        }

        if (selectedStudents.length === 0) {
            setError("Please select at least one student to assign fees.");
            return;
        }

        try {
            setSubmitting(true);
            setError("");

            const res = await fetch(`${API_URL}/api/admin/fees/assign`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    fee_structure_id: Number(selectedStructureId),
                    student_ids: selectedStudents,
                    academic_year: academicYear,
                    semester: semester,
                    issue_date: issueDate,
                    due_date: dueDate,
                    remarks: remarks.trim()
                })
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                setError(data.message || "Failed to assign fees.");
                return;
            }

            setSuccessMessage(`✓ Successfully assigned fees and generated ${data.count} student invoices.`);
            setSelectedStudents([]);
            fetchStudents();
            setTimeout(() => setSuccessMessage(""), 5000);
        } catch (err) {
            setError("Cannot connect to server.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("adminToken");
        localStorage.removeItem("admin");
        navigate("/admin/login", { replace: true });
    };

    return (
        <div className="assignfees-page">
            {/* SIDEBAR */}
            <aside className="assignfees-sidebar">
                <div className="assignfees-brand">
                    <div className="assignfees-brand-icon">🏠</div>
                    <div>
                        <strong>Hostel</strong>
                        <span>Admin Panel</span>
                    </div>
                </div>

                <nav className="assignfees-nav">
                    <button onClick={() => navigate("/admin/dashboard")}>📊 Dashboard</button>
                    <button onClick={() => navigate("/admin/students")}>🎓 Students</button>
                    <button onClick={() => navigate("/admin/rooms")}>🛏️ Rooms</button>
                    <button className="active" onClick={() => navigate("/admin/fees")}>💰 Fees</button>
                    <button onClick={() => navigate("/admin/profile")}>👤 Profile</button>
                </nav>

                <button className="assignfees-logout" onClick={handleLogout}>
                    🚪 Logout
                </button>
            </aside>

            {/* MAIN */}
            <main className="assignfees-main">
                <header className="assignfees-header">
                    <div>
                        <span className="eyebrow">FEES MANAGEMENT</span>
                        <h1>Assign Semester Fees</h1>
                        <p>Publish itemized fee structures to individual or eligible group hostel students.</p>
                    </div>

                    <div style={{ display: "flex", gap: "10px" }}>
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
                            onClick={() => navigate("/admin/fees/structures")}
                        >
                            📋 Manage Structures
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
                    <div style={{ background: "#dcfce7", color: "#15803d", padding: "14px 18px", borderRadius: "8px", marginBottom: "20px", fontWeight: "700", border: "1px solid #bbf7d0" }}>
                        {successMessage}
                    </div>
                )}

                {error && (
                    <div style={{ background: "#fee2e2", color: "#b91c1c", padding: "14px 18px", borderRadius: "8px", marginBottom: "20px", fontWeight: "700", border: "1px solid #fecaca" }}>
                        ⚠️ {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    {/* CONFIGURATION CARD */}
                    <div className="assignfees-card">
                        <h2 style={{ fontSize: "17px", margin: "0 0 16px", color: "#0f172a" }}>
                            1. Select Fee Structure & Semester Details
                        </h2>

                        <div className="assignfees-grid-config">
                            <div className="assignfees-field">
                                <label>Fee Structure *</label>
                                <select
                                    value={selectedStructureId}
                                    onChange={(e) => setSelectedStructureId(e.target.value)}
                                    required
                                >
                                    <option value="">-- Choose Structure --</option>
                                    {structures.map((st) => (
                                        <option key={st.id} value={st.id}>
                                            {st.title} (₹{Number(st.total_amount).toLocaleString("en-IN")}) - {st.semester}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="assignfees-field">
                                <label>Academic Year *</label>
                                <select value={academicYear} onChange={(e) => setAcademicYear(e.target.value)}>
                                    <option value="2026-2027">2026-2027</option>
                                    <option value="2025-2026">2025-2026</option>
                                    <option value="2027-2028">2027-2028</option>
                                </select>
                            </div>

                            <div className="assignfees-field">
                                <label>Semester *</label>
                                <select value={semester} onChange={(e) => setSemester(e.target.value)}>
                                    <option value="Semester 1">Semester 1</option>
                                    <option value="Semester 2">Semester 2</option>
                                    <option value="Semester 3">Semester 3</option>
                                    <option value="Semester 4">Semester 4</option>
                                    <option value="Semester 5">Semester 5</option>
                                    <option value="Semester 6">Semester 6</option>
                                </select>
                            </div>

                            <div className="assignfees-field">
                                <label>Issue Date *</label>
                                <input
                                    type="date"
                                    value={issueDate}
                                    onChange={(e) => setIssueDate(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="assignfees-field">
                                <label>Due Date *</label>
                                <input
                                    type="date"
                                    value={dueDate}
                                    onChange={(e) => setDueDate(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        {selectedStructure && (
                            <div style={{ background: "#f8fafc", padding: "12px 16px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "13px" }}>
                                <strong>Selected Structure Breakdown: </strong>
                                {selectedStructure.charges?.map(c => `${c.charge_name}: ₹${Number(c.amount).toLocaleString("en-IN")}`).join(" • ")}
                                <span style={{ marginLeft: "10px", color: "#0f766e", fontWeight: "800" }}>
                                    (Total: ₹{feeAmount.toLocaleString("en-IN")})
                                </span>
                            </div>
                        )}
                    </div>

                    {/* STUDENT SELECTION CARD */}
                    <div className="assignfees-card">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                            <div>
                                <h2 style={{ fontSize: "17px", margin: "0 0 4px", color: "#0f172a" }}>
                                    2. Select Students ({selectedStudents.length} selected)
                                </h2>
                                <small style={{ color: "#64748b" }}>
                                    Eligible hostel students with room allocations. Students with existing invoices for this semester are disabled to prevent duplicates.
                                </small>
                            </div>

                            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search by name, ID or email..."
                                    style={{
                                        padding: "8px 12px",
                                        borderRadius: "8px",
                                        border: "1px solid #cbd5e1",
                                        fontSize: "13px",
                                        width: "220px"
                                    }}
                                />

                                <select
                                    value={filterOption}
                                    onChange={(e) => setFilterOption(e.target.value)}
                                    style={{
                                        padding: "8px 12px",
                                        borderRadius: "8px",
                                        border: "1px solid #cbd5e1",
                                        fontSize: "13px",
                                        background: "white"
                                    }}
                                >
                                    <option value="eligible">Allocated Hostel Students</option>
                                    <option value="all">All Registered Students</option>
                                </select>
                            </div>
                        </div>

                        <table className="assignfees-table">
                            <thead>
                                <tr>
                                    <th width="40">
                                        <input
                                            type="checkbox"
                                            onChange={handleSelectAll}
                                            checked={assignableStudents.length > 0 && selectedStudents.length === assignableStudents.length}
                                        />
                                    </th>
                                    <th>ID</th>
                                    <th>Student Name</th>
                                    <th>Course / College</th>
                                    <th>Room / Bed</th>
                                    <th>Current Semester Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredStudents.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" style={{ textAlign: "center", padding: "30px", color: "#64748b" }}>
                                            No eligible students found matching the criteria.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredStudents.map((s) => {
                                        const isAlreadyAssigned = Boolean(s.existing_invoice_id);
                                        const isSelected = selectedStudents.includes(s.id);

                                        return (
                                            <tr key={s.id} style={{ opacity: isAlreadyAssigned ? 0.6 : 1 }}>
                                                <td>
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        disabled={isAlreadyAssigned}
                                                        onChange={() => handleToggleStudent(s.id)}
                                                    />
                                                </td>
                                                <td><strong>#{s.id}</strong></td>
                                                <td>
                                                    <strong>{s.name}</strong>
                                                    <br />
                                                    <small style={{ color: "#64748b" }}>{s.email}</small>
                                                </td>
                                                <td>
                                                    {s.course || "—"}
                                                    <br />
                                                    <small style={{ color: "#64748b" }}>{s.college || "—"}</small>
                                                </td>
                                                <td>
                                                    {s.room_no ? `${s.room_no} (Bed ${s.bed_no || 1})` : "Not Allocated"}
                                                </td>
                                                <td>
                                                    {isAlreadyAssigned ? (
                                                        <span className="assignfees-status-pill already-assigned">
                                                            Already Assigned ({s.existing_invoice_no})
                                                        </span>
                                                    ) : (
                                                        <span className="assignfees-status-pill available">
                                                            Ready to Assign
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>

                        {/* SUBMISSION PREVIEW BAR */}
                        <div className="assignfees-preview-bar">
                            <div className="assignfees-preview-info">
                                <span>Selected Students: {selectedStudents.length}</span>
                                <strong>Total Batch Fee: ₹{(selectedStudents.length * feeAmount).toLocaleString("en-IN")}</strong>
                            </div>

                            <button
                                type="submit"
                                className="assignfees-submit-btn"
                                disabled={submitting || selectedStudents.length === 0}
                            >
                                {submitting ? "Assigning Fees..." : `Confirm & Publish Fees to ${selectedStudents.length} Student(s)`}
                            </button>
                        </div>
                    </div>
                </form>
            </main>
        </div>
    );
}

export default AssignFees;

