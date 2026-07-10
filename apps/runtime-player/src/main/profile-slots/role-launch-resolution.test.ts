import path from "node:path";

import { describe, expect, it } from "vitest";

import { runtimePlayerBrowserSourceDefaultPort } from "../broadcast-source/browser-source-url";
import {
  parseRuntimePlayerRoleArguments,
  resolveRuntimePlayerSlotLaunch
} from "./role-launch-resolution";

const DEFAULT_USER_DATA = path.join("C:", "userData", "runtime-player");

function argv(...args: readonly string[]): readonly string[] {
  return ["electron.exe", "main.js", ...args];
}

describe("parseRuntimePlayerRoleArguments", () => {
  it("returns no-role when no arguments are present", () => {
    expect(parseRuntimePlayerRoleArguments(argv())).toEqual({ kind: "no-role" });
  });

  it("parses --role=value form", () => {
    expect(parseRuntimePlayerRoleArguments(argv("--role=trackingHost"))).toEqual(
      { kind: "role", role: "trackingHost", profile: null }
    );
  });

  it("parses space-separated --role value form", () => {
    expect(
      parseRuntimePlayerRoleArguments(argv("--role", "autonomousHost"))
    ).toEqual({ kind: "role", role: "autonomousHost", profile: null });
  });

  it("parses --profile alongside --role", () => {
    expect(
      parseRuntimePlayerRoleArguments(
        argv("--role=trackingHost", "--profile=custom")
      )
    ).toEqual({ kind: "role", role: "trackingHost", profile: "custom" });
  });

  it("errors on unknown role values", () => {
    expect(parseRuntimePlayerRoleArguments(argv("--role=ghost")).kind).toBe(
      "error"
    );
  });

  it("errors when --role has no value", () => {
    expect(parseRuntimePlayerRoleArguments(argv("--role")).kind).toBe("error");
    expect(parseRuntimePlayerRoleArguments(argv("--role=")).kind).toBe("error");
  });

  it("errors when --profile is given without --role", () => {
    expect(parseRuntimePlayerRoleArguments(argv("--profile=custom")).kind).toBe(
      "error"
    );
  });
});

describe("resolveRuntimePlayerSlotLaunch", () => {
  it("passes through no-role launches without binding a slot", () => {
    expect(
      resolveRuntimePlayerSlotLaunch({
        argv: argv(),
        defaultUserDataPath: DEFAULT_USER_DATA
      })
    ).toEqual({ kind: "no-role" });
  });

  it("resolves trackingHost to the tracking-default slot with legacy adoption", () => {
    const launch = resolveRuntimePlayerSlotLaunch({
      argv: argv("--role=trackingHost"),
      defaultUserDataPath: DEFAULT_USER_DATA
    });

    expect(launch).toEqual({
      kind: "role-resolved",
      role: "trackingHost",
      slotName: "tracking-default",
      defaultUserDataPath: DEFAULT_USER_DATA,
      slotUserDataPath: path.join(
        DEFAULT_USER_DATA,
        "slots",
        "tracking-default"
      ),
      isDefaultSlot: true,
      adoptsLegacyDefaults: true,
      preferredPort: {
        mode: "fixed",
        port: runtimePlayerBrowserSourceDefaultPort
      }
    });
  });

  it("resolves autonomousHost to its own slot and port, without legacy adoption", () => {
    const launch = resolveRuntimePlayerSlotLaunch({
      argv: argv("--role=autonomousHost"),
      defaultUserDataPath: DEFAULT_USER_DATA
    });

    expect(launch).toMatchObject({
      kind: "role-resolved",
      role: "autonomousHost",
      slotName: "autonomous-default",
      isDefaultSlot: true,
      adoptsLegacyDefaults: false,
      preferredPort: {
        mode: "fixed",
        port: runtimePlayerBrowserSourceDefaultPort + 1
      }
    });
  });

  it("auto-assigns a port for custom slots and does not adopt legacy data", () => {
    const launch = resolveRuntimePlayerSlotLaunch({
      argv: argv("--role=trackingHost", "--profile=my-custom"),
      defaultUserDataPath: DEFAULT_USER_DATA
    });

    expect(launch).toMatchObject({
      kind: "role-resolved",
      role: "trackingHost",
      slotName: "my-custom",
      isDefaultSlot: false,
      adoptsLegacyDefaults: false,
      preferredPort: { mode: "auto-assign" }
    });
  });

  it("keys the fixed port on the slot name, not the role", () => {
    const launch = resolveRuntimePlayerSlotLaunch({
      argv: argv("--role=trackingHost", "--profile=autonomous-default"),
      defaultUserDataPath: DEFAULT_USER_DATA
    });

    expect(launch).toMatchObject({
      kind: "role-resolved",
      role: "trackingHost",
      slotName: "autonomous-default",
      // tracking-default is the role default, so this custom pairing is not it
      isDefaultSlot: false,
      adoptsLegacyDefaults: false,
      preferredPort: {
        mode: "fixed",
        port: runtimePlayerBrowserSourceDefaultPort + 1
      }
    });
  });

  it("errors on path-injection profile names", () => {
    const launch = resolveRuntimePlayerSlotLaunch({
      argv: argv("--role=trackingHost", "--profile=../evil"),
      defaultUserDataPath: DEFAULT_USER_DATA
    });

    expect(launch.kind).toBe("error");
  });
});
