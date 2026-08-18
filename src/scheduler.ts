import type { GitHubClient } from "./github.js";
import type { ScheduleStore } from "./db.js";
import type { Schedule } from "./types.js";

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

  constructor(store: ScheduleStore, github: GitHubClient) {
    this.#store = store;
    this.#github = github;
  }

  start(intervalMs: number): void {
    this.#timer = setInterval(() => {
      this.runOnce().catch((err) => console.error("scheduler tick failed", err));
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
    try {
      const pr = await this.#github.getPullRequestState(owner, repo, pullNumber);

      if (!pr.open) {
        const status = pr.merged ? "merged" : "cancelled";
        await this.#store.update(schedule.id, {
          status,
          note: pr.merged ? "PR was already merged before the scheduled time." : "PR was closed before the scheduled time.",
        });
        return;
      }

      if (pr.mergeable === false || pr.mergeableState === "dirty") {
        await this.#store.update(schedule.id, {
          status: "blocked",
          note: "PR has merge conflicts and cannot be merged automatically.",
        });
        await this.#github.createComment(
          owner,
          repo,
          pullNumber,
          `⚠️ Scheduled merge could not proceed: this PR has merge conflicts. Resolve them and re-run \`/schedule-merge\`.`,
        );
        return;
      }

      const headSha = await this.#github.getPullRequestHeadSha(owner, repo, pullNumber);
      const checks = await this.#github.getChecksState(owner, repo, headSha);

      if (checks.pending) {
        // Not yet ready; leave pending and retry on the next tick.
        return;
      }

      if (!checks.allPassing) {
        await this.#store.update(schedule.id, {
          status: "blocked",
          note: `Scheduled merge time reached, but checks are failing (${checks.summary}).`,
        });
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
      await this.#github.createComment(owner, repo, pullNumber, `✅ Merged automatically as scheduled by @${schedule.requestedBy}.`);
    } catch (err) {
      await this.#store.update(schedule.id, {
        status: "failed",
        note: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
