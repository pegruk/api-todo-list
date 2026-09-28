import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";

import app from "../src/app.js";

async function withServer<T>(run: (baseUrl: string) => Promise<T>): Promise<T> {
  const server = app.listen(0);
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind to a TCP port.");
  try {
    return await run(`http://127.0.0.1:${address.port}`);
  } finally {
    server.close();
    await once(server, "close");
  }
}

test("serves the health route", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { message: "Hello World!" });
  });
});

test("protects the mounted todo routes", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/todos`);
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { message: "Unauthorized" });
  });
});

test("returns a client error for malformed JSON", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{invalid",
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { message: "Invalid JSON body." });
  });
});
