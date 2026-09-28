import type { Request, Response } from "express";
import argon2 from "argon2";

import { registerAuth, loginAuth } from "../schemas/auth.js";
import { createUser, findUserByEmail } from "../repositories/users.js";
import { generateToken } from "../utils/jwt.js";

type AuthUser = { id: string; name: string; password_hash: string };

type AuthDependencies = {
  createUser: (data: { name: string; email: string; hashedPassword: string }) => Promise<{ id: string; name: string }>;
  findUserByEmail: (email: string) => Promise<AuthUser | null>;
  hashPassword: (password: string) => Promise<string>;
  verifyPassword: (hash: string, password: string) => Promise<boolean>;
  generateToken: (payload: object) => string;
};

function validationResponse(response: Response, issues: { path: PropertyKey[]; message: string }[]) {
  return response.status(422).json({
    message: "Validation failed.",
    errors: issues.map(({ path, message }) => ({ path, message })),
  });
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

export function createRegisterHandler(dependencies: AuthDependencies) {
  return async function register(request: Request, response: Response) {
    const validation = registerAuth.safeParse(request.body);
    if (!validation.success) return validationResponse(response, validation.error.issues);

    const { name, email, password } = validation.data;
    try {
      const hashedPassword = await dependencies.hashPassword(password);
      const user = await dependencies.createUser({
        name,
        email,
        hashedPassword,
      });
      const token = dependencies.generateToken({ sub: user.id, name: user.name });
      return response.status(201).json({ token });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return response.status(409).json({ message: "Email is already registered." });
      }
      console.error("Failed to register user", error);
      return response.status(500).json({ message: "Internal server error." });
    }
  };
}

export function createLoginHandler(dependencies: Pick<AuthDependencies, "findUserByEmail" | "verifyPassword" | "generateToken">) {
  return async function login(request: Request, response: Response) {
    const validation = loginAuth.safeParse(request.body);
    if (!validation.success) return validationResponse(response, validation.error.issues);

    const { email, password } = validation.data;
    try {
      const user = await dependencies.findUserByEmail(email);
      if (!user || !(await dependencies.verifyPassword(user.password_hash, password))) {
        return response.status(401).json({ message: "Invalid email or password." });
      }

      const token = dependencies.generateToken({ sub: user.id, name: user.name });
      return response.status(200).json({ token });
    } catch (error) {
      console.error("Failed to log in", error);
      return response.status(500).json({ message: "Internal server error." });
    }
  };
}

const dependencies: AuthDependencies = {
  createUser,
  findUserByEmail,
  hashPassword: (password) => argon2.hash(password),
  verifyPassword: (hash, password) => argon2.verify(hash, password),
  generateToken,
};

export const register = createRegisterHandler(dependencies);
export const login = createLoginHandler(dependencies);
