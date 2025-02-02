require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'Codeath@123',
    database: 'seat_tracker',
    port: 3306,
    connectionLimit: 10
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

app.listen(3001, () => console.log("🚀 Server running on http://localhost:3001"));
