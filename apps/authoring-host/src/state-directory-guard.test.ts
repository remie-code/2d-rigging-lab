import { describe, expect, it } from "vitest";

import {
  parseAuthoringHostCliArguments,
  AuthoringHostCliArgumentError
} from "./cli-arguments.js";
import {
  runAuthoringHostCommand,
  AuthoringHostStateDirectoryError
} from "./run-authoring-host-command.js";
import { runAuthoringHostCli } from "./cli.js";
import { isStateDirectoryInsidePackageDirectory } from "./state-directory-guard.js";

describe("isStateDirectoryInsidePackageDirectory", () => {
  it("rejects a state directory equal to the package directory", () => {
    expect(isStateDirectoryInsidePackageDirectory("/repo/pkg", "/repo/pkg")).toBe(true);
  });

  it("rejects a state directory nested inside the package directory", () => {
    expect(isStateDirectoryInsidePackageDirectory("/repo/pkg", "/repo/pkg/state")).toBe(true);
    expect(
      isStateDirectoryInsidePackageDirectory("/repo/pkg", "/repo/pkg/deep/nested/state")
    ).toBe(true);
  });

  it("allows a sibling state directory", () => {
    expect(isStateDirectoryInsidePackageDirectory("/repo/pkg", "/repo/state")).toBe(false);
  });

  it("allows a state directory whose name shares a prefix but is not nested", () => {
    // "/repo/pkg-state" must not be treated as inside "/repo/pkg".
    expect(isStateDirectoryInsidePackageDirectory("/repo/pkg", "/repo/pkg-state")).toBe(false);
  });

  it("allows a parent directory as the state directory", () => {
    expect(isStateDirectoryInsidePackageDirectory("/repo/pkg", "/repo")).toBe(false);
  });

  it("normalizes relative segments before comparing", () => {
    expect(
      isStateDirectoryInsidePackageDirectory("/repo/pkg", "/repo/pkg/../pkg/state")
    ).toBe(true);
    expect(
      isStateDirectoryInsidePackageDirectory("/repo/pkg", "/repo/pkg/../sibling")
    ).toBe(false);
  });
});

describe("parseAuthoringHostCliArguments state-dir guard", () => {
  it("rejects --state-dir inside --package-dir", () => {
    expect(() =>
      parseAuthoringHostCliArguments([
        "--package-dir",
        "/repo/pkg",
        "--state-dir",
        "/repo/pkg/state"
      ])
    ).toThrow(AuthoringHostCliArgumentError);
  });

  it("rejects --state-dir equal to --package-dir", () => {
    expect(() =>
      parseAuthoringHostCliArguments([
        "--package-dir",
        "/repo/pkg",
        "--state-dir",
        "/repo/pkg"
      ])
    ).toThrow(AuthoringHostCliArgumentError);
  });

  it("accepts a state directory outside the package directory", () => {
    const args = parseAuthoringHostCliArguments([
      "--package-dir",
      "/repo/pkg",
      "--state-dir",
      "/repo/state"
    ]);

    expect(args.packageDirectory).toBe("/repo/pkg");
    expect(args.stateDirectory).toBe("/repo/state");
  });
});

describe("runAuthoringHostCommand state-dir guard (direct entry path)", () => {
  it("rejects a state directory inside the package directory before doing any IO", async () => {
    // The guard runs before load, so no real package fixture is needed: the rejection
    // must not depend on the package existing on disk.
    await expect(
      runAuthoringHostCommand({
        packageDirectory: "/repo/pkg",
        stateDirectory: "/repo/pkg/state",
        command: { command: "validatePackage", payload: { profile: "strict" } }
      })
    ).rejects.toBeInstanceOf(AuthoringHostStateDirectoryError);
  });
});

describe("runAuthoringHostCli state-dir guard (exit code)", () => {
  it("returns exit code 1 and an error outcome when --state-dir is inside --package-dir", async () => {
    let stdout = "";
    const result = await runAuthoringHostCli({
      argv: ["--package-dir", "/repo/pkg", "--state-dir", "/repo/pkg/state"],
      readStdin: async () =>
        JSON.stringify({
          schemaVersion: "ai-command-request-v1",
          commandId: "cmd_state_guard",
          session: { agentId: "agent_test", capabilities: ["validate"] },
          basis: { relatedAC: [], relatedScenarios: [] },
          command: "validatePackage",
          payload: { profile: "strict" }
        }),
      writeStdout: (text) => {
        stdout += text;
      }
    });

    expect(result.exitCode).toBe(1);
    expect(result.response.outcome).toBe("error");
    expect(stdout).toContain("must live outside");
  });
});
