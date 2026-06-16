import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import type { DrawableId, RectDto, RigControlId } from "@private-2d-rigging-lab/contracts";
import type {
  CreateRotation2dRigControlPayloadDto,
  CreateWarpDeformerPayloadDto
} from "@private-2d-rigging-lab/operation-core";

import type { DeformerTreeSelectionTarget, EditorSelection } from "./editor-selection";
import {
  DEFAULT_WARP_DEFORMER_BEZIER_COLUMNS,
  DEFAULT_WARP_DEFORMER_BEZIER_ROWS,
  DEFAULT_WARP_DEFORMER_TRANSFORM_COLUMNS,
  DEFAULT_WARP_DEFORMER_TRANSFORM_ROWS,
  WARP_DEFORMER_BEZIER_EDIT_TYPE,
  WARP_DEFORMER_DOMAIN_MARGIN
} from "./rig-tool-state";

type RigControlDto = AuthoringSession["graph"]["rigControls"][number];
type WarpLatticeRigControlDto = Extract<RigControlDto, { readonly kind: "warpLattice2d" }>;
type MeshDto = AuthoringSession["graph"]["meshes"][number];
type RigControlWrapChildTarget = NonNullable<CreateWarpDeformerPayloadDto["wrapChildren"]>[number];

export type DeformerTreeWrapTargetSource = DeformerTreeSelectionTarget["kind"];

export interface DeformerTreeWrapTargetItem {
  readonly kind: "drawable" | "rigControl";
  readonly source: DeformerTreeWrapTargetSource;
  readonly id: DrawableId | RigControlId;
  readonly displayName: string;
  readonly detail: string;
  readonly status: "included" | "invalid";
}

export interface DeformerTreeWrapSelectionReadModel {
  readonly status: "coherent" | "incoherent";
  readonly canCreate: boolean;
  readonly targets: readonly DeformerTreeWrapTargetItem[];
  readonly warning: string | null;
  readonly wrapChildren: readonly RigControlWrapChildTarget[];
  readonly parentRigControlId?: RigControlId;
  readonly bounds?: RectDto;
  readonly warpDomainBounds?: RectDto;
}

type DeformerTreeWrapInvalidReason =
  | "ancestorDescendant"
  | "boundPoolDrawable"
  | "duplicateChild"
  | "empty"
  | "missing"
  | "mixedParents"
  | "mixedRootAndParented"
  | "parentMismatch";

interface DeformerTreeWrapCandidate {
  readonly item: DeformerTreeWrapTargetItem;
  readonly child?: RigControlWrapChildTarget;
  readonly parentRigControlId?: RigControlId;
  readonly bounds?: RectDto;
  readonly warpDomainBounds?: RectDto;
  readonly invalidReason?: DeformerTreeWrapInvalidReason;
}

interface ValidDeformerTreeWrapCandidate extends DeformerTreeWrapCandidate {
  readonly item: DeformerTreeWrapTargetItem & { readonly status: "included" };
  readonly child: RigControlWrapChildTarget;
  readonly bounds: RectDto;
  readonly warpDomainBounds: RectDto;
}

export function createDeformerTreeWrapSelectionReadModel(
  session: AuthoringSession,
  selection: EditorSelection | null
): DeformerTreeWrapSelectionReadModel | undefined {
  if (selection?.kind !== "deformerTreeSet") {
    return undefined;
  }

  const candidates = selection.targets.map((target) =>
    createDeformerTreeWrapCandidate(session, target)
  );
  const targetItems = candidates.map((candidate) => candidate.item);
  const invalidReason = candidates.find((candidate) => candidate.invalidReason !== undefined)
    ?.invalidReason;
  if (invalidReason !== undefined) {
    return createIncoherentDeformerTreeWrapReadModel(targetItems, invalidReason);
  }

  const validCandidates = candidates.filter(isValidDeformerTreeWrapCandidate);
  if (validCandidates.length === 0) {
    return createIncoherentDeformerTreeWrapReadModel(targetItems, "empty");
  }

  if (hasDuplicateWrapChildren(validCandidates)) {
    return createIncoherentDeformerTreeWrapReadModel(targetItems, "duplicateChild");
  }

  if (hasAncestorDescendantWrapSelection(session, validCandidates)) {
    return createIncoherentDeformerTreeWrapReadModel(targetItems, "ancestorDescendant");
  }

  const parentedParentIds = validCandidates
    .map((candidate) => candidate.parentRigControlId)
    .filter(isDefined);
  const uniqueParentedParentIds = uniqueIds(parentedParentIds);
  const selectedRootRigControlIds = validCandidates.filter(
    (candidate) => candidate.child.kind === "rigControl" && candidate.parentRigControlId === undefined
  );

  if (uniqueParentedParentIds.length > 1) {
    return createIncoherentDeformerTreeWrapReadModel(targetItems, "mixedParents");
  }

  if (uniqueParentedParentIds.length === 1 && selectedRootRigControlIds.length > 0) {
    return createIncoherentDeformerTreeWrapReadModel(targetItems, "mixedRootAndParented");
  }

  const bounds = unionRects(validCandidates.map((candidate) => candidate.bounds));
  const warpDomainBounds = unionRects(validCandidates.map((candidate) => candidate.warpDomainBounds));
  const parentRigControlId = uniqueParentedParentIds[0];

  return {
    status: "coherent",
    canCreate: true,
    targets: targetItems,
    warning: null,
    wrapChildren: validCandidates.map((candidate) => cloneWrapChild(candidate.child)),
    ...(parentRigControlId === undefined ? {} : { parentRigControlId }),
    ...(bounds === undefined ? {} : { bounds }),
    ...(warpDomainBounds === undefined ? {} : { warpDomainBounds })
  };
}

export function createRotationDeformerPayloadForDeformerTreeSelection(
  session: AuthoringSession,
  selection: EditorSelection | null
): CreateRotation2dRigControlPayloadDto | undefined {
  const readModel = createDeformerTreeWrapSelectionReadModel(session, selection);
  if (readModel?.canCreate !== true) {
    return undefined;
  }

  const bounds = readModel.bounds ?? fallbackCanvasBounds(session);
  const wrapChildren = readModel.wrapChildren.map(cloneWrapChild);

  return {
    displayName: createWrapDeformerDisplayName(readModel.targets, "Rotation Deformer"),
    ...(readModel.parentRigControlId === undefined
      ? {}
      : { parentRigControlId: readModel.parentRigControlId }),
    childDrawableIds: wrapChildren
      .filter((child): child is Extract<RigControlWrapChildTarget, { readonly kind: "drawable" }> =>
        child.kind === "drawable"
      )
      .map((child) => child.id),
    childRigControlIds: wrapChildren
      .filter(
        (child): child is Extract<RigControlWrapChildTarget, { readonly kind: "rigControl" }> =>
          child.kind === "rigControl"
      )
      .map((child) => child.id),
    opacityMultiplier: 1,
    pivot: {
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2
    },
    restAngleDegrees: 0,
    wrapChildren
  };
}

export function createWarpDeformerPayloadForDeformerTreeSelection(
  session: AuthoringSession,
  selection: EditorSelection | null
): CreateWarpDeformerPayloadDto | undefined {
  const readModel = createDeformerTreeWrapSelectionReadModel(session, selection);
  if (readModel?.canCreate !== true) {
    return undefined;
  }

  const domainBounds = readModel.warpDomainBounds ?? fallbackCanvasBounds(session);
  const wrapChildren = readModel.wrapChildren.map(cloneWrapChild);

  return {
    displayName: createWrapDeformerDisplayName(readModel.targets, "Warp Deformer"),
    ...(readModel.parentRigControlId === undefined
      ? {}
      : { parentRigControlId: readModel.parentRigControlId }),
    childDrawableIds: wrapChildren
      .filter((child): child is Extract<RigControlWrapChildTarget, { readonly kind: "drawable" }> =>
        child.kind === "drawable"
      )
      .map((child) => child.id),
    childRigControlIds: wrapChildren
      .filter(
        (child): child is Extract<RigControlWrapChildTarget, { readonly kind: "rigControl" }> =>
          child.kind === "rigControl"
      )
      .map((child) => child.id),
    opacityMultiplier: 1,
    domainBounds: structuredClone(domainBounds),
    transformColumns: DEFAULT_WARP_DEFORMER_TRANSFORM_COLUMNS,
    transformRows: DEFAULT_WARP_DEFORMER_TRANSFORM_ROWS,
    bezierColumns: DEFAULT_WARP_DEFORMER_BEZIER_COLUMNS,
    bezierRows: DEFAULT_WARP_DEFORMER_BEZIER_ROWS,
    bezierEditType: WARP_DEFORMER_BEZIER_EDIT_TYPE,
    wrapChildren
  };
}

function createDeformerTreeWrapCandidate(
  session: AuthoringSession,
  target: DeformerTreeSelectionTarget
): DeformerTreeWrapCandidate {
  if (target.kind === "rigControl") {
    const rigControl = findRigControl(session, target.rigControlId);
    if (rigControl === undefined) {
      return {
        item: {
          kind: "rigControl",
          source: target.kind,
          id: target.rigControlId,
          displayName: target.rigControlId,
          detail: "Missing Deformer",
          status: "invalid"
        },
        invalidReason: "missing"
      };
    }

    return {
      item: {
        kind: "rigControl",
        source: target.kind,
        id: rigControl.rigControlId,
        displayName: rigControl.displayName,
        detail: rigControl.parentId === undefined ? "Root Deformer" : "Child Deformer",
        status: "included"
      },
      child: {
        kind: "rigControl",
        id: rigControl.rigControlId
      },
      ...(rigControl.parentId === undefined ? {} : { parentRigControlId: rigControl.parentId }),
      bounds: resolveRigControlBounds(session, rigControl.rigControlId),
      warpDomainBounds: resolveRigControlWarpDomainBounds(session, rigControl.rigControlId)
    };
  }

  const drawable = findDrawable(session, target.drawableId);
  if (drawable === undefined) {
    return {
      item: {
        kind: "drawable",
        source: target.kind,
        id: target.drawableId,
        displayName: target.drawableId,
        detail: "Missing Drawable",
        status: "invalid"
      },
      invalidReason: "missing"
    };
  }

  const parentRigControlIds = findDrawableRigControlParentIds(session, drawable.drawableId);
  if (target.kind === "poolDrawable") {
    if (parentRigControlIds.length > 0) {
      return {
        item: {
          kind: "drawable",
          source: target.kind,
          id: drawable.drawableId,
          displayName: drawable.displayName,
          detail: "Already bound",
          status: "invalid"
        },
        invalidReason: "boundPoolDrawable"
      };
    }

    return {
      item: {
        kind: "drawable",
        source: target.kind,
        id: drawable.drawableId,
        displayName: drawable.displayName,
        detail: "Pool Drawable",
        status: "included"
      },
      child: {
        kind: "drawable",
        id: drawable.drawableId
      },
      bounds: resolveDrawableBounds(session, drawable.drawableId),
      warpDomainBounds: resolveDrawableWarpDomainBounds(session, drawable.drawableId)
    };
  }

  if (
    parentRigControlIds.length !== 1 ||
    parentRigControlIds[0] !== target.parentRigControlId ||
    findRigControl(session, target.parentRigControlId) === undefined
  ) {
    return {
      item: {
        kind: "drawable",
        source: target.kind,
        id: drawable.drawableId,
        displayName: drawable.displayName,
        detail: "Binding changed",
        status: "invalid"
      },
      invalidReason: "parentMismatch"
    };
  }

  return {
    item: {
      kind: "drawable",
      source: target.kind,
      id: drawable.drawableId,
      displayName: drawable.displayName,
      detail: "Bound Drawable",
      status: "included"
    },
    child: {
      kind: "drawable",
      id: drawable.drawableId
    },
    parentRigControlId: target.parentRigControlId,
    bounds: resolveDrawableBounds(session, drawable.drawableId),
    warpDomainBounds: resolveDrawableWarpDomainBounds(session, drawable.drawableId)
  };
}

function createIncoherentDeformerTreeWrapReadModel(
  targets: readonly DeformerTreeWrapTargetItem[],
  reason: DeformerTreeWrapInvalidReason
): DeformerTreeWrapSelectionReadModel {
  return {
    status: "incoherent",
    canCreate: false,
    targets,
    warning: createDeformerTreeWrapWarning(reason),
    wrapChildren: []
  };
}

function createDeformerTreeWrapWarning(reason: DeformerTreeWrapInvalidReason): string {
  if (reason === "empty") {
    return "Select Deformer Tree targets to create one wrapper.";
  }
  if (reason === "missing") {
    return "Selection contains targets that no longer exist. Refresh the selection and try again.";
  }
  if (reason === "parentMismatch") {
    return "Selection contains a Drawable binding that no longer matches its Deformer parent.";
  }
  if (reason === "boundPoolDrawable") {
    return "Pool Drawables must be unbound before they can join a wrap selection.";
  }
  if (reason === "duplicateChild") {
    return "Selection contains the same wrap target more than once.";
  }
  if (reason === "ancestorDescendant") {
    return "Selection includes a Deformer and one of its descendants. Select direct siblings instead.";
  }
  if (reason === "mixedParents") {
    return "Selected existing children must share one immediate parent Deformer.";
  }

  return "Root Deformers cannot be wrapped together with parented children.";
}

function isValidDeformerTreeWrapCandidate(
  candidate: DeformerTreeWrapCandidate
): candidate is ValidDeformerTreeWrapCandidate {
  return (
    candidate.item.status === "included" &&
    candidate.child !== undefined &&
    candidate.bounds !== undefined &&
    candidate.warpDomainBounds !== undefined
  );
}

function hasDuplicateWrapChildren(
  candidates: readonly ValidDeformerTreeWrapCandidate[]
): boolean {
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const key = createWrapChildKey(candidate.child);
    if (seen.has(key)) {
      return true;
    }
    seen.add(key);
  }

  return false;
}

function hasAncestorDescendantWrapSelection(
  session: AuthoringSession,
  candidates: readonly ValidDeformerTreeWrapCandidate[]
): boolean {
  const selectedRigControlIds = candidates
    .map((candidate) => candidate.child)
    .filter((child): child is Extract<RigControlWrapChildTarget, { readonly kind: "rigControl" }> =>
      child.kind === "rigControl"
    )
    .map((child) => child.id);
  const selectedDrawableIds = candidates
    .map((candidate) => candidate.child)
    .filter((child): child is Extract<RigControlWrapChildTarget, { readonly kind: "drawable" }> =>
      child.kind === "drawable"
    )
    .map((child) => child.id);

  for (const ancestorCandidateId of selectedRigControlIds) {
    for (const descendantCandidateId of selectedRigControlIds) {
      if (
        ancestorCandidateId !== descendantCandidateId &&
        collectRigControlDescendantIds(session, ancestorCandidateId).has(descendantCandidateId)
      ) {
        return true;
      }
    }

    for (const drawableId of selectedDrawableIds) {
      if (rigControlSubtreeContainsDrawable(session, ancestorCandidateId, drawableId)) {
        return true;
      }
    }
  }

  return false;
}

function rigControlSubtreeContainsDrawable(
  session: AuthoringSession,
  rigControlId: RigControlId,
  drawableId: DrawableId,
  visited: ReadonlySet<RigControlId> = new Set()
): boolean {
  const rigControl = findRigControl(session, rigControlId);
  if (rigControl === undefined || visited.has(rigControlId)) {
    return false;
  }

  if (rigControl.childDrawableIds.includes(drawableId)) {
    return true;
  }

  const nextVisited = new Set(visited);
  nextVisited.add(rigControlId);
  return rigControl.childRigControlIds.some((childRigControlId) =>
    rigControlSubtreeContainsDrawable(session, childRigControlId, drawableId, nextVisited)
  );
}

function createWrapDeformerDisplayName(
  targets: readonly DeformerTreeWrapTargetItem[],
  suffix: string
): string {
  const includedTargets = targets.filter((target) => target.status === "included");
  if (includedTargets.length === 1) {
    return `${includedTargets[0]!.displayName} ${suffix}`;
  }

  return `${includedTargets.length} Selected ${suffix}`;
}

function cloneWrapChild(child: RigControlWrapChildTarget): RigControlWrapChildTarget {
  if (child.kind === "drawable") {
    return {
      kind: "drawable",
      id: child.id
    };
  }

  return {
    kind: "rigControl",
    id: child.id
  };
}

function createWrapChildKey(child: RigControlWrapChildTarget): string {
  return `${child.kind}:${child.id}`;
}

function resolveDrawableBounds(session: AuthoringSession, drawableId: DrawableId): RectDto {
  const drawable = findDrawable(session, drawableId);
  const mesh = drawable === undefined ? undefined : findMesh(session, drawable.meshId);
  if (mesh !== undefined && isPositiveRect(mesh.bounds)) {
    return structuredClone(mesh.bounds);
  }

  return fallbackCanvasBounds(session);
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

function resolveRigControlBounds(
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

function findDrawable(session: AuthoringSession, drawableId: DrawableId) {
  return session.graph.drawables.find((drawable) => drawable.drawableId === drawableId);
}

function findRigControl(session: AuthoringSession, rigControlId: RigControlId) {
  return session.graph.rigControls.find((rigControl) => rigControl.rigControlId === rigControlId);
}

function findDrawableRigControlParentIds(
  session: AuthoringSession,
  drawableId: DrawableId
): readonly RigControlId[] {
  return session.graph.rigControls
    .filter((rigControl) => rigControl.childDrawableIds.includes(drawableId))
    .map((rigControl) => rigControl.rigControlId);
}

function findMesh(session: AuthoringSession, meshId: MeshDto["meshId"]) {
  return session.graph.meshes.find((mesh) => mesh.meshId === meshId);
}

function isWarpLatticeRigControl(
  rigControl: RigControlDto
): rigControl is WarpLatticeRigControlDto {
  return rigControl.kind === "warpLattice2d";
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

function uniqueIds<TId extends string>(ids: readonly TId[]): readonly TId[] {
  const result: TId[] = [];
  const seen = new Set<TId>();

  for (const id of ids) {
    if (seen.has(id)) {
      continue;
    }

    seen.add(id);
    result.push(id);
  }

  return result;
}

function isDefined<TValue>(value: TValue | undefined): value is TValue {
  return value !== undefined;
}
