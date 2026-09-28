import assert from "node:assert/strict";
import { test } from "node:test";
import type { Request, Response } from "express";

import { createTodoHandlers } from "../src/controllers/todos.js";
import { createAuthenticateMiddleware } from "../src/middleware/authenticate.js";
import type { Todo } from "../src/repositories/todos.js";

const sampleTodo: Todo = { id: "7", title: "Read docs", description: "JWT" };

function makeResponse() {
  let statusCode = 200;
  let body: unknown;
  let ended = false;
  const response = {
    status(code: number) { statusCode = code; return this; },
    json(value: unknown) { body = value; return this; },
    end() { ended = true; return this; },
  } as unknown as Response;
  return { response, result: () => ({ statusCode, body, ended }) };
}

function handlers(overrides: Partial<Parameters<typeof createTodoHandlers>[0]> = {}) {
  return createTodoHandlers({
    createTodo: async (_userId, input) => ({ id: "7", title: input.title, description: input.description ?? null }),
    listTodos: async () => ({ data: [sampleTodo], total: 1 }),
    findTodoOwner: async () => "user-1",
    updateTodo: async (_id, _userId, input) => ({ id: "7", title: input.title, description: input.description ?? null }),
    deleteTodo: async () => true,
    ...overrides,
  });
}

async function call(handler: (request: Request, response: Response) => unknown, options: {
  body?: unknown; params?: Record<string, string>; query?: Record<string, string>; userId?: string;
} = {}) {
  const { response, result } = makeResponse();
  await handler({
    body: options.body ?? {},
    params: options.params ?? {},
    query: options.query ?? {},
    userId: options.userId ?? "user-1",
  } as unknown as Request, response);
  return result();
}

test("creates a todo for the authenticated user", async () => {
  let owner = "";
  const result = await call(handlers({
    createTodo: async (userId, input) => {
      owner = userId;
      return { id: "7", title: input.title, description: input.description ?? null };
    },
  }).create, { body: { title: "  Read docs  ", description: "JWT" } });

  assert.equal(owner, "user-1");
  assert.equal(result.statusCode, 201);
  assert.deepEqual(result.body, sampleTodo);
});

test("rejects empty todo titles", async () => {
  const result = await call(handlers().create, { body: { title: "  " } });
  assert.equal(result.statusCode, 422);
});

test("lists todos with validated pagination", async () => {
  let args: [string, number, number] | undefined;
  const result = await call(handlers({
    listTodos: async (...received) => {
      args = received;
      return { data: [sampleTodo], total: 21 };
    },
  }).list, { query: { page: "3", limit: "10" } });

  assert.deepEqual(args, ["user-1", 10, 20]);
  assert.deepEqual(result.body, { data: [sampleTodo], total: 21, page: 3, limit: 10 });
});

test("rejects out-of-range pagination", async () => {
  const result = await call(handlers().list, { query: { page: "0", limit: "101" } });
  assert.equal(result.statusCode, 422);
});

test("forbids updating another user's todo", async () => {
  const result = await call(handlers({ findTodoOwner: async () => "user-2" }).update, {
    params: { id: "7" },
    body: { title: "Changed" },
  });
  assert.equal(result.statusCode, 403);
  assert.deepEqual(result.body, { message: "Forbidden" });
});

test("updates an owned todo", async () => {
  const result = await call(handlers().update, {
    params: { id: "7" },
    body: { title: "Updated title", description: "Updated description" },
  });
  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.body, { id: "7", title: "Updated title", description: "Updated description" });
});

test("returns 404 when the todo does not exist", async () => {
  const result = await call(handlers({ findTodoOwner: async () => null }).update, {
    params: { id: "999" },
    body: { title: "Changed" },
  });
  assert.equal(result.statusCode, 404);
});

test("deletes an owned todo with an empty 204 response", async () => {
  const result = await call(handlers().remove, { params: { id: "7" } });
  assert.equal(result.statusCode, 204);
  assert.equal(result.body, undefined);
  assert.equal(result.ended, true);
});

test("forbids deleting another user's todo", async () => {
  const result = await call(handlers({ findTodoOwner: async () => "user-2" }).remove, {
    params: { id: "7" },
  });
  assert.equal(result.statusCode, 403);
  assert.deepEqual(result.body, { message: "Forbidden" });
});

test("rejects missing and invalid bearer tokens with the required 401 body", () => {
  for (const authorization of [undefined, "Bearer bad-token"]) {
    const { response, result } = makeResponse();
    let advanced = false;
    const request = { header: () => authorization } as unknown as Request;
    const middleware = createAuthenticateMiddleware((token) => {
      if (token === "valid") return { sub: "user-1" };
      throw new Error("invalid token");
    });
    middleware(request, response, () => { advanced = true; });

    assert.equal(result().statusCode, 401);
    assert.deepEqual(result().body, { message: "Unauthorized" });
    assert.equal(advanced, false);
  }
});

test("accepts a valid bearer token and attaches its subject", () => {
  const { response, result } = makeResponse();
  let advanced = false;
  const request = { header: () => "Bearer valid" } as unknown as Request & { userId?: string };
  createAuthenticateMiddleware(() => ({ sub: "user-1" }))(request, response, () => { advanced = true; });

  assert.equal(result().statusCode, 200);
  assert.equal(request.userId, "user-1");
  assert.equal(advanced, true);
});
