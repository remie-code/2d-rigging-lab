import type {
  RuntimeExportLoadError,
  RuntimeExportLoadErrorCode
} from "../../preload/runtime-export-bridge-contract";

export class RuntimeExportLoaderError extends Error {
  constructor(
    readonly code: RuntimeExportLoadErrorCode,
    message: string,
    readonly artifactPath?: string,
    readonly details: readonly string[] = []
  ) {
    super(message);
    this.name = "RuntimeExportLoaderError";
  }
}

export function toRuntimeExportLoadError(
  error: unknown
): RuntimeExportLoadError {
  if (error instanceof RuntimeExportLoaderError) {
    return {
      code: error.code,
      message: error.message,
      ...(error.artifactPath === undefined ? {} : { artifactPath: error.artifactPath }),
      details: [...error.details]
    };
  }

  return {
    code: "runtimeExport.unexpectedError",
    message: formatUnknownError(error),
    details: []
  };
}

export function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
