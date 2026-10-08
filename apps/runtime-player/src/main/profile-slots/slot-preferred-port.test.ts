import net from "node:net";

import { describe, expect, it } from "vitest";

import {
  createPreferredPortFactory,
  findFreeLoopbackPort
} from "./slot-preferred-port";

describe("findFreeLoopbackPort", () => {
  it("returns a usable free loopback port", async () => {
    const port = await findFreeLoopbackPort();
    expect(Number.isInteger(port)).toBe(true);
    expect(port).toBeGreaterThan(0);
    expect(port).toBeLessThanOrEqual(65535);

    // The port must be immediately bindable (i.e. it was actually released).
    await new Promise<void>((resolve, reject) => {
      const server = net.createServer();
      server.once("error", reject);
      server.listen(port, "127.0.0.1", () => {
        server.close(() => resolve());
      });
    });
  });

  it("returns distinct ports across calls", async () => {
    const [a, b] = await Promise.all([
      findFreeLoopbackPort(),
      findFreeLoopbackPort()
    ]);
    expect(a).not.toBe(b);
  });
});

describe("createPreferredPortFactory", () => {
  it("returns the fixed port for a fixed plan", async () => {
    const factory = createPreferredPortFactory({ mode: "fixed", port: 17308 });
    expect(await factory()).toBe(17308);
  });

  it("auto-assigns a free port for an auto-assign plan", async () => {
    const factory = createPreferredPortFactory({ mode: "auto-assign" });
    const port = await factory();
    expect(Number.isInteger(port)).toBe(true);
    expect(port).toBeGreaterThan(0);
  });
});
