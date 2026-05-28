import { createInitialAuthoringRevision, getParameterById } from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import { PackageIdSchema, ParameterIdSchema } from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { createOperationCore } from "./index.js";

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

  it("rejects duplicate parameters without mutating or appending a log entry", () => {
    const session = createFixtureSession();
    const core = createOperationCore();

    core.commitOperation(session, createParameterRequest({ dryRun: false }));
    const revisionAfterFirstCommit = session.authoringRevision;
    const logLengthAfterFirstCommit = core.operationLog.entries.length;
    const duplicate = core.commitOperation(session, createParameterRequest({ dryRun: false }));

    expect(duplicate.result.status).toBe("rejected");
    expect(duplicate.result.precondition.ok).toBe(false);
    expect(duplicate.result.diagnostics[0]?.checkId).toBe("operation.createParameter.duplicateParameter");
    expect(session.authoringRevision).toBe(revisionAfterFirstCommit);
    expect(core.operationLog.entries).toHaveLength(logLengthAfterFirstCommit);
  });
});

const createParameterRequest = (options: { readonly dryRun: boolean }) => ({
  schemaVersion: "operation-request-v1",
  operationId: "op_create_smile",
  actor: "test",
  surface: "testFixture",
  dryRun: options.dryRun,
  basePackageRevision: 0,
  operationType: "createParameter",
  payload: {
    parameterId: "param_smile",
    displayName: "Smile",
    semanticRole: "mouth",
    min: 0,
    max: 1,
    default: 0,
    recommendedUiStep: 0.01
  }
});

const createFixtureSession = (): AuthoringSession => ({
  packageIdentity: {
    packageId: PackageIdSchema.parse("pkg_operation_lifecycle_test"),
    packageDisplayName: "Operation Lifecycle Test",
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
