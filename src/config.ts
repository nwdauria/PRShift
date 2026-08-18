export interface Config {
  port: number;
  githubToken: string;
  webhookSecret: string;
  dbPath: string;
  pollIntervalMs: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: Number(env.PORT ?? 3000),
    githubToken: env.GITHUB_TOKEN ?? "",
    webhookSecret: env.GITHUB_WEBHOOK_SECRET ?? "",
    dbPath: env.DB_PATH ?? "./data/schedules.json",
    pollIntervalMs: Number(env.POLL_INTERVAL_MS ?? 60_000),
  };
}
