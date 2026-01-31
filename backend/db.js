// db.js
import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  host: "dpg-d5jadvmr433s7391134g-a.virginia-postgres.render.com",
  user: "desiredmatch_db_user",
  password: "hjrcB9lgTECjvYBcBxetITWXJLTabXlx",
  database: "desiredmatch_db",
  port: 5432,
  ssl: { rejectUnauthorized: false },
});

// Test connection
pool.connect()
  .then(client => {
    console.log("✅ Connected to PostgreSQL successfully");
    client.release();
  })
  .catch(err => console.error("❌ PostgreSQL connection error:", err));

export default pool;
