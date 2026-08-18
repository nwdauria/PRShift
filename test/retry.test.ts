import { test } from "node:test";
import assert from "node:assert/strict";
import { withRetry } from "../src/retry.js";

function errorWithStatus(status: number | undefined): Error {
  const err = new Error(`status ${status}`);
  (err as { status?: number }).status = status;
  return err;
}

test("returns the result on first success without retrying", async () => {
  let calls = 0;
  const result = await withRetry(async () => {
    calls += 1;
    return "ok";
  });
  assert.equal(result, "ok");
  assert.equal(calls, 1);
});

test("retries on a 5xx error and eventually succeeds", async () => {
  let calls = 0;
  const result = await withRetry(
    async () => {
      calls += 1;
      if (calls < 3) throw errorWithStatus(500);
      return "recovered";
    },
    { sleep: async () => {} },
  );
  assert.equal(result, "recovered");
  assert.equal(calls, 3);
});

test("retries on a 429 rate limit error", async () => {
  let calls = 0;
  await withRetry(
    async () => {
      calls += 1;
      if (calls < 2) throw errorWithStatus(429);
      return "ok";
    },
    { sleep: async () => {} },
  );
  assert.equal(calls, 2);
});

test("does not retry a 401 (bad token) and fails immediately", async () => {
  let calls = 0;
  await assert.rejects(
    withRetry(
      async () => {
        calls += 1;
        throw errorWithStatus(401);
      },
      { sleep: async () => {} },
    ),
  );
  assert.equal(calls, 1);
});

test("does not retry a 404", async () => {
  let calls = 0;
  await assert.rejects(
    withRetry(
      async () => {
        calls += 1;
        throw errorWithStatus(404);
      },
      { sleep: async () => {} },
    ),
  );
  assert.equal(calls, 1);
});

test("gives up after the configured number of retries", async () => {
  let calls = 0;
  await assert.rejects(
    withRetry(
      async () => {
        calls += 1;
        throw errorWithStatus(500);
      },
      { retries: 2, sleep: async () => {} },
    ),
  );
  assert.equal(calls, 3); // initial attempt + 2 retries
});

test("treats a network error (no status) as retryable", async () => {
  let calls = 0;
  const result = await withRetry(
    async () => {
      calls += 1;
      if (calls < 2) throw new Error("ECONNRESET");
      return "ok";
    },
    { sleep: async () => {} },
  );
  assert.equal(result, "ok");
  assert.equal(calls, 2);
});
