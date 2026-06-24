const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./database.db"); // adjust path if needed

db.serialize(() => {
  db.run(`ALTER TABLE users ADD COLUMN reset_token TEXT`);
  db.run(`ALTER TABLE users ADD COLUMN reset_expires INTEGER`);
});

db.close(() => {
  console.log("✅ Users table updated successfully");
});
