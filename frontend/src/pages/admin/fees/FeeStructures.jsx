import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./FeeStructures.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const DEFAULT_INITIAL_CHARGES = [
    { charge_name: "Accommodation Charges", amount: 25000, is_active: 1 },
    { charge_name: "Mess Charges", amount: 15000, is_active: 1 },
    { charge_name: "Maintenance Charges", amount: 2000, is_active: 1 },
    { charge_name: "Light Bill", amount: 3000, is_active: 1 }
];

function FeeStructures() {
    const navigate = useNavigate();

    const [structures, setStructures] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        title: "",
        academic_year: "2026-2027",
        semester: "Semester 1",
        description: "",
        is_active: 1,
        charges: DEFAULT_INITIAL_CHARGES
    });

    useEffect(() => {
        fetchStructures();
    }, []);

    const fetchStructures = async () => {
        const token = localStorage.getItem("adminToken");
        if (!token) return navigate("/admin/login", { replace: true });

        try {
            setLoading(true);
            setError("");
            const res = await fetch(`${API_URL}/api/admin/fees/structures`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                setError(data.message || "Failed to fetch fee structures.");
                return;
            }
            setStructures(data.structures || []);
        } catch (err) {
            setError("Cannot connect to server.");
        } finally {
            setLoading(false);
        }
    };

    const handleOpenCreateModal = () => {
        setEditingId(null);
        setFormData({
            title: "Standard Hostel Semester Fee",
            academic_year: "2026-2027",
            semester: "Semester 1",
            description: "Covers accommodation, mess, maintenance, and utility charges.",
            is_active: 1,
            charges: [...DEFAULT_INITIAL_CHARGES]
        });
        setModalOpen(true);
    };

    const handleOpenEditModal = (structure) => {
        setEditingId(structure.id);
        setFormData({
            title: structure.title,
            academic_year: structure.academic_year,
            semester: structure.semester,
            description: structure.description || "",
            is_active: structure.is_active,
            charges: structure.charges && structure.charges.length > 0
                ? structure.charges.map(c => ({ ...c }))
                : [...DEFAULT_INITIAL_CHARGES]
        });
        setModalOpen(true);
    };

    const handleChargeChange = (index, field, value) => {
        const updated = [...formData.charges];
        updated[index][field] = value;
        setFormData({ ...formData, charges: updated });
    };

    const handleAddCharge = () => {
        setFormData({
            ...formData,
            charges: [...formData.charges, { charge_name: "", amount: 0, is_active: 1 }]
        });
    };

    const handleRemoveCharge = (index) => {
        if (formData.charges.length <= 1) return;
        const updated = formData.charges.filter((_, i) => i !== index);
        setFormData({ ...formData, charges: updated });
    };

    const calculateTotal = () => {
        return formData.charges.reduce((sum, c) => {
            if (c.is_active !== false && c.is_active !== 0) {
                return sum + Number(c.amount || 0);
            }
            return sum;
        }, 0);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem("adminToken");
        if (!token) return navigate("/admin/login", { replace: true });

        if (!formData.title.trim() || !formData.academic_year || !formData.semester) {
            setError("Please fill all required fields.");
            return;
        }

        try {
            setError("");
            const url = editingId
                ? `${API_URL}/api/admin/fees/structures/${editingId}`
                : `${API_URL}/api/admin/fees/structures`;
            const method = editingId ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                setError(data.message || "Failed to save fee structure.");
                return;
            }

            setSuccessMessage(data.message || "Fee structure saved successfully.");
            setModalOpen(false);
            fetchStructures();
            setTimeout(() => setSuccessMessage(""), 4000);
        } catch (err) {
            setError("Cannot connect to server.");
        }
    };

    const handleToggleStatus = async (id) => {
        const token = localStorage.getItem("adminToken");
        if (!token) return navigate("/admin/login", { replace: true });

        try {
            const res = await fetch(`${API_URL}/api/admin/fees/structures/${id}/status`, {
                method: "PATCH",
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok && data.success) {
                fetchStructures();
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("adminToken");
        localStorage.removeItem("admin");
        navigate("/admin/login", { replace: true });
    };

    return (
        <div className="feestructures-page">
            {/* SIDEBAR */}
            <aside className="feestructures-sidebar">
                <div className="feestructures-brand">
                    <div className="feestructures-brand-icon">🏠</div>
                    <div>
                        <strong>Hostel</strong>
                        <span>Admin Panel</span>
                    </div>
                </div>

                <nav className="feestructures-nav">
                    <button onClick={() => navigate("/admin/dashboard")}>📊 Dashboard</button>
                    <button onClick={() => navigate("/admin/students")}>🎓 Students</button>
                    <button onClick={() => navigate("/admin/rooms")}>🛏️ Rooms</button>
                    <button className="active" onClick={() => navigate("/admin/fees")}>💰 Fees</button>
                    <button onClick={() => navigate("/admin/profile")}>👤 Profile</button>
                </nav>

                <button className="feestructures-logout" onClick={handleLogout}>
                    🚪 Logout
                </button>
            </aside>

            {/* MAIN */}
            <main className="feestructures-main">
                <header className="feestructures-header">
                    <div>
                        <span className="eyebrow">FEES MANAGEMENT</span>
                        <h1>Fee Structures</h1>
                        <p>Configure semester charges, add new charge items, and manage fee amounts.</p>
                    </div>

                    <div style={{ display: "flex", gap: "10px" }}>
                        <button className="feestructures-create-btn" onClick={handleOpenCreateModal}>
                            + Create Fee Structure
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
                        ✓ {successMessage}
                    </div>
                )}

                {error && (
                    <div style={{ background: "#fee2e2", color: "#b91c1c", padding: "12px 18px", borderRadius: "8px", marginBottom: "20px", fontWeight: "600", border: "1px solid #fecaca" }}>
                        ⚠️ {error}
                    </div>
                )}

                {/* FEE STRUCTURES LIST */}
                <div className="feestructures-card">
                    <h2 style={{ fontSize: "18px", margin: "0 0 18px", color: "#0f172a" }}>
                        Active & Historical Fee Structures
                    </h2>

                    {loading ? (
                        <p style={{ color: "#64748b" }}>Loading fee structures...</p>
                    ) : structures.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "40px" }}>
                            <p style={{ color: "#64748b" }}>No fee structures found. Click "+ Create Fee Structure" to add one.</p>
                        </div>
                    ) : (
                        <div className="feestructures-grid">
                            {structures.map((s) => (
                                <div key={s.id} className="feestructure-item">
                                    <div>
                                        <div className="feestructure-item-top">
                                            <div>
                                                <h3 style={{ margin: "0 0 4px", fontSize: "16px", color: "#0f172a" }}>
                                                    {s.title}
                                                </h3>
                                                <small style={{ color: "#64748b", fontWeight: "600" }}>
                                                    {s.semester} • {s.academic_year}
                                                </small>
                                            </div>
                                            <span className={`feestructure-badge ${s.is_active ? "active" : "inactive"}`}>
                                                {s.is_active ? "Active" : "Inactive"}
                                            </span>
                                        </div>

                                        <p style={{ margin: "6px 0 12px", fontSize: "12px", color: "#64748b", lineHeight: "1.4" }}>
                                            {s.description || "Standard semester charges breakdown."}
                                        </p>

                                        <div className="feestructure-charges-list">
                                            {Array.isArray(s.charges) && s.charges.map((c, i) => (
                                                <div key={i} className="feestructure-charge-row">
                                                    <span>{c.charge_name}</span>
                                                    <strong>₹{Number(c.amount).toLocaleString("en-IN")}</strong>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="feestructure-total-row">
                                            <span>Calculated Total</span>
                                            <span className="feestructure-total-amount">
                                                ₹{Number(s.total_amount).toLocaleString("en-IN")}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="feestructure-actions">
                                        <button className="feestructure-btn primary" onClick={() => navigate(`/admin/fees/assign?structureId=${s.id}`)}>
                                            Assign Fees →
                                        </button>
                                        <button className="feestructure-btn" onClick={() => handleOpenEditModal(s)}>
                                            Edit Structure
                                        </button>
                                        <button className="feestructure-btn" onClick={() => handleToggleStatus(s.id)}>
                                            {s.is_active ? "Deactivate" : "Activate"}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {/* CREATE / EDIT MODAL */}
            {modalOpen && (
                <div className="feestructures-modal-overlay">
                    <div className="feestructures-modal">
                        <div className="feestructures-modal-header">
                            <h2>{editingId ? "Edit Fee Structure" : "Create New Fee Structure"}</h2>
                            <button className="feestructures-close-btn" onClick={() => setModalOpen(false)}>×</button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="feestructures-form-group">
                                <label>Structure Title *</label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    placeholder="e.g. Standard Hostel Semester Fee"
                                    required
                                />
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                                <div className="feestructures-form-group">
                                    <label>Academic Year *</label>
                                    <select
                                        value={formData.academic_year}
                                        onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })}
                                    >
                                        <option value="2026-2027">2026-2027</option>
                                        <option value="2025-2026">2025-2026</option>
                                        <option value="2027-2028">2027-2028</option>
                                    </select>
                                </div>

                                <div className="feestructures-form-group">
                                    <label>Semester *</label>
                                    <select
                                        value={formData.semester}
                                        onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                                    >
                                        <option value="Semester 1">Semester 1</option>
                                        <option value="Semester 2">Semester 2</option>
                                        <option value="Semester 3">Semester 3</option>
                                        <option value="Semester 4">Semester 4</option>
                                        <option value="Semester 5">Semester 5</option>
                                        <option value="Semester 6">Semester 6</option>
                                        <option value="Semester 7">Semester 7</option>
                                        <option value="Semester 8">Semester 8</option>
                                    </select>
                                </div>
                            </div>

                            <div className="feestructures-form-group">
                                <label>Description</label>
                                <textarea
                                    rows="2"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Optional notes regarding this fee structure..."
                                />
                            </div>

                            {/* DYNAMIC CHARGES REPEATER */}
                            <div className="feestructures-form-group">
                                <label>Itemized Charges (Calculates Total Dynamically) *</label>
                                <div className="feestructures-charges-repeater">
                                    {formData.charges.map((charge, index) => (
                                        <div key={index} className="feestructures-repeater-row">
                                            <input
                                                type="text"
                                                value={charge.charge_name}
                                                onChange={(e) => handleChargeChange(index, "charge_name", e.target.value)}
                                                placeholder="Charge Name (e.g. Mess Charges)"
                                                required
                                            />
                                            <input
                                                type="number"
                                                min="0"
                                                step="500"
                                                value={charge.amount}
                                                onChange={(e) => handleChargeChange(index, "amount", e.target.value)}
                                                placeholder="Amount (₹)"
                                                required
                                            />
                                            <button
                                                type="button"
                                                className="feestructures-remove-charge"
                                                onClick={() => handleRemoveCharge(index)}
                                                title="Remove charge"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}

                                    <button
                                        type="button"
                                        className="feestructures-add-charge-btn"
                                        onClick={handleAddCharge}
                                    >
                                        + Add Another Charge
                                    </button>
                                </div>
                            </div>

                            {/* DYNAMIC TOTAL PREVIEW */}
                            <div className="feestructures-calculated-total">
                                <span>Calculated Semester Fee:</span>
                                <strong>₹{calculateTotal().toLocaleString("en-IN")}</strong>
                            </div>

                            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                                <button
                                    type="button"
                                    style={{
                                        padding: "10px 18px",
                                        borderRadius: "8px",
                                        border: "1px solid #cbd5e1",
                                        background: "#ffffff",
                                        cursor: "pointer",
                                        fontSize: "13px",
                                        fontWeight: "600"
                                    }}
                                    onClick={() => setModalOpen(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    style={{
                                        padding: "10px 22px",
                                        borderRadius: "8px",
                                        border: "none",
                                        background: "#0f766e",
                                        color: "white",
                                        cursor: "pointer",
                                        fontSize: "13px",
                                        fontWeight: "700"
                                    }}
                                >
                                    {editingId ? "Save Changes" : "Create Structure"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default FeeStructures;

