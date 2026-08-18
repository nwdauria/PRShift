import { Router } from "express";
import type { ScheduleStore } from "../db.js";
import type { MergeMethod } from "../types.js";

const VALID_METHODS: MergeMethod[] = ["merge", "squash", "rebase"];

export function schedulesRouter(store: ScheduleStore): Router {
  const router = Router();

  router.post("/schedules", async (req, res) => {
    const { owner, repo, pullNumber, scheduledAt, mergeMethod, requestedBy } = req.body ?? {};

    if (typeof owner !== "string" || typeof repo !== "string" || !owner || !repo) {
      return res.status(400).json({ error: "owner and repo are required strings" });
    }
    if (typeof pullNumber !== "number" || !Number.isInteger(pullNumber) || pullNumber <= 0) {
      return res.status(400).json({ error: "pullNumber must be a positive integer" });
    }
    const parsedDate = new Date(scheduledAt);
    if (typeof scheduledAt !== "string" || Number.isNaN(parsedDate.getTime())) {
      return res.status(400).json({ error: "scheduledAt must be a valid ISO-8601 timestamp" });
    }
    if (parsedDate.getTime() <= Date.now()) {
      return res.status(400).json({ error: "scheduledAt must be in the future" });
    }
    if (mergeMethod !== undefined && !VALID_METHODS.includes(mergeMethod)) {
      return res.status(400).json({ error: `mergeMethod must be one of ${VALID_METHODS.join(", ")}` });
    }
    if (typeof requestedBy !== "string" || !requestedBy) {
      return res.status(400).json({ error: "requestedBy is required" });
    }

    const schedule = await store.create({
      owner,
      repo,
      pullNumber,
      scheduledAt: parsedDate.toISOString(),
      mergeMethod,
      requestedBy,
    });
    res.status(201).json(schedule);
  });

  router.get("/schedules", async (req, res) => {
    const { owner, repo, pullNumber, status } = req.query;
    const schedules = await store.list({
      owner: typeof owner === "string" ? owner : undefined,
      repo: typeof repo === "string" ? repo : undefined,
      pullNumber: typeof pullNumber === "string" ? Number(pullNumber) : undefined,
      status: typeof status === "string" ? (status as never) : undefined,
    });
    res.json(schedules);
  });

  router.get("/schedules/:id", async (req, res) => {
    const schedule = await store.get(req.params.id);
    if (!schedule) return res.status(404).json({ error: "not found" });
    res.json(schedule);
  });

  router.delete("/schedules/:id", async (req, res) => {
    const schedule = await store.get(req.params.id);
    if (!schedule) return res.status(404).json({ error: "not found" });
    if (schedule.status !== "pending" && schedule.status !== "blocked") {
      return res.status(409).json({ error: `cannot cancel a schedule with status "${schedule.status}"` });
    }
    const updated = await store.cancel(req.params.id);
    res.json(updated);
  });

  return router;
}
