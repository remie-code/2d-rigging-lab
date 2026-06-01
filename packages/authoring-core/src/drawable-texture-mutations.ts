import type { DrawableId, TextureId } from "@private-2d-rigging-lab/contracts";
import type { DrawableDto, TextureAtlasEntryDto } from "@private-2d-rigging-lab/package-format";

import { AuthoringMutationError } from "./authoring-mutations.js";
import { incrementAuthoringRevision } from "./authoring-revision.js";
import type { AuthoringRevision } from "./authoring-revision.js";
import type { AuthoringSession } from "./authoring-session.js";
import { getDrawableById } from "./drawable-selectors.js";
import { getTextureAtlasEntryById } from "./texture-asset-selectors.js";

export interface DrawableTextureMutationResult {
  readonly session: AuthoringSession;
  readonly drawableBefore: DrawableDto;
  readonly drawableAfter: DrawableDto;
  readonly textureEntry: TextureAtlasEntryDto;
  readonly authoringRevision: AuthoringRevision;
}

export const setDrawableTexture = (
  session: AuthoringSession,
  input: {
    readonly drawableId: DrawableId;
    readonly textureId: TextureId;
  }
): DrawableTextureMutationResult => {
  const drawable = getDrawableById(session.graph, input.drawableId);
  if (drawable === undefined) {
    throw new AuthoringMutationError(
      "missing_drawable",
      `Drawable does not exist: ${input.drawableId}.`
    );
  }

  const textureEntry = getTextureAtlasEntryById(session.graph, input.textureId);
  if (textureEntry === undefined) {
    throw new AuthoringMutationError("missing_texture", `Texture does not exist: ${input.textureId}.`);
  }

  if (drawable.textureId === input.textureId) {
    throw new AuthoringMutationError(
      "no_op_drawable_texture_update",
      `Drawable ${input.drawableId} already uses texture ${input.textureId}.`
    );
  }

  const drawableBefore = structuredClone(drawable);
  drawable.textureId = input.textureId;
  const drawableAfter = structuredClone(drawable);

  session.authoringRevision = incrementAuthoringRevision(session.authoringRevision);
  session.dirty = true;

  return {
    session,
    drawableBefore,
    drawableAfter,
    textureEntry: structuredClone(textureEntry),
    authoringRevision: session.authoringRevision
  };
};
