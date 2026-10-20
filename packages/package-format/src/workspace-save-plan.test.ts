import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { indexPackageInMemoryFileSet } from "./package-binary-file-index.js";
import {
  BinaryAssetReferenceSchema,
  PackageDocumentSchema,
  collectWorkspaceBinaryAssetCandidates,
  createPackageBinaryFileEntry,
  createWorkspaceSavePlan,
  type BinaryAssetReferenceDto,
  type PackageBinaryFileEntry,
  type PackageDocumentDto
} from "./index.js";

const TEST_BYTES = new Uint8Array([0x61, 0x62, 0x63]);
const CORRUPT_BYTES = new Uint8Array([0x61, 0x62, 0x64]);
const TEST_BYTES_SHA256_HEX =
  "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
const RAW_RGBA_MEDIA_TYPE = "application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8";

// Pass-through spy so a test can count how often a plan indexes (checks) its entry sets.
vi.mock("./package-binary-file-index.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./package-binary-file-index.js")>();

  return {
    ...actual,
    indexPackageInMemoryFileSet: vi.fn(actual.indexPackageInMemoryFileSet)
  };
});

beforeEach(() => {
  vi.mocked(indexPackageInMemoryFileSet).mockClear();
});

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

  it("copies texture bytes a constant number of times per candidate, never the whole set per candidate", async () => {
    // Scope of this test: the number of large byte copies grows linearly with the candidate count.
    // It counts byte copies only; how often the entry sets are indexed (checked) is covered by
    // "indexes each supplied entry set once per plan" below.
    // Before this was fixed, every candidate decision re-normalized and copied the whole entry set
    // (O(candidates x total bytes)); a real 133-texture save spent about 5 seconds there.
    // That implementation makes at least candidateCount^2 large copies here.
    const candidateCount = 12;
    const textures = Array.from({ length: candidateCount }, (_, index) => {
      const bytes = new Uint8Array(LARGE_COPY_THRESHOLD).fill(index + 1);

      return {
        bytes,
        ref: createTextureBinaryAssetReference({
          binaryAssetId: `bin_texture_${index}_rgba`,
          packageRelativePath: `assets/textures/texture_${index}.raw-rgba`,
          digest: { algorithm: "sha256", hex: createHash("sha256").update(bytes).digest("hex") },
          byteLength: bytes.byteLength
        })
      };
    });
    const document = withTextureBinaryRefs(
      loadMinimalFixturePackageDocument(),
      textures.map((texture) => texture.ref)
    );
    const entries = textures.map((texture) => createBinaryEntry(texture.ref, texture.bytes));
    const counterProbe = await countLargeByteCopies(async () => createBinaryEntry(
      textures[0]?.ref ?? createTextureBinaryAssetReference(),
      textures[0]?.bytes ?? TEST_BYTES
    ));

    // The counter sees package-format's byte copies (one copy for one created entry).
    expect(counterProbe.copies).toBe(1);

    const skip = await countLargeByteCopies(() => createWorkspaceSavePlan({
      packageDocument: document,
      existingWorkspaceBinaryFileEntries: entries
    }));
    const write = await countLargeByteCopies(() => createWorkspaceSavePlan({
      packageDocument: document,
      currentSessionBinaryFileEntries: entries
    }));

    expect(skip.result.binaryDecisions.map((decision) => decision.action))
      .toEqual(Array.from({ length: candidateCount }, () => "skip"));
    expect(write.result.binaryDecisions.map((decision) => decision.action))
      .toEqual(Array.from({ length: candidateCount }, () => "write"));
    // skip: one digest copy per candidate (existing bytes are not copied).
    // write: one session copy per entry when the plan starts, plus one digest copy per candidate.
    expect(skip.copies).toBeLessThanOrEqual(candidateCount);
    expect(write.copies).toBeLessThanOrEqual(2 * candidateCount);
  });

  it("still rejects duplicate or unsafe supplied entry paths before deciding", async () => {
    const binaryAssetRef = createTextureBinaryAssetReference();
    const document = withTextureBinaryRef(loadMinimalFixturePackageDocument(), binaryAssetRef);
    const entry = createBinaryEntry(binaryAssetRef, TEST_BYTES);

    await expect(createWorkspaceSavePlan({
      packageDocument: document,
      existingWorkspaceBinaryFileEntries: [entry, entry]
    })).rejects.toThrow(/Duplicate package file path/);
    await expect(createWorkspaceSavePlan({
      packageDocument: document,
      currentSessionBinaryFileEntries: [entry, { ...entry, path: "../escape.raw-rgba" }]
    })).rejects.toThrow();
  });

  it("hands out write bytes isolated from the supplied session entry", async () => {
    const binaryAssetRef = createTextureBinaryAssetReference();
    const document = withTextureBinaryRef(loadMinimalFixturePackageDocument(), binaryAssetRef);
    const sessionBytes = new Uint8Array(TEST_BYTES);
    const plan = await createWorkspaceSavePlan({
      packageDocument: document,
      currentSessionBinaryFileEntries: [{
        path: binaryAssetRef.packageRelativePath,
        bytes: sessionBytes,
        mediaType: binaryAssetRef.mediaType,
        binaryAssetId: binaryAssetRef.binaryAssetId
      }]
    });
    const decision = getOnlyDecision(plan.binaryDecisions);

    if (decision.action !== "write") {
      throw new Error("Expected write decision.");
    }
    expect(decision.binaryEntry.bytes).not.toBe(sessionBytes);
    sessionBytes[0] = 0x00;
    expect(Array.from(decision.binaryEntry.bytes)).toEqual(Array.from(TEST_BYTES));
  });

  it("decides against the session bytes as of the plan's start and writes the verified copy", async () => {
    const binaryAssetRef = createTextureBinaryAssetReference();
    const document = withTextureBinaryRef(loadMinimalFixturePackageDocument(), binaryAssetRef);
    const sessionBytes = new Uint8Array(TEST_BYTES);
    const pendingPlan = createWorkspaceSavePlan({
      packageDocument: document,
      currentSessionBinaryFileEntries: [createBinaryEntryWithoutCopy(binaryAssetRef, sessionBytes)]
    });

    // Mutating after the call returned (while the plan awaits digests) must not change the plan.
    sessionBytes.fill(0x00);
    const decision = getOnlyDecision((await pendingPlan).binaryDecisions);

    if (decision.action !== "write") {
      throw new Error("Expected write decision.");
    }
    expect(decision.sessionVerificationReport.status).toBe("pass");
    expect(Array.from(decision.binaryEntry.bytes)).toEqual(Array.from(TEST_BYTES));
  });

  it("indexes each supplied entry set once per plan, whatever the candidate count", async () => {
    const indexSpy = vi.mocked(indexPackageInMemoryFileSet);
    const callsPerPlan: number[] = [];

    for (const candidateCount of [1, 12]) {
      const refs = Array.from({ length: candidateCount }, (_, index) => createTextureBinaryAssetReference({
        binaryAssetId: `bin_texture_${index}_rgba`,
        packageRelativePath: `assets/textures/texture_${index}.raw-rgba`
      }));
      const entries = refs.map((ref) => createBinaryEntry(ref, TEST_BYTES));

      indexSpy.mockClear();
      const plan = await createWorkspaceSavePlan({
        packageDocument: withTextureBinaryRefs(loadMinimalFixturePackageDocument(), refs),
        existingWorkspaceBinaryFileEntries: [],
        currentSessionBinaryFileEntries: entries
      });

      expect(plan.binaryDecisions.map((decision) => decision.action))
        .toEqual(Array.from({ length: candidateCount }, () => "write"));
      callsPerPlan.push(indexSpy.mock.calls.length);
    }

    // One index for the existing entries and one for the session entries.
    expect(callsPerPlan).toEqual([2, 2]);
  });
});

/** A session entry that holds `bytes` by reference (createPackageBinaryFileEntry would copy them). */
const createBinaryEntryWithoutCopy = (
  binaryAssetRef: BinaryAssetReferenceDto,
  bytes: Uint8Array
): PackageBinaryFileEntry => ({
  path: binaryAssetRef.packageRelativePath,
  bytes,
  mediaType: binaryAssetRef.mediaType,
  binaryAssetId: binaryAssetRef.binaryAssetId
});

const LARGE_COPY_THRESHOLD = 4096;

/**
 * Counts `new Uint8Array(source)` calls whose source is at least LARGE_COPY_THRESHOLD bytes
 * (package-format copies bytes that way) while `run` executes.
 */
const countLargeByteCopies = async <TResult>(
  run: () => Promise<TResult>
): Promise<{ readonly result: TResult; readonly copies: number }> => {
  const OriginalUint8Array = globalThis.Uint8Array;
  let copies = 0;
  const countingUint8Array: Uint8ArrayConstructor = new Proxy(OriginalUint8Array, {
    construct(target, args, newTarget): object {
      const source: unknown = args[0];
      const isLargeByteSource = (ArrayBuffer.isView(source) || source instanceof ArrayBuffer) &&
        source.byteLength >= LARGE_COPY_THRESHOLD;

      if (isLargeByteSource) {
        copies += 1;
      }

      return Reflect.construct(target, args, newTarget === countingUint8Array ? target : newTarget);
    }
  });

  globalThis.Uint8Array = countingUint8Array;

  try {
    const result = await run();
    return { result, copies };
  } finally {
    globalThis.Uint8Array = OriginalUint8Array;
  }
};

const withTextureBinaryRefs = (
  document: PackageDocumentDto,
  binaryAssetRefs: readonly BinaryAssetReferenceDto[]
): PackageDocumentDto => PackageDocumentSchema.parse({
  ...document,
  assets: {
    ...document.assets,
    textureAtlas: {
      schemaVersion: "texture-atlas-v1",
      textures: binaryAssetRefs.map((binaryAssetRef, index) => ({
        textureId: `tex_body_${index}`,
        filePath: binaryAssetRef.packageRelativePath,
        contentHash: `sha256:${binaryAssetRef.digest.hex}`,
        sourceAssetId: "src_generated",
        sourceLayerId: `layer_body_${index}`,
        provenanceId: binaryAssetRef.provenanceId,
        binaryAssetRef
      }))
    }
  }
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
