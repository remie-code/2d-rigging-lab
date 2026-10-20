import { cloneAuthoringSessionSharingBinaryAssets, planMaterialImageAssets, registerMaterialImageBytes,
  type AuthoringSession, type MaterialImageAssetPlan } from "@private-2d-rigging-lab/authoring-core";
import { createMaterialImageIdSeed, createOperationDiagnostic, createRejectedOperationResult, resolveOperationId,
  type OperationRequestDto, type OperationResultDto } from "@private-2d-rigging-lab/operation-core";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { HostError, hostErrorCheckToken } from "./host-error.js";
import { readMaterialImageFile } from "./material-image-file.js";

export type MaterialImageOperationRequest = Extract<OperationRequestDto, { operationType: "addDrawableFromImage" | "replaceDrawableImage" }>;

export const isMaterialImageOperationRequest = (request: OperationRequestDto): request is MaterialImageOperationRequest =>
  request.operationType === "addDrawableFromImage" || request.operationType === "replaceDrawableImage";

export type MaterialImageOperationSession =
  | { readonly status: "ready"; readonly session: AuthoringSession }
  | { readonly status: "rejected"; readonly result: OperationResultDto };

/**
 * Host step before dry-run or commit of addDrawableFromImage / replaceDrawableImage. Reads and checks the PNG named
 * by `payload.image`, then registers its RGBA bytes for the ID seed of the request's operationId
 * (createMaterialImageIdSeed(resolveOperationId(request))). The bytes go into a new session that shares the existing
 * bytes; `session` itself is never changed, so a dry-run, rejection or failure leaves nothing behind. Any image
 * problem returns a rejected operation result and the operation must not run.
 */
export const prepareMaterialImageOperationSession = async (
  session: AuthoringSession, request: MaterialImageOperationRequest, packageDirectory?: string
): Promise<MaterialImageOperationSession> => {
  const operationId = resolveOperationId(request);
  try {
    const image = await readMaterialImageFile(request.payload.image);
    const idSeed = createMaterialImageIdSeed(operationId);
    const plan = planImageAssets(idSeed, image.descriptor);
    assertImageAssetUnused(session, plan);
    if (packageDirectory !== undefined) await assertNoDifferentFileOnDisk(packageDirectory, plan, image.rgbaBytes);
    const prepared = cloneAuthoringSessionSharingBinaryAssets(session);
    registerMaterialImageBytes(prepared, { idSeed, image: image.descriptor, rgbaBytes: image.rgbaBytes, createdByOperationId: operationId });
    return { status: "ready", session: prepared };
  } catch (error) {
    if (!(error instanceof HostError)) throw error;
    return { status: "rejected", result: createRejectedOperationResult({ operationId, diagnostics: [createOperationDiagnostic({
      checkId: `operation.${request.operationType}.${hostErrorCheckToken(error.code)}`,
      message: error.message,
      target: { kind: "operation", id: operationId },
      evidence: [`imagePath=${request.payload.image.imagePath}`]
    })] }) };
  }
};

const planImageAssets = (idSeed: string, image: Parameters<typeof planMaterialImageAssets>[1]): MaterialImageAssetPlan => {
  try {
    return planMaterialImageAssets(idSeed, image);
  } catch (error) {
    throw new HostError("id-seed-invalid", error instanceof Error ? error.message : String(error));
  }
};

/** Never overwrite package bytes: an operationId already used for an image leaves its bytes behind, so a rerun is an ID collision. */
const assertImageAssetUnused = (session: AuthoringSession, plan: MaterialImageAssetPlan): void => {
  const ref = plan.binaryAssetRef;
  const assets = session.binaryAssets;
  if (assets?.fileEntries.some((entry) => entry.path === ref.packageRelativePath || entry.binaryAssetId === ref.binaryAssetId) ||
      assets?.binaryAssetIndex.assets.some((entry) => entry.binaryAssetId === ref.binaryAssetId || entry.packageRelativePath === ref.packageRelativePath)) {
    throw new HostError("id-collision", `Image bytes for ID seed ${plan.idSeed} already exist at ${ref.packageRelativePath}; use a new operationId.`);
  }
};

/**
 * A file the package JSON does not reference can still sit at the texture path (left by an earlier, unrecorded run).
 * Saving would overwrite it, so a different file there is an ID collision. Identical bytes are accepted.
 */
const assertNoDifferentFileOnDisk = async (packageDirectory: string, plan: MaterialImageAssetPlan, rgbaBytes: Uint8Array): Promise<void> => {
  const path = join(packageDirectory, ...plan.filePath.split("/"));
  let existing: Uint8Array;
  try {
    existing = new Uint8Array(await readFile(path));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw new HostError("image-asset-unreadable", `Cannot inspect existing file ${plan.filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (existing.byteLength !== rgbaBytes.byteLength || !existing.every((value, index) => value === rgbaBytes[index])) {
    throw new HostError("id-collision", `A different file already exists at ${plan.filePath}; use a new operationId.`);
  }
};
