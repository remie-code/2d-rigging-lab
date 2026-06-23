import { randomBytes, timingSafeEqual } from "node:crypto";

const BROWSER_SOURCE_TOKEN_BYTE_LENGTH = 24;

export function createBrowserSourceToken(): string {
  return randomBytes(BROWSER_SOURCE_TOKEN_BYTE_LENGTH).toString("base64url");
}

export function isBrowserSourceTokenMatch(
  candidate: string | null,
  expected: string
): boolean {
  if (candidate === null || candidate.length === 0) {
    return false;
  }

  const candidateBytes = Buffer.from(candidate, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");

  if (candidateBytes.byteLength !== expectedBytes.byteLength) {
    return false;
  }

  return timingSafeEqual(candidateBytes, expectedBytes);
}
