import express from "express";
import { loadConfig } from "./config.js";
import { ScheduleStore } from "./db.js";
import { GitHubClient } from "./github.js";
import { Scheduler } from "./scheduler.js";
import { schedulesRouter } from "./routes/schedules.js";
import { webhookRouter } from "./routes/webhook.js";
import { dashboardRouter } from "./routes/dashboard.js";

const config = loadConfig();

if (!config.githubToken) {
  console.warn("GITHUB_TOKEN is not set; GitHub API calls will fail.");
}
if (!config.webhookSecret) {
  console.warn("GITHUB_WEBHOOK_SECRET is not set; webhook signature verification is disabled.");
}

const store = new ScheduleStore(config.dbPath);
const github = new GitHubClient(config.githubToken);
const scheduler = new Scheduler(store, github);

const app = express();
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as { rawBody?: Buffer }).rawBody = Buffer.from(buf);
    },
  }),
);

app.get("/healthz", (_req, res) => res.json({ ok: true }));
app.use(dashboardRouter());
app.use(schedulesRouter(store));
app.use(webhookRouter({ store, github, webhookSecret: config.webhookSecret }));

app.listen(config.port, () => {
  console.log(`PRShift listening on port ${config.port}`);
  console.log(`Open http://localhost:${config.port} to schedule a merge.`);
});

scheduler.start(config.pollIntervalMs);
scheduler.runOnce().catch((err) => console.error("initial scheduler run failed", err));
