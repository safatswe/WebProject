# 🎓 SUST Tutor

**SUST Tutor** is a web-based tutor management and discovery platform designed to connect **SUST student tutors** with students and guardians in Sylhet.

The platform allows tutors to create profiles with their academic and contact information, while users can browse, search, filter, and view tutor profiles based on their requirements.

---

## 📌 Project Overview

Finding a suitable private tutor can be difficult because information is often scattered across different sources.

**SUST Tutor** provides a centralized platform where SUST students can create tutor profiles, and students/guardians can easily find suitable tutors.

The system includes tutor registration, login, profile management, profile search and filtering, image upload, WhatsApp contact, and a contact form with email functionality.

---

## ✨ Features

### 👨‍🏫 Tutor Profile Management
- Create a tutor profile
- Add personal and academic information
- Upload profile photo
- Upload ID photo
- Add department information
- Add subjects to teach
- Add salary range
- Add WhatsApp number
- Add available time
- Add information about yourself
- Add introduction video link
- Edit existing profile
- Delete profile

### 🔍 Profile Search & Filtering
Users can browse available tutor profiles and search using:
- Department
- Subject

The platform provides a **Show Profiles** section where tutor profiles can be displayed and filtered.

### 🔐 Authentication
- Tutor registration
- Login system
- Password hashing using `bcrypt`
- Email and password-based authentication
- Profile information returned after successful login

### 📱 WhatsApp Contact
Tutor profiles contain a WhatsApp number so that students or guardians can directly contact tutors.

### 📧 Contact Us
The website includes a **Contact Us** form. Submitted messages are processed by the backend and sent through the **Resend email service**.

### 🖼️ Image Upload
The application supports image uploads for:
- Tutor profile photos
- ID photos

Uploaded files are stored in the project's `uploads` directory and served through the backend.

### 📱 Responsive Interface
The frontend uses HTML, CSS, and Bootstrap to create the user interface and responsive layouts.

---

## 🛠️ Technologies Used

**Frontend:** HTML5, CSS3, JavaScript, Bootstrap 5.3.3, Font Awesome

**Backend:** Node.js, Express.js, Multer, bcrypt, Resend, dotenv, CORS

**Database:** MySQL, MySQL2

**Development Tools:** VS Code, Git, GitHub, npm, Postman

---

## 🏗️ Project Architecture

```text
                    ┌─────────────────────┐
                    │        User          │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │      Frontend        │
                    │ HTML / CSS / JS      │
                    │     Bootstrap        │
                    └──────────┬──────────┘
                               │
                         HTTP Requests
                               │
                               ▼
                    ┌─────────────────────┐
                    │       Backend         │
                    │ Node.js + Express.js │
                    └───────┬─────┬───────┘
                            │     │
                   ┌────────┘     └─────────┐
                   ▼                        ▼
          ┌─────────────────┐      ┌─────────────────┐
          │      MySQL       │      │  Resend Email   │
          │    Database      │      │     Service     │
          └─────────────────┘      └─────────────────┘
```

---

## 📂 Project Structure

```text
WebProject/
│
├── frontend/
│   ├── index.html
│   ├── create.html
│   ├── login.html
│   ├── profile.html
│   ├── style.css
│   ├── script.js
│   ├── bootstrap-5.3.3-dist/
│   └── uploads/
│
├── uploads/
│
├── server.js
├── package.json
├── package-lock.json
├── .env.example
├── .gitignore
└── README.md
```

> The exact files/folders may vary depending on the latest version of the project.

---

## 🗄️ Database

The backend uses **MySQL** for storing tutor profile information.

The `profiles` table contains fields such as:

```text
id, full_name, email, password, address, department, salary_range,
subject_to_teach, photo, whatsapp_number, id_photo, available_time,
available, about_me, intro_video_link, reset_token, reset_token_expiry,
is_verified, verification_token, verification_expires, verification_attempts
```

Passwords are stored as hashed values using **bcrypt**, rather than storing plain-text passwords.

---

## 🔑 Environment Variables

Sensitive configuration is kept outside the source code using environment variables.

Create a `.env` file in the project root:

```env
RESEND_API_KEY=your_resend_api_key

DB_HOST=your_database_host
DB_USER=your_database_user
DB_PASSWORD=your_database_password
DB_NAME=profiles_db
DB_PORT=3306
```

The repository contains `.env.example` as a template.

> ⚠️ **Important:** Do **not** commit the actual `.env` file to GitHub. Your `.gitignore` should contain `.env`.

---

## 🚀 How to Run Locally

**1. Clone the repository**
```bash
git clone https://github.com/safatswe/WebProject.git
```

**2. Go to the project directory**
```bash
cd WebProject
```

**3. Install dependencies**
```bash
npm install
```

**4. Configure environment variables**

Create a `.env` file and add your Resend API key, MySQL host, username, password, database name, and port.

**5. Create the MySQL database**

Create a MySQL database named `profiles_db`, then create the required `profiles` table according to the project's database structure.

**6. Start the server**
```bash
npm start
```

The application runs at:
```text
http://localhost:5000
```

---

## 🔌 Main API Endpoints

| Method | Endpoint | Description |
|--------|----------|--------------|
| `POST` | `/api/profiles` | Creates a new tutor profile with profile and ID image uploads |
| `POST` | `/api/login` | Authenticates a tutor using email and password |
| `GET` | `/api/profiles` | Returns tutor profiles (supports `?department=` and `?subject=` filters) |
| `GET` | `/api/profiles/:id` | Returns a specific tutor profile |
| `PUT` | `/api/profiles/:id` | Updates an existing tutor profile |
| `DELETE` | `/api/profiles/:id` | Deletes a tutor profile |
| `POST` | `/send-email` | Processes the Contact Us form and sends the message via Resend |

**Filtering examples:**
```text
/api/profiles?department=SWE
/api/profiles?subject=Math
```

---

## 🔄 Application Flow

**Tutor Registration**
```text
Tutor → Registration Form → Upload Photo/ID → Backend → Password Hashing → MySQL Database → Profile Created
```

**Tutor Login**
```text
Login → Email + Password → Backend → MySQL → bcrypt Verification → Login Successful → Profile/Home Page
```

**Profile Search**
```text
Show Profiles → Enter Department/Subject → Search → Backend API → MySQL Query → Filtered Profiles
```

---

## 📧 Contact System

The Contact Us functionality uses the **Resend API**. When a user submits their name, email, and message, the frontend sends the data to `POST /send-email`, and the backend processes the request and sends the message to the configured email addresses.

---

## 📸 Image Handling

Tutor profile images are uploaded using **Multer**. Uploaded files are stored in `uploads/` and made accessible through `/uploads/<filename>`.

---

## 🎯 Project Goals

- Make tutor discovery easier
- Provide a centralized tutor profile system
- Help students and guardians find suitable tutors
- Allow SUST students to advertise their tutoring services
- Provide direct communication through WhatsApp
- Provide a simple and user-friendly interface

---

## 🔮 Future Improvements

- Tutor verification system
- Email verification
- Password reset functionality
- Advanced search & more filtering options
- Tutor rating and review system
- Admin dashboard
- Tutor availability management
- Better authentication and authorization
- Cloud-based image storage
- Online deployment
- Improved mobile responsiveness

---

## 👨‍💻 Developer

**SUST Tutor** — a full-stack web project built using HTML, CSS, JavaScript, Bootstrap, Node.js, Express.js, MySQL, and Resend.

**GitHub Repository:** [github.com/safatswe/WebProject](https://github.com/safatswe/WebProject.git)

---

## 📄 License

This project is developed as an academic/project portfolio application.
