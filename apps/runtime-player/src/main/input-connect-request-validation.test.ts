import { describe, expect, it } from "vitest";

import { readInputConnectRequest } from "./input-connect-request-validation";

describe("readInputConnectRequest", () => {
  it("defaults to iFacialMocap UDP on the default port", () => {
    expect(readInputConnectRequest(undefined)).toEqual({
      source: "ifacialmocap",
      transport: "udp",
      receivePort: 49983
    });
  });

  it("trims optional iPhone host", () => {
    expect(
      readInputConnectRequest({
        receivePort: 50000,
        iphoneHost: " 192.168.1.30 "
      })
    ).toEqual({
      source: "ifacialmocap",
      transport: "udp",
      receivePort: 50000,
      iphoneHost: "192.168.1.30"
    });
  });

  it("rejects unsupported sources and invalid ports", () => {
    expect(() => readInputConnectRequest({ source: "vmc" })).toThrow(
      "supports only iFacialMocap"
    );
    expect(() => readInputConnectRequest({ receivePort: 0 })).toThrow(
      "Receive port must be an integer"
    );
  });
});
