import type { DrawableDto } from "@private-2d-rigging-lab/package-format";

import { AuthoringMutationError } from "./authoring-mutations.js";
import { incrementAuthoringRevision } from "./authoring-revision.js";
import type { AuthoringRevision } from "./authoring-revision.js";
import type { AuthoringSession } from "./authoring-session.js";
import { getDrawableById } from "./drawable-selectors.js";

export interface RuntimeVisibilityMutationResult {
  readonly session: AuthoringSession;
  readonly drawableBefore: DrawableDto;
  readonly drawableAfter: DrawableDto;
  readonly authoringRevision: AuthoringRevision;
}

export const setDrawableRuntimeVisibility = (
  session: AuthoringSession,
  input: {
    readonly drawableId: DrawableDto["drawableId"];
    readonly runtimeVisibility: boolean;
  }
): RuntimeVisibilityMutationResult => {
  const drawable = getDrawableById(session.graph, input.drawableId);
  if (drawable === undefined) {
    throw new AuthoringMutationError(
      "missing_drawable",
      `Drawable does not exist: ${input.drawableId}.`
    );
  }

  if (drawable.runtimeVisibility === input.runtimeVisibility) {
    throw new AuthoringMutationError(
      "no_op_runtime_visibility_update",
      `Drawable ${input.drawableId} already has runtimeVisibility=${input.runtimeVisibility}.`
    );
  }

  const drawableBefore = structuredClone(drawable);
  drawable.runtimeVisibility = input.runtimeVisibility;
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
