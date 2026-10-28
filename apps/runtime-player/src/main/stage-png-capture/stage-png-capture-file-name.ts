import path from "node:path";

export const runtimePlayerStagePngCaptureFolderName = "Runtime Player";

const fallbackBaseName = "stage";
const maxBaseNameLength = 100;
// Windows rejects these in file names, plus the C0 control characters.
const windowsForbiddenFileNameCharacters = /[<>:"/\\|?*\u0000-\u001f]/g;

export function resolveRuntimePlayerStagePngCaptureFolderPath(
  picturesPath: string
): string {
  return path.join(picturesPath, runtimePlayerStagePngCaptureFolderName);
}

/**
 * The file name stem is the loaded Runtime Export's folder name: the manifest's
 * display name and packageId are the Editor defaults for every model today, so
 * the folder is what tells two models apart (thumbnail-capture.md §4).
 */
export function readStagePngCaptureBaseName(
  runtimeExportDirectoryPath: string
): string {
  const segments = runtimeExportDirectoryPath
    .split(/[\\/]+/)
    .filter((segment) => segment.length > 0);

  return sanitizeStagePngCaptureBaseName(segments.at(-1) ?? "");
}

export function sanitizeStagePngCaptureBaseName(name: string): string {
  const sanitized = name
    .replace(windowsForbiddenFileNameCharacters, "_")
    .trim()
    .slice(0, maxBaseNameLength)
    .trim();

  return sanitized.length === 0 ? fallbackBaseName : sanitized;
}

/** `YYYYMMDD-HHMMSS` in local time. */
export function formatStagePngCaptureTimestamp(date: Date): string {
  const datePart = [
    String(date.getFullYear()).padStart(4, "0"),
    pad2(date.getMonth() + 1),
    pad2(date.getDate())
  ].join("");
  const timePart = [
    pad2(date.getHours()),
    pad2(date.getMinutes()),
    pad2(date.getSeconds())
  ].join("");

  return `${datePart}-${timePart}`;
}

/**
 * `<base>-<timestamp>.png`, then `<base>-<timestamp>-2.png`, `-3`, … for the
 * attempts that follow a name that is already taken.
 */
export function createStagePngCaptureFileName(input: {
  readonly baseName: string;
  readonly timestamp: string;
  readonly attempt: number;
}): string {
  const suffix = input.attempt <= 1 ? "" : `-${input.attempt}`;

  return `${input.baseName}-${input.timestamp}${suffix}.png`;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}
