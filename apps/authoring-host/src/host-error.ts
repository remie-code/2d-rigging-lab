/**
 * A host-side rejection with a stable kebab-case code. Command dispatchers turn the code into a camelCase check ID
 * (for example `package-busy` -> `authoringHost.packageBusy`). Any other thrown error is an unexpected failure.
 */
export class HostError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "HostError";
  }
}

export const hostErrorCheckToken = (code: string): string => code.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
