const sqlite3 = require("sqlite3").verbose();
const path = require("path");

/* =========================
   SINGLE DATABASE INSTANCE
========================= */
const dbPath = process.env.DB_PATH || path.join(__dirname, "database.db");
const db = new sqlite3.Database(
  dbPath,
  err => {
    if (err) {
      console.error("❌ Database connection failed:", err.message);
    } else {
      console.log(`✅ SQLite database connected at ${dbPath}`);
    }
  }
);

/* =========================
   USERS TABLE (MASTER SCHEMA)
========================= */
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      email TEXT,
      name TEXT,
      contact TEXT,
      profile_pic TEXT,
      is_verified INTEGER DEFAULT 0,
      otp TEXT,
      reset_token TEXT,
      reset_token_expiry INTEGER
    )
  `);

  // Migration: Add columns if they don't exist
  const columns = [
    { name: "name", type: "TEXT" },
    { name: "contact", type: "TEXT" },
    { name: "profile_pic", type: "TEXT" },
    { name: "is_verified", type: "INTEGER DEFAULT 0" },
    { name: "otp", type: "TEXT" },
    { name: "reset_token", type: "TEXT" },
    { name: "reset_token_expiry", type: "INTEGER" }
  ];

  columns.forEach(col => {
    db.run(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type}`, err => {
      // Ignore error if column already exists
    });
  });
});

/* =========================
   ANALYSIS HISTORY TABLE
========================= */
db.run(`
  CREATE TABLE IF NOT EXISTS history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    total REAL,
    savings REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

module.exports = db;
