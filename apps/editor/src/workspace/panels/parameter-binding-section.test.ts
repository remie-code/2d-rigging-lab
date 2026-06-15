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
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  createRigControlParameterBindings,
  createUniformControlPointOffsets,
  type ParameterKeyformBindingDescriptor,
  type ParameterValueMap
} from "../../features/editor-session/model/parameter-keyform-state";
import { ParameterBindingSection } from "./parameter-binding-section";

const editorSessionMock = vi.hoisted(() => ({ current: undefined as unknown }));

vi.mock("../../features/editor-session/editor-session-context", () => ({
  useEditorSession: () => editorSessionMock.current
}));

const PART_ROOT = PartIdSchema.parse("part_root");
const PART_FACE = PartIdSchema.parse("part_face");
const DRAW_FACE = DrawableIdSchema.parse("draw_face");
const MESH_FACE = MeshIdSchema.parse("mesh_face");
const TEX_FACE = TextureIdSchema.parse("tex_face");
const SOURCE_ASSET = SourceAssetIdSchema.parse("src_fixture");
const PROVENANCE = ProvenanceIdSchema.parse("prov_fixture");
const FACE_ANGLE_X = ParameterIdSchema.parse("param_face_angle_x");
const RIG_FACE_WARP = RigControlIdSchema.parse("rig_face_warp");
const RIG_FACE_ROTATION = RigControlIdSchema.parse("rig_face_rotation");

describe("ParameterBindingSection rig-control bindings", () => {
  it("renders Rotation binding rows and enables update/delete at an exact key", () => {
    const session = createRigFixtureSession();
    session.graph.keyformSets.push(
      createRigNumberKeyformSet("keyset_rotation_angle", RIG_FACE_ROTATION, "angleDegrees", [
        [0, 20]
      ]),
      createRigVec2KeyformSet("keyset_rotation_translation", RIG_FACE_ROTATION, "translation", [
        { value: 0, statePatch: { x: 3, y: -2 } }
      ]),
      createRigNumberKeyformSet(
        "keyset_rotation_opacity",
        RIG_FACE_ROTATION,
        "opacityMultiplier",
        [[0, 0.5]]
      )
    );
    const bindings = createRigControlParameterBindings(session, RIG_FACE_ROTATION);
    const fullMarkup = renderSection(session, bindings, { [FACE_ANGLE_X]: 0 });
    expect(fullMarkup).toContain("Rotation angle");
    expect(fullMarkup).toContain("Translation");
    expect(fullMarkup).toContain("Opacity multiplier");
    expect(fullMarkup).not.toContain("Parameter: Eyeball X");
    expect(fullMarkup).not.toContain("Keyform:");
    expect(fullMarkup).not.toContain("Keys:");

    const angleMarkup = renderSection(
      session,
      [findBinding(bindings, "angleDegrees")],
      { [FACE_ANGLE_X]: 0 }
    );
    expect(hasDisabledAttribute(inputMarkup(angleMarkup, "Rotation angle"))).toBe(false);
    expect(angleMarkup).not.toContain("Add Keyform Here");
    expect(hasDisabledAttribute(buttonMarkup(angleMarkup, "Update"))).toBe(false);
    expect(hasDisabledAttribute(buttonMarkup(angleMarkup, "Delete"))).toBe(false);

    const translationMarkup = renderSection(
      session,
      [findBinding(bindings, "translation")],
      { [FACE_ANGLE_X]: 0 }
    );
    expect(hasDisabledAttribute(inputMarkup(translationMarkup, "Translation X"))).toBe(false);
    expect(hasDisabledAttribute(inputMarkup(translationMarkup, "Translation Y"))).toBe(false);
    expect(hasDisabledAttribute(buttonMarkup(translationMarkup, "Update"))).toBe(false);
    expect(hasDisabledAttribute(buttonMarkup(translationMarkup, "Delete"))).toBe(false);
  });

  it("renders Warp binding rows and locks value editing between keyforms", () => {
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
        [-30, 0.5],
        [30, 1]
      ])
    );
    const bindings = createRigControlParameterBindings(session, RIG_FACE_WARP);
    const fullMarkup = renderSection(session, bindings, { [FACE_ANGLE_X]: 0 });
    expect(fullMarkup).toContain("Warp lattice offsets");
    expect(fullMarkup).toContain("Opacity multiplier");
    expect(fullMarkup).not.toContain("Parameter: Eyeball X");
    expect(fullMarkup).not.toContain("Keyform:");
    expect(fullMarkup).not.toContain("Keys:");

    const offsetsMarkup = renderSection(
      session,
      [findBinding(bindings, "controlPointOffsets")],
      { [FACE_ANGLE_X]: 0 }
    );
    expect(offsetsMarkup).not.toContain("Add a keyform at the current value to edit this property.");
    expect(hasDisabledAttribute(inputMarkup(offsetsMarkup, "Uniform offset X"))).toBe(true);
    expect(hasDisabledAttribute(inputMarkup(offsetsMarkup, "Uniform offset Y"))).toBe(true);
    expect(offsetsMarkup).not.toContain("Add Keyform Here");
    expect(offsetsMarkup).not.toContain('aria-label="Update"');
    expect(offsetsMarkup).not.toContain('aria-label="Delete"');
  });
});

function renderSection(
  session: AuthoringSession,
  bindings: readonly ParameterKeyformBindingDescriptor[],
  parameterValues: ParameterValueMap
): string {
  editorSessionMock.current = {
    activeParameterId: FACE_ANGLE_X,
    editKeyformKey: vi.fn(),
    parameterOperationFeedback: null,
    parameterValues,
    session
  };

  return renderToStaticMarkup(createElement(ParameterBindingSection, { bindings }));
}

function findBinding(
  bindings: readonly ParameterKeyformBindingDescriptor[],
  targetProperty: string
): ParameterKeyformBindingDescriptor {
  const binding = bindings.find((candidate) => candidate.targetProperty === targetProperty);
  if (binding === undefined) {
    throw new Error(`Expected binding for ${targetProperty}.`);
  }

  return binding;
}

function inputMarkup(markup: string, ariaLabel: string): string {
  return elementMarkup(markup, "input", ariaLabel);
}

function buttonMarkup(markup: string, ariaLabel: string): string {
  return elementMarkup(markup, "button", ariaLabel);
}

function elementMarkup(markup: string, tagName: string, ariaLabel: string): string {
  const escapedLabel = ariaLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = markup.match(new RegExp(`<${tagName}[^>]*aria-label="${escapedLabel}"[^>]*>`));
  if (match === null) {
    throw new Error(`Expected ${tagName} with aria-label ${ariaLabel}.`);
  }

  return match[0];
}

function hasDisabledAttribute(markup: string): boolean {
  return /\sdisabled(?:=""|(?=[\s/>]))/.test(markup);
}

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

function createRigVec2KeyformSet(
  keyformSetId: string,
  rigControlId: typeof RIG_FACE_ROTATION,
  property: "translation",
  keys: readonly {
    readonly value: number;
    readonly statePatch: { readonly x: number; readonly y: number };
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
      statePatch: { x: key.statePatch.x, y: key.statePatch.y }
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
      packageId: PackageIdSchema.parse("pkg_parameter_binding_section_fixture"),
      packageDisplayName: "Parameter Binding Section Fixture",
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
