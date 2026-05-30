import type {
  CheckStatus,
  DiagnosticDto,
  DrawableId,
  MeshId,
  PackageId,
  RectDto,
  RuntimeSnapshotId,
  Severity,
  Vec2Dto
} from "@private-2d-rigging-lab/contracts";
import type { RuntimeSnapshotDto } from "@private-2d-rigging-lab/runtime-core";

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
  readonly drawableCount: number;
  readonly visibleDrawableCount: number;
  readonly drawables: readonly EditorPreviewDrawableDto[];
  readonly keyformSamples: EditorPreviewKeyformSampleSummaryDto;
  readonly diagnostics: EditorPreviewDiagnosticsSummaryDto;
  readonly diff?: EditorPreviewRuntimeDiffSummaryDto;
}

export interface EditorPreviewDrawableDto {
  readonly drawableId: DrawableId;
  readonly name: string;
  readonly meshId: MeshId;
  readonly visible: boolean;
  readonly opacity: number;
  readonly baseDrawOrder: number;
  readonly evaluatedDrawOrder: number;
  readonly projectionOrder: number;
  readonly drawListIndex?: number;
  readonly bounds: RectDto;
  readonly geometry: EditorPreviewDrawableGeometryDto;
  readonly keyformSampleCount: number;
  readonly diagnostics: EditorPreviewDiagnosticsSummaryDto;
}

export interface EditorPreviewDrawableGeometryDto {
  readonly vertexCount: number;
  readonly vertexHash: string;
  readonly polygonPoints?: readonly Vec2Dto[];
}

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
  readonly dynamicsChangeCount: number;
  readonly drawableGeometryChangeCount: number;
  readonly drawableRuntimeStateChangeCount: number;
  readonly drawListChangeCount: number;
  readonly diagnosticDeltaCount: number;
  readonly affectedDrawableIds: readonly DrawableId[];
}
