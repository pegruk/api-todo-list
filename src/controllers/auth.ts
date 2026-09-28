import type { Request, Response } from "express";
import argon2 from "argon2";

import { registerAuth } from "../schemas/auth.js";
import { createUser } from "../repositories/users.js";
import { generateToken } from "../utils/jwt.js";

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

export async function register(request: Request, response: Response) {
  const validation = registerAuth.safeParse(request.body);

  if (validation.success === false) {
    return response.status(422).json({
      message: "Validation failed.",
      errors: validation.error.issues.map(({ path, message }) => ({ path, message })),
    });
  }

  const { name, email, password } = validation.data;

  try {
    const hashedPassword = await argon2.hash(password);
    const user = await createUser({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      hashedPassword,
    });

    const token = generateToken({ sub: user.id, name: user.name });

    return response.status(201).json({ message: "User registered successfully.", token });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return response.status(409).json({ message: "Email is already registered." });
    }

    console.error("Failed to register user", error);
    return response.status(500).json({ message: "Internal server error." });
  }
}

export async function login(request: Request, response: Response) {
  return token;
}
