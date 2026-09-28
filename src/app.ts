import express from "express";
import { pool } from "./config/database.js";
import authRoutes from "./routes/auth.js";

const app = express();

app.use(express.json());
app.use(authRoutes);

app.get("/", (req, res) => {
  return res.status(200).json({ message: "Hello World!" });
});

async function testConnection() {
  try {
    await pool.query("SELECT NOW()");
    console.log("The database is running");
  } catch (err) {
    console.log("was there an error ", err);
  }
}

testConnection();

export default app;
