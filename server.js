// server.js

const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const multer = require("multer");
const path = require("path");
const bcrypt = require("bcrypt");
const fs = require("fs");
const { Resend } = require("resend");
require("dotenv").config();

const app = express();


// =====================================================
// MIDDLEWARE
// =====================================================

app.use(cors());

app.use(express.urlencoded({ extended: true }));
app.use(express.json());


// =====================================================
// FRONTEND & UPLOADS
// =====================================================

// Serve frontend files from "frontend" folder
app.use(express.static(path.join(__dirname, "frontend")));

// Upload folder
const uploadsDir = path.join(__dirname, "uploads");

// Create uploads folder if it does not exist
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploaded images
app.use("/uploads", express.static(uploadsDir));


// =====================================================
// RESEND EMAIL CONFIGURATION
// =====================================================

// Resend API key should be stored in .env locally
// and Environment Variables on deployment.

let resend = null;

if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);

  console.log("✅ Resend email service configured");
} else {
  console.log(
    "⚠️ RESEND_API_KEY not configured. Email service is disabled."
  );
}


// =====================================================
// CONTACT US EMAIL
// =====================================================

app.post("/send-email", async (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({
      ok: false,
      error: "All fields are required"
    });
  }

  // Do not crash the server if email API key is missing
  if (!resend) {
    return res.status(503).json({
      ok: false,
      error: "Email service is not configured on the server"
    });
  }

  try {
    const html = `
      <h2>New Contact Message</h2>

      <p>
        <strong>Name:</strong> ${name}
      </p>

      <p>
        <strong>Email:</strong> ${email}
      </p>

      <p>
        <strong>Message:</strong><br>
        ${String(message).replace(/\n/g, "<br>")}
      </p>
    `;

    await resend.emails.send({
      from: "SUST Tutor <on@resend.dev>",

      to: [
        "afazurr8@gmail.com",
        "Farabisafat@gmail.com"
      ],

      reply_to: email,

      subject: `New message from ${name}`,

      html: html
    });

    return res.json({
      ok: true,
      message: "Email sent successfully"
    });

  } catch (error) {
    console.error("❌ Email sending error:", error);

    return res.status(500).json({
      ok: false,
      error: "Failed to send email"
    });
  }
});


// =====================================================
// MYSQL CONNECTION
// =====================================================

const db = mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "profiles_db"
});

db.connect((err) => {
  if (err) {
    console.error("❌ MySQL Connection Failed:", err);
  } else {
    console.log("✅ MySQL Connected");
  }
});


// =====================================================
// MULTER SETUP
// =====================================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },

  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname);

    cb(
      null,
      Date.now() + extension
    );
  }
});

const upload = multer({
  storage: storage
});


// =====================================================
// COLUMNS SAFE TO EXPOSE PUBLICLY (never include password)
// =====================================================

const PUBLIC_PROFILE_COLUMNS = `
  id,
  full_name,
  email,
  address,
  department,
  salary_range,
  subject_to_teach,
  photo,
  whatsapp_number,
  id_photo
`;


// =====================================================
// CREATE PROFILE
// =====================================================

app.post(
  "/api/profiles",
  upload.fields([
    { name: "photo" },
    { name: "id_photo" }
  ]),
  async (req, res) => {

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


      // Required field validation
      if (!full_name || !email || !password) {
        return res.status(400).json({
          success: false,
          message: "Full name, email and password are required"
        });
      }


      // Hash password
      const hashedPassword = await bcrypt.hash(
        password,
        10
      );


      // Get uploaded photo
      const photo =
        req.files &&
        req.files["photo"] &&
        req.files["photo"][0]
          ? req.files["photo"][0].filename
          : null;


      // Get uploaded ID photo
      const id_photo =
        req.files &&
        req.files["id_photo"] &&
        req.files["id_photo"][0]
          ? req.files["id_photo"][0].filename
          : null;


      const sql = `
        INSERT INTO profiles
        (
          full_name,
          email,
          password,
          address,
          department,
          salary_range,
          subject_to_teach,
          photo,
          whatsapp_number,
          id_photo
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;


      db.query(
        sql,
        [
          full_name,
          email,
          hashedPassword,
          address,
          department,
          salary_range,
          subject_to_teach,
          photo,
          whatsapp_number,
          id_photo
        ],
        (err, result) => {

          if (err) {

            console.error(
              "❌ DB INSERT ERROR:",
              err
            );

            // Duplicate email gives a clearer message
            if (err.code === "ER_DUP_ENTRY") {
              return res.status(409).json({
                success: false,
                message: "An account with this email already exists"
              });
            }

            return res.status(500).json({
              success: false,
              message: "Database error"
            });
          }


          const createdId = result.insertId;


          // Return created profile
          const selectSql = `
            SELECT ${PUBLIC_PROFILE_COLUMNS}
            FROM profiles
            WHERE id = ?
          `;


          db.query(
            selectSql,
            [createdId],
            (err2, rows) => {

              if (err2) {

                console.error(
                  "❌ DB SELECT AFTER INSERT ERROR:",
                  err2
                );

                return res.status(500).json({
                  success: false,
                  message: "Database error"
                });
              }


              return res.json({
                success: true,
                message: "✅ Profile created successfully!",
                user: rows[0]
              });

            }
          );

        }
      );

    } catch (error) {

      console.error(
        "❌ CREATE PROFILE ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Server error"
      });

    }

  }
);


// =====================================================
// LOGIN
// =====================================================

app.post("/api/login", (req, res) => {

  const {
    email,
    password
  } = req.body;


  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Email and password are required"
    });
  }


  const sql =
    "SELECT * FROM profiles WHERE email = ?";


  db.query(
    sql,
    [email],
    async (err, results) => {

      if (err) {

        console.error(
          "❌ LOGIN DB ERROR:",
          err
        );

        return res.status(500).json({
          success: false,
          message: "Database error"
        });
      }


      if (results.length === 0) {

        return res.status(401).json({
          success: false,
          message: "Invalid email or password"
        });

      }


      const user = results[0];


      try {

        const match = await bcrypt.compare(
          password,
          user.password
        );


        if (!match) {

          return res.status(401).json({
            success: false,
            message: "Invalid email or password"
          });

        }


        return res.json({

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

      } catch (passwordError) {

        console.error(
          "❌ PASSWORD CHECK ERROR:",
          passwordError
        );

        return res.status(500).json({
          success: false,
          message: "Server error"
        });

      }

    }
  );

});


// =====================================================
// GET ALL PROFILES
// (fixed: never exposes the password column,
//  and uses parameterized values instead of string building)
// =====================================================

app.get("/api/profiles", (req, res) => {

  const {
    department,
    subject
  } = req.query;

  let query = `SELECT ${PUBLIC_PROFILE_COLUMNS} FROM profiles`;
  const conditions = [];
  const values = [];

  if (department) {
    conditions.push("department = ?");
    values.push(department);
  }

  if (subject) {
    conditions.push("subject_to_teach = ?");
    values.push(subject);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }


  db.query(
    query,
    values,
    (err, results) => {

      if (err) {

        console.error(
          "❌ GET ALL PROFILES ERROR:",
          err
        );

        return res.status(500).json({
          success: false,
          message: "Database error"
        });

      }


      return res.json(results);

    }
  );

});


// =====================================================
// GET SINGLE PROFILE
// =====================================================

app.get("/api/profiles/:id", (req, res) => {

  const sql = `
    SELECT ${PUBLIC_PROFILE_COLUMNS}
    FROM profiles
    WHERE id = ?
  `;


  db.query(
    sql,
    [req.params.id],
    (err, result) => {

      if (err) {

        console.error(
          "❌ GET PROFILE ERROR:",
          err
        );

        return res.status(500).json({
          success: false,
          message: "Error fetching profile"
        });

      }


      if (
        !result ||
        result.length === 0
      ) {

        return res.status(404).json({
          success: false,
          message: "Profile not found"
        });

      }


      return res.json(result[0]);

    }
  );

});


// =====================================================
// UPDATE PROFILE
// =====================================================

app.put(
  "/api/profiles/:id",

  upload.fields([
    { name: "photo" },
    { name: "id_photo" }
  ]),

  async (req, res) => {

    const {
      id
    } = req.params;


    try {

      db.query(
        "SELECT * FROM profiles WHERE id = ?",
        [id],
        async (errSelect, rows) => {

          if (errSelect) {

            console.error(
              "❌ UPDATE SELECT ERROR:",
              errSelect
            );

            return res.status(500).json({
              success: false,
              message: "Database error"
            });

          }


          if (
            !rows ||
            rows.length === 0
          ) {

            return res.status(404).json({
              success: false,
              message: "Profile not found"
            });

          }


          const existing = rows[0];

          const fields = [];
          const values = [];


          // Fields allowed to update
          const updatable = [
            "full_name",
            "email",
            "address",
            "department",
            "salary_range",
            "subject_to_teach",
            "whatsapp_number"
          ];


          updatable.forEach((key) => {

            if (
              req.body[key] !== undefined
            ) {

              fields.push(
                `${key} = ?`
              );

              values.push(
                req.body[key]
              );

            }

          });


          // ---------------------------------------------
          // UPDATE PASSWORD
          // ---------------------------------------------

          if (
            req.body.password &&
            req.body.password.trim() !== ""
          ) {

            const hashedPassword =
              await bcrypt.hash(
                req.body.password,
                10
              );


            fields.push(
              "password = ?"
            );

            values.push(
              hashedPassword
            );

          }


          // ---------------------------------------------
          // UPDATE PROFILE PHOTO
          // ---------------------------------------------

          if (
            req.files &&
            req.files["photo"] &&
            req.files["photo"][0]
          ) {

            const newPhoto =
              req.files["photo"][0].filename;


            fields.push(
              "photo = ?"
            );

            values.push(
              newPhoto
            );


            // Delete old photo
            if (existing.photo) {

              const oldPhotoPath =
                path.join(
                  uploadsDir,
                  existing.photo
                );


              fs.unlink(
                oldPhotoPath,
                () => {}
              );

            }

          }


          // ---------------------------------------------
          // UPDATE ID PHOTO
          // ---------------------------------------------

          if (
            req.files &&
            req.files["id_photo"] &&
            req.files["id_photo"][0]
          ) {

            const newIdPhoto =
              req.files["id_photo"][0].filename;


            fields.push(
              "id_photo = ?"
            );

            values.push(
              newIdPhoto
            );


            // Delete old ID photo
            if (existing.id_photo) {

              const oldIdPhotoPath =
                path.join(
                  uploadsDir,
                  existing.id_photo
                );


              fs.unlink(
                oldIdPhotoPath,
                () => {}
              );

            }

          }


          // No update data
          if (
            fields.length === 0
          ) {

            return res.status(400).json({
              success: false,
              message: "No fields provided to update"
            });

          }


          const sql = `
            UPDATE profiles
            SET ${fields.join(", ")}
            WHERE id = ?
          `;


          values.push(id);


          db.query(
            sql,
            values,
            (errUpdate, resultUpdate) => {

              if (errUpdate) {

                console.error(
                  "❌ UPDATE PROFILE ERROR:",
                  errUpdate
                );

                return res.status(500).json({
                  success: false,
                  message: "Database error"
                });

              }


              if (
                resultUpdate.affectedRows === 0
              ) {

                return res.status(404).json({
                  success: false,
                  message: "Profile not found"
                });

              }


              // Get updated profile
              const selectUpdatedSql = `
                SELECT ${PUBLIC_PROFILE_COLUMNS}
                FROM profiles
                WHERE id = ?
              `;


              db.query(
                selectUpdatedSql,
                [id],
                (err2, updatedRows) => {

                  if (err2) {

                    console.error(
                      "❌ GET UPDATED PROFILE ERROR:",
                      err2
                    );

                    return res.status(500).json({
                      success: false,
                      message: "Database error"
                    });

                  }


                  return res.json({

                    success: true,

                    message:
                      "✅ Profile updated successfully!",

                    user:
                      updatedRows[0]

                  });

                }
              );

            }
          );

        }
      );

    } catch (error) {

      console.error(
        "❌ PUT /api/profiles/:id ERROR:",
        error
      );


      return res.status(500).json({
        success: false,
        message: "Server error"
      });

    }

  }
);


// =====================================================
// DELETE PROFILE
// =====================================================

app.delete(
  "/api/profiles/:id",
  (req, res) => {

    const {
      id
    } = req.params;


    db.query(
      "SELECT * FROM profiles WHERE id = ?",
      [id],
      (errSelect, rows) => {

        if (errSelect) {

          console.error(
            "❌ DELETE SELECT ERROR:",
            errSelect
          );

          return res.status(500).json({
            success: false,
            message: "Database error"
          });

        }


        if (
          !rows ||
          rows.length === 0
        ) {

          return res.status(404).json({
            success: false,
            message: "Profile not found"
          });

        }


        const user = rows[0];


        db.query(
          "DELETE FROM profiles WHERE id = ?",
          [id],
          (err, result) => {

            if (err) {

              console.error(
                "❌ DELETE PROFILE ERROR:",
                err
              );

              return res.status(500).json({
                success: false,
                message: "Database error"
              });

            }


            // Delete profile photo
            if (user.photo) {

              fs.unlink(
                path.join(
                  uploadsDir,
                  user.photo
                ),
                () => {}
              );

            }


            // Delete ID photo
            if (user.id_photo) {

              fs.unlink(
                path.join(
                  uploadsDir,
                  user.id_photo
                ),
                () => {}
              );

            }


            return res.json({
              success: true,
              message: "Profile deleted successfully!"
            });

          }
        );

      }
    );

  }
);


// =====================================================
// DEFAULT ROUTE
// =====================================================

app.get("/", (req, res) => {

  res.sendFile(
    path.join(
      __dirname,
      "frontend",
      "index.html"
    )
  );

});


// =====================================================
// SERVER START
// =====================================================

const PORT =
  process.env.PORT || 5000;


app.listen(
  PORT,
  () => {

    console.log(
      `🚀 Server running on port ${PORT}`
    );

  }
);