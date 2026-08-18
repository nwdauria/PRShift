import { Octokit } from "@octokit/rest";
import type { MergeMethod } from "./types.js";
import { withRetry } from "./retry.js";

export interface PullRequestState {
  open: boolean;
  merged: boolean;
  mergeable: boolean | null;
  mergeableState: string;
}

export interface ChecksState {
  allPassing: boolean;
  pending: boolean;
  summary: string;
}

export interface MergeResult {
  merged: boolean;
  sha?: string;
  message: string;
}

export class GitHubClient {
  #octokit: Octokit;

  constructor(token: string) {
    this.#octokit = new Octokit({ auth: token });
  }

  /** Verifies the configured token works; throws if it's missing/invalid/expired. */
  async getAuthenticatedLogin(): Promise<string> {
    const { data } = await withRetry(() => this.#octokit.users.getAuthenticated());
    return data.login;
  }

  async getPullRequestState(owner: string, repo: string, pullNumber: number): Promise<PullRequestState> {
    const { data } = await withRetry(() => this.#octokit.pulls.get({ owner, repo, pull_number: pullNumber }));
    return {
      open: data.state === "open",
      merged: data.merged === true,
      mergeable: data.mergeable,
      mergeableState: data.mergeable_state ?? "unknown",
    };
  }

  async getChecksState(owner: string, repo: string, ref: string): Promise<ChecksState> {
    const { data } = await withRetry(() => this.#octokit.checks.listForRef({ owner, repo, ref }));
    if (data.check_runs.length === 0) {
      return { allPassing: true, pending: false, summary: "no check runs" };
    }
    const pending = data.check_runs.some((r) => r.status !== "completed");
    const failing = data.check_runs.some(
      (r) => r.status === "completed" && !["success", "neutral", "skipped"].includes(r.conclusion ?? ""),
    );
    return {
      allPassing: !pending && !failing,
      pending,
      summary: `${data.check_runs.length} check run(s), pending=${pending}, failing=${failing}`,
    };
  }

  async mergePullRequest(
    owner: string,
    repo: string,
    pullNumber: number,
    mergeMethod: MergeMethod,
  ): Promise<MergeResult> {
    const { data } = await withRetry(() =>
      this.#octokit.pulls.merge({
        owner,
        repo,
        pull_number: pullNumber,
        merge_method: mergeMethod,
      }),
    );
    return { merged: data.merged, sha: data.sha, message: data.message };
  }

  async createComment(owner: string, repo: string, issueNumber: number, body: string): Promise<void> {
    await withRetry(() => this.#octokit.issues.createComment({ owner, repo, issue_number: issueNumber, body }));
  }

  async getPullRequestHeadSha(owner: string, repo: string, pullNumber: number): Promise<string> {
    const { data } = await withRetry(() => this.#octokit.pulls.get({ owner, repo, pull_number: pullNumber }));
    return data.head.sha;
  }
}
