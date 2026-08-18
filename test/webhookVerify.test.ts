import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifySignature } from "../src/webhookVerify.js";

test("accepts a valid signature", () => {
  const secret = "topsecret";
  const payload = Buffer.from(JSON.stringify({ hello: "world" }));
  const sig = "sha256=" + createHmac("sha256", secret).update(payload).digest("hex");
  assert.equal(verifySignature(payload, sig, secret), true);
});

test("rejects a tampered payload", () => {
  const secret = "topsecret";
  const payload = Buffer.from(JSON.stringify({ hello: "world" }));
  const sig = "sha256=" + createHmac("sha256", secret).update(payload).digest("hex");
  const tampered = Buffer.from(JSON.stringify({ hello: "there" }));
  assert.equal(verifySignature(tampered, sig, secret), false);
});

test("rejects a missing signature header", () => {
  assert.equal(verifySignature(Buffer.from("x"), undefined, "secret"), false);
});
