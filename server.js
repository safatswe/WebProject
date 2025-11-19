const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const mysql = require("mysql2");
const multer = require("multer");
const path = require("path");
const bcrypt = require('bcryptjs');
const fs = require('fs');
require('dotenv').config();
const crypto = require('crypto');

const { Resend } = require('resend');

const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(__dirname));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.static("frontend"));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// MySQL connection
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "profiles_db"
});

db.connect((err) => {
    if (err) console.error(" MySQL Connection Failed:", err);
    else console.log(" MySQL Connected");
});

// Multer setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "uploads/"),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Contact us endpoint
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
            from: 'Your Website <onboarding@resend.dev>',
            to: 'farabisafat@gmail.com',
            subject: `New message from ${name}`,
            html,
        });

        res.json({ ok: true, message: 'Email sent successfully' });
    } catch (error) {
        console.error('Email sending error:', error);
        res.status(500).json({ ok: false, error: 'Failed to send email' });
    }
});

// Create profile - FIXED: Added password field and fixed SQL column name
app.post("/api/profiles", upload.fields([{ name: "photo" }, { name: "id_photo" }]), async (req, res) => {
    const {
        full_name,
        email,
        password, // Added password field
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

    // Convert available to boolean (1 or 0)
    const availableBool = (available && available.toLowerCase() === "yes") ? 1 : 0;

    // Hash password if provided
    let hashedPassword = null;
    if (password && password.trim() !== "") {
        hashedPassword = await bcrypt.hash(password, 10);
    }

    const sql = `
    INSERT INTO profiles
    (full_name, email, password, address, department, subject_to_teach, available_time, photo, whatsapp_number, id_photo, available, about_me, intro_video_link)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

    db.query(
        sql,
        [
            full_name,
            email,
            hashedPassword,
            address,
            department,
            subject_to_teach, // Fixed: was subject_to_ach
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
    let query = `
        SELECT id, full_name, email, address, department, subject_to_teach,
        available_time, photo, id_photo, whatsapp_number, available,
        about_me, intro_video_link 
        FROM profiles
    `;

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
    const sql = `
        SELECT id, full_name, email, address, department, subject_to_teach,
        available_time, photo, id_photo, whatsapp_number, available,
        about_me, intro_video_link 
        FROM profiles 
        WHERE id = ?
    `;

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

// LOGIN - FIXED: Better error handling
app.post("/api/login", (req, res) => {
    const { email, password } = req.body;

    console.log("Login attempt for:", email);

    if (!email || !password) {
        return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    const sql = "SELECT * FROM profiles WHERE email = ?";
    db.query(sql, [email], async (err, results) => {
        if (err) {
            console.error("LOGIN DB ERROR:", err);
            return res.status(500).json({ success: false, message: "Database error" });
        }

        if (results.length === 0) {
            console.log("No user found with email:", email);
            return res.status(401).json({ success: false, message: "Invalid email or password" });
        }

        const user = results[0];

        // Check if user has a password
        if (!user.password) {
            console.log("No password set for user:", email);
            return res.status(401).json({ success: false, message: "No password set for this account. Please reset your password." });
        }

        try {
            const match = await bcrypt.compare(password, user.password);
            if (!match) {
                console.log("Password mismatch for:", email);
                return res.status(401).json({ success: false, message: "Invalid email or password" });
            }

            console.log("Login successful for:", email);
            res.json({
                success: true,
                message: " Login successful!",
                user: {
                    id: user.id,
                    full_name: user.full_name,
                    email: user.email,
                    address: user.address,
                    department: user.department,
                    subject_to_teach: user.subject_to_teach,
                    photo: user.photo,
                    whatsapp_number: user.whatsapp_number,
                    id_photo: user.id_photo,
                    about_me: user.about_me,
                    intro_video_link: user.intro_video_link,
                    available_time: user.available_time
                }
            });
        } catch (error) {
            console.error("Password comparison error:", error);
            return res.status(500).json({ success: false, message: "Authentication error" });
        }
    });
});

// UPDATE PROFILE
app.put(
    "/api/profiles/:id",
    upload.fields([{ name: "photo" }, { name: "id_photo" }]),
    async (req, res) => {
        const { id } = req.params;

        try {
            db.query("SELECT * FROM profiles WHERE id = ?", [id], async (errSelect, rows) => {
                if (errSelect)
                    return res.status(500).json({ success: false, message: "Database error" });

                if (!rows || rows.length === 0)
                    return res.status(404).json({ success: false, message: "Profile not found" });

                const existing = rows[0];

                const fields = [];
                const values = [];

                const updatable = [
                    "full_name",
                    "email",
                    "address",
                    "department",
                    "subject_to_teach",
                    "whatsapp_number",
                    "about_me",
                    "intro_video_link",
                    "available_time",
                    "available"
                ];

                updatable.forEach(key => {
                    if (req.body[key] !== undefined) {
                        fields.push(`${key} = ?`);
                        values.push(req.body[key]);
                    }
                });

                // Update password if provided
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

                    if (existing.photo)
                        fs.unlink(path.join(uploadsDir, existing.photo), () => { });
                }

                // Update ID photo
                if (req.files && req.files["id_photo"] && req.files["id_photo"][0]) {
                    const newIdPhoto = req.files["id_photo"][0].filename;
                    fields.push("id_photo = ?");
                    values.push(newIdPhoto);

                    if (existing.id_photo)
                        fs.unlink(path.join(uploadsDir, existing.id_photo), () => { });
                }

                if (fields.length === 0)
                    return res.status(400).json({ success: false, message: "No fields provided to update" });

                const sql = `UPDATE profiles SET ${fields.join(", ")} WHERE id = ?`;
                values.push(id);

                db.query(sql, values, (errUpdate, resultUpdate) => {
                    if (errUpdate)
                        return res.status(500).json({ success: false, message: "Database error" });

                    if (resultUpdate.affectedRows === 0)
                        return res.status(404).json({ success: false, message: "Profile not found" });

                    db.query(
                        "SELECT id, full_name, email, address, department, subject_to_teach, available_time, photo, whatsapp_number, available, about_me, intro_video_link FROM profiles WHERE id = ?",
                        [id],
                        (err2, updatedRows) => {
                            if (err2)
                                return res.status(500).json({ success: false, message: "Database error" });

                            res.json({
                                success: true,
                                message: " Profile updated successfully!",
                                user: updatedRows[0]
                            });
                        }
                    );
                });
            });
        } catch (error) {
            console.error("PUT /api/profiles/:id ERROR:", error);
            res.status(500).json({ success: false, message: "Server error" });
        }
    }
);

// DELETE PROFILE
app.delete("/api/profiles/:id", (req, res) => {
    const { id } = req.params;

    db.query("SELECT * FROM profiles WHERE id = ?", [id], (errSel, rows) => {
        if (errSel)
            return res.status(500).json({ success: false, message: "Database error" });

        if (!rows || rows.length === 0)
            return res.status(404).json({ success: false, message: "Profile not found" });

        const user = rows[0];

        db.query("DELETE FROM profiles WHERE id = ?", [id], (err, result) => {
            if (err)
                return res.status(500).json({ success: false, message: "Database error" });

            if (user.photo) fs.unlink(path.join(uploadsDir, user.photo), () => { });
            if (user.id_photo) fs.unlink(path.join(uploadsDir, user.id_photo), () => { });

            res.json({ success: true, message: "Profile deleted successfully!" });
        });
    });
});


app.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ message: "Email is required" });

  // Generate 6-digit numeric code
  const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

  // Code expires in 15 minutes
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  const sqlInsert = `INSERT INTO password_resets (email, reset_code, expires_at) VALUES (?, ?, ?)`;

  db.query(sqlInsert, [email, resetCode, expiresAt], async (err) => {
    if (err) {
      console.error("DB insert error:", err);
      return res.status(500).json({ message: "Database error" });
    }

    const html = `
      <h2>Password Reset Code</h2>
      <p>Your reset code is: <strong>${resetCode}</strong></p>
      <p>This code will expire in 15 minutes.</p>
    `;

    try {
      await resend.emails.send({
        from: 'Your Website <onboarding@resend.dev>',
        to: email,
        subject: 'Your Password Reset Code',
        html,
      });
      res.json({ message: "Reset code sent to your email" });
    } catch (error) {
      console.error("Email sending error:", error);
      res.status(500).json({ message: "Failed to send reset code email" });
    }
  });
});



app.post('/api/verify-reset-code', (req, res) => {
  const { email, reset_code } = req.body;

  if (!email || !reset_code)
    return res.status(400).json({ message: "Email and code are required" });

  const sqlSelect = `
    SELECT * FROM password_resets
    WHERE email = ? AND reset_code = ? AND used = FALSE AND expires_at > NOW()
    ORDER BY created_at DESC LIMIT 1
  `;

  db.query(sqlSelect, [email, reset_code], (err, results) => {
    if (err) return res.status(500).json({ message: "Database error" });

    if (results.length === 0) {
      return res.status(400).json({ message: "Invalid or expired reset code" });
    }

    res.json({ message: "Code verified" });
  });
});



app.post('/api/reset-password', async (req, res) => {
  const { email, reset_code, new_password, confirm_password } = req.body;

  if (!email || !reset_code || !new_password || !confirm_password)
    return res.status(400).json({ message: "All fields are required" });

  if (new_password !== confirm_password)
    return res.status(400).json({ message: "Passwords do not match" });

  const sqlSelect = `
    SELECT * FROM password_resets
    WHERE email = ? AND reset_code = ? AND used = FALSE AND expires_at > NOW()
    ORDER BY created_at DESC LIMIT 1
  `;

  db.query(sqlSelect, [email, reset_code], async (err, results) => {
    if (err) return res.status(500).json({ message: "Database error" });

    if (results.length === 0) {
      return res.status(400).json({ message: "Invalid or expired reset code" });
    }

    const hashed = await bcrypt.hash(new_password, 10);

    const sqlUpdate = `UPDATE profiles SET password = ? WHERE email = ?`;
    db.query(sqlUpdate, [hashed, email], (err2) => {
      if (err2) return res.status(500).json({ message: "Failed to update password" });

      // Mark reset code as used
      const sqlMarkUsed = `UPDATE password_resets SET used = TRUE WHERE id = ?`;
      db.query(sqlMarkUsed, [results[0].id], () => {});

      res.json({ message: "Password updated successfully" });
    });
  });
});



// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));