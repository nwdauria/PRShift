import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies a GitHub webhook `X-Hub-Signature-256` header against the raw
 * request body using the shared webhook secret.
 */
export function verifySignature(payload: Buffer | string, signatureHeader: string | undefined, secret: string): boolean {
  if (!signatureHeader) return false;
  const expected = "sha256=" + createHmac("sha256", secret).update(payload).digest("hex");
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signatureHeader);
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}
