import { readFile } from "node:fs/promises";

import {
  AuthoringHostCliArgumentError,
  parseAuthoringHostCliArguments
} from "./cli-arguments.js";
import {
  mapOutcomeToExitCode,
  type AuthoringHostCommandResponse
} from "./authoring-host-response.js";
import { runAuthoringHostCommand } from "./run-authoring-host-command.js";

export interface RunAuthoringHostCliInput {
  readonly argv: readonly string[];
  readonly readStdin: () => Promise<string>;
  readonly writeStdout: (text: string) => void;
  readonly now?: () => Date;
}

export interface RunAuthoringHostCliResult {
  readonly exitCode: number;
  readonly response: AuthoringHostCommandResponse;
}

/**
 * One-shot CLI: reads a single AI command (from --command-file or stdin), runs it
 * against the on-disk package, prints the JSON response to stdout, and returns a
 * process exit code distinguishing success (0), rejection (2), and error (1).
 */
export const runAuthoringHostCli = async (
  input: RunAuthoringHostCliInput
): Promise<RunAuthoringHostCliResult> => {
  let response: AuthoringHostCommandResponse;

  try {
    const args = parseAuthoringHostCliArguments(input.argv);
    const commandText = args.commandFilePath === undefined
      ? await input.readStdin()
      : await readFile(args.commandFilePath, "utf8");
    const command = parseCommandJson(commandText);

    response = await runAuthoringHostCommand({
      packageDirectory: args.packageDirectory,
      stateDirectory: args.stateDirectory,
      command,
      humanApprovalOperationTypes: args.humanApprovalOperationTypes,
      ...(input.now === undefined ? {} : { now: input.now })
    });
  } catch (error) {
    response = createErrorResponse(error);
  }

  input.writeStdout(`${JSON.stringify(response, null, 2)}\n`);

  return {
    exitCode: mapOutcomeToExitCode(response.outcome),
    response
  };
};

const parseCommandJson = (commandText: string): unknown => {
  const trimmed = commandText.trim();
  if (trimmed.length === 0) {
    throw new AuthoringHostCliArgumentError("No command JSON was provided on stdin or --command-file.");
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new AuthoringHostCliArgumentError(`Command input is not valid JSON: ${message}`);
  }
};

const createErrorResponse = (error: unknown): AuthoringHostCommandResponse => ({
  schemaVersion: "authoring-host-command-response-v1",
  outcome: "error",
  command: "unknown",
  saved: false,
  error: {
    name: error instanceof Error ? error.name : "Error",
    message: error instanceof Error ? error.message : String(error)
  }
});

const readStdinToString = async (): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8");
};

const isMainModule = (): boolean => {
  if (process.argv[1] === undefined) {
    return false;
  }

  return import.meta.url === new URL(`file://${process.argv[1]}`).href ||
    import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"));
};

if (isMainModule()) {
  runAuthoringHostCli({
    argv: process.argv.slice(2),
    readStdin: readStdinToString,
    writeStdout: (text) => process.stdout.write(text)
  })
    .then((result) => {
      process.exitCode = result.exitCode;
    })
    .catch((error: unknown) => {
      process.stdout.write(
        `${JSON.stringify(createErrorResponse(error), null, 2)}\n`
      );
      process.exitCode = 1;
    });
}
