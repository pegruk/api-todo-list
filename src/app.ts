import express from "express";
import { pool } from "./config/database.js";

const app = express();

app.use(express.json());

async function testConnection() {
  try {
    await pool.query("SELECT NOW()");
    console.log("The database is running");
  } catch (err) {
    console.log("was there an error ", err);
  }
}

app.get("/", (request, response) => {
  return response.status(200).json({ message: "Welcome to my first API" });
});

testConnection();

export default app;
