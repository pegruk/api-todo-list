import type { Request, Response } from "express";
import argon2 from "argon2";

import { registerAuth, loginAuth } from "../schemas/auth.js";
import { createUser, findUserByEmail } from "../repositories/users.js";
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

type LoginUser = {
  id: string;
  name: string;
  password_hash: string;
};

type LoginDependencies = {
  findUserByEmail: (email: string) => Promise<LoginUser | null>;
  verifyPassword: (hash: string, password: string) => Promise<boolean>;
  generateToken: (payload: object) => string;
};

export function createLoginHandler({
  findUserByEmail,
  verifyPassword,
  generateToken,
}: LoginDependencies) {
  return async function login(request: Request, response: Response) {
  const validation = loginAuth.safeParse(request.body);

  if (validation.success === false) {
    return response.status(422).json({
      message: "Validation failed.",
      errors: validation.error.issues.map(({ path, message }) => ({ path, message })),
    });
  }

  const { email, password } = validation.data;
  try {
    const user = await findUserByEmail(email);

    if (!user) {
      return response.status(401).json({ message: "Invalid email or password." });
    }

    const validated = await verifyPassword(user.password_hash, password);

    if (!validated) {
      return response.status(401).json({ message: "Invalid email or password." });
    }

    const token = generateToken({ sub: user.id, name: user.name });

    return response.status(200).json({ message: "User logged successfully.", token });
  } catch (error) {
    console.error("Failed to log in", error);
    return response.status(500).json({ message: "Internal server error." });
  }
  };
}

export const login = createLoginHandler({
  findUserByEmail,
  verifyPassword: (hash, password) => argon2.verify(hash, password),
  generateToken,
});
