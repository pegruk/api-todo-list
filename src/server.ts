import express from "express";
import { pool } from "./config/database.js";

const app = express();

async function testConnection() {
  try {
    await pool.query("SELECT NOW()");
    console.log("Deu tudo certo!");
  } catch (err) {
    console.log("Opa! alguma coisa deu errada.", err);
  }
}

app.get("/", (request, response) => {
  return response.json({ message: "Hello World!" });
});

testConnection();

app.listen(3333);
