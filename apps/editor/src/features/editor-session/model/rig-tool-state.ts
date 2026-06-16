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
import type {
  CreateRotation2dRigControlPayloadDto,
  CreateWarpDeformerPayloadDto
} from "@private-2d-rigging-lab/operation-core";

import { isDeformerTreeTargetSelected } from "./editor-selection";
import type { DeformerTreeSelectionTarget, EditorSelection } from "./editor-selection";

export const DEFAULT_WARP_DEFORMER_TRANSFORM_COLUMNS = 5;
export const DEFAULT_WARP_DEFORMER_TRANSFORM_ROWS = 5;
export const DEFAULT_WARP_DEFORMER_BEZIER_COLUMNS = 3;
export const DEFAULT_WARP_DEFORMER_BEZIER_ROWS = 3;
export const WARP_DEFORMER_BEZIER_EDIT_TYPE = "cubicBezierSurfaceV1" as const;
export const WARP_DEFORMER_DOMAIN_MARGIN = 1;

type RigControlDto = AuthoringSession["graph"]["rigControls"][number];
type RotationRigControlDto = Extract<RigControlDto, { readonly kind: "rotation2d" }>;
type WarpLatticeRigControlDto = Extract<RigControlDto, { readonly kind: "warpLattice2d" }>;
type MeshDto = AuthoringSession["graph"]["meshes"][number];
type InsertRigControlChild = NonNullable<CreateWarpDeformerPayloadDto["insertBeforeChild"]>;

export interface WarpDeformerDraft {
  readonly displayName: string;
  readonly parentRigControlId?: RigControlId | undefined;
  readonly insertBeforeChild?: InsertRigControlChild | undefined;
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
  readonly partDisplayName: string;
  readonly bounds: RectDto;
}

export interface RigBatchDrawableTarget {
  readonly drawableId: DrawableId;
  readonly displayName: string;
  readonly bounds: RectDto;
  readonly status: "eligible" | "alreadyBound";
  readonly boundRigControlId?: RigControlId;
}

export interface WarpDeformerReadModel {
  readonly kind: "warpDeformer";
  readonly storageKind: "warpLattice2d";
  readonly rigControlId: RigControlId;
  readonly displayName: string;
  readonly parentRigControlId?: RigControlId;
  readonly childDrawableIds: readonly DrawableId[];
  readonly childRigControlIds: readonly RigControlId[];
  readonly opacityMultiplier: number;
  readonly hasKeyforms: boolean;
  readonly keyformSetCount: number;
  readonly keyformKeyCount: number;
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

export interface RotationDeformerReadModel {
  readonly kind: "rotationDeformer";
  readonly storageKind: "rotation2d";
  readonly rigControlId: RigControlId;
  readonly displayName: string;
  readonly parentRigControlId?: RigControlId;
  readonly childDrawableIds: readonly DrawableId[];
  readonly childRigControlIds: readonly RigControlId[];
  readonly opacityMultiplier: number;
  readonly hasKeyforms: boolean;
  readonly keyformSetCount: number;
  readonly keyformKeyCount: number;
  readonly pivot: {
    readonly x: number;
    readonly y: number;
  };
  readonly restTranslation: {
    readonly x: number;
    readonly y: number;
  };
  readonly restAngleDegrees: number;
}

export type DeformerReadModel = WarpDeformerReadModel | RotationDeformerReadModel;

export interface DeformerParentOption {
  readonly rigControlId: RigControlId;
  readonly displayName: string;
}

export type DrawablePoolItem =
  | {
      readonly kind: "part";
      readonly partId: PartId;
      readonly depth: number;
      readonly displayName: string;
      readonly selected: false;
      readonly displayOnly: true;
    }
  | {
      readonly kind: "drawable";
      readonly drawableId: DrawableId;
      readonly depth: number;
      readonly displayName: string;
      readonly partDisplayName: string;
      readonly selected: boolean;
      readonly displayOnly: false;
    };

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
      readonly keyformSetCount: number;
      readonly keyformKeyCount: number;
      readonly transformLabel: string;
      readonly bezierLabel: string;
      readonly legacyDefaulted: boolean;
    }
  | {
      readonly kind: "rotationDeformer";
      readonly rigControlId: RigControlId;
      readonly depth: number;
      readonly displayName: string;
      readonly detail: string;
      readonly selected: boolean;
      readonly parentRigControlId?: RigControlId;
      readonly childDrawableCount: number;
      readonly childRigControlCount: number;
      readonly keyformSetCount: number;
      readonly keyformKeyCount: number;
      readonly transformLabel: string;
      readonly opacityMultiplier: number;
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

  const parentRigControlId = findDrawableRigControlParentId(session, drawableId);

  return {
    displayName: `${drawable.displayName} Warp Deformer`,
    ...(parentRigControlId === undefined
      ? {}
      : {
          parentRigControlId,
          insertBeforeChild: {
            kind: "drawable",
            id: drawableId
          }
        }),
    childDrawableIds: [drawable.drawableId],
    childRigControlIds: [],
    domainBounds: resolveDrawableWarpDomainBounds(session, drawable.drawableId),
    transformColumns: DEFAULT_WARP_DEFORMER_TRANSFORM_COLUMNS,
    transformRows: DEFAULT_WARP_DEFORMER_TRANSFORM_ROWS,
    bezierColumns: DEFAULT_WARP_DEFORMER_BEZIER_COLUMNS,
    bezierRows: DEFAULT_WARP_DEFORMER_BEZIER_ROWS,
    bezierEditType: WARP_DEFORMER_BEZIER_EDIT_TYPE
  };
}

export function createRotationDeformerPayloadForDrawable(
  session: AuthoringSession,
  drawableId: DrawableId
): CreateRotation2dRigControlPayloadDto | undefined {
  const drawable = findDrawable(session, drawableId);
  if (drawable === undefined) {
    return undefined;
  }

  const bounds = resolveDrawableBounds(session, drawable.drawableId);
  const parentRigControlId = findDrawableRigControlParentId(session, drawableId);

  return {
    displayName: `${drawable.displayName} Rotation Deformer`,
    childDrawableIds: [drawable.drawableId],
    childRigControlIds: [],
    opacityMultiplier: 1,
    pivot: {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2
    },
    restAngleDegrees: 0,
    ...(parentRigControlId === undefined
      ? {}
      : {
          parentRigControlId,
          insertBeforeChild: {
            kind: "drawable",
            id: drawableId
          }
        })
  };
}

export function createRigBatchDrawableTargets(
  session: AuthoringSession,
  drawableIds: readonly DrawableId[]
): readonly RigBatchDrawableTarget[] {
  const result: RigBatchDrawableTarget[] = [];
  const seen = new Set<DrawableId>();

  for (const drawableId of drawableIds) {
    if (seen.has(drawableId)) {
      continue;
    }
    seen.add(drawableId);

    const drawable = findDrawable(session, drawableId);
    if (drawable === undefined) {
      continue;
    }

    const boundRigControlId = findDrawableRigControlParentId(session, drawableId);
    result.push({
      drawableId: drawable.drawableId,
      displayName: drawable.displayName,
      bounds: resolveDrawableBounds(session, drawable.drawableId),
      status: boundRigControlId === undefined ? "eligible" : "alreadyBound",
      ...(boundRigControlId === undefined ? {} : { boundRigControlId })
    });
  }

  return result;
}

export function createRotationDeformerPayloadForUnboundDrawables(
  session: AuthoringSession,
  drawableIds: readonly DrawableId[]
): CreateRotation2dRigControlPayloadDto | undefined {
  const eligibleTargets = createRigBatchDrawableTargets(session, drawableIds).filter(
    (target) => target.status === "eligible"
  );
  if (eligibleTargets.length === 0) {
    return undefined;
  }

  const bounds = unionRects(eligibleTargets.map((target) => target.bounds)) ?? fallbackCanvasBounds(session);

  return {
    displayName: createBatchDeformerDisplayName(eligibleTargets, "Rotation Deformer"),
    childDrawableIds: eligibleTargets.map((target) => target.drawableId),
    childRigControlIds: [],
    opacityMultiplier: 1,
    pivot: {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2
    },
    restAngleDegrees: 0
  };
}

export function createWarpDeformerPayloadForUnboundDrawables(
  session: AuthoringSession,
  drawableIds: readonly DrawableId[]
): CreateWarpDeformerPayloadDto | undefined {
  const eligibleTargets = createRigBatchDrawableTargets(session, drawableIds).filter(
    (target) => target.status === "eligible"
  );
  if (eligibleTargets.length === 0) {
    return undefined;
  }

  const domainBounds =
    unionRects(
      eligibleTargets
        .map((target) => resolveDrawableWarpDomainBounds(session, target.drawableId))
        .filter(isPositiveRect)
    ) ?? fallbackCanvasBounds(session);

  return createWarpDeformerPayloadFromDraft({
    displayName: createBatchDeformerDisplayName(eligibleTargets, "Warp Deformer"),
    childDrawableIds: eligibleTargets.map((target) => target.drawableId),
    childRigControlIds: [],
    domainBounds,
    transformColumns: DEFAULT_WARP_DEFORMER_TRANSFORM_COLUMNS,
    transformRows: DEFAULT_WARP_DEFORMER_TRANSFORM_ROWS,
    bezierColumns: DEFAULT_WARP_DEFORMER_BEZIER_COLUMNS,
    bezierRows: DEFAULT_WARP_DEFORMER_BEZIER_ROWS,
    bezierEditType: WARP_DEFORMER_BEZIER_EDIT_TYPE
  });
}

export function createWarpDeformerParentPayloadForRigControl(
  session: AuthoringSession,
  childRigControlId: RigControlId
): CreateWarpDeformerPayloadDto | undefined {
  const childRigControl = findRigControl(session, childRigControlId);
  if (childRigControl === undefined) {
    return undefined;
  }

  const bounds = resolveRigControlWarpDomainBounds(session, childRigControlId);

  return {
    displayName: `${childRigControl.displayName} Parent Warp Deformer`,
    ...(childRigControl.parentId === undefined
      ? { childRigControlIds: [childRigControlId] }
      : {
          parentRigControlId: childRigControl.parentId,
          childRigControlIds: [],
          insertBeforeChild: {
            kind: "rigControl",
            id: childRigControlId
          }
        }),
    childDrawableIds: [],
    opacityMultiplier: 1,
    domainBounds: bounds,
    transformColumns: DEFAULT_WARP_DEFORMER_TRANSFORM_COLUMNS,
    transformRows: DEFAULT_WARP_DEFORMER_TRANSFORM_ROWS,
    bezierColumns: DEFAULT_WARP_DEFORMER_BEZIER_COLUMNS,
    bezierRows: DEFAULT_WARP_DEFORMER_BEZIER_ROWS,
    bezierEditType: WARP_DEFORMER_BEZIER_EDIT_TYPE
  };
}

export function createRotationDeformerParentPayloadForRigControl(
  session: AuthoringSession,
  childRigControlId: RigControlId
): CreateRotation2dRigControlPayloadDto | undefined {
  const childRigControl = findRigControl(session, childRigControlId);
  if (childRigControl === undefined) {
    return undefined;
  }

  const bounds = resolveRigControlBounds(session, childRigControlId);

  return {
    displayName: `${childRigControl.displayName} Parent Rotation Deformer`,
    ...(childRigControl.parentId === undefined
      ? { childRigControlIds: [childRigControlId] }
      : {
          parentRigControlId: childRigControl.parentId,
          childRigControlIds: [],
          insertBeforeChild: {
            kind: "rigControl",
            id: childRigControlId
          }
        }),
    childDrawableIds: [],
    opacityMultiplier: 1,
    pivot: {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2
    },
    restAngleDegrees: 0
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
    insertBeforeChild: patch.insertBeforeChild ?? draft.insertBeforeChild,
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
    displayName: normalized.displayName,
    ...(normalized.parentRigControlId === undefined
      ? {}
      : { parentRigControlId: normalized.parentRigControlId }),
    ...(normalized.insertBeforeChild === undefined
      ? {}
      : { insertBeforeChild: normalized.insertBeforeChild }),
    childDrawableIds: [...normalized.childDrawableIds],
    childRigControlIds: [...normalized.childRigControlIds],
    opacityMultiplier: 1,
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
  const readModels = createDeformerReadModels(session);
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
    rows.push(createDeformerTreeDeformerRow(readModel, depth, selection, readModelsById));

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
        selected: isDeformerTreeTargetSelected(selection, {
          kind: "boundDrawable",
          drawableId: childDrawableId,
          parentRigControlId: rigControlId
        })
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

export function createDrawablePoolItems(
  session: AuthoringSession,
  selection: EditorSelection | null
): readonly DrawablePoolItem[] {
  const boundDrawableIds = new Set(
    session.graph.rigControls.flatMap((rigControl) => rigControl.childDrawableIds)
  );
  const partsById = new Map(session.graph.parts.map((part) => [part.partId, part]));
  const unboundDrawablesById = new Map(
    session.graph.drawables
      .filter((drawable) => !boundDrawableIds.has(drawable.drawableId))
      .map((drawable) => [drawable.drawableId, drawable])
  );
  const emittedDrawableIds = new Set<DrawableId>();
  const visitedPartIds = new Set<PartId>();
  const rows: DrawablePoolItem[] = [];

  const createPoolDrawableRow = (
    drawable: AuthoringSession["graph"]["drawables"][number],
    depth: number
  ): Extract<DrawablePoolItem, { readonly kind: "drawable" }> => {
    emittedDrawableIds.add(drawable.drawableId);

    return {
      kind: "drawable",
      drawableId: drawable.drawableId,
      depth,
      displayName: drawable.displayName,
      partDisplayName: partsById.get(drawable.partId)?.displayName ?? "Missing part",
      selected: isDeformerTreeTargetSelected(selection, {
        kind: "poolDrawable",
        drawableId: drawable.drawableId
      }),
      displayOnly: false
    };
  };

  const appendPartSubtree = (partId: PartId, depth: number): readonly DrawablePoolItem[] => {
    const part = partsById.get(partId);
    if (part === undefined || visitedPartIds.has(partId)) {
      return [];
    }

    visitedPartIds.add(partId);
    const childRows: DrawablePoolItem[] = [];

    for (const child of getPartOrderedChildren(session.graph, part)) {
      if (child.kind === "drawable") {
        const drawable = unboundDrawablesById.get(child.drawableId);
        if (drawable !== undefined && !emittedDrawableIds.has(drawable.drawableId)) {
          childRows.push(createPoolDrawableRow(drawable, depth + 1));
        }
        continue;
      }

      childRows.push(...appendPartSubtree(child.partId, depth + 1));
    }

    for (const drawable of session.graph.drawables) {
      if (
        drawable.partId === partId &&
        unboundDrawablesById.has(drawable.drawableId) &&
        !emittedDrawableIds.has(drawable.drawableId)
      ) {
        childRows.push(createPoolDrawableRow(drawable, depth + 1));
      }
    }

    if (childRows.length === 0) {
      return [];
    }

    return [
      {
        kind: "part",
        partId,
        depth,
        displayName: part.displayName,
        selected: false,
        displayOnly: true
      },
      ...childRows
    ];
  };

  for (const part of createPoolRootParts(session, partsById)) {
    rows.push(...appendPartSubtree(part.partId, 0));
  }

  for (const part of createStablePartOrder(session)) {
    if (!visitedPartIds.has(part.partId)) {
      rows.push(...appendPartSubtree(part.partId, 0));
    }
  }

  for (const drawable of session.graph.drawables) {
    if (
      unboundDrawablesById.has(drawable.drawableId) &&
      !emittedDrawableIds.has(drawable.drawableId)
    ) {
      rows.push(createPoolDrawableRow(drawable, 0));
    }
  }

  return rows;
}

export function createDeformerTreeSelectableTargets(
  deformerRows: readonly DeformerTreeRow[],
  drawablePoolItems: readonly DrawablePoolItem[]
): readonly DeformerTreeSelectionTarget[] {
  const targets: DeformerTreeSelectionTarget[] = [];

  for (const row of deformerRows) {
    if (row.kind === "drawableRef") {
      targets.push({
        kind: "boundDrawable",
        drawableId: row.drawableId,
        parentRigControlId: row.parentRigControlId
      });
      continue;
    }

    targets.push({
      kind: "rigControl",
      rigControlId: row.rigControlId
    });
  }

  for (const item of drawablePoolItems) {
    if (item.kind === "drawable") {
      targets.push({
        kind: "poolDrawable",
        drawableId: item.drawableId
      });
    }
  }

  return targets;
}

function createPoolRootParts(
  session: AuthoringSession,
  partsById: ReadonlyMap<PartId, AuthoringSession["graph"]["parts"][number]>
): readonly AuthoringSession["graph"]["parts"][number][] {
  return createStablePartOrder(session).filter(
    (part) => part.parentPartId === undefined || !partsById.has(part.parentPartId)
  );
}

function createStablePartOrder(
  session: AuthoringSession
): readonly AuthoringSession["graph"]["parts"][number][] {
  const stableOrderIndex = new Map(
    session.graph.stableOrder.map((stableId, index) => [stableId, index])
  );

  return [...session.graph.parts].sort((left, right) => {
    const leftIndex = stableOrderIndex.get(left.partId) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = stableOrderIndex.get(right.partId) ?? Number.MAX_SAFE_INTEGER;
    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }

    return left.displayName.localeCompare(right.displayName);
  });
}

export function createDeformerReadModels(
  session: AuthoringSession
): readonly DeformerReadModel[] {
  return session.graph.rigControls
    .map((rigControl): DeformerReadModel | undefined => {
      if (isWarpLatticeRigControl(rigControl)) {
        return projectEditorWarpDeformerReadModel(session, rigControl);
      }
      if (isRotationRigControl(rigControl)) {
        return projectEditorRotationDeformerReadModel(session, rigControl);
      }

      return undefined;
    })
    .filter(isDefined)
    .sort((left, right) => left.displayName.localeCompare(right.displayName));
}

export function createWarpDeformerReadModels(
  session: AuthoringSession
): readonly WarpDeformerReadModel[] {
  return session.graph.rigControls
    .filter(isWarpLatticeRigControl)
    .map((rigControl) => projectEditorWarpDeformerReadModel(session, rigControl))
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
    ? projectEditorWarpDeformerReadModel(session, rigControl)
    : undefined;
}

export function findRotationDeformerReadModel(
  session: AuthoringSession,
  rigControlId: RigControlId
): RotationDeformerReadModel | undefined {
  const rigControl = session.graph.rigControls.find(
    (candidate) => candidate.rigControlId === rigControlId
  );

  return rigControl !== undefined && isRotationRigControl(rigControl)
    ? projectEditorRotationDeformerReadModel(session, rigControl)
    : undefined;
}

export function createWarpDeformerParentOptions(
  session: AuthoringSession
): readonly DeformerParentOption[] {
  return createDeformerParentOptions(session);
}

export function createDeformerParentOptions(
  session: AuthoringSession,
  excludedRigControlId?: RigControlId
): readonly DeformerParentOption[] {
  const excludedIds =
    excludedRigControlId === undefined
      ? new Set<RigControlId>()
      : collectRigControlDescendantIds(session, excludedRigControlId);
  if (excludedRigControlId !== undefined) {
    excludedIds.add(excludedRigControlId);
  }

  return createDeformerReadModels(session)
    .filter((readModel) => !excludedIds.has(readModel.rigControlId))
    .map((readModel) => ({
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

export function resolveWarpDeformerChildrenBounds(
  session: AuthoringSession,
  childDrawableIds: readonly DrawableId[],
  childRigControlIds: readonly RigControlId[]
): RectDto | undefined {
  const childDrawableBounds = childDrawableIds
    .map((drawableId) => resolveDrawableWarpDomainBounds(session, drawableId))
    .filter(isPositiveRect);
  const childRigBounds = childRigControlIds
    .map((rigControlId) => resolveRigControlWarpDomainBounds(session, rigControlId))
    .filter(isPositiveRect);

  return unionRects([...childDrawableBounds, ...childRigBounds]);
}

export function hasRigControlKeyforms(
  session: AuthoringSession,
  rigControlId: RigControlId
): boolean {
  return summarizeRigControlKeyforms(session, rigControlId).keyformSetCount > 0;
}

export function summarizeRigControlKeyforms(
  session: AuthoringSession,
  rigControlId: RigControlId
): { readonly keyformSetCount: number; readonly keyformKeyCount: number } {
  const keyformSets = session.graph.keyformSets.filter(
    (keyformSet) =>
      keyformSet.target.kind === "rigControl" && keyformSet.target.id === rigControlId
  );

  return {
    keyformSetCount: keyformSets.length,
    keyformKeyCount: keyformSets.reduce((total, keyformSet) => total + keyformSet.keys.length, 0)
  };
}

function createDeformerTreeDeformerRow(
  readModel: DeformerReadModel,
  depth: number,
  selection: EditorSelection | null,
  readModelsById: ReadonlyMap<RigControlId, DeformerReadModel>
): Extract<DeformerTreeRow, { readonly kind: "warpDeformer" | "rotationDeformer" }> {
  const childRigControlCount = readModel.childRigControlIds.filter((childId) =>
    readModelsById.has(childId)
  ).length;
  const base = {
    rigControlId: readModel.rigControlId,
    depth,
    displayName: readModel.displayName,
    selected: isDeformerTreeTargetSelected(selection, {
      kind: "rigControl",
      rigControlId: readModel.rigControlId
    }),
    ...(readModel.parentRigControlId === undefined
      ? {}
      : { parentRigControlId: readModel.parentRigControlId }),
    childDrawableCount: readModel.childDrawableIds.length,
    childRigControlCount,
    keyformSetCount: readModel.keyformSetCount,
    keyformKeyCount: readModel.keyformKeyCount
  };

  if (readModel.kind === "rotationDeformer") {
    return {
      kind: "rotationDeformer",
      ...base,
      detail: "Rotation Deformer",
      transformLabel: `Pivot ${formatNumber(readModel.pivot.x)}, ${formatNumber(readModel.pivot.y)}`,
      opacityMultiplier: readModel.opacityMultiplier
    };
  }

  return {
    kind: "warpDeformer",
    ...base,
    detail: readModel.bezierSurfaceStatus === "stored" ? "Warp Deformer" : "Legacy warp lattice",
    transformLabel: formatControlPointGrid(
      readModel.transformGrid.columns,
      readModel.transformGrid.rows
    ),
    bezierLabel: formatControlPointGrid(
      readModel.bezierEditSurface.columns,
      readModel.bezierEditSurface.rows
    ),
    legacyDefaulted: readModel.bezierSurfaceStatus === "legacyDefaulted"
  };
}

function projectEditorWarpDeformerReadModel(
  session: AuthoringSession,
  rigControl: WarpLatticeRigControlDto
): WarpDeformerReadModel {
  const metadata = rigControl.warpDeformer;
  const keyformSummary = summarizeRigControlKeyforms(session, rigControl.rigControlId);
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
    ...(rigControl.parentId === undefined ? {} : { parentRigControlId: rigControl.parentId }),
    childDrawableIds: [...rigControl.childDrawableIds],
    childRigControlIds: [...rigControl.childRigControlIds],
    opacityMultiplier: rigControl.opacityMultiplier ?? 1,
    hasKeyforms: keyformSummary.keyformSetCount > 0,
    keyformSetCount: keyformSummary.keyformSetCount,
    keyformKeyCount: keyformSummary.keyformKeyCount,
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

function projectEditorRotationDeformerReadModel(
  session: AuthoringSession,
  rigControl: RotationRigControlDto
): RotationDeformerReadModel {
  const keyformSummary = summarizeRigControlKeyforms(session, rigControl.rigControlId);

  return {
    kind: "rotationDeformer",
    storageKind: "rotation2d",
    rigControlId: rigControl.rigControlId,
    displayName: rigControl.displayName,
    ...(rigControl.parentId === undefined ? {} : { parentRigControlId: rigControl.parentId }),
    childDrawableIds: [...rigControl.childDrawableIds],
    childRigControlIds: [...rigControl.childRigControlIds],
    opacityMultiplier: rigControl.opacityMultiplier ?? 1,
    hasKeyforms: keyformSummary.keyformSetCount > 0,
    keyformSetCount: keyformSummary.keyformSetCount,
    keyformKeyCount: keyformSummary.keyformKeyCount,
    pivot: structuredClone(rigControl.pivot),
    restTranslation: structuredClone(rigControl.restTranslation ?? { x: 0, y: 0 }),
    restAngleDegrees: rigControl.restAngleDegrees
  };
}

function resolveDeformerRootIds(
  session: AuthoringSession,
  readModels: readonly DeformerReadModel[]
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
  return resolveWarpDeformerChildrenBounds(
    session,
    draft.childDrawableIds,
    draft.childRigControlIds
  );
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

function resolveDrawableWarpDomainBounds(session: AuthoringSession, drawableId: DrawableId): RectDto {
  const drawable = findDrawable(session, drawableId);
  const mesh = drawable === undefined ? undefined : findMesh(session, drawable.meshId);
  if (mesh !== undefined) {
    const vertexBounds = computeVertexBounds(mesh.vertices);
    if (vertexBounds !== undefined) {
      return expandRect(vertexBounds, WARP_DEFORMER_DOMAIN_MARGIN);
    }

    if (isPositiveRect(mesh.bounds)) {
      return expandRect(mesh.bounds, WARP_DEFORMER_DOMAIN_MARGIN);
    }
  }

  return resolveDrawableBounds(session, drawableId);
}

function findDrawable(session: AuthoringSession, drawableId: DrawableId) {
  return session.graph.drawables.find((drawable) => drawable.drawableId === drawableId);
}

function findRigControl(session: AuthoringSession, rigControlId: RigControlId) {
  return session.graph.rigControls.find((rigControl) => rigControl.rigControlId === rigControlId);
}

function resolveRigControlBounds(
  session: AuthoringSession,
  rigControlId: RigControlId,
  visited: ReadonlySet<RigControlId> = new Set()
): RectDto {
  const rigControl = findRigControl(session, rigControlId);
  if (rigControl === undefined || visited.has(rigControlId)) {
    return {
      x: 0,
      y: 0,
      width: Math.max(1, session.graph.canvasSize.width),
      height: Math.max(1, session.graph.canvasSize.height)
    };
  }

  if (isWarpLatticeRigControl(rigControl)) {
    return structuredClone(rigControl.domainBounds);
  }

  const nextVisited = new Set(visited);
  nextVisited.add(rigControlId);
  const childBounds = [
    ...rigControl.childDrawableIds.map((drawableId) => resolveDrawableBounds(session, drawableId)),
    ...rigControl.childRigControlIds.map((childRigControlId) =>
      resolveRigControlBounds(session, childRigControlId, nextVisited)
    )
  ];

  return unionRects(childBounds) ?? {
    x: rigControl.pivot.x - 16,
    y: rigControl.pivot.y - 16,
    width: 32,
    height: 32
  };
}

function resolveRigControlWarpDomainBounds(
  session: AuthoringSession,
  rigControlId: RigControlId,
  visited: ReadonlySet<RigControlId> = new Set()
): RectDto {
  const rigControl = findRigControl(session, rigControlId);
  if (rigControl === undefined || visited.has(rigControlId)) {
    return fallbackCanvasBounds(session);
  }

  if (isWarpLatticeRigControl(rigControl)) {
    return structuredClone(rigControl.domainBounds);
  }

  const nextVisited = new Set(visited);
  nextVisited.add(rigControlId);
  const childBounds = [
    ...rigControl.childDrawableIds.map((drawableId) => resolveDrawableWarpDomainBounds(session, drawableId)),
    ...rigControl.childRigControlIds.map((childRigControlId) =>
      resolveRigControlWarpDomainBounds(session, childRigControlId, nextVisited)
    )
  ];

  return unionRects(childBounds) ?? expandRect({
    x: rigControl.pivot.x - 16,
    y: rigControl.pivot.y - 16,
    width: 32,
    height: 32
  }, WARP_DEFORMER_DOMAIN_MARGIN);
}

function findMesh(session: AuthoringSession, meshId: MeshDto["meshId"]) {
  return session.graph.meshes.find((mesh) => mesh.meshId === meshId);
}

function isWarpLatticeRigControl(
  rigControl: RigControlDto
): rigControl is WarpLatticeRigControlDto {
  return rigControl.kind === "warpLattice2d";
}

function isRotationRigControl(rigControl: RigControlDto): rigControl is RotationRigControlDto {
  return rigControl.kind === "rotation2d";
}

function findDrawableRigControlParentId(
  session: AuthoringSession,
  drawableId: DrawableId
): RigControlId | undefined {
  return findDrawableRigControlParentIds(session, drawableId)[0];
}

function findDrawableRigControlParentIds(
  session: AuthoringSession,
  drawableId: DrawableId
): readonly RigControlId[] {
  return session.graph.rigControls
    .filter((rigControl) => rigControl.childDrawableIds.includes(drawableId))
    .map((rigControl) => rigControl.rigControlId);
}

function createBatchDeformerDisplayName(
  targets: readonly Pick<RigBatchDrawableTarget, "displayName">[],
  suffix: string
): string {
  if (targets.length === 1) {
    return `${targets[0]!.displayName} ${suffix}`;
  }

  return `${targets.length} Drawables ${suffix}`;
}

function collectRigControlDescendantIds(
  session: AuthoringSession,
  rigControlId: RigControlId
): Set<RigControlId> {
  const rigControlsById = new Map(
    session.graph.rigControls.map((rigControl) => [rigControl.rigControlId, rigControl])
  );
  const result = new Set<RigControlId>();
  const visit = (currentRigControlId: RigControlId) => {
    const rigControl = rigControlsById.get(currentRigControlId);
    if (rigControl === undefined) {
      return;
    }

    for (const childRigControlId of rigControl.childRigControlIds) {
      if (result.has(childRigControlId)) {
        continue;
      }

      result.add(childRigControlId);
      visit(childRigControlId);
    }
  };

  visit(rigControlId);
  return result;
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

function computeVertexBounds(vertices: readonly { readonly x: number; readonly y: number }[]): RectDto | undefined {
  const finiteVertices = vertices.filter((vertex) => Number.isFinite(vertex.x) && Number.isFinite(vertex.y));
  if (finiteVertices.length === 0) {
    return undefined;
  }

  const left = Math.min(...finiteVertices.map((vertex) => vertex.x));
  const top = Math.min(...finiteVertices.map((vertex) => vertex.y));
  const right = Math.max(...finiteVertices.map((vertex) => vertex.x));
  const bottom = Math.max(...finiteVertices.map((vertex) => vertex.y));

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top
  };
}

function expandRect(rect: RectDto, margin: number): RectDto {
  return {
    x: rect.x - margin,
    y: rect.y - margin,
    width: Math.max(1, rect.width + margin * 2),
    height: Math.max(1, rect.height + margin * 2)
  };
}

function fallbackCanvasBounds(session: AuthoringSession): RectDto {
  return {
    x: 0,
    y: 0,
    width: Math.max(1, session.graph.canvasSize.width),
    height: Math.max(1, session.graph.canvasSize.height)
  };
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
