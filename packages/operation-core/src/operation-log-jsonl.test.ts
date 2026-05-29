import { createInitialAuthoringRevision } from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import { PackageIdSchema } from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { createOperationCore } from "./operation-core.js";
import {
  parseOperationLogEntriesFromJsonl,
  serializeOperationLogEntriesToJsonl
} from "./operation-log-jsonl.js";
import type { OperationLogEntryDto } from "./operation-log-entry.js";

describe("operation log JSONL codec", () => {
  it("round-trips operation log entries with one entry per line", () => {
    const entries = createCommittedLogEntries();

    const jsonl = serializeOperationLogEntriesToJsonl(entries);
    const lines = jsonl.split("\n");

    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("\"operationId\":\"op_create_smile\"");
    expect(lines[1]).toContain("\"operationId\":\"op_create_frown\"");
    expect(lines[2]).toBe("");
    expect(parseOperationLogEntriesFromJsonl(jsonl)).toEqual(entries);
  });

  it("serializes and parses an empty log as empty text", () => {
    expect(serializeOperationLogEntriesToJsonl([])).toBe("");
    expect(parseOperationLogEntriesFromJsonl("")).toEqual([]);
  });

  it("rejects lines that are not valid JSON", () => {
    expect(() => parseOperationLogEntriesFromJsonl("not-json\n")).toThrow(
      /Invalid operation log JSONL line 1/
    );
  });

  it("rejects JSON lines that do not match OperationLogEntryDto", () => {
    expect(() => parseOperationLogEntriesFromJsonl("{}\n")).toThrow(
      /Invalid operation log JSONL line 1/
    );
  });

  it("rejects blank lines so entries remain one-per-line", () => {
    const [entry] = createCommittedLogEntries();
    if (entry === undefined) {
      throw new Error("Expected fixture log entry.");
    }

    const jsonlWithBlankLine = `${serializeOperationLogEntriesToJsonl([entry])}\n`;

    expect(() => parseOperationLogEntriesFromJsonl(jsonlWithBlankLine)).toThrow(
      /Invalid operation log JSONL line 2/
    );
  });
});

const createCommittedLogEntries = (): readonly OperationLogEntryDto[] => {
  const session = createFixtureSession();
  const core = createOperationCore({
    now: () => new Date("2026-05-29T00:00:00.000Z")
  });

  const first = core.commitOperation(
    session,
    createParameterRequest({
      operationId: "op_create_smile",
      parameterId: "param_smile",
      displayName: "Smile",
      basePackageRevision: 0
    })
  );
  const second = core.commitOperation(
    session,
    createParameterRequest({
      operationId: "op_create_frown",
      parameterId: "param_frown",
      displayName: "Frown",
      basePackageRevision: 1
    })
  );

  return [
    requireLogEntry(first.logEntry),
    requireLogEntry(second.logEntry)
  ];
};

const requireLogEntry = (entry: OperationLogEntryDto | undefined): OperationLogEntryDto => {
  if (entry === undefined) {
    throw new Error("Expected committed operation to produce a log entry.");
  }

  return entry;
};

const createParameterRequest = (input: {
  readonly operationId: string;
  readonly parameterId: string;
  readonly displayName: string;
  readonly basePackageRevision: number;
}) => ({
  schemaVersion: "operation-request-v1",
  operationId: input.operationId,
  actor: "test",
  surface: "testFixture",
  dryRun: false,
  basePackageRevision: input.basePackageRevision,
  operationType: "createParameter",
  payload: {
    parameterId: input.parameterId,
    displayName: input.displayName,
    semanticRole: "mouth",
    min: 0,
    max: 1,
    default: 0,
    recommendedUiStep: 0.01
  }
});

const createFixtureSession = (): AuthoringSession => ({
  packageIdentity: {
    packageId: PackageIdSchema.parse("pkg_operation_log_jsonl_test"),
    packageDisplayName: "Operation Log JSONL Test",
    formatVersion: "open-model-package-v1"
  },
  packageRevision: 0,
  authoringRevision: createInitialAuthoringRevision(),
  dirty: false,
  graph: {
    coordinateSystem: "canvas-y-down-v1",
    canvasSize: {
      width: 1024,
      height: 1024
    },
    parts: [],
    drawables: [],
    meshes: [],
    parameters: [],
    keyformSets: [],
    rigControls: [],
    dynamicsGroups: [],
    masks: [],
    drawOrder: [],
    rigControlRootIds: [],
    stableOrder: [],
    sourceAssets: [],
    provenanceRecords: [],
    rightsRecords: []
  }
});
