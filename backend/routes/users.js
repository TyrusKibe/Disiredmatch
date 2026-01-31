import express from "express";
import bcrypt from "bcrypt";
import pool from "../db.js"; // PostgreSQL pool
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import cors from "cors";

const router = express.Router();

// -------------------- CORS --------------------
router.use(cors({ origin: "*" }));

// -------------------- CLOUDINARY CONFIG --------------------
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// -------------------- MULTER CONFIG --------------------
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB max

// -------------------- HELPER: UPLOAD TO CLOUDINARY --------------------
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

// ==========================
// CREATE USER WITH PHOTOS
// ==========================
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
        age,
        location,
        phone,
        bio,
        looking_for,
        premium_status,
        interests,
        date_of_birth,
      } = req.body;

      if (!name || !email || !password || !gender) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const passwordHash = await bcrypt.hash(password, 10);

      // Upload all 4 photos
      const photoUrls = await Promise.all([
        uploadPhoto(req.files?.photo1?.[0]),
        uploadPhoto(req.files?.photo2?.[0]),
        uploadPhoto(req.files?.photo3?.[0]),
        uploadPhoto(req.files?.photo4?.[0]),
      ]);

      // Validate that all 4 photos are uploaded
      if (photoUrls.some((url) => !url)) {
        return res.status(400).json({ error: "All 4 photos must be uploaded" });
      }

      // --------- Fix for interests array ---------
      const interestsArray =
        interests && interests !== "[]"
          ? `{${JSON.parse(interests).map((i) => i.replace(/"/g, '\\"')).join(",")}}`
          : null;

      // Insert user into DB
      const result = await pool.query(
        `
        INSERT INTO users (
          name,email,password,gender,age,location,phone,bio,looking_for,
          photo1_url,photo2_url,photo3_url,photo4_url,
          premium_status,interests,date_of_birth,created_at,updated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW(),NOW())
        RETURNING id
        `,
        [
          name,
          email,
          passwordHash,
          gender,
          age || null,
          location || null,
          phone || null,
          bio || null,
          looking_for || null,
          ...photoUrls,
          premium_status === "true" || premium_status === true || false,
          interestsArray,
          date_of_birth || null,
        ]
      );

      res.status(201).json({
        success: true,
        userId: result.rows[0].id,
        photos: {
          photo1_url: photoUrls[0],
          photo2_url: photoUrls[1],
          photo3_url: photoUrls[2],
          photo4_url: photoUrls[3],
        },
      });
    } catch (err) {
      console.error("DB ERROR:", err);
      res.status(500).json({ error: "Database insert failed" });
    }
  }
);

// ==========================
// GET ALL USERS
// ==========================
router.get("/users/all", async (req, res) => {
  try {
    const allUsers = await pool.query(
      `
      SELECT *
      FROM users
      ORDER BY id DESC
      `
    );
    res.status(200).json({ users: allUsers.rows });
  } catch (err) {
    console.error("DB ERROR:", err);
    res.status(500).json({ error: "Database fetch failed" });
  }
});

export default router;
