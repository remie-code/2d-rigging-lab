import { describe, expect, it } from "vitest";

import {
  createBrowserSourceStageUrl,
  createBrowserSourceWebSocketUrl,
  runtimePlayerBrowserSourceBindAddress,
  runtimePlayerBrowserSourceDefaultPort
} from "./browser-source-url";

describe("Browser Source URL contract", () => {
  it("binds v0 output to loopback and includes tokenized HTTP and WebSocket URLs", () => {
    expect(runtimePlayerBrowserSourceBindAddress).toBe("127.0.0.1");
    expect(runtimePlayerBrowserSourceDefaultPort).toBe(17308);
    expect(createBrowserSourceStageUrl({
      port: 49152,
      token: "token_fixture"
    })).toBe("http://127.0.0.1:49152/stage?token=token_fixture");
    expect(createBrowserSourceWebSocketUrl({
      port: 49152,
      token: "token_fixture"
    })).toBe("ws://127.0.0.1:49152/ws?token=token_fixture");
  });
});
