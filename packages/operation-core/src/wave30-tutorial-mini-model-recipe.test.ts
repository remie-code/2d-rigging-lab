import {
  createTutorialMiniModelSeed,
  TUTORIAL_MINI_MODEL_IDS
} from "@private-2d-rigging-lab/authoring-core";
import { describe, expect, it } from "vitest";

import {
  applyTutorialMiniModelRecipe,
  createOperationCore,
  createTutorialMiniModelOperationRequests,
  parseOperationLogEntriesFromJsonl,
  serializeOperationLogEntriesToJsonl,
  TUTORIAL_MINI_MODEL_RECIPE_ID
} from "./index.js";
import {
  PackageDocumentSchema,
  serializePackageDocumentToFileSet
} from "../../package-format/src/index.js";

describe("wave30 tutorial mini model recipe foundation", () => {
  it("creates a deterministic committed operation request sequence without a whole-model operation", () => {
    const requests = createTutorialMiniModelOperationRequests();

    expect(requests).toHaveLength(36);
    expect(requests.slice(0, 2).map((request) => ({
      operationId: request.operationId,
      operationType: request.operationType,
      basePackageRevision: request.basePackageRevision,
      dryRun: request.dryRun
    }))).toMatchObject([
      {
        operationId: "op_tutorial_create_part_body",
        operationType: "createPart",
        basePackageRevision: 0,
        dryRun: false
      },
      {
        operationId: "op_tutorial_create_part_head",
        operationType: "createPart",
        basePackageRevision: 1,
        dryRun: false
      }
    ]);
    expect(requests.map((request) => request.basePackageRevision)).toEqual(
      requests.map((_, index) => index)
    );
    expect(requests.map((request) => request.operationType)).toEqual([
      "createPart",
      "createPart",
      "createPart",
      "createPart",
      "createPart",
      "createParameter",
      "createParameter",
      "createParameter",
      "createParameter",
      "createDrawable",
      "createDrawable",
      "createDrawable",
      "createDrawable",
      "createDrawable",
      "createDrawable",
      "createDrawable",
      "createDrawable",
      "setDrawableTexture",
      "generateMesh",
      "generateMesh",
      "generateMesh",
      "generateMesh",
      "generateMesh",
      "generateMesh",
      "generateMesh",
      "generateMesh",
      "moveMeshVertex",
      "setMaskRelation",
      "moveStructureChild",
      "moveStructureChild",
      "moveStructureChild",
      "createRotation2dRigControl",
      "createDynamicsGroup",
      "addKeyform",
      "addKeyform",
      "addKeyform"
    ]);
    expect(requests.map((request) => request.operationType)).not.toContain("createWholeModel");
    expect(requests.every((request) =>
      request.trace.relatedAC.includes("AC-MVP-010") &&
      request.trace.relatedScenarios.includes("SC-MVP-002")
    )).toBe(true);
  });

  it("keeps the existing dry-run lifecycle immutable for recipe requests", () => {
    const seed = createTutorialMiniModelSeed();
    const firstRequest = expectDefined(createTutorialMiniModelOperationRequests()[0]);
    const dryRunRequest = { ...firstRequest, dryRun: true };
    const core = createOperationCore();

    const dryRunResult = core.dryRunOperation(seed.session, dryRunRequest);

    expect(dryRunResult.status).toBe("dry_run");
    expect(seed.session.packageRevision).toBe(0);
    expect(seed.session.authoringRevision).toBe(0);
    expect(seed.session.dirty).toBe(false);
    expect(core.operationLog.entries).toHaveLength(0);

    const commitOutcome = core.commitOperation(seed.session, firstRequest);

    expect(commitOutcome.result.status).toBe("committed");
    expect(seed.session.packageRevision).toBe(1);
    expect(seed.session.authoringRevision).toBe(1);
    expect(core.operationLog.entries).toHaveLength(1);
  });

  it("commits the rights-clean tutorial recipe and materializes auditable package evidence", () => {
    const result = applyTutorialMiniModelRecipe();
    const document = PackageDocumentSchema.parse(result.materializedPackage);
    const operationLogText = serializeOperationLogEntriesToJsonl(result.operationLogEntries);
    const parsedLogEntries = parseOperationLogEntriesFromJsonl(operationLogText);
    const fileSet = serializePackageDocumentToFileSet(document, { operationLogText });

    expect(result.recipeId).toBe(TUTORIAL_MINI_MODEL_RECIPE_ID);
    expect(result.appliedOperations).toHaveLength(result.operationRequests.length);
    expect(result.operationLogEntries).toHaveLength(result.operationRequests.length);
    expect(result.session.packageRevision).toBe(result.operationRequests.length);
    expect(parsedLogEntries).toEqual(result.operationLogEntries);
    expect(fileSet.map((entry) => entry.path)).toEqual(expect.arrayContaining([
      "manifest.json",
      "model/graph.json",
      "model/drawables.json",
      "model/meshes.json",
      "model/keyforms.json",
      "model/rig-controls.json",
      "model/dynamics.json",
      "model/masks.json",
      "assets/textures/texture-atlas.json",
      "operations/log.jsonl"
    ]));
    expect(summarizeOperationAudit(result.appliedOperations)).toEqual({
      schemaVersion: "wave30-tutorial-mini-model-operation-audit-v1",
      operationCount: 36,
      rejectedOperationCount: 0,
      finalOperationLogLength: 36,
      operationIdsMatchModelDiff: true,
      changedTargetKinds: expect.arrayContaining([
        "drawable",
        "dynamicsGroup",
        "keyformSet",
        "maskRelation",
        "mesh",
        "package",
        "part",
        "rigControl",
        "vertex"
      ]),
      checkedTargetKinds: expect.arrayContaining([
        "drawable",
        "dynamicsGroup",
        "keyformSet",
        "maskRelation",
        "mesh",
        "parameter",
        "part",
        "rigControl",
        "texture",
        "vertex"
      ])
    });
    expect(summarizeTutorialPackage(document)).toEqual({
      schemaVersion: "wave30-tutorial-mini-model-package-summary-v1",
      packageId: TUTORIAL_MINI_MODEL_IDS.packageId,
      packageRevision: 36,
      partIds: [
        TUTORIAL_MINI_MODEL_IDS.parts.body,
        TUTORIAL_MINI_MODEL_IDS.parts.head,
        TUTORIAL_MINI_MODEL_IDS.parts.face,
        TUTORIAL_MINI_MODEL_IDS.parts.frontHair,
        TUTORIAL_MINI_MODEL_IDS.parts.arm
      ],
      drawableIds: [
        TUTORIAL_MINI_MODEL_IDS.drawables.body,
        TUTORIAL_MINI_MODEL_IDS.drawables.head,
        TUTORIAL_MINI_MODEL_IDS.drawables.face,
        TUTORIAL_MINI_MODEL_IDS.drawables.mouth,
        TUTORIAL_MINI_MODEL_IDS.drawables.eyeMask,
        TUTORIAL_MINI_MODEL_IDS.drawables.eye,
        TUTORIAL_MINI_MODEL_IDS.drawables.frontHair,
        TUTORIAL_MINI_MODEL_IDS.drawables.arm
      ],
      generatedMeshCount: 8,
      textureIds: expect.arrayContaining([
        TUTORIAL_MINI_MODEL_IDS.textures.bodyDraft,
        TUTORIAL_MINI_MODEL_IDS.textures.body,
        TUTORIAL_MINI_MODEL_IDS.textures.frontHair
      ]),
      bodyTextureId: TUTORIAL_MINI_MODEL_IDS.textures.body,
      maskRelation: {
        maskRelationId: TUTORIAL_MINI_MODEL_IDS.masks.eyeMaskToEye,
        maskDrawableIds: [TUTORIAL_MINI_MODEL_IDS.drawables.eyeMask],
        targetDrawableIds: [TUTORIAL_MINI_MODEL_IDS.drawables.eye],
        enabled: true
      },
      rigControl: {
        rigControlId: TUTORIAL_MINI_MODEL_IDS.rigControls.headRotation,
        kind: "rotation2d",
        childDrawableCount: 6
      },
      keyformSetIds: expect.arrayContaining([
        TUTORIAL_MINI_MODEL_IDS.keyformSets.headRotationAngle,
        TUTORIAL_MINI_MODEL_IDS.keyformSets.mouthOpacity,
        TUTORIAL_MINI_MODEL_IDS.keyformSets.frontHairSway
      ]),
      dynamicsGroup: {
        dynamicsGroupId: TUTORIAL_MINI_MODEL_IDS.dynamicsGroups.hairSway,
        inputParameterIds: [
          TUTORIAL_MINI_MODEL_IDS.parameters.faceYaw,
          TUTORIAL_MINI_MODEL_IDS.parameters.bodyBob
        ],
        outputParameterId: TUTORIAL_MINI_MODEL_IDS.parameters.hairSway
      },
      rightsClean: {
        rightsStatus: "cleared",
        redistributionAllowed: false,
        realAssetBytes: false,
        imageDecode: false,
        externalDependency: false
      }
    });
  });
});

type RecipeResult = ReturnType<typeof applyTutorialMiniModelRecipe>;
type AppliedOperation = RecipeResult["appliedOperations"][number];
type PackageDocument = RecipeResult["materializedPackage"];

const summarizeOperationAudit = (appliedOperations: readonly AppliedOperation[]) => {
  const changedTargetKinds = [
    ...new Set(
      appliedOperations.flatMap(({ outcome }) =>
        outcome.result.modelDiff?.changed.map((change) => change.target.kind) ?? []
      )
    )
  ].sort();
  const checkedTargetKinds = [
    ...new Set(
      appliedOperations.flatMap(({ outcome }) =>
        outcome.result.precondition.checkedTargetRefs.map((target) => target.kind)
      )
    )
  ].sort();

  return {
    schemaVersion: "wave30-tutorial-mini-model-operation-audit-v1",
    operationCount: appliedOperations.length,
    rejectedOperationCount: appliedOperations.filter(
      ({ outcome }) => outcome.result.status !== "committed"
    ).length,
    finalOperationLogLength: appliedOperations.at(-1)?.outcome.operationLogLength ?? 0,
    operationIdsMatchModelDiff: appliedOperations.every(({ outcome }) =>
      outcome.result.modelDiff?.operationIds.includes(outcome.result.operationId) === true
    ),
    changedTargetKinds,
    checkedTargetKinds
  };
};

const summarizeTutorialPackage = (document: PackageDocument) => {
  const bodyDrawable = expectDefined(
    document.model.drawables.drawables.find(
      (drawable) => drawable.drawableId === TUTORIAL_MINI_MODEL_IDS.drawables.body
    )
  );
  const maskRelation = expectDefined(document.model.masks.masks[0]);
  const rigControl = expectDefined(document.model.rigControls.rigControls[0]);
  const dynamicsGroup = expectDefined(document.model.dynamics.dynamicsGroups[0]);
  const rightsRecord = expectDefined(document.assets.rights.records[0]);

  if (rigControl.kind !== "rotation2d") {
    throw new Error(`Expected tutorial rig control to be rotation2d, got ${rigControl.kind}.`);
  }

  return {
    schemaVersion: "wave30-tutorial-mini-model-package-summary-v1",
    packageId: document.manifest.packageId,
    packageRevision: document.manifest.packageRevision,
    partIds: document.model.graph.parts.map((part) => part.partId),
    drawableIds: document.model.drawables.drawables.map((drawable) => drawable.drawableId),
    generatedMeshCount: document.model.meshes.meshes.filter((mesh) =>
      mesh.vertices.length > 0 &&
      mesh.uvs.length === mesh.vertices.length &&
      mesh.triangles.length > 0
    ).length,
    textureIds: document.assets.textureAtlas?.textures.map((texture) => texture.textureId) ?? [],
    bodyTextureId: bodyDrawable.textureId,
    maskRelation: {
      maskRelationId: maskRelation.maskRelationId,
      maskDrawableIds: maskRelation.maskDrawableIds,
      targetDrawableIds: maskRelation.targetDrawableIds,
      enabled: maskRelation.enabled
    },
    rigControl: {
      rigControlId: rigControl.rigControlId,
      kind: rigControl.kind,
      childDrawableCount: rigControl.childDrawableIds.length
    },
    keyformSetIds: document.model.keyforms.keyformSets.map((keyformSet) => keyformSet.keyformSetId),
    dynamicsGroup: {
      dynamicsGroupId: dynamicsGroup.dynamicsGroupId,
      inputParameterIds: dynamicsGroup.inputs.map((input) => input.parameterId),
      outputParameterId: dynamicsGroup.outputs[0]?.parameterId
    },
    rightsClean: {
      rightsStatus: rightsRecord.rightsStatus,
      redistributionAllowed: rightsRecord.redistributionAllowed,
      realAssetBytes: !(
        document.assets.sourceManifest.sourceAssets.every(
          (sourceAsset) => sourceAsset.binaryAssetRef === undefined
        ) && document.assets.textureAtlas?.textures.every(
          (texture) => texture.binaryAssetRef === undefined
        ) === true
      ),
      imageDecode: false,
      externalDependency: false
    }
  };
};

const expectDefined = <TValue>(value: TValue | undefined): TValue => {
  if (value === undefined) {
    throw new Error("Expected value to be defined.");
  }

  return value;
};
