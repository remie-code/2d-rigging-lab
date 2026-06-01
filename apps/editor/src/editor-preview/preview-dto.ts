import type {
  CheckStatus,
  DiagnosticDto,
  DrawableId,
  MeshId,
  PackageId,
  PartId,
  RectDto,
  RuntimeSnapshotId,
  Severity,
  SourceAssetId,
  TextureId,
  Vec2Dto
} from "@private-2d-rigging-lab/contracts";
import type {
  EvaluatedMeshTopologySummaryDto,
  RuntimeSnapshotDto
} from "@private-2d-rigging-lab/runtime-core";

export interface EditorPreviewCanvasSizeDto {
  readonly width: number;
  readonly height: number;
}

export interface EditorPreviewProjectionDto {
  readonly schemaVersion: "editor-preview-projection-v1";
  readonly sourceSnapshotId: RuntimeSnapshotId;
  readonly packageId: PackageId;
  readonly packageRevision: number;
  readonly snapshotDetail: RuntimeSnapshotDto["evaluation"]["snapshotDetail"];
  readonly canvasSize?: EditorPreviewCanvasSizeDto;
  readonly drawList: readonly DrawableId[];
  readonly parts?: readonly EditorPreviewPartDto[];
  readonly drawableCount: number;
  readonly visibleDrawableCount: number;
  readonly drawables: readonly EditorPreviewDrawableDto[];
  readonly keyformSamples: EditorPreviewKeyformSampleSummaryDto;
  readonly diagnostics: EditorPreviewDiagnosticsSummaryDto;
  readonly diff?: EditorPreviewRuntimeDiffSummaryDto;
}

export interface EditorPreviewPartDto {
  readonly partId: PartId;
  readonly displayName: string;
  readonly parentPartId?: PartId;
  readonly childPartIds: readonly PartId[];
  readonly drawableIds: readonly DrawableId[];
  readonly hierarchyPath: readonly PartId[];
  readonly depth: number;
  readonly layerState?: EditorPreviewPartLayerStateDto;
}

export interface EditorPreviewPartLayerStateDto {
  readonly editorHidden: boolean;
  readonly locked: boolean;
  readonly selected: boolean;
}

export interface EditorPreviewDrawableDto {
  readonly drawableId: DrawableId;
  readonly name: string;
  readonly meshId: MeshId;
  readonly partId?: PartId;
  readonly visible: boolean;
  readonly opacity: number;
  readonly baseDrawOrder: number;
  readonly evaluatedDrawOrder: number;
  readonly projectionOrder: number;
  readonly drawListIndex?: number;
  readonly bounds: RectDto;
  readonly geometry: EditorPreviewDrawableGeometryDto;
  readonly texture: EditorPreviewDrawableTextureDto;
  readonly layerState?: EditorPreviewDrawableLayerStateDto;
  readonly keyformSampleCount: number;
  readonly diagnostics: EditorPreviewDiagnosticsSummaryDto;
}

export interface EditorPreviewDrawableLayerStateDto {
  readonly runtimeVisible: boolean;
  readonly editorHidden: boolean;
  readonly locked: boolean;
  readonly selected: boolean;
  readonly textureStatus: EditorPreviewDrawableTextureDto["status"];
  readonly textureBacked: boolean;
  readonly textureUnresolved: boolean;
}

export interface EditorPreviewDrawableGeometryDto {
  readonly vertexCount: number;
  readonly vertexHash: string;
  readonly topology?: EvaluatedMeshTopologySummaryDto;
  readonly polygonPoints?: readonly Vec2Dto[];
  readonly vertices?: readonly EditorPreviewMeshVertexDto[];
  readonly movedVertexRefs?: readonly string[];
}

export interface EditorPreviewMeshVertexDto {
  readonly vertexIndex: number;
  readonly vertexStableId?: string;
  readonly vertexRef: string;
  readonly position: Vec2Dto;
  readonly state: EditorPreviewMeshVertexStateDto;
}

export interface EditorPreviewMeshVertexStateDto {
  readonly selected: boolean;
  readonly moved: boolean;
  readonly locked: boolean;
  readonly editorHidden: boolean;
  readonly runtimeVisible: boolean;
  readonly runtimeHidden: boolean;
  readonly textureBacked: boolean;
}

export interface EditorPreviewDrawableTextureDto {
  readonly status: "resolved" | "missing" | "not_materialized";
  readonly textureId?: TextureId;
  readonly sourceAssetId?: SourceAssetId;
  readonly sourceLayerId?: string;
  readonly projection: EditorPreviewDrawableTextureProjectionDto;
  readonly previewReference?: EditorPreviewDrawableTexturePreviewReferenceDto;
}

export interface EditorPreviewDrawableTexturePreviewReferenceDto {
  readonly previewAssetId: string;
  readonly referenceKind: "package-local-file-v1" | "deterministic-data-url-v1";
  readonly href: string;
}

export type EditorPreviewDrawableTextureProjectionDto =
  | {
      readonly kind: "bounds_fit";
    }
  | {
      readonly kind: "uv";
      readonly uvCount: number;
      readonly uvs?: readonly Vec2Dto[];
    };

export interface EditorPreviewKeyformSampleSummaryDto {
  readonly totalCount: number;
  readonly byEvaluator: readonly EditorPreviewKeyformEvaluatorSummaryDto[];
  readonly byTarget: readonly EditorPreviewKeyformTargetSummaryDto[];
}

export interface EditorPreviewKeyformEvaluatorSummaryDto {
  readonly evaluator: RuntimeSnapshotDto["keyformSamples"][number]["evaluator"];
  readonly count: number;
}

export interface EditorPreviewKeyformTargetSummaryDto {
  readonly target: string;
  readonly count: number;
  readonly evaluators: readonly RuntimeSnapshotDto["keyformSamples"][number]["evaluator"][];
}

export interface EditorPreviewDiagnosticsSummaryDto {
  readonly totalCount: number;
  readonly bySeverity: Readonly<Record<Severity, number>>;
  readonly byStatus: Readonly<Record<CheckStatus, number>>;
  readonly blockingCount: number;
  readonly errorCount: number;
  readonly warningCount: number;
  readonly items: readonly EditorPreviewDiagnosticItemDto[];
}

export interface EditorPreviewDiagnosticItemDto {
  readonly checkId: DiagnosticDto["checkId"];
  readonly severity: DiagnosticDto["severity"];
  readonly status: DiagnosticDto["status"];
  readonly phase: string;
  readonly target: DiagnosticDto["target"];
  readonly message: string;
}

export interface EditorPreviewRuntimeDiffSummaryDto {
  readonly beforeSnapshotId: RuntimeSnapshotId;
  readonly afterSnapshotId: RuntimeSnapshotId;
  readonly parameterChangeCount: number;
  readonly partChangeCount?: number;
  readonly drawableTextureChangeCount?: number;
  readonly dynamicsChangeCount: number;
  readonly drawableGeometryChangeCount: number;
  readonly drawableRuntimeStateChangeCount: number;
  readonly drawListChangeCount: number;
  readonly diagnosticDeltaCount: number;
  readonly affectedDrawableIds: readonly DrawableId[];
  readonly affectedPartIds?: readonly PartId[];
}
