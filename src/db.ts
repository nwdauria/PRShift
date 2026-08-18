import { randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { CreateScheduleInput, Schedule, ScheduleStatus } from "./types.js";

/**
 * Minimal JSON-file-backed store for schedules. Writes are serialized through
 * a single in-process queue and go through a tmp-file + rename so a crash
 * mid-write can never leave the file truncated/corrupt.
 */
export class ScheduleStore {
  #path: string;
  #writeQueue: Promise<void> = Promise.resolve();

  constructor(path: string) {
    this.#path = path;
  }

  async #load(): Promise<Schedule[]> {
    try {
      const raw = await readFile(this.#path, "utf8");
      return raw.trim() ? (JSON.parse(raw) as Schedule[]) : [];
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
  }

  async #save(schedules: Schedule[]): Promise<void> {
    await mkdir(dirname(this.#path), { recursive: true });
    // Keep one prior generation on disk before overwriting, so a bad write
    // (or a bug that corrupts state) never destroys the only copy of history.
    try {
      await copyFile(this.#path, `${this.#path}.bak`);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
    const tmpPath = `${this.#path}.tmp-${randomUUID()}`;
    await writeFile(tmpPath, JSON.stringify(schedules, null, 2));
    await rename(tmpPath, this.#path);
  }

  #enqueue<T>(fn: (schedules: Schedule[]) => Promise<T> | T): Promise<T> {
    const result = this.#writeQueue.then(async () => {
      const schedules = await this.#load();
      const out = await fn(schedules);
      return out;
    });
    this.#writeQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  async create(input: CreateScheduleInput): Promise<Schedule> {
    return this.#enqueue(async (schedules) => {
      const now = new Date().toISOString();
      const schedule: Schedule = {
        id: randomUUID(),
        owner: input.owner,
        repo: input.repo,
        pullNumber: input.pullNumber,
        scheduledAt: input.scheduledAt,
        mergeMethod: input.mergeMethod ?? "merge",
        status: "pending",
        requestedBy: input.requestedBy,
        createdAt: now,
        updatedAt: now,
      };
      schedules.push(schedule);
      await this.#save(schedules);
      return schedule;
    });
  }

  async list(filter?: { owner?: string; repo?: string; pullNumber?: number; status?: ScheduleStatus }): Promise<Schedule[]> {
    const schedules = await this.#load();
    return schedules.filter((s) => {
      if (filter?.owner && s.owner !== filter.owner) return false;
      if (filter?.repo && s.repo !== filter.repo) return false;
      if (filter?.pullNumber !== undefined && s.pullNumber !== filter.pullNumber) return false;
      if (filter?.status && s.status !== filter.status) return false;
      return true;
    });
  }

  async get(id: string): Promise<Schedule | undefined> {
    const schedules = await this.#load();
    return schedules.find((s) => s.id === id);
  }

  async dueSchedules(now: Date = new Date()): Promise<Schedule[]> {
    const schedules = await this.#load();
    return schedules.filter((s) => s.status === "pending" && new Date(s.scheduledAt).getTime() <= now.getTime());
  }

  async update(id: string, patch: Partial<Omit<Schedule, "id">>): Promise<Schedule | undefined> {
    return this.#enqueue(async (schedules) => {
      const idx = schedules.findIndex((s) => s.id === id);
      if (idx === -1) return undefined;
      const updated: Schedule = { ...schedules[idx], ...patch, updatedAt: new Date().toISOString() };
      schedules[idx] = updated;
      await this.#save(schedules);
      return updated;
    });
  }

  async cancel(id: string): Promise<Schedule | undefined> {
    return this.update(id, { status: "cancelled" });
  }
}
