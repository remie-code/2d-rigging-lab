import { createInitialAuthoringRevision, type AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import {
  DrawableIdSchema,
  KeyformSetIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  ParameterIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  RigControlIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import {
  createDrawableOpacityBinding,
  createEditKeyformPayload,
  createEvaluatedParameterKeyformState,
  createParameterBarProjection,
  createParameterBindingProjection,
  createRigControlParameterBindings,
  createTargetParameterKeyMarkers,
  createUniformControlPointOffsets
} from "./parameter-keyform-state";

const PART_ROOT = PartIdSchema.parse("part_root");
const PART_FACE = PartIdSchema.parse("part_face");
const DRAW_FACE = DrawableIdSchema.parse("draw_face");
const MESH_FACE = MeshIdSchema.parse("mesh_face");
const TEX_FACE = TextureIdSchema.parse("tex_face");
const SOURCE_ASSET = SourceAssetIdSchema.parse("src_fixture");
const PROVENANCE = ProvenanceIdSchema.parse("prov_fixture");
const FACE_ANGLE_X = ParameterIdSchema.parse("param_face_angle_x");
const EYE_LEFT_OPEN = ParameterIdSchema.parse("param_eye_left_open");
const RIG_FACE_WARP = RigControlIdSchema.parse("rig_face_warp");
const RIG_FACE_ROTATION = RigControlIdSchema.parse("rig_face_rotation");

describe("parameter keyform editor state", () => {
  it("locks target editing between keys and evaluates drawable opacity for preview", () => {
    const session = createFixtureSession();
    session.graph.keyformSets.push({
      keyformSetId: KeyformSetIdSchema.parse("keyset_drawable_face_opacity"),
      target: {
        kind: "drawable",
        id: DRAW_FACE,
        property: "opacity"
      },
      parameterId: FACE_ANGLE_X,
      evaluator: "linear-1d-v1",
      interpolation: "linear-1d-v1",
      compositionMode: "replace",
      compositionOrder: 0,
      keys: [
        { value: -30, statePatch: 1 },
        { value: 30, statePatch: 0 }
      ]
    });

    const binding = createDrawableOpacityBinding(session, DRAW_FACE);
    expect(binding).toBeDefined();
    if (binding === undefined) {
      throw new Error("Expected drawable opacity binding.");
    }

    const projection = createParameterBindingProjection(session, binding, FACE_ANGLE_X, {
      [FACE_ANGLE_X]: 0
    });
    expect(projection.source).toBe("interpolated");
    expect(projection.displayValue).toBe(0.5);
    expect(projection.canEditValue).toBe(false);
    expect(projection.canAddCurrent).toBe(true);

    const evaluated = createEvaluatedParameterKeyformState(session, {
      [FACE_ANGLE_X]: 30
    });
    expect(evaluated.drawableOpacityById.get(DRAW_FACE)).toBe(0);
  });

  it("disables Ends + Center for preset parameters with duplicate default endpoint", () => {
    const projection = createParameterBarProjection(createFixtureSession(), EYE_LEFT_OPEN, {});

    expect(projection.activeParameter?.displayName).toBe("Eye Left Open");
    expect(projection.canCreateEnds).toBe(true);
    expect(projection.canCreateEndsCenter).toBe(false);
  });

  it("projects Rotation rig-control angle and opacity keyforms into payloads and preview state", () => {
    const session = createRigFixtureSession();
    session.graph.keyformSets.push(
      createRigNumberKeyformSet("keyset_rotation_angle", RIG_FACE_ROTATION, "angleDegrees", [
        [-30, -45],
        [30, 45]
      ]),
      createRigNumberKeyformSet(
        "keyset_rotation_opacity",
        RIG_FACE_ROTATION,
        "opacityMultiplier",
        [
          [-30, 0.25],
          [30, 1]
        ]
      )
    );

    const bindings = createRigControlParameterBindings(session, RIG_FACE_ROTATION);
    expect(bindings.map((binding) => binding.targetProperty)).toEqual([
      "angleDegrees",
      "opacityMultiplier"
    ]);

    const angleBinding = bindings.find((binding) => binding.targetProperty === "angleDegrees");
    expect(angleBinding).toMatchObject({
      label: "Rotation angle",
      target: {
        kind: "rigControl",
        id: RIG_FACE_ROTATION
      },
      valueKind: "number",
      compositionMode: "replace"
    });
    if (angleBinding === undefined) {
      throw new Error("Expected Rotation angle binding.");
    }

    const interpolatedProjection = createParameterBindingProjection(
      session,
      angleBinding,
      FACE_ANGLE_X,
      { [FACE_ANGLE_X]: 0 }
    );
    expect(interpolatedProjection.source).toBe("interpolated");
    expect(interpolatedProjection.displayValue).toBe(0);
    expect(interpolatedProjection.canEditValue).toBe(false);
    expect(interpolatedProjection.canAddCurrent).toBe(true);

    const exactProjection = createParameterBindingProjection(
      session,
      angleBinding,
      FACE_ANGLE_X,
      { [FACE_ANGLE_X]: -30 }
    );
    expect(exactProjection.source).toBe("keyform");
    expect(exactProjection.displayValue).toBe(-45);
    expect(exactProjection.canEditValue).toBe(true);
    expect(exactProjection.canUpdateCurrent).toBe(true);
    expect(exactProjection.canDeleteCurrent).toBe(true);
    expect(exactProjection.canAddCurrent).toBe(false);
    if (exactProjection.parameter === null) {
      throw new Error("Expected active parameter.");
    }

    const payload = createEditKeyformPayload({
      action: "updateCurrent",
      binding: angleBinding,
      currentParameterValue: exactProjection.currentParameterValue,
      parameter: exactProjection.parameter,
      value: 15
    });
    expect(payload).toMatchObject({
      action: "updateCurrent",
      target: {
        kind: "rigControl",
        id: RIG_FACE_ROTATION
      },
      targetProperty: "angleDegrees",
      parameterId: FACE_ANGLE_X,
      keyValue: -30,
      statePatch: {
        propertyPath: "angleDegrees",
        value: 15
      }
    });

    const evaluated = createEvaluatedParameterKeyformState(session, { [FACE_ANGLE_X]: 0 });
    expect(evaluated.rigAngleDegreesById.get(RIG_FACE_ROTATION)).toBe(0);
    expect(evaluated.rigOpacityMultiplierById.get(RIG_FACE_ROTATION)).toBeCloseTo(0.625);
  });

  it("projects markers only for the selected target and active parameter", () => {
    const session = createRigFixtureSession();
    session.graph.keyformSets.push(
      createRigVectorKeyformSet("keyset_warp_offsets", RIG_FACE_WARP, "controlPointOffsets", [
        {
          value: -30,
          statePatch: createUniformControlPointOffsets(4, 0, 0)
        },
        {
          value: 30,
          statePatch: createUniformControlPointOffsets(4, 8, 12)
        }
      ]),
      createRigNumberKeyformSet("keyset_warp_opacity", RIG_FACE_WARP, "opacityMultiplier", [
        [0, 0.75],
        [30, 1]
      ]),
      createRigNumberKeyformSet("keyset_rotation_angle", RIG_FACE_ROTATION, "angleDegrees", [
        [15, 20]
      ]),
      createDrawableNumberKeyformSet("keyset_drawable_opacity", [
        [-10, 0.5]
      ]),
      {
        keyformSetId: KeyformSetIdSchema.parse("keyset_warp_other_parameter"),
        target: {
          kind: "rigControl" as const,
          id: RIG_FACE_WARP,
          property: "opacityMultiplier" as const
        },
        parameterId: EYE_LEFT_OPEN,
        evaluator: "linear-1d-v1" as const,
        interpolation: "linear-1d-v1" as const,
        compositionMode: "replace" as const,
        compositionOrder: 0,
        keys: [{ value: 1, statePatch: 1 }]
      }
    );

    const markers = createTargetParameterKeyMarkers(
      session,
      createRigControlParameterBindings(session, RIG_FACE_WARP),
      FACE_ANGLE_X,
      0
    );

    expect(markers).toEqual([
      { value: -30, selected: false },
      { value: 0, selected: true },
      { value: 30, selected: false }
    ]);
  });

  it("projects Warp rig-control offsets and opacity keyforms into payloads and preview state", () => {
    const session = createRigFixtureSession();
    const minOffsets = createUniformControlPointOffsets(4, 0, 0);
    const maxOffsets = createUniformControlPointOffsets(4, 10, 20);
    session.graph.keyformSets.push(
      createRigVectorKeyformSet("keyset_warp_offsets", RIG_FACE_WARP, "controlPointOffsets", [
        { value: -30, statePatch: minOffsets },
        { value: 30, statePatch: maxOffsets }
      ]),
      createRigNumberKeyformSet("keyset_warp_opacity", RIG_FACE_WARP, "opacityMultiplier", [
        [-30, 0.5],
        [30, 1]
      ])
    );

    const bindings = createRigControlParameterBindings(session, RIG_FACE_WARP);
    expect(bindings.map((binding) => binding.targetProperty)).toEqual([
      "controlPointOffsets",
      "opacityMultiplier"
    ]);

    const offsetsBinding = bindings.find(
      (binding) => binding.targetProperty === "controlPointOffsets"
    );
    expect(offsetsBinding).toMatchObject({
      label: "Warp lattice offsets",
      target: {
        kind: "rigControl",
        id: RIG_FACE_WARP
      },
      valueKind: "controlPointOffsets",
      compositionMode: "replace"
    });
    if (offsetsBinding === undefined) {
      throw new Error("Expected Warp lattice offset binding.");
    }

    const interpolatedProjection = createParameterBindingProjection(
      session,
      offsetsBinding,
      FACE_ANGLE_X,
      { [FACE_ANGLE_X]: 0 }
    );
    expect(interpolatedProjection.source).toBe("interpolated");
    expect(interpolatedProjection.canEditValue).toBe(false);
    expect(interpolatedProjection.canAddCurrent).toBe(true);
    const interpolatedOffsets = interpolatedProjection.displayValue;
    if (!Array.isArray(interpolatedOffsets)) {
      throw new Error("Expected interpolated offset array.");
    }
    expect(interpolatedOffsets).toHaveLength(4);
    expect(interpolatedOffsets[0]).toEqual({ x: 5, y: 10 });

    const exactProjection = createParameterBindingProjection(
      session,
      offsetsBinding,
      FACE_ANGLE_X,
      { [FACE_ANGLE_X]: 30 }
    );
    expect(exactProjection.source).toBe("keyform");
    expect(exactProjection.canEditValue).toBe(true);
    if (exactProjection.parameter === null) {
      throw new Error("Expected active parameter.");
    }

    const payload = createEditKeyformPayload({
      action: "updateCurrent",
      binding: offsetsBinding,
      currentParameterValue: exactProjection.currentParameterValue,
      parameter: exactProjection.parameter,
      value: createUniformControlPointOffsets(4, 3, 4)
    });
    expect(payload.action).toBe("updateCurrent");
    if (payload.action !== "updateCurrent") {
      throw new Error("Expected updateCurrent payload.");
    }
    expect(payload).toMatchObject({
      target: {
        kind: "rigControl",
        id: RIG_FACE_WARP
      },
      targetProperty: "controlPointOffsets",
      parameterId: FACE_ANGLE_X,
      keyValue: 30,
      statePatch: {
        propertyPath: "controlPointOffsets"
      }
    });
    expect(Array.isArray(payload.statePatch.value)).toBe(true);
    if (!Array.isArray(payload.statePatch.value)) {
      throw new Error("Expected control point offset payload value.");
    }
    expect(payload.statePatch.value).toHaveLength(4);
    expect(payload.statePatch.value[0]).toEqual({ x: 3, y: 4 });

    const evaluated = createEvaluatedParameterKeyformState(session, { [FACE_ANGLE_X]: 0 });
    expect(evaluated.rigControlPointOffsetsById.get(RIG_FACE_WARP)?.[0]).toEqual({
      x: 5,
      y: 10
    });
    expect(evaluated.rigOpacityMultiplierById.get(RIG_FACE_WARP)).toBeCloseTo(0.75);
  });
});

function createRigFixtureSession(): AuthoringSession {
  const session = createFixtureSession();
  session.graph.rigControls.push(createWarpRigControl(), createRotationRigControl());
  session.graph.rigControlRootIds.push(RIG_FACE_WARP, RIG_FACE_ROTATION);
  return session;
}

function createRigNumberKeyformSet(
  keyformSetId: string,
  rigControlId: typeof RIG_FACE_WARP,
  property: "angleDegrees" | "opacityMultiplier",
  keys: readonly (readonly [number, number])[]
) {
  return {
    keyformSetId: KeyformSetIdSchema.parse(keyformSetId),
    target: {
      kind: "rigControl" as const,
      id: rigControlId,
      property
    },
    parameterId: FACE_ANGLE_X,
    evaluator: "linear-1d-v1" as const,
    interpolation: "linear-1d-v1" as const,
    compositionMode: "replace" as const,
    compositionOrder: 0,
    keys: keys.map(([value, statePatch]) => ({ value, statePatch }))
  };
}

function createDrawableNumberKeyformSet(
  keyformSetId: string,
  keys: readonly (readonly [number, number])[]
) {
  return {
    keyformSetId: KeyformSetIdSchema.parse(keyformSetId),
    target: {
      kind: "drawable" as const,
      id: DRAW_FACE,
      property: "opacity" as const
    },
    parameterId: FACE_ANGLE_X,
    evaluator: "linear-1d-v1" as const,
    interpolation: "linear-1d-v1" as const,
    compositionMode: "replace" as const,
    compositionOrder: 0,
    keys: keys.map(([value, statePatch]) => ({ value, statePatch }))
  };
}

function createRigVectorKeyformSet(
  keyformSetId: string,
  rigControlId: typeof RIG_FACE_WARP,
  property: "controlPointOffsets",
  keys: readonly {
    readonly value: number;
    readonly statePatch: readonly { readonly x: number; readonly y: number }[];
  }[]
) {
  return {
    keyformSetId: KeyformSetIdSchema.parse(keyformSetId),
    target: {
      kind: "rigControl" as const,
      id: rigControlId,
      property
    },
    parameterId: FACE_ANGLE_X,
    evaluator: "linear-1d-v1" as const,
    interpolation: "linear-1d-v1" as const,
    compositionMode: "replace" as const,
    compositionOrder: 0,
    keys: keys.map((key) => ({
      value: key.value,
      statePatch: key.statePatch.map((offset) => ({ x: offset.x, y: offset.y }))
    }))
  };
}

function createWarpRigControl() {
  return {
    kind: "warpLattice2d" as const,
    rigControlId: RIG_FACE_WARP,
    displayName: "Face Warp",
    partId: PART_FACE,
    childDrawableIds: [DRAW_FACE],
    childRigControlIds: [],
    opacityMultiplier: 0.9,
    bindSpace: "rigControlLocalRest" as const,
    domainBounds: { x: 0, y: 0, width: 10, height: 10 },
    latticeColumns: 2,
    latticeRows: 2,
    restControlPoints: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 10 },
      { x: 10, y: 10 }
    ],
    interpolationMethod: "bilinear-grid-v1" as const,
    enabled: true
  };
}

function createRotationRigControl() {
  return {
    kind: "rotation2d" as const,
    rigControlId: RIG_FACE_ROTATION,
    displayName: "Face Rotation",
    partId: PART_FACE,
    childDrawableIds: [DRAW_FACE],
    childRigControlIds: [],
    opacityMultiplier: 0.8,
    pivot: { x: 5, y: 5 },
    restAngleDegrees: 10,
    restTranslation: { x: 0, y: 0 },
    restScale: { x: 1, y: 1 },
    enabled: true
  };
}

function createFixtureSession(): AuthoringSession {
  return {
    packageIdentity: {
      packageId: PackageIdSchema.parse("pkg_parameter_keyform_state_fixture"),
      packageDisplayName: "Parameter Keyform State Fixture",
      formatVersion: "open-model-package-v1"
    },
    packageRevision: 0,
    authoringRevision: createInitialAuthoringRevision(),
    dirty: false,
    graph: {
      coordinateSystem: "canvas-y-down-v1",
      canvasSize: { width: 128, height: 128 },
      parts: [
        {
          partId: PART_ROOT,
          displayName: "Root",
          childPartIds: [PART_FACE],
          drawableIds: []
        },
        {
          partId: PART_FACE,
          displayName: "Face Part",
          parentPartId: PART_ROOT,
          childPartIds: [],
          drawableIds: [DRAW_FACE]
        }
      ],
      drawables: [
        {
          drawableId: DRAW_FACE,
          displayName: "Face",
          partId: PART_FACE,
          sourceAssetId: SOURCE_ASSET,
          textureId: TEX_FACE,
          meshId: MESH_FACE,
          defaultOpacity: 1,
          runtimeVisibility: true,
          baseDrawOrder: 0,
          sourceProvenanceId: PROVENANCE
        }
      ],
      meshes: [],
      parameters: [],
      keyformSets: [],
      rigControls: [],
      dynamicsGroups: [],
      masks: [],
      drawOrder: [{ drawableId: DRAW_FACE, baseDrawOrder: 0, stableOrder: 0 }],
      rigControlRootIds: [],
      stableOrder: [PART_ROOT, PART_FACE, DRAW_FACE],
      sourceAssets: [],
      provenanceRecords: [],
      rightsRecords: []
    }
  };
}
