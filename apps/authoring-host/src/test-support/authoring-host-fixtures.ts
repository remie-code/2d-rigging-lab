import { createHash } from "node:crypto";
import { join } from "node:path";

import {
  createTutorialMiniModelSeed,
  registerAuthoringSessionBinaryBytes,
  TUTORIAL_MINI_MODEL_IDS,
  type AuthoringSession
} from "@private-2d-rigging-lab/authoring-core";
import {
  createOperationCore,
  serializeOperationLogEntriesToJsonl
} from "@private-2d-rigging-lab/operation-core";
import type { OperationLogEntryDto } from "@private-2d-rigging-lab/operation-core";
import {
  BinaryAssetReferenceSchema,
  createWorkspaceMetadataForPackageDocument,
  serializeWorkspacePackageFileSet,
  type BinaryAssetReferenceDto,
  type PackageDocumentDto,
  type WorkspaceMetadataDto
} from "@private-2d-rigging-lab/package-format";

import { saveAuthoringPackageDirectory } from "../package-directory-io.js";

// This module is test-only fixture tooling. It builds deterministic on-disk
// open-model-package-v1 workspaces so the CLI tests can load, mutate, and save them
// without any rights-encumbered `ref/` asset. Everything here is synthetic.

export const FIXTURE_CREATED_AT = "2026-06-02T00:00:00.000Z";
export const FIXTURE_UPDATED_AT = "2026-06-02T00:00:00.000Z";
export const FIXTURE_TIMESTAMP = "2026-07-02T00:00:00.000Z";

const RAW_RGBA_MEDIA_TYPE = "application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8";

export interface EyeSmokeFixtureIds {
  readonly eyeDrawableId: string;
  readonly eyeMeshId: string;
  readonly eyeMaskDrawableId: string;
  readonly eyeMaskMeshId: string;
  readonly warpRigControlId: string;
  readonly parameterId: string;
}

export interface EyeSmokeFixture {
  readonly ids: EyeSmokeFixtureIds;
  readonly packageRevision: number;
}

/**
 * Writes a synthetic open-model-package-v1 workspace with two texture-backed drawables
 * (an eye and a white-eye mask), each carrying a generated mesh, plus a warp deformer
 * over the eye. The 5-operation closed-problem-01 smoke can then run generateMesh (re-mesh),
 * createWarpDeformer (second deformer), createParameter, editKeyformKey(createEndsCenter),
 * and setMaskRelation against this on-disk package.
 */
export const writeEyeSmokeFixturePackage = async (
  packageDirectory: string
): Promise<EyeSmokeFixture> => {
  const seed = createTutorialMiniModelSeed({
    createdAt: FIXTURE_CREATED_AT,
    updatedAt: FIXTURE_UPDATED_AT
  });
  const core = createOperationCore({ now: () => new Date(FIXTURE_TIMESTAMP) });
  const ids = TUTORIAL_MINI_MODEL_IDS;
  const setup = createSetupCommitter(core, seed.session);

  setup("createPart", { partId: ids.parts.body, displayName: "Body", lockedTargetIds: [] });
  setup("createPart", {
    partId: ids.parts.face,
    displayName: "Face",
    parentPartId: ids.parts.body,
    lockedTargetIds: []
  });
  setup("createDrawable", {
    sourceAssetId: ids.sourceAssetId,
    sourceLayerId: ids.layers.eye,
    textureId: ids.textures.eye,
    partId: ids.parts.face,
    displayName: "Eye"
  });
  setup("createDrawable", {
    sourceAssetId: ids.sourceAssetId,
    sourceLayerId: ids.layers.eyeMask,
    textureId: ids.textures.eyeMask,
    partId: ids.parts.face,
    displayName: "Eye Mask"
  });

  const eyeDrawable = requireDrawableByDisplayName(seed.session, "Eye");
  const eyeMaskDrawable = requireDrawableByDisplayName(seed.session, "Eye Mask");

  setup("generateMesh", {
    drawableId: eyeDrawable.drawableId,
    method: "auto-grid-v1",
    densityHint: "low"
  });
  setup("generateMesh", {
    drawableId: eyeMaskDrawable.drawableId,
    method: "auto-grid-v1",
    densityHint: "low"
  });

  registerFixtureTextureBytes(seed.session, ids.textures.eye, ids.layers.eye);

  await writeWorkspaceDirectory({
    packageDirectory,
    session: seed.session,
    operationLogEntries: core.operationLog.entries
  });

  return {
    ids: {
      eyeDrawableId: eyeDrawable.drawableId,
      eyeMeshId: eyeDrawable.meshId,
      eyeMaskDrawableId: eyeMaskDrawable.drawableId,
      eyeMaskMeshId: eyeMaskDrawable.meshId,
      warpRigControlId: "rig_eye_warp",
      parameterId: "param_eye_open"
    },
    packageRevision: seed.session.packageRevision
  };
};

/**
 * Writes the empty-graph tutorial seed package to disk. Useful for operations that need
 * no pre-existing model content (createParameter) or malformed-payload rejection tests.
 */
export const writeSeedFixturePackage = async (
  packageDirectory: string
): Promise<{ readonly packageRevision: number }> => {
  const seed = createTutorialMiniModelSeed({
    createdAt: FIXTURE_CREATED_AT,
    updatedAt: FIXTURE_UPDATED_AT
  });

  await writeWorkspaceDirectory({
    packageDirectory,
    session: seed.session,
    operationLogEntries: []
  });

  return { packageRevision: seed.session.packageRevision };
};

/**
 * Writes a package whose eye texture carries a real binary asset reference plus bytes so
 * the load/save round-trip test can prove binary textures are read from and written back
 * to disk (assets/textures/) in the Editor-parallel package structure.
 */
export const writeBinaryTextureFixturePackage = async (
  packageDirectory: string
): Promise<{ readonly texturePath: string; readonly byteLength: number }> => {
  const seed = createTutorialMiniModelSeed({
    createdAt: FIXTURE_CREATED_AT,
    updatedAt: FIXTURE_UPDATED_AT
  });
  const ids = TUTORIAL_MINI_MODEL_IDS;

  const registration = registerFixtureTextureBytes(seed.session, ids.textures.eye, ids.layers.eye);

  await writeWorkspaceDirectory({
    packageDirectory,
    session: seed.session,
    operationLogEntries: []
  });

  return {
    texturePath: registration.packageRelativePath,
    byteLength: registration.bytes.byteLength
  };
};

type SetupCommitter = (operationType: string, payload: unknown) => void;

const createSetupCommitter = (core: ReturnType<typeof createOperationCore>, session: AuthoringSession): SetupCommitter => {
  let basePackageRevision = session.packageRevision;
  let sequence = 0;

  return (operationType, payload) => {
    sequence += 1;
    const request: unknown = {
      schemaVersion: "operation-request-v1",
      operationId: `op_fixture_${operationType}_${sequence}`,
      actor: "test",
      surface: "testFixture",
      dryRun: false,
      basePackageRevision,
      operationType,
      payload,
      trace: { relatedAC: [], relatedScenarios: [] }
    };

    const outcome = core.commitOperation(session, request);
    if (outcome.result.status !== "committed") {
      const diagnostics = outcome.result.diagnostics
        .map((diagnostic) => `${diagnostic.checkId}:${diagnostic.message}`)
        .join("; ");
      throw new Error(
        `Fixture setup operation ${operationType} was not committed (${outcome.result.status}): ${diagnostics}`
      );
    }
    basePackageRevision = session.packageRevision;
  };
};

interface RegisteredFixtureTexture {
  readonly packageRelativePath: string;
  readonly bytes: Uint8Array;
}

const registerFixtureTextureBytes = (
  session: AuthoringSession,
  textureId: string,
  sourceLayerId: string
): RegisteredFixtureTexture => {
  const bytes = createSyntheticRgbaBytes(2, 2);
  const digestHex = createHash("sha256").update(bytes).digest("hex");
  const packageRelativePath = `assets/textures/${textureId}.raw-rgba`;
  const binaryAssetRef: BinaryAssetReferenceDto = BinaryAssetReferenceSchema.parse({
    referenceKind: "package-binary-asset-ref-v1",
    binaryAssetId: `bin_${textureId}`,
    packageRelativePath,
    digest: { algorithm: "sha256", hex: digestHex },
    byteLength: bytes.byteLength,
    mediaType: RAW_RGBA_MEDIA_TYPE,
    storageStatus: "stored-package-local-v1",
    provenanceId: TUTORIAL_MINI_MODEL_IDS.sourceProvenanceId,
    rightsAssetId: TUTORIAL_MINI_MODEL_IDS.sourceAssetId
  });

  const texture = session.graph.textureAtlas?.textures.find((entry) => entry.textureId === textureId);
  if (texture !== undefined) {
    texture.binaryAssetRef = binaryAssetRef;
  }

  registerAuthoringSessionBinaryBytes(session, {
    binaryAssetRef,
    bytes,
    role: "texture-raster-v1",
    sourceAssetId: TUTORIAL_MINI_MODEL_IDS.sourceAssetId,
    textureId
  });

  return { packageRelativePath, bytes };
};

const createSyntheticRgbaBytes = (width: number, height: number): Uint8Array => {
  const bytes = new Uint8Array(width * height * 4);
  for (let index = 0; index < bytes.length; index += 4) {
    const pixelIndex = index / 4;
    bytes[index] = (pixelIndex * 37) % 256;
    bytes[index + 1] = (pixelIndex * 53) % 256;
    bytes[index + 2] = (pixelIndex * 71) % 256;
    bytes[index + 3] = 255;
  }

  return bytes;
};

const requireDrawableByDisplayName = (
  session: AuthoringSession,
  displayName: string
): AuthoringSession["graph"]["drawables"][number] => {
  const drawable = session.graph.drawables.find((entry) => entry.displayName === displayName);
  if (drawable === undefined) {
    throw new Error(`Fixture drawable "${displayName}" was not created.`);
  }

  return drawable;
};

interface WriteWorkspaceDirectoryInput {
  readonly packageDirectory: string;
  readonly session: AuthoringSession;
  readonly operationLogEntries: readonly OperationLogEntryDto[];
}

const writeWorkspaceDirectory = async (input: WriteWorkspaceDirectoryInput): Promise<void> => {
  // Reuse the host save path for the initial write so the on-disk fixture is byte-identical
  // to what a later commit would produce (deterministic manifest, workspace metadata, and
  // binary decisions). saveAuthoringPackageDirectory derives the document from the session.
  await saveAuthoringPackageDirectory({
    packageDirectory: input.packageDirectory,
    session: input.session,
    baseDocument: buildFixtureBaseDocument(),
    workspaceMetadata: buildFixtureWorkspaceMetadata(),
    updatedAt: FIXTURE_UPDATED_AT,
    operationLogText: serializeOperationLogEntriesToJsonl(input.operationLogEntries)
  });
};

const buildFixtureWorkspaceMetadata = (): WorkspaceMetadataDto => ({
  schemaVersion: "ai-native-live2d-workspace-v1",
  workspaceKind: "directory-workspace-v1",
  packageEntrypoint: "manifest.json",
  createdAt: FIXTURE_CREATED_AT,
  updatedAt: FIXTURE_UPDATED_AT
});

const buildFixtureBaseDocument = (): PackageDocumentDto => {
  // The save path only needs the base document for manifest fields it carries over
  // (createdAt, evaluatorVersions, ...). A tutorial seed document supplies a valid base.
  const seed = createTutorialMiniModelSeed({
    createdAt: FIXTURE_CREATED_AT,
    updatedAt: FIXTURE_UPDATED_AT
  });

  return seed.packageDocument;
};

export const fixtureFilePath = (packageDirectory: string, packageRelativePath: string): string =>
  join(packageDirectory, ...packageRelativePath.split("/"));
