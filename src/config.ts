export interface Config {
  port: number;
  /** Bind address. Defaults to loopback-only so nothing on the local
   * network can reach the dashboard/API, since there is no auth on it. */
  host: string;
  githubToken: string;
  webhookSecret: string;
  dbPath: string;
  logPath: string;
  pollIntervalMs: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: Number(env.PORT ?? 3000),
    host: env.HOST ?? "127.0.0.1",
    githubToken: env.GITHUB_TOKEN ?? "",
    webhookSecret: env.GITHUB_WEBHOOK_SECRET ?? "",
    dbPath: env.DB_PATH ?? "./data/schedules.json",
    logPath: env.LOG_PATH ?? "./data/prshift.log",
    pollIntervalMs: Number(env.POLL_INTERVAL_MS ?? 60_000),
  };
}
