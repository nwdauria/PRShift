export type ScheduleStatus =
  | "pending"
  | "merged"
  | "cancelled"
  | "blocked"
  | "failed";

export type MergeMethod = "merge" | "squash" | "rebase";

export interface Schedule {
  id: string;
  owner: string;
  repo: string;
  pullNumber: number;
  /** ISO-8601 timestamp of when the merge should be attempted. */
  scheduledAt: string;
  mergeMethod: MergeMethod;
  /** When true, the scheduler merges regardless of CI check status; only a merge conflict blocks it. */
  forceMerge: boolean;
  status: ScheduleStatus;
  requestedBy: string;
  createdAt: string;
  updatedAt: string;
  /** Last error/blocked reason, if any. */
  note?: string;
  /** Set once the merge actually happens. */
  mergedAt?: string;
  mergeCommitSha?: string;
}

export interface CreateScheduleInput {
  owner: string;
  repo: string;
  pullNumber: number;
  scheduledAt: string;
  mergeMethod?: MergeMethod;
  forceMerge?: boolean;
  requestedBy: string;
}
