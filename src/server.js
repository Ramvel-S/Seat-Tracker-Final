const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const nodemailer = require('nodemailer');
require('dotenv').config(); 

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
    host: process.env.DB_HOST,       
    user: process.env.DB_USER,       
    password: process.env.DB_PASS,   
    database: process.env.DB_NAME  
});

db.connect(err => {
    if (err) {
        console.error("❌ Database connection failed:", err);
        return;
    }
    console.log("✅ Connected to MySQL database");
});

// ✅ Convert Time to 24-Hour Format
const convertTo24HourFormat = (time) => {
    const [timePart, modifier] = time.split(" ");
    let [hours, minutes] = timePart.split(":");

    if (modifier === "PM" && hours !== "12") {
        hours = String(parseInt(hours) + 12);
    } else if (modifier === "AM" && hours === "12") {
        hours = "00";
    }

    return `${hours}:${minutes}:00`;
};

app.get('/chairs', (req, res) => {
    const query = "SELECT chair_id, is_occupied FROM chairs";
    db.query(query, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.get('/members', (req, res) => {
    db.query("SELECT id, name, email FROM team_members", (err, results) => {
        if (err) return res.status(500).json({ error: "Database error" });
        res.json(results);
    });
});

app.get("/api/users", (req, res) => {
    db.query("SELECT id, name, email FROM users", (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Delete User
app.delete("/api/users/:id", (req, res) => {
    db.query("DELETE FROM users WHERE id = ?", [req.params.id], err => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "User deleted successfully" });
    });
});

// Add User
app.post("/api/users", async (req, res) => {
    const { name, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    db.query("INSERT INTO users (name, email, password) VALUES (?, ?, ?)", [name, email, hashedPassword], err => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "User added successfully" });
    });
});

// Get Tables
app.get("/api/tables", (req, res) => {
    db.query("SELECT * FROM tables", (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.put("/api/tables/reset/:tableId", (req, res) => {
    const { tableId } = req.params;

    const query = "UPDATE tables SET remaining_seats = capacity, occupied = 0 WHERE table_id = ?";
    db.query(query, [tableId], (err, result) => {
        if (err) {
            console.error("❌ Database error:", err);
            return res.status(500).json({ error: "Database error" });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Table not found" });
        }

        res.json({ message: `✅ Table ${tableId} reset successfully` });
    });
});

app.post('/signup', async (req, res) => {
    const { name, email, password, phone_no } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    db.query("INSERT INTO users (name, email, password, phone_no) VALUES (?, ?, ?, ?)", 
        [name, email, hashedPassword, phone_no], 
        (err) => {
            if (err) return res.status(500).json({ message: "Error: " + err });
            res.json({ message: "User registered successfully!" });
        }
    );
});

app.post('/signin', async (req, res) => {
    res.json({ message: "Login successful!", redirectUrl: "/dashboard" });
});

app.post('/select-chair', (req, res) => {
    const { userId, chairId } = req.body;

    // Unselect previously selected chair by user
    const unselectQuery = `
        UPDATE chairs 
        SET is_occupied = FALSE 
        WHERE chair_id = (SELECT chair_id FROM chair_selections WHERE user_id = ?)
    `;
    db.query(unselectQuery, [userId], () => {

        // Insert new selection (or update existing)
        const insertQuery = `
            INSERT INTO chair_selections (user_id, chair_id) 
            VALUES (?, ?) 
            ON DUPLICATE KEY UPDATE chair_id = VALUES(chair_id)
        `;
        db.query(insertQuery, [userId, chairId], (err) => {
            if (err) return res.status(500).json({ error: err.message });

            // Mark chair as occupied
            const updateChairQuery = `UPDATE chairs SET is_occupied = TRUE WHERE chair_id = ?`;
            db.query(updateChairQuery, [chairId], (err) => {
                if (err) return res.status(500).json({ error: err.message });

                res.json({ message: 'Chair selected successfully!' });
            });
        });
    });
});


app.post("/solo-book", (req, res) => {
    const { floor, days, startTime, endTime } = req.body;
  
    if (!floor || !days || !startTime || !endTime) {
      return res.status(400).json({ error: "All fields are required!" });
    }
  
    const sql = "INSERT INTO solo_bookings (floor, days, start_time, end_time) VALUES (?, ?, ?, ?)";
    db.query(sql, [floor, days.join(", "), startTime, endTime], (err, result) => {
      if (err) {
        console.error("Error inserting data:", err);
        return res.status(500).json({ error: "Database error" });
      }
      res.json({ message: "Solo Booking saved successfully!", bookingId: result.insertId });
    });
  });

let selectedMembers = [];

app.post('/confirm', async (req, res) => {
    try {
        const selectedMembers = req.body.members;
        console.log("📩 Selected Members:", selectedMembers);

        // Extract emails
        const emailList = selectedMembers.map(member => member.email).join(", ");
        console.log("📧 Email List:", emailList);

        if (!emailList) {
            return res.status(400).json({ error: "No valid emails found!" });
        }

        // ✅ Debug: Check if credentials are loaded
        console.log("🔍 Debugging: EMAIL_USER:", process.env.EMAIL_USER);

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER, // Your Gmail address
                pass: process.env.EMAIL_PASS,  // Use app password stored securely
            },
            logger: true,  // ✅ Enables logging
            debug: true,    // ✅ Enables debugging
        });

        const mailOptions = {
            from: '"KBR" <osm@kbr.com>',  
            to: emailList,  // ✅ Fixed issue: Use dynamic email list
            subject: 'Conference Room Booking',
            text: `Dear User,

Your booking has been successfully confirmed. Thank you for choosing our service!
If you have any questions or need further assistance, feel free to reach out.

Best regards,
KBR Team`,
        };

        console.log("📨 Sending Email With Options:", mailOptions);

        const info = await transporter.sendMail(mailOptions);
        console.log("✅ Email sent successfully:", info.response);

        res.json({ message: "Selection confirmed and email sent!", selectedMembers });

    } catch (error) {
        console.error("❌ Email sending error:", error);

        // ✅ Debug: Log specific error details
        if (error.response) {
            console.error("📩 SMTP Response:", error.response);
        }
        res.status(500).json({ error: "Email sending failed", details: error.message });
    }
});



// ✅ API to Handle Team Booking (team_booking.html)
app.post("/book/team", (req, res) => {
    const { floor, members, days, startTime, endTime } = req.body;

    if (!floor || !members || !days || !startTime || !endTime) {
        return res.status(400).json({ error: "All fields are required" });
    }

    // Convert time format
    const formattedStartTime = convertTo24HourFormat(startTime);
    const formattedEndTime = convertTo24HourFormat(endTime);

    const query = `
        INSERT INTO team_bookings (floor, members, days, start_time, end_time, created_at) 
        VALUES (?, ?, ?, ?, ?, NOW())
    `;

    db.query(query, [floor, members, days.join(", "), formattedStartTime, formattedEndTime], (err, result) => {
        if (err) {
            console.error("❌ Database error:", err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json({ message: "✅ Booking successful", bookingId: result.insertId });
    });
});

// ✅ API to Handle Table Allocation for Meeting Rooms (room_selection.html)
app.post("/allocate-table", (req, res) => {
    const { floor, members } = req.body;

    if (!floor || !members) {
        return res.status(400).json({ error: "Floor and members are required" });
    }

    // Step 1: Find an available table on the given floor
    const findTableQuery = `
        SELECT table_id, remaining_seats, capacity FROM tables
        WHERE floor = ? AND remaining_seats >= ? AND occupied = 0
        ORDER BY remaining_seats ASC LIMIT 1
    `;

    db.query(findTableQuery, [floor, members], (err, tables) => {
        if (err) {
            console.error("❌ Database error while finding a table:", err);
            return res.status(500).json({ error: "Database error" });
        }

        if (tables.length === 0) {
            return res.status(404).json({ error: "⚠️ No available tables found!" });
        }

        // Step 2: Select the table with the best capacity fit
        const selectedTable = tables[0];
        const tableId = selectedTable.table_id;
        let newRemainingSeats = selectedTable.remaining_seats - members;

        // If remaining seats reach 0, mark table as occupied
        const isTableFull = newRemainingSeats === 0 ? 1 : 0;

        // Step 3: Update the table occupancy
        const updateTableQuery = `
            UPDATE tables SET remaining_seats = ?, occupied = ? WHERE table_id = ?
        `;

        db.query(updateTableQuery, [newRemainingSeats, isTableFull, tableId], (updateErr) => {
            if (updateErr) {
                console.error("❌ Error updating table occupancy:", updateErr);
                return res.status(500).json({ error: "Failed to update table occupancy" });
            }

            // Step 4: Return success response
            res.json({ message: "✅ Table allocated successfully", tableId });
        });
    });
});


// ✅ API to Handle Conference Room Allocation (room_selection.html)
app.post("/allocate-conference-room", (req, res) => {
    const { floor } = req.body;

    if (!floor) {
        return res.status(400).json({ error: "Floor is required" });
    }

    // Find an available conference room on the given floor
    const findRoomQuery = `
        SELECT room_id FROM conference_rooms
        WHERE floor = ? AND occupied = 0
        LIMIT 1
    `;

    db.query(findRoomQuery, [floor], (err, rooms) => {
        if (err) {
            console.error("❌ Database error while finding conference room:", err);
            return res.status(500).json({ error: "Database error" });
        }

        if (rooms.length === 0) {
            return res.status(400).json({ error: "⚠️ No available conference rooms" });
        }

        const selectedRoom = rooms[0];
        const roomId = selectedRoom.room_id;

        // Step 2: Mark the room as occupied
        const updateRoomQuery = `
            UPDATE conference_rooms SET occupied = 1 WHERE room_id = ?
        `;

        db.query(updateRoomQuery, [roomId], (updateErr) => {
            if (updateErr) {
                console.error("❌ Error updating conference room status:", updateErr);
                return res.status(500).json({ error: "Failed to update conference room status" });
            }

            // Step 3: Return success response
            res.json({ message: "✅ Conference room allocated successfully", roomId });
        });
    });
});

// ✅ API to Fetch Confirmation Details for Meeting/Conference Room
app.get("/confirmation/:bookingType", (req, res) => {
    const { bookingType } = req.params;
    let { id } = req.query; // ID will be either tableId (meeting) or roomId (conference)

    if (!id) {
        return res.status(400).json({ error: "Booking ID is required" });
    }

    // ✅ Ensure ID is properly converted to an integer
    id = parseInt(id, 10);
    if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid Booking ID" });
    }

    let query;
    if (bookingType === "meeting") {
        query = `SELECT * FROM tables WHERE table_id = ?`;
    } else if (bookingType === "conference") {
        query = `SELECT * FROM conference_rooms WHERE room_id = ?`;
    } else {
        return res.status(400).json({ error: "Invalid booking type" });
    }

    db.query(query, [id], (err, result) => {
        if (err) {
            console.error("❌ Database error while fetching confirmation details:", err);
            return res.status(500).json({ error: "Database error" });
        }

        if (result.length === 0) {
            console.error(`⚠️ No booking found for ID: ${id} (Type: ${bookingType})`);
            return res.status(404).json({ error: "No booking found" });
        }

        res.json(result[0]);
    });
});
// ✅ API to Get Latest Booking Details for Confirmation Page
app.get("/api/booking", (req, res) => {
    const query = `SELECT * FROM team_bookings ORDER BY created_at DESC LIMIT 1`;

    db.query(query, (err, results) => {
        if (err) {
            console.error("❌ Error fetching booking details:", err);
            return res.status(500).json({ error: "Database error" });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: "No recent booking found." });
        }

        res.json(results[0]); // Send the latest booking data
    });
});

app.get("/api/users", (req, res) => {
    db.query("SELECT id, name, email FROM users", (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// Delete User
app.delete("/api/users/:id", (req, res) => {
    db.query("DELETE FROM users WHERE id = ?", [req.params.id], err => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "User deleted successfully" });
    });
});

// Add User
app.post("/api/users", async (req, res) => {
    const { name, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    db.query("INSERT INTO users (name, email, password) VALUES (?, ?, ?)", [name, email, hashedPassword], err => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "User added successfully" });
    });
});

// Get Tables
app.get("/api/tables", (req, res) => {
    db.query("SELECT * FROM tables", (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.put("/api/tables/reset/:tableId", (req, res) => {
    const { tableId } = req.params;

    const query = "UPDATE tables SET remaining_seats = capacity, occupied = 0 WHERE table_id = ?";
    db.query(query, [tableId], (err, result) => {
        if (err) {
            console.error("❌ Database error:", err);
            return res.status(500).json({ error: "Database error" });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Table not found" });
        }

        res.json({ message: `✅ Table ${tableId} reset successfully` });
    });
});

// ✅ API to Handle Team Booking (team_booking.html)
app.post("/book/team", (req, res) => {
    const { floor, members, days, startTime, endTime } = req.body;

    if (!floor || !members || !days || !startTime || !endTime) {
        return res.status(400).json({ error: "All fields are required" });
    }

    // Validate members array
    if (!Array.isArray(members) || members.length === 0) {
        return res.status(400).json({ error: "Members array is required and should not be empty" });
    }

    // Convert time format
    const formattedStartTime = convertTo24HourFormat(startTime);
    const formattedEndTime = convertTo24HourFormat(endTime);

    const query = `
        INSERT INTO team_bookings (floor, members, days, start_time, end_time, created_at) 
        VALUES (?, ?, ?, ?, ?, NOW())
    `;

    db.query(query, [floor, JSON.stringify(members), days.join(", "), formattedStartTime, formattedEndTime], (err, result) => {
        if (err) {
            console.error("❌ Database error:", err);
            return res.status(500).json({ error: "Database error" });
        }
        res.json({ message: "✅ Booking successful", bookingId: result.insertId });
    });
});

// 🌍 Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
