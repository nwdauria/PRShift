import { test } from "node:test";
import assert from "node:assert/strict";
import { notify } from "../src/notify.js";

test("never throws, even if the platform notification tool is missing", () => {
  assert.doesNotThrow(() => notify("Title", "Message"));
});

test("does not throw with quotes/special characters in the message", () => {
  assert.doesNotThrow(() => notify(`Title with "quotes"`, `Message with 'quotes' and $(injection attempt)`));
});
