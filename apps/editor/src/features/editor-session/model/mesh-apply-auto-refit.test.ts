import {
  createInitialAuthoringRevision,
  type AuthoringSession
} from "@private-2d-rigging-lab/authoring-core";
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
  TextureIdSchema,
  type DrawableId,
  type MeshId,
  type RectDto,
  type RigControlId
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { commitMeshApplyAutoRefit } from "./mesh-apply-auto-refit";

const PART_ROOT = PartIdSchema.parse("part_auto_refit_root");
const DRAW_A = DrawableIdSchema.parse("draw_auto_refit_a");
const DRAW_B = DrawableIdSchema.parse("draw_auto_refit_b");
const MESH_A = MeshIdSchema.parse("mesh_auto_refit_a");
const MESH_B = MeshIdSchema.parse("mesh_auto_refit_b");
const RIG_PARENT = RigControlIdSchema.parse("rig_auto_refit_parent");
const RIG_CHILD = RigControlIdSchema.parse("rig_auto_refit_child");
const PARAMETER = ParameterIdSchema.parse("param_auto_refit_keyed");

describe("Mesh Apply auto-refit", () => {
  it("expands an unkeyed Warp ancestor to include committed mesh vertices", () => {
    const session = createAutoRefitSession({
      meshes: [
        createMesh(MESH_A, DRAW_A, [
          { x: 20, y: 30 },
          { x: 42, y: 30 },
          { x: 20, y: 52 }
        ])
      ],
      rigControls: [
        createWarpRigControl(RIG_PARENT, {
          childDrawableIds: [DRAW_A],
          domainBounds: { x: 0, y: 0, width: 1, height: 1 }
        })
      ]
    });

    const result = commitMeshApplyAutoRefit(session, [DRAW_A]);

    expect(result.committed).toBe(true);
    expect(getWarpDomain(result.session, RIG_PARENT)).toEqual({
      x: 0,
      y: 0,
      width: 43,
      height: 53
    });
    expect(rectContainsVertices(getWarpDomain(result.session, RIG_PARENT), requireMesh(result.session, MESH_A).vertices))
      .toBe(true);
  });

  it("does not shrink an already larger Warp domain", () => {
    const largeDomain = { x: -100, y: -100, width: 300, height: 300 };
    const session = createAutoRefitSession({
      meshes: [
        createMesh(MESH_A, DRAW_A, [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 0, y: 10 }
        ])
      ],
      rigControls: [
        createWarpRigControl(RIG_PARENT, {
          childDrawableIds: [DRAW_A],
          domainBounds: largeDomain
        })
      ]
    });

    const result = commitMeshApplyAutoRefit(session, [DRAW_A]);

    expect(result.committed).toBe(false);
    expect(getWarpDomain(result.session, RIG_PARENT)).toEqual(largeDomain);
  });

  it("skips keyed Warp ancestors", () => {
    const session = createAutoRefitSession({
      meshes: [
        createMesh(MESH_A, DRAW_A, [
          { x: 20, y: 30 },
          { x: 42, y: 30 },
          { x: 20, y: 52 }
        ])
      ],
      rigControls: [
        createWarpRigControl(RIG_PARENT, {
          childDrawableIds: [DRAW_A],
          domainBounds: { x: 0, y: 0, width: 1, height: 1 }
        })
      ],
      keyedRigControlIds: [RIG_PARENT]
    });

    const result = commitMeshApplyAutoRefit(session, [DRAW_A]);

    expect(result.committed).toBe(false);
    expect(getWarpDomain(result.session, RIG_PARENT)).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });

  it("processes nested unkeyed Warp ancestors inner-to-outer", () => {
    const session = createAutoRefitSession({
      meshes: [
        createMesh(MESH_A, DRAW_A, [
          { x: 20, y: 30 },
          { x: 42, y: 30 },
          { x: 20, y: 52 }
        ])
      ],
      rigControls: [
        createWarpRigControl(RIG_PARENT, {
          childRigControlIds: [RIG_CHILD],
          domainBounds: { x: 0, y: 0, width: 1, height: 1 }
        }),
        createWarpRigControl(RIG_CHILD, {
          parentId: RIG_PARENT,
          childDrawableIds: [DRAW_A],
          domainBounds: { x: 0, y: 0, width: 1, height: 1 }
        })
      ]
    });

    const result = commitMeshApplyAutoRefit(session, [DRAW_A]);

    expect(result.committed).toBe(true);
    expect(rectContainsVertices(getWarpDomain(result.session, RIG_CHILD), requireMesh(result.session, MESH_A).vertices))
      .toBe(true);
    expect(getWarpDomain(result.session, RIG_PARENT)).toEqual(getWarpDomain(result.session, RIG_CHILD));
  });

  it("expands a shared parent Warp from all current children, not only committed Drawables", () => {
    const session = createAutoRefitSession({
      meshes: [
        createMesh(MESH_A, DRAW_A, [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 0, y: 10 }
        ]),
        createMesh(MESH_B, DRAW_B, [
          { x: 100, y: 20 },
          { x: 112, y: 20 },
          { x: 100, y: 32 }
        ])
      ],
      rigControls: [
        createWarpRigControl(RIG_PARENT, {
          childDrawableIds: [DRAW_A, DRAW_B],
          domainBounds: { x: 0, y: 0, width: 1, height: 1 }
        })
      ]
    });

    const result = commitMeshApplyAutoRefit(session, [DRAW_A]);

    expect(result.committed).toBe(true);
    expect(rectContainsVertices(getWarpDomain(result.session, RIG_PARENT), requireMesh(result.session, MESH_A).vertices))
      .toBe(true);
    expect(rectContainsVertices(getWarpDomain(result.session, RIG_PARENT), requireMesh(result.session, MESH_B).vertices))
      .toBe(true);
  });
});

function createAutoRefitSession(input: {
  readonly meshes: readonly AuthoringSession["graph"]["meshes"][number][];
  readonly rigControls: readonly AuthoringSession["graph"]["rigControls"][number][];
  readonly keyedRigControlIds?: readonly RigControlId[];
}): AuthoringSession {
  const drawableIds = input.meshes.map((mesh) => mesh.drawableId);
  const session: AuthoringSession = {
    packageIdentity: {
      packageId: PackageIdSchema.parse("pkg_mesh_apply_auto_refit"),
      packageDisplayName: "Mesh Apply Auto Refit",
      formatVersion: "open-model-package-v1"
    },
    packageRevision: 0,
    authoringRevision: createInitialAuthoringRevision(),
    dirty: false,
    graph: {
      coordinateSystem: "canvas-y-down-v1",
      canvasSize: { width: 256, height: 256 },
      parts: [
        {
          partId: PART_ROOT,
          displayName: "Root",
          childPartIds: [],
          drawableIds,
          children: drawableIds.map((drawableId) => ({ kind: "drawable", drawableId }))
        }
      ],
      drawables: input.meshes.map((mesh, index) => createDrawable(mesh.drawableId, mesh.meshId, index)),
      meshes: [...input.meshes],
      parameters: [
        {
          parameterId: PARAMETER,
          displayName: "Keyed",
          valueSource: "authoredInput",
          min: -1,
          default: 0,
          max: 1,
          recommendedUiStep: 0.1
        }
      ],
      keyformSets: (input.keyedRigControlIds ?? []).map((rigControlId) => ({
        keyformSetId: KeyformSetIdSchema.parse(`keyset_${rigControlId}_offsets`),
        target: {
          kind: "rigControl" as const,
          id: rigControlId,
          property: "controlPointOffsets"
        },
        parameterId: PARAMETER,
        evaluator: "linear-1d-v1" as const,
        interpolation: "linear-1d-v1" as const,
        compositionMode: "replace" as const,
        compositionOrder: 0,
        keys: [
          {
            value: 0,
            statePatch: []
          }
        ]
      })),
      rigControls: [...input.rigControls],
      dynamicsGroups: [],
      masks: [],
      drawOrder: drawableIds.map((drawableId, index) => ({
        drawableId,
        baseDrawOrder: index,
        stableOrder: index
      })),
      rigControlRootIds: input.rigControls
        .filter((rigControl) => rigControl.parentId === undefined)
        .map((rigControl) => rigControl.rigControlId),
      stableOrder: [
        PART_ROOT,
        ...drawableIds,
        PARAMETER,
        ...input.rigControls.map((rigControl) => rigControl.rigControlId)
      ],
      sourceAssets: [],
      provenanceRecords: [],
      rightsRecords: []
    }
  };

  return session;
}

function createDrawable(
  drawableId: DrawableId,
  meshId: MeshId,
  baseDrawOrder: number
): AuthoringSession["graph"]["drawables"][number] {
  const token = String(drawableId).replace(/^draw_/, "");

  return {
    drawableId,
    displayName: token,
    partId: PART_ROOT,
    sourceAssetId: SourceAssetIdSchema.parse("src_auto_refit"),
    textureId: TextureIdSchema.parse(`tex_${token}`),
    meshId,
    defaultOpacity: 1,
    runtimeVisibility: true,
    baseDrawOrder,
    sourceProvenanceId: ProvenanceIdSchema.parse("prov_auto_refit")
  };
}

function createMesh(
  meshId: MeshId,
  drawableId: DrawableId,
  vertices: readonly { readonly x: number; readonly y: number }[]
): AuthoringSession["graph"]["meshes"][number] {
  return {
    meshId,
    drawableId,
    vertices: [...vertices],
    uvs: vertices.map(() => ({ x: 0, y: 0 })),
    triangles: [[0, 1, 2]],
    vertexStableIds: vertices.map((_, index) => `vtx_${index}`),
    triangleStableIds: ["tri_0"],
    topologyRevision: 1,
    bounds: vertexBounds(vertices),
    generationProvenanceId: ProvenanceIdSchema.parse("prov_auto_refit")
  };
}

function createWarpRigControl(
  rigControlId: RigControlId,
  input: {
    readonly parentId?: RigControlId;
    readonly childDrawableIds?: readonly DrawableId[];
    readonly childRigControlIds?: readonly RigControlId[];
    readonly domainBounds: RectDto;
  }
): AuthoringSession["graph"]["rigControls"][number] {
  return {
    kind: "warpLattice2d",
    rigControlId,
    displayName: String(rigControlId),
    ...(input.parentId === undefined ? {} : { parentId: input.parentId }),
    childDrawableIds: [...(input.childDrawableIds ?? [])],
    childRigControlIds: [...(input.childRigControlIds ?? [])],
    opacityMultiplier: 1,
    bindSpace: "rigControlLocalRest",
    domainBounds: structuredClone(input.domainBounds),
    latticeColumns: 2,
    latticeRows: 2,
    restControlPoints: [
      { x: input.domainBounds.x, y: input.domainBounds.y },
      { x: input.domainBounds.x + input.domainBounds.width, y: input.domainBounds.y },
      { x: input.domainBounds.x, y: input.domainBounds.y + input.domainBounds.height },
      {
        x: input.domainBounds.x + input.domainBounds.width,
        y: input.domainBounds.y + input.domainBounds.height
      }
    ],
    interpolationMethod: "bilinear-grid-v1",
    enabled: true
  };
}

function getWarpDomain(session: AuthoringSession, rigControlId: RigControlId): RectDto {
  const rigControl = session.graph.rigControls.find(
    (candidate) => candidate.rigControlId === rigControlId
  );
  if (rigControl?.kind !== "warpLattice2d") {
    throw new Error(`Expected Warp rig control ${rigControlId}.`);
  }

  return rigControl.domainBounds;
}

function requireMesh(session: AuthoringSession, meshId: MeshId) {
  const mesh = session.graph.meshes.find((candidate) => candidate.meshId === meshId);
  if (mesh === undefined) {
    throw new Error(`Expected mesh ${meshId}.`);
  }

  return mesh;
}

function rectContainsVertices(
  rect: RectDto,
  vertices: readonly { readonly x: number; readonly y: number }[]
): boolean {
  return vertices.every(
    (vertex) =>
      vertex.x >= rect.x &&
      vertex.y >= rect.y &&
      vertex.x <= rect.x + rect.width &&
      vertex.y <= rect.y + rect.height
  );
}

function vertexBounds(vertices: readonly { readonly x: number; readonly y: number }[]): RectDto {
  const left = Math.min(...vertices.map((vertex) => vertex.x));
  const top = Math.min(...vertices.map((vertex) => vertex.y));
  const right = Math.max(...vertices.map((vertex) => vertex.x));
  const bottom = Math.max(...vertices.map((vertex) => vertex.y));

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top
  };
}
