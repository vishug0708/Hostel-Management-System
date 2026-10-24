import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./EditProfile.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const EditProfile = () => {
    const navigate = useNavigate();

    const [student, setStudent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [photoPreview, setPhotoPreview] = useState("");
    const [menuOpen, setMenuOpen] = useState(false);

    const sidebarRef = useRef(null);
    const mobileMenuButtonRef = useRef(null);

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        mobile: "",
        photo: null
    });

    useEffect(() => {
        document.body.classList.toggle(
            "editprofile-menu-open",
            menuOpen
        );

        return () => {
            document.body.classList.remove("editprofile-menu-open");
        };
    }, [menuOpen]);

    useEffect(() => {
        if (!menuOpen) {
            return;
        }

        const handleOutsidePointer = (event) => {
            const sidebar = sidebarRef.current;
            const menuButton = mobileMenuButtonRef.current;

            if (
                sidebar &&
                !sidebar.contains(event.target) &&
                menuButton &&
                !menuButton.contains(event.target)
            ) {
                setMenuOpen(false);
            }
        };

        document.addEventListener(
            "pointerdown",
            handleOutsidePointer,
            true
        );

        return () => {
            document.removeEventListener(
                "pointerdown",
                handleOutsidePointer,
                true
            );
            document.body.classList.remove("editprofile-menu-open");
        };
    }, [menuOpen]);

    const getStudentId = () => {
        const studentData = localStorage.getItem("student");

        if (studentData) {
            try {
                const parsed = JSON.parse(studentData);
                return parsed?.id || null;
            } catch (err) {
                console.error("Invalid student data:", err);
            }
        }

        return (
            localStorage.getItem("studentId") ||
            localStorage.getItem("student_id")
        );
    };

    const studentId = getStudentId();

    useEffect(() => {
        const savedStudent = localStorage.getItem("student");

        if (savedStudent) {
            try {
                setStudent(JSON.parse(savedStudent));
            } catch (err) {
                console.error("Invalid saved student data:", err);
            }
        }

        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            setLoading(true);
            setError("");

            if (!studentId) {
                setError("Student session not found. Please login again.");
                setLoading(false);
                return;
            }

            const token = localStorage.getItem("studentToken");
            const response = await fetch(
                `${API_URL}/api/student/profile/${studentId}`,
                {
                    headers: {
                        ...(token ? { Authorization: `Bearer ${token}` } : {})
                    }
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || "Failed to fetch profile."
                );
            }

            const profile = data.student;
            setStudent(profile);

            setFormData({
                name: profile.name || "",
                email: profile.email || "",
                mobile: profile.mobile || "",
                photo: null
            });

            if (profile.photo) {
                const photo = String(profile.photo).trim();
                if (
                    photo.startsWith("data:") ||
                    photo.startsWith("blob:") ||
                    photo.startsWith("http://") ||
                    photo.startsWith("https://")
                ) {
                    setPhotoPreview(photo);
                } else {
                    const normalizedPhoto = photo.replace(/^\/+/, "");
                    if (normalizedPhoto.startsWith("uploads/")) {
                        setPhotoPreview(`${API_URL}/${normalizedPhoto}`);
                    } else {
                        setPhotoPreview(`${API_URL}/uploads/students/${normalizedPhoto}`);
                    }
                }
            }
        } catch (err) {
            console.error("Edit Profile Error:", err);
            setError(err.message || "Failed to fetch profile.");
        } finally {
            setLoading(false);
        }
    };

    const getProfilePhoto = () => {
        if (!student?.photo) {
            return "";
        }

        const photo = String(student.photo).trim();

        if (
            photo.startsWith("data:") ||
            photo.startsWith("blob:") ||
            photo.startsWith("http://") ||
            photo.startsWith("https://")
        ) {
            return photo;
        }

        const normalizedPhoto = photo.replace(/^\/+/, "");

        if (normalizedPhoto.startsWith("uploads/")) {
            return `${API_URL}/${normalizedPhoto}`;
        }

        return `${API_URL}/uploads/students/${normalizedPhoto}`;
    };

    const profilePhoto = photoPreview || getProfilePhoto();

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value
        }));
    };

    const handlePhotoChange = (e) => {
        const file = e.target.files[0];

        if (!file) {
            return;
        }

        if (!file.type.startsWith("image/")) {
            setError("Please select a valid image file.");
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setError("Photo size must be less than 5 MB.");
            return;
        }

        setError("");

        setFormData((prev) => ({
            ...prev,
            photo: file
        }));

        setPhotoPreview(URL.createObjectURL(file));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            setSaving(true);
            setError("");
            setSuccess("");

            if (!studentId) {
                setError("Student session not found. Please login again.");
                return;
            }

            if (!formData.name.trim()) {
                setError("Name is required.");
                return;
            }

            if (!formData.email.trim()) {
                setError("Email is required.");
                return;
            }

            if (!formData.mobile.trim()) {
                setError("Mobile number is required.");
                return;
            }

            const body = new FormData();
            body.append("name", formData.name.trim());
            body.append("email", formData.email.trim());
            body.append("mobile", formData.mobile.trim());

            if (formData.photo) {
                body.append("photo", formData.photo);
            }

            const token = localStorage.getItem("studentToken");
            const response = await fetch(
                `${API_URL}/api/student/profile/${studentId}`,
                {
                    method: "PUT",
                    headers: {
                        ...(token ? { Authorization: `Bearer ${token}` } : {})
                    },
                    body
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || "Failed to update profile."
                );
            }

            setStudent(data.student);

            if (data.student?.photo) {
                const photo = String(data.student.photo).trim();
                if (
                    photo.startsWith("data:") ||
                    photo.startsWith("blob:") ||
                    photo.startsWith("http://") ||
                    photo.startsWith("https://")
                ) {
                    setPhotoPreview(photo);
                } else {
                    const normalizedPhoto = photo.replace(/^\/+/, "");
                    if (normalizedPhoto.startsWith("uploads/")) {
                        setPhotoPreview(`${API_URL}/${normalizedPhoto}`);
                    } else {
                        setPhotoPreview(`${API_URL}/uploads/students/${normalizedPhoto}`);
                    }
                }
            }

            const oldStudentData = localStorage.getItem("student");
            if (oldStudentData) {
                try {
                    const oldStudent = JSON.parse(oldStudentData);
                    localStorage.setItem(
                        "student",
                        JSON.stringify({
                            ...oldStudent,
                            ...data.student
                        })
                    );
                } catch (err) {
                    console.error("Failed to update local student data:", err);
                }
            }

            setFormData((prev) => ({
                ...prev,
                photo: null
            }));

            setSuccess("Profile updated successfully.");

            setTimeout(() => {
                navigate("/student/profile");
            }, 1200);
        } catch (err) {
            console.error("Update Profile Error:", err);
            setError(err.message || "Failed to update profile.");
        } finally {
            setSaving(false);
        }
    };

    const handleNavigation = (path) => {
        setMenuOpen(false);
        navigate(path);
    };

    const handleLogout = () => {
        setMenuOpen(false);
        localStorage.removeItem("studentId");
        localStorage.removeItem("student_id");
        localStorage.removeItem("student");
        localStorage.removeItem("studentToken");

        navigate("/student/login", {
            replace: true
        });
    };

    const getInitials = () => {
        if (!formData.name) {
            return "S";
        }

        return formData.name
            .split(" ")
            .map((word) => word.charAt(0))
            .join("")
            .substring(0, 2)
            .toUpperCase();
    };

    if (loading) {
        return (
            <div className="editprofile-page">

                {/* =========================
                    MOBILE HEADER
                ========================= */}
                <header className="editprofile-mobile-header">
                    <div className="editprofile-mobile-left">
                        <button
                            ref={mobileMenuButtonRef}
                            type="button"
                            className="editprofile-mobile-menu"
                            onClick={() => setMenuOpen((open) => !open)}
                            aria-label={
                                menuOpen
                                    ? "Close student menu"
                                    : "Open student menu"
                            }
                        >
                            ☰
                        </button>

                        <div className="editprofile-mobile-brand">
                            <div className="editprofile-mobile-brand-icon">
                                🏠
                            </div>
                            <div>
                                <strong>Hostel</strong>
                                <span>Student Portal</span>
                            </div>
                        </div>
                    </div>

                    <button
                        type="button"
                        className="editprofile-mobile-photo"
                        onClick={() => navigate("/student/profile")}
                        aria-label="Open student profile"
                    >
                        {profilePhoto ? (
                            <img
                                src={profilePhoto}
                                alt="Student profile"
                                onError={(event) => {
                                    event.currentTarget.style.display = "none";
                                }}
                            />
                        ) : (
                            "👤"
                        )}
                    </button>
                </header>

                {/* =========================
                    SIDEBAR
                ========================= */}
                <aside
                    ref={sidebarRef}
                    className={`editprofile-sidebar ${menuOpen ? "mobile-open" : ""}`}
                >
                    <div className="editprofile-sidebar-brand">
                        <div className="editprofile-brand-icon">
                            🏠
                        </div>
                        <div>
                            <strong>Hostel</strong>
                            <span>Student Portal</span>
                        </div>
                    </div>

                    <nav className="editprofile-sidebar-nav">
                        <button
                            type="button"
                            className="editprofile-nav-item"
                            onClick={() => handleNavigation("/student/dashboard")}
                        >
                            <span>📊</span>
                            Dashboard
                        </button>

                        <button
                            type="button"
                            className="editprofile-nav-item active"
                            onClick={() => handleNavigation("/student/profile")}
                        >
                            <span>👤</span>
                            My Profile
                        </button>

                        <button
                            type="button"
                            className="editprofile-nav-item"
                            onClick={() => handleNavigation("/student/room")}
                        >
                            <span>🛏️</span>
                            My Room
                        </button>

                        <button
                            type="button"
                            className="editprofile-nav-item"
                            onClick={() => handleNavigation("/student/leave")}
                        >
                            <span>📄</span>
                            My Leave
                        </button>

                        <button
                            type="button"
                            className="editprofile-nav-item"
                            onClick={() => handleNavigation("/student/leave/apply")}
                        >
                            <span>➕</span>
                            Apply Leave
                        </button>

                        <button
                            type="button"
                            className="editprofile-nav-item"
                            onClick={() => handleNavigation("/student/gatepass")}
                        >
                            <span>🎫</span>
                            Gate Pass
                        </button>

                        <button
                            type="button"
                            className="editprofile-nav-item"
                            onClick={() => handleNavigation("/student/complaints")}
                        >
                            <span>🛠️</span>
                            Complaints
                        </button>

                        <button
                            type="button"
                            className="editprofile-nav-item"
                            onClick={() => handleNavigation("/student/fees")}
                        >
                            <span>💰</span>
                            My Fees
                        </button>

                        <button
                            type="button"
                            className="editprofile-nav-item"
                            onClick={() => handleNavigation("/student/notifications")}
                        >
                            <span>🔔</span>
                            Notifications
                        </button>

                        <button
                            type="button"
                            className="editprofile-nav-item"
                            onClick={() => handleNavigation("/student/cricketbox")}
                        >
                            <span>🏏</span>
                            Cricket Box
                        </button>
                    </nav>

                    <button
                        type="button"
                        className="editprofile-logout"
                        onClick={handleLogout}
                    >
                        <span>🚪</span>
                        Logout
                    </button>
                </aside>

                {/* =========================
                    MOBILE OVERLAY
                ========================= */}
                {menuOpen && (
                    <div
                        className="editprofile-mobile-overlay"
                        onPointerDown={() => setMenuOpen(false)}
                        onClick={() => setMenuOpen(false)}
                    />
                )}

                {/* =========================
                    MAIN
                ========================= */}
                <main className="editprofile-main">
                    <div className="editprofile-desktop-photo">
                        <button
                            type="button"
                            onClick={() => navigate("/student/profile")}
                            aria-label="Open student profile"
                        >
                            {profilePhoto ? (
                                <img
                                    src={profilePhoto}
                                    alt="Student profile"
                                    onError={(event) => {
                                        event.currentTarget.style.display = "none";
                                    }}
                                />
                            ) : (
                                "👤"
                            )}
                        </button>
                    </div>

                    <div className="editprofile-loading">
                        <div className="loading-spinner"></div>
                        <p>Loading profile...</p>
                    </div>
                </main>

            </div>
        );
    }

    return (
        <div className="editprofile-page">

            {/* =========================
                MOBILE HEADER
            ========================= */}
            <header className="editprofile-mobile-header">
                <div className="editprofile-mobile-left">
                    <button
                        ref={mobileMenuButtonRef}
                        type="button"
                        className="editprofile-mobile-menu"
                        onClick={() => setMenuOpen((open) => !open)}
                        aria-label={
                            menuOpen
                                ? "Close student menu"
                                : "Open student menu"
                        }
                    >
                        ☰
                    </button>

                    <div className="editprofile-mobile-brand">
                        <div className="editprofile-mobile-brand-icon">
                            🏠
                        </div>
                        <div>
                            <strong>Hostel</strong>
                            <span>Student Portal</span>
                        </div>
                    </div>
                </div>

                <button
                    type="button"
                    className="editprofile-mobile-photo"
                    onClick={() => navigate("/student/profile")}
                    aria-label="Open student profile"
                >
                    {profilePhoto ? (
                        <img
                            src={profilePhoto}
                            alt="Student profile"
                            onError={(event) => {
                                event.currentTarget.style.display = "none";
                            }}
                        />
                    ) : (
                        "👤"
                    )}
                </button>
            </header>

            {/* =========================
                SIDEBAR
            ========================= */}
            <aside
                ref={sidebarRef}
                className={`editprofile-sidebar ${menuOpen ? "mobile-open" : ""}`}
            >
                <div className="editprofile-sidebar-brand">
                    <div className="editprofile-brand-icon">
                        🏠
                    </div>
                    <div>
                        <strong>Hostel</strong>
                        <span>Student Portal</span>
                    </div>
                </div>

                <nav className="editprofile-sidebar-nav">
                    <button
                        type="button"
                        className="editprofile-nav-item"
                        onClick={() => handleNavigation("/student/dashboard")}
                    >
                        <span>📊</span>
                        Dashboard
                    </button>

                    <button
                        type="button"
                        className="editprofile-nav-item active"
                        onClick={() => handleNavigation("/student/profile")}
                    >
                        <span>👤</span>
                        My Profile
                    </button>

                    <button
                        type="button"
                        className="editprofile-nav-item"
                        onClick={() => handleNavigation("/student/room")}
                    >
                        <span>🛏️</span>
                        My Room
                    </button>

                    <button
                        type="button"
                        className="editprofile-nav-item"
                        onClick={() => handleNavigation("/student/leave")}
                    >
                        <span>📄</span>
                        My Leave
                    </button>

                    <button
                        type="button"
                        className="editprofile-nav-item"
                        onClick={() => handleNavigation("/student/leave/apply")}
                    >
                        <span>➕</span>
                        Apply Leave
                    </button>

                    <button
                        type="button"
                        className="editprofile-nav-item"
                        onClick={() => handleNavigation("/student/gatepass")}
                    >
                        <span>🎫</span>
                        Gate Pass
                    </button>

                    <button
                        type="button"
                        className="editprofile-nav-item"
                        onClick={() => handleNavigation("/student/complaints")}
                    >
                        <span>🛠️</span>
                        Complaints
                    </button>

                    <button
                        type="button"
                        className="editprofile-nav-item"
                        onClick={() => handleNavigation("/student/fees")}
                    >
                        <span>💰</span>
                        My Fees
                    </button>

                    <button
                        type="button"
                        className="editprofile-nav-item"
                        onClick={() => handleNavigation("/student/notifications")}
                    >
                        <span>🔔</span>
                        Notifications
                    </button>

                    <button
                        type="button"
                        className="editprofile-nav-item"
                        onClick={() => handleNavigation("/student/cricketbox")}
                    >
                        <span>🏏</span>
                        Cricket Box
                    </button>
                </nav>

                <button
                    type="button"
                    className="editprofile-logout"
                    onClick={handleLogout}
                >
                    <span>🚪</span>
                    Logout
                </button>
            </aside>

            {/* =========================
                MOBILE OVERLAY
            ========================= */}
            {menuOpen && (
                <div
                    className="editprofile-mobile-overlay"
                    onPointerDown={() => setMenuOpen(false)}
                    onClick={() => setMenuOpen(false)}
                />
            )}

            {/* =========================
                MAIN
            ========================= */}
            <main className="editprofile-main">

                {/* DESKTOP TOP-RIGHT PROFILE PHOTO */}
                <div className="editprofile-desktop-photo">
                    <button
                        type="button"
                        onClick={() => navigate("/student/profile")}
                        aria-label="Open student profile"
                    >
                        {profilePhoto ? (
                            <img
                                src={profilePhoto}
                                alt="Student profile"
                                onError={(event) => {
                                    event.currentTarget.style.display = "none";
                                }}
                            />
                        ) : (
                            "👤"
                        )}
                    </button>
                </div>

                <div className="editprofile-header">
                    <div>
                        <p className="section-label">
                            STUDENT PROFILE
                        </p>
                        <h1>Edit Profile</h1>
                        <p className="page-description">
                            Update your personal information and profile photo.
                        </p>
                    </div>

                    <button
                        className="back-profile-btn"
                        onClick={() => navigate("/student/profile")}
                    >
                        ← Back to Profile
                    </button>
                </div>

                {error && (
                    <div className="profile-alert error">
                        ⚠️
                        <span>{error}</span>
                        <button onClick={() => setError("")}>
                            ×
                        </button>
                    </div>
                )}

                {success && (
                    <div className="profile-alert success">
                        ✅
                        <span>{success}</span>
                    </div>
                )}

                <form
                    className="editprofile-card"
                    onSubmit={handleSubmit}
                >
                    {/* PROFILE PHOTO */}
                    <div className="photo-section">
                        <div className="photo-heading">
                            <p className="section-label">
                                PROFILE PHOTO
                            </p>
                            <h2>Update your photo</h2>
                            <p>
                                Choose a clear photo. Maximum size is 5 MB.
                            </p>
                        </div>

                        <div className="photo-content">
                            <div className="profile-photo-preview">
                                {photoPreview ? (
                                    <img
                                        src={photoPreview}
                                        alt="Student Profile"
                                    />
                                ) : (
                                    <span>
                                        {getInitials()}
                                    </span>
                                )}
                            </div>

                            <div className="photo-actions">
                                <label
                                    htmlFor="photo"
                                    className="choose-photo-btn"
                                >
                                    📷 Choose Photo
                                </label>

                                <input
                                    id="photo"
                                    type="file"
                                    accept="image/*"
                                    onChange={handlePhotoChange}
                                    hidden
                                />

                                <p>
                                    JPG, JPEG, PNG or WEBP
                                </p>

                                {formData.photo && (
                                    <span className="selected-photo">
                                        ✓ {formData.photo.name}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* PERSONAL INFORMATION */}
                    <div className="form-section">
                        <div className="form-section-heading">
                            <p className="section-label">
                                PERSONAL INFORMATION
                            </p>
                            <h2>Basic Details</h2>
                        </div>

                        <div className="form-grid">
                            <div className="form-group full-width">
                                <label htmlFor="name">
                                    Full Name
                                </label>
                                <input
                                    id="name"
                                    name="name"
                                    type="text"
                                    placeholder="Enter your full name"
                                    value={formData.name}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="email">
                                    Email Address
                                </label>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    placeholder="Enter your email"
                                    value={formData.email}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="mobile">
                                    Mobile Number
                                </label>
                                <input
                                    id="mobile"
                                    name="mobile"
                                    type="tel"
                                    maxLength="10"
                                    placeholder="Enter your mobile number"
                                    value={formData.mobile}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>
                    </div>

                    {/* ACTIONS */}
                    <div className="form-actions">
                        <button
                            type="button"
                            className="cancel-btn"
                            onClick={() => navigate("/student/profile")}
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            className="save-profile-btn"
                            disabled={saving}
                        >
                            {saving
                                ? "Saving..."
                                : "✓ Save Changes"}
                        </button>
                    </div>
                </form>

            </main>
        </div>
    );
};

export default EditProfile;
