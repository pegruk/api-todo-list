import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request, Response } from "express";

import { createLoginHandler, createRegisterHandler } from "../src/controllers/auth.js";

type LoginBody = { email?: unknown; password?: unknown };

async function callLogin(body: LoginBody, overrides: {
  findUserByEmail?: (email: string) => Promise<{ id: string; name: string; password_hash: string } | null>;
  verifyPassword?: (hash: string, password: string) => Promise<boolean>;
  generateToken?: (payload: object) => string;
} = {}) {
  let statusCode = 0;
  let responseBody: unknown;

  const handler = createLoginHandler({
    findUserByEmail: overrides.findUserByEmail ?? (async () => ({
      id: "42",
      name: "Ada",
      password_hash: "argon-hash",
    })),
    verifyPassword: overrides.verifyPassword ?? (async () => true),
    generateToken: overrides.generateToken ?? (() => "test-token"),
  });

  const response = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: unknown) {
      responseBody = body;
      return this;
    },
  } as unknown as Response;

  await handler({ body } as Request, response);
  return { statusCode, body: responseBody };
}

test("returns a token for valid credentials and normalizes the email", async () => {
  let lookedUpEmail = "";
  let verified: [string, string] | undefined;
  let tokenPayload: object | undefined;

  const result = await callLogin(
    { email: "  ADA@EXAMPLE.COM ", password: "correct horse" },
    {
      findUserByEmail: async (email) => {
        lookedUpEmail = email;
        return { id: "42", name: "Ada", password_hash: "argon-hash" };
      },
      verifyPassword: async (hash, password) => {
        verified = [hash, password];
        return true;
      },
      generateToken: (payload) => {
        tokenPayload = payload;
        return "signed-token";
      },
    },
  );

  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.body, { token: "signed-token" });
  assert.equal(lookedUpEmail, "ada@example.com");
  assert.deepEqual(verified, ["argon-hash", "correct horse"]);
  assert.deepEqual(tokenPayload, { sub: "42", name: "Ada" });
});

test("returns the same unauthorized response when the email is unknown", async () => {
  const result = await callLogin(
    { email: "missing@example.com", password: "correct horse" },
    { findUserByEmail: async () => null },
  );

  assert.equal(result.statusCode, 401);
  assert.deepEqual(result.body, { message: "Invalid email or password." });
});

test("returns unauthorized when the password does not match", async () => {
  const result = await callLogin(
    { email: "ada@example.com", password: "wrong password" },
    { verifyPassword: async () => false },
  );

  assert.equal(result.statusCode, 401);
  assert.deepEqual(result.body, { message: "Invalid email or password." });
});

test("returns validation errors when required fields are invalid", async () => {
  const result = await callLogin({ email: "not-an-email", password: "short" });

  assert.equal(result.statusCode, 422);
  assert.deepEqual(result.body, {
    message: "Validation failed.",
    errors: [
      { path: ["email"], message: "Invalid email" },
      { path: ["password"], message: "Password must be at least 8 characters" },
    ],
  });
});

test("hides internal exception details from the response", async () => {
  const originalConsoleError = console.error;
  console.error = () => undefined;
  try {
    const result = await callLogin(
      { email: "ada@example.com", password: "correct horse" },
      { findUserByEmail: async () => { throw new Error("database secret detail"); } },
    );

    assert.equal(result.statusCode, 500);
    assert.deepEqual(result.body, { message: "Internal server error." });
    assert.equal(JSON.stringify(result.body).includes("database secret detail"), false);
  } finally {
    console.error = originalConsoleError;
  }
});

test("registers with a normalized email, a password hash, and a token", async () => {
  let persisted: { name: string; email: string; hashedPassword: string } | undefined;
  let signedPayload: object | undefined;
  let statusCode = 0;
  let responseBody: unknown;
  const handler = createRegisterHandler({
    createUser: async (data) => {
      persisted = data;
      return { id: "42", name: data.name };
    },
    findUserByEmail: async () => null,
    hashPassword: async (password) => `argon:${password}`,
    verifyPassword: async () => false,
    generateToken: (payload) => { signedPayload = payload; return "register-token"; },
  });
  const response = {
    status(code: number) { statusCode = code; return this; },
    json(body: unknown) { responseBody = body; return this; },
  } as unknown as Response;

  await handler({ body: { name: "Ada", email: " ADA@EXAMPLE.COM ", password: "correct horse" } } as Request, response);

  assert.equal(statusCode, 201);
  assert.deepEqual(responseBody, { token: "register-token" });
  assert.deepEqual(persisted, { name: "Ada", email: "ada@example.com", hashedPassword: "argon:correct horse" });
  assert.deepEqual(signedPayload, { sub: "42", name: "Ada" });
});

test("returns conflict for a duplicate registration email", async () => {
  let statusCode = 0;
  let responseBody: unknown;
  const duplicateError = Object.assign(new Error("duplicate"), { code: "23505" });
  const handler = createRegisterHandler({
    createUser: async () => { throw duplicateError; },
    findUserByEmail: async () => null,
    hashPassword: async () => "argon:hash",
    verifyPassword: async () => false,
    generateToken: () => "token",
  });
  const response = {
    status(code: number) { statusCode = code; return this; },
    json(body: unknown) { responseBody = body; return this; },
  } as unknown as Response;

  await handler({ body: { name: "Ada", email: "ada@example.com", password: "correct horse" } } as Request, response);
  assert.equal(statusCode, 409);
  assert.deepEqual(responseBody, { message: "Email is already registered." });
});
