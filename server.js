const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const mysql = require("mysql2");
const multer = require("multer");
const path = require("path");
const bcrypt = require("bcrypt");

const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Serve frontend files
app.use(express.static(path.join(__dirname, "frontend")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// MySQL connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "profiles_db"
});

db.connect(err => {
  if (err) console.error("❌ MySQL Connection Failed:", err);
  else console.log("✅ MySQL Connected");
});

// Multer setup for uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// ================= CREATE PROFILE =================
app.post("/api/profiles", upload.fields([{ name: "photo" }, { name: "id_photo" }]), async (req, res) => {
  try {
    const {
      full_name,
      email,
      password,
      address,
      department,
      salary_range,
      subject_to_teach,
      whatsapp_number
    } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);
    const photo = req.files["photo"] ? req.files["photo"][0].filename : null;
    const id_photo = req.files["id_photo"] ? req.files["id_photo"][0].filename : null;

    const sql = `
      INSERT INTO profiles
      (full_name, email, password, address, department, salary_range, subject_to_teach, photo, whatsapp_number, id_photo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(sql, [full_name, email, hashedPassword, address, department, salary_range, subject_to_teach, photo, whatsapp_number, id_photo], err => {
      if (err) {
        console.error("❌ Database error:", err);
        return res.status(500).json({ success: false, message: "Database error" });
      }
      res.json({ success: true, message: "✅ Profile created successfully!" });
    });
  } catch (error) {
    console.error("❌ Error creating profile:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ================= LOGIN =================
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  const sql = "SELECT * FROM profiles WHERE email = ?";
  db.query(sql, [email], async (err, results) => {
    if (err) return res.status(500).json({ success: false, message: "Database error" });
    if (results.length === 0) return res.status(401).json({ success: false, message: "Invalid email or password" });

    const user = results[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match) return res.status(401).json({ success: false, message: "Invalid email or password" });

    // Successful login
    res.json({
      success: true,
      message: "✅ Login successful!",
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        address: user.address,
        department: user.department,
        salary_range: user.salary_range,
        subject_to_teach: user.subject_to_teach,
        photo: user.photo,
        whatsapp_number: user.whatsapp_number,
        id_photo: user.id_photo
      }
    });
  });
});

// ================= GET ALL PROFILES =================
app.get("/api/profiles", (req, res) => {
  let query = "SELECT * FROM profiles";
  const { department, subject } = req.query;

  if (department && subject) query += ` WHERE department = ${db.escape(department)} AND subject_to_teach = ${db.escape(subject)}`;
  else if (department) query += ` WHERE department = ${db.escape(department)}`;
  else if (subject) query += ` WHERE subject_to_teach = ${db.escape(subject)}`;

  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ success: false, message: "Database error" });
    res.json(results);
  });
});

// ================= GET SINGLE PROFILE =================
app.get("/api/profiles/:id", (req, res) => {
  const sql = "SELECT * FROM profiles WHERE id = ?";
  db.query(sql, [req.params.id], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: "Error fetching profile" });
    res.json(result[0]);
  });
});

// ================= UPDATE PROFILE =================
app.put("/api/profiles/:id", upload.fields([{ name: "photo" }, { name: "id_photo" }]), (req, res) => {
  const { id } = req.params;
  const { department, subject_to_teach, whatsapp_number } = req.body;

  let updates = [department, subject_to_teach, whatsapp_number, id];
  let sql = `
    UPDATE profiles
    SET department = ?, subject_to_teach = ?, whatsapp_number = ?
  `;

  // Optional: update photo if provided
  if (req.files["photo"]) {
    sql += `, photo = ?`;
    updates.splice(3, 0, req.files["photo"][0].filename); // insert photo before id
  }

  sql += " WHERE id = ?";

  db.query(sql, updates, (err, result) => {
    if (err) return res.status(500).json({ success: false, message: "Database error" });
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "Profile not found" });
    res.json({ success: true, message: "✅ Profile updated successfully!" });
  });
});

// ================= START SERVER =================
const PORT = 5000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
