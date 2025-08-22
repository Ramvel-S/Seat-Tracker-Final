# Office Seat Tracker

The Office Seat Tracker is a web-based application designed to help organizations manage and track seating arrangements for employees efficiently. It allows administrators to assign, update, and view seat availability in real-time, making workplace management more organized and transparent.

---

# Features
- Add, update, and delete seat assignments.
- View seat availability in real-time.
- Simple user-friendly interface.
- MySQL database integration for reliable storage.
- Search and filter employees by seat, name, or department.

---

# Tech Stack
- Frontend: HTML, CSS, JavaScript
- Backend: Node.js 
- Database: MySQL

---

# Installation

1. Clone the repository:
   git clone https://https://github.com/Ramvel-S/Seat-Tracker-Final
   cd office-seat-tracker

2. Set up the database:
   - Install MySQL
   - Create a database
   - Import the provided schema.sql file

   mysql -u root -p
   CREATE DATABASE seat_tracker;
   USE seat_tracker;
   SOURCE schema.sql;

3. Configure database connection in backend code:
   Update database username, password, and host in config file.

4. Run the application:
   # Node.js backend
   npm start

5. Open the application in browser:
   http://localhost:8080

---

# Usage
- Admin can add seats and assign them to employees.
- Employees can view their assigned seats.
- Search functionality helps quickly find seat assignments.

---

# Folder Structure
office-seat-tracker/
├── backend/         # Application logic
├── frontend/        # HTML, CSS, JS files
├── database/        # SQL schema and scripts
├── README.md
└── LICENSE

---

# Future Enhancements
- Integration with QR code for seat verification.
- Role-based access control (Admin/Employee).
- Analytics dashboard for seat utilization.

---

# License
This project is licensed under the MIT License.
