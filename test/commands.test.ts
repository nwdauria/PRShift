import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCommand } from "../src/commands.js";

test("parses a schedule command with ISO timestamp", () => {
  const result = parseCommand("/schedule-merge 2026-08-20T15:00:00Z");
  assert.deepEqual(result, { kind: "schedule", scheduledAt: "2026-08-20T15:00:00.000Z", mergeMethod: "merge" });
});

test("parses a schedule command with date + time and merge method", () => {
  const result = parseCommand("/schedule-merge 2026-08-20 15:00 squash");
  assert.deepEqual(result, { kind: "schedule", scheduledAt: "2026-08-20T15:00:00.000Z", mergeMethod: "squash" });
});

test("parses a schedule command embedded in a longer comment", () => {
  const result = parseCommand("Looks good!\n/schedule-merge 2026-08-20T15:00:00Z rebase\nthanks");
  assert.deepEqual(result, { kind: "schedule", scheduledAt: "2026-08-20T15:00:00.000Z", mergeMethod: "rebase" });
});

test("parses a cancel command", () => {
  const result = parseCommand("/cancel-merge");
  assert.deepEqual(result, { kind: "cancel" });
});

test("returns null for unrelated comments", () => {
  assert.equal(parseCommand("great work on this PR"), null);
});

test("returns null for an invalid date", () => {
  assert.equal(parseCommand("/schedule-merge not-a-date"), null);
});
