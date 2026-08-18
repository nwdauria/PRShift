# PRShift

Schedule when a GitHub pull request actually gets merged. Say your update is
ready on a testing branch and you want it merged into `main` at a specific
date/time — PRShift watches the clock for you and merges it automatically,
as long as the PR is still mergeable and CI is green.

## How it works

1. You schedule a merge, either:
   - **From a PR comment** (via a GitHub webhook): `/schedule-merge 2026-08-20T15:00:00Z`
   - **Via the REST API**: `POST /schedules`
2. PRShift stores the request and polls once a minute for schedules whose
   time has arrived.
3. When a schedule is due, PRShift checks that the PR is still open, has no
   merge conflicts, and all CI checks have completed successfully.
   - All good → it merges the PR and comments confirming the merge.
   - Checks still running → it waits and retries on the next poll.
   - Checks failed or the PR has conflicts → it marks the schedule
     `blocked` and comments explaining why (no merge is performed).
   - PR was closed or already merged in the meantime → the schedule is
     marked `cancelled`/`merged` accordingly.

## PR comment commands

Post these as a comment on the pull request (requires the GitHub webhook to
be configured, see below):

| Command | Effect |
| --- | --- |
| `/schedule-merge 2026-08-20T15:00:00Z` | Schedule a (regular) merge for that UTC time |
| `/schedule-merge 2026-08-20 15:00 squash` | Same, using a `YYYY-MM-DD HH:MM` UTC timestamp and `squash` merge |
| `/cancel-merge` | Cancel any pending scheduled merge on this PR |

## REST API

- `POST /schedules` — create a schedule
  ```json
  {
    "owner": "nwdauria",
    "repo": "PRShift",
    "pullNumber": 42,
    "scheduledAt": "2026-08-20T15:00:00Z",
    "mergeMethod": "squash",
    "requestedBy": "nwdauria"
  }
  ```
- `GET /schedules?owner=&repo=&pullNumber=&status=` — list schedules
- `GET /schedules/:id` — fetch one schedule
- `DELETE /schedules/:id` — cancel a pending/blocked schedule

## Setup

1. `cp .env.example .env` and fill in:
   - `GITHUB_TOKEN` — a token with `repo` scope (needed to read PR/check
     status and to merge)
   - `GITHUB_WEBHOOK_SECRET` — the secret you configure on the GitHub
     webhook, used to verify deliveries
2. `npm install`
3. `npm run dev` (or `npm run build && npm start` for production)
4. In your repo's GitHub webhook settings, point an `issue_comment` webhook
   at `https://<your-host>/webhook` using the same secret.

## Development

- `npm run dev` — run the server with live TypeScript execution
- `npm test` — run the test suite (`node:test`)
- `npm run typecheck` — type-check without emitting

## Persistence

Schedules are stored in a single JSON file (`DB_PATH`, default
`./data/schedules.json`) written atomically (temp file + rename). This is
enough for a single-instance deployment; swap `src/db.ts` for a real
database if you need multi-instance/high-availability scheduling.
