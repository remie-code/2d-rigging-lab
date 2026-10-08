import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  BinaryAssetReferenceSchema,
  PackageDocumentSchema,
  collectWorkspaceBinaryAssetCandidates,
  createPackageBinaryFileEntry,
  createWorkspaceSavePlan,
  type BinaryAssetReferenceDto,
  type PackageDocumentDto
} from "./index.js";

const TEST_BYTES = new Uint8Array([0x61, 0x62, 0x63]);
const CORRUPT_BYTES = new Uint8Array([0x61, 0x62, 0x64]);
const TEST_BYTES_SHA256_HEX =
  "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
const RAW_RGBA_MEDIA_TYPE = "application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8";

describe("workspace save plan binary decisions", () => {
  it("skips an existing verified binary", async () => {
    const binaryAssetRef = createTextureBinaryAssetReference();
    const document = withTextureBinaryRef(loadMinimalFixturePackageDocument(), binaryAssetRef);
    const plan = await createWorkspaceSavePlan({
      packageDocument: document,
      existingWorkspaceBinaryFileEntries: [createBinaryEntry(binaryAssetRef, TEST_BYTES)]
    });
    const decision = getOnlyDecision(plan.binaryDecisions);

    expect(decision.action).toBe("skip");
    if (decision.action !== "skip") {
      throw new Error("Expected skip decision.");
    }
    expect(decision.existingVerificationReport.status).toBe("pass");
  });

  it("writes a missing binary when current session bytes verify", async () => {
    const binaryAssetRef = createTextureBinaryAssetReference();
    const document = withTextureBinaryRef(loadMinimalFixturePackageDocument(), binaryAssetRef);
    const plan = await createWorkspaceSavePlan({
      packageDocument: document,
      currentSessionBinaryFileEntries: [createBinaryEntry(binaryAssetRef, TEST_BYTES)]
    });
    const decision = getOnlyDecision(plan.binaryDecisions);

    expect(decision.action).toBe("write");
    if (decision.action !== "write") {
      throw new Error("Expected write decision.");
    }
    expect(decision.reason).toBe("existing-missing");
    expect(Array.from(decision.binaryEntry.bytes)).toEqual(Array.from(TEST_BYTES));
  });

  it("rewrites corrupt or mismatched workspace bytes when current session bytes verify", async () => {
    const binaryAssetRef = createTextureBinaryAssetReference();
    const document = withTextureBinaryRef(loadMinimalFixturePackageDocument(), binaryAssetRef);
    const digestMismatchPlan = await createWorkspaceSavePlan({
      packageDocument: document,
      existingWorkspaceBinaryFileEntries: [createBinaryEntry(binaryAssetRef, CORRUPT_BYTES)],
      currentSessionBinaryFileEntries: [createBinaryEntry(binaryAssetRef, TEST_BYTES)]
    });
    const mediaMismatchPlan = await createWorkspaceSavePlan({
      packageDocument: document,
      existingWorkspaceBinaryFileEntries: [
        createPackageBinaryFileEntry({
          path: binaryAssetRef.packageRelativePath,
          bytes: TEST_BYTES,
          mediaType: "application/octet-stream",
          binaryAssetId: binaryAssetRef.binaryAssetId
        })
      ],
      currentSessionBinaryFileEntries: [createBinaryEntry(binaryAssetRef, TEST_BYTES)]
    });

    const digestDecision = getOnlyDecision(digestMismatchPlan.binaryDecisions);
    const mediaDecision = getOnlyDecision(mediaMismatchPlan.binaryDecisions);

    expect(digestDecision.action).toBe("write");
    if (digestDecision.action !== "write") {
      throw new Error("Expected digest mismatch write decision.");
    }
    expect(digestDecision.reason).toBe("existing-digest-mismatch");
    expect(digestDecision.existingVerificationReport.issues.map((issue) => issue.code))
      .toContain("binary.digest.mismatch");

    expect(mediaDecision.action).toBe("write");
    if (mediaDecision.action !== "write") {
      throw new Error("Expected media mismatch write decision.");
    }
    expect(mediaDecision.reason).toBe("existing-media-type-mismatch");
    expect(mediaDecision.existingVerificationReport.issues.map((issue) => issue.code))
      .toContain("binary.mediaType.mismatch");
  });

  it("errors when current session bytes do not match the binary reference", async () => {
    const binaryAssetRef = createTextureBinaryAssetReference();
    const document = withTextureBinaryRef(loadMinimalFixturePackageDocument(), binaryAssetRef);
    const plan = await createWorkspaceSavePlan({
      packageDocument: document,
      currentSessionBinaryFileEntries: [createBinaryEntry(binaryAssetRef, CORRUPT_BYTES)]
    });
    const decision = getOnlyDecision(plan.binaryDecisions);

    expect(decision.action).toBe("error");
    if (decision.action !== "error") {
      throw new Error("Expected error decision.");
    }
    expect(decision.reason).toBe("session-bytes-mismatch");
    expect(decision.sessionVerificationReport?.issues.map((issue) => issue.code))
      .toContain("binary.digest.mismatch");
  });

  it("excludes PSD source bytes and writes only extracted layer texture bytes", async () => {
    const psdSourceRef = createSourcePsdBinaryAssetReference();
    const textureRef = createTextureBinaryAssetReference();
    const document = withPsdSourceAndTextureRefs(
      loadMinimalFixturePackageDocument(),
      psdSourceRef,
      textureRef
    );
    const collection = collectWorkspaceBinaryAssetCandidates(document);
    const plan = await createWorkspaceSavePlan({
      packageDocument: document,
      currentSessionBinaryFileEntries: [
        createBinaryEntry(psdSourceRef, TEST_BYTES),
        createBinaryEntry(textureRef, TEST_BYTES)
      ]
    });

    expect(collection.excluded).toEqual([
      expect.objectContaining({
        packageRelativePath: "assets/sources/browser-import/source.psd",
        reason: "psd-source-original-excluded-v1"
      })
    ]);
    expect(collection.candidates.map((candidate) => candidate.packageRelativePath)).toEqual([
      "assets/textures/body.raw-rgba"
    ]);
    expect(plan.binaryDecisions.map((decision) => decision.candidate.packageRelativePath)).toEqual([
      "assets/textures/body.raw-rgba"
    ]);
    expect(getOnlyDecision(plan.binaryDecisions).action).toBe("write");
  });

  it("collects generated atlas raw RGBA only after it is committed as a texture atlas artifact", async () => {
    const generatedAtlasRef = createTextureBinaryAssetReference({
      binaryAssetId: "bin_generated_atlas_page_0_rgba",
      packageRelativePath: "assets/textures/generated_atlas_page_0.raw-rgba",
      provenanceId: "prov_generated_atlas_page_0",
      rightsAssetId: "tex_generated_atlas_page_0"
    });
    const uncommittedPlan = await createWorkspaceSavePlan({
      packageDocument: loadMinimalFixturePackageDocument(),
      currentSessionBinaryFileEntries: [createBinaryEntry(generatedAtlasRef, TEST_BYTES)]
    });
    const committedPlan = await createWorkspaceSavePlan({
      packageDocument: withTextureBinaryRef(
        loadMinimalFixturePackageDocument(),
        generatedAtlasRef,
        "tex_generated_atlas_page_0"
      ),
      currentSessionBinaryFileEntries: [createBinaryEntry(generatedAtlasRef, TEST_BYTES)]
    });

    expect(uncommittedPlan.binaryDecisions).toEqual([]);
    expect(committedPlan.binaryCandidates.map((candidate) => candidate.packageRelativePath))
      .toEqual(["assets/textures/generated_atlas_page_0.raw-rgba"]);
    expect(getOnlyDecision(committedPlan.binaryDecisions).action).toBe("write");
  });
});

const getOnlyDecision = <TDecision>(decisions: readonly TDecision[]): TDecision => {
  expect(decisions).toHaveLength(1);
  const decision = decisions[0];

  if (decision === undefined) {
    throw new Error("Expected one workspace binary decision.");
  }

  return decision;
};

const createBinaryEntry = (
  binaryAssetRef: BinaryAssetReferenceDto,
  bytes: Uint8Array
) => createPackageBinaryFileEntry({
  path: binaryAssetRef.packageRelativePath,
  bytes,
  mediaType: binaryAssetRef.mediaType,
  binaryAssetId: binaryAssetRef.binaryAssetId
});

const createTextureBinaryAssetReference = (
  overrides: Readonly<Record<string, unknown>> = {}
): BinaryAssetReferenceDto => BinaryAssetReferenceSchema.parse({
  referenceKind: "package-binary-asset-ref-v1",
  binaryAssetId: "bin_texture_body_rgba",
  packageRelativePath: "assets/textures/body.raw-rgba",
  digest: { algorithm: "sha256", hex: TEST_BYTES_SHA256_HEX },
  byteLength: TEST_BYTES.byteLength,
  mediaType: RAW_RGBA_MEDIA_TYPE,
  storageStatus: "stored-package-local-v1",
  provenanceId: "prov_generated",
  rightsAssetId: "src_generated",
  ...overrides
});

const createSourcePsdBinaryAssetReference = (): BinaryAssetReferenceDto =>
  BinaryAssetReferenceSchema.parse({
    referenceKind: "package-binary-asset-ref-v1",
    binaryAssetId: "bin_browser_import_psd_source",
    packageRelativePath: "assets/sources/browser-import/source.psd",
    digest: { algorithm: "sha256", hex: TEST_BYTES_SHA256_HEX },
    byteLength: TEST_BYTES.byteLength,
    mediaType: "image/vnd.adobe.photoshop",
    storageStatus: "stored-package-local-v1",
    provenanceId: "prov_browser_import_psd",
    rightsAssetId: "src_browser_import_psd"
  });

const withTextureBinaryRef = (
  document: PackageDocumentDto,
  binaryAssetRef: BinaryAssetReferenceDto,
  textureId = "tex_body"
): PackageDocumentDto => PackageDocumentSchema.parse({
  ...document,
  assets: {
    ...document.assets,
    textureAtlas: {
      schemaVersion: "texture-atlas-v1",
      textures: [
        {
          textureId,
          filePath: binaryAssetRef.packageRelativePath,
          contentHash: `sha256:${binaryAssetRef.digest.hex}`,
          sourceAssetId: "src_generated",
          sourceLayerId: "layer_body",
          provenanceId: binaryAssetRef.provenanceId,
          binaryAssetRef
        }
      ]
    }
  }
});

const withPsdSourceAndTextureRefs = (
  document: PackageDocumentDto,
  psdSourceRef: BinaryAssetReferenceDto,
  textureRef: BinaryAssetReferenceDto
): PackageDocumentDto => PackageDocumentSchema.parse({
  ...document,
  assets: {
    ...document.assets,
    sourceManifest: {
      ...document.assets.sourceManifest,
      sourceAssets: [
        ...document.assets.sourceManifest.sourceAssets,
        {
          sourceAssetId: "src_browser_import_psd",
          kind: "psd-source-v1",
          filePath: psdSourceRef.packageRelativePath,
          contentHash: `sha256:${psdSourceRef.digest.hex}`,
          importProfile: "layered-character-psd-profile-v1",
          layers: [],
          diagnostics: [],
          binaryAssetRef: psdSourceRef
        }
      ]
    },
    textureAtlas: {
      schemaVersion: "texture-atlas-v1",
      textures: [
        {
          textureId: "tex_body",
          filePath: textureRef.packageRelativePath,
          contentHash: `sha256:${textureRef.digest.hex}`,
          sourceAssetId: "src_browser_import_psd",
          sourceLayerId: "layer_body",
          provenanceId: textureRef.provenanceId,
          binaryAssetRef: textureRef
        }
      ]
    },
    provenance: {
      ...document.assets.provenance,
      records: [
        ...document.assets.provenance.records,
        {
          provenanceId: "prov_browser_import_psd",
          assetId: "src_browser_import_psd",
          assetKind: "source",
          filePath: psdSourceRef.packageRelativePath,
          contentHash: `sha256:${psdSourceRef.digest.hex}`,
          creator: "browser-psd-import-test",
          license: "private-local",
          redistributionAllowed: false,
          aiUsed: false,
          transformHistory: [],
          relatedOperationIds: []
        }
      ]
    },
    rights: {
      ...document.assets.rights,
      records: [
        ...document.assets.rights.records,
        {
          assetId: "src_browser_import_psd",
          rightsStatus: "cleared",
          license: "private-local",
          redistributionAllowed: false
        }
      ]
    }
  }
});

const loadMinimalFixturePackageDocument = (): PackageDocumentDto => {
  const fixtureDirectory = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../fixtures/contracts/minimal-valid-package"
  );

  return PackageDocumentSchema.parse({
    manifest: readJson(join(fixtureDirectory, "manifest.json")),
    model: {
      graph: readJson(join(fixtureDirectory, "model/graph.json")),
      drawables: readJson(join(fixtureDirectory, "model/drawables.json")),
      meshes: readJson(join(fixtureDirectory, "model/meshes.json")),
      parameters: readJson(join(fixtureDirectory, "model/parameters.json")),
      keyforms: readJson(join(fixtureDirectory, "model/keyforms.json")),
      rigControls: readJson(join(fixtureDirectory, "model/rig-controls.json")),
      dynamics: readJson(join(fixtureDirectory, "model/dynamics.json")),
      masks: readJson(join(fixtureDirectory, "model/masks.json")),
      drawOrder: readJson(join(fixtureDirectory, "model/draw-order.json"))
    },
    assets: {
      sourceManifest: readJson(join(fixtureDirectory, "assets/sources/source-manifest.json")),
      provenance: readJson(join(fixtureDirectory, "assets/provenance.json")),
      rights: readJson(join(fixtureDirectory, "assets/rights.json"))
    }
  });
};

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, "utf8"));
