import type {
  RuntimeExportErrorStatus,
  RuntimeExportLoadedPayload,
  RuntimeExportLoadedStatus,
  RuntimeExportLoadOperation,
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

  setLoading(
    directoryPath: string,
    operation: RuntimeExportLoadOperation = "manual-open"
  ): RuntimeExportLoadingStatus {
    const status: RuntimeExportLoadingStatus = {
      status: "loading",
      loaded: false,
      statusLabel: isRestoreOperation(operation)
        ? "Restoring Runtime Export"
        : "Loading Runtime Export",
      directoryPath,
      operation
    };

    this.#status = status;
    this.#loadedPayload = null;

    return status;
  }

  setLoaded(input: {
    readonly directoryPath: string;
    readonly payload: RuntimeExportLoadedPayload;
    readonly operation?: RuntimeExportLoadOperation;
  }): RuntimeExportLoadedStatus {
    const operation = input.operation ?? "manual-open";
    const status: RuntimeExportLoadedStatus = {
      status: "loaded",
      loaded: true,
      statusLabel: isRestoreOperation(operation)
        ? "Runtime Export restored"
        : "Runtime Export loaded",
      directoryPath: input.directoryPath,
      loadedAtIso: input.payload.loadedAtIso,
      summary: input.payload.summary,
      operation
    };

    this.#status = status;
    this.#loadedPayload = input.payload;

    return status;
  }

  setError(input: {
    readonly directoryPath: string;
    readonly error: RuntimeExportLoadError;
    readonly failedAtIso: string;
    readonly operation?: RuntimeExportLoadOperation;
  }): RuntimeExportErrorStatus {
    const operation = input.operation ?? "manual-open";
    const status: RuntimeExportErrorStatus = {
      status: "error",
      loaded: false,
      statusLabel: isRestoreOperation(operation)
        ? "Runtime Export restore failed"
        : "Runtime Export load failed",
      directoryPath: input.directoryPath,
      failedAtIso: input.failedAtIso,
      error: input.error,
      operation
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

function isRestoreOperation(operation: RuntimeExportLoadOperation): boolean {
  return operation === "startup-restore" || operation === "retry-restore";
}
