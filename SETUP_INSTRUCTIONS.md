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

For a quick test, you can run it directly in your terminal:

```bash
npm run dev
```

You should see:
```
[...] INFO PRShift listening on 127.0.0.1:3000
[...] INFO Open http://localhost:3000 to schedule a merge.
[...] INFO GitHub token is valid (authenticated as your-username).
```

That last line confirms your token actually works — if you see an error
there instead, double-check the token from Step 3.

This only runs while the terminal window stays open, though — closing it
stops PRShift and any scheduled merge won't fire until you restart it. For
anything beyond a five-minute test, **skip ahead to "Run it in the
background" below** and use that instead — it's just as easy and means you
don't have to babysit a terminal window.

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

## Run it in the background (recommended)

The scheduler only works while the PRShift process is alive — the browser
tab never needs to stay open, but *something* has to keep the process
running, since it needs to be alive at the exact moment your scheduled
merge time arrives. The recommended way to do that is `pm2`, a small
process manager that keeps PRShift running in the background, restarts it
automatically if it ever crashes, and (optionally) starts it again if you
reboot your computer.

```bash
npm install -g pm2
npm run build
pm2 start dist/index.js --name prshift
pm2 save
```

That's it — PRShift is now running in the background. You can close every
terminal window; it keeps going.

Useful commands:
- `pm2 status` — check it's running
- `pm2 logs prshift` — see live activity (same content as `data/prshift.log`)
- `pm2 restart prshift` — restart it (e.g. after editing `.env`)
- `pm2 stop prshift` — stop it

**Optional — start automatically when you log in:**
```bash
pm2 startup
```
This prints a one-line command specific to your machine; copy and run it,
then `pm2 save` again. Now PRShift comes back up automatically even after a
restart.

## What happens behind the scenes

A few things run automatically so you don't have to think about them:

- **Desktop notifications** — you'll get a system notification when a
  scheduled merge succeeds, gets blocked (merge conflicts / failing
  checks), or fails outright, so you don't need to keep checking the
  dashboard.
- **Activity log** — everything is also written to `data/prshift.log`
  (viewable any time, even without `pm2`), which rotates automatically so
  it never grows unbounded.
- **Automatic retries** — a temporary GitHub hiccup (rate limit, brief
  outage) is retried automatically with backoff before anything is marked
  failed.
- **Backup copy of your schedule data** — `data/schedules.json.bak` always
  holds the previous version, in case anything ever goes wrong with a write.
- **Loopback-only binding** — the dashboard only listens on `127.0.0.1`, so
  it's never reachable from other devices on your network.

## Troubleshooting

- **"GITHUB_TOKEN is not set" warning** — re-run `npm run setup`, or check
  that a `.env` file exists in the project folder with `GITHUB_TOKEN=...` in it.
- **"GitHub token check failed" / "GitHub token is invalid or expired"** —
  your token was rejected by GitHub (expired, revoked, or wrong scope).
  Generate a new one (Step 3) and re-run `npm run setup`, then restart
  PRShift (`pm2 restart prshift` if you're using pm2).
- **A scheduled merge shows "blocked"** — read the note column in the
  dashboard; it means either the PR has merge conflicts or its checks are
  failing. Fix the underlying issue on GitHub; you'll need to schedule it again.
- **Nothing happens at the scheduled time** — make sure the PRShift
  process is still running (`pm2 status`, or check that your `npm run dev`
  terminal is still open), and check `data/prshift.log` for errors.
