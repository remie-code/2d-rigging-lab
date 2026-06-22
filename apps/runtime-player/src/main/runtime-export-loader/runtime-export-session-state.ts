import type {
  RuntimeExportErrorStatus,
  RuntimeExportLoadedPayload,
  RuntimeExportLoadedStatus,
  RuntimeExportLoadError,
  RuntimeExportLoadingStatus,
  RuntimeExportStatus
} from "../../preload/runtime-export-bridge-contract";

export class RuntimeExportSessionState {
  #status: RuntimeExportStatus = createEmptyRuntimeExportStatus();
  #loadedPayload: RuntimeExportLoadedPayload | null = null;

  getStatus(): RuntimeExportStatus {
    return this.#status;
  }

  getLoadedPayload(): RuntimeExportLoadedPayload | null {
    return this.#loadedPayload;
  }

  setLoading(directoryPath: string): RuntimeExportLoadingStatus {
    const status: RuntimeExportLoadingStatus = {
      status: "loading",
      loaded: false,
      statusLabel: "Loading Runtime Export",
      directoryPath
    };

    this.#status = status;
    this.#loadedPayload = null;

    return status;
  }

  setLoaded(input: {
    readonly directoryPath: string;
    readonly payload: RuntimeExportLoadedPayload;
  }): RuntimeExportLoadedStatus {
    const status: RuntimeExportLoadedStatus = {
      status: "loaded",
      loaded: true,
      statusLabel: "Runtime Export loaded",
      directoryPath: input.directoryPath,
      loadedAtIso: input.payload.loadedAtIso,
      summary: input.payload.summary
    };

    this.#status = status;
    this.#loadedPayload = input.payload;

    return status;
  }

  setError(input: {
    readonly directoryPath: string;
    readonly error: RuntimeExportLoadError;
    readonly failedAtIso: string;
  }): RuntimeExportErrorStatus {
    const status: RuntimeExportErrorStatus = {
      status: "error",
      loaded: false,
      statusLabel: "Runtime Export load failed",
      directoryPath: input.directoryPath,
      failedAtIso: input.failedAtIso,
      error: input.error
    };

    this.#status = status;
    this.#loadedPayload = null;

    return status;
  }
}

export function createEmptyRuntimeExportStatus(): RuntimeExportStatus {
  return {
    status: "empty",
    loaded: false,
    statusLabel: "No Runtime Export loaded"
  };
}
