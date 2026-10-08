import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  buildCommitCommand,
  buildDryRunCommand,
  createParameterPayload
} from "./test-support/command-builders.js";
import { writeSeedFixturePackage } from "./test-support/authoring-host-fixtures.js";
import type { AuthoringHostCommandResponse } from "./authoring-host-response.js";

const appDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
// The `--import` hook is passed as a file:// URL (node resolves --import specifiers as
// module specifiers, and a bare Windows drive path is otherwise read as a URL scheme).
// The TypeScript main entry is passed relative to the child cwd so node's main resolution
// converts it to a file URL itself.
const registerHookUrl = pathToFileURL(join(appDirectory, "register-workspace-source-resolver.mjs")).href;
const cliEntryRelativePath = join("src", "cli.ts");

const createdRoots: string[] = [];

afterEach(async () => {
  await Promise.all(createdRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

interface CliRunResult {
  readonly exitCode: number;
  readonly response: AuthoringHostCommandResponse;
}

/**
 * Runs the CLI in a real child process. Each invocation is one OS process (1 command =
 * 1 process), so a dry-run recorded by one process must be visible to a commit run by a
 * later, independent process only through the on-disk --state-dir.
 */
const runCliProcess = async (input: {
  readonly packageDirectory: string;
  readonly stateDirectory: string;
  readonly commandFilePath: string;
}): Promise<CliRunResult> =>
  new Promise<CliRunResult>((resolvePromise, rejectPromise) => {
    const child = spawn(
      process.execPath,
      [
        "--experimental-transform-types",
        "--no-warnings",
        "--import",
        registerHookUrl,
        cliEntryRelativePath,
        "--package-dir",
        input.packageDirectory,
        "--state-dir",
        input.stateDirectory,
        "--command-file",
        input.commandFilePath
      ],
      { cwd: appDirectory }
    );

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      try {
        const response = JSON.parse(stdout) as AuthoringHostCommandResponse;
        resolvePromise({ exitCode: code ?? -1, response });
      } catch (error) {
        rejectPromise(
          new Error(
            `CLI stdout was not valid JSON (exit ${code ?? "null"}).\nstdout: ${stdout}\nstderr: ${stderr}\n${String(error)}`
          )
        );
      }
    });
  });

describe("authoring host CLI across separate processes", () => {
  it("carries a dry-run approval across separate process invocations via the state directory", async () => {
    const root = await mkdtemp(join(tmpdir(), "authoring-host-cli-"));
    createdRoots.push(root);
    const packageDirectory = join(root, "package");
    const stateDirectory = join(root, "state");
    const commandDirectory = join(root, "commands");
    await writeSeedFixturePackage(packageDirectory);
    await mkdir(commandDirectory, { recursive: true });

    const operation = {
      operationType: "createParameter",
      operationId: "op_cross_param",
      basePackageRevision: 0,
      payload: createParameterPayload({
        parameterId: "param_cross",
        displayName: "Cross Process",
        min: -1,
        max: 1,
        default: 0
      })
    };

    const dryRunCommandPath = join(commandDirectory, "dry-run.json");
    await writeFile(
      dryRunCommandPath,
      JSON.stringify(buildDryRunCommand({ commandId: "cmd_cross_dry", operation }))
    );
    const dryRunResult = await runCliProcess({
      packageDirectory,
      stateDirectory,
      commandFilePath: dryRunCommandPath
    });

    expect(dryRunResult.exitCode).toBe(0);
    expect(dryRunResult.response.outcome).toBe("success");
    expect(dryRunResult.response.autoApproval?.autoApproved).toBe(true);
    expect(dryRunResult.response.saved).toBe(false);

    // Second, fully independent process. It only knows about the earlier approval through
    // the persisted state directory.
    const commitCommandPath = join(commandDirectory, "commit.json");
    await writeFile(
      commitCommandPath,
      JSON.stringify(
        buildCommitCommand({
          commandId: "cmd_cross_commit",
          approvedDryRunCommandId: "cmd_cross_dry",
          operation
        })
      )
    );
    const commitResult = await runCliProcess({
      packageDirectory,
      stateDirectory,
      commandFilePath: commitCommandPath
    });

    expect(commitResult.exitCode).toBe(0);
    expect(commitResult.response.outcome).toBe("success");
    expect(commitResult.response.aiCommandStatus).toBe("ok");
    expect(commitResult.response.saved).toBe(true);
    expect(commitResult.response.packageRevision).toBe(1);

    const parameters = JSON.parse(
      await readFile(join(packageDirectory, "model", "parameters.json"), "utf8")
    ) as { readonly parameters: readonly { readonly parameterId: string }[] };
    expect(parameters.parameters.map((parameter) => parameter.parameterId)).toContain("param_cross");

    // State lives outside the package directory.
    const stateFiles = await readdir(stateDirectory);
    expect(stateFiles.sort()).toEqual(["approval-state.json", "command-transcript.json"]);
  }, 60_000);

  it("refuses a commit in a fresh process when no prior dry-run approval was persisted", async () => {
    const root = await mkdtemp(join(tmpdir(), "authoring-host-cli-"));
    createdRoots.push(root);
    const packageDirectory = join(root, "package");
    const stateDirectory = join(root, "state");
    const commandDirectory = join(root, "commands");
    await writeSeedFixturePackage(packageDirectory);
    await mkdir(commandDirectory, { recursive: true });

    const commitCommandPath = join(commandDirectory, "commit-only.json");
    await writeFile(
      commitCommandPath,
      JSON.stringify(
        buildCommitCommand({
          commandId: "cmd_orphan_commit",
          approvedDryRunCommandId: "cmd_never_dry_ran",
          operation: {
            operationType: "createParameter",
            operationId: "op_orphan_param",
            basePackageRevision: 0,
            payload: createParameterPayload({
              parameterId: "param_orphan",
              displayName: "Orphan",
              min: -1,
              max: 1,
              default: 0
            })
          }
        })
      )
    );

    const commitResult = await runCliProcess({
      packageDirectory,
      stateDirectory,
      commandFilePath: commitCommandPath
    });

    expect(commitResult.exitCode).toBe(2);
    expect(commitResult.response.outcome).toBe("rejected");
    expect(commitResult.response.aiCommandStatus).toBe("needs_approval");
    expect(commitResult.response.saved).toBe(false);
  }, 60_000);
});
