import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import {
  DrawableIdSchema,
  DynamicsGroupIdSchema,
  KeyformSetIdSchema,
  MeshIdSchema,
  ParameterIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  RigControlIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema,
  type DrawableId,
  type DynamicsGroupId,
  type MeshId,
  type ParameterId,
  type RigControlId
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { createEmptyAuthoringSession } from "./empty-authoring-session";
import {
  countEditorDiagnosticWarnings,
  createEditorDiagnosticsProjection,
  type EditorDiagnosticCode
} from "./editor-diagnostics-state";

const PART_ROOT = PartIdSchema.parse("part_root");
const DRAW_MESHLESS = DrawableIdSchema.parse("draw_meshless");
const DRAW_EMPTY_SCAFFOLD = DrawableIdSchema.parse("draw_empty_scaffold");
const DRAW_EMPTY_TRIANGLES = DrawableIdSchema.parse("draw_empty_triangles");
const DRAW_UNUSED_EMPTY = DrawableIdSchema.parse("draw_unused_empty");
const DRAW_VALID = DrawableIdSchema.parse("draw_valid");
const DRAW_MISSING = DrawableIdSchema.parse("draw_missing");
const DRAW_MISSING_CHILD = DrawableIdSchema.parse("draw_missing_child");
const MESH_MISSING = MeshIdSchema.parse("mesh_missing");
const MESH_EMPTY_SCAFFOLD = MeshIdSchema.parse("mesh_empty_scaffold");
const MESH_EMPTY_TRIANGLES = MeshIdSchema.parse("mesh_empty_triangles");
const MESH_UNUSED_EMPTY = MeshIdSchema.parse("mesh_unused_empty");
const MESH_VALID = MeshIdSchema.parse("mesh_valid");
const TEX_FIXTURE = TextureIdSchema.parse("tex_fixture");
const SOURCE_ASSET = SourceAssetIdSchema.parse("src_fixture");
const PROVENANCE = ProvenanceIdSchema.parse("prov_fixture");
const PARAM_DRIVER = ParameterIdSchema.parse("param_driver");
const PARAM_OUTPUT = ParameterIdSchema.parse("param_output");
const PARAM_MISSING = ParameterIdSchema.parse("param_missing");
const RIG_PARENT = RigControlIdSchema.parse("rig_parent");
const RIG_MISSING = RigControlIdSchema.parse("rig_missing");
const RIG_CHILD_PARENT = RigControlIdSchema.parse("rig_child_parent");
const RIG_MISSING_PARENT = RigControlIdSchema.parse("rig_missing_parent");
const RIG_MISSING_CHILD = RigControlIdSchema.parse("rig_missing_child");
const RIG_PARENT_MISSING = RigControlIdSchema.parse("rig_parent_missing");
const RIG_CYCLE_A = RigControlIdSchema.parse("rig_cycle_a");
const RIG_CYCLE_B = RigControlIdSchema.parse("rig_cycle_b");
const DYN_A = DynamicsGroupIdSchema.parse("dyn_a");
const DYN_B = DynamicsGroupIdSchema.parse("dyn_b");
const DYN_C = DynamicsGroupIdSchema.parse("dyn_c");

describe("editor diagnostics projection", () => {
  it("warns when a deformer or keyform uses a Drawable with a missing mesh", () => {
    const session = createEmptyAuthoringSession();
    addParameter(session, PARAM_DRIVER, "Driver");
    addDrawable(session, DRAW_MESHLESS, MESH_MISSING, "Meshless Drawable");
    session.graph.rigControls.push(
      createRotationDeformer(RIG_PARENT, {
        childDrawableIds: [DRAW_MESHLESS]
      })
    );
    session.graph.keyformSets.push(
      createLinearKeyformSet("keyset_meshless_drawable_opacity", {
        parameterId: PARAM_DRIVER,
        target: {
          kind: "drawable",
          id: DRAW_MESHLESS,
          property: "opacity"
        }
      })
    );

    const before = structuredClone(session);
    const projection = createEditorDiagnosticsProjection(session);

    expect(projection.items.map((item) => item.code)).toEqual(["mesh.drawableMeshMissing"]);
    expect(projection.warningItemCount).toBe(1);
    expect(projection.items[0]).toMatchObject({
      target: {
        kind: "drawable",
        id: DRAW_MESHLESS,
        label: "Meshless Drawable"
      },
      details: {
        meshId: MESH_MISSING,
        boundByRigControlIds: [RIG_PARENT],
        keyformSetIds: ["keyset_meshless_drawable_opacity"]
      },
      actionHints: [
        {
          kind: "openMeshTool",
          target: {
            kind: "drawable",
            id: DRAW_MESHLESS
          }
        }
      ]
    });
    expect(session).toEqual(before);
  });

  it("warns when a deformer uses a Drawable with an empty mesh scaffold", () => {
    const session = createEmptyAuthoringSession();
    addDrawable(session, DRAW_EMPTY_SCAFFOLD, MESH_EMPTY_SCAFFOLD, "Empty Scaffold Drawable");
    addMeshScaffold(session, MESH_EMPTY_SCAFFOLD, DRAW_EMPTY_SCAFFOLD, {
      vertices: [],
      triangles: []
    });
    session.graph.rigControls.push(
      createRotationDeformer(RIG_PARENT, {
        childDrawableIds: [DRAW_EMPTY_SCAFFOLD]
      })
    );

    const projection = createEditorDiagnosticsProjection(session);

    expect(projection.items.map((item) => item.code)).toEqual(["mesh.drawableMeshMissing"]);
    expect(projection.items[0]).toMatchObject({
      target: {
        id: DRAW_EMPTY_SCAFFOLD
      },
      details: {
        meshId: MESH_EMPTY_SCAFFOLD,
        boundByRigControlIds: [RIG_PARENT]
      }
    });
  });

  it("warns when a keyform targets a Drawable with empty mesh triangles", () => {
    const session = createEmptyAuthoringSession();
    addParameter(session, PARAM_DRIVER, "Driver");
    addDrawable(session, DRAW_EMPTY_TRIANGLES, MESH_EMPTY_TRIANGLES, "Empty Triangles Drawable");
    addMeshScaffold(session, MESH_EMPTY_TRIANGLES, DRAW_EMPTY_TRIANGLES, {
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 0, y: 10 }
      ],
      triangles: []
    });
    session.graph.keyformSets.push(
      createLinearKeyformSet("keyset_empty_triangles_opacity", {
        parameterId: PARAM_DRIVER,
        target: {
          kind: "drawable",
          id: DRAW_EMPTY_TRIANGLES,
          property: "opacity"
        }
      })
    );

    const projection = createEditorDiagnosticsProjection(session);

    expect(projection.items.map((item) => item.code)).toEqual(["mesh.drawableMeshMissing"]);
    expect(projection.items[0]).toMatchObject({
      target: {
        id: DRAW_EMPTY_TRIANGLES
      },
      details: {
        meshId: MESH_EMPTY_TRIANGLES,
        keyformSetIds: ["keyset_empty_triangles_opacity"]
      }
    });
  });

  it("does not warn for an unused Drawable with an empty mesh scaffold", () => {
    const session = createEmptyAuthoringSession();
    addDrawable(session, DRAW_UNUSED_EMPTY, MESH_UNUSED_EMPTY, "Unused Empty Drawable");
    addMeshScaffold(session, MESH_UNUSED_EMPTY, DRAW_UNUSED_EMPTY, {
      vertices: [],
      triangles: []
    });

    const projection = createEditorDiagnosticsProjection(session);

    expect(projection.items).toEqual([]);
    expect(projection.warningItemCount).toBe(0);
  });

  it("warns for missing keyform parameters and missing Drawable or Deformer targets", () => {
    const session = createEmptyAuthoringSession();
    addParameter(session, PARAM_DRIVER, "Driver");
    addDrawable(session, DRAW_VALID, MESH_VALID, "Valid Drawable");
    addMesh(session, MESH_VALID, DRAW_VALID);
    session.graph.keyformSets.push(
      createLinearKeyformSet("keyset_missing_parameter", {
        parameterId: PARAM_MISSING,
        target: {
          kind: "drawable",
          id: DRAW_VALID,
          property: "opacity"
        }
      }),
      createLinearKeyformSet("keyset_missing_drawable_target", {
        parameterId: PARAM_DRIVER,
        target: {
          kind: "drawable",
          id: DRAW_MISSING,
          property: "opacity"
        }
      }),
      createLinearKeyformSet("keyset_missing_deformer_target", {
        parameterId: PARAM_DRIVER,
        target: {
          kind: "rigControl",
          id: RIG_MISSING,
          property: "angleDegrees"
        }
      })
    );

    const projection = createEditorDiagnosticsProjection(session);

    expect(countCodes(projection.items)).toEqual({
      "references.keyformParameterMissing": 1,
      "references.keyformTargetDeformerMissing": 1,
      "references.keyformTargetDrawableMissing": 1
    });
    expect(projection.warningItemCount).toBe(3);
  });

  it("warns for missing Deformer parent, missing children, and parent cycles", () => {
    const session = createEmptyAuthoringSession();
    session.graph.rigControls.push(
      createRotationDeformer(RIG_PARENT_MISSING, {
        parentId: RIG_MISSING_PARENT
      }),
      createRotationDeformer(RIG_CHILD_PARENT, {
        childDrawableIds: [DRAW_MISSING_CHILD],
        childRigControlIds: [RIG_MISSING_CHILD]
      }),
      createRotationDeformer(RIG_CYCLE_A, {
        parentId: RIG_CYCLE_B
      }),
      createRotationDeformer(RIG_CYCLE_B, {
        parentId: RIG_CYCLE_A
      })
    );

    const projection = createEditorDiagnosticsProjection(session);

    expect(countCodes(projection.items)).toEqual({
      "references.deformerChildMissing": 2,
      "references.deformerParentCycle": 1,
      "references.deformerParentMissing": 1
    });
    expect(projection.items.find((item) => item.code === "references.deformerParentCycle"))
      .toMatchObject({
        details: {
          rigControlIds: [RIG_CYCLE_A, RIG_CYCLE_B]
        }
      });
    expect(projection.warningItemCount).toBe(4);
  });

  it("warns for existing Dynamics broken references, duplicate output ownership, and missing output keyforms", () => {
    const session = createEmptyAuthoringSession();
    addParameter(session, PARAM_DRIVER, "Driver");
    addParameter(session, PARAM_OUTPUT, "Output");
    session.graph.dynamicsGroups.push(
      createDynamicsGroup(DYN_A, "Broken Dynamics", PARAM_MISSING, PARAM_MISSING),
      createDynamicsGroup(DYN_B, "Output Owner B", PARAM_DRIVER, PARAM_OUTPUT),
      createDynamicsGroup(DYN_C, "Output Owner C", PARAM_DRIVER, PARAM_OUTPUT)
    );

    const projection = createEditorDiagnosticsProjection(session);
    const repeatedProjection = createEditorDiagnosticsProjection(session);

    expect(countCodes(projection.items)).toEqual({
      "dynamics.inputParameterMissing": 1,
      "dynamics.outputKeyformMissing": 2,
      "dynamics.outputOwnershipDuplicate": 1,
      "dynamics.outputParameterMissing": 1
    });
    expect(projection.warningItemCount).toBe(5);
    expect(countEditorDiagnosticWarnings(session)).toBe(5);
    expect(repeatedProjection.items.map((item) => item.id)).toEqual(
      projection.items.map((item) => item.id)
    );
  });

  it("does not warn for Dynamics output keyform missing when any keyformSet uses the output parameter", () => {
    const session = createEmptyAuthoringSession();
    addParameter(session, PARAM_DRIVER, "Driver");
    addParameter(session, PARAM_OUTPUT, "Output");
    addDrawable(session, DRAW_VALID, MESH_VALID, "Valid Drawable");
    addMesh(session, MESH_VALID, DRAW_VALID);
    session.graph.keyformSets.push(
      createLinearKeyformSet("keyset_output_parameter_opacity", {
        parameterId: PARAM_OUTPUT,
        target: {
          kind: "drawable",
          id: DRAW_VALID,
          property: "opacity"
        }
      })
    );
    session.graph.dynamicsGroups.push(
      createDynamicsGroup(DYN_A, "Keyed Output", PARAM_DRIVER, PARAM_OUTPUT)
    );

    const projection = createEditorDiagnosticsProjection(session);

    expect(projection.items).toEqual([]);
    expect(projection.warningItemCount).toBe(0);
  });
});

function addParameter(session: AuthoringSession, parameterId: ParameterId, displayName: string) {
  session.graph.parameters.push({
    parameterId,
    displayName,
    valueSource: "authoredInput",
    min: -30,
    default: 0,
    max: 30,
    recommendedUiStep: 1,
    kind: "custom",
    parameterType: "scalar",
    group: "custom",
    lockedFields: []
  });
}

function addDrawable(
  session: AuthoringSession,
  drawableId: DrawableId,
  meshId: MeshId,
  displayName: string
) {
  session.graph.drawables.push({
    drawableId,
    displayName,
    partId: PART_ROOT,
    sourceAssetId: SOURCE_ASSET,
    textureId: TEX_FIXTURE,
    meshId,
    defaultOpacity: 1,
    runtimeVisibility: true,
    baseDrawOrder: session.graph.drawables.length,
    sourceProvenanceId: PROVENANCE
  });
  session.graph.parts[0]?.drawableIds.push(drawableId);
  session.graph.drawOrder.push({
    drawableId,
    baseDrawOrder: session.graph.drawOrder.length,
    stableOrder: session.graph.drawOrder.length
  });
  session.graph.stableOrder.push(drawableId);
}

function addMesh(session: AuthoringSession, meshId: MeshId, drawableId: DrawableId) {
  session.graph.meshes.push({
    meshId,
    drawableId,
    vertices: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 10 }
    ],
    uvs: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 }
    ],
    triangles: [[0, 1, 2]],
    vertexStableIds: ["vtx_a", "vtx_b", "vtx_c"],
    bounds: { x: 0, y: 0, width: 10, height: 10 },
    generationProvenanceId: PROVENANCE
  });
}

function addMeshScaffold(
  session: AuthoringSession,
  meshId: MeshId,
  drawableId: DrawableId,
  input: {
    readonly vertices: readonly { readonly x: number; readonly y: number }[];
    readonly triangles: readonly (readonly [number, number, number])[];
  }
) {
  session.graph.meshes.push({
    meshId,
    drawableId,
    vertices: input.vertices.map((vertex) => ({ ...vertex })),
    uvs: input.vertices.map(() => ({ x: 0, y: 0 })),
    triangles: input.triangles.map((triangle) => [...triangle] as [number, number, number]),
    vertexStableIds: input.vertices.map((_vertex, index) => `vtx_scaffold_${index}`),
    bounds: { x: 0, y: 0, width: 10, height: 10 },
    generationProvenanceId: PROVENANCE
  });
}

function createRotationDeformer(
  rigControlId: RigControlId,
  options: {
    readonly parentId?: RigControlId;
    readonly childDrawableIds?: readonly DrawableId[];
    readonly childRigControlIds?: readonly RigControlId[];
  } = {}
) {
  return {
    kind: "rotation2d" as const,
    rigControlId,
    displayName: rigControlId,
    partId: PART_ROOT,
    ...(options.parentId === undefined ? {} : { parentId: options.parentId }),
    childDrawableIds: [...(options.childDrawableIds ?? [])],
    childRigControlIds: [...(options.childRigControlIds ?? [])],
    opacityMultiplier: 1,
    pivot: { x: 0, y: 0 },
    restAngleDegrees: 0,
    restTranslation: { x: 0, y: 0 },
    restScale: { x: 1, y: 1 },
    enabled: true
  };
}

function createLinearKeyformSet(
  keyformSetId: string,
  input: {
    readonly parameterId: ParameterId;
    readonly target: {
      readonly kind: "drawable" | "rigControl";
      readonly id: string;
      readonly property: string;
    };
  }
) {
  return {
    keyformSetId: KeyformSetIdSchema.parse(keyformSetId),
    target: input.target,
    parameterId: input.parameterId,
    evaluator: "linear-1d-v1" as const,
    interpolation: "linear-1d-v1" as const,
    compositionMode: "replace" as const,
    compositionOrder: 0,
    keys: [
      {
        value: 0,
        statePatch: 1
      }
    ]
  };
}

function createDynamicsGroup(
  dynamicsGroupId: DynamicsGroupId,
  displayName: string,
  inputParameterId: ParameterId,
  outputParameterId: ParameterId
) {
  return {
    dynamicsGroupId,
    displayName,
    enabled: true,
    presetId: "hair",
    inputs: [
      {
        parameterId: inputParameterId,
        kind: "angle" as const,
        influencePercent: 100,
        invert: false,
        normalization: {
          min: -30,
          center: 0,
          max: 30
        }
      }
    ],
    pendulums: [
      {
        length: 0.8,
        sway: 0.7,
        reactionSpeed: 12,
        convergenceSpeed: 4
      }
    ],
    outputs: [
      {
        parameterId: outputParameterId,
        kind: "angle" as const,
        strength: 10,
        invert: false,
        limit: 15
      }
    ]
  };
}

function countCodes(items: readonly { readonly code: EditorDiagnosticCode }[]) {
  return items.reduce<Partial<Record<EditorDiagnosticCode, number>>>((counts, item) => {
    counts[item.code] = (counts[item.code] ?? 0) + 1;
    return counts;
  }, {});
}
