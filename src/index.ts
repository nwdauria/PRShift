import express from "express";
import { loadConfig } from "./config.js";
import { ScheduleStore } from "./db.js";
import { GitHubClient } from "./github.js";
import { Scheduler } from "./scheduler.js";
import { schedulesRouter } from "./routes/schedules.js";
import { webhookRouter } from "./routes/webhook.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { Logger } from "./logger.js";
import { notify } from "./notify.js";

const config = loadConfig();
const logger = new Logger(config.logPath);

if (!config.githubToken) {
  logger.warn("GITHUB_TOKEN is not set; GitHub API calls will fail.");
}
if (!config.webhookSecret) {
  logger.warn("GITHUB_WEBHOOK_SECRET is not set; webhook signature verification is disabled.");
}

const store = new ScheduleStore(config.dbPath);
const github = new GitHubClient(config.githubToken);
const scheduler = new Scheduler(store, github, { logger, notify });

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

app.listen(config.port, config.host, () => {
  logger.info(`PRShift listening on ${config.host}:${config.port}`);
  logger.info(`Open http://localhost:${config.port} to schedule a merge.`);
});

if (config.githubToken) {
  github
    .getAuthenticatedLogin()
    .then((login) => logger.info(`GitHub token is valid (authenticated as ${login}).`))
    .catch((err) => {
      logger.error(
        `GitHub token check failed: ${err instanceof Error ? err.message : String(err)}. ` +
          `Scheduled merges will fail until GITHUB_TOKEN is fixed.`,
      );
      notify("PRShift: invalid token", "Your GitHub token is invalid or expired. Scheduled merges will fail.");
    });
}

scheduler.start(config.pollIntervalMs);
scheduler.runOnce().catch((err) => logger.error(`initial scheduler run failed: ${err instanceof Error ? err.message : String(err)}`));
