import type { RigControlDto } from "@private-2d-rigging-lab/package-format";

export interface RigControlState {
  readonly rigControlId: string;
  readonly displayName: string;
  readonly kind: RigControlDto["kind"];
  readonly partId: string;
  readonly parentId: string | null;
  readonly enabled: boolean;
  readonly childDrawableIds: readonly string[];
  readonly childRigControlIds: readonly string[];
  readonly pivot: { readonly x: number; readonly y: number } | null;
  readonly restAngleDegrees: number | null;
}

export const projectRigControlState = (
  rigControls: readonly RigControlDto[]
): readonly RigControlState[] =>
  rigControls.map((rigControl) => ({
    rigControlId: rigControl.rigControlId,
    displayName: rigControl.displayName,
    kind: rigControl.kind,
    partId: rigControl.partId,
    parentId: rigControl.parentId ?? null,
    enabled: rigControl.enabled,
    childDrawableIds: [...rigControl.childDrawableIds],
    childRigControlIds: [...rigControl.childRigControlIds],
    pivot: rigControl.kind === "rotation2d" ? { ...rigControl.pivot } : null,
    restAngleDegrees: rigControl.kind === "rotation2d" ? rigControl.restAngleDegrees : null
  }));
