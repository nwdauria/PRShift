import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ScheduleStore } from "../src/db.js";

async function withStore(fn: (store: ScheduleStore) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), "prshift-"));
  const store = new ScheduleStore(join(dir, "schedules.json"));
  try {
    await fn(store);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("creates and retrieves a schedule", async () => {
  await withStore(async (store) => {
    const schedule = await store.create({
      owner: "nwdauria",
      repo: "PRShift",
      pullNumber: 42,
      scheduledAt: "2026-08-20T15:00:00.000Z",
      requestedBy: "nwdauria",
    });
    assert.equal(schedule.status, "pending");
    assert.equal(schedule.mergeMethod, "merge");

    const fetched = await store.get(schedule.id);
    assert.deepEqual(fetched, schedule);
  });
});

test("lists schedules filtered by pull request", async () => {
  await withStore(async (store) => {
    await store.create({ owner: "a", repo: "b", pullNumber: 1, scheduledAt: "2026-01-01T00:00:00Z", requestedBy: "u" });
    await store.create({ owner: "a", repo: "b", pullNumber: 2, scheduledAt: "2026-01-01T00:00:00Z", requestedBy: "u" });

    const list = await store.list({ owner: "a", repo: "b", pullNumber: 2 });
    assert.equal(list.length, 1);
    assert.equal(list[0].pullNumber, 2);
  });
});

test("dueSchedules only returns pending schedules at or before now", async () => {
  await withStore(async (store) => {
    const past = await store.create({ owner: "a", repo: "b", pullNumber: 1, scheduledAt: "2020-01-01T00:00:00Z", requestedBy: "u" });
    await store.create({ owner: "a", repo: "b", pullNumber: 2, scheduledAt: "2099-01-01T00:00:00Z", requestedBy: "u" });
    await store.update(past.id, { status: "merged" });

    const another = await store.create({ owner: "a", repo: "b", pullNumber: 3, scheduledAt: "2020-01-01T00:00:00Z", requestedBy: "u" });

    const due = await store.dueSchedules(new Date("2025-01-01T00:00:00Z"));
    assert.equal(due.length, 1);
    assert.equal(due[0].id, another.id);
  });
});

test("cancel only affects the target schedule", async () => {
  await withStore(async (store) => {
    const s1 = await store.create({ owner: "a", repo: "b", pullNumber: 1, scheduledAt: "2026-01-01T00:00:00Z", requestedBy: "u" });
    const s2 = await store.create({ owner: "a", repo: "b", pullNumber: 2, scheduledAt: "2026-01-01T00:00:00Z", requestedBy: "u" });

    await store.cancel(s1.id);

    assert.equal((await store.get(s1.id))?.status, "cancelled");
    assert.equal((await store.get(s2.id))?.status, "pending");
  });
});

test("handles many concurrent creates without losing writes", async () => {
  await withStore(async (store) => {
    await Promise.all(
      Array.from({ length: 25 }, (_, i) =>
        store.create({ owner: "a", repo: "b", pullNumber: i, scheduledAt: "2026-01-01T00:00:00Z", requestedBy: "u" }),
      ),
    );
    const all = await store.list();
    assert.equal(all.length, 25);
    assert.equal(new Set(all.map((s) => s.id)).size, 25);
  });
});
