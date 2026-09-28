import { pool } from "../config/database.js";

type CreateDataUser = {
  name: string,
  email: string,
  hashedPassword: string
};

export type CreatedUser = {
  id: string;
  name: string;
  email: string;
};

export const createUser = async (data: CreateDataUser): Promise<CreatedUser> => {
  const result = await pool.query<CreatedUser>(
    `INSERT INTO users (name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, name, email`,
    [data.name, data.email, data.hashedPassword],
  );

  const user = result.rows[0];
  if (!user) {
    throw new Error("User insert returned no row");
  }

  return user;
};

export const findUserByEmail = async (email: string) => {
  const result = await pool.query(
    `SELECT id, name, email, password_hash FROM users WHERE email = $1`,
    [email.trim().toLowerCase()],
  );

  return result.rows[0] ?? null;
}

