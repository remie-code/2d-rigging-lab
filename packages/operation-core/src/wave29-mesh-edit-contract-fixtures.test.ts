import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createAuthoringSessionFromPackageDocument,
  toPackageDocument
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type { TargetRefDto } from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import {
  createOperationCore,
  OperationRequestSchema
} from "./index.js";
import type {
  CommitOperationOutcome,
  OperationRequestDto
} from "./index.js";
import {
  PackageDocumentSchema,
  type PackageDocumentDto
} from "../../package-format/src/index.js";

const CREATED_AT = "2026-06-01T00:00:00.000Z";
const SELECTED_VERTEX_IDS = [
  "vtx_wave29_mesh_0_1",
  "vtx_wave29_mesh_1_0"
] as const;

const OPERATION_REQUEST_PATHS = [
  "request/create-drawable-commit.request.json",
  "request/generate-mesh-commit.request.json",
  "request/move-mesh-vertices-commit.request.json"
] as const;

describe("wave29 mesh edit contract operation fixtures", () => {
  it("commits generated mesh creation and multi-vertex translate into package materialization", () => {
    const baselinePackage = loadBaselinePackageDocument();
    const session = createAuthoringSessionFromPackageDocument(baselinePackage);
    const core = createOperationCore({
      now: () => new Date(CREATED_AT)
    });

    const applied = loadOperationRequests().map((request) => {
      const outcome = core.commitOperation(session, request);
      return {
        request,
        outcome,
        packageRevisionAfter: session.packageRevision,
        authoringRevisionAfter: session.authoringRevision
      };
    });
    const materializedPackage = toPackageDocument(session, baselinePackage, {
      updatedAt: CREATED_AT
    });

    expect(summarizeOperationChain(applied, core.operationLog.entries.length)).toEqual(
      loadFixtureJson("expected/operation-chain-summary.json")
    );
    expect(summarizePackageMaterialization(materializedPackage, core.operationLog.entries.length)).toEqual(
      loadFixtureJson("expected/package-materialization-summary.json")
    );
    expect(summarizeEditorSelectionEvidence(materializedPackage)).toEqual(
      loadFixtureJson("expected/editor-selection-evidence-summary.json")
    );
  });
});

interface AppliedOperation {
  readonly request: OperationRequestDto;
  readonly outcome: CommitOperationOutcome;
  readonly packageRevisionAfter: AuthoringSession["packageRevision"];
  readonly authoringRevisionAfter: AuthoringSession["authoringRevision"];
}

const summarizeOperationChain = (
  applied: readonly AppliedOperation[],
  operationLogLength: number
) => ({
  schemaVersion: "wave29-mesh-edit-operation-chain-summary-v1",
  operations: applied.map(({ request, outcome, packageRevisionAfter, authoringRevisionAfter }) => {
    const modelDiff = outcome.result.modelDiff;

    if (modelDiff === undefined) {
      throw new Error(`Expected model diff for ${request.operationType}.`);
    }

    return {
      operationId: outcome.result.operationId,
      operationType: request.operationType,
      status: outcome.result.status,
      preconditionOk: outcome.result.precondition.ok,
      checkedTargets: outcome.result.precondition.checkedTargetRefs.map(toTargetRefKey),
      logEntryTargetIds: outcome.logEntry?.targetIds ?? [],
      changedTargets: modelDiff.changed.map((change) => toTargetRefKey(change.target)),
      changedFieldPaths: modelDiff.changed.flatMap((change) => change.fields.map((field) => field.path)),
      packageRevisionAfter,
      authoringRevisionAfter,
      operationLogLength: outcome.operationLogLength
    };
  }),
  finalOperationLogLength: operationLogLength
});

const summarizePackageMaterialization = (
  packageDocument: PackageDocumentDto,
  operationLogLength: number
) => {
  const drawable = expectOne(packageDocument.model.drawables.drawables, "drawable");
  const mesh = expectOne(packageDocument.model.meshes.meshes, "mesh");
  const sourceAsset = expectOne(packageDocument.assets.sourceManifest.sourceAssets, "source asset");
  const sourceLayer = expectOne(sourceAsset.layers, "source layer");

  return {
    schemaVersion: "wave29-mesh-edit-package-materialization-summary-v1",
    packageId: packageDocument.manifest.packageId,
    packageRevision: packageDocument.manifest.packageRevision,
    updatedAt: packageDocument.manifest.updatedAt,
    drawable: {
      drawableId: drawable.drawableId,
      displayName: drawable.displayName,
      partId: drawable.partId,
      textureId: drawable.textureId,
      meshId: drawable.meshId,
      runtimeVisibility: drawable.runtimeVisibility,
      baseDrawOrder: drawable.baseDrawOrder
    },
    mesh: {
      meshId: mesh.meshId,
      drawableId: mesh.drawableId,
      vertexStableIds: mesh.vertexStableIds,
      vertices: mesh.vertices,
      uvs: mesh.uvs,
      triangles: mesh.triangles,
      bounds: mesh.bounds,
      generationProvenanceId: mesh.generationProvenanceId
    },
    sourceLayerMapping: {
      sourceAssetId: sourceAsset.sourceAssetId,
      sourceLayerId: sourceLayer.sourceLayerId,
      mappedDrawableIds: sourceLayer.mappedDrawableIds
    },
    operationLog: {
      operationIds: OPERATION_REQUEST_PATHS.map((path) => OperationRequestSchema.parse(loadFixtureJson(path)).operationId),
      operationTypes: OPERATION_REQUEST_PATHS.map((path) => OperationRequestSchema.parse(loadFixtureJson(path)).operationType),
      finalOperationLogLength: operationLogLength
    },
    rightsClean: {
      realAssetBytes: false,
      imageDecode: false,
      externalDependency: false
    }
  };
};

const summarizeEditorSelectionEvidence = (packageDocument: PackageDocumentDto) => {
  const mesh = expectOne(packageDocument.model.meshes.meshes, "mesh");
  const selectedVertexRefs = SELECTED_VERTEX_IDS.map((vertexStableId) => {
    const vertexIndex = mesh.vertexStableIds.indexOf(vertexStableId);

    if (vertexIndex < 0) {
      throw new Error(`Selected vertex ${vertexStableId} is missing from ${mesh.meshId}.`);
    }

    return {
      meshId: mesh.meshId,
      vertexStableId,
      vertexIndex,
      vertexRef: `${mesh.meshId}.${vertexStableId}`,
      selected: true
    };
  });

  return {
    schemaVersion: "wave29-mesh-edit-editor-selection-evidence-summary-v1",
    source: "fixture-editor-semantic-state",
    runtimeRenderingSemanticsClaim: "none",
    activeTool: "meshEdit",
    selectedVertexRefs,
    lockedIds: [],
    editorHiddenIds: [],
    selectionMatchesMaterializedMesh: SELECTED_VERTEX_IDS.every((vertexId) =>
      mesh.vertexStableIds.includes(vertexId)
    ),
    runtimeEvidenceCarriesSelectionState: false
  };
};

const toTargetRefKey = (target: Pick<TargetRefDto, "kind" | "id" | "path">) =>
  `${target.kind}:${target.id}${target.path === undefined ? "" : `:${target.path}`}`;

const loadOperationRequests = (): OperationRequestDto[] =>
  OPERATION_REQUEST_PATHS.map((path) =>
    OperationRequestSchema.parse(loadFixtureJson(path))
  );

const loadBaselinePackageDocument = (): PackageDocumentDto =>
  PackageDocumentSchema.parse(loadFixtureJson("baseline-package.json"));

const loadFixtureJson = (relativePath: string): unknown =>
  JSON.parse(readFileSync(join(fixtureRootDirectory, relativePath), "utf8"));

const expectOne = <TValue>(values: readonly TValue[], label: string): TValue => {
  expect(values).toHaveLength(1);
  const value = values[0];

  if (value === undefined) {
    throw new Error(`Expected one ${label}.`);
  }

  return value;
};

const fixtureRootDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/contracts/wave29-mesh-edit-contract-fixtures"
);
