import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./MyCricketBookings.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

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

function MyCricketBookings() {
    const navigate = useNavigate();

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const sidebarRef = useRef(null);
    const mobileMenuButtonRef = useRef(null);

    useEffect(() => {
        document.body.classList.toggle("mycricketbookings-menu-open", sidebarOpen);
        return () => {
            document.body.classList.remove("mycricketbookings-menu-open");
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
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    let student = {};

    try {
        student = JSON.parse(localStorage.getItem("student") || "{}");
    } catch {
        student = {};
    }

    const token =
        localStorage.getItem("token") ||
        localStorage.getItem("studentToken");

    const studentPhoto = getPhotoUrl(
        student.photo ||
            student.profile_photo ||
            student.student_photo ||
            student.image
    );

    useEffect(() => {
        fetchBookings();
    }, []);

    const fetchBookings = async () => {
        try {
            setLoading(true);
            setError("");

            const response = await fetch(
                `${API_URL}/api/student/cricket/bookings`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message || "Unable to load bookings"
                );
            }

            const bookingList = Array.isArray(data)
                ? data
                : data.bookings || data.data || [];

            setBookings(bookingList);
        } catch (err) {
            setError(
                err.message || "Unable to load cricket bookings"
            );
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("studentToken");
        localStorage.removeItem("student");

        navigate("/student/login");
    };

    const goTo = (path) => {
        setSidebarOpen(false);
        navigate(path);
    };

    const formatDate = (date) => {
        if (!date) return "-";

        return new Date(`${date}T00:00:00`).toLocaleDateString(
            "en-IN",
            {
                day: "2-digit",
                month: "short",
                year: "numeric",
            }
        );
    };

    const formatTime = (time) => {
        if (!time) return "-";
        return String(time).slice(0, 5);
    };

    const getStatusClass = (status) => {
        const value = String(status || "")
            .toLowerCase()
            .replace(/\s+/g, "-");

        if (
            value.includes("confirm") ||
            value.includes("complete") ||
            value.includes("paid")
        ) {
            return "status-success";
        }

        if (
            value.includes("reject") ||
            value.includes("cancel")
        ) {
            return "status-danger";
        }

        return "status-pending";
    };

    return (
        <div className="mycricketbookings-page">
            {/* MOBILE HEADER */}
            <header className="mycricketbookings-mobile-header">
                <div className="mycricketbookings-mobile-left">
                    <button
                        ref={mobileMenuButtonRef}
                        type="button"
                        className="mycricketbookings-mobile-menu"
                        onClick={() => setSidebarOpen((prev) => !prev)}
                        aria-label={sidebarOpen ? "Close student menu" : "Open student menu"}
                    >
                        ☰
                    </button>
                    <div className="mycricketbookings-mobile-brand">
                        <div className="mycricketbookings-mobile-brand-icon">🏠</div>
                        <div>
                            <strong>Hostel</strong>
                            <span>Student Portal</span>
                        </div>
                    </div>
                </div>

                <button
                    type="button"
                    className="mycricketbookings-mobile-photo"
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
                className={`mycricketbookings-sidebar ${
                    sidebarOpen ? "mobile-open" : ""
                }`}
            >
                <div className="mycricketbookings-sidebar-brand">
                    <div className="mycricketbookings-brand-icon">🏠</div>
                    <div>
                        <strong>Hostel</strong>
                        <span>Student Portal</span>
                    </div>
                </div>

                <nav className="mycricketbookings-sidebar-nav">
                    <button type="button" className="mycricketbookings-nav-item" onClick={() => goTo("/student/dashboard")}>
                        <span>📊</span>
                        <span>Dashboard</span>
                    </button>
                    <button type="button" className="mycricketbookings-nav-item" onClick={() => goTo("/student/profile")}>
                        <span>👤</span>
                        <span>My Profile</span>
                    </button>
                    <button type="button" className="mycricketbookings-nav-item" onClick={() => goTo("/student/room")}>
                        <span>🛏️</span>
                        <span>My Room</span>
                    </button>
                    <button type="button" className="mycricketbookings-nav-item" onClick={() => goTo("/student/leave")}>
                        <span>📄</span>
                        <span>My Leave</span>
                    </button>
                    <button type="button" className="mycricketbookings-nav-item" onClick={() => goTo("/student/leave/apply")}>
                        <span>➕</span>
                        <span>Apply Leave</span>
                    </button>
                    <button type="button" className="mycricketbookings-nav-item" onClick={() => goTo("/student/gatepass")}>
                        <span>🎫</span>
                        <span>Gate Pass</span>
                    </button>
                    <button type="button" className="mycricketbookings-nav-item" onClick={() => goTo("/student/complaints")}>
                        <span>🛠️</span>
                        <span>Complaints</span>
                    </button>
                    <button type="button" className="mycricketbookings-nav-item" onClick={() => goTo("/student/fees")}>
                        <span>💰</span>
                        <span>My Fees</span>
                    </button>
                    <button type="button" className="mycricketbookings-nav-item" onClick={() => goTo("/student/notifications")}>
                        <span>🔔</span>
                        <span>Notifications</span>
                    </button>
                    <button type="button" className="mycricketbookings-nav-item active" onClick={() => goTo("/student/cricketbox")}>
                        <span>🏏</span>
                        <span>Cricket Box</span>
                    </button>
                </nav>

                <button type="button" className="mycricketbookings-logout" onClick={handleLogout}>
                    <span>🚪</span>
                    <span>Logout</span>
                </button>
            </aside>

            {/* MOBILE OVERLAY */}
            {sidebarOpen && (
                <div
                    className="mycricketbookings-mobile-overlay"
                    onPointerDown={() => setSidebarOpen(false)}
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* MAIN */}
            <div className="mycricketbookings-main">
                <header className="mycricketbookings-topbar">
                    <div className="mycricketbookings-heading">
                        <span className="mycricketbookings-eyebrow">CRICKET FACILITIES</span>
                        <h1>My Cricket Bookings</h1>
                        <p>View, manage and track your hostel cricket box reservations.</p>
                    </div>

                    <div className="mycricketbookings-desktop-actions">
                        <button
                            type="button"
                            className="new-cricket-booking"
                            onClick={() => navigate("/student/cricketbox")}
                        >
                            + New Booking
                        </button>

                        <div className="mycricketbookings-desktop-photo">
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

                <main className="mycricketbookings-content">

                    {error && (
                        <div className="mycricketbookings-error">
                            ⚠️ {error}
                        </div>
                    )}

                    {loading ? (
                        <div className="mycricketbookings-loading">
                            <div className="booking-spinner" />
                            <span>Loading bookings...</span>
                        </div>
                    ) : bookings.length === 0 ? (
                        <div className="mycricketbookings-empty">
                            <div className="empty-cricket-icon">
                                🏏
                            </div>

                            <h3>No Cricket Bookings</h3>

                            <p>
                                You haven't made any cricket box
                                bookings yet.
                            </p>

                            <button
                                onClick={() =>
                                    navigate(
                                        "/student/cricketbox"
                                    )
                                }
                            >
                                Book Cricket Box
                            </button>
                        </div>
                    ) : (
                        <div className="mycricketbookings-table-card">
                            <div className="mycricketbookings-table-header">
                                <div>
                                    <h3>Booking History</h3>
                                    <span>
                                        {bookings.length} booking
                                        {bookings.length !== 1
                                            ? "s"
                                            : ""}
                                    </span>
                                </div>
                            </div>

                            <div className="mycricketbookings-table-wrapper">
                                <table className="mycricketbookings-table">
                                    <thead>
                                        <tr>
                                            <th>Booking ID</th>
                                            <th>Ground</th>
                                            <th>Date</th>
                                            <th>Time Slot</th>
                                            <th>Amount</th>
                                            <th>Payment</th>
                                            <th>Status</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {bookings.map(
                                            (booking) => (
                                                <tr
                                                    key={
                                                        booking.id
                                                    }
                                                >
                                                    <td>
                                                        <strong>
                                                            #
                                                            {
                                                                booking.id
                                                            }
                                                        </strong>
                                                    </td>

                                                    <td>
                                                        <div className="ground-name">
                                                            {booking.ground_name ||
                                                                booking.ground ||
                                                                "-"}
                                                        </div>
                                                    </td>

                                                    <td>
                                                        {formatDate(
                                                            booking.booking_date
                                                        )}
                                                    </td>

                                                    <td>
                                                        <span className="time-slot">
                                                            {formatTime(
                                                                booking.start_time
                                                            )}{" "}
                                                            -{" "}
                                                            {formatTime(
                                                                booking.end_time
                                                            )}
                                                        </span>
                                                    </td>

                                                    <td>
                                                        <strong>
                                                            ₹
                                                            {Number(
                                                                booking.total_amount ||
                                                                    0
                                                            ).toFixed(
                                                                2
                                                            )}
                                                        </strong>
                                                    </td>

                                                    <td>
                                                        <span
                                                            className={`booking-status ${getStatusClass(
                                                                booking.payment_status
                                                            )}`}
                                                        >
                                                            {booking.payment_status ||
                                                                "Pending"}
                                                        </span>
                                                    </td>

                                                    <td>
                                                        <span
                                                            className={`booking-status ${getStatusClass(
                                                                booking.booking_status
                                                            )}`}
                                                        >
                                                            {booking.booking_status ||
                                                                "Pending"}
                                                        </span>
                                                    </td>

                                                    <td>
                                                        <button
                                                            className="view-booking-btn"
                                                            onClick={() =>
                                                                navigate(
                                                                    `/student/cricket-box/bookings/${booking.id}`
                                                                )
                                                            }
                                                        >
                                                            View
                                                        </button>
                                                    </td>
                                                </tr>
                                            )
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="mycricketbookings-mobile-list">
                                {bookings.map(
                                    (booking) => (
                                        <div
                                            className="mobile-booking-card"
                                            key={booking.id}
                                        >
                                            <div className="mobile-booking-top">
                                                <strong>
                                                    Booking #
                                                    {
                                                        booking.id
                                                    }
                                                </strong>

                                                <span
                                                    className={`booking-status ${getStatusClass(
                                                        booking.booking_status
                                                    )}`}
                                                >
                                                    {booking.booking_status ||
                                                        "Pending"}
                                                </span>
                                            </div>

                                            <div className="mobile-booking-details">
                                                <div>
                                                    <span>
                                                        Ground
                                                    </span>
                                                    <strong>
                                                        {booking.ground_name ||
                                                            booking.ground ||
                                                            "-"}
                                                    </strong>
                                                </div>

                                                <div>
                                                    <span>
                                                        Date
                                                    </span>
                                                    <strong>
                                                        {formatDate(
                                                            booking.booking_date
                                                        )}
                                                    </strong>
                                                </div>

                                                <div>
                                                    <span>
                                                        Time
                                                    </span>
                                                    <strong>
                                                        {formatTime(
                                                            booking.start_time
                                                        )}{" "}
                                                        -{" "}
                                                        {formatTime(
                                                            booking.end_time
                                                        )}
                                                    </strong>
                                                </div>

                                                <div>
                                                    <span>
                                                        Amount
                                                    </span>
                                                    <strong>
                                                        ₹
                                                        {Number(
                                                            booking.total_amount ||
                                                                0
                                                        ).toFixed(
                                                            2
                                                        )}
                                                    </strong>
                                                </div>
                                            </div>

                                            <button
                                                className="mobile-view-booking"
                                                onClick={() =>
                                                    navigate(
                                                        `/student/cricket-box/bookings/${booking.id}`
                                                    )
                                                }
                                            >
                                                View Booking →
                                            </button>
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}

export default MyCricketBookings;