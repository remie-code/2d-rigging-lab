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

const CREATED_AT = "2026-06-01T00:00:00.000Z";

const OPERATION_REQUEST_PATHS = [
  "request/create-part-commit.request.json",
  "request/update-part-commit.request.json",
  "request/set-drawable-part-commit.request.json",
  "request/set-drawable-texture-commit.request.json"
] as const;

describe("wave28 part, texture, and layer contract fixtures", () => {
  it("parses the operation request chain through operation-core DTOs", () => {
    const requests = loadOperationRequests();

    expect(requests.map((request) => ({
      operationId: request.operationId,
      operationType: request.operationType,
      dryRun: request.dryRun,
      basePackageRevision: request.basePackageRevision
    }))).toEqual([
      {
        operationId: "op_wave28_create_part_face",
        operationType: "createPart",
        dryRun: false,
        basePackageRevision: 0
      },
      {
        operationId: "op_wave28_update_part_face",
        operationType: "updatePart",
        dryRun: false,
        basePackageRevision: 1
      },
      {
        operationId: "op_wave28_set_drawable_part",
        operationType: "setDrawablePart",
        dryRun: false,
        basePackageRevision: 2
      },
      {
        operationId: "op_wave28_set_drawable_texture",
        operationType: "setDrawableTexture",
        dryRun: false,
        basePackageRevision: 3
      }
    ]);
  });

  it("commits the part create/update, drawable reassignment, and texture assignment chain", () => {
    const baselinePackage = loadBaselinePackageDocument();
    const session = createAuthoringSessionFromPackageDocument(baselinePackage);
    const core = createOperationCore({
      now: () => new Date(CREATED_AT)
    });

    const applied = loadOperationRequests().map((request) => {
      const outcome = core.commitOperation(session, request);
      return { request, outcome, packageRevisionAfter: session.packageRevision, authoringRevisionAfter: session.authoringRevision };
    });
    const materializedPackage = toPackageDocument(session, baselinePackage, {
      updatedAt: CREATED_AT
    });

    expect(summarizeOperationChain(applied, core.operationLog.entries.length)).toEqual(
      loadFixtureJson("expected/operation-chain-summary.json")
    );
    expect(summarizePackageMaterialization(materializedPackage)).toEqual(
      loadFixtureJson("expected/package-materialization-summary.json")
    );
    expect(summarizeEditorLayerStateEvidence(materializedPackage)).toEqual(
      loadFixtureJson("expected/editor-layer-state-evidence-summary.json")
    );
  });
});

type PackageDocumentInput = Parameters<typeof createAuthoringSessionFromPackageDocument>[0];

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
  schemaVersion: "wave28-part-texture-layer-operation-chain-summary-v1",
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

const summarizePackageMaterialization = (packageDocument: PackageDocumentInput) => ({
  schemaVersion: "wave28-part-texture-layer-package-materialization-summary-v1",
  packageId: packageDocument.manifest.packageId,
  packageRevision: packageDocument.manifest.packageRevision,
  updatedAt: packageDocument.manifest.updatedAt,
  parts: packageDocument.model.graph.parts.map((part) => ({
    partId: part.partId,
    displayName: part.displayName,
    parentPartId: part.parentPartId ?? null,
    childPartIds: part.childPartIds,
    drawableIds: part.drawableIds
  })),
  drawables: packageDocument.model.drawables.drawables.map((drawable) => ({
    drawableId: drawable.drawableId,
    partId: drawable.partId,
    textureId: drawable.textureId,
    runtimeVisibility: drawable.runtimeVisibility
  })),
  textureAtlasIds: packageDocument.assets.textureAtlas?.textures.map((texture) => texture.textureId) ?? [],
  rightsClean: {
    realAssetBytes: false,
    imageDecode: false,
    externalDependency: false
  }
});

const summarizeEditorLayerStateEvidence = (packageDocument: PackageDocumentInput) => ({
  schemaVersion: "wave28-part-texture-layer-editor-state-evidence-summary-v1",
  source: "model/editor-state.json",
  runtimeRenderingSemanticsClaim: "none",
  selection: packageDocument.model.editorState?.selection ?? [],
  lockedIds: packageDocument.model.editorState?.lockedIds ?? [],
  editorHiddenIds: packageDocument.model.editorState?.editorHiddenIds ?? [],
  activeTool: packageDocument.model.editorState?.activeTool ?? null,
  runtimeVisibleDrawableIds: packageDocument.model.drawables.drawables
    .filter((drawable) => drawable.runtimeVisibility)
    .map((drawable) => drawable.drawableId),
  editorHiddenDoesNotMutateRuntimeVisibility: true
});

const toTargetRefKey = (target: Pick<TargetRefDto, "kind" | "id" | "path">) =>
  `${target.kind}:${target.id}${target.path === undefined ? "" : `:${target.path}`}`;

const loadOperationRequests = (): OperationRequestDto[] =>
  OPERATION_REQUEST_PATHS.map((path) =>
    OperationRequestSchema.parse(loadFixtureJson(path))
  );

const loadBaselinePackageDocument = (): PackageDocumentInput =>
  loadFixtureJson("baseline-package.json") as PackageDocumentInput;

const loadFixtureJson = (relativePath: string): unknown =>
  JSON.parse(readFileSync(join(fixtureRootDirectory, relativePath), "utf8"));

const fixtureRootDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/contracts/wave28-part-texture-layer-contract-fixtures"
);
