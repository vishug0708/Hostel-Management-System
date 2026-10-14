-- =========================================================
-- HOSTEL MANAGEMENT SYSTEM
-- React + Node.js + MySQL
-- =========================================================

CREATE DATABASE IF NOT EXISTS hostel_management;

USE hostel_management;


-- =========================================================
-- 1. ADMINS
-- =========================================================

CREATE TABLE admins (
    id INT AUTO_INCREMENT PRIMARY KEY,

    name VARCHAR(100) NOT NULL,

    email VARCHAR(150) NOT NULL UNIQUE,

    mobile VARCHAR(15),

    password VARCHAR(255) NOT NULL,

    photo VARCHAR(255),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- 2. STUDENTS
-- =========================================================

CREATE TABLE students (
    id INT AUTO_INCREMENT PRIMARY KEY,

    student_id VARCHAR(30) NOT NULL UNIQUE,

    name VARCHAR(100) NOT NULL,

    email VARCHAR(150) NOT NULL UNIQUE,

    mobile VARCHAR(15) NOT NULL,

    password VARCHAR(255) NOT NULL,

    photo VARCHAR(255),

    gender ENUM('Male','Female','Other') DEFAULT 'Male',

    college VARCHAR(150),

    course VARCHAR(150),

    hostel_name VARCHAR(100),

    parent_name VARCHAR(100),

    parent_mobile VARCHAR(15),

    parent_email VARCHAR(150),

    address TEXT,

    status ENUM('Active','Inactive') DEFAULT 'Active',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- 3. SECURITY
-- =========================================================

CREATE TABLE security (
    id INT AUTO_INCREMENT PRIMARY KEY,

    name VARCHAR(100) NOT NULL,

    employee_id VARCHAR(30) UNIQUE,

    email VARCHAR(150) NOT NULL UNIQUE,

    mobile VARCHAR(15),

    hostel_name VARCHAR(100),

    shift ENUM('Morning','Evening','Night') DEFAULT 'Morning',

    status ENUM('Active','Inactive') DEFAULT 'Active',

    password VARCHAR(255) NOT NULL,

    photo VARCHAR(255),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- 4. ROOMS
-- =========================================================

CREATE TABLE rooms (
    id INT AUTO_INCREMENT PRIMARY KEY,

    room_no VARCHAR(30) NOT NULL UNIQUE,

    floor VARCHAR(30),

    block VARCHAR(50),

    capacity INT NOT NULL DEFAULT 1,

    status ENUM(
        'Available',
        'Full',
        'Maintenance'
    ) DEFAULT 'Available',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- 5. ROOM ALLOCATION
-- =========================================================

CREATE TABLE room_allocation (
    id INT AUTO_INCREMENT PRIMARY KEY,

    student_id INT NOT NULL,

    room_id INT NOT NULL,

    allocated_date DATE NOT NULL,

    vacated_date DATE DEFAULT NULL,

    status ENUM(
        'Active',
        'Vacated'
    ) DEFAULT 'Active',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (student_id)
        REFERENCES students(id)
        ON DELETE CASCADE,

    FOREIGN KEY (room_id)
        REFERENCES rooms(id)
        ON DELETE CASCADE
);


-- =========================================================
-- 6. FEES
-- =========================================================

CREATE TABLE fees (
    id INT AUTO_INCREMENT PRIMARY KEY,

    student_id INT NOT NULL,

    room_id INT,

    amount DECIMAL(10,2) NOT NULL,

    fee_type VARCHAR(50) DEFAULT 'Hostel Fee',

    month VARCHAR(20),

    due_date DATE,

    status ENUM(
        'Pending',
        'Paid',
        'Cancelled'
    ) DEFAULT 'Pending',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (student_id)
        REFERENCES students(id)
        ON DELETE CASCADE,

    FOREIGN KEY (room_id)
        REFERENCES rooms(id)
        ON DELETE SET NULL
);


-- =========================================================
-- 7. PAYMENTS
-- =========================================================

CREATE TABLE payments (
    id INT AUTO_INCREMENT PRIMARY KEY,

    fee_id INT NOT NULL,

    student_id INT NOT NULL,

    amount DECIMAL(10,2) NOT NULL,

    payment_method ENUM(
        'Cash',
        'UPI',
        'Card',
        'Bank Transfer'
    ) NOT NULL,

    transaction_id VARCHAR(100),

    payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,

    status ENUM(
        'Success',
        'Failed',
        'Pending'
    ) DEFAULT 'Success',

    receipt_no VARCHAR(50) UNIQUE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (fee_id)
        REFERENCES fees(id)
        ON DELETE CASCADE,

    FOREIGN KEY (student_id)
        REFERENCES students(id)
        ON DELETE CASCADE
);


-- =========================================================
-- 8. GATE PASS
-- =========================================================

CREATE TABLE gate_pass (
    id INT AUTO_INCREMENT PRIMARY KEY,

    student_id INT NOT NULL,

    gatepass_seq INT NOT NULL,

    gatepass_no VARCHAR(50) NOT NULL UNIQUE,

    purpose VARCHAR(255) NOT NULL,

    destination VARCHAR(255) NOT NULL,

    college VARCHAR(150),

    course VARCHAR(150),

    hostel_name VARCHAR(100),

    exit_date DATE NOT NULL,

    exit_time TIME NOT NULL,

    return_date DATE NOT NULL,

    parent_email VARCHAR(150),

    verification_code VARCHAR(100) NOT NULL UNIQUE,

    qr_data TEXT,

    status ENUM(
        'Pending',
        'Approved',
        'Rejected',
        'Cancelled',
        'Completed'
    ) DEFAULT 'Pending',

    parent_status ENUM(
        'Pending',
        'Approved',
        'Rejected'
    ) DEFAULT 'Pending',

    security_exit_id INT DEFAULT NULL,

    security_entry_id INT DEFAULT NULL,

    exit_verified_at DATETIME DEFAULT NULL,

    entry_verified_at DATETIME DEFAULT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (student_id)
        REFERENCES students(id)
        ON DELETE CASCADE,

    FOREIGN KEY (security_exit_id)
        REFERENCES security(id)
        ON DELETE SET NULL,

    FOREIGN KEY (security_entry_id)
        REFERENCES security(id)
        ON DELETE SET NULL,

    UNIQUE(student_id, gatepass_seq)
);


-- =========================================================
-- 9. COMPLAINTS
-- =========================================================

CREATE TABLE complaints (
    id INT AUTO_INCREMENT PRIMARY KEY,

    student_id INT NOT NULL,

    subject VARCHAR(200) NOT NULL,

    description TEXT NOT NULL,

    status ENUM(
        'Pending',
        'In Progress',
        'Resolved',
        'Rejected'
    ) DEFAULT 'Pending',

    response TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    resolved_at DATETIME DEFAULT NULL,

    FOREIGN KEY (student_id)
        REFERENCES students(id)
        ON DELETE CASCADE
);


-- =========================================================
-- 10. ANNOUNCEMENTS
-- =========================================================

CREATE TABLE announcements (
    id INT AUTO_INCREMENT PRIMARY KEY,

    title VARCHAR(200) NOT NULL,

    message TEXT NOT NULL,

    created_by INT,

    target ENUM(
        'All',
        'Students',
        'Security'
    ) DEFAULT 'All',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (created_by)
        REFERENCES admins(id)
        ON DELETE SET NULL
);


-- =========================================================
-- 11. NOTIFICATIONS
-- =========================================================

CREATE TABLE notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,

    student_id INT DEFAULT NULL,

    security_id INT DEFAULT NULL,

    title VARCHAR(200) NOT NULL,

    message TEXT NOT NULL,

    type VARCHAR(50),

    is_read BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (student_id)
        REFERENCES students(id)
        ON DELETE CASCADE,

    FOREIGN KEY (security_id)
        REFERENCES security(id)
        ON DELETE CASCADE
);


-- =========================================================
-- 12. GATE PASS INDEXES
-- =========================================================

CREATE INDEX idx_gatepass_student
ON gate_pass(student_id);

CREATE INDEX idx_gatepass_status
ON gate_pass(status);

CREATE INDEX idx_gatepass_verification
ON gate_pass(verification_code);


-- =========================================================
-- 13. ROOM INDEXES
-- =========================================================

CREATE INDEX idx_room_allocation_student
ON room_allocation(student_id);

CREATE INDEX idx_room_allocation_room
ON room_allocation(room_id);


-- =========================================================
-- DATABASE COMPLETE
-- =========================================================