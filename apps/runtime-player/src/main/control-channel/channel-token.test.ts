import { describe, expect, it } from "vitest";

import {
  createControlChannelToken,
  isControlChannelTokenMatch
} from "./channel-token";

describe("Control Channel token", () => {
  it("generates a URL-safe token that matches itself", () => {
    const token = createControlChannelToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThanOrEqual(24);
    expect(isControlChannelTokenMatch(token, token)).toBe(true);
  });

  it("rejects missing, empty, and mismatched candidates", () => {
    const token = createControlChannelToken();

    expect(isControlChannelTokenMatch(null, token)).toBe(false);
    expect(isControlChannelTokenMatch("", token)).toBe(false);
    expect(isControlChannelTokenMatch(`${token}x`, token)).toBe(false);
    expect(isControlChannelTokenMatch("different-token", token)).toBe(false);
  });

  it("generates distinct tokens across calls", () => {
    expect(createControlChannelToken()).not.toBe(createControlChannelToken());
  });
});
