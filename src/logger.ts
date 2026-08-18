import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from "node:fs";
import { dirname } from "node:path";

const MAX_LOG_BYTES = 5 * 1024 * 1024;

type Level = "info" | "warn" | "error";

/**
 * Minimal append-only file logger with single-generation rotation, so a
 * background/pm2-managed process has a durable record to check after the
 * fact instead of only console output that scrolls away.
 */
export class Logger {
  #path: string;

  constructor(path: string) {
    this.#path = path;
    mkdirSync(dirname(path), { recursive: true });
  }

  #rotateIfNeeded(): void {
    try {
      if (existsSync(this.#path) && statSync(this.#path).size > MAX_LOG_BYTES) {
        renameSync(this.#path, `${this.#path}.1`);
      }
    } catch {
      // Best effort — logging must never crash the process.
    }
  }

  #write(level: Level, message: string): void {
    const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${message}`;
    this.#rotateIfNeeded();
    try {
      appendFileSync(this.#path, line + "\n");
    } catch {
      // Best effort — disk full/permission issues shouldn't crash the process.
    }
    (level === "error" ? console.error : console.log)(line);
  }

  info(message: string): void {
    this.#write("info", message);
  }

  warn(message: string): void {
    this.#write("warn", message);
  }

  error(message: string): void {
    this.#write("error", message);
  }
}
