import {
  createInitialAuthoringRevision,
  type AuthoringSession,
  type AuthoringSessionBinaryAssets
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
  type RectDto,
  type RigControlId,
  type Vec2Dto
} from "@private-2d-rigging-lab/contracts";

import type { ParameterValueMap } from "../../features/editor-session/model/parameter-keyform-state";

/**
 * Deterministic synthetic "heavy" AuthoringSession generator for Perf Wave 1 measurement.
 *
 * The generated session is a *pure function of the scale parameters* below: no randomness, no
 * time, no ambient state. Same parameters -> byte-identical session (verified by the sibling
 * test). This is a measurement fixture only; it exercises the same evaluation path
 * (`createCanvasRenderProjection` -> `createCanvasEvaluatedScene`) that Editor Canvas / Editor
 * Viewer share, so the phase breakdown collected here reflects the real hot path shape.
 *
 * Scale knobs (all effective factors in the dominant hypothesis O(Sigma vertices * chain depth)):
 * - `drawableCount`     : number of drawables, each with its own mesh + rig-control chain.
 * - `verticesPerMesh`   : vertices per drawable mesh (grid), driving per-drawable deform cost.
 * - `deformerChainDepth`: warp rig-control chain depth applied to each drawable (parent chain).
 * - `keyformSetCount`   : total keyform sets re-sampled every evaluation (hypothesis B factor).
 */
export interface SyntheticHeavyModelScale {
  readonly drawableCount: number;
  readonly verticesPerMesh: number;
  readonly deformerChainDepth: number;
  readonly keyformSetCount: number;
}

/** The single parameter every synthetic keyform set binds to (a preset, min -30 / max 30). */
export const SYNTHETIC_HEAVY_MODEL_PARAMETER_ID = ParameterIdSchema.parse("param_face_angle_x");

/** Parameter values that scrub the synthetic parameter to its max, exercising all keyforms. */
export const SYNTHETIC_HEAVY_MODEL_SCRUB_VALUES: ParameterValueMap = {
  [SYNTHETIC_HEAVY_MODEL_PARAMETER_ID]: 30
};

// Fixed render footprint per drawable. `canvas-projection resolveDrawableRenderDimensions` uses
// the base mesh bounds (there is no sourceLayer) to derive renderWidth/renderHeight, so pinning
// each mesh's declared `bounds` to this tile keeps those dimensions deterministic and lets us
// size the RGBA byte payload exactly. That exact match is required for the drawable to survive
// `isRenderableDrawable` in the render-scene adapter (renderBytes.byteLength === w*h*4). The mesh
// *vertices* still span a large deform region; `bounds` only governs the render tile size.
const RENDER_TILE_SIZE = 4;
const RENDER_BYTES_LENGTH = RENDER_TILE_SIZE * RENDER_TILE_SIZE * 4;

const PART_ROOT = PartIdSchema.parse("part_synthetic_root");
const PART_BODY = PartIdSchema.parse("part_synthetic_body");
const SOURCE_ASSET = SourceAssetIdSchema.parse("src_synthetic_heavy");
const PROVENANCE = ProvenanceIdSchema.parse("prov_synthetic_heavy");

export function createSyntheticHeavyModelSession(
  scale: SyntheticHeavyModelScale
): AuthoringSession {
  const drawableCount = clampInt(scale.drawableCount, 1);
  const verticesPerMesh = clampInt(scale.verticesPerMesh, 1);
  const deformerChainDepth = clampInt(scale.deformerChainDepth, 0);
  const keyformSetCount = clampInt(scale.keyformSetCount, 0);

  const drawables: AuthoringSession["graph"]["drawables"] = [];
  const meshes: AuthoringSession["graph"]["meshes"] = [];
  const textures: NonNullable<AuthoringSession["graph"]["textureAtlas"]>["textures"] = [];
  const rigControls: AuthoringSession["graph"]["rigControls"] = [];
  const keyformSets: AuthoringSession["graph"]["keyformSets"] = [];
  const drawOrder: AuthoringSession["graph"]["drawOrder"] = [];
  const rigControlRootIds: RigControlId[] = [];
  const fileEntries: AuthoringSessionBinaryAssets["fileEntries"] = [];
  const drawableIds: DrawableId[] = [];

  for (let drawableIndex = 0; drawableIndex < drawableCount; drawableIndex += 1) {
    const drawableId = DrawableIdSchema.parse(`draw_synthetic_${drawableIndex}`);
    const meshId = MeshIdSchema.parse(`mesh_synthetic_${drawableIndex}`);
    const textureId = TextureIdSchema.parse(`tex_synthetic_${drawableIndex}`);
    const relativePath = `assets/textures/synthetic_${drawableIndex}.rgba`;
    const meshBounds = createDrawableMeshBounds(drawableIndex);

    drawableIds.push(drawableId);
    meshes.push(createSyntheticMesh(meshId, drawableId, meshBounds, verticesPerMesh));
    drawables.push({
      drawableId,
      displayName: `Synthetic Drawable ${drawableIndex}`,
      partId: PART_BODY,
      sourceAssetId: SOURCE_ASSET,
      textureId,
      meshId,
      defaultOpacity: 1,
      runtimeVisibility: true,
      baseDrawOrder: drawableIndex,
      sourceProvenanceId: PROVENANCE
    });
    drawOrder.push({ drawableId, baseDrawOrder: drawableIndex, stableOrder: drawableIndex });
    textures.push(createSyntheticTexture(textureId, drawableIndex, relativePath));
    fileEntries.push({
      path: relativePath,
      bytes: createDeterministicRgbaBytes(drawableIndex),
      mediaType: "application/octet-stream; pixelFormat=rgba8",
      binaryAssetId: `bin_synthetic_${drawableIndex}`
    });

    appendDrawableRigControlChain({
      chainDepth: deformerChainDepth,
      drawableIndex,
      drawableId,
      meshBounds,
      rigControls,
      rigControlRootIds
    });
  }

  for (let keyformIndex = 0; keyformIndex < keyformSetCount; keyformIndex += 1) {
    keyformSets.push(createSyntheticDrawableOpacityKeyformSet(keyformIndex, drawableIds));
  }

  return {
    packageIdentity: {
      packageId: PackageIdSchema.parse("pkg_synthetic_heavy"),
      packageDisplayName: "Synthetic heavy model",
      formatVersion: "open-model-package-v1"
    },
    packageRevision: 0,
    authoringRevision: createInitialAuthoringRevision(),
    dirty: false,
    graph: {
      coordinateSystem: "canvas-y-down-v1",
      canvasSize: { width: 1024, height: 1024 },
      parts: [
        {
          partId: PART_ROOT,
          displayName: "Root",
          childPartIds: [PART_BODY],
          drawableIds: []
        },
        {
          partId: PART_BODY,
          displayName: "Body",
          parentPartId: PART_ROOT,
          childPartIds: [],
          drawableIds: [...drawableIds]
        }
      ],
      drawables,
      meshes,
      parameters: [],
      keyformSets,
      rigControls,
      dynamicsGroups: [],
      masks: [],
      drawOrder,
      rigControlRootIds,
      stableOrder: [PART_ROOT, PART_BODY, ...drawableIds],
      sourceAssets: [],
      textureAtlas: {
        schemaVersion: "texture-atlas-v1",
        textures
      },
      provenanceRecords: [],
      rightsRecords: []
    },
    binaryAssets: {
      fileEntries,
      binaryAssetIndex: { schemaVersion: "binary-asset-index-v1", assets: [] },
      byteIntakeSummaries: []
    }
  };
}

function appendDrawableRigControlChain(input: {
  readonly chainDepth: number;
  readonly drawableIndex: number;
  readonly drawableId: string;
  readonly meshBounds: RectDto;
  readonly rigControls: AuthoringSession["graph"]["rigControls"];
  readonly rigControlRootIds: RigControlId[];
}): void {
  if (input.chainDepth <= 0) {
    return;
  }

  // Domain bounds are inflated so every mesh vertex lands inside the warp lattice (otherwise the
  // warp is a no-op and the deform cost collapses). The chain is parent -> child, with the
  // deepest (index 0) directly owning the drawable.
  const domainBounds: RectDto = {
    x: input.meshBounds.x - input.meshBounds.width,
    y: input.meshBounds.y - input.meshBounds.height,
    width: input.meshBounds.width * 3,
    height: input.meshBounds.height * 3
  };

  for (let depthIndex = 0; depthIndex < input.chainDepth; depthIndex += 1) {
    const rigControlId = RigControlIdSchema.parse(
      `rig_synthetic_${input.drawableIndex}_${depthIndex}`
    );
    const isDeepest = depthIndex === 0;
    const isRoot = depthIndex === input.chainDepth - 1;
    const parentId = isRoot
      ? undefined
      : RigControlIdSchema.parse(`rig_synthetic_${input.drawableIndex}_${depthIndex + 1}`);
    const childRigControlIds = isDeepest
      ? []
      : [RigControlIdSchema.parse(`rig_synthetic_${input.drawableIndex}_${depthIndex - 1}`)];

    input.rigControls.push({
      kind: "warpLattice2d",
      rigControlId,
      displayName: rigControlId,
      partId: PART_BODY,
      ...(parentId === undefined ? {} : { parentId }),
      childDrawableIds: isDeepest ? [DrawableIdSchema.parse(input.drawableId)] : [],
      childRigControlIds,
      opacityMultiplier: 1,
      bindSpace: "rigControlLocalRest",
      domainBounds: { ...domainBounds },
      latticeColumns: 3,
      latticeRows: 3,
      restControlPoints: createRestControlPoints(domainBounds, 3, 3),
      interpolationMethod: "bilinear-grid-v1",
      enabled: true
    });

    if (isRoot) {
      input.rigControlRootIds.push(rigControlId);
    }
  }
}

function createSyntheticMesh(
  meshId: ReturnType<typeof MeshIdSchema.parse>,
  drawableId: string,
  bounds: RectDto,
  verticesPerMesh: number
): AuthoringSession["graph"]["meshes"][number] {
  const { vertices, uvs, vertexStableIds } = createMeshGrid(bounds, verticesPerMesh);
  const triangles = createGridTriangles(vertices.length);

  return {
    meshId,
    drawableId: DrawableIdSchema.parse(drawableId),
    vertices,
    uvs,
    triangles,
    vertexStableIds,
    // The declared bounds only drives render tile size (see RENDER_TILE_SIZE note); vertices span
    // the wider `bounds` region above for deform cost. Keeping this fixed makes renderWidth/Height
    // and thus the required RGBA byte length deterministic across scales.
    bounds: { x: 0, y: 0, width: RENDER_TILE_SIZE, height: RENDER_TILE_SIZE },
    generationProvenanceId: PROVENANCE
  };
}

function createMeshGrid(
  bounds: RectDto,
  vertexCount: number
): {
  readonly vertices: Vec2Dto[];
  readonly uvs: Vec2Dto[];
  readonly vertexStableIds: string[];
} {
  // Arrange `vertexCount` vertices in the smallest near-square grid, then map onto `bounds`.
  const columns = Math.max(2, Math.ceil(Math.sqrt(vertexCount)));
  const rows = Math.max(2, Math.ceil(vertexCount / columns));
  const vertices: Vec2Dto[] = [];
  const uvs: Vec2Dto[] = [];
  const vertexStableIds: string[] = [];

  let produced = 0;
  for (let row = 0; row < rows && produced < vertexCount; row += 1) {
    for (let column = 0; column < columns && produced < vertexCount; column += 1) {
      const u = columns <= 1 ? 0 : column / (columns - 1);
      const v = rows <= 1 ? 0 : row / (rows - 1);
      vertices.push({
        x: bounds.x + bounds.width * u,
        y: bounds.y + bounds.height * v
      });
      uvs.push({ x: u, y: v });
      vertexStableIds.push(`vtx_${produced}`);
      produced += 1;
    }
  }

  return { vertices, uvs, vertexStableIds };
}

function createGridTriangles(
  vertexCount: number
): [number, number, number][] {
  const triangles: [number, number, number][] = [];
  // A simple fan over consecutive vertices. Topology fidelity is irrelevant for evaluation cost;
  // what matters is that the mesh has the requested vertex count.
  for (let index = 2; index < vertexCount; index += 1) {
    triangles.push([0, index - 1, index]);
  }

  return triangles;
}

function createSyntheticTexture(
  textureId: ReturnType<typeof TextureIdSchema.parse>,
  drawableIndex: number,
  relativePath: string
): NonNullable<AuthoringSession["graph"]["textureAtlas"]>["textures"][number] {
  return {
    textureId,
    filePath: relativePath,
    sourceAssetId: SOURCE_ASSET,
    sourceLayerId: `layer_synthetic_${drawableIndex}`,
    provenanceId: PROVENANCE,
    binaryAssetRef: {
      referenceKind: "package-binary-asset-ref-v1",
      binaryAssetId: `bin_synthetic_${drawableIndex}`,
      packageRelativePath: relativePath,
      digest: {
        algorithm: "sha256",
        hex: createDeterministicDigestHex(drawableIndex)
      },
      byteLength: RENDER_BYTES_LENGTH,
      mediaType: "application/octet-stream; pixelFormat=rgba8",
      storageStatus: "stored-package-local-v1",
      provenanceId: PROVENANCE,
      rightsAssetId: "rights_synthetic_heavy"
    }
  };
}

function createSyntheticDrawableOpacityKeyformSet(
  keyformIndex: number,
  drawableIds: readonly string[]
): AuthoringSession["graph"]["keyformSets"][number] {
  // Bind each keyform set to a distinct drawable's opacity so every set targets a real object and
  // is re-sampled on every evaluation (hypothesis B: full keyform re-sampling with no diffing).
  const targetDrawableId = drawableIds[keyformIndex % Math.max(1, drawableIds.length)] ?? drawableIds[0];

  return {
    keyformSetId: KeyformSetIdSchema.parse(`keyset_synthetic_${keyformIndex}`),
    target: {
      kind: "drawable",
      id: targetDrawableId ?? "draw_synthetic_0",
      property: "opacity"
    },
    parameterId: SYNTHETIC_HEAVY_MODEL_PARAMETER_ID,
    evaluator: "linear-1d-v1",
    interpolation: "linear-1d-v1",
    compositionMode: "replace",
    compositionOrder: 0,
    keys: [
      { value: -30, statePatch: 1 },
      { value: 30, statePatch: 0.5 }
    ]
  };
}

function createRestControlPoints(
  domainBounds: RectDto,
  columns: number,
  rows: number
): Vec2Dto[] {
  const points: Vec2Dto[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      points.push({
        x: domainBounds.x + domainBounds.width * (columns <= 1 ? 0 : column / (columns - 1)),
        y: domainBounds.y + domainBounds.height * (rows <= 1 ? 0 : row / (rows - 1))
      });
    }
  }

  return points;
}

function createDrawableMeshBounds(drawableIndex: number): RectDto {
  // Deterministic non-overlapping placement; the exact geometry is irrelevant to cost.
  const columnsPerRow = 8;
  const column = drawableIndex % columnsPerRow;
  const row = Math.floor(drawableIndex / columnsPerRow);

  return {
    x: column * 120,
    y: row * 120,
    width: 100,
    height: 100
  };
}

function createDeterministicRgbaBytes(drawableIndex: number): Uint8Array {
  const bytes = new Uint8Array(RENDER_BYTES_LENGTH);
  for (let index = 0; index < RENDER_BYTES_LENGTH; index += 1) {
    bytes[index] = (index + drawableIndex * 7) % 256;
  }

  return bytes;
}

function createDeterministicDigestHex(drawableIndex: number): string {
  const seed = `synthetic-${drawableIndex}`;
  let hex = "";
  for (let index = 0; index < 64; index += 1) {
    const code = (seed.charCodeAt(index % seed.length) + index) % 16;
    hex += code.toString(16);
  }

  return hex;
}

function clampInt(value: number, minimum: number): number {
  const rounded = Math.floor(value);
  return Number.isFinite(rounded) && rounded >= minimum ? rounded : minimum;
}
