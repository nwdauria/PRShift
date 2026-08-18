import type { GitHubClient } from "./github.js";
import type { ScheduleStore } from "./db.js";
import type { Schedule } from "./types.js";

export interface SchedulerLogger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export type NotifyFn = (title: string, message: string) => void;

export interface SchedulerOptions {
  logger?: SchedulerLogger;
  notify?: NotifyFn;
}

const consoleLogger: SchedulerLogger = {
  info: (m) => console.log(m),
  warn: (m) => console.warn(m),
  error: (m) => console.error(m),
};

/**
 * Polls for schedules whose time has come and attempts to merge them.
 * A schedule is only merged when the PR is still open, has no merge
 * conflicts, and all CI checks have completed successfully; otherwise it's
 * left pending (checks still running) or marked "blocked" (checks failed /
 * PR unmergeable) and a comment is posted explaining why.
 */
export class Scheduler {
  #store: ScheduleStore;
  #github: GitHubClient;
  #timer: NodeJS.Timeout | undefined;
  #log: SchedulerLogger;
  #notify: NotifyFn;

  constructor(store: ScheduleStore, github: GitHubClient, options: SchedulerOptions = {}) {
    this.#store = store;
    this.#github = github;
    this.#log = options.logger ?? consoleLogger;
    this.#notify = options.notify ?? (() => {});
  }

  start(intervalMs: number): void {
    this.#timer = setInterval(() => {
      this.runOnce().catch((err) => this.#log.error(`scheduler tick failed: ${errorMessage(err)}`));
    }, intervalMs);
    this.#timer.unref?.();
  }

  stop(): void {
    if (this.#timer) clearInterval(this.#timer);
  }

  async runOnce(now: Date = new Date()): Promise<void> {
    const due = await this.#store.dueSchedules(now);
    for (const schedule of due) {
      await this.#process(schedule);
    }
  }

  async #process(schedule: Schedule): Promise<void> {
    const { owner, repo, pullNumber } = schedule;
    const prLabel = `${owner}/${repo}#${pullNumber}`;
    try {
      const pr = await this.#github.getPullRequestState(owner, repo, pullNumber);

      if (!pr.open) {
        const status = pr.merged ? "merged" : "cancelled";
        const note = pr.merged
          ? "PR was already merged before the scheduled time."
          : "PR was closed before the scheduled time.";
        await this.#store.update(schedule.id, { status, note });
        this.#log.info(`${prLabel}: schedule ${status} — ${note}`);
        return;
      }

      if (pr.mergeable === false || pr.mergeableState === "dirty") {
        const note = "PR has merge conflicts and cannot be merged automatically.";
        await this.#store.update(schedule.id, { status: "blocked", note });
        this.#log.warn(`${prLabel}: blocked — ${note}`);
        this.#notify("PRShift: merge blocked", `${prLabel} has merge conflicts.`);
        await this.#github.createComment(
          owner,
          repo,
          pullNumber,
          `⚠️ Scheduled merge could not proceed: this PR has merge conflicts. Resolve them and re-schedule.`,
        );
        return;
      }

      const headSha = await this.#github.getPullRequestHeadSha(owner, repo, pullNumber);
      const checks = await this.#github.getChecksState(owner, repo, headSha);

      if (checks.pending) {
        // Not yet ready; leave pending and retry on the next tick.
        this.#log.info(`${prLabel}: checks still running, will retry`);
        return;
      }

      if (!checks.allPassing) {
        const note = `Scheduled merge time reached, but checks are failing (${checks.summary}).`;
        await this.#store.update(schedule.id, { status: "blocked", note });
        this.#log.warn(`${prLabel}: blocked — ${note}`);
        this.#notify("PRShift: merge blocked", `${prLabel} has failing checks.`);
        await this.#github.createComment(
          owner,
          repo,
          pullNumber,
          `⚠️ Scheduled merge time reached, but required checks are failing. The merge was not performed.`,
        );
        return;
      }

      const result = await this.#github.mergePullRequest(owner, repo, pullNumber, schedule.mergeMethod);
      await this.#store.update(schedule.id, {
        status: "merged",
        mergedAt: new Date().toISOString(),
        mergeCommitSha: result.sha,
      });
      this.#log.info(`${prLabel}: merged (${result.sha ?? "no sha"})`);
      this.#notify("PRShift: merged", `${prLabel} was merged as scheduled.`);
      await this.#github.createComment(owner, repo, pullNumber, `✅ Merged automatically as scheduled by @${schedule.requestedBy}.`);
    } catch (err) {
      const message = errorMessage(err);
      const status = (err as { status?: number }).status;
      const note = status === 401 ? "GitHub token is invalid or expired. Update GITHUB_TOKEN and restart PRShift." : message;
      await this.#store.update(schedule.id, { status: "failed", note });
      this.#log.error(`${prLabel}: failed — ${note}`);
      this.#notify("PRShift: merge failed", `${prLabel}: ${note}`);
    }
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
