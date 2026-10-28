import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  createStagePngCaptureFileName,
  formatStagePngCaptureTimestamp
} from "./stage-png-capture-file-name";

const maxFileNameAttempts = 999;

export interface StagePngCaptureWrittenFile {
  readonly fileName: string;
  readonly filePath: string;
}

/**
 * Writes one capture into `folderPath` (created when missing). An existing file
 * is never overwritten: each name is opened with `wx`, so a name taken between
 * two captures in the same second moves on to the next `-N` suffix.
 */
export async function writeStagePngCaptureFile(input: {
  readonly folderPath: string;
  readonly baseName: string;
  readonly capturedAt: Date;
  readonly pngBytes: Uint8Array;
}): Promise<StagePngCaptureWrittenFile> {
  await mkdir(input.folderPath, { recursive: true });
  const timestamp = formatStagePngCaptureTimestamp(input.capturedAt);

  for (let attempt = 1; attempt <= maxFileNameAttempts; attempt += 1) {
    const fileName = createStagePngCaptureFileName({
      baseName: input.baseName,
      timestamp,
      attempt
    });
    const filePath = path.join(input.folderPath, fileName);

    try {
      await writeFile(filePath, input.pngBytes, { flag: "wx" });
      return { fileName, filePath };
    } catch (error) {
      if (isFileExistsError(error)) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("No free file name was left for this capture.");
}

function isFileExistsError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === "EEXIST"
  );
}
