import { Router } from "express";
import type { ScheduleStore } from "../db.js";
import type { GitHubClient } from "../github.js";
import { parseCommand } from "../commands.js";
import { verifySignature } from "../webhookVerify.js";

interface WebhookDeps {
  store: ScheduleStore;
  github: GitHubClient;
  webhookSecret: string;
}

export function webhookRouter({ store, github, webhookSecret }: WebhookDeps): Router {
  const router = Router();

  router.post("/webhook", async (req, res) => {
    const signature = req.header("x-hub-signature-256");
    const raw = (req as { rawBody?: Buffer }).rawBody ?? Buffer.from(JSON.stringify(req.body));
    if (webhookSecret && !verifySignature(raw, signature, webhookSecret)) {
      return res.status(401).json({ error: "invalid signature" });
    }

    const event = req.header("x-github-event");
    if (event !== "issue_comment") {
      return res.status(202).json({ ignored: true });
    }

    const payload = req.body;
    if (payload.action !== "created" || !payload.issue?.pull_request) {
      return res.status(202).json({ ignored: true });
    }

    const command = parseCommand(payload.comment?.body ?? "");
    if (!command) {
      return res.status(202).json({ ignored: true });
    }

    const owner = payload.repository.owner.login;
    const repo = payload.repository.name;
    const pullNumber = payload.issue.number;
    const requestedBy = payload.comment.user.login;

    if (command.kind === "schedule") {
      if (new Date(command.scheduledAt).getTime() <= Date.now()) {
        await github.createComment(owner, repo, pullNumber, `⚠️ @${requestedBy} the scheduled time must be in the future.`);
        return res.status(200).json({ handled: true });
      }
      const schedule = await store.create({
        owner,
        repo,
        pullNumber,
        scheduledAt: command.scheduledAt,
        mergeMethod: command.mergeMethod,
        requestedBy,
      });
      await github.createComment(
        owner,
        repo,
        pullNumber,
        `🕒 Scheduled to merge (${schedule.mergeMethod}) at **${schedule.scheduledAt}** by @${requestedBy}. Comment \`/cancel-merge\` to cancel.`,
      );
      return res.status(200).json({ handled: true, scheduleId: schedule.id });
    }

    // cancel
    const pending = await store.list({ owner, repo, pullNumber, status: "pending" });
    if (pending.length === 0) {
      await github.createComment(owner, repo, pullNumber, `ℹ️ No pending scheduled merge to cancel.`);
      return res.status(200).json({ handled: true });
    }
    for (const schedule of pending) {
      await store.cancel(schedule.id);
    }
    await github.createComment(owner, repo, pullNumber, `🚫 Scheduled merge cancelled by @${requestedBy}.`);
    return res.status(200).json({ handled: true });
  });

  return router;
}
