export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  /** Injectable for tests; defaults to a real timer. */
  sleep?: (ms: number) => Promise<void>;
}

function isRetryableStatus(status: number | undefined): boolean {
  // Undefined status usually means a network-level failure (DNS, timeout, reset).
  // 403/429 cover GitHub's primary and secondary rate limits; 5xx is GitHub's own outage.
  if (status === undefined) return true;
  return status === 403 || status === 429 || status >= 500;
}

/**
 * Retries a GitHub API call with exponential backoff for transient failures
 * (rate limits, 5xx, network errors). Permanent failures like 401 (bad
 * token), 404 (not found), or 422 (validation) fail immediately.
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const retries = options.retries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 500;
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const status = (err as { status?: number }).status;
      if (!isRetryableStatus(status) || attempt === retries) {
        throw err;
      }
      await sleep(baseDelayMs * 2 ** attempt);
    }
  }
  throw lastError;
}
