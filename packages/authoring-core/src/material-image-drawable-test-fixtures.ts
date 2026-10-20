import { createMaterialImageFixture, DrawableIdSchema, PartIdSchema,
  type MaterialAddIntent, type MaterialNormalizedImage, type MaterialPlacement, type MaterialReplaceIntent } from "@private-2d-rigging-lab/contracts";
import type { AuthoringSession } from "./authoring-session.js";
import { registerMaterialImageBytes } from "./material-image-assets.js";
import { addDrawableFromImage, replaceDrawableImage, type MaterialImageDrawableResult } from "./material-image-drawable.js";

export const imageAddIntent = (id = "draw_fixture", overrides: Partial<MaterialAddIntent> = {}): MaterialAddIntent => ({
  kind: "add", drawableId: DrawableIdSchema.parse(id), displayName: id, parentPartId: PartIdSchema.parse("part_root"),
  insertion: { position: "last" }, rigControlIds: [], maskBindings: [], runtimeVisibility: true, defaultOpacity: 1, ...overrides });

export const imageReplaceIntent = (id = "draw_fixture", keyformSetIds: string[] = []): MaterialReplaceIntent => ({
  kind: "replace", drawableId: DrawableIdSchema.parse(id), preserveLogicalDrawableId: true,
  geometryReset: { scope: "target-direct-geometry-keyforms", keyformSetIds: keyformSetIds as MaterialReplaceIntent["geometryReset"]["keyformSetIds"] },
  preserveExistingDeformers: true, sharedControlPolicy: "reject-shared-control-key-parameter-deletion" });

/** Returns a copy of `session` with the image bytes registered for `idSeed`, as a host would before an operation. */
export const withRegisteredImage = (session: AuthoringSession, idSeed: string, image: MaterialNormalizedImage = createMaterialImageFixture().image): AuthoringSession => {
  const next = structuredClone(session);
  registerMaterialImageBytes(next, { idSeed, image: image.descriptor, rgbaBytes: image.rgbaBytes });
  return next;
};

export interface ImageDrawableFixtureOptions {
  readonly image?: MaterialNormalizedImage;
  readonly placement?: MaterialPlacement;
}

const fixtureInput = (idSeed: string, options: ImageDrawableFixtureOptions) => {
  const fixture = createMaterialImageFixture();
  const image = options.image ?? fixture.image;
  return { image: image.descriptor, placement: options.placement ?? fixture.placement, provenanceNote: "Synthetic RGBA test input.", idSeed };
};

export const addImageDrawable = (session: AuthoringSession, idSeed: string, intent: MaterialAddIntent = imageAddIntent(),
  options: ImageDrawableFixtureOptions = {}): MaterialImageDrawableResult =>
  addDrawableFromImage(withRegisteredImage(session, idSeed, options.image), { ...fixtureInput(idSeed, options), intent });

export const replaceImageDrawable = (session: AuthoringSession, idSeed: string, intent: MaterialReplaceIntent = imageReplaceIntent(),
  options: ImageDrawableFixtureOptions = {}): MaterialImageDrawableResult =>
  replaceDrawableImage(withRegisteredImage(session, idSeed, options.image), { ...fixtureInput(idSeed, options), intent });

export const completedSession = (result: MaterialImageDrawableResult): AuthoringSession => {
  if (result.status !== "completed") throw new Error(JSON.stringify(result.diagnostics));
  return result.session;
};
