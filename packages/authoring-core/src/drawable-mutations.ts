import type {
  DrawableDto,
  MeshDto,
  ProvenanceRecordDto
} from "@private-2d-rigging-lab/package-format";

import { AuthoringMutationError } from "./authoring-mutations.js";
import { incrementAuthoringRevision } from "./authoring-revision.js";
import type { AuthoringRevision } from "./authoring-revision.js";
import type { AuthoringSession } from "./authoring-session.js";
import { addDrawOrderEntry, createNextDrawOrderEntry } from "./draw-order-mutations.js";
import {
  getPartById,
  getSourceAssetById,
  hasDrawable,
  hasMesh
} from "./drawable-selectors.js";
import { appendPartOrderedChild, createDrawableChildEntry } from "./part-children-order.js";
import { upsertProvenanceRecord } from "./mesh-mutations.js";
import { addStableOrderId } from "./stable-order-mutations.js";

export interface CreateDrawableWithMeshMutationResult {
  readonly session: AuthoringSession;
  readonly drawable: DrawableDto;
  readonly mesh: MeshDto;
  readonly authoringRevision: AuthoringRevision;
}

export interface UpdateDrawableMutationResult {
  readonly session: AuthoringSession;
  readonly drawableBefore: DrawableDto;
  readonly drawableAfter: DrawableDto;
  readonly authoringRevision: AuthoringRevision;
}

export const createDrawableWithMesh = (
  session: AuthoringSession,
  input: {
    readonly drawable: DrawableDto;
    readonly mesh: MeshDto;
    readonly sourceLayerId?: string;
    readonly sourceProvenanceRecord?: ProvenanceRecordDto;
    readonly meshProvenanceRecord?: ProvenanceRecordDto;
  }
): CreateDrawableWithMeshMutationResult => {
  assertCanCreateDrawableWithMesh(session, input.drawable, input.mesh);

  const storedDrawable = structuredClone(input.drawable);
  const storedMesh = structuredClone(input.mesh);
  session.graph.drawables.push(storedDrawable);
  session.graph.meshes.push(storedMesh);
  addDrawableToPart(session, storedDrawable);
  mapDrawableToSourceLayer(session, storedDrawable, input.sourceLayerId);
  addDrawOrderEntry(session.graph, createNextDrawOrderEntry(session.graph, storedDrawable.drawableId));
  addStableOrderId(session.graph, storedDrawable.drawableId);

  if (input.sourceProvenanceRecord !== undefined) {
    upsertProvenanceRecord(session, input.sourceProvenanceRecord);
  }

  if (input.meshProvenanceRecord !== undefined) {
    upsertProvenanceRecord(session, input.meshProvenanceRecord);
  }

  session.authoringRevision = incrementAuthoringRevision(session.authoringRevision);
  session.dirty = true;

  return {
    session,
    drawable: storedDrawable,
    mesh: storedMesh,
    authoringRevision: session.authoringRevision
  };
};

const assertCanCreateDrawableWithMesh = (
  session: AuthoringSession,
  drawable: DrawableDto,
  mesh: MeshDto
): void => {
  if (hasDrawable(session.graph, drawable.drawableId)) {
    throw new AuthoringMutationError(
      "duplicate_drawable",
      `Drawable already exists: ${drawable.drawableId}`
    );
  }

  if (hasMesh(session.graph, mesh.meshId)) {
    throw new AuthoringMutationError("duplicate_mesh", `Mesh already exists: ${mesh.meshId}`);
  }

  if (drawable.meshId !== mesh.meshId || drawable.drawableId !== mesh.drawableId) {
    throw new AuthoringMutationError(
      "missing_mesh",
      `Drawable ${drawable.drawableId} and mesh ${mesh.meshId} are not linked.`
    );
  }

  if (getPartById(session.graph, drawable.partId) === undefined) {
    throw new AuthoringMutationError("missing_part", `Part does not exist: ${drawable.partId}`);
  }

  if (getSourceAssetById(session.graph, drawable.sourceAssetId) === undefined) {
    throw new AuthoringMutationError(
      "missing_source_asset",
      `Source asset does not exist: ${drawable.sourceAssetId}`
    );
  }
};

const addDrawableToPart = (session: AuthoringSession, drawable: DrawableDto): void => {
  const part = getPartById(session.graph, drawable.partId);
  if (part !== undefined) {
    appendPartOrderedChild(session.graph, part, createDrawableChildEntry(drawable.drawableId));
  }
};

const mapDrawableToSourceLayer = (
  session: AuthoringSession,
  drawable: DrawableDto,
  sourceLayerId: string | undefined
): void => {
  if (sourceLayerId === undefined) {
    return;
  }

  const sourceAsset = getSourceAssetById(session.graph, drawable.sourceAssetId);
  const sourceLayer = sourceAsset?.layers.find((layer) => layer.sourceLayerId === sourceLayerId);
  if (sourceLayer !== undefined && !sourceLayer.mappedDrawableIds.includes(drawable.drawableId)) {
    sourceLayer.mappedDrawableIds.push(drawable.drawableId);
  }
};

export const updateDrawable = (
  session: AuthoringSession,
  input: {
    readonly drawableId: DrawableDto["drawableId"];
    readonly displayName?: string;
    readonly defaultOpacity?: number;
  }
): UpdateDrawableMutationResult => {
  const drawable = session.graph.drawables.find(
    (candidate) => candidate.drawableId === input.drawableId
  );
  if (drawable === undefined) {
    throw new AuthoringMutationError(
      "missing_drawable",
      `Drawable does not exist: ${input.drawableId}.`
    );
  }

  if (input.displayName !== undefined && input.displayName.trim().length === 0) {
    throw new AuthoringMutationError(
      "invalid_drawable_display_name",
      `Drawable display name must not be blank: ${input.drawableId}.`
    );
  }

  if (
    input.defaultOpacity !== undefined &&
    (input.defaultOpacity < 0 || input.defaultOpacity > 1)
  ) {
    throw new AuthoringMutationError(
      "invalid_drawable_opacity",
      `Drawable opacity must be between 0 and 1: ${input.defaultOpacity}.`
    );
  }

  const displayNameChanged =
    input.displayName !== undefined && input.displayName !== drawable.displayName;
  const opacityChanged =
    input.defaultOpacity !== undefined && input.defaultOpacity !== drawable.defaultOpacity;
  if (!displayNameChanged && !opacityChanged) {
    throw new AuthoringMutationError(
      "no_op_drawable_update",
      `Drawable ${input.drawableId} is already up to date.`
    );
  }

  const drawableBefore = structuredClone(drawable);
  if (input.displayName !== undefined) {
    drawable.displayName = input.displayName;
  }

  if (input.defaultOpacity !== undefined) {
    drawable.defaultOpacity = input.defaultOpacity;
  }

  const drawableAfter = structuredClone(drawable);
  session.authoringRevision = incrementAuthoringRevision(session.authoringRevision);
  session.dirty = true;

  return {
    session,
    drawableBefore,
    drawableAfter,
    authoringRevision: session.authoringRevision
  };
};
