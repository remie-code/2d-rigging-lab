import {
  CheckIdSchema,
  DrawableIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  RuntimeSnapshotIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import {
  createMeshVertexRef,
  createRuntimeMeshEditEvidence,
  RuntimeSnapshotSchema
} from "@private-2d-rigging-lab/runtime-core";
import type { RuntimeSnapshotDto } from "@private-2d-rigging-lab/runtime-core";
import { describe, expect, it } from "vitest";

import { projectEditorPreview } from "./preview-projection.js";

describe("editor preview mesh edit evidence projection", () => {
  it("distinguishes selected, moved, locked, editor-hidden, runtime-hidden, and texture-backed vertex states", () => {
    const baselineSnapshot = createSnapshot({
      snapshotId: "snap_preview_mesh_000",
      visible: true,
      vertexHash: "vhash_before",
      vertices: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 0, y: 10 }
      ],
      bounds: { x: 0, y: 0, width: 10, height: 10 }
    });
    const candidateSnapshot = createSnapshot({
      snapshotId: "snap_preview_mesh_001",
      visible: false,
      vertexHash: "vhash_after",
      vertices: [
        { x: 0, y: 0 },
        { x: 14, y: -2 },
        { x: 0, y: 10 }
      ],
      bounds: { x: 0, y: -2, width: 14, height: 12 }
    });
    const meshEditEvidence = createRuntimeMeshEditEvidence({
      baselineSnapshot,
      candidateSnapshot
    });

    const projection = projectEditorPreview({
      snapshot: candidateSnapshot,
      meshEditEvidence,
      editorState: {
        selection: ["vtx_body_1"],
        lockedIds: [DRAWABLE_ID],
        editorHiddenIds: [DRAWABLE_ID]
      }
    });
    const drawable = projection.drawables[0];
    const movedVertex = drawable?.geometry.vertices?.find((vertex) => vertex.vertexStableId === "vtx_body_1");
    const untouchedVertex = drawable?.geometry.vertices?.find((vertex) => vertex.vertexStableId === "vtx_body_0");

    expect(drawable).toMatchObject({
      drawableId: DRAWABLE_ID,
      visible: false,
      texture: {
        status: "resolved",
        textureId: TEXTURE_ID
      },
      layerState: {
        runtimeVisible: false,
        editorHidden: true,
        locked: true,
        selected: false,
        textureBacked: true,
        textureUnresolved: false
      },
      geometry: {
        vertexCount: 3,
        vertexHash: "vhash_after",
        topology: {
          vertexCount: 3,
          stableVertexIdCount: 3,
          uvCount: 3,
          triangleCount: 1
        },
        movedVertexRefs: [createMeshVertexRef(MESH_ID, 1, "vtx_body_1")]
      }
    });
    expect(movedVertex).toEqual({
      vertexIndex: 1,
      vertexStableId: "vtx_body_1",
      vertexRef: createMeshVertexRef(MESH_ID, 1, "vtx_body_1"),
      position: { x: 14, y: -2 },
      state: {
        selected: true,
        moved: true,
        locked: true,
        editorHidden: true,
        runtimeVisible: false,
        runtimeHidden: true,
        textureBacked: true
      }
    });
    expect(untouchedVertex?.state).toMatchObject({
      selected: false,
      moved: false,
      locked: true,
      editorHidden: true,
      runtimeHidden: true,
      textureBacked: true
    });
  });
});

const DRAWABLE_ID = DrawableIdSchema.parse("draw_body");
const MESH_ID = MeshIdSchema.parse("mesh_body");
const TEXTURE_ID = TextureIdSchema.parse("tex_body");
const SOURCE_ASSET_ID = SourceAssetIdSchema.parse("src_body");
const VERTEX_STABLE_IDS = ["vtx_body_0", "vtx_body_1", "vtx_body_2"] as const;

const createSnapshot = (input: {
  readonly snapshotId: string;
  readonly visible: boolean;
  readonly vertexHash: string;
  readonly vertices: readonly { readonly x: number; readonly y: number }[];
  readonly bounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
}): RuntimeSnapshotDto =>
  RuntimeSnapshotSchema.parse({
    schemaVersion: "runtime-snapshot-v1",
    runtimeCoreVersion: "test",
    snapshotId: RuntimeSnapshotIdSchema.parse(input.snapshotId),
    context: {
      source: { surface: "preview" },
      policy: { strictness: "interactive" }
    },
    packageId: PackageIdSchema.parse("pkg_preview_mesh"),
    packageRevision: 1,
    dirty: false,
    evaluation: {
      snapshotDetail: "full",
      evaluatorVersions: {
        dynamics: "scalarDampedFollowV1",
        keyform1d: "linear-1d-v1",
        keyformGrid2d: "parameter-grid-2d-v1",
        warpLattice: "bilinear-grid-v1",
        rigControlHierarchy: "parent-before-child-v1"
      }
    },
    parameters: [],
    dynamics: [],
    keyformSamples: [],
    rigControls: [],
    drawables: [
      {
        drawableId: DRAWABLE_ID,
        meshId: MESH_ID,
        texture: {
          status: "resolved",
          textureId: TEXTURE_ID,
          sourceAssetId: SOURCE_ASSET_ID,
          sourceLayerId: "layer_body",
          projection: {
            kind: "uv",
            uvCount: 3,
            uvs: [
              { x: 0, y: 0 },
              { x: 1, y: 0 },
              { x: 0, y: 1 }
            ]
          }
        },
        visible: input.visible,
        opacity: 1,
        baseDrawOrder: 0,
        evaluatedDrawOrder: 0,
        bounds: input.bounds,
        vertexCount: input.vertices.length,
        vertexHash: input.vertexHash,
        vertices: input.vertices,
        mesh: {
          drawableId: DRAWABLE_ID,
          meshId: MESH_ID,
          bounds: input.bounds,
          vertexHash: input.vertexHash,
          topology: {
            vertexCount: input.vertices.length,
            stableVertexIdCount: VERTEX_STABLE_IDS.length,
            uvCount: 3,
            triangleCount: 1,
            triangleIndexCount: 3,
            hasStableVertexIds: true,
            hasUvProjection: true,
            hasTriangles: true
          },
          vertices: input.vertices.map((position, vertexIndex) => ({
            vertexIndex,
            vertexStableId: VERTEX_STABLE_IDS[vertexIndex],
            vertexRef: createMeshVertexRef(MESH_ID, vertexIndex, VERTEX_STABLE_IDS[vertexIndex]),
            position
          }))
        },
        diagnostics: []
      }
    ],
    masks: [],
    drawList: input.visible ? [DRAWABLE_ID] : [],
    disabledFutureLayers: [],
    diagnostics: [
      {
        checkId: CheckIdSchema.parse("runtime.previewMeshEvidence"),
        status: "pass",
        severity: "info",
        phase: "mesh_evaluation",
        target: { kind: "drawable", id: DRAWABLE_ID },
        message: "Preview mesh evidence fixture."
      }
    ]
  });
