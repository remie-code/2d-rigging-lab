import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createAuthoringSessionFromPackageDocument,
  getParameterById
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import { ParameterIdSchema } from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { createOperationCore, OperationRequestSchema } from "./index.js";

describe("minimal-operation-create-parameter contract fixture", () => {
  it("parses fixture createParameter requests through operation-core DTOs", () => {
    const dryRunRequest = loadFixtureJson("request/create-parameter-dry-run.request.json");
    const commitRequest = loadFixtureJson("request/create-parameter-commit.request.json");

    const parsedDryRun = OperationRequestSchema.parse(dryRunRequest);
    const parsedCommit = OperationRequestSchema.parse(commitRequest);

    expect(parsedDryRun).toMatchObject({
      operationType: "createParameter",
      dryRun: true,
      payload: {
        parameterId: "param_fixture_smile"
      }
    });
    expect(parsedCommit).toMatchObject({
      operationType: "createParameter",
      dryRun: false,
      payload: {
        parameterId: "param_fixture_smile"
      }
    });
    expect(parsedCommit.payload).toEqual(parsedDryRun.payload);
  });

  it("dry-runs the fixture request without mutating the authoring session", () => {
    const baseline = loadBaselineAuthoringInput();
    const session = createFixtureSession();
    const core = createOperationCore();
    const targetParameterId = ParameterIdSchema.parse("param_fixture_smile");
    const before = summarizeSession(session, targetParameterId);

    expect(session.packageIdentity.packageId).toBe(baseline.baselinePackage.packageId);
    expect(session.packageRevision).toBe(baseline.baselinePackage.packageRevision);
    expect(before).toMatchObject({
      authoringRevision: baseline.authoringInput.expectedInitialAuthoringRevision,
      dirty: baseline.authoringInput.expectedInitialDirty,
      parameterIds: baseline.authoringInput.expectedInitialParameterIds,
      stableOrder: baseline.authoringInput.expectedStableOrder
    });

    const result = core.dryRunOperation(
      session,
      loadFixtureJson("request/create-parameter-dry-run.request.json")
    );
    const expectedDryRun = loadDryRunSummary();
    const expectedModelDiff = loadModelDiffSummary();

    expect(result.status).toBe(expectedDryRun.result.status);
    expect(result.operationId).toBe(expectedDryRun.result.operationId);
    expect(result.precondition.ok).toBe(expectedDryRun.result.preconditionOk);
    expect(result.reversible).toBe(expectedDryRun.result.reversible);
    expect(result.modelDiff).toEqual(expectedModelDiff.modelDiff);
    expect(expectedDryRun.sessionMutation.parameterAbsentInOriginal).toBe(targetParameterId);
    expect(summarizeSession(session, targetParameterId)).toEqual({
      ...before,
      authoringRevision: expectedDryRun.sessionMutation.originalAuthoringRevisionAfter,
      dirty: expectedDryRun.sessionMutation.originalDirtyAfter
    });
    expect(getParameterById(session.graph, targetParameterId)).toBeUndefined();
    expect(core.operationLog.entries).toHaveLength(expectedDryRun.operationLog.expectedLength);
  });

  it("commits the fixture request and matches the expected log and diff summary", () => {
    const session = createFixtureSession();
    const core = createOperationCore({
      now: () => new Date("2026-05-29T00:00:00.000Z")
    });
    const targetParameterId = ParameterIdSchema.parse("param_fixture_smile");
    const before = summarizeSession(session, targetParameterId);

    const outcome = core.commitOperation(
      session,
      loadFixtureJson("request/create-parameter-commit.request.json")
    );
    const expectedCommit = loadCommitSummary();
    const expectedModelDiff = loadModelDiffSummary();
    const committedParameter = getParameterById(session.graph, targetParameterId);

    expect(before.authoringRevision).toBe(expectedCommit.sessionMutation.authoringRevisionBefore);
    expect(outcome.result.status).toBe(expectedCommit.result.status);
    expect(outcome.result.operationId).toBe(expectedCommit.result.operationId);
    expect(outcome.result.precondition.ok).toBe(expectedCommit.result.preconditionOk);
    expect(outcome.result.reversible).toBe(expectedCommit.result.reversible);
    expect(outcome.result.modelDiff).toEqual(expectedModelDiff.modelDiff);
    expect(session.packageRevision).toBe(1);
    expect(session.authoringRevision).toBe(expectedCommit.sessionMutation.authoringRevisionAfter);
    expect(session.dirty).toBe(expectedCommit.sessionMutation.dirtyAfter);
    expect(committedParameter).toMatchObject(expectedCommit.sessionMutation.addedParameter);
    expect(session.graph.stableOrder).toContain(targetParameterId);
    expect(outcome.operationLogLength).toBe(expectedCommit.operationLog.expectedLength);
    expect(core.operationLog.entries).toHaveLength(expectedCommit.operationLog.expectedLength);
    expect(outcome.logEntry).toMatchObject(expectedCommit.operationLog.entry);
    expect(outcome.logEntry?.result.modelDiff).toEqual(expectedModelDiff.modelDiff);
  });
});

type PackageDocumentInput = Parameters<typeof createAuthoringSessionFromPackageDocument>[0];

interface BaselineAuthoringInputFixture {
  readonly baselinePackage: {
    readonly fixtureId: string;
    readonly rootRelativePath: string;
    readonly packageId: string;
    readonly packageRevision: number;
  };
  readonly authoringInput: {
    readonly expectedInitialAuthoringRevision: number;
    readonly expectedInitialDirty: boolean;
    readonly expectedInitialParameterIds: readonly string[];
    readonly expectedStableOrder: readonly string[];
  };
}

interface ModelDiffSummaryFixture {
  readonly modelDiff: NonNullable<ReturnType<ReturnType<typeof createOperationCore>["dryRunOperation"]>["modelDiff"]>;
}

interface OperationSummaryFixture {
  readonly result: {
    readonly operationId: string;
    readonly status: string;
    readonly preconditionOk: boolean;
    readonly reversible: boolean;
  };
}

interface DryRunSummaryFixture extends OperationSummaryFixture {
  readonly sessionMutation: {
    readonly originalAuthoringRevisionAfter: number;
    readonly originalDirtyAfter: boolean;
    readonly parameterAbsentInOriginal: string;
  };
  readonly operationLog: {
    readonly expectedLength: number;
  };
}

interface CommitSummaryFixture extends OperationSummaryFixture {
  readonly sessionMutation: {
    readonly authoringRevisionBefore: number;
    readonly authoringRevisionAfter: number;
    readonly dirtyAfter: boolean;
    readonly addedParameter: {
      readonly parameterId: string;
      readonly displayName: string;
      readonly semanticRole: string;
      readonly valueSource: string;
      readonly min: number;
      readonly max: number;
      readonly default: number;
      readonly recommendedUiStep: number;
    };
  };
  readonly operationLog: {
    readonly expectedLength: number;
    readonly entry: {
      readonly operationId: string;
      readonly transactionId: string;
      readonly timestamp: string;
      readonly actor: string;
      readonly surface: string;
      readonly operationType: string;
      readonly targetIds: readonly string[];
      readonly provenanceId: string;
      readonly reversible: boolean;
    };
  };
}

const summarizeSession = (session: AuthoringSession, parameterId: ReturnType<typeof ParameterIdSchema.parse>) => ({
  packageRevision: session.packageRevision,
  authoringRevision: session.authoringRevision,
  dirty: session.dirty,
  parameterIds: session.graph.parameters.map((parameter) => parameter.parameterId),
  targetParameter: getParameterById(session.graph, parameterId),
  stableOrder: session.graph.stableOrder
});

const createFixtureSession = (): AuthoringSession =>
  createAuthoringSessionFromPackageDocument(loadBaselinePackageDocument());

const loadBaselinePackageDocument = (): PackageDocumentInput => {
  const baseline = loadBaselineAuthoringInput();
  const fixtureDirectory = join(fixtureRootDirectory, baseline.baselinePackage.rootRelativePath);

  return {
    manifest: readJson(join(fixtureDirectory, "manifest.json")) as PackageDocumentInput["manifest"],
    model: {
      graph: readJson(join(fixtureDirectory, "model/graph.json")) as PackageDocumentInput["model"]["graph"],
      drawables: readJson(join(fixtureDirectory, "model/drawables.json")) as PackageDocumentInput["model"]["drawables"],
      meshes: readJson(join(fixtureDirectory, "model/meshes.json")) as PackageDocumentInput["model"]["meshes"],
      parameters: readJson(join(fixtureDirectory, "model/parameters.json")) as PackageDocumentInput["model"]["parameters"],
      keyforms: readJson(join(fixtureDirectory, "model/keyforms.json")) as PackageDocumentInput["model"]["keyforms"],
      rigControls: readJson(join(fixtureDirectory, "model/rig-controls.json")) as PackageDocumentInput["model"]["rigControls"],
      dynamics: readJson(join(fixtureDirectory, "model/dynamics.json")) as PackageDocumentInput["model"]["dynamics"],
      masks: readJson(join(fixtureDirectory, "model/masks.json")) as PackageDocumentInput["model"]["masks"],
      drawOrder: readJson(join(fixtureDirectory, "model/draw-order.json")) as PackageDocumentInput["model"]["drawOrder"]
    },
    assets: {
      sourceManifest: readJson(join(fixtureDirectory, "assets/sources/source-manifest.json")) as PackageDocumentInput["assets"]["sourceManifest"],
      provenance: readJson(join(fixtureDirectory, "assets/provenance.json")) as PackageDocumentInput["assets"]["provenance"],
      rights: readJson(join(fixtureDirectory, "assets/rights.json")) as PackageDocumentInput["assets"]["rights"]
    }
  };
};

const loadBaselineAuthoringInput = (): BaselineAuthoringInputFixture =>
  loadFixtureJson("baseline-authoring-input.json") as BaselineAuthoringInputFixture;

const loadDryRunSummary = (): DryRunSummaryFixture =>
  loadFixtureJson("expected/dry-run-summary.json") as DryRunSummaryFixture;

const loadCommitSummary = (): CommitSummaryFixture =>
  loadFixtureJson("expected/commit-summary.json") as CommitSummaryFixture;

const loadModelDiffSummary = (): ModelDiffSummaryFixture =>
  loadFixtureJson("expected/model-diff-summary.json") as ModelDiffSummaryFixture;

const loadFixtureJson = (relativePath: string): unknown =>
  readJson(join(fixtureRootDirectory, relativePath));

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));

const fixtureRootDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/contracts/minimal-operation-create-parameter"
);
