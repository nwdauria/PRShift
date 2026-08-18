# Setup Instructions

Follow these steps in order. This runs entirely on your own computer —
nothing is deployed to the cloud.

## What you'll need

- [Node.js](https://nodejs.org) installed (version 20 or newer). Check with:
  ```bash
  node --version
  ```
- A GitHub account with access to the repo(s) you want to schedule merges on.

## Step 1: Get the code

If you haven't already:
```bash
git clone https://github.com/nwdauria/PRShift.git
cd PRShift
```

## Step 2: Install dependencies

```bash
npm install
```

## Step 3: Create a GitHub token

You'll need a personal access token so PRShift can check your pull requests
and merge them on your behalf.

1. Go to https://github.com/settings/tokens
2. Click **Generate new token** (classic is fine)
3. Give it the **`repo`** scope (this lets it read PR/CI status and merge)
4. Click **Generate token** and copy it — you won't be able to see it again

## Step 4: Run the setup wizard

```bash
npm run setup
```

This will:
- Ask you to paste the GitHub token from Step 3
- Confirm it works by checking it against GitHub
- Ask which port to run on (just press Enter to accept the default, `3000`)
- Write a `.env` file for you automatically

You will not need to manually create or edit any config files.

## Step 5: Start PRShift

```bash
npm run dev
```

You should see:
```
PRShift listening on port 3000
Open http://localhost:3000 to schedule a merge.
```

Leave this terminal window running — see "Keeping it running" below for
what this means in practice.

## Step 6: Schedule your first merge

1. Open **http://localhost:3000** in your browser
2. Paste the pull request URL you want to schedule, e.g.
   `https://github.com/your-username/your-repo/pull/5`
3. Pick the date and time you want it merged
4. Enter your GitHub username
5. Pick a merge method (merge / squash / rebase)
6. Click **Schedule merge**

You'll see it appear in the table below the form. It will automatically
be merged at that time, as long as the pull request is still open, has no
merge conflicts, and its checks (CI) have passed. You can close the browser
tab now — the page itself doesn't need to stay open.

## Checking on / cancelling a scheduled merge

Go back to **http://localhost:3000** any time. The table shows every
scheduled merge and its current status (`pending`, `merged`, `blocked`,
`cancelled`, or `failed`). Click **Cancel** next to any pending or blocked
row to cancel it.

## Keeping it running

The scheduler only works while the PRShift process is alive. The browser
tab does **not** need to stay open, but the terminal process does — if you
close the terminal (or shut down your computer) while it's running,
scheduled merges won't happen until you start it again.

For casual use, just leave the terminal window open in the background.

If you want it to survive closing the terminal entirely and auto-restart
if it ever crashes, run it under a process manager instead:

```bash
npm install -g pm2
npm run build
pm2 start dist/index.js --name prshift
pm2 save
```

Check on it later with `pm2 status` or `pm2 logs prshift`. Stop it with
`pm2 stop prshift`.

## Troubleshooting

- **"GITHUB_TOKEN is not set" warning** — re-run `npm run setup`, or check
  that a `.env` file exists in the project folder with `GITHUB_TOKEN=...` in it.
- **A scheduled merge shows "blocked"** — hover over/read the note column;
  it means either the PR has merge conflicts or its checks are failing.
  Fix the underlying issue on GitHub and schedule it again.
- **Nothing happens at the scheduled time** — make sure the PRShift
  process (the terminal, or the `pm2` process) is still running.
