import { MaterialCandidateSchema, MaterialNormalizedImageSchema, type DiagnosticDto,
  type MaterialCandidate, type MaterialImpact, type MaterialNormalizedImage } from "@private-2d-rigging-lab/contracts";
import { cloneAuthoringSession, type AuthoringSession } from "./authoring-session.js";
import { analyzeMaterialImpact, materialAffectedDrawables } from "./material-impact-analysis.js";
import { createMaterialSourceMapping } from "./material-source-mapping.js";
import { addMaterialDrawable } from "./material-drawable-add.js";
import { replaceMaterialDrawable } from "./material-drawable-replace.js";
import { materialDiagnostic, materialEqual, materialSha256 } from "./material-validation.js";
import { createPackageDocumentBaseFromAuthoringSession } from "./package-document-from-authoring-session.js";

export type MaterialCandidateBuildResult =
  | { readonly status: "completed"; readonly workingSession: AuthoringSession; readonly impact: MaterialImpact; readonly diagnostics: DiagnosticDto[] }
  | { readonly status: "rejected"; readonly impact?: MaterialImpact; readonly diagnostics: DiagnosticDto[] };

/**
 * Pure, isolated build. Does not commit, fingerprint disk, grant approval or transition the DTO.
 * Caller verifies the base file-set fingerprint and serializes/hashes the returned workingSession.
 * The session retains the base packageRevision; the host owns saved version advancement.
 */
export const buildMaterialCandidate = async (
  session: AuthoringSession, candidate: MaterialCandidate, normalizedImage: MaterialNormalizedImage
): Promise<MaterialCandidateBuildResult> => {
  let impact: MaterialImpact | undefined;
  try {
    // Snapshot before the first await: caller changes cannot race validation vs construction.
    const workingSession = cloneAuthoringSession(session);
    const c = MaterialCandidateSchema.parse(structuredClone(candidate));
    const image = MaterialNormalizedImageSchema.parse(structuredClone(normalizedImage));
    if (!["registered", "working", "approved"].includes(c.state)) throw new Error(`Candidate cannot build from state ${c.state}.`);
    if (workingSession.packageIdentity.packageId !== c.basePackage.packageId || workingSession.packageRevision !== c.basePackage.packageRevision) {
      throw new Error("Candidate base package identity/revision is stale.");
    }
    if (!materialEqual(c.image, image.descriptor)) throw new Error("Candidate image descriptor does not match normalized image.");
    if (image.descriptor.alpha.nonTransparentPixelCount === 0) throw new Error("Fully transparent material cannot create a drawable candidate.");
    if (await materialSha256(image.rgbaBytes) !== image.descriptor.rgbaSha256) throw new Error("Normalized RGBA SHA-256 does not match bytes.");
    impact = analyzeMaterialImpact(workingSession, c.intent);
    if (c.intent.kind === "replace") {
      for (const id of c.intent.geometryReset.keyformSetIds) {
        const affectedDrawableIds = materialAffectedDrawables(workingSession, { kind: "keyformSet", id });
        if (affectedDrawableIds.some((draw) => draw !== c.intent.drawableId)) {
          impact.refusedDeletions.push({ target: { kind: "keyformSet", id }, affectedDrawableIds, reason: "shared-control-key-parameter" });
        }
      }
      if (impact.refusedDeletions.length > 0) throw new Error("Geometry reset includes unrelated/shared keyforms.");
    }
    const mapping = createMaterialSourceMapping(workingSession, c, image);
    if (c.intent.kind === "add") addMaterialDrawable(workingSession, c.intent, mapping);
    else replaceMaterialDrawable(workingSession, c.intent, mapping);
    impact.created.push({ kind: "sourceAsset", id: mapping.sourceAssetId }, { kind: "texture", id: mapping.textureId });
    if (c.intent.kind === "add") impact.sharedReferences = analyzeMaterialImpact(workingSession, c.intent).sharedReferences;
    if (c.intent.kind === "add") impact.created.push({ kind: "drawable", id: c.intent.drawableId }, { kind: "mesh", id: mapping.meshId });
    // Schema validation catches invalid generated coordinates or references representable by the package schema.
    createPackageDocumentBaseFromAuthoringSession(workingSession, { createdAt: "2000-01-01T00:00:00.000Z" });
    return { status: "completed", workingSession, impact, diagnostics: [] };
  } catch (error) {
    return { status: "rejected", ...(impact ? { impact } : {}), diagnostics: [materialDiagnostic("buildRejected",
      error instanceof Error ? error.message : String(error), { kind: "package", id: session.packageIdentity.packageId })] };
  }
};
