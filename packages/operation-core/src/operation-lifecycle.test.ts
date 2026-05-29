import { createInitialAuthoringRevision, getParameterById } from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import { PackageIdSchema, ParameterIdSchema } from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { createOperationCore } from "./index.js";
import type { OperationLogEntryDto } from "./operation-log-entry.js";

describe("operation lifecycle foundation", () => {
  it("dry-runs createParameter without mutating the original session", () => {
    const session = createFixtureSession();
    const core = createOperationCore();

    const result = core.dryRunOperation(session, createParameterRequest({ dryRun: true }));

    expect(result.status).toBe("dry_run");
    expect(result.operationId).toBe("op_create_smile");
    expect(result.modelDiff?.added).toEqual([{ kind: "parameter", id: "param_smile" }]);
    expect(result.modelDiff?.operationIds).toEqual(["op_create_smile"]);
    expect(getParameterById(session.graph, ParameterIdSchema.parse("param_smile"))).toBeUndefined();
    expect(session.packageRevision).toBe(0);
    expect(session.authoringRevision).toBe(0);
    expect(session.dirty).toBe(false);
    expect(core.operationLog.entries).toHaveLength(0);
  });

  it("commits createParameter and appends an operation log entry", () => {
    const session = createFixtureSession();
    const core = createOperationCore({
      now: () => new Date("2026-05-29T00:00:00.000Z")
    });

    const outcome = core.commitOperation(session, createParameterRequest({ dryRun: false }));

    expect(outcome.result.status).toBe("committed");
    expect(session.packageRevision).toBe(1);
    expect(session.authoringRevision).toBe(1);
    expect(session.dirty).toBe(true);
    expect(getParameterById(session.graph, ParameterIdSchema.parse("param_smile"))?.displayName).toBe("Smile");
    expect(outcome.operationLogLength).toBe(1);
    expect(core.operationLog.entries).toHaveLength(1);

    const logEntry = outcome.logEntry;
    expect(logEntry).toBeDefined();
    expect(logEntry?.operationId).toBe("op_create_smile");
    expect(logEntry?.transactionId).toBe("txn_create_smile");
    expect(logEntry?.actor).toBe("test");
    expect(logEntry?.surface).toBe("testFixture");
    expect(logEntry?.payload.operationType).toBe("createParameter");
    expect(logEntry?.result.status).toBe("committed");
    expect(logEntry?.targetIds).toEqual(["param_smile"]);
    expect(logEntry?.provenanceId).toBe("prov_create_smile");
  });

  it("hydrates initial operation log entries defensively", () => {
    const initialEntry = createCommittedLogEntry();
    const initialEntries = [initialEntry];
    const core = createOperationCore({
      initialOperationLogEntries: initialEntries
    });

    initialEntries.splice(0, initialEntries.length);
    initialEntry.targetIds.push("param_mutated");

    expect(core.operationLog.entries).toHaveLength(1);
    expect(core.operationLog.entries[0]?.operationId).toBe("op_create_smile");
    expect(core.operationLog.entries[0]?.targetIds).toEqual(["param_smile"]);
  });

  it("appends new commits after hydrated operation log entries", () => {
    const session = createFixtureSession({ packageRevision: 1 });
    const core = createOperationCore({
      initialOperationLogEntries: [createCommittedLogEntry()],
      now: () => new Date("2026-05-29T00:01:00.000Z")
    });

    const outcome = core.commitOperation(
      session,
      createParameterRequest({
        dryRun: false,
        basePackageRevision: 1,
        operationId: "op_create_frown",
        parameterId: "param_frown",
        displayName: "Frown"
      })
    );

    expect(outcome.result.status).toBe("committed");
    expect(outcome.operationLogLength).toBe(2);
    expect(core.operationLog.entries.map((entry) => entry.operationId)).toEqual([
      "op_create_smile",
      "op_create_frown"
    ]);
  });

  it("rejects invalid hydrated operation log entries", () => {
    expect(() =>
      createOperationCore({
        initialOperationLogEntries: [{} as OperationLogEntryDto]
      })
    ).toThrow();
  });

  it("rejects a stale base package revision before mutation or log append", () => {
    const session = createFixtureSession();
    const core = createOperationCore();

    const outcome = core.commitOperation(
      session,
      createParameterRequest({ dryRun: false, basePackageRevision: 1 })
    );

    expect(outcome.result.status).toBe("rejected");
    expect(outcome.result.diagnostics[0]?.checkId).toBe("operation.request.baseRevision");
    expect(session.packageRevision).toBe(0);
    expect(session.authoringRevision).toBe(0);
    expect(session.dirty).toBe(false);
    expect(getParameterById(session.graph, ParameterIdSchema.parse("param_smile"))).toBeUndefined();
    expect(outcome.operationLogLength).toBe(0);
    expect(core.operationLog.entries).toHaveLength(0);
  });

  it("rejects duplicate parameters without mutating or appending a log entry", () => {
    const session = createFixtureSession();
    const core = createOperationCore();

    core.commitOperation(session, createParameterRequest({ dryRun: false }));
    const packageRevisionAfterFirstCommit = session.packageRevision;
    const revisionAfterFirstCommit = session.authoringRevision;
    const logLengthAfterFirstCommit = core.operationLog.entries.length;
    const duplicate = core.commitOperation(
      session,
      createParameterRequest({
        dryRun: false,
        basePackageRevision: packageRevisionAfterFirstCommit
      })
    );

    expect(duplicate.result.status).toBe("rejected");
    expect(duplicate.result.precondition.ok).toBe(false);
    expect(duplicate.result.diagnostics[0]?.checkId).toBe("operation.createParameter.duplicateParameter");
    expect(session.packageRevision).toBe(packageRevisionAfterFirstCommit);
    expect(session.authoringRevision).toBe(revisionAfterFirstCommit);
    expect(core.operationLog.entries).toHaveLength(logLengthAfterFirstCommit);
  });

  it("rejects unsupported operations without changing package or authoring revision", () => {
    const session = createFixtureSession();
    const core = createOperationCore();

    const unsupported = core.commitOperation(session, createUnsupportedGenerateMeshRequest());

    expect(unsupported.result.status).toBe("rejected");
    expect(unsupported.result.diagnostics[0]?.checkId).toBe("operation.lifecycle.unsupportedOperation");
    expect(session.packageRevision).toBe(0);
    expect(session.authoringRevision).toBe(0);
    expect(session.dirty).toBe(false);
    expect(unsupported.operationLogLength).toBe(0);
    expect(core.operationLog.entries).toHaveLength(0);
  });
});

const createParameterRequest = (options: {
  readonly dryRun: boolean;
  readonly basePackageRevision?: number;
  readonly operationId?: string;
  readonly parameterId?: string;
  readonly displayName?: string;
}) => ({
  schemaVersion: "operation-request-v1",
  operationId: options.operationId ?? "op_create_smile",
  actor: "test",
  surface: "testFixture",
  dryRun: options.dryRun,
  basePackageRevision: options.basePackageRevision ?? 0,
  operationType: "createParameter",
  payload: {
    parameterId: options.parameterId ?? "param_smile",
    displayName: options.displayName ?? "Smile",
    semanticRole: "mouth",
    min: 0,
    max: 1,
    default: 0,
    recommendedUiStep: 0.01
  }
});

const createCommittedLogEntry = (): OperationLogEntryDto => {
  const session = createFixtureSession();
  const core = createOperationCore({
    now: () => new Date("2026-05-29T00:00:00.000Z")
  });
  const outcome = core.commitOperation(session, createParameterRequest({ dryRun: false }));

  if (outcome.logEntry === undefined) {
    throw new Error("Expected committed operation to produce a log entry.");
  }

  return outcome.logEntry;
};

const createUnsupportedGenerateMeshRequest = () => ({
  schemaVersion: "operation-request-v1",
  operationId: "op_generate_mesh",
  actor: "test",
  surface: "testFixture",
  dryRun: false,
  basePackageRevision: 0,
  operationType: "generateMesh",
  payload: {
    drawableId: "draw_missing",
    method: "manual-empty"
  }
});

const createFixtureSession = (options: {
  readonly packageRevision?: number;
} = {}): AuthoringSession => ({
  packageIdentity: {
    packageId: PackageIdSchema.parse("pkg_operation_lifecycle_test"),
    packageDisplayName: "Operation Lifecycle Test",
    formatVersion: "open-model-package-v1"
  },
  packageRevision: options.packageRevision ?? 0,
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
