import { randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Control Channel token generation / matching (C4 §3.1). A channel-neutral
 * duplicate of the Browser Source token util so the channel carries its OWN
 * token, in its OWN config file, fully independent from Browser Source
 * (裁定3: 第二token). The two subsystems never share a secret.
 */

const CONTROL_CHANNEL_TOKEN_BYTE_LENGTH = 24;

export function createControlChannelToken(): string {
  return randomBytes(CONTROL_CHANNEL_TOKEN_BYTE_LENGTH).toString("base64url");
}

export function isControlChannelTokenMatch(
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
