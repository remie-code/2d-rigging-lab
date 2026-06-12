import type { RigControlDto } from "./model-files.js";
import {
  WARP_DEFORMER_BEZIER_EVALUATION_BOUNDARY,
  WARP_DEFORMER_RUNTIME_EVALUATION,
  WARP_DEFORMER_STORAGE_KIND,
  WARP_DEFORMER_TRANSFORM_POINT_SEMANTICS,
  WARP_DEFORMER_USER_FACING_KIND,
  createDefaultWarpDeformerBezierEditSurface
} from "./warp-deformer-contract.js";
import type {
  WarpDeformerBezierEditSurfaceDto,
  WarpDeformerTransformGridDto
} from "./warp-deformer-contract.js";

export type WarpDeformerStorageRigControlDto = Extract<RigControlDto, { readonly kind: "warpLattice2d" }>;

export interface WarpDeformerReadProjectionDto {
  readonly kind: typeof WARP_DEFORMER_USER_FACING_KIND;
  readonly storageKind: typeof WARP_DEFORMER_STORAGE_KIND;
  readonly rigControlId: string;
  readonly displayName: string;
  readonly partId: string;
  readonly parentRigControlId?: string;
  readonly childDrawableIds: readonly string[];
  readonly childRigControlIds: readonly string[];
  readonly opacityMultiplier: number;
  readonly domainBounds: WarpDeformerStorageRigControlDto["domainBounds"];
  readonly transformGrid: WarpDeformerTransformGridDto;
  readonly bezierEditSurface: WarpDeformerBezierEditSurfaceDto;
  readonly bezierSurfaceStatus: "stored" | "legacyDefaulted";
  readonly evaluationBoundary: {
    readonly transformEvaluation: typeof WARP_DEFORMER_RUNTIME_EVALUATION;
    readonly bezierEvaluation: typeof WARP_DEFORMER_BEZIER_EVALUATION_BOUNDARY;
  };
}

export const isWarpDeformerStorageRigControl = (
  rigControl: RigControlDto
): rigControl is WarpDeformerStorageRigControlDto =>
  rigControl.kind === "warpLattice2d";

export const projectWarpDeformerReadModel = (
  rigControl: WarpDeformerStorageRigControlDto
): WarpDeformerReadProjectionDto => {
  const storedMetadata = rigControl.warpDeformer;
  const transformGrid = storedMetadata?.transformGrid ?? {
    columns: rigControl.latticeColumns,
    rows: rigControl.latticeRows,
    pointCountSemantics: WARP_DEFORMER_TRANSFORM_POINT_SEMANTICS
  };
  const bezierEditSurface =
    storedMetadata?.bezierEditSurface ??
    createDefaultWarpDeformerBezierEditSurface({
      domainBounds: rigControl.domainBounds,
      columns: rigControl.latticeColumns,
      rows: rigControl.latticeRows
    });

  return {
    kind: WARP_DEFORMER_USER_FACING_KIND,
    storageKind: WARP_DEFORMER_STORAGE_KIND,
    rigControlId: rigControl.rigControlId,
    displayName: rigControl.displayName,
    partId: rigControl.partId,
    ...(rigControl.parentId === undefined ? {} : { parentRigControlId: rigControl.parentId }),
    childDrawableIds: [...rigControl.childDrawableIds],
    childRigControlIds: [...rigControl.childRigControlIds],
    opacityMultiplier: rigControl.opacityMultiplier ?? 1,
    domainBounds: structuredClone(rigControl.domainBounds),
    transformGrid: structuredClone(transformGrid),
    bezierEditSurface: structuredClone(bezierEditSurface),
    bezierSurfaceStatus: storedMetadata === undefined ? "legacyDefaulted" : "stored",
    evaluationBoundary: {
      transformEvaluation: WARP_DEFORMER_RUNTIME_EVALUATION,
      bezierEvaluation: WARP_DEFORMER_BEZIER_EVALUATION_BOUNDARY
    }
  };
};
