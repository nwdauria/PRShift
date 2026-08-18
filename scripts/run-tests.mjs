#!/usr/bin/env node
// Cross-platform test runner: discovers test/*.test.ts ourselves instead of
// relying on shell glob expansion (Windows' default cmd.exe shell does not
// expand globs the way bash/zsh do, so "tsx --test test/*.test.ts" would
// silently run zero tests there).
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const testDir = join(projectRoot, "test");

const files = readdirSync(testDir)
  .filter((f) => f.endsWith(".test.ts"))
  .sort()
  .map((f) => join("test", f));

if (files.length === 0) {
  console.error("No test files found in test/");
  process.exit(1);
}

const result = spawnSync(process.execPath, ["--import", "tsx", "--test", ...files], {
  stdio: "inherit",
  cwd: projectRoot,
});

process.exit(result.status ?? 1);
