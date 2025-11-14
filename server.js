// server.js
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const multer = require("multer");
const path = require("path");
const bcrypt = require("bcrypt");
const fs = require("fs");

const app = express();
app.use(cors());

// ✅ Use built-in express parsers instead of body-parser
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve frontend files from "frontend" folder
app.use(express.static(path.join(__dirname, "frontend")));
// Serve uploaded images
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// MySQL connection - adjust credentials as needed
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

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// ---------------- CREATE PROFILE ----------------
app.post("/api/profiles", upload.fields([{ name: "photo" }, { name: "id_photo" }]), async (req, res) => {
  try {
    const {
      full_name, email, password, address, department,
      salary_range, subject_to_teach, whatsapp_number
    } = req.body;

    if (!password) return res.status(400).json({ success: false, message: "Password is required" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const photo = req.files && req.files["photo"] ? req.files["photo"][0].filename : null;
    const id_photo = req.files && req.files["id_photo"] ? req.files["id_photo"][0].filename : null;

    const sql = `
      INSERT INTO profiles
      (full_name, email, password, address, department, salary_range, subject_to_teach, photo, whatsapp_number, id_photo)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(sql, [full_name, email, hashedPassword, address, department, salary_range, subject_to_teach, photo, whatsapp_number, id_photo], (err, result) => {
      if (err) {
        console.error("DB INSERT ERROR:", err);
        return res.status(500).json({ success: false, message: "Database error" });
      }
      const createdId = result.insertId;
      db.query("SELECT id, full_name, email, address, department, salary_range, subject_to_teach, photo, whatsapp_number, id_photo FROM profiles WHERE id = ?", [createdId], (err2, rows) => {
        if (err2) {
          console.error("DB SELECT AFTER INSERT ERROR:", err2);
          return res.status(500).json({ success: false, message: "Database error" });
        }
        res.json({ success: true, message: "✅ Profile created successfully!", user: rows[0] });
      });
    });
  } catch (error) {
    console.error("CREATE PROFILE ERROR:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ---------------- LOGIN ----------------
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  const sql = "SELECT * FROM profiles WHERE email = ?";
  db.query(sql, [email], async (err, results) => {
    if (err) {
      console.error("LOGIN DB ERROR:", err);
      return res.status(500).json({ success: false, message: "Database error" });
    }
    if (results.length === 0) return res.status(401).json({ success: false, message: "Invalid email or password" });

    const user = results[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ success: false, message: "Invalid email or password" });

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

// ---------------- GET ALL PROFILES ----------------
app.get("/api/profiles", (req, res) => {
  let query = "SELECT * FROM profiles";
  const { department, subject } = req.query;

  if (department && subject) query += ` WHERE department = ${db.escape(department)} AND subject_to_teach = ${db.escape(subject)}`;
  else if (department) query += ` WHERE department = ${db.escape(department)}`;
  else if (subject) query += ` WHERE subject_to_teach = ${db.escape(subject)}`;

  db.query(query, (err, results) => {
    if (err) {
      console.error("GET ALL PROFILES ERROR:", err);
      return res.status(500).json({ success: false, message: "Database error" });
    }
    res.json(results);
  });
});

// ---------------- GET SINGLE PROFILE ----------------
app.get("/api/profiles/:id", (req, res) => {
  const sql = "SELECT id, full_name, email, address, department, salary_range, subject_to_teach, photo, whatsapp_number, id_photo FROM profiles WHERE id = ?";
  db.query(sql, [req.params.id], (err, result) => {
    if (err) {
      console.error("GET PROFILE ERROR:", err);
      return res.status(500).json({ success: false, message: "Error fetching profile" });
    }
    if (!result || result.length === 0) return res.status(404).json({ success: false, message: "Profile not found" });
    res.json(result[0]);
  });
});

// ---------------- UPDATE PROFILE ----------------
app.put("/api/profiles/:id", upload.fields([{ name: "photo" }, { name: "id_photo" }]), async (req, res) => {
  const { id } = req.params;

  try {
    db.query("SELECT * FROM profiles WHERE id = ?", [id], async (errSelect, rows) => {
      if (errSelect) return res.status(500).json({ success: false, message: "Database error" });
      if (!rows || rows.length === 0) return res.status(404).json({ success: false, message: "Profile not found" });

      const existing = rows[0];
      const fields = [];
      const values = [];

      const updatable = ["full_name", "email", "address", "department", "salary_range", "subject_to_teach", "whatsapp_number"];
      updatable.forEach(key => {
        if (req.body[key] !== undefined) {
          fields.push(`${key} = ?`);
          values.push(req.body[key]);
        }
      });

      // Update password only if provided
      if (req.body.password && req.body.password.trim() !== "") {
        const hashed = await bcrypt.hash(req.body.password, 10);
        fields.push("password = ?");
        values.push(hashed);
      }

      // Update photo
      if (req.files && req.files["photo"] && req.files["photo"][0]) {
        const newPhoto = req.files["photo"][0].filename;
        fields.push("photo = ?");
        values.push(newPhoto);

        if (existing.photo) fs.unlink(path.join(uploadsDir, existing.photo), () => {});
      }

      // Update id_photo
      if (req.files && req.files["id_photo"] && req.files["id_photo"][0]) {
        const newIdPhoto = req.files["id_photo"][0].filename;
        fields.push("id_photo = ?");
        values.push(newIdPhoto);

        if (existing.id_photo) fs.unlink(path.join(uploadsDir, existing.id_photo), () => {});
      }

      if (fields.length === 0) return res.status(400).json({ success: false, message: "No fields provided to update" });

      const sql = `UPDATE profiles SET ${fields.join(", ")} WHERE id = ?`;
      values.push(id);

      db.query(sql, values, (errUpdate, resultUpdate) => {
        if (errUpdate) return res.status(500).json({ success: false, message: "Database error" });
        if (resultUpdate.affectedRows === 0) return res.status(404).json({ success: false, message: "Profile not found" });

        db.query("SELECT id, full_name, email, address, department, salary_range, subject_to_teach, photo, whatsapp_number, id_photo FROM profiles WHERE id = ?", [id], (err2, updatedRows) => {
          if (err2) return res.status(500).json({ success: false, message: "Database error" });
          res.json({ success: true, message: "✅ Profile updated successfully!", user: updatedRows[0] });
        });
      });
    });
  } catch (error) {
    console.error("PUT /api/profiles/:id ERROR:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Serve index.html as default route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "index.html"));
});

// ---------------- DELETE PROFILE ----------------
app.delete("/api/profiles/:id", (req, res) => {
  const { id } = req.params;

  db.query("SELECT * FROM profiles WHERE id = ?", [id], (errSel, rows) => {
    if (errSel) return res.status(500).json({ success: false, message: "Database error" });
    if (!rows || rows.length === 0) return res.status(404).json({ success: false, message: "Profile not found" });

    const user = rows[0];
    db.query("DELETE FROM profiles WHERE id = ?", [id], (err, result) => {
      if (err) return res.status(500).json({ success: false, message: "Database error" });

      if (user.photo) fs.unlink(path.join(uploadsDir, user.photo), () => {});
      if (user.id_photo) fs.unlink(path.join(uploadsDir, user.id_photo), () => {});

      res.json({ success: true, message: "Profile deleted successfully!" });
    });
  });
});

const PORT = 5000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
