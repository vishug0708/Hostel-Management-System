import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./CricketBox.css";

const API_URL =
    import.meta.env.VITE_API_URL ||
    "http://localhost:5000";

const getPhotoUrl = (photo) => {
    if (!photo) return "";
    const value = String(photo).trim();
    if (
        value.startsWith("data:") ||
        value.startsWith("blob:") ||
        value.startsWith("http://") ||
        value.startsWith("https://")
    ) {
        return value;
    }
    const normalized = value.replace(/^\/+/, "");
    if (normalized.startsWith("uploads/")) {
        return `${API_URL}/${normalized}`;
    }
    return `${API_URL}/uploads/students/${normalized}`;
};

const getStudent = () => {
    try {
        return JSON.parse(localStorage.getItem("student") || "{}");
    } catch {
        return {};
    }
};

function CricketBox() {
    const navigate = useNavigate();

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const sidebarRef = useRef(null);
    const mobileMenuButtonRef = useRef(null);

    useEffect(() => {
        document.body.classList.toggle("cricketbox-menu-open", sidebarOpen);
        return () => {
            document.body.classList.remove("cricketbox-menu-open");
        };
    }, [sidebarOpen]);

    useEffect(() => {
        if (!sidebarOpen) return;
        const handleOutsidePointer = (event) => {
            const sidebar = sidebarRef.current;
            const menuBtn = mobileMenuButtonRef.current;
            if (sidebar && !sidebar.contains(event.target) && menuBtn && !menuBtn.contains(event.target)) {
                setSidebarOpen(false);
            }
        };
        document.addEventListener("pointerdown", handleOutsidePointer, true);
        return () => document.removeEventListener("pointerdown", handleOutsidePointer, true);
    }, [sidebarOpen]);
    const student = getStudent();
    const studentPhoto = getPhotoUrl(
        student.photo ||
        student.profile_photo ||
        student.student_photo ||
        student.image
    );

    const [grounds, setGrounds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchGrounds = async () => {
            const token =
                localStorage.getItem("studentToken") ||
                localStorage.getItem("token");

            if (!token) {
                navigate("/student/login", {
                    replace: true
                });
                return;
            }

            try {
                setLoading(true);
                setError("");

                const response = await fetch(
                    `${API_URL}/api/student/cricket/grounds`,
                    {
                        method: "GET",
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    }
                );

                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(
                        data.message ||
                        "Unable to load cricket grounds."
                    );
                }

                setGrounds(data.grounds || []);
            } catch (err) {
                console.error(
                    "Cricket Grounds Error:",
                    err
                );

                setError(
                    err.message ||
                    "Unable to load cricket grounds."
                );
            } finally {
                setLoading(false);
            }
        };

        fetchGrounds();
    }, []);

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("studentToken");
        localStorage.removeItem("student");

        navigate("/student/login", {
            replace: true
        });
    };

    const handleBookNow = (groundId) => {
        navigate(
            `/student/cricket-box/book?ground=${groundId}`
        );
    };

    const handleMyBookings = () => {
        navigate("/student/cricket-box/bookings");
    };

    const goTo = (path) => {
        setSidebarOpen(false);
        navigate(path);
    };

    return (
        <div className="cricketbox-page">
            {/* MOBILE HEADER */}
            <header className="cricketbox-mobile-header">
                <div className="cricketbox-mobile-left">
                    <button
                        ref={mobileMenuButtonRef}
                        type="button"
                        className="cricketbox-mobile-menu"
                        onClick={() => setSidebarOpen((prev) => !prev)}
                        aria-label={sidebarOpen ? "Close student menu" : "Open student menu"}
                    >
                        ☰
                    </button>
                    <div className="cricketbox-mobile-brand">
                        <div className="cricketbox-mobile-brand-icon">🏠</div>
                        <div>
                            <strong>Hostel</strong>
                            <span>Student Portal</span>
                        </div>
                    </div>
                </div>

                <button
                    type="button"
                    className="cricketbox-mobile-photo"
                    onClick={() => navigate("/student/profile")}
                    aria-label="Open student profile"
                >
                    {studentPhoto ? (
                        <img
                            src={studentPhoto}
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

            {/* SIDEBAR */}
            <aside
                ref={sidebarRef}
                className={`cricketbox-sidebar ${
                    sidebarOpen ? "mobile-open" : ""
                }`}
            >
                <div className="cricketbox-sidebar-brand">
                    <div className="cricketbox-brand-icon">🏠</div>
                    <div>
                        <strong>Hostel</strong>
                        <span>Student Portal</span>
                    </div>
                </div>

                <nav className="cricketbox-sidebar-nav">
                    <button type="button" className="cricketbox-nav-item" onClick={() => goTo("/student/dashboard")}>
                        <span>📊</span>
                        <span>Dashboard</span>
                    </button>
                    <button type="button" className="cricketbox-nav-item" onClick={() => goTo("/student/profile")}>
                        <span>👤</span>
                        <span>My Profile</span>
                    </button>
                    <button type="button" className="cricketbox-nav-item" onClick={() => goTo("/student/room")}>
                        <span>🛏️</span>
                        <span>My Room</span>
                    </button>
                    <button type="button" className="cricketbox-nav-item" onClick={() => goTo("/student/leave")}>
                        <span>📄</span>
                        <span>My Leave</span>
                    </button>
                    <button type="button" className="cricketbox-nav-item" onClick={() => goTo("/student/leave/apply")}>
                        <span>➕</span>
                        <span>Apply Leave</span>
                    </button>
                    <button type="button" className="cricketbox-nav-item" onClick={() => goTo("/student/gatepass")}>
                        <span>🎫</span>
                        <span>Gate Pass</span>
                    </button>
                    <button type="button" className="cricketbox-nav-item" onClick={() => goTo("/student/complaints")}>
                        <span>🛠️</span>
                        <span>Complaints</span>
                    </button>
                    <button type="button" className="cricketbox-nav-item" onClick={() => goTo("/student/fees")}>
                        <span>💰</span>
                        <span>My Fees</span>
                    </button>
                    <button type="button" className="cricketbox-nav-item" onClick={() => goTo("/student/notifications")}>
                        <span>🔔</span>
                        <span>Notifications</span>
                    </button>
                    <button type="button" className="cricketbox-nav-item active" onClick={() => goTo("/student/cricketbox")}>
                        <span>🏏</span>
                        <span>Cricket Box</span>
                    </button>
                </nav>

                <button type="button" className="cricketbox-logout" onClick={handleLogout}>
                    <span>🚪</span>
                    <span>Logout</span>
                </button>
            </aside>

            {/* MOBILE OVERLAY */}
            {sidebarOpen && (
                <div
                    className="cricketbox-mobile-overlay"
                    onPointerDown={() => setSidebarOpen(false)}
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* MAIN */}
            <main className="cricketbox-main">
                <header className="cricketbox-topbar">
                    <div className="cricketbox-heading">
                        <span className="cricketbox-eyebrow">CRICKET FACILITIES</span>
                        <h1>Cricket Box</h1>
                        <p>View hostel cricket grounds and reserve your playtime.</p>
                    </div>

                    <div className="cricketbox-desktop-actions">
                        <button
                            type="button"
                            className="cricketbox-my-bookings"
                            onClick={handleMyBookings}
                        >
                            📋 My Bookings
                        </button>

                        <div className="cricketbox-desktop-photo">
                            <button
                                type="button"
                                onClick={() => navigate("/student/profile")}
                                aria-label="Open student profile"
                            >
                                {studentPhoto ? (
                                    <img
                                        src={studentPhoto}
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
                    </div>
                </header>

                <section className="cricketbox-content">
                    <div className="cricketbox-section-heading">
                        <div>
                            <span>
                                CRICKET FACILITIES
                            </span>

                            <h2>
                                Available Grounds
                            </h2>
                        </div>

                        <span className="cricketbox-ground-count">
                            {grounds.length} Grounds
                        </span>
                    </div>

                    {/* LOADING */}
                    {loading && (
                        <div className="cricketbox-message">
                            <div className="cricketbox-loader">
                                ⏳
                            </div>

                            <p>
                                Loading cricket grounds...
                            </p>
                        </div>
                    )}

                    {/* ERROR */}
                    {!loading && error && (
                        <div className="cricketbox-error">
                            <span>⚠️</span>

                            <div>
                                <strong>
                                    Unable to load grounds
                                </strong>

                                <p>
                                    {error}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* EMPTY */}
                    {!loading &&
                        !error &&
                        grounds.length === 0 && (
                            <div className="cricketbox-empty">
                                <div>
                                    🏏
                                </div>

                                <h3>
                                    No Cricket Ground Available
                                </h3>

                                <p>
                                    There are currently no
                                    active cricket grounds
                                    available for booking.
                                </p>
                            </div>
                        )}

                    {/* GROUNDS */}
                    {!loading &&
                        !error &&
                        grounds.length > 0 && (
                            <div className="cricketbox-ground-grid">

                                {grounds.map((ground) => (
                                    <article
                                        className="cricketbox-ground-card"
                                        key={ground.id}
                                    >

                                        <div className="cricketbox-ground-icon">
                                            🏏
                                        </div>

                                        <div className="cricketbox-ground-status">
                                            <span></span>
                                            Available
                                        </div>

                                        <div className="cricketbox-ground-info">

                                            <h3>
                                                {ground.name}
                                            </h3>

                                            <p className="cricketbox-location">
                                                📍{" "}
                                                {ground.location ||
                                                    "Location not specified"}
                                            </p>

                                            <p className="cricketbox-description">
                                                {ground.description ||
                                                    "Cricket ground available for student booking."}
                                            </p>

                                        </div>

                                        <div className="cricketbox-ground-details">

                                            <div>
                                                <span>
                                                    CAPACITY
                                                </span>

                                                <strong>
                                                    {ground.capacity ||
                                                        "N/A"}
                                                </strong>
                                            </div>

                                            <div>
                                                <span>
                                                    PRICE / HOUR
                                                </span>

                                                <strong>
                                                    ₹
                                                    {Number(
                                                        ground.price_per_hour ||
                                                        0
                                                    ).toFixed(2)}
                                                </strong>
                                            </div>

                                        </div>

                                        <div className="cricketbox-ground-time">

                                            <div>
                                                <span>
                                                    OPENING
                                                </span>

                                                <strong>
                                                    {ground.opening_time ||
                                                        "N/A"}
                                                </strong>
                                            </div>

                                            <div>
                                                <span>
                                                    CLOSING
                                                </span>

                                                <strong>
                                                    {ground.closing_time ||
                                                        "N/A"}
                                                </strong>
                                            </div>

                                        </div>

                                        <button
                                            className="cricketbox-book-button"
                                            onClick={() =>
                                                handleBookNow(
                                                    ground.id
                                                )
                                            }
                                        >
                                            Book Now
                                            <span>→</span>
                                        </button>

                                    </article>
                                ))}

                            </div>
                        )}

                </section>

                {/* FOOTER */}
                <footer className="cricketbox-footer">
                    <span>
                        © 2026 Hostel Management System
                    </span>

                    <span>
                        Student Portal
                    </span>
                </footer>

            </main>

        </div>
    );
}

export default CricketBox;