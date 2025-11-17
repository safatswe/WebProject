const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const mysql = require("mysql2");
const multer = require("multer");
const path = require("path");
require('dotenv').config();
const { Resend } = require('resend');


// const resend = new Resend(process.env.RESEND_API_KEY);





const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(__dirname));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.static("frontend"));

  // contact us endpoint

const resend = new Resend(process.env.RESEND_API_KEY);

app.post('/send-email', async (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({ ok: false, error: 'All fields are required' });
  }

  try {
    const html = `
      <h2>New Contact Message</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Message:</strong><br>${message.replace(/\n/g, '<br>')}</p>
    `;

    await resend.emails.send({
      from: 'Your Website <on@resend.dev>',  // default sender, no setup needed
      to: 'farabisafat@gmail.com',            // your real email here
      subject: `New message from ${name}`,
      html,
    });

    res.json({ ok: true, message: 'Email sent successfully' });
  } catch (error) {
    console.error('Email sending error:', error);
    res.status(500).json({ ok: false, error: 'Failed to send email' });
  }
});

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});



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
app.post("/api/profiles", upload.fields([{ name: "photo" }, { name: "id_photo" }]), (req, res) => {
  const {
    full_name,
    email,
    address,
    department,
    subject_to_teach,
    available_time,
    whatsapp_number,
    available,
    about_me,
    intro_video_link
  } = req.body;

  // Extract uploaded file names
  const photo = req.files["photo"] ? req.files["photo"][0].filename : null;
  const id_photo = req.files["id_photo"] ? req.files["id_photo"][0].filename : null;

  // console.log("REQ.BODY:", req.body);
  // console.log("REQ.FILES:", req.files);

  // Convert available to boolean (1 or 0)
  const availableBool = (available && available.toLowerCase() === "yes") ? 1 : 0;

  const sql = `
    INSERT INTO profiles
    (full_name, email, address, department, subject_to_teach, available_time, photo, whatsapp_number, id_photo, available, about_me, intro_video_link)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [
      full_name,
      email,
      address,
      department,
      subject_to_teach,
      available_time,
      photo,
      whatsapp_number,
      id_photo,
      availableBool,
      about_me,
      intro_video_link
    ],
    (err, results) => {
      if (err) {
        console.error("DB Insert Error:", err);
        return res.status(500).json({ message: "Database error" });
      }
      console.log("Profile created, ID:", results.insertId);
      res.json({ message: "Profile created successfully!" });
    }
  );
});
// Get all profiles with optional filters
app.get("/api/profiles", (req, res) => {
  let query = "SELECT * FROM profiles";
  const { department, subject } = req.query;

  if (department && subject) {
    query += ` WHERE department = ${db.escape(department)} AND subject_to_teach = ${db.escape(subject)}`;
  } else if (department) {
    query += ` WHERE department = ${db.escape(department)}`;
  } else if (subject) {
    query += ` WHERE subject_to_teach = ${db.escape(subject)}`;
  }

  db.query(query, (err, results) => {
    if (err) {
      console.error("DB Fetch Error:", err);
      return res.status(500).json({ message: "Database error" });
    }
    res.json(results);
  });
});

// Get single profile by id
app.get("/api/profiles/:id", (req, res) => {
  const sql = "SELECT * FROM profiles WHERE id = ?";
  db.query(sql, [req.params.id], (err, result) => {
    if (err) {
      console.error("DB Fetch Single Error:", err);
      return res.status(500).json({ message: "Error fetching profile" });
    }
    if (!result.length) {
      return res.status(404).json({ message: "Profile not found" });
    }
    res.json(result[0]);
  });
});

// Start server
const PORT = 5000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));




