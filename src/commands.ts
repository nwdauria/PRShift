import type { MergeMethod } from "./types.js";

export interface ScheduleCommand {
  kind: "schedule";
  scheduledAt: string;
  mergeMethod: MergeMethod;
}

export interface CancelCommand {
  kind: "cancel";
}

export type ParsedCommand = ScheduleCommand | CancelCommand;

const SCHEDULE_PREFIX_RE = /^\/schedule-merge\s+(.+)$/i;
const CANCEL_RE = /^\/cancel-merge\s*$/i;
const MERGE_METHODS: MergeMethod[] = ["merge", "squash", "rebase"];

/**
 * Parses a PR comment body for a /schedule-merge or /cancel-merge command.
 * Accepts a single ISO-8601 timestamp (e.g. 2026-08-20T15:00:00Z) or a
 * "YYYY-MM-DD HH:MM" pair, optionally followed by a merge method.
 */
export function parseCommand(body: string): ParsedCommand | null {
  const line = body.trim().split("\n").find((l) => l.trim().startsWith("/"));
  if (!line) return null;
  const trimmed = line.trim();

  if (CANCEL_RE.test(trimmed)) {
    return { kind: "cancel" };
  }

  const match = trimmed.match(SCHEDULE_PREFIX_RE);
  if (!match) return null;

  const tokens = match[1].trim().split(/\s+/);
  let mergeMethod: MergeMethod = "merge";
  const lastToken = tokens[tokens.length - 1]?.toLowerCase();
  if (tokens.length > 1 && MERGE_METHODS.includes(lastToken as MergeMethod)) {
    mergeMethod = lastToken as MergeMethod;
    tokens.pop();
  }
  if (tokens.length === 0 || tokens.length > 2) return null;

  const rawDate = tokens.join(" ");
  const normalized = rawDate.includes(" ") ? rawDate.replace(" ", "T") + "Z" : rawDate;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;

  return { kind: "schedule", scheduledAt: parsed.toISOString(), mergeMethod };
}
