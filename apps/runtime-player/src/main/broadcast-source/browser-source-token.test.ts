import { describe, expect, it } from "vitest";

import {
  createBrowserSourceToken,
  isBrowserSourceTokenMatch
} from "./browser-source-token";

describe("Browser Source token", () => {
  it("generates URL-safe tokens and rejects missing or invalid candidates", () => {
    const token = createBrowserSourceToken();

    expect(token).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(isBrowserSourceTokenMatch(token, token)).toBe(true);
    expect(isBrowserSourceTokenMatch(null, token)).toBe(false);
    expect(isBrowserSourceTokenMatch("", token)).toBe(false);
    expect(isBrowserSourceTokenMatch(`${token}x`, token)).toBe(false);
    expect(isBrowserSourceTokenMatch(token.slice(1), token)).toBe(false);
  });
});
