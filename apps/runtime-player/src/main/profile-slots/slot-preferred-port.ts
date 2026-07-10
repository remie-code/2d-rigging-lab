import net from "node:net";

import { runtimePlayerBrowserSourceBindAddress } from "../broadcast-source/browser-source-url";
import type { RuntimePlayerSlotPreferredPortPlan } from "./role-launch-resolution";

/**
 * Finds a free loopback TCP port by binding to port 0 and reading back the
 * kernel-assigned port. The value is only a *preferred* port that gets
 * persisted; the Browser Source server still falls back to a volatile port on
 * EADDRINUSE, so a race between probe and use is harmless.
 */
export function findFreeLoopbackPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, runtimePlayerBrowserSourceBindAddress, () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close(() =>
          reject(new Error("Could not determine a free loopback port."))
        );
        return;
      }

      const { port } = address;
      server.close((closeError) => {
        if (closeError !== undefined && closeError !== null) {
          reject(closeError);
          return;
        }
        resolve(port);
      });
    });
  });
}

/**
 * Turns a resolved preferred-port plan into the `createPreferredPort` factory
 * the Browser Source config store calls the first time it creates a slot's
 * config. Default slots return their fixed port; custom slots auto-assign.
 */
export function createPreferredPortFactory(
  plan: RuntimePlayerSlotPreferredPortPlan
): () => number | Promise<number> {
  if (plan.mode === "fixed") {
    const { port } = plan;
    return () => port;
  }

  return () => findFreeLoopbackPort();
}
