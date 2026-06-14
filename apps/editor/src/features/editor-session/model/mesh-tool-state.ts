import {
  ProvenanceIdSchema,
  type DrawableId,
  type PartId,
  type ProvenanceId,
  type RectDto
} from "@private-2d-rigging-lab/contracts";
import {
  getPartOrderedChildren,
  type AuthoringSession,
  type GeneratedMeshPreviewCommitMethod,
  type MeshDensityHint
} from "@private-2d-rigging-lab/authoring-core";

export type MeshGenerationPresetId = "largeMotion" | "standard" | "lowMotion";

export interface MeshGenerationPreset {
  readonly id: MeshGenerationPresetId;
  readonly label: string;
  readonly densityHint: MeshDensityHint;
  readonly summary: string;
}

export interface MeshStatusProjection {
  readonly status: "pending" | "empty" | "generated";
  readonly label: string;
  readonly vertexCount: number;
  readonly triangleCount: number;
  readonly boundsSummary: string;
}

export interface MeshDrawableCandidate {
  readonly drawableId: DrawableId;
  readonly displayName: string;
  readonly meshStatus: MeshStatusProjection["label"];
  readonly visibilityLabel: string;
  readonly textureLabel: string;
}

export const MESH_GENERATION_PRESETS: readonly MeshGenerationPreset[] = [
  {
    id: "largeMotion",
    label: "Large Motion",
    densityHint: "high",
    summary: "Higher density for parts that need broad deformation."
  },
  {
    id: "standard",
    label: "Standard",
    densityHint: "medium",
    summary: "Balanced density for most drawable parts."
  },
  {
    id: "lowMotion",
    label: "Low Motion",
    densityHint: "low",
    summary: "Lower density for rigid or subtle-motion parts."
  }
];

export const DEFAULT_MESH_GENERATION_PRESET_ID: MeshGenerationPresetId = "standard";
export const DEFAULT_MESH_GENERATION_METHOD: GeneratedMeshPreviewCommitMethod =
  "auto-outline-v6d-adaptive-contour-constrainautor";

export const getMeshGenerationPreset = (
  presetId: MeshGenerationPresetId
): MeshGenerationPreset =>
  MESH_GENERATION_PRESETS.find((preset) => preset.id === presetId) ?? MESH_GENERATION_PRESETS[1]!;

export const createMeshPreviewProvenanceId = (
  drawableId: DrawableId,
  presetId: MeshGenerationPresetId,
  method: GeneratedMeshPreviewCommitMethod = DEFAULT_MESH_GENERATION_METHOD
): ProvenanceId =>
  ProvenanceIdSchema.parse(
    `prov_mesh_preview_${sanitizeIdToken(stripIdPrefix(drawableId, "draw_"))}_${presetId}${formatMethodProvenanceSuffix(method)}`
  );

export const createMeshStatusProjection = (
  session: AuthoringSession,
  drawableId: DrawableId
): MeshStatusProjection => {
  const drawable = session.graph.drawables.find((candidate) => candidate.drawableId === drawableId);
  const mesh =
    drawable === undefined
      ? undefined
      : session.graph.meshes.find((candidate) => candidate.meshId === drawable.meshId);

  if (mesh === undefined) {
    return {
      status: "pending",
      label: "Mesh pending",
      vertexCount: 0,
      triangleCount: 0,
      boundsSummary: "No mesh bounds"
    };
  }

  const vertexCount = mesh.vertices.length;
  const triangleCount = mesh.triangles.length;
  const status = vertexCount === 0 || triangleCount === 0 ? "empty" : "generated";

  return {
    status,
    label: status === "empty" ? "Empty scaffold" : "Generated mesh",
    vertexCount,
    triangleCount,
    boundsSummary: formatBounds(mesh.bounds)
  };
};

export const collectMeshDrawableCandidates = (
  session: AuthoringSession,
  partId: PartId,
  editorHiddenPartIds: ReadonlySet<PartId>
): readonly MeshDrawableCandidate[] => {
  const partsById = new Map(session.graph.parts.map((part) => [part.partId, part]));
  const drawablesById = new Map(
    session.graph.drawables.map((drawable) => [drawable.drawableId, drawable])
  );
  const result: MeshDrawableCandidate[] = [];

  const visitPart = (currentPartId: PartId, hiddenByAncestor: boolean) => {
    const part = partsById.get(currentPartId);
    if (part === undefined) {
      return;
    }

    const hiddenByPart = hiddenByAncestor || editorHiddenPartIds.has(currentPartId);
    for (const child of getPartOrderedChildren(session.graph, part)) {
      if (child.kind === "part") {
        visitPart(child.partId, hiddenByPart);
        continue;
      }

      const drawable = drawablesById.get(child.drawableId);
      if (drawable === undefined) {
        continue;
      }

      const meshStatus = createMeshStatusProjection(session, drawable.drawableId);
      result.push({
        drawableId: drawable.drawableId,
        displayName: drawable.displayName,
        meshStatus: meshStatus.label,
        visibilityLabel:
          hiddenByPart && drawable.runtimeVisibility
            ? "Hidden by container"
            : drawable.runtimeVisibility
              ? "Visible"
              : "Hidden drawable",
        textureLabel: session.graph.textureAtlas?.textures.some(
          (texture) => texture.textureId === drawable.textureId
        )
          ? "Texture linked"
          : "Texture pending"
      });
    }
  };

  visitPart(partId, false);
  return result;
};

export const parseMeshGenerationPresetId = (value: string): MeshGenerationPresetId =>
  MESH_GENERATION_PRESETS.some((preset) => preset.id === value)
    ? (value as MeshGenerationPresetId)
    : DEFAULT_MESH_GENERATION_PRESET_ID;

const formatBounds = (bounds: RectDto): string =>
  `${formatNumber(bounds.width)} x ${formatNumber(bounds.height)} at ${formatNumber(bounds.x)}, ${formatNumber(bounds.y)}`;

const formatNumber = (value: number): string =>
  Number.isInteger(value) ? String(value) : value.toFixed(2);

const stripIdPrefix = (id: string, prefix: string): string =>
  id.startsWith(prefix) ? id.slice(prefix.length) : id;

const formatMethodProvenanceSuffix = (method: GeneratedMeshPreviewCommitMethod): string =>
  method === DEFAULT_MESH_GENERATION_METHOD ? "" : `_${sanitizeIdToken(method)}`;

const sanitizeIdToken = (value: string): string => {
  const token = value.trim().replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  return token.length > 0 ? token : "unnamed";
};
