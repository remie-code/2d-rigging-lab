import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { TUTORIAL_MINI_MODEL_IDS } from "@private-2d-rigging-lab/authoring-core";
import { describe, expect, it } from "vitest";

import {
  applyTutorialMiniModelRecipe,
  createTutorialMiniModelOperationRequests,
  TUTORIAL_MINI_MODEL_RECIPE_ID
} from "./index.js";
import type {
  OperationRequestDto,
  TutorialMiniModelRecipeResult
} from "./index.js";
import {
  PackageDocumentSchema,
  type PackageDocumentDto
} from "../../package-format/src/index.js";

describe("wave30 tutorial mini model operation contract fixture", () => {
  it("pins the recipe operation sequence and package graph summary", () => {
    const operationRequests = createTutorialMiniModelOperationRequests();
    const recipeResult = applyTutorialMiniModelRecipe();
    const packageDocument = PackageDocumentSchema.parse(recipeResult.materializedPackage);

    expect(summarizeOperationSequence(operationRequests)).toEqual(
      loadFixtureJson("request/tutorial-mini-model-operation-sequence.json")
    );
    expect(summarizeOperationChain(recipeResult)).toEqual(
      loadFixtureJson("expected/operation-chain-summary.json")
    );
    expect(summarizePackageGraph(packageDocument)).toEqual(
      loadFixtureJson("expected/package-graph-summary.json")
    );
  });
});

const summarizeOperationSequence = (requests: readonly OperationRequestDto[]) => ({
  schemaVersion: "wave30-tutorial-mini-model-operation-sequence-v1",
  recipeId: TUTORIAL_MINI_MODEL_RECIPE_ID,
  operationCount: requests.length,
  operationIds: requests.map((request) => request.operationId),
  operationTypes: requests.map((request) => request.operationType),
  basePackageRevisions: requests.map((request) => request.basePackageRevision),
  dryRunValues: uniqueSorted(requests.map((request) => request.dryRun)),
  actors: uniqueSorted(requests.map((request) => request.actor)),
  surfaces: uniqueSorted(requests.map((request) => request.surface)),
  traceIncludes: {
    relatedAC: ["AC-MVP-010"].filter((acId) =>
      requests.every((request) => request.trace.relatedAC.includes(acId))
    ),
    relatedScenarios: ["SC-MVP-002"].filter((scenarioId) =>
      requests.every((request) => request.trace.relatedScenarios.includes(scenarioId))
    )
  },
  noWholeModelOperation: !requests
    .map((request) => String(request.operationType))
    .includes("createWholeModel")
});

const summarizeOperationChain = (recipeResult: TutorialMiniModelRecipeResult) => {
  const changedTargetKinds = uniqueSorted(
    recipeResult.appliedOperations.flatMap(({ outcome }) =>
      outcome.result.modelDiff?.changed.map((change) => change.target.kind) ?? []
    )
  );
  const checkedTargetKinds = uniqueSorted(
    recipeResult.appliedOperations.flatMap(({ outcome }) =>
      outcome.result.precondition.checkedTargetRefs.map((target) => target.kind)
    )
  );

  return {
    schemaVersion: "wave30-tutorial-mini-model-operation-chain-summary-v1",
    recipeId: recipeResult.recipeId,
    operationCount: recipeResult.operationRequests.length,
    finalPackageRevision: recipeResult.session.packageRevision,
    finalAuthoringRevision: recipeResult.session.authoringRevision,
    operationLogLength: recipeResult.operationLogEntries.length,
    operationTypesByCount: countBy(recipeResult.operationRequests.map((request) => request.operationType)),
    changedTargetKinds,
    checkedTargetKinds,
    allCommitted: recipeResult.appliedOperations.every(
      ({ outcome }) => outcome.result.status === "committed"
    ),
    allPreconditionsOk: recipeResult.appliedOperations.every(
      ({ outcome }) => outcome.result.precondition.ok
    ),
    modelDiffOperationIdsMatch: recipeResult.appliedOperations.every(({ request, outcome }) =>
      request.operationId !== undefined &&
      outcome.result.modelDiff?.operationIds.includes(request.operationId) === true
    ),
    operationLogOperationIdsMatchRequests:
      recipeResult.operationLogEntries.map((entry) => entry.operationId ?? "").join("\n") ===
      recipeResult.operationRequests.map((request) => request.operationId).join("\n"),
    noWholeModelOperation: !recipeResult.operationRequests
      .map((request) => String(request.operationType))
      .includes("createWholeModel")
  };
};

const summarizePackageGraph = (packageDocument: PackageDocumentDto) => {
  const bodyDrawable = findDrawable(packageDocument, TUTORIAL_MINI_MODEL_IDS.drawables.body);
  const frontHairMesh = findMesh(packageDocument, TUTORIAL_MINI_MODEL_IDS.meshes.frontHair);
  const frontHairMovedVertexIds = [
    "vtx_tutorial_front_hair_0_1",
    "vtx_tutorial_front_hair_0_2"
  ];
  const maskRelation = expectDefined(packageDocument.model.masks.masks[0]);
  const rigControl = expectDefined(packageDocument.model.rigControls.rigControls[0]);
  const dynamicsGroup = expectDefined(packageDocument.model.dynamics.dynamicsGroups[0]);
  const sourceAsset = expectDefined(packageDocument.assets.sourceManifest.sourceAssets[0]);
  const rightsRecord = expectDefined(packageDocument.assets.rights.records[0]);

  return {
    schemaVersion: "wave30-tutorial-mini-model-package-graph-summary-v1",
    packageId: packageDocument.manifest.packageId,
    packageRevision: packageDocument.manifest.packageRevision,
    updatedAt: packageDocument.manifest.updatedAt,
    canvasSize: packageDocument.model.graph.canvasSize,
    partIds: packageDocument.model.graph.parts.map((part) => part.partId),
    faceDrawableIds: expectDefined(
      packageDocument.model.graph.parts.find(
        (part) => part.partId === TUTORIAL_MINI_MODEL_IDS.parts.face
      )
    ).drawableIds,
    drawableIds: packageDocument.model.drawables.drawables.map((drawable) => drawable.drawableId),
    generatedMeshCount: packageDocument.model.meshes.meshes.filter((mesh) =>
      mesh.vertices.length > 0 &&
      mesh.uvs.length === mesh.vertices.length &&
      mesh.triangles.length > 0
    ).length,
    frontHairMeshEdit: {
      meshId: frontHairMesh.meshId,
      vertexCount: frontHairMesh.vertices.length,
      triangleCount: frontHairMesh.triangles.length,
      movedVertexStableIds: frontHairMovedVertexIds.filter((vertexId) =>
        frontHairMesh.vertexStableIds.includes(vertexId)
      ),
      bounds: frontHairMesh.bounds
    },
    textureMetadata: {
      textureCount: packageDocument.assets.textureAtlas?.textures.length ?? 0,
      bodyTextureId: bodyDrawable.textureId,
      textureBinaryRefsPresent: packageDocument.assets.textureAtlas?.textures.some(
        (texture) => texture.binaryAssetRef !== undefined
      ) ?? false,
      previewAssetReferenceKinds: uniqueSorted(
        packageDocument.assets.textureAtlas?.previewAssets?.map(
          (preview) => preview.reference.referenceKind
        ) ?? []
      )
    },
    maskOpacity: {
      enabledMaskRelationIds: packageDocument.model.masks.masks
        .filter((candidate) => candidate.enabled)
        .map((candidate) => candidate.maskRelationId),
      opacityKeyformIds: packageDocument.model.keyforms.keyformSets
        .filter((keyformSet) =>
          keyformSet.target.kind === "drawable" &&
          keyformSet.target.property.toLowerCase().includes("opacity")
        )
        .map((keyformSet) => keyformSet.keyformSetId)
    },
    rigControlKeyform: {
      rigControlId: rigControl.rigControlId,
      rigControlKind: rigControl.kind,
      angleKeyformSetId: expectDefined(packageDocument.model.keyforms.keyformSets.find(
        (keyformSet) =>
          keyformSet.target.kind === "rigControl" &&
          keyformSet.target.id === rigControl.rigControlId &&
          keyformSet.target.property === "angleDegrees"
      )).keyformSetId
    },
    dynamics: {
      dynamicsGroupId: dynamicsGroup.dynamicsGroupId,
      inputParameterIds: dynamicsGroup.inputs.map((input) => input.parameterId),
      outputParameterId: dynamicsGroup.outputs[0]?.parameterId
    },
    rightsClean: {
      sourceKind: sourceAsset.kind,
      rightsStatus: rightsRecord.rightsStatus,
      redistributionAllowed: rightsRecord.redistributionAllowed,
      realAssetBytes: packageDocument.assets.sourceManifest.sourceAssets.some(
        (asset) => asset.binaryAssetRef !== undefined
      ),
      imageDecode: false,
      externalDependency: false,
      publicSampleDistribution: false
    }
  };
};

const countBy = (values: readonly string[]): Record<string, number> =>
  Object.fromEntries(
    [...values.reduce((counts, value) => {
      counts.set(value, (counts.get(value) ?? 0) + 1);
      return counts;
    }, new Map<string, number>()).entries()].sort(([left], [right]) => left.localeCompare(right))
  );

const findDrawable = (packageDocument: PackageDocumentDto, drawableId: string) =>
  expectDefined(packageDocument.model.drawables.drawables.find(
    (drawable) => drawable.drawableId === drawableId
  ));

const findMesh = (packageDocument: PackageDocumentDto, meshId: string) =>
  expectDefined(packageDocument.model.meshes.meshes.find((mesh) => mesh.meshId === meshId));

const uniqueSorted = <TValue extends string | number | boolean>(values: readonly TValue[]): readonly TValue[] =>
  [...new Set(values)].sort((left, right) => String(left).localeCompare(String(right)));

const loadFixtureJson = (relativePath: string): unknown =>
  JSON.parse(readFileSync(join(fixtureRootDirectory, relativePath), "utf8"));

const expectDefined = <TValue>(value: TValue | undefined): TValue => {
  if (value === undefined) {
    throw new Error("Expected fixture value to be defined.");
  }

  return value;
};

const fixtureRootDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures/contracts/wave30-tutorial-mini-model-contract-fixtures"
);
