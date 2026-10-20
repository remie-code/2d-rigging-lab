import { MaterialAddIntentSchema, MaterialPlacementSchema, MaterialReplaceIntentSchema, type DiagnosticDto,
  type MaterialAddIntent, type MaterialImpact, type MaterialPlacement, type MaterialReplaceIntent } from "@private-2d-rigging-lab/contracts";
import { cloneAuthoringSessionSharingBinaryAssets, type AuthoringSession } from "./authoring-session.js";
import { analyzeMaterialImpact, materialAffectedDrawables } from "./material-impact-analysis.js";
import { materialRgbaHasVisiblePixel, planMaterialImageAssets, requireRegisteredMaterialImageBytes,
  type MaterialImageAssetPlan, type MaterialImageSubject } from "./material-image-assets.js";
import { createMaterialSourceMapping } from "./material-source-mapping.js";
import { addMaterialDrawable } from "./material-drawable-add.js";
import { replaceMaterialDrawable } from "./material-drawable-replace.js";
import { MaterialRejection, materialDiagnostic } from "./material-validation.js";
import { createPackageDocumentBaseFromAuthoringSession } from "./package-document-from-authoring-session.js";

export const MATERIAL_IMAGE_DRAWABLE_PHASE = "material-drawable-image";

interface MaterialImageDrawableInputBase {
  readonly image: MaterialImageSubject;
  readonly placement: MaterialPlacement;
  readonly provenanceNote: string;
  /** Every derived package ID uses this token: src_/tex_/prov_/mesh_/bin_/layer_/preview_<idSeed>. */
  readonly idSeed: string;
  /** Source layer name; defaults to the added display name or the replaced drawable's display name. */
  readonly sourceLayerName?: string;
}
export interface AddDrawableFromImageInput extends MaterialImageDrawableInputBase { readonly intent: MaterialAddIntent }
export interface ReplaceDrawableImageInput extends MaterialImageDrawableInputBase { readonly intent: MaterialReplaceIntent }

export type MaterialImageDrawableResult =
  | { readonly status: "completed"; readonly session: AuthoringSession; readonly impact: MaterialImpact;
      readonly assets: MaterialImageAssetPlan; readonly diagnostics: DiagnosticDto[] }
  | { readonly status: "rejected"; readonly impact?: MaterialImpact; readonly diagnostics: DiagnosticDto[] };

/**
 * Adds a drawable (part child, mesh, draw order, rig/mask membership, source, provenance, rights, texture) from
 * normalized RGBA bytes already registered in the session for `idSeed` (see registerMaterialImageBytes).
 * Pure: the input session is never changed; it does not register bytes or compute hashes.
 */
export const addDrawableFromImage = (session: AuthoringSession, input: AddDrawableFromImageInput): MaterialImageDrawableResult =>
  runMaterialImageDrawable(session, input, () => MaterialAddIntentSchema.parse(structuredClone(input.intent)));

/**
 * Replaces a drawable's image keeping its drawable ID: rebuilds its mesh and deletes exactly the declared direct
 * geometry keyforms. Rejects shared keyforms and shared meshes. Same purity and byte rules as addDrawableFromImage.
 */
export const replaceDrawableImage = (session: AuthoringSession, input: ReplaceDrawableImageInput): MaterialImageDrawableResult =>
  runMaterialImageDrawable(session, input, () => MaterialReplaceIntentSchema.parse(structuredClone(input.intent)));

const runMaterialImageDrawable = (
  session: AuthoringSession, input: MaterialImageDrawableInputBase, parseIntent: () => MaterialAddIntent | MaterialReplaceIntent
): MaterialImageDrawableResult => {
  let impact: MaterialImpact | undefined;
  try {
    const intent = parseIntent();
    const placement = MaterialPlacementSchema.parse(structuredClone(input.placement));
    if (input.provenanceNote.length === 0) throw new MaterialRejection("inputInvalid", "Provenance note must not be empty.");
    const working = cloneAuthoringSessionSharingBinaryAssets(session);
    const plan = planMaterialImageAssets(input.idSeed, input.image);
    const bytes = requireRegisteredMaterialImageBytes(working, plan);
    if (!materialRgbaHasVisiblePixel(bytes)) {
      throw new MaterialRejection("imageTransparent", "Fully transparent material cannot create a drawable.", { kind: "texture", id: plan.textureId });
    }
    impact = analyzeMaterialImpact(working, intent);
    if (intent.kind === "replace") {
      for (const id of intent.geometryReset.keyformSetIds) {
        const affectedDrawableIds = materialAffectedDrawables(working, { kind: "keyformSet", id });
        if (affectedDrawableIds.some((draw) => draw !== intent.drawableId)) {
          impact.refusedDeletions.push({ target: { kind: "keyformSet", id }, affectedDrawableIds, reason: "shared-control-key-parameter" });
        }
      }
      if (impact.refusedDeletions.length > 0) {
        throw new MaterialRejection("sharedKeyformReset", "Geometry reset includes unrelated/shared keyforms.", { kind: "drawable", id: intent.drawableId });
      }
    }
    const target = working.graph.drawables.find((item) => item.drawableId === intent.drawableId);
    if (intent.kind === "replace" && target === undefined) {
      throw new MaterialRejection("targetMissing", `Missing drawable: ${intent.drawableId}`, { kind: "drawable", id: intent.drawableId });
    }
    const mapping = createMaterialSourceMapping(working, { plan, image: input.image, placement, provenanceNote: input.provenanceNote,
      sourceLayerName: input.sourceLayerName ?? (intent.kind === "add" ? intent.displayName : target!.displayName) });
    if (intent.kind === "add") addMaterialDrawable(working, intent, mapping);
    else replaceMaterialDrawable(working, intent, mapping);
    impact.created.push({ kind: "sourceAsset", id: mapping.sourceAssetId }, { kind: "texture", id: mapping.textureId });
    if (intent.kind === "add") {
      impact.sharedReferences = analyzeMaterialImpact(working, intent).sharedReferences;
      impact.created.push({ kind: "drawable", id: intent.drawableId }, { kind: "mesh", id: mapping.meshId });
    }
    // Schema validation catches invalid generated coordinates or references representable by the package schema.
    createPackageDocumentBaseFromAuthoringSession(working, { createdAt: "2000-01-01T00:00:00.000Z" });
    return { status: "completed", session: working, impact, assets: plan, diagnostics: [] };
  } catch (error) {
    const rejection = error instanceof MaterialRejection ? error : undefined;
    return { status: "rejected", ...(impact ? { impact } : {}), diagnostics: [materialDiagnostic(rejection?.code ?? "drawableImageRejected",
      error instanceof Error ? error.message : String(error),
      rejection?.target ?? { kind: "package", id: session.packageIdentity.packageId }, MATERIAL_IMAGE_DRAWABLE_PHASE)] };
  }
};
