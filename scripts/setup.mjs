#!/usr/bin/env node
// Interactive first-run setup: asks for a GitHub token, validates it, writes .env.
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const ENV_PATH = ".env";

async function promptHidden(rl, question) {
  // Node's readline has no built-in masking; keep it simple and visible,
  // since this is a local-only setup script run in the user's own terminal.
  return (await rl.question(question)).trim();
}

async function validateToken(token) {
  const res = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${token}`, "User-Agent": "PRShift-setup" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.login;
}

async function main() {
  console.log("PRShift setup\n--------------");
  console.log("You'll need a GitHub personal access token with 'repo' scope.");
  console.log("Create one at: https://github.com/settings/tokens\n");

  const rl = createInterface({ input: stdin, output: stdout });

  let login = null;
  let token = "";
  while (!login) {
    token = await promptHidden(rl, "Paste your GitHub token: ");
    if (!token) {
      console.log("A token is required.");
      continue;
    }
    process.stdout.write("Validating token... ");
    login = await validateToken(token);
    console.log(login ? `OK (logged in as ${login})` : "invalid token, try again.");
  }

  const portAnswer = await rl.question("Port to run on [3000]: ");
  const port = portAnswer.trim() || "3000";

  rl.close();

  const envContents = [
    `PORT=${port}`,
    `GITHUB_TOKEN=${token}`,
    `GITHUB_WEBHOOK_SECRET=`,
    `DB_PATH=./data/schedules.json`,
    `POLL_INTERVAL_MS=60000`,
    "",
  ].join("\n");

  if (existsSync(ENV_PATH)) {
    const existing = await readFile(ENV_PATH, "utf8");
    console.log("\nAn existing .env was found and will be overwritten.");
    void existing;
  }
  await writeFile(ENV_PATH, envContents);

  console.log(`\nDone! Wrote ${ENV_PATH}.`);
  console.log(`Run "npm run dev" then open http://localhost:${port} to schedule a merge.`);
}

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exitCode = 1;
});
