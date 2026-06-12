import {
  getPartOrderedChildren,
  type AuthoringSession
} from "@private-2d-rigging-lab/authoring-core";
import type {
  DrawableId,
  PartId,
  RectDto,
  RigControlId
} from "@private-2d-rigging-lab/contracts";
import type { CreateWarpDeformerPayloadDto } from "@private-2d-rigging-lab/operation-core";

import type { EditorSelection } from "./editor-selection";

export const DEFAULT_WARP_DEFORMER_TRANSFORM_COLUMNS = 5;
export const DEFAULT_WARP_DEFORMER_TRANSFORM_ROWS = 5;
export const DEFAULT_WARP_DEFORMER_BEZIER_COLUMNS = 3;
export const DEFAULT_WARP_DEFORMER_BEZIER_ROWS = 3;
export const WARP_DEFORMER_BEZIER_EDIT_TYPE = "cubicBezierSurfaceV1" as const;

type RigControlDto = AuthoringSession["graph"]["rigControls"][number];
type WarpLatticeRigControlDto = Extract<RigControlDto, { readonly kind: "warpLattice2d" }>;
type MeshDto = AuthoringSession["graph"]["meshes"][number];

export interface WarpDeformerDraft {
  readonly displayName: string;
  readonly partId: PartId;
  readonly parentRigControlId?: RigControlId | undefined;
  readonly childDrawableIds: readonly DrawableId[];
  readonly childRigControlIds: readonly RigControlId[];
  readonly domainBounds: RectDto;
  readonly transformColumns: number;
  readonly transformRows: number;
  readonly bezierColumns: number;
  readonly bezierRows: number;
  readonly bezierEditType: typeof WARP_DEFORMER_BEZIER_EDIT_TYPE;
}

export interface WarpDeformerTargetOption {
  readonly drawableId: DrawableId;
  readonly displayName: string;
  readonly partId: PartId;
  readonly partDisplayName: string;
  readonly bounds: RectDto;
}

export interface WarpDeformerReadModel {
  readonly kind: "warpDeformer";
  readonly storageKind: "warpLattice2d";
  readonly rigControlId: RigControlId;
  readonly displayName: string;
  readonly partId: PartId;
  readonly parentRigControlId?: RigControlId;
  readonly childDrawableIds: readonly DrawableId[];
  readonly childRigControlIds: readonly RigControlId[];
  readonly domainBounds: RectDto;
  readonly transformGrid: {
    readonly columns: number;
    readonly rows: number;
    readonly pointCountSemantics: "controlPointCount";
  };
  readonly bezierEditSurface: {
    readonly columns: number;
    readonly rows: number;
    readonly editType: typeof WARP_DEFORMER_BEZIER_EDIT_TYPE;
  };
  readonly bezierSurfaceStatus: "stored" | "legacyDefaulted";
  readonly evaluationBoundary: {
    readonly transformEvaluation: "bilinearGridV1";
    readonly bezierEvaluation: "storedNotEvaluatedV0";
  };
}

export type DeformerTreeRow =
  | {
      readonly kind: "warpDeformer";
      readonly rigControlId: RigControlId;
      readonly depth: number;
      readonly displayName: string;
      readonly detail: string;
      readonly selected: boolean;
      readonly parentRigControlId?: RigControlId;
      readonly childDrawableCount: number;
      readonly childRigControlCount: number;
      readonly transformLabel: string;
      readonly bezierLabel: string;
      readonly legacyDefaulted: boolean;
    }
  | {
      readonly kind: "drawableRef";
      readonly drawableId: DrawableId;
      readonly parentRigControlId: RigControlId;
      readonly depth: number;
      readonly displayName: string;
      readonly detail: string;
      readonly selected: boolean;
    };

export function createWarpDeformerDraftForDrawable(
  session: AuthoringSession,
  drawableId: DrawableId
): WarpDeformerDraft | undefined {
  const drawable = findDrawable(session, drawableId);
  if (drawable === undefined) {
    return undefined;
  }

  return {
    displayName: `${drawable.displayName} Warp Deformer`,
    partId: drawable.partId,
    childDrawableIds: [drawable.drawableId],
    childRigControlIds: [],
    domainBounds: resolveDrawableBounds(session, drawable.drawableId),
    transformColumns: DEFAULT_WARP_DEFORMER_TRANSFORM_COLUMNS,
    transformRows: DEFAULT_WARP_DEFORMER_TRANSFORM_ROWS,
    bezierColumns: DEFAULT_WARP_DEFORMER_BEZIER_COLUMNS,
    bezierRows: DEFAULT_WARP_DEFORMER_BEZIER_ROWS,
    bezierEditType: WARP_DEFORMER_BEZIER_EDIT_TYPE
  };
}

export function createWarpDeformerTargetOptions(
  session: AuthoringSession,
  selection: EditorSelection | null
): readonly WarpDeformerTargetOption[] {
  if (selection?.kind === "drawable") {
    const option = createWarpDeformerTargetOption(session, selection.id);
    return option === undefined ? [] : [option];
  }

  if (selection?.kind !== "part") {
    return [];
  }

  const result: WarpDeformerTargetOption[] = [];
  const partsById = new Map(session.graph.parts.map((part) => [part.partId, part]));
  const visitPart = (partId: PartId) => {
    const part = partsById.get(partId);
    if (part === undefined) {
      return;
    }

    for (const child of getPartOrderedChildren(session.graph, part)) {
      if (child.kind === "drawable") {
        const option = createWarpDeformerTargetOption(session, child.drawableId);
        if (option !== undefined) {
          result.push(option);
        }
        continue;
      }

      visitPart(child.partId);
    }
  };

  visitPart(selection.id);
  return result;
}

export function updateWarpDeformerDraft(
  draft: WarpDeformerDraft,
  patch: Partial<WarpDeformerDraft>
): WarpDeformerDraft {
  return normalizeWarpDeformerDraft({
    ...draft,
    ...patch,
    domainBounds: patch.domainBounds ?? draft.domainBounds,
    childDrawableIds: patch.childDrawableIds ?? draft.childDrawableIds,
    childRigControlIds: patch.childRigControlIds ?? draft.childRigControlIds
  });
}

export function fitWarpDeformerDraftToChildren(
  session: AuthoringSession,
  draft: WarpDeformerDraft
): WarpDeformerDraft {
  return updateWarpDeformerDraft(draft, {
    domainBounds: resolveChildBounds(session, draft) ?? draft.domainBounds
  });
}

export function resetWarpDeformerDraft(
  session: AuthoringSession,
  draft: WarpDeformerDraft
): WarpDeformerDraft {
  return normalizeWarpDeformerDraft({
    ...draft,
    domainBounds: resolveChildBounds(session, draft) ?? draft.domainBounds,
    transformColumns: DEFAULT_WARP_DEFORMER_TRANSFORM_COLUMNS,
    transformRows: DEFAULT_WARP_DEFORMER_TRANSFORM_ROWS,
    bezierColumns: DEFAULT_WARP_DEFORMER_BEZIER_COLUMNS,
    bezierRows: DEFAULT_WARP_DEFORMER_BEZIER_ROWS,
    bezierEditType: WARP_DEFORMER_BEZIER_EDIT_TYPE
  });
}

export function createWarpDeformerPayloadFromDraft(
  draft: WarpDeformerDraft
): CreateWarpDeformerPayloadDto {
  const normalized = normalizeWarpDeformerDraft(draft);

  return {
    partId: normalized.partId,
    displayName: normalized.displayName,
    ...(normalized.parentRigControlId === undefined
      ? {}
      : { parentRigControlId: normalized.parentRigControlId }),
    childDrawableIds: [...normalized.childDrawableIds],
    childRigControlIds: [...normalized.childRigControlIds],
    domainBounds: structuredClone(normalized.domainBounds),
    transformColumns: normalized.transformColumns,
    transformRows: normalized.transformRows,
    bezierColumns: normalized.bezierColumns,
    bezierRows: normalized.bezierRows,
    bezierEditType: normalized.bezierEditType
  };
}

export function createDeformerTreeRows(
  session: AuthoringSession,
  selection: EditorSelection | null
): readonly DeformerTreeRow[] {
  const readModels = createWarpDeformerReadModels(session);
  const readModelsById = new Map(readModels.map((readModel) => [readModel.rigControlId, readModel]));
  const drawableLabels = new Map(
    session.graph.drawables.map((drawable) => [drawable.drawableId, drawable.displayName])
  );
  const rootIds = resolveDeformerRootIds(session, readModels);
  const visited = new Set<string>();
  const rows: DeformerTreeRow[] = [];

  const appendDeformer = (rigControlId: RigControlId, depth: number) => {
    const readModel = readModelsById.get(rigControlId);
    if (readModel === undefined || visited.has(rigControlId)) {
      return;
    }

    visited.add(rigControlId);
    rows.push({
      kind: "warpDeformer",
      rigControlId,
      depth,
      displayName: readModel.displayName,
      detail: readModel.bezierSurfaceStatus === "stored" ? "Warp Deformer" : "Legacy warp lattice",
      selected: selection?.kind === "rigControl" && selection.id === rigControlId,
      ...(readModel.parentRigControlId === undefined
        ? {}
        : { parentRigControlId: readModel.parentRigControlId }),
      childDrawableCount: readModel.childDrawableIds.length,
      childRigControlCount: readModel.childRigControlIds.filter((childId) =>
        readModelsById.has(childId)
      ).length,
      transformLabel: formatControlPointGrid(
        readModel.transformGrid.columns,
        readModel.transformGrid.rows
      ),
      bezierLabel: formatControlPointGrid(
        readModel.bezierEditSurface.columns,
        readModel.bezierEditSurface.rows
      ),
      legacyDefaulted: readModel.bezierSurfaceStatus === "legacyDefaulted"
    });

    for (const childRigControlId of readModel.childRigControlIds) {
      appendDeformer(childRigControlId, depth + 1);
    }

    for (const childDrawableId of readModel.childDrawableIds) {
      rows.push({
        kind: "drawableRef",
        drawableId: childDrawableId,
        parentRigControlId: rigControlId,
        depth: depth + 1,
        displayName: drawableLabels.get(childDrawableId) ?? childDrawableId,
        detail: "Bound Drawable reference",
        selected: selection?.kind === "drawable" && selection.id === childDrawableId
      });
    }
  };

  for (const rootId of rootIds) {
    appendDeformer(rootId, 0);
  }

  for (const readModel of readModels) {
    appendDeformer(readModel.rigControlId, 0);
  }

  return rows;
}

export function createWarpDeformerReadModels(
  session: AuthoringSession
): readonly WarpDeformerReadModel[] {
  return session.graph.rigControls
    .filter(isWarpLatticeRigControl)
    .map(projectEditorWarpDeformerReadModel)
    .sort((left, right) => left.displayName.localeCompare(right.displayName));
}

export function findWarpDeformerReadModel(
  session: AuthoringSession,
  rigControlId: RigControlId
): WarpDeformerReadModel | undefined {
  const rigControl = session.graph.rigControls.find(
    (candidate) => candidate.rigControlId === rigControlId
  );

  return rigControl !== undefined && isWarpLatticeRigControl(rigControl)
    ? projectEditorWarpDeformerReadModel(rigControl)
    : undefined;
}

export function createWarpDeformerParentOptions(
  session: AuthoringSession
): readonly Pick<WarpDeformerReadModel, "rigControlId" | "displayName">[] {
  return createWarpDeformerReadModels(session).map((readModel) => ({
    rigControlId: readModel.rigControlId,
    displayName: readModel.displayName
  }));
}

export function summarizeWarpDeformerChildren(
  session: AuthoringSession,
  childDrawableIds: readonly DrawableId[],
  childRigControlIds: readonly RigControlId[]
): string {
  const drawableNames = childDrawableIds
    .map((drawableId) => findDrawable(session, drawableId)?.displayName ?? drawableId)
    .sort();
  const rigNames = childRigControlIds
    .map((rigControlId) =>
      session.graph.rigControls.find((rigControl) => rigControl.rigControlId === rigControlId)
        ?.displayName ?? rigControlId
    )
    .sort();
  const names = [...drawableNames, ...rigNames];

  if (names.length === 0) {
    return "No bound children";
  }

  if (names.length <= 3) {
    return names.join(", ");
  }

  return `${names.slice(0, 3).join(", ")} +${names.length - 3}`;
}

export function formatRectSummary(rect: RectDto): string {
  return `${formatNumber(rect.x)}, ${formatNumber(rect.y)} / ${formatNumber(rect.width)} x ${formatNumber(rect.height)}`;
}

export function formatControlPointGrid(columns: number, rows: number): string {
  return `${columns} x ${rows} control points`;
}

function projectEditorWarpDeformerReadModel(
  rigControl: WarpLatticeRigControlDto
): WarpDeformerReadModel {
  const metadata = rigControl.warpDeformer;
  const transformGrid = metadata?.transformGrid ?? {
    columns: rigControl.latticeColumns,
    rows: rigControl.latticeRows,
    pointCountSemantics: "controlPointCount" as const
  };
  const bezierEditSurface = metadata?.bezierEditSurface ?? {
    columns: rigControl.latticeColumns,
    rows: rigControl.latticeRows,
    editType: WARP_DEFORMER_BEZIER_EDIT_TYPE
  };

  return {
    kind: "warpDeformer",
    storageKind: "warpLattice2d",
    rigControlId: rigControl.rigControlId,
    displayName: rigControl.displayName,
    partId: rigControl.partId,
    ...(rigControl.parentId === undefined ? {} : { parentRigControlId: rigControl.parentId }),
    childDrawableIds: [...rigControl.childDrawableIds],
    childRigControlIds: [...rigControl.childRigControlIds],
    domainBounds: structuredClone(rigControl.domainBounds),
    transformGrid: structuredClone(transformGrid),
    bezierEditSurface: {
      columns: bezierEditSurface.columns,
      rows: bezierEditSurface.rows,
      editType: bezierEditSurface.editType
    },
    bezierSurfaceStatus: metadata === undefined ? "legacyDefaulted" : "stored",
    evaluationBoundary: {
      transformEvaluation: "bilinearGridV1",
      bezierEvaluation: "storedNotEvaluatedV0"
    }
  };
}

function resolveDeformerRootIds(
  session: AuthoringSession,
  readModels: readonly WarpDeformerReadModel[]
): readonly RigControlId[] {
  const deformerIds = new Set(readModels.map((readModel) => readModel.rigControlId));
  const roots = [
    ...session.graph.rigControlRootIds.filter((rigControlId) => deformerIds.has(rigControlId)),
    ...readModels
      .filter(
        (readModel) =>
          readModel.parentRigControlId === undefined ||
          !deformerIds.has(readModel.parentRigControlId)
      )
      .map((readModel) => readModel.rigControlId)
  ];

  return roots.filter((rigControlId, index) => roots.indexOf(rigControlId) === index);
}

function createWarpDeformerTargetOption(
  session: AuthoringSession,
  drawableId: DrawableId
): WarpDeformerTargetOption | undefined {
  const drawable = findDrawable(session, drawableId);
  if (drawable === undefined) {
    return undefined;
  }

  return {
    drawableId: drawable.drawableId,
    displayName: drawable.displayName,
    partId: drawable.partId,
    partDisplayName:
      session.graph.parts.find((part) => part.partId === drawable.partId)?.displayName ??
      "Missing part",
    bounds: resolveDrawableBounds(session, drawable.drawableId)
  };
}

function normalizeWarpDeformerDraft(draft: WarpDeformerDraft): WarpDeformerDraft {
  return {
    ...draft,
    displayName: draft.displayName.trim().length === 0 ? "Warp Deformer" : draft.displayName.trim(),
    domainBounds: {
      x: toFiniteNumber(draft.domainBounds.x, 0),
      y: toFiniteNumber(draft.domainBounds.y, 0),
      width: Math.max(1, toFiniteNumber(draft.domainBounds.width, 1)),
      height: Math.max(1, toFiniteNumber(draft.domainBounds.height, 1))
    },
    transformColumns: clampInteger(draft.transformColumns, 2, 24),
    transformRows: clampInteger(draft.transformRows, 2, 24),
    bezierColumns: clampInteger(draft.bezierColumns, 2, 24),
    bezierRows: clampInteger(draft.bezierRows, 2, 24),
    bezierEditType: WARP_DEFORMER_BEZIER_EDIT_TYPE
  };
}

function resolveChildBounds(
  session: AuthoringSession,
  draft: WarpDeformerDraft
): RectDto | undefined {
  const childDrawableBounds = draft.childDrawableIds
    .map((drawableId) => resolveDrawableBounds(session, drawableId))
    .filter(isPositiveRect);
  const childRigBounds = draft.childRigControlIds
    .map((rigControlId) => findWarpDeformerReadModel(session, rigControlId)?.domainBounds)
    .filter(isDefined)
    .filter(isPositiveRect);

  return unionRects([...childDrawableBounds, ...childRigBounds]);
}

function resolveDrawableBounds(session: AuthoringSession, drawableId: DrawableId): RectDto {
  const drawable = findDrawable(session, drawableId);
  const mesh = drawable === undefined ? undefined : findMesh(session, drawable.meshId);
  if (mesh !== undefined && isPositiveRect(mesh.bounds)) {
    return structuredClone(mesh.bounds);
  }

  return {
    x: 0,
    y: 0,
    width: Math.max(1, session.graph.canvasSize.width),
    height: Math.max(1, session.graph.canvasSize.height)
  };
}

function findDrawable(session: AuthoringSession, drawableId: DrawableId) {
  return session.graph.drawables.find((drawable) => drawable.drawableId === drawableId);
}

function findMesh(session: AuthoringSession, meshId: MeshDto["meshId"]) {
  return session.graph.meshes.find((mesh) => mesh.meshId === meshId);
}

function isWarpLatticeRigControl(
  rigControl: RigControlDto
): rigControl is WarpLatticeRigControlDto {
  return rigControl.kind === "warpLattice2d";
}

function unionRects(rects: readonly RectDto[]): RectDto | undefined {
  const positive = rects.filter(isPositiveRect);
  if (positive.length === 0) {
    return undefined;
  }

  const left = Math.min(...positive.map((rect) => rect.x));
  const top = Math.min(...positive.map((rect) => rect.y));
  const right = Math.max(...positive.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...positive.map((rect) => rect.y + rect.height));

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top
  };
}

function isPositiveRect(rect: RectDto): boolean {
  return rect.width > 0 && rect.height > 0;
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(Math.max(Math.round(value), min), max);
}

function toFiniteNumber(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function isDefined<TValue>(value: TValue | undefined): value is TValue {
  return value !== undefined;
}
