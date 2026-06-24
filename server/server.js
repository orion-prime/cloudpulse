require("dotenv").config();
const { generateLLMInsight } = require("./llmEngine");
const { sendAnomalyEmail } = require("./mailer");

const express = require("express");
const session = require("express-session");
const multer = require("multer");
const path = require("path");
const { exec } = require("child_process");

// Paths for the AI engine (venv Python + scripts)
const AI_ENGINE_DIR = path.resolve(__dirname, "../ai_engine");
const ANALYZE_SCRIPT = path.join(AI_ENGINE_DIR, "analyze.py");

const fs = require("fs");
let PYTHON_PATH = "python3"; // Default fallback for Linux Docker / Render

const winVenvPath = path.join(AI_ENGINE_DIR, ".venv/Scripts/python.exe");
const nixVenvPath = path.join(AI_ENGINE_DIR, ".venv/bin/python");

if (fs.existsSync(winVenvPath)) {
  PYTHON_PATH = winVenvPath;
} else if (fs.existsSync(nixVenvPath)) {
  PYTHON_PATH = nixVenvPath;
} else {
  PYTHON_PATH = process.env.PYTHON_PATH || "python";
}

const auth = require("./auth");
const db = require("./db");

const app = express();
const nodemailer = require("nodemailer");





/* =========================
   STATIC FILES (DO NOT TOUCH)
========================= */
app.use(express.static(path.join(__dirname, "../public")));

app.get("/", (req, res) => {
  res.redirect("/login.html");
});

/* =========================
   MIDDLEWARE
========================= */
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: "cloudpulse_secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 // 24 hours
  }
}));

/* =========================
   AUTH ROUTES
========================= */
app.post("/signup", auth.signup);
app.post("/login", auth.login);
app.post("/verify-otp", auth.verifyOTP);
app.post("/resend-otp", auth.resendOTP);
app.post("/forgot-password", auth.forgotPassword);
app.post("/submit-reset", auth.submitResetPassword);

/* =========================
   LOGOUT
========================= */
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login.html");
  });
});

/* =========================
   FILE UPLOADS
========================= */
const upload = multer({
  dest: path.join(__dirname, "../uploads")
});

/* =========================
   AI ANALYSIS
========================= */
/* =========================
   AI ANALYSIS
========================= */
app.post("/analyze", auth.authGuard, upload.single("file"), (req, res) => {

  // Use the .venv Python directly — equivalent to activating the venv.
  // cwd is set to ai_engine so sibling imports (preprocessing, anomaly_models…) resolve.
  const cmd = `"${PYTHON_PATH}" "${ANALYZE_SCRIPT}" "${req.file.path}"`;

  exec(cmd, { cwd: AI_ENGINE_DIR }, async (err, stdout, stderr) => {
    if (err) {
      console.error("[AI Engine Error]", stderr || err.message);
      return res.status(500).json({ error: "AI failed" });
    }

    let result;

    try {
      result = JSON.parse(stdout);
    } catch (e) {
      console.error("Invalid Python output:", stdout);
      return res.status(500).json({ error: "Invalid AI output" });
    }

    let aiInsight = null;

    try {
      if (result.anomalies && result.anomalies.length > 0) {

        aiInsight = await generateLLMInsight(result);

        db.get(
          "SELECT email FROM users WHERE username=?",
          [req.session.user],
          async (err, row) => {
            if (row && row.email) {
              await sendAnomalyEmail(row.email, result, aiInsight);
            }
          }
        );

      }
    } catch (e) {
      console.error("LLM insight failed:", e);
    }

    // Save history
    db.run(
      "INSERT INTO history (username, total, savings) VALUES (?, ?, ?)",
      [
        req.session.user,
        result.total_spend,
        result.estimated_savings
      ]
    );

    res.json({
      ...result,
      ai_insight: aiInsight
    });

  });

});


/* =========================
   USER PROFILE
========================= */
app.get("/profile", auth.authGuard, (req, res) => {
  db.get(
    `SELECT username, name, email, contact, profile_pic
     FROM users WHERE username = ?`,
    [req.session.user],
    (err, row) => {
      if (err || !row) return res.json({});
      res.json(row);
    }
  );
});



/* =========================
   ANALYSIS HISTORY
========================= */



app.get("/history", auth.authGuard, (req, res) => {
  db.all(
    "SELECT * FROM history WHERE username = ? ORDER BY created_at DESC",
    [req.session.user],
    (err, rows) => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json(rows);
    }
  );
});

app.post("/clear-history", auth.authGuard, (req, res) => {
  db.run(
    "DELETE FROM history WHERE username = ?",
    [req.session.user],
    err => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json({ success: true });
    }
  );
});



/* =========================
   PASSWORD RESET (SIDEBAR/SETTINGS)
 ========================= */
app.post("/initiate-reset", auth.authGuard, (req, res) => {
  console.log(`[Debug] Password reset initiated for: ${req.session.user}`);
  // This is used from within the dashboard settings
  db.get("SELECT email FROM users WHERE username=?", [req.session.user], async (err, row) => {
    if (row && row.email) {
      req.body.email = row.email;
      return auth.forgotPassword(req, res);
    }
    res.status(400).json({ error: "Email not found" });
  });
});

app.post("/settings", auth.authGuard, (req, res) => {
  const { name, email, contact } = req.body;

  db.run(
    "UPDATE users SET name=?, email=?, contact=? WHERE username=?",
    [name, email, contact, req.session.user],
    err => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json({ success: true });
    }
  );
});

app.get("/settings", auth.authGuard, (req, res) => {
  db.get(
    "SELECT username, name, email, contact FROM users WHERE username=?",
    [req.session.user],
    (err, row) => {
      if (err) return res.status(500).json({ error: "DB error" });
      res.json(row);
    }
  );
});


/* =========================
   SERVER START
========================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});

