import type { DrawableId, PartId } from "@private-2d-rigging-lab/contracts";
import type { DrawableDto, ModelPartDto } from "@private-2d-rigging-lab/package-format";

import { AuthoringMutationError } from "./authoring-mutations.js";
import { incrementAuthoringRevision } from "./authoring-revision.js";
import type { AuthoringRevision } from "./authoring-revision.js";
import type { AuthoringSession } from "./authoring-session.js";
import { getDrawableById, getPartById } from "./drawable-selectors.js";

export interface DrawablePartMutationResult {
  readonly session: AuthoringSession;
  readonly drawableBefore: DrawableDto;
  readonly drawableAfter: DrawableDto;
  readonly previousPartBefore?: ModelPartDto;
  readonly previousPartAfter?: ModelPartDto;
  readonly nextPartBefore: ModelPartDto;
  readonly nextPartAfter: ModelPartDto;
  readonly authoringRevision: AuthoringRevision;
}

export const setDrawablePart = (
  session: AuthoringSession,
  input: {
    readonly drawableId: DrawableId;
    readonly partId: PartId;
  }
): DrawablePartMutationResult => {
  const drawable = getDrawableById(session.graph, input.drawableId);
  if (drawable === undefined) {
    throw new AuthoringMutationError(
      "missing_drawable",
      `Drawable does not exist: ${input.drawableId}.`
    );
  }

  const nextPart = getPartById(session.graph, input.partId);
  if (nextPart === undefined) {
    throw new AuthoringMutationError("missing_part", `Part does not exist: ${input.partId}.`);
  }

  const previousPart = getPartById(session.graph, drawable.partId);
  const membershipAlreadyCurrent =
    drawable.partId === input.partId &&
    previousPart?.drawableIds.filter((drawableId) => drawableId === input.drawableId).length === 1;
  if (membershipAlreadyCurrent) {
    throw new AuthoringMutationError(
      "no_op_drawable_part_update",
      `Drawable ${input.drawableId} already belongs to part ${input.partId}.`
    );
  }

  const drawableBefore = structuredClone(drawable);
  const previousPartBefore = previousPart === undefined ? undefined : structuredClone(previousPart);
  const nextPartBefore =
    previousPart?.partId === nextPart.partId ? structuredClone(nextPart) : structuredClone(nextPart);

  if (previousPart !== undefined) {
    previousPart.drawableIds = previousPart.drawableIds.filter(
      (drawableId) => drawableId !== input.drawableId
    );
  }

  if (!nextPart.drawableIds.includes(input.drawableId)) {
    nextPart.drawableIds.push(input.drawableId);
  }

  drawable.partId = input.partId;

  const drawableAfter = structuredClone(drawable);
  const previousPartAfter = previousPart === undefined ? undefined : structuredClone(previousPart);
  const nextPartAfter = structuredClone(nextPart);

  session.authoringRevision = incrementAuthoringRevision(session.authoringRevision);
  session.dirty = true;

  return {
    session,
    drawableBefore,
    drawableAfter,
    ...(previousPartBefore === undefined ? {} : { previousPartBefore }),
    ...(previousPartAfter === undefined ? {} : { previousPartAfter }),
    nextPartBefore,
    nextPartAfter,
    authoringRevision: session.authoringRevision
  };
};
