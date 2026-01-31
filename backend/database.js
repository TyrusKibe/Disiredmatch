// database.js
import { Sequelize } from "sequelize";
import dotenv from "dotenv";

dotenv.config(); // Loads your .env

// Use DATABASE_URL from .env (your exact Render.com connection)
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: "postgres",
  protocol: "postgres",
  logging: false,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false, // Needed for Render.com Postgres
    },
  },
});

try {
  await sequelize.authenticate();
  console.log("✅ Database connected successfully");
} catch (err) {
  console.error("❌ Database connection error:", err);
}

export default sequelize;
