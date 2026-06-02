import type { RuntimeDiffDto } from "@private-2d-rigging-lab/contracts";
import {
  createMeshVertexRef,
  createTutorialSnapshotEvidenceSummary
} from "@private-2d-rigging-lab/runtime-core";
import type {
  EvaluatedDrawableDto,
  RuntimeDrawableMeshEditEvidenceDto,
  RuntimeMeshEditEvidenceDto,
  RuntimeSnapshotDto
} from "@private-2d-rigging-lab/runtime-core";

import { summarizePreviewDiagnostics } from "./diagnostics-summary.js";
import { summarizePreviewKeyformSamples } from "./keyform-sample-summary.js";
import type {
  EditorPreviewCanvasSizeDto,
  EditorPreviewDrawableDto,
  EditorPreviewDrawableGeometryDto,
  EditorPreviewDrawableLayerStateDto,
  EditorPreviewDrawableTextureDto,
  EditorPreviewPartDto,
  EditorPreviewProjectionDto
} from "./preview-dto.js";
import {
  createEditorPreviewDrawableLayerState,
  createEditorPreviewPartLayerState
} from "./preview-layer-state.js";
import type { EditorPreviewLayerStateInput } from "./preview-layer-state.js";
import { summarizePreviewRuntimeDiff } from "./runtime-diff-summary.js";

export interface ProjectEditorPreviewInput {
  readonly snapshot: RuntimeSnapshotDto;
  readonly runtimeDiff?: RuntimeDiffDto;
  readonly canvasSize?: EditorPreviewCanvasSizeDto;
  readonly drawableNames?: Readonly<Record<string, string>>;
  readonly editorState?: EditorPreviewLayerStateInput;
  readonly meshEditEvidence?: RuntimeMeshEditEvidenceDto;
}

export const projectEditorPreview = (input: ProjectEditorPreviewInput): EditorPreviewProjectionDto => {
  const meshEditEvidenceByDrawableId = createMeshEditEvidenceByDrawableId(input.meshEditEvidence);
  const drawables = orderPreviewDrawables(input.snapshot).map((drawable, index) =>
    projectDrawable({
      drawable,
      projectionOrder: index,
      drawListIndex: input.snapshot.drawList.indexOf(drawable.drawableId),
      keyformSampleCount: countDrawableKeyformSamples(input.snapshot, drawable),
      name: input.drawableNames?.[drawable.drawableId] ?? drawable.drawableId,
      editorState: input.editorState,
      meshEditEvidence: meshEditEvidenceByDrawableId.get(drawable.drawableId)
    })
  );
  const allDiagnostics = [
    ...input.snapshot.diagnostics,
    ...input.snapshot.dynamics.flatMap((dynamics) => dynamics.diagnostics),
    ...input.snapshot.drawables.flatMap((drawable) => drawable.diagnostics)
  ];

  return {
    schemaVersion: "editor-preview-projection-v1",
    sourceSnapshotId: input.snapshot.snapshotId,
    packageId: input.snapshot.packageId,
    packageRevision: input.snapshot.packageRevision,
    snapshotDetail: input.snapshot.evaluation.snapshotDetail,
    ...(input.canvasSize === undefined ? {} : { canvasSize: input.canvasSize }),
    drawList: [...input.snapshot.drawList],
    parts: projectParts(input.snapshot, input.editorState),
    drawableCount: input.snapshot.drawables.length,
    visibleDrawableCount: input.snapshot.drawables.filter((drawable) => drawable.visible).length,
    drawables,
    keyformSamples: summarizePreviewKeyformSamples(input.snapshot.keyformSamples),
    tutorialEvidenceSummary: createTutorialSnapshotEvidenceSummary({
      source: "preview",
      snapshot: input.snapshot,
      ...(input.runtimeDiff === undefined ? {} : { runtimeDiff: input.runtimeDiff }),
      ...(input.meshEditEvidence === undefined ? {} : { meshEditEvidence: input.meshEditEvidence })
    }),
    diagnostics: summarizePreviewDiagnostics(allDiagnostics),
    ...(input.runtimeDiff === undefined ? {} : { diff: summarizePreviewRuntimeDiff(input.runtimeDiff) })
  };
};

const projectDrawable = (input: {
  readonly drawable: EvaluatedDrawableDto;
  readonly projectionOrder: number;
  readonly drawListIndex: number;
  readonly keyformSampleCount: number;
  readonly name: string;
  readonly editorState: EditorPreviewLayerStateInput | undefined;
  readonly meshEditEvidence: RuntimeDrawableMeshEditEvidenceDto | undefined;
}): EditorPreviewDrawableDto => {
  const texture = projectDrawableTexture(input.drawable);
  const layerState = createEditorPreviewDrawableLayerState({
    drawableId: input.drawable.drawableId,
    runtimeVisible: input.drawable.visible,
    texture,
    editorState: input.editorState
  });

  return {
    drawableId: input.drawable.drawableId,
    name: input.name,
    meshId: input.drawable.meshId,
    ...(input.drawable.partId === undefined ? {} : { partId: input.drawable.partId }),
    visible: input.drawable.visible,
    opacity: input.drawable.opacity,
    baseDrawOrder: input.drawable.baseDrawOrder,
    evaluatedDrawOrder: input.drawable.evaluatedDrawOrder,
    projectionOrder: input.projectionOrder,
    ...(input.drawListIndex < 0 ? {} : { drawListIndex: input.drawListIndex }),
    bounds: { ...input.drawable.bounds },
    geometry: projectDrawableGeometry({
      drawable: input.drawable,
      layerState,
      editorState: input.editorState,
      meshEditEvidence: input.meshEditEvidence
    }),
    texture,
    layerState,
    keyformSampleCount: input.keyformSampleCount,
    diagnostics: summarizePreviewDiagnostics(input.drawable.diagnostics)
  };
};

const projectDrawableGeometry = (input: {
  readonly drawable: EvaluatedDrawableDto;
  readonly layerState: EditorPreviewDrawableLayerStateDto;
  readonly editorState: EditorPreviewLayerStateInput | undefined;
  readonly meshEditEvidence: RuntimeDrawableMeshEditEvidenceDto | undefined;
}): EditorPreviewDrawableGeometryDto => {
  const movedVertexRefs = input.meshEditEvidence?.movedVertexRefs.map((vertex) => vertex.vertexRef).sort(compareStrings) ?? [];
  const movedVertexRefSet = new Set(movedVertexRefs);

  return {
    vertexCount: input.drawable.vertexCount,
    vertexHash: input.drawable.vertexHash,
    ...(input.drawable.mesh === undefined ? {} : { topology: input.drawable.mesh.topology }),
    ...(input.drawable.vertices === undefined
      ? {}
      : { polygonPoints: input.drawable.vertices.map((point) => ({ x: point.x, y: point.y })) }),
    ...(input.drawable.mesh?.vertices === undefined
      ? {}
      : {
          vertices: input.drawable.mesh.vertices.map((vertex) => {
            const vertexRef = createMeshVertexRef(input.drawable.meshId, vertex.vertexIndex, vertex.vertexStableId);
            const moved = movedVertexRefSet.has(vertexRef);
            return {
              vertexIndex: vertex.vertexIndex,
              ...(vertex.vertexStableId === undefined ? {} : { vertexStableId: vertex.vertexStableId }),
              vertexRef,
              position: { x: vertex.position.x, y: vertex.position.y },
              state: {
                selected: isSelectedMeshVertex(input.editorState?.selection, input.drawable.meshId, vertex.vertexIndex, vertex.vertexStableId),
                moved,
                locked: input.layerState.locked,
                editorHidden: input.layerState.editorHidden,
                runtimeVisible: input.layerState.runtimeVisible,
                runtimeHidden: !input.layerState.runtimeVisible,
                textureBacked: input.layerState.textureBacked
              }
            };
          })
        }),
    ...(movedVertexRefs.length === 0 ? {} : { movedVertexRefs })
  };
};

const projectParts = (
  snapshot: RuntimeSnapshotDto,
  editorState: EditorPreviewLayerStateInput | undefined
): readonly EditorPreviewPartDto[] =>
  (snapshot.parts ?? []).map((part) => ({
    partId: part.partId,
    displayName: part.displayName,
    ...(part.parentPartId === undefined ? {} : { parentPartId: part.parentPartId }),
    childPartIds: [...part.childPartIds],
    drawableIds: [...part.drawableIds],
    hierarchyPath: [...part.hierarchyPath],
    depth: part.depth,
    layerState: createEditorPreviewPartLayerState(part.partId, editorState)
  }));

const projectDrawableTexture = (drawable: EvaluatedDrawableDto): EditorPreviewDrawableTextureDto => {
  if (drawable.texture === undefined) {
    return {
      status: "not_materialized",
      projection: { kind: "bounds_fit" }
    };
  }

  return {
    status: drawable.texture.status,
    ...(drawable.texture.textureId === undefined ? {} : { textureId: drawable.texture.textureId }),
    ...(drawable.texture.sourceAssetId === undefined ? {} : { sourceAssetId: drawable.texture.sourceAssetId }),
    ...(drawable.texture.sourceLayerId === undefined ? {} : { sourceLayerId: drawable.texture.sourceLayerId }),
    projection:
      drawable.texture.projection.kind === "uv"
        ? {
            kind: "uv",
            uvCount: drawable.texture.projection.uvCount,
            ...(drawable.texture.projection.uvs === undefined
              ? {}
              : {
                  uvs: drawable.texture.projection.uvs.map((uv) => ({ x: uv.x, y: uv.y }))
                })
          }
        : { kind: "bounds_fit" }
  };
};

const orderPreviewDrawables = (snapshot: RuntimeSnapshotDto): readonly EvaluatedDrawableDto[] => {
  const drawablesById = new Map(snapshot.drawables.map((drawable) => [drawable.drawableId, drawable]));
  const orderedVisibleDrawables = snapshot.drawList.flatMap((drawableId) => {
    const drawable = drawablesById.get(drawableId);
    return drawable === undefined ? [] : [drawable];
  });
  const orderedVisibleIds = new Set(orderedVisibleDrawables.map((drawable) => drawable.drawableId));
  const remainingDrawables = snapshot.drawables
    .filter((drawable) => !orderedVisibleIds.has(drawable.drawableId))
    .sort(compareDrawablesByRuntimeOrder);

  return [...orderedVisibleDrawables, ...remainingDrawables];
};

const compareDrawablesByRuntimeOrder = (left: EvaluatedDrawableDto, right: EvaluatedDrawableDto): number =>
  left.evaluatedDrawOrder - right.evaluatedDrawOrder ||
  left.baseDrawOrder - right.baseDrawOrder ||
  left.drawableId.localeCompare(right.drawableId);

const countDrawableKeyformSamples = (snapshot: RuntimeSnapshotDto, drawable: EvaluatedDrawableDto): number =>
  snapshot.keyformSamples.filter((sample) => sample.target === drawable.drawableId || sample.target === drawable.meshId).length;

const createMeshEditEvidenceByDrawableId = (
  evidence: RuntimeMeshEditEvidenceDto | undefined
): ReadonlyMap<string, RuntimeDrawableMeshEditEvidenceDto> =>
  new Map((evidence?.drawables ?? []).map((drawable) => [drawable.drawableId, drawable]));

const isSelectedMeshVertex = (
  selection: readonly string[] | undefined,
  meshId: string,
  vertexIndex: number,
  vertexStableId: string | undefined
): boolean => {
  if (selection === undefined) {
    return false;
  }

  const acceptedRefs = [
    createMeshVertexRef(meshId, vertexIndex, vertexStableId),
    `${meshId}:vertex:${vertexIndex}`,
    `${meshId}.vertex.${vertexIndex}`,
    ...(vertexStableId === undefined ? [] : [vertexStableId, `${meshId}:${vertexStableId}`])
  ];
  return acceptedRefs.some((ref) => selection.includes(ref));
};

const compareStrings = (left: string, right: string): number => left.localeCompare(right);
