export interface AuthoringHostCliArguments {
  readonly packageDirectory: string;
  readonly stateDirectory: string;
  /** Path to a JSON file containing the AI command, or undefined to read from stdin. */
  readonly commandFilePath?: string;
  readonly humanApprovalOperationTypes: readonly string[];
}

import { isStateDirectoryInsidePackageDirectory } from "./state-directory-guard.js";

export class AuthoringHostCliArgumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthoringHostCliArgumentError";
  }
}

const requireValue = (flag: string, value: string | undefined): string => {
  if (value === undefined) {
    throw new AuthoringHostCliArgumentError(`${flag} requires a value.`);
  }

  return value;
};

/**
 * Parses CLI argv (already sliced past `node script.ts`) into structured options.
 * Recognized flags:
 *   --package-dir <dir>            (required) on-disk package directory to load/save
 *   --state-dir <dir>             (required) approval/transcript state dir (outside package)
 *   --command-file <path>         optional JSON command file; omit to read stdin
 *   --human-approval-op <type>    optional, repeatable; operation classes kept human-gated
 */
export const parseAuthoringHostCliArguments = (
  argv: readonly string[]
): AuthoringHostCliArguments => {
  let packageDirectory: string | undefined;
  let stateDirectory: string | undefined;
  let commandFilePath: string | undefined;
  const humanApprovalOperationTypes: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const nextValue = argv[index + 1];

    switch (flag) {
      case "--package-dir":
        packageDirectory = requireValue(flag, nextValue);
        index += 1;
        break;
      case "--state-dir":
        stateDirectory = requireValue(flag, nextValue);
        index += 1;
        break;
      case "--command-file":
        commandFilePath = requireValue(flag, nextValue);
        index += 1;
        break;
      case "--human-approval-op":
        humanApprovalOperationTypes.push(requireValue(flag, nextValue));
        index += 1;
        break;
      default:
        throw new AuthoringHostCliArgumentError(`Unknown argument: ${flag ?? "<empty>"}`);
    }
  }

  if (packageDirectory === undefined) {
    throw new AuthoringHostCliArgumentError("--package-dir is required.");
  }

  if (stateDirectory === undefined) {
    throw new AuthoringHostCliArgumentError("--state-dir is required.");
  }

  if (isStateDirectoryInsidePackageDirectory(packageDirectory, stateDirectory)) {
    throw new AuthoringHostCliArgumentError(
      `--state-dir (${stateDirectory}) must live outside --package-dir (${packageDirectory}); ` +
        "writing approval/transcript state inside the package directory would corrupt the package."
    );
  }

  return {
    packageDirectory,
    stateDirectory,
    ...(commandFilePath === undefined ? {} : { commandFilePath }),
    humanApprovalOperationTypes
  };
};
