import {
  createTutorialMiniModelSeed,
  TUTORIAL_MINI_MODEL_IDS,
  TUTORIAL_MINI_MODEL_UPDATED_AT,
  toPackageDocument
} from "@private-2d-rigging-lab/authoring-core";
import type {
  AuthoringSession,
  TutorialMiniModelSeed
} from "@private-2d-rigging-lab/authoring-core";

import { createOperationCore } from "./operation-core.js";
import type { OperationCore } from "./operation-core.js";
import type { CommitOperationOutcome } from "./lifecycle/commit.js";
import { OperationRequestSchema } from "./operation-request.js";
import type { OperationRequestDto } from "./operation-request.js";
import type { OperationLogEntryDto } from "./operation-log-entry.js";
import type { OperationType } from "./operation-type.js";

export const TUTORIAL_MINI_MODEL_RECIPE_ID = "tutorial-mini-model-recipe-v1";
export const TUTORIAL_MINI_MODEL_RECIPE_TIMESTAMP = "2026-06-02T00:00:00.000Z";

export interface TutorialMiniModelAppliedOperation {
  readonly request: OperationRequestDto;
  readonly outcome: CommitOperationOutcome;
  readonly packageRevisionAfter: AuthoringSession["packageRevision"];
  readonly authoringRevisionAfter: AuthoringSession["authoringRevision"];
}

export interface TutorialMiniModelRecipeResult {
  readonly recipeId: typeof TUTORIAL_MINI_MODEL_RECIPE_ID;
  readonly seed: TutorialMiniModelSeed;
  readonly session: AuthoringSession;
  readonly operationRequests: readonly OperationRequestDto[];
  readonly appliedOperations: readonly TutorialMiniModelAppliedOperation[];
  readonly operationLogEntries: readonly OperationLogEntryDto[];
  readonly materializedPackage: ReturnType<typeof toPackageDocument>;
}

export interface ApplyTutorialMiniModelRecipeOptions {
  readonly seed?: TutorialMiniModelSeed;
  readonly operationCore?: OperationCore;
  readonly updatedAt?: string;
}

export const createTutorialMiniModelOperationRequests = (): readonly OperationRequestDto[] => {
  const requests: OperationRequestDto[] = [];
  let basePackageRevision = 0;
  const addRequest = (
    operationType: OperationType,
    operationId: string,
    payload: unknown,
    trace = defaultTutorialTrace
  ): void => {
    requests.push(
      OperationRequestSchema.parse({
        schemaVersion: "operation-request-v1",
        operationId,
        actor: "test",
        surface: "testFixture",
        dryRun: false,
        basePackageRevision,
        operationType,
        payload,
        trace
      })
    );
    basePackageRevision += 1;
  };

  addPartRequests(addRequest);
  addParameterRequests(addRequest);
  addDrawableRequests(addRequest);
  addTextureAssignmentRequests(addRequest);
  addMeshRequests(addRequest);
  addCompositionRequests(addRequest);
  addRigRequests(addRequest);
  addDynamicsRequests(addRequest);
  addKeyformRequests(addRequest);

  return requests;
};

export const applyTutorialMiniModelRecipe = (
  options: ApplyTutorialMiniModelRecipeOptions = {}
): TutorialMiniModelRecipeResult => {
  const seed = options.seed ?? createTutorialMiniModelSeed();
  const core =
    options.operationCore ??
    createOperationCore({
      now: () => new Date(TUTORIAL_MINI_MODEL_RECIPE_TIMESTAMP)
    });
  const operationRequests = createTutorialMiniModelOperationRequests();
  const appliedOperations = operationRequests.map((request) => {
    const outcome = core.commitOperation(seed.session, request);

    if (outcome.result.status !== "committed") {
      throw new Error(
        `Tutorial mini model recipe operation ${request.operationId} was not committed: ${outcome.result.status}.`
      );
    }

    return {
      request,
      outcome,
      packageRevisionAfter: seed.session.packageRevision,
      authoringRevisionAfter: seed.session.authoringRevision
    };
  });

  return {
    recipeId: TUTORIAL_MINI_MODEL_RECIPE_ID,
    seed,
    session: seed.session,
    operationRequests,
    appliedOperations,
    operationLogEntries: core.operationLog.entries,
    materializedPackage: toPackageDocument(seed.session, seed.packageDocument, {
      updatedAt: options.updatedAt ?? TUTORIAL_MINI_MODEL_UPDATED_AT
    })
  };
};

type AddTutorialRequest = (
  operationType: OperationType,
  operationId: string,
  payload: unknown,
  trace?: OperationRequestDto["trace"]
) => void;

const addPartRequests = (addRequest: AddTutorialRequest): void => {
  addRequest("createPart", "op_tutorial_create_part_body", {
    partId: TUTORIAL_MINI_MODEL_IDS.parts.body,
    displayName: "Tutorial Body",
    lockedTargetIds: []
  });
  addRequest("createPart", "op_tutorial_create_part_head", {
    partId: TUTORIAL_MINI_MODEL_IDS.parts.head,
    displayName: "Tutorial Head",
    parentPartId: TUTORIAL_MINI_MODEL_IDS.parts.body,
    lockedTargetIds: []
  });
  addRequest("createPart", "op_tutorial_create_part_face", {
    partId: TUTORIAL_MINI_MODEL_IDS.parts.face,
    displayName: "Tutorial Face",
    parentPartId: TUTORIAL_MINI_MODEL_IDS.parts.head,
    lockedTargetIds: []
  });
  addRequest("createPart", "op_tutorial_create_part_front_hair", {
    partId: TUTORIAL_MINI_MODEL_IDS.parts.frontHair,
    displayName: "Tutorial Front Hair",
    parentPartId: TUTORIAL_MINI_MODEL_IDS.parts.head,
    lockedTargetIds: []
  });
  addRequest("createPart", "op_tutorial_create_part_arm", {
    partId: TUTORIAL_MINI_MODEL_IDS.parts.arm,
    displayName: "Tutorial Arm",
    parentPartId: TUTORIAL_MINI_MODEL_IDS.parts.body,
    lockedTargetIds: []
  });
};

const addParameterRequests = (addRequest: AddTutorialRequest): void => {
  addRequest("createParameter", "op_tutorial_create_parameter_face_yaw", {
    parameterId: TUTORIAL_MINI_MODEL_IDS.parameters.faceYaw,
    displayName: "Face Yaw",
    semanticRole: "face",
    projectPresetAlias: "project.faceYaw",
    valueSource: "authoredInput",
    min: -1,
    max: 1,
    default: 0,
    recommendedUiStep: 0.01
  });
  addRequest("createParameter", "op_tutorial_create_parameter_body_bob", {
    parameterId: TUTORIAL_MINI_MODEL_IDS.parameters.bodyBob,
    displayName: "Body Bob",
    semanticRole: "body",
    projectPresetAlias: "project.bodyBob",
    valueSource: "authoredInput",
    min: -1,
    max: 1,
    default: 0,
    recommendedUiStep: 0.01
  });
  addRequest("createParameter", "op_tutorial_create_parameter_mouth_open", {
    parameterId: TUTORIAL_MINI_MODEL_IDS.parameters.mouthOpen,
    displayName: "Mouth Open",
    semanticRole: "mouth",
    projectPresetAlias: "project.mouthOpen",
    valueSource: "authoredInput",
    min: 0,
    max: 1,
    default: 0,
    recommendedUiStep: 0.01
  });
  addRequest("createParameter", "op_tutorial_create_parameter_hair_sway", {
    parameterId: TUTORIAL_MINI_MODEL_IDS.parameters.hairSway,
    displayName: "Hair Sway",
    semanticRole: "dynamics",
    projectPresetAlias: "project.hairSway",
    valueSource: "computedDynamics",
    min: -1,
    max: 1,
    default: 0,
    recommendedUiStep: 0.01
  });
};

const addDrawableRequests = (addRequest: AddTutorialRequest): void => {
  for (const drawable of tutorialDrawableSpecs) {
    addRequest("createDrawable", `op_tutorial_create_drawable_${drawable.token}`, {
      sourceAssetId: TUTORIAL_MINI_MODEL_IDS.sourceAssetId,
      sourceLayerId: drawable.sourceLayerId,
      textureId: drawable.initialTextureId,
      partId: drawable.partId,
      displayName: drawable.displayName
    });
  }
};

const addTextureAssignmentRequests = (addRequest: AddTutorialRequest): void => {
  addRequest("setDrawableTexture", "op_tutorial_set_drawable_texture_body_final", {
    drawableId: TUTORIAL_MINI_MODEL_IDS.drawables.body,
    textureId: TUTORIAL_MINI_MODEL_IDS.textures.body,
    lockedTargetIds: []
  });
};

const addMeshRequests = (addRequest: AddTutorialRequest): void => {
  for (const drawable of tutorialDrawableSpecs) {
    addRequest("generateMesh", `op_tutorial_generate_mesh_${drawable.token}`, {
      drawableId: drawable.drawableId,
      method: "auto-grid-v1",
      densityHint: drawable.meshDensity
    });
  }

  addRequest("moveMeshVertex", "op_tutorial_move_front_hair_mesh_vertices", {
    meshId: TUTORIAL_MINI_MODEL_IDS.meshes.frontHair,
    vertexDeltas: [
      {
        vertexId: "vtx_tutorial_front_hair_0_1",
        delta: { x: -5, y: -4 }
      },
      {
        vertexId: "vtx_tutorial_front_hair_0_2",
        delta: { x: 4, y: -2 }
      }
    ],
    lockedTargetIds: [],
    intent: "Create semantic canvas mesh edit evidence for the synthetic tutorial front hair."
  });
};

const addCompositionRequests = (addRequest: AddTutorialRequest): void => {
  addRequest("setMaskRelation", "op_tutorial_set_eye_mask_relation", {
    maskRelationId: TUTORIAL_MINI_MODEL_IDS.masks.eyeMaskToEye,
    maskDrawableIds: [TUTORIAL_MINI_MODEL_IDS.drawables.eyeMask],
    targetDrawableIds: [TUTORIAL_MINI_MODEL_IDS.drawables.eye],
    enabled: true
  });
  addRequest("moveStructureChild", "op_tutorial_move_body_drawable_before_head", {
    moved: {
      kind: "drawable",
      drawableId: TUTORIAL_MINI_MODEL_IDS.drawables.body
    },
    drop: {
      placement: "before",
      target: {
        kind: "part",
        partId: TUTORIAL_MINI_MODEL_IDS.parts.head
      }
    },
    lockedTargetIds: []
  });
  addRequest("moveStructureChild", "op_tutorial_move_arm_before_head", {
    moved: {
      kind: "part",
      partId: TUTORIAL_MINI_MODEL_IDS.parts.arm
    },
    drop: {
      placement: "before",
      target: {
        kind: "part",
        partId: TUTORIAL_MINI_MODEL_IDS.parts.head
      }
    },
    lockedTargetIds: []
  });
  addRequest("moveStructureChild", "op_tutorial_move_head_drawable_before_face", {
    moved: {
      kind: "drawable",
      drawableId: TUTORIAL_MINI_MODEL_IDS.drawables.head
    },
    drop: {
      placement: "before",
      target: {
        kind: "part",
        partId: TUTORIAL_MINI_MODEL_IDS.parts.face
      }
    },
    lockedTargetIds: []
  });
};

const addRigRequests = (addRequest: AddTutorialRequest): void => {
  addRequest("createRotation2dRigControl", "op_tutorial_create_head_rotation_rig", {
    partId: TUTORIAL_MINI_MODEL_IDS.parts.head,
    displayName: "Tutorial Head Rotation",
    childDrawableIds: [
      TUTORIAL_MINI_MODEL_IDS.drawables.head,
      TUTORIAL_MINI_MODEL_IDS.drawables.face,
      TUTORIAL_MINI_MODEL_IDS.drawables.mouth,
      TUTORIAL_MINI_MODEL_IDS.drawables.eyeMask,
      TUTORIAL_MINI_MODEL_IDS.drawables.eye,
      TUTORIAL_MINI_MODEL_IDS.drawables.frontHair
    ],
    childRigControlIds: [],
    pivot: { x: 160, y: 154 },
    restAngleDegrees: 0
  });
};

const addDynamicsRequests = (addRequest: AddTutorialRequest): void => {
  addRequest("createDynamicsGroup", "op_tutorial_create_hair_sway_dynamics", {
    dynamicsGroupId: TUTORIAL_MINI_MODEL_IDS.dynamicsGroups.hairSway,
    displayName: "Tutorial Hair Sway",
    enabled: true,
    solverKind: "scalarDampedFollowV1",
    resetPolicy: "reset-on-load",
    drivers: [
      {
        driverId: "driver_tutorial_hair_sway_face_yaw",
        sourceParameterId: TUTORIAL_MINI_MODEL_IDS.parameters.faceYaw,
        inputScale: 0.6,
        inputOffset: 0,
        invert: false
      },
      {
        driverId: "driver_tutorial_hair_sway_body_bob",
        sourceParameterId: TUTORIAL_MINI_MODEL_IDS.parameters.bodyBob,
        inputScale: 0.4,
        inputOffset: 0,
        invert: false
      }
    ],
    output: {
      outputId: "output_tutorial_hair_sway",
      targetParameterId: TUTORIAL_MINI_MODEL_IDS.parameters.hairSway,
      outputScale: 1,
      outputOffset: 0,
      min: -1,
      max: 1,
      clampPolicy: "clamp-to-output-range"
    },
    settings: {
      stiffness: 0.32,
      damping: 0.68,
      maxAmplitude: 1
    }
  });
};

const addKeyformRequests = (addRequest: AddTutorialRequest): void => {
  addRequest("addKeyform", "op_tutorial_add_head_rotation_keyform", {
    target: { kind: "rigControl", id: TUTORIAL_MINI_MODEL_IDS.rigControls.headRotation },
    targetProperty: "angleDegrees",
    parameterId: TUTORIAL_MINI_MODEL_IDS.parameters.faceYaw,
    keyValue: 1,
    interpolation: "linear-1d-v1",
    statePatch: {
      propertyPath: "angleDegrees",
      value: 12
    }
  });
  addRequest("addKeyform", "op_tutorial_add_mouth_opacity_keyform", {
    target: { kind: "drawable", id: TUTORIAL_MINI_MODEL_IDS.drawables.mouth },
    targetProperty: "opacity",
    parameterId: TUTORIAL_MINI_MODEL_IDS.parameters.mouthOpen,
    keyValue: 1,
    interpolation: "linear-1d-v1",
    statePatch: {
      propertyPath: "opacity",
      value: 0.36
    }
  });
  addRequest("addKeyform", "op_tutorial_add_front_hair_sway_keyform", {
    target: { kind: "mesh", id: TUTORIAL_MINI_MODEL_IDS.meshes.frontHair },
    targetProperty: "vertices",
    parameterId: TUTORIAL_MINI_MODEL_IDS.parameters.hairSway,
    keyValue: 1,
    interpolation: "linear-1d-v1",
    statePatch: {
      propertyPath: "vertices",
      value: [
        { x: 82, y: 50 },
        { x: 155, y: 48 },
        { x: 238, y: 56 },
        { x: 84, y: 101 },
        { x: 160, y: 96 },
        { x: 238, y: 104 },
        { x: 82, y: 148 },
        { x: 160, y: 148 },
        { x: 238, y: 148 }
      ]
    }
  });
};

const tutorialDrawableSpecs = [
  {
    token: "body",
    drawableId: TUTORIAL_MINI_MODEL_IDS.drawables.body,
    displayName: "Tutorial Body",
    sourceLayerId: TUTORIAL_MINI_MODEL_IDS.layers.body,
    initialTextureId: TUTORIAL_MINI_MODEL_IDS.textures.bodyDraft,
    partId: TUTORIAL_MINI_MODEL_IDS.parts.body,
    meshDensity: "medium"
  },
  {
    token: "head",
    drawableId: TUTORIAL_MINI_MODEL_IDS.drawables.head,
    displayName: "Tutorial Head",
    sourceLayerId: TUTORIAL_MINI_MODEL_IDS.layers.head,
    initialTextureId: TUTORIAL_MINI_MODEL_IDS.textures.head,
    partId: TUTORIAL_MINI_MODEL_IDS.parts.head,
    meshDensity: "medium"
  },
  {
    token: "face",
    drawableId: TUTORIAL_MINI_MODEL_IDS.drawables.face,
    displayName: "Tutorial Face",
    sourceLayerId: TUTORIAL_MINI_MODEL_IDS.layers.face,
    initialTextureId: TUTORIAL_MINI_MODEL_IDS.textures.face,
    partId: TUTORIAL_MINI_MODEL_IDS.parts.face,
    meshDensity: "low"
  },
  {
    token: "mouth",
    drawableId: TUTORIAL_MINI_MODEL_IDS.drawables.mouth,
    displayName: "Tutorial Mouth",
    sourceLayerId: TUTORIAL_MINI_MODEL_IDS.layers.mouth,
    initialTextureId: TUTORIAL_MINI_MODEL_IDS.textures.mouth,
    partId: TUTORIAL_MINI_MODEL_IDS.parts.face,
    meshDensity: "low"
  },
  {
    token: "eye_mask",
    drawableId: TUTORIAL_MINI_MODEL_IDS.drawables.eyeMask,
    displayName: "Tutorial Eye Mask",
    sourceLayerId: TUTORIAL_MINI_MODEL_IDS.layers.eyeMask,
    initialTextureId: TUTORIAL_MINI_MODEL_IDS.textures.eyeMask,
    partId: TUTORIAL_MINI_MODEL_IDS.parts.face,
    meshDensity: "low"
  },
  {
    token: "eye",
    drawableId: TUTORIAL_MINI_MODEL_IDS.drawables.eye,
    displayName: "Tutorial Eye",
    sourceLayerId: TUTORIAL_MINI_MODEL_IDS.layers.eye,
    initialTextureId: TUTORIAL_MINI_MODEL_IDS.textures.eye,
    partId: TUTORIAL_MINI_MODEL_IDS.parts.face,
    meshDensity: "low"
  },
  {
    token: "front_hair",
    drawableId: TUTORIAL_MINI_MODEL_IDS.drawables.frontHair,
    displayName: "Tutorial Front Hair",
    sourceLayerId: TUTORIAL_MINI_MODEL_IDS.layers.frontHair,
    initialTextureId: TUTORIAL_MINI_MODEL_IDS.textures.frontHair,
    partId: TUTORIAL_MINI_MODEL_IDS.parts.frontHair,
    meshDensity: "medium"
  },
  {
    token: "arm",
    drawableId: TUTORIAL_MINI_MODEL_IDS.drawables.arm,
    displayName: "Tutorial Arm",
    sourceLayerId: TUTORIAL_MINI_MODEL_IDS.layers.arm,
    initialTextureId: TUTORIAL_MINI_MODEL_IDS.textures.arm,
    partId: TUTORIAL_MINI_MODEL_IDS.parts.arm,
    meshDensity: "low"
  }
] as const;

const defaultTutorialTrace = {
  relatedAC: [
    "AC-MVP-002",
    "AC-MVP-004",
    "AC-MVP-005",
    "AC-MVP-007",
    "AC-MVP-008",
    "AC-MVP-009",
    "AC-MVP-010",
    "AC-MVP-011"
  ],
  relatedScenarios: [
    "SC-MVP-001",
    "SC-MVP-002",
    "SC-MVP-003",
    "SC-DRAW-001",
    "SC-MESH-001",
    "SC-DEF-002",
    "SC-PARAM-002",
    "SC-DYN-001"
  ]
};
