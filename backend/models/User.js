// routes/users.js
import express from "express";
import bcrypt from "bcrypt";
import pool from "../db.js";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import cors from "cors";

const router = express.Router();
router.use(cors({ origin: "*" }));

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer config
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// Upload helper
const uploadPhoto = (file) =>
  new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    const stream = cloudinary.uploader.upload_stream(
      { folder: "users", resource_type: "image" },
      (err, result) => {
        if (err) return reject(err);
        resolve(result?.secure_url || null);
      }
    );
    stream.end(file.buffer);
  });

// Create user
router.post(
  "/users",
  upload.fields([
    { name: "photo1", maxCount: 1 },
    { name: "photo2", maxCount: 1 },
    { name: "photo3", maxCount: 1 },
    { name: "photo4", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const {
        name,
        email,
        password,
        gender,
        phone,
        age,
        bio,
        location,
        looking_for,
        premium_status,
        interests,
        date_of_birth,
      } = req.body;

      if (!name || !email || !password || !gender)
        return res.status(400).json({ error: "Missing required fields" });

      const passwordHash = await bcrypt.hash(password, 10);

      // Upload photos
      const photoUrls = await Promise.all([
        uploadPhoto(req.files?.photo1?.[0]),
        uploadPhoto(req.files?.photo2?.[0]),
        uploadPhoto(req.files?.photo3?.[0]),
        uploadPhoto(req.files?.photo4?.[0]),
      ]);

      // Insert into DB
      const result = await pool.query(
        `INSERT INTO users (
          name,email,password,gender,phone,age,bio,location,looking_for,
          photo1_url,photo2_url,photo3_url,photo4_url,
          premium_status,interests,date_of_birth,
          created_at, updated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW(),NOW())
        RETURNING *`,
        [
          name,
          email,
          passwordHash,
          gender,
          phone || null,
          age || null,
          bio || null,
          location || null,
          looking_for || null,
          photoUrls[0],
          photoUrls[1],
          photoUrls[2],
          photoUrls[3],
          premium_status === "true" || premium_status === true || false,
          interests ? JSON.parse(interests) : null,
          date_of_birth || null,
        ]
      );

      res.status(201).json({ success: true, user: result.rows[0], photos: photoUrls });
    } catch (err) {
      console.error("CREATE USER ERROR:", err);
      res.status(500).json({ error: "Database insert failed" });
    }
  }
);

// Get all users
router.get("/users/all", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM users ORDER BY id DESC");
    res.status(200).json({ users: rows });
  } catch (err) {
    console.error("FETCH USERS ERROR:", err);
    res.status(500).json({ error: "Database fetch failed" });
  }
});

export default router;
