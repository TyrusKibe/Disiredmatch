import express from "express";
import pool from "../db.js";

const router = express.Router();

/**
 * POST /api/messages
 * Save a message
 */
router.post("/", async (req, res) => {
  try {
    const { match_id, sender_id, receiver_id, content } = req.body;

    if (!match_id || !sender_id || !receiver_id || !content) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const result = await pool.query(
      `
      INSERT INTO messages (match_id, sender_id, receiver_id, content)
      VALUES ($1,$2,$3,$4)
      RETURNING *
      `,
      [match_id, sender_id, receiver_id, content]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("SAVE MESSAGE ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/messages/:matchId
 * Fetch chat history
 */
router.get("/:matchId", async (req, res) => {
  try {
    const { matchId } = req.params;

    const result = await pool.query(
      `
      SELECT *
      FROM messages
      WHERE match_id = $1
      ORDER BY created_at ASC
      `,
      [matchId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("FETCH MESSAGES ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router; // ✅ THIS LINE FIXES YOUR ERROR
