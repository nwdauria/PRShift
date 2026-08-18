import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ScheduleStore } from "../src/db.js";
import { Scheduler } from "../src/scheduler.js";
import type { ChecksState, MergeResult, PullRequestState } from "../src/github.js";
import type { MergeMethod } from "../src/types.js";

class FakeGitHub {
  prState: PullRequestState = { open: true, merged: false, mergeable: true, mergeableState: "clean" };
  checksState: ChecksState = { allPassing: true, pending: false, summary: "ok" };
  mergeResult: MergeResult = { merged: true, sha: "abc123", message: "merged" };
  comments: string[] = [];
  mergeCalls = 0;

  async getPullRequestState(): Promise<PullRequestState> {
    return this.prState;
  }
  async getChecksState(): Promise<ChecksState> {
    return this.checksState;
  }
  async getPullRequestHeadSha(): Promise<string> {
    return "deadbeef";
  }
  async mergePullRequest(_owner: string, _repo: string, _pr: number, _method: MergeMethod): Promise<MergeResult> {
    this.mergeCalls += 1;
    return this.mergeResult;
  }
  async createComment(_owner: string, _repo: string, _issue: number, body: string): Promise<void> {
    this.comments.push(body);
  }
}

async function withStore(fn: (store: ScheduleStore) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), "prshift-sched-"));
  const store = new ScheduleStore(join(dir, "schedules.json"));
  try {
    await fn(store);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("merges a due schedule when checks pass and PR is mergeable", async () => {
  await withStore(async (store) => {
    const schedule = await store.create({
      owner: "a",
      repo: "b",
      pullNumber: 1,
      scheduledAt: "2020-01-01T00:00:00Z",
      requestedBy: "u",
    });
    const github = new FakeGitHub();
    const scheduler = new Scheduler(store, github as never);

    await scheduler.runOnce(new Date("2025-01-01T00:00:00Z"));

    const updated = await store.get(schedule.id);
    assert.equal(updated?.status, "merged");
    assert.equal(updated?.mergeCommitSha, "abc123");
    assert.equal(github.mergeCalls, 1);
    assert.ok(github.comments[0].includes("Merged automatically"));
  });
});

test("leaves a schedule pending while checks are still running", async () => {
  await withStore(async (store) => {
    const schedule = await store.create({
      owner: "a",
      repo: "b",
      pullNumber: 1,
      scheduledAt: "2020-01-01T00:00:00Z",
      requestedBy: "u",
    });
    const github = new FakeGitHub();
    github.checksState = { allPassing: false, pending: true, summary: "running" };
    const scheduler = new Scheduler(store, github as never);

    await scheduler.runOnce(new Date("2025-01-01T00:00:00Z"));

    const updated = await store.get(schedule.id);
    assert.equal(updated?.status, "pending");
    assert.equal(github.mergeCalls, 0);
  });
});

test("blocks a schedule when checks fail", async () => {
  await withStore(async (store) => {
    const schedule = await store.create({
      owner: "a",
      repo: "b",
      pullNumber: 1,
      scheduledAt: "2020-01-01T00:00:00Z",
      requestedBy: "u",
    });
    const github = new FakeGitHub();
    github.checksState = { allPassing: false, pending: false, summary: "1 failing" };
    const scheduler = new Scheduler(store, github as never);

    await scheduler.runOnce(new Date("2025-01-01T00:00:00Z"));

    const updated = await store.get(schedule.id);
    assert.equal(updated?.status, "blocked");
    assert.equal(github.mergeCalls, 0);
  });
});

test("blocks a schedule when the PR has merge conflicts", async () => {
  await withStore(async (store) => {
    const schedule = await store.create({
      owner: "a",
      repo: "b",
      pullNumber: 1,
      scheduledAt: "2020-01-01T00:00:00Z",
      requestedBy: "u",
    });
    const github = new FakeGitHub();
    github.prState = { open: true, merged: false, mergeable: false, mergeableState: "dirty" };
    const scheduler = new Scheduler(store, github as never);

    await scheduler.runOnce(new Date("2025-01-01T00:00:00Z"));

    const updated = await store.get(schedule.id);
    assert.equal(updated?.status, "blocked");
    assert.equal(github.mergeCalls, 0);
  });
});

test("cancels a schedule if the PR was closed without merging", async () => {
  await withStore(async (store) => {
    const schedule = await store.create({
      owner: "a",
      repo: "b",
      pullNumber: 1,
      scheduledAt: "2020-01-01T00:00:00Z",
      requestedBy: "u",
    });
    const github = new FakeGitHub();
    github.prState = { open: false, merged: false, mergeable: null, mergeableState: "unknown" };
    const scheduler = new Scheduler(store, github as never);

    await scheduler.runOnce(new Date("2025-01-01T00:00:00Z"));

    const updated = await store.get(schedule.id);
    assert.equal(updated?.status, "cancelled");
  });
});

test("ignores schedules that are not yet due", async () => {
  await withStore(async (store) => {
    const schedule = await store.create({
      owner: "a",
      repo: "b",
      pullNumber: 1,
      scheduledAt: "2099-01-01T00:00:00Z",
      requestedBy: "u",
    });
    const github = new FakeGitHub();
    const scheduler = new Scheduler(store, github as never);

    await scheduler.runOnce(new Date("2025-01-01T00:00:00Z"));

    const updated = await store.get(schedule.id);
    assert.equal(updated?.status, "pending");
    assert.equal(github.mergeCalls, 0);
  });
});
