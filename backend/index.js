import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import pool from "./db.js";
import bcrypt from "bcrypt";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import jwt from "jsonwebtoken";
import http from "http";
import { Server } from "socket.io";
import messagesRoutes from "./routes/messages.js"; // ✅ REST CHAT ROUTES

dotenv.config();
const app = express();

/* -------------------- MIDDLEWARE -------------------- */
app.use(cors());
app.use(express.json());

/* -------------------- ROUTES -------------------- */
app.use("/messages", messagesRoutes); // ✅ REST chat routes

/* -------------------- CLOUDINARY -------------------- */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/* -------------------- MULTER -------------------- */
const upload = multer({ storage: multer.memoryStorage() });

/* -------------------- TEST -------------------- */
app.get("/", (req, res) => {
  res.send("Backend is alive ✅");
});

/* -------------------- CREATE USER -------------------- */
app.post(
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

      if (!name || !email || !password || !gender) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const uploadPhoto = (file) =>
        new Promise((resolve, reject) => {
          if (!file) return resolve(null);
          const stream = cloudinary.uploader.upload_stream(
            { folder: "users" },
            (err, result) => {
              if (err) reject(err);
              else resolve(result.secure_url);
            }
          );
          stream.end(file.buffer);
        });

      const photo1_url = await uploadPhoto(req.files?.photo1?.[0]);
      const photo2_url = await uploadPhoto(req.files?.photo2?.[0]);
      const photo3_url = await uploadPhoto(req.files?.photo3?.[0]);
      const photo4_url = await uploadPhoto(req.files?.photo4?.[0]);

      // --------- Fix for interests array ---------
      const interestsArray =
        interests && interests !== "[]"
          ? `{${JSON.parse(interests).map((i) => i.replace(/"/g, '\\"')).join(",")}}`
          : null;

      const result = await pool.query(
        `
        INSERT INTO users (
          name,email,password,gender,phone,age,bio,location,looking_for,
          photo1_url,photo2_url,photo3_url,photo4_url,
          premium_status,interests,date_of_birth
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        RETURNING *
        `,
        [
          name,
          email,
          hashedPassword,
          gender,
          phone || null,
          age || null,
          bio || null,
          location || null,
          looking_for || null,
          photo1_url,
          photo2_url,
          photo3_url,
          photo4_url,
          premium_status === "true" || premium_status === true || false,
          interestsArray,
          date_of_birth || null,
        ]
      );

      res.status(201).json({
        message: "User created successfully ✅",
        user: result.rows[0],
        photos: { photo1_url, photo2_url, photo3_url, photo4_url },
      });
    } catch (err) {
      console.error("SERVER ERROR:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

/* -------------------- LOGIN -------------------- */
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });

    const userResult = await pool.query("SELECT * FROM users WHERE email=$1", [email]);
    const user = userResult.rows[0];
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.json({ message: "Login successful ✅", token, user });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* -------------------- GET ALL USERS -------------------- */
app.get("/users/all", async (req, res) => {
  try {
    const users = await pool.query("SELECT * FROM users ORDER BY id DESC");
    res.json({ users: users.rows });
  } catch (err) {
    console.error("DB ERROR:", err);
    res.status(500).json({ error: "Database error" });
  }
});

/* ==================== SOCKET.IO ==================== */
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

io.on("connection", (socket) => {
  console.log("💬 Socket connected:", socket.id);

  socket.on("joinRoom", ({ userId, otherUserId }) => {
    const room = [userId, otherUserId].sort().join("_");
    socket.join(room);
  });

  socket.on("sendMessage", async ({ senderId, receiverId, content }) => {
    try {
      const room = [senderId, receiverId].sort().join("_");
      const { rows } = await pool.query(
        `
        INSERT INTO messages
        (sender_id, receiver_id, content, read, sent_at, metadata)
        VALUES ($1,$2,$3,false,NOW(),'{}')
        RETURNING *
        `,
        [senderId, receiverId, content]
      );
      io.to(room).emit("newMessage", rows[0]);
    } catch (err) {
      console.error("SEND MESSAGE ERROR:", err);
    }
  });

  socket.on("disconnect", () => console.log("🔌 Socket disconnected:", socket.id));
});

/* -------------------- SERVER START -------------------- */
const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () => console.log(`🚀 Server running on port ${PORT}`));
