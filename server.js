const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const mysql = require("mysql2");
const multer = require("multer");
const path = require("path");

const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.static("frontend"));

// MySQL connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "profiles_db"
});

db.connect((err) => {
  if (err) console.error("❌ MySQL Connection Failed:", err);
  else console.log("✅ MySQL Connected");
});

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Create profile
app.post("/api/profiles", upload.single("photo"), (req, res) => {
  const { full_name, email, address, department, salary_range, subject_to_teach } = req.body;
  const photo = req.file ? req.file.filename : null;

  const sql = `INSERT INTO profiles
    (full_name, email, address, department, salary_range, subject_to_teach, photo)
    VALUES (?, ?, ?, ?, ?, ?, ?)`;

  db.query(sql, [full_name, email, address, department, salary_range, subject_to_teach, photo], (err) => {
    if (err) return res.status(500).json({ message: "Database error" });
    res.json({ message: "Profile created successfully!" });
  });
});

// Get all profiles with optional filters
app.get("/api/profiles", (req, res) => {
  let query = "SELECT * FROM profiles";
  const { department, subject } = req.query;

  if (department && subject) query += ` WHERE department = ${db.escape(department)} AND subject_to_teach = ${db.escape(subject)}`;
  else if (department) query += ` WHERE department = ${db.escape(department)}`;
  else if (subject) query += ` WHERE subject_to_teach = ${db.escape(subject)}`;

  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ message: "Database error" });
    res.json(results);
  });
});

// Get single profile by id
app.get("/api/profiles/:id", (req, res) => {
  const sql = "SELECT * FROM profiles WHERE id = ?";
  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json({ message: "Error fetching profile" });
    res.json(result[0]);
  });
});

// Start server
const PORT = 5000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
