import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Logger } from "../src/logger.js";

async function withTmpDir(fn: (dir: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), "prshift-log-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("writes info/warn/error lines to the log file", async () => {
  await withTmpDir(async (dir) => {
    const path = join(dir, "prshift.log");
    const logger = new Logger(path);
    logger.info("hello");
    logger.warn("careful");
    logger.error("oops");

    const contents = await readFile(path, "utf8");
    assert.match(contents, /INFO hello/);
    assert.match(contents, /WARN careful/);
    assert.match(contents, /ERROR oops/);
  });
});

test("creates the parent directory if missing", async () => {
  await withTmpDir(async (dir) => {
    const path = join(dir, "nested", "logs", "prshift.log");
    const logger = new Logger(path);
    logger.info("created");
    const contents = await readFile(path, "utf8");
    assert.match(contents, /created/);
  });
});

test("rotates the log file once it exceeds the size threshold", async () => {
  await withTmpDir(async (dir) => {
    const path = join(dir, "prshift.log");
    // Write a file just over the 5MB rotation threshold.
    await writeFile(path, "x".repeat(5 * 1024 * 1024 + 1));
    const logger = new Logger(path);
    logger.info("after rotation");

    const rotated = await readFile(`${path}.1`, "utf8");
    assert.equal(rotated.length, 5 * 1024 * 1024 + 1);

    const current = await readFile(path, "utf8");
    assert.match(current, /after rotation/);
  });
});
