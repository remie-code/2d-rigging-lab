import {
  createInitialAuthoringRevision,
  getKeyformSetById
} from "@private-2d-rigging-lab/authoring-core";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import {
  DrawableIdSchema,
  KeyformSetIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  PartIdSchema,
  ParameterIdSchema,
  ProvenanceIdSchema,
  RigControlIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import type { OperationId } from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { OperationRequestSchema } from "../operation-request.js";
import type { OperationRequestDto } from "../operation-request.js";
import { editKeyformKeyOperationHandler } from "./edit-keyform-key.js";

describe("editKeyformKey operation handler", () => {
  it("dry-runs addCurrent without mutating the original session", () => {
    const session = createFixtureSession();
    const request = createEditRequest({
      dryRun: true,
      action: "addCurrent",
      keyValue: 0,
      statePatchValue: 0.5
    });

    const outcome = editKeyformKeyOperationHandler.dryRun(
      session,
      request,
      getRequestOperationId(request)
    );

    expect(outcome.result.status).toBe("dry_run");
    expect(outcome.result.modelDiff).toBeDefined();
    expect(outcome.candidateSession).not.toBe(session);
    expect(getKeyformSetById(session.graph, expectedDrawableOpacityKeyformSetId())).toBeUndefined();
    expect(session.authoringRevision).toBe(0);
    expect(getKeyformSetById(outcome.candidateSession.graph, expectedDrawableOpacityKeyformSetId())).toMatchObject({
      target: { kind: "drawable", id: "draw_face", property: "opacity" },
      parameterId: "param_face_yaw",
      keys: [{ value: 0, statePatch: 0.5 }]
    });
  });

  it("adds and updates current linear keyform keys in one binding set", () => {
    const session = createFixtureSession();
    const addRequest = createEditRequest({
      dryRun: false,
      action: "addCurrent",
      keyValue: 0,
      statePatchValue: 0.5
    });
    const updateRequest = createEditRequest({
      dryRun: false,
      action: "updateCurrent",
      keyValue: 0,
      statePatchValue: 0.75
    });

    const addOutcome = editKeyformKeyOperationHandler.commit(
      session,
      addRequest,
      getRequestOperationId(addRequest)
    );
    const updateOutcome = editKeyformKeyOperationHandler.commit(
      session,
      updateRequest,
      getRequestOperationId(updateRequest)
    );

    expect(addOutcome.result.status).toBe("committed");
    expect(addOutcome.result.modelDiff?.added).toEqual([
      { kind: "keyformSet", id: expectedDrawableOpacityKeyformSetId() }
    ]);
    expect(updateOutcome.result.status).toBe("committed");
    expect(updateOutcome.result.modelDiff?.added).toEqual([]);
    expect(updateOutcome.result.modelDiff?.changed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          target: { kind: "keyformSet", id: expectedDrawableOpacityKeyformSetId() }
        })
      ])
    );
    expect(getKeyformSetById(session.graph, expectedDrawableOpacityKeyformSetId())).toMatchObject({
      target: { kind: "drawable", id: "draw_face", property: "opacity" },
      parameterId: "param_face_yaw",
      keys: [{ value: 0, statePatch: 0.75 }]
    });
  });

  it("deletes the current key and removes the binding when it becomes empty", () => {
    const session = createFixtureSession();
    const addRequest = createEditRequest({
      dryRun: false,
      action: "addCurrent",
      keyValue: 0,
      statePatchValue: 0.5
    });
    editKeyformKeyOperationHandler.commit(session, addRequest, getRequestOperationId(addRequest));
    const deleteRequest = createEditRequest({
      dryRun: false,
      action: "deleteCurrent",
      keyValue: 0
    });

    const outcome = editKeyformKeyOperationHandler.commit(
      session,
      deleteRequest,
      getRequestOperationId(deleteRequest)
    );

    expect(outcome.result.status).toBe("committed");
    expect(outcome.result.modelDiff?.removed).toEqual([
      { kind: "keyformSet", id: expectedDrawableOpacityKeyformSetId() }
    ]);
    expect(getKeyformSetById(session.graph, expectedDrawableOpacityKeyformSetId())).toBeUndefined();
  });

  it("creates Ends and Ends+Center keys at parameter range positions", () => {
    const session = createFixtureSession();
    const endsRequest = createEditRequest({
      dryRun: false,
      action: "createEnds",
      statePatchValue: 1,
      maxStatePatchValue: 0
    });
    const centerRequest = createEditRequest({
      dryRun: false,
      action: "createEndsCenter",
      statePatchValue: 1,
      defaultStatePatchValue: 0.6,
      maxStatePatchValue: 0
    });

    const endsOutcome = editKeyformKeyOperationHandler.commit(
      session,
      endsRequest,
      getRequestOperationId(endsRequest)
    );

    expect(endsOutcome.result.status).toBe("committed");
    expect(endsOutcome.result.modelDiff?.added).toEqual([
      { kind: "keyformSet", id: expectedDrawableOpacityKeyformSetId() }
    ]);
    expect(getKeyformSetById(session.graph, expectedDrawableOpacityKeyformSetId())?.keys).toEqual([
      { value: -30, statePatch: 1 },
      { value: 30, statePatch: 0 }
    ]);

    const centerOutcome = editKeyformKeyOperationHandler.commit(
      session,
      centerRequest,
      getRequestOperationId(centerRequest)
    );

    expect(centerOutcome.result.status).toBe("committed");
    expect(centerOutcome.result.modelDiff?.added).toEqual([]);
    expect(centerOutcome.result.modelDiff?.changed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          target: { kind: "keyformSet", id: expectedDrawableOpacityKeyformSetId() }
        })
      ])
    );
    expect(getKeyformSetById(session.graph, expectedDrawableOpacityKeyformSetId())?.keys).toEqual([
      { value: -30, statePatch: 1 },
      { value: 0, statePatch: 0.6 },
      { value: 30, statePatch: 0 }
    ]);
  });

  it("rejects Ends+Center when parameter min/default/max positions are not distinct", () => {
    const differentPatchSession = createFixtureSession();
    const identicalPatchSession = createFixtureSession();
    const differentPatchRequest = createEditRequest({
      dryRun: false,
      action: "createEndsCenter",
      parameterId: "param_eye_left_open",
      statePatchValue: 0,
      defaultStatePatchValue: 1,
      maxStatePatchValue: 0.75
    });
    const identicalPatchRequest = createEditRequest({
      dryRun: false,
      action: "createEndsCenter",
      parameterId: "param_eye_left_open",
      statePatchValue: 0,
      defaultStatePatchValue: 1,
      maxStatePatchValue: 1
    });

    expectRejectedWithoutMutation(
      differentPatchSession,
      differentPatchRequest,
      "operation.editKeyformKey.duplicateKey"
    );
    expectRejectedWithoutMutation(
      identicalPatchSession,
      identicalPatchRequest,
      "operation.editKeyformKey.duplicateKey"
    );
  });

  it("supports v0 rigControl targets for angle, translation, warp offsets, and opacity multiplier", () => {
    const session = createFixtureSession();
    const rotationRequest = createEditRequest({
      dryRun: false,
      action: "createEndsCenter",
      targetKind: "rigControl",
      targetId: "rig_head_rotation",
      targetProperty: "angleDegrees",
      statePatchValue: -20,
      defaultStatePatchValue: 0,
      maxStatePatchValue: 20
    });
    const translationRequest = createEditRequest({
      dryRun: false,
      action: "addCurrent",
      targetKind: "rigControl",
      targetId: "rig_head_rotation",
      targetProperty: "translation",
      keyValue: 10,
      statePatchValue: { x: 2, y: -3 }
    });
    const warpRequest = createEditRequest({
      dryRun: false,
      action: "addCurrent",
      targetKind: "rigControl",
      targetId: "rig_head_warp",
      targetProperty: "controlPointOffsets",
      keyValue: 0,
      statePatchValue: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 }
      ]
    });
    const opacityMultiplierRequest = createEditRequest({
      dryRun: false,
      action: "addCurrent",
      targetKind: "rigControl",
      targetId: "rig_head_rotation",
      targetProperty: "opacityMultiplier",
      keyValue: 30,
      statePatchValue: 0.25
    });
    const warpOpacityMultiplierRequest = createEditRequest({
      dryRun: false,
      action: "addCurrent",
      targetKind: "rigControl",
      targetId: "rig_head_warp",
      targetProperty: "opacityMultiplier",
      keyValue: 30,
      statePatchValue: 0.5
    });

    const rotationOutcome = editKeyformKeyOperationHandler.commit(
      session,
      rotationRequest,
      getRequestOperationId(rotationRequest)
    );
    const translationOutcome = editKeyformKeyOperationHandler.commit(
      session,
      translationRequest,
      getRequestOperationId(translationRequest)
    );
    const warpOutcome = editKeyformKeyOperationHandler.commit(
      session,
      warpRequest,
      getRequestOperationId(warpRequest)
    );
    const opacityOutcome = editKeyformKeyOperationHandler.commit(
      session,
      opacityMultiplierRequest,
      getRequestOperationId(opacityMultiplierRequest)
    );
    const warpOpacityOutcome = editKeyformKeyOperationHandler.commit(
      session,
      warpOpacityMultiplierRequest,
      getRequestOperationId(warpOpacityMultiplierRequest)
    );

    expect(rotationOutcome.result.status).toBe("committed");
    expect(translationOutcome.result.status).toBe("committed");
    expect(warpOutcome.result.status).toBe("committed");
    expect(opacityOutcome.result.status).toBe("committed");
    expect(warpOpacityOutcome.result.status).toBe("committed");
    expect(session.graph.keyformSets.map((set) => `${set.target.id}.${set.target.property}`)).toEqual([
      "rig_head_rotation.angleDegrees",
      "rig_head_rotation.translation",
      "rig_head_warp.controlPointOffsets",
      "rig_head_rotation.opacityMultiplier",
      "rig_head_warp.opacityMultiplier"
    ]);
    expect(getKeyformSetById(session.graph, KeyformSetIdSchema.parse("keyset_rigcontrol_rig_head_rotation_translation_face_yaw"))).toMatchObject({
      target: { kind: "rigControl", id: "rig_head_rotation", property: "translation" },
      keys: [{ value: 10, statePatch: { x: 2, y: -3 } }]
    });
  });

  it("rejects warp controlPointOffsets with invalid cardinality without mutation", () => {
    const session = createFixtureSession();

    expectRejectedWithoutMutation(
      session,
      createEditRequest({
        dryRun: false,
        action: "addCurrent",
        targetKind: "rigControl",
        targetId: "rig_head_warp",
        targetProperty: "controlPointOffsets",
        keyValue: 0,
        statePatchValue: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0, y: 1 }
        ]
      }),
      "operation.editKeyformKey.invalidPatchShape"
    );
  });

  it("rejects duplicate key, missing key, missing binding, duplicate binding, missing parameter, and missing target atomically", () => {
    const duplicateKeySession = createFixtureSession();
    const initialAdd = createEditRequest({
      dryRun: false,
      action: "addCurrent",
      keyValue: 0,
      statePatchValue: 0.5
    });
    editKeyformKeyOperationHandler.commit(duplicateKeySession, initialAdd, getRequestOperationId(initialAdd));
    expectRejectedWithoutMutation(
      duplicateKeySession,
      createEditRequest({
        dryRun: false,
        action: "addCurrent",
        keyValue: 0,
        statePatchValue: 0.75
      }),
      "operation.editKeyformKey.duplicateKey"
    );

    const missingUpdateKeySession = createFixtureSession();
    editKeyformKeyOperationHandler.commit(missingUpdateKeySession, initialAdd, getRequestOperationId(initialAdd));
    expectRejectedWithoutMutation(
      missingUpdateKeySession,
      createEditRequest({
        dryRun: false,
        action: "updateCurrent",
        keyValue: 10,
        statePatchValue: 0.75
      }),
      "operation.editKeyformKey.missingKey"
    );

    const missingDeleteKeySession = createFixtureSession();
    editKeyformKeyOperationHandler.commit(missingDeleteKeySession, initialAdd, getRequestOperationId(initialAdd));
    expectRejectedWithoutMutation(
      missingDeleteKeySession,
      createEditRequest({
        dryRun: false,
        action: "deleteCurrent",
        keyValue: 10
      }),
      "operation.editKeyformKey.missingKey"
    );

    expectRejectedWithoutMutation(
      createFixtureSession(),
      createEditRequest({
        dryRun: false,
        action: "updateCurrent",
        keyValue: 0,
        statePatchValue: 0.75
      }),
      "operation.editKeyformKey.missingBinding"
    );
    expectRejectedWithoutMutation(
      createFixtureSession(),
      createEditRequest({
        dryRun: false,
        action: "deleteCurrent",
        keyValue: 0
      }),
      "operation.editKeyformKey.missingBinding"
    );

    const duplicateBindingSession = createFixtureSession();
    duplicateBindingSession.graph.keyformSets.push({
      keyformSetId: KeyformSetIdSchema.parse("keyset_conflicting_drawable_opacity"),
      target: { kind: "drawable", id: "draw_face", property: "opacity" },
      parameterId: ParameterIdSchema.parse("param_face_yaw"),
      evaluator: "linear-1d-v1",
      interpolation: "linear-1d-v1",
      compositionMode: "replace",
      compositionOrder: 0,
      keys: [{ value: 0, statePatch: 0.5 }]
    });
    expectRejectedWithoutMutation(
      duplicateBindingSession,
      createEditRequest({
        dryRun: false,
        action: "addCurrent",
        keyValue: 10,
        statePatchValue: 0.75
      }),
      "operation.editKeyformKey.duplicateBinding"
    );

    expectRejectedWithoutMutation(
      createFixtureSession(),
      createEditRequest({
        dryRun: false,
        action: "addCurrent",
        parameterId: "param_missing",
        keyValue: 0,
        statePatchValue: 0.5
      }),
      "operation.editKeyformKey.missingParameter"
    );
    expectRejectedWithoutMutation(
      createFixtureSession(),
      createEditRequest({
        dryRun: false,
        action: "addCurrent",
        targetId: "draw_missing",
        keyValue: 0,
        statePatchValue: 0.5
      }),
      "operation.editKeyformKey.missingTarget"
    );
  });

  it("rejects incompatible target properties, invalid shapes, and out-of-range positions without mutation", () => {
    const session = createFixtureSession();
    const unsupportedTarget = createEditRequest({
      dryRun: false,
      action: "addCurrent",
      targetKind: "drawable",
      targetProperty: "visibility",
      keyValue: 0,
      statePatchValue: true
    });
    const invalidShape = createEditRequest({
      dryRun: false,
      action: "addCurrent",
      targetKind: "rigControl",
      targetId: "rig_head_rotation",
      targetProperty: "opacityMultiplier",
      keyValue: 0,
      statePatchValue: 1.5
    });
    const invalidTranslationShape = createEditRequest({
      dryRun: false,
      action: "addCurrent",
      targetKind: "rigControl",
      targetId: "rig_head_rotation",
      targetProperty: "translation",
      keyValue: 0,
      statePatchValue: 1
    });
    const outOfRange = createEditRequest({
      dryRun: false,
      action: "addCurrent",
      keyValue: 40,
      statePatchValue: 0.5
    });
    const propertyMismatch = createEditRequest({
      dryRun: false,
      action: "addCurrent",
      keyValue: 0,
      statePatchPropertyPath: "defaultOpacity",
      statePatchValue: 0.5
    });

    const unsupportedOutcome = editKeyformKeyOperationHandler.commit(
      session,
      unsupportedTarget,
      getRequestOperationId(unsupportedTarget)
    );
    const invalidShapeOutcome = editKeyformKeyOperationHandler.commit(
      session,
      invalidShape,
      getRequestOperationId(invalidShape)
    );
    const invalidTranslationShapeOutcome = editKeyformKeyOperationHandler.commit(
      session,
      invalidTranslationShape,
      getRequestOperationId(invalidTranslationShape)
    );
    const outOfRangeOutcome = editKeyformKeyOperationHandler.commit(
      session,
      outOfRange,
      getRequestOperationId(outOfRange)
    );
    const propertyMismatchOutcome = editKeyformKeyOperationHandler.commit(
      session,
      propertyMismatch,
      getRequestOperationId(propertyMismatch)
    );

    expect(unsupportedOutcome.result.status).toBe("rejected");
    expect(unsupportedOutcome.result.diagnostics[0]?.checkId).toBe(
      "operation.editKeyformKey.unsupportedTargetProperty"
    );
    expect(invalidShapeOutcome.result.status).toBe("rejected");
    expect(invalidShapeOutcome.result.diagnostics[0]?.checkId).toBe(
      "operation.editKeyformKey.invalidPatchShape"
    );
    expect(invalidTranslationShapeOutcome.result.status).toBe("rejected");
    expect(invalidTranslationShapeOutcome.result.diagnostics[0]?.checkId).toBe(
      "operation.editKeyformKey.invalidPatchShape"
    );
    expect(outOfRangeOutcome.result.status).toBe("rejected");
    expect(outOfRangeOutcome.result.diagnostics[0]?.checkId).toBe(
      "operation.editKeyformKey.keyOutOfRange"
    );
    expect(propertyMismatchOutcome.result.status).toBe("rejected");
    expect(propertyMismatchOutcome.result.diagnostics[0]?.checkId).toBe(
      "operation.editKeyformKey.statePatchPropertyMismatch"
    );
    expect(session.graph.keyformSets).toEqual([]);
    expect(session.authoringRevision).toBe(0);
  });
});

const expectedDrawableOpacityKeyformSetId = () =>
  KeyformSetIdSchema.parse("keyset_drawable_draw_face_opacity_face_yaw");

const createEditRequest = (options: {
  readonly dryRun: boolean;
  readonly action: "addCurrent" | "updateCurrent" | "deleteCurrent" | "createEnds" | "createEndsCenter";
  readonly targetKind?: string;
  readonly targetId?: string;
  readonly targetProperty?: string;
  readonly parameterId?: string;
  readonly keyValue?: number;
  readonly statePatchValue?: unknown;
  readonly statePatchPropertyPath?: string;
  readonly defaultStatePatchValue?: unknown;
  readonly maxStatePatchValue?: unknown;
}): OperationRequestDto => {
  const targetProperty = options.targetProperty ?? "opacity";
  const statePatchPropertyPath = options.statePatchPropertyPath ?? targetProperty;
  const base = {
    schemaVersion: "operation-request-v1",
    operationId: `op_edit_keyform_${options.action}`,
    actor: "test",
    surface: "testFixture",
    dryRun: options.dryRun,
    basePackageRevision: 0,
    operationType: "editKeyformKey",
    payload: {
      action: options.action,
      target: {
        kind: options.targetKind ?? "drawable",
        id: options.targetId ?? "draw_face"
      },
      targetProperty,
      parameterId: options.parameterId ?? "param_face_yaw",
      interpolation: "linear-1d-v1"
    }
  };

  if (options.action === "deleteCurrent") {
    return OperationRequestSchema.parse({
      ...base,
      payload: {
        ...base.payload,
        keyValue: options.keyValue ?? 0
      }
    });
  }

  if (options.action === "addCurrent" || options.action === "updateCurrent") {
    return OperationRequestSchema.parse({
      ...base,
      payload: {
        ...base.payload,
        keyValue: options.keyValue ?? 0,
        statePatch: {
          propertyPath: statePatchPropertyPath,
          value: options.statePatchValue ?? 1
        }
      }
    });
  }

  if (options.action === "createEnds") {
    return OperationRequestSchema.parse({
      ...base,
      payload: {
        ...base.payload,
        statePatches: {
          min: { propertyPath: statePatchPropertyPath, value: options.statePatchValue ?? 1 },
          max: { propertyPath: statePatchPropertyPath, value: options.maxStatePatchValue ?? 0 }
        }
      }
    });
  }

  return OperationRequestSchema.parse({
    ...base,
    payload: {
      ...base.payload,
      statePatches: {
        min: { propertyPath: statePatchPropertyPath, value: options.statePatchValue ?? 1 },
        default: { propertyPath: statePatchPropertyPath, value: options.defaultStatePatchValue ?? 0.5 },
        max: { propertyPath: statePatchPropertyPath, value: options.maxStatePatchValue ?? 0 }
      }
    }
  });
};

const expectRejectedWithoutMutation = (
  session: AuthoringSession,
  request: OperationRequestDto,
  checkId: string
): void => {
  const keyformSetsBefore = structuredClone(session.graph.keyformSets);
  const stableOrderBefore = structuredClone(session.graph.stableOrder);
  const revisionBefore = session.authoringRevision;

  const outcome = editKeyformKeyOperationHandler.commit(
    session,
    request,
    getRequestOperationId(request)
  );

  expect(outcome.result.status).toBe("rejected");
  expect(outcome.result.diagnostics[0]?.checkId).toBe(checkId);
  expect(session.graph.keyformSets).toEqual(keyformSetsBefore);
  expect(session.graph.stableOrder).toEqual(stableOrderBefore);
  expect(session.authoringRevision).toBe(revisionBefore);
};

const createFixtureSession = (): AuthoringSession => ({
  packageIdentity: {
    packageId: PackageIdSchema.parse("pkg_edit_keyform_operation_test"),
    packageDisplayName: "Edit Keyform Operation Test",
    formatVersion: "open-model-package-v1"
  },
  packageRevision: 0,
  authoringRevision: createInitialAuthoringRevision(),
  dirty: false,
  graph: {
    coordinateSystem: "canvas-y-down-v1",
    canvasSize: { width: 1024, height: 1024 },
    parts: [],
    drawables: [
      {
        drawableId: DrawableIdSchema.parse("draw_face"),
        displayName: "Face",
        partId: PartIdSchema.parse("part_root"),
        sourceAssetId: SourceAssetIdSchema.parse("src_generated"),
        textureId: TextureIdSchema.parse("tex_face"),
        meshId: MeshIdSchema.parse("mesh_face"),
        defaultOpacity: 1,
        runtimeVisibility: true,
        baseDrawOrder: 0,
        sourceProvenanceId: ProvenanceIdSchema.parse("prov_generated")
      }
    ],
    meshes: [],
    parameters: [
      {
        parameterId: ParameterIdSchema.parse("param_face_yaw"),
        displayName: "Face Yaw",
        valueSource: "authoredInput",
        min: -30,
        max: 30,
        default: 0,
        recommendedUiStep: 0.1
      }
    ],
    keyformSets: [],
    rigControls: [
      {
        kind: "rotation2d",
        rigControlId: RigControlIdSchema.parse("rig_head_rotation"),
        displayName: "Head Rotation",
        partId: PartIdSchema.parse("part_root"),
        childDrawableIds: [],
        childRigControlIds: [],
        opacityMultiplier: 1,
        pivot: { x: 0, y: 0 },
        restAngleDegrees: 0,
        restTranslation: { x: 0, y: 0 },
        restScale: { x: 1, y: 1 },
        enabled: true
      },
      {
        kind: "warpLattice2d",
        rigControlId: RigControlIdSchema.parse("rig_head_warp"),
        displayName: "Head Warp",
        partId: PartIdSchema.parse("part_root"),
        childDrawableIds: [],
        childRigControlIds: [],
        opacityMultiplier: 1,
        bindSpace: "rigControlLocalRest",
        domainBounds: { x: 0, y: 0, width: 10, height: 10 },
        latticeColumns: 2,
        latticeRows: 2,
        restControlPoints: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 0, y: 10 },
          { x: 10, y: 10 }
        ],
        interpolationMethod: "bilinear-grid-v1",
        enabled: true
      }
    ],
    dynamicsGroups: [],
    masks: [],
    drawOrder: [],
    rigControlRootIds: [],
    stableOrder: ["param_face_yaw"],
    sourceAssets: [],
    provenanceRecords: [],
    rightsRecords: []
  }
});

const getRequestOperationId = (request: OperationRequestDto): OperationId => {
  if (request.operationId === undefined) {
    throw new Error("Test requests must include an operationId.");
  }

  return request.operationId;
};
