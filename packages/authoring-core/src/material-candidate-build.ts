import { MaterialCandidateSchema, MaterialNormalizedImageSchema, type DiagnosticDto,
  type MaterialCandidate, type MaterialImpact, type MaterialNormalizedImage } from "@private-2d-rigging-lab/contracts";
import { cloneAuthoringSession, type AuthoringSession } from "./authoring-session.js";
import { registerMaterialImageBytes } from "./material-image-assets.js";
import { addDrawableFromImage, replaceDrawableImage } from "./material-image-drawable.js";
import { materialGraphAssetIds } from "./material-source-mapping.js";
import { materialDiagnostic, materialEqual, materialSha256 } from "./material-validation.js";

export type MaterialCandidateBuildResult =
  | { readonly status: "completed"; readonly workingSession: AuthoringSession; readonly impact: MaterialImpact; readonly diagnostics: DiagnosticDto[] }
  | { readonly status: "rejected"; readonly impact?: MaterialImpact; readonly diagnostics: DiagnosticDto[] };

/**
 * Pure, isolated build. Does not commit, fingerprint disk, grant approval or transition the DTO.
 * Caller verifies the base file-set fingerprint and serializes/hashes the returned workingSession.
 * The session retains the base packageRevision; the host owns saved version advancement.
 * Registers the candidate bytes itself, then delegates to addDrawableFromImage / replaceDrawableImage.
 */
export const buildMaterialCandidate = async (
  session: AuthoringSession, candidate: MaterialCandidate, normalizedImage: MaterialNormalizedImage
): Promise<MaterialCandidateBuildResult> => {
  const reject = (message: string, impact?: MaterialImpact): MaterialCandidateBuildResult => ({ status: "rejected",
    ...(impact ? { impact } : {}), diagnostics: [materialDiagnostic("buildRejected", message, { kind: "package", id: session.packageIdentity.packageId })] });
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
    const idSeed = findMaterialCandidateIdSeed(workingSession, c);
    registerMaterialImageBytes(workingSession, { idSeed, image: image.descriptor, rgbaBytes: image.rgbaBytes });
    const input = { image: image.descriptor, placement: c.placement, provenanceNote: c.provenance.note, idSeed, sourceLayerName: c.candidateId };
    const result = c.intent.kind === "add"
      ? addDrawableFromImage(workingSession, { ...input, intent: c.intent })
      : replaceDrawableImage(workingSession, { ...input, intent: c.intent });
    if (result.status === "rejected") return reject(result.diagnostics.map((item) => item.message).join("; "), result.impact);
    return { status: "completed", workingSession: result.session, impact: result.impact, diagnostics: [] };
  } catch (error) {
    return reject(error instanceof Error ? error.message : String(error));
  }
};

/** Candidate ID seed `${candidateId}_${candidateRevision}_${n}`: a new namespace on every build, never overwriting an asset. */
const findMaterialCandidateIdSeed = (session: AuthoringSession, candidate: MaterialCandidate): string => {
  const existing = materialGraphAssetIds(session);
  for (const item of session.binaryAssets?.fileEntries ?? []) existing.add(item.path).add(item.binaryAssetId ?? "");
  for (const item of session.binaryAssets?.binaryAssetIndex.assets ?? []) existing.add(item.binaryAssetId).add(item.packageRelativePath);
  let suffix = 0;
  let token: string;
  do { token = `${candidate.candidateId}_${candidate.candidateRevision}_${suffix++}`; }
  while ([`src_${token}`, `tex_${token}`, `prov_${token}`, `mesh_${token}`, `bin_${token}`, `layer_${token}`, `preview_${token}`,
    `assets/textures/${token}.rgba`].some((id) => existing.has(id)));
  return token;
};
