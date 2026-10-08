import type {
  WorkspaceFsReadMode,
  WorkspaceFsWritePayload
} from "../../preload/workspace-fs-bridge-contract";

// Requests arrive from the renderer as `unknown` (IPC boundary). Every handler
// validates the shape here before it reaches node:fs.

export interface WorkspaceFsPathRequest {
  readonly rootPath: string;
  readonly relPath: string;
}

export interface WorkspaceFsReadFileRequest extends WorkspaceFsPathRequest {
  readonly mode: WorkspaceFsReadMode;
}

export interface WorkspaceFsWriteFileRequest extends WorkspaceFsPathRequest {
  readonly payload: WorkspaceFsWritePayload;
}

export function readWorkspaceFsPathRequest(
  value: unknown
): WorkspaceFsPathRequest {
  const record = asRecord(value);
  return {
    rootPath: readString(record.rootPath, "rootPath"),
    relPath: readString(record.relPath, "relPath")
  };
}

export function readWorkspaceFsReadFileRequest(
  value: unknown
): WorkspaceFsReadFileRequest {
  const record = asRecord(value);
  return {
    rootPath: readString(record.rootPath, "rootPath"),
    relPath: readString(record.relPath, "relPath"),
    mode: readReadMode(record.mode)
  };
}

export function readWorkspaceFsWriteFileRequest(
  value: unknown
): WorkspaceFsWriteFileRequest {
  const record = asRecord(value);
  return {
    rootPath: readString(record.rootPath, "rootPath"),
    relPath: readString(record.relPath, "relPath"),
    payload: readWritePayload(record.payload)
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    throw new Error("Workspace fs request must be an object.");
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new Error(`Workspace fs request field ${fieldName} must be a string.`);
  }
  return value;
}

function readReadMode(value: unknown): WorkspaceFsReadMode {
  if (value === "utf8" || value === "binary") {
    return value;
  }
  throw new Error('Workspace fs read mode must be "utf8" or "binary".');
}

function readWritePayload(value: unknown): WorkspaceFsWritePayload {
  const record = asRecord(value);

  if (record.kind === "utf8") {
    return { kind: "utf8", text: readString(record.text, "payload.text") };
  }

  if (record.kind === "binary") {
    return { kind: "binary", bytes: readBytes(record.bytes) };
  }

  throw new Error('Workspace fs write payload kind must be "utf8" or "binary".');
}

function readBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  throw new Error("Workspace fs binary payload bytes must be a Uint8Array.");
}
