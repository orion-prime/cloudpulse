const bcrypt = require("bcrypt");
const crypto = require("crypto");
const db = require("./db");
const mailer = require("./mailer");

/* =========================
   HELPERS
========================= */
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();
const generateToken = () => crypto.randomBytes(32).toString("hex");

/* =========================
   SIGNUP
========================= */
exports.signup = async (req, res) => {
  const { username, password, email } = req.body;
  console.log(`[Debug] Signup request for: ${username} (${email})`);

  if (!username || !password || !email) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const hash = bcrypt.hashSync(password, 10);
  const otp = generateOTP();

  db.run(
    "INSERT INTO users (username, password, email, otp, is_verified) VALUES (?, ?, ?, ?, 0)",
    [username, hash, email, otp],
    async function(err) {
      if (err) {
        console.error("[Signup DB Error]", err.message);
        const errorMessage = err.message.includes("UNIQUE constraint failed") 
          ? "Username already exists. If you haven't verified your email, please try logging in to trigger a new OTP." 
          : "Signup failed: " + err.message;
        return res.status(400).json({ error: errorMessage });
      }

      const userId = this.lastID;

      try {
        await mailer.sendOTPEmail(email, otp);
        res.status(200).json({ success: true, message: "OTP sent to email", email });
      } catch (e) {
        console.error("[Signup Mail Error]", e.message);
        // Rollback: delete the user if email fail so they can try again
        db.run("DELETE FROM users WHERE id = ?", [userId]);
        res.status(500).json({ 
          error: "Failed to send OTP email. Please check your .env EMAIL settings and ensure you're using a Gmail App Password." 
        });
      }
    }
  );
};

/* =========================
   VERIFY OTP
========================= */
exports.verifyOTP = (req, res) => {
  const { email, otp } = req.body;

  db.get(
    "SELECT * FROM users WHERE email = ? AND otp = ?",
    [email, otp],
    (err, user) => {
      if (err || !user) {
        return res.status(400).json({ error: "Invalid OTP" });
      }

      db.run(
        "UPDATE users SET is_verified = 1, otp = NULL WHERE id = ?",
        [user.id],
        (updateErr) => {
          if (updateErr) return res.status(500).json({ error: "Verification failed" });
          res.status(200).json({ success: true, redirect: "/login.html" });
        }
      );
    }
  );
};

/* =========================
   RESEND OTP
========================= */
exports.resendOTP = (req, res) => {
  const { email } = req.body;
  const otp = generateOTP();

  db.run(
    "UPDATE users SET otp = ? WHERE email = ?",
    [otp, email],
    async (err) => {
      if (err) return res.status(500).json({ error: "Update failed" });
      
      try {
        await mailer.sendOTPEmail(email, otp);
        res.status(200).json({ success: true, message: "New OTP sent" });
      } catch (e) {
        res.status(500).json({ error: "Failed to send email" });
      }
    }
  );
};

/* =========================
   LOGIN
========================= */
exports.login = (req, res) => {
  const { username, password } = req.body;

  db.get(
    "SELECT * FROM users WHERE username = ?",
    [username],
    (err, user) => {
      if (err || !user) {
        return res.status(401).json({ error: "Invalid username or password" });
      }

      if (user.is_verified === 0) {
        return res.status(403).json({ 
          error: "Email not verified", 
          needsVerification: true, 
          email: user.email 
        });
      }

      const match = bcrypt.compareSync(password, user.password);
      if (!match) {
        return res.status(401).json({ error: "Invalid username or password" });
      }

      req.session.user = user.username;
      res.status(200).json({ success: true, redirect: "/dashboard.html" });
    }
  );
};

/* =========================
   FORGOT PASSWORD
========================= */
exports.forgotPassword = (req, res) => {
  const { email } = req.body;
  console.log(`[Debug] Forgot password request for: ${email}`);
  const token = generateToken();
  const expiry = Date.now() + 3600000; // 1 hour

  db.run(
    "UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE email = ?",
    [token, expiry, email],
    async function(err) {
      if (err) return res.status(500).json({ error: "Database error" });
      if (this.changes === 0) return res.status(404).json({ error: "Email not found" });

      try {
        await mailer.sendResetEmail(email, token);
        res.status(200).json({ success: true, message: "Reset link sent to email" });
      } catch (e) {
        res.status(500).json({ error: "Failed to send email" });
      }
    }
  );
};

/* =========================
   RESET PASSWORD
========================= */
exports.submitResetPassword = (req, res) => {
  const { token, password } = req.body;

  db.get(
    "SELECT * FROM users WHERE reset_token = ? AND reset_token_expiry > ?",
    [token, Date.now()],
    (err, user) => {
      if (err || !user) {
        return res.status(400).json({ error: "Invalid or expired token" });
      }

      const hash = bcrypt.hashSync(password, 10);
      db.run(
        "UPDATE users SET password = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?",
        [hash, user.id],
        (updateErr) => {
          if (updateErr) return res.status(500).json({ error: "Update failed" });
          res.status(200).json({ success: true, message: "Password updated" });
        }
      );
    }
  );
};

/* =========================
   AUTH GUARD
========================= */
exports.authGuard = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect("/login.html");
  }
  next();
};

