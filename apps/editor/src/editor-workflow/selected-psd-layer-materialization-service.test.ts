import { readFile } from "node:fs/promises";

import {
  describe,
  expect,
  it
} from "vitest";
import type { BinaryAssetDigestDto } from "@private-2d-rigging-lab/package-format";

import {
  materializeSelectedPsdLayerFromArrayBuffer,
  materializeSelectedPsdLayerFromBrowserFile,
  parseExplicitBrowserPsdArrayBuffer,
  selectedPsdLayerMaterializedAssetMediaType,
  verifySelectedPsdLayerMaterializedAssetCandidate
} from "./index.js";

const samplePsdPath = "test_data/sample_model.psd";
const samplePsdSourceDigestHex =
  "44ab43238cd2b2af2fb0ce6a7b5073a60e332d03da7666ea274c02e0462294b5";
const sampleHeadwearLayerDigestHex =
  "671e6a363745b1ce2e8d29c1a63438170fe9511c8884ea42298cf9b8886e5c1a";

describe("selected PSD layer materialization service", () => {
  it("materializes the private sample selected layer into a parser-free raw RGBA candidate", async () => {
    const sampleBytes = await readFile(samplePsdPath);
    const result = await materializeSelectedPsdLayerFromArrayBuffer({
      fileName: "sample_model.psd",
      bytes: sampleBytes,
      declaredMediaType: "image/vnd.adobe.photoshop",
      sourceAssetId: "src_wave46_sample_model_psd",
      selectedLayerNodeRef: "psd:root/layer[0]"
    });

    expect(result.status).toBe("materialized");
    if (result.status !== "materialized") {
      throw new Error(`Expected materialized result, got ${result.status}.`);
    }

    expect(result.source.intakeKind).toBe("explicitArrayBuffer");
    expect(result.candidate.bytes.byteLength).toBe(460800);
    expect(result.candidate.evidence).toMatchObject({
      evidenceKind: "selected-psd-layer-materialized-asset-candidate-evidence-v1",
      mediaType: selectedPsdLayerMaterializedAssetMediaType,
      pixelFormat: "rgba8",
      width: 400,
      height: 288,
      byteLength: 460800,
      digest: {
        algorithm: "sha256",
        hex: sampleHeadwearLayerDigestHex
      },
      sourcePsd: {
        sourceAssetId: "src_wave46_sample_model_psd",
        fileName: "sample_model.psd",
        byteLength: 22406225,
        digest: {
          algorithm: "sha256",
          hex: samplePsdSourceDigestHex
        }
      },
      sourceLayer: {
        sourceLayerId: "psd:root/layer[0]",
        originalName: "headwear"
      },
      parser: {
        parserName: "webtoonPsd",
        parserPackageName: "@webtoon/psd",
        parserVersion: "0.4.0",
        runtime: "browser",
        privateShapePolicy: "parser-private-shape-excluded-v1"
      },
      extraction: {
        extractionKind: "selectedLayerRasterV1",
        optionsSchemaVersion: "psd-layer-extraction-options-v1",
        options: {
          parserMethod: "Layer.composite(false, false)",
          effect: false,
          composed: false,
          selectedNodeRef: "psd:root/layer[0]",
          outputEncoding: "raw-rgba",
          channelOrder: "rgba",
          pixelFormat: "rgba8",
          width: 400,
          height: 288
        }
      },
      provenance: {
        sourceInput: "explicit-user-selected-private-local-psd-v1",
        privacyLabel: "private/local",
        publicDemoAsset: false,
        materializedBytePersistence: "editor-local-candidate-only-not-persisted-by-domain-b-v1"
      },
      storageBoundary: {
        storageScope: "editor-local-candidate-only-v1",
        packageStorageIdentity: "not-assigned-domain-c-d-owned-v1",
        persistentBinaryAssetRef: "not-created-by-domain-b-v1"
      }
    });
    expect(JSON.stringify(result.candidate.evidence)).not.toContain("\"children\"");
    expect(JSON.stringify(result.candidate.evidence)).not.toContain("stack");
  });

  it("preserves explicit File intake evidence for successful browser File materialization", async () => {
    const sampleBytes = await readFile(samplePsdPath);
    const browserArrayBuffer = new ArrayBuffer(sampleBytes.byteLength);
    new Uint8Array(browserArrayBuffer).set(sampleBytes);
    let arrayBufferReadCount = 0;
    const file = {
      name: "sample_model.psd",
      size: sampleBytes.byteLength,
      type: "image/vnd.adobe.photoshop",
      async arrayBuffer() {
        arrayBufferReadCount += 1;
        return browserArrayBuffer.slice(0);
      }
    } as File;

    const result = await materializeSelectedPsdLayerFromBrowserFile({
      file,
      sourceAssetId: "src_wave46_browser_file_psd",
      selectedLayerNodeRef: "psd:root/layer[0]"
    });

    expect(arrayBufferReadCount).toBe(1);
    expect(result.status).toBe("materialized");
    if (result.status !== "materialized") {
      throw new Error(`Expected materialized result, got ${result.status}.`);
    }

    expect(result.source).toMatchObject({
      intakeKind: "explicitFile",
      sourceAssetId: "src_wave46_browser_file_psd",
      fileName: "sample_model.psd",
      declaredMediaType: "image/vnd.adobe.photoshop",
      byteLength: sampleBytes.byteLength,
      privacy: {
        privacyLabel: "packageLocalAsset",
        publicDistribution: "notPublicDistributable",
        rawBytesPersistence: "notPersistedByParserBridge"
      }
    });
    expect(result.candidate.evidence).toMatchObject({
      sourcePsd: {
        sourceAssetId: "src_wave46_browser_file_psd",
        fileName: "sample_model.psd",
        declaredMediaType: "image/vnd.adobe.photoshop",
        byteLength: sampleBytes.byteLength,
        digest: {
          algorithm: "sha256",
          hex: samplePsdSourceDigestHex
        }
      },
      provenance: {
        sourceInput: "explicit-user-selected-private-local-psd-v1",
        privacyLabel: "private/local",
        publicDemoAsset: false,
        materializedBytePersistence: "editor-local-candidate-only-not-persisted-by-domain-b-v1"
      },
      storageBoundary: {
        storageScope: "editor-local-candidate-only-v1",
        packageStorageIdentity: "not-assigned-domain-c-d-owned-v1",
        persistentBinaryAssetRef: "not-created-by-domain-b-v1"
      }
    });
  });

  it("preflights browser File source oversize without reading bytes", async () => {
    let arrayBufferReadCount = 0;
    const file = {
      name: "oversize.psd",
      size: 4,
      type: "image/vnd.adobe.photoshop",
      async arrayBuffer() {
        arrayBufferReadCount += 1;
        return new Uint8Array([1, 2, 3, 4]).buffer;
      }
    } as File;

    const result = await materializeSelectedPsdLayerFromBrowserFile({
      file,
      selectedLayerNodeRef: "psd:root/layer[0]",
      sizeCapBytes: 3
    });

    expect(result.status).toBe("failed");
    if (result.status !== "failed") {
      throw new Error(`Expected failed result, got ${result.status}.`);
    }

    expect(arrayBufferReadCount).toBe(0);
    expect(result.failure).toMatchObject({
      failureKind: "sourceOversize",
      selectedLayerNodeRef: "psd:root/layer[0]",
      source: {
        fileName: "oversize.psd",
        byteLength: 4,
        sizeCapBytes: 3
      },
      provenance: {
        publicDemoAsset: false
      }
    });
  });

  it("returns stale source mismatch evidence before parser execution", async () => {
    const result = await materializeSelectedPsdLayerFromArrayBuffer({
      fileName: "stale-source.psd",
      bytes: new Uint8Array([1, 2, 3, 4]),
      selectedLayerNodeRef: "psd:root/layer[0]",
      expectedSource: {
        digest: digest("0000000000000000000000000000000000000000000000000000000000000000"),
        byteLength: 999
      }
    });

    expect(result.status).toBe("failed");
    if (result.status !== "failed") {
      throw new Error(`Expected failed result, got ${result.status}.`);
    }

    expect(result.failure.failureKind).toBe("sourceMismatch");
    expect(result.failure.sourceDigest?.algorithm).toBe("sha256");
    expect(result.failure.checks).toEqual(
      expect.arrayContaining([
        expect.stringContaining("sourceByteLengthMismatch"),
        expect.stringContaining("sourceDigestMismatch")
      ])
    );
    expect(result.failure.checks).not.toContain("parserExecuted=true");
  });

  it("returns parser-free parser failure evidence for invalid PSD bytes", async () => {
    const result = await materializeSelectedPsdLayerFromArrayBuffer({
      fileName: "invalid.psd",
      bytes: new Uint8Array([0, 1, 2, 3, 4, 5]),
      selectedLayerNodeRef: "psd:root/layer[0]"
    });

    expect(result.status).toBe("failed");
    if (result.status !== "failed") {
      throw new Error(`Expected failed result, got ${result.status}.`);
    }

    expect(result.failure).toMatchObject({
      failureKind: "parserFailure",
      parser: {
        privateShapePolicy: "parser-private-shape-excluded-v1"
      },
      provenance: {
        publicDemoAsset: false
      }
    });
    expect(JSON.stringify(result.failure)).not.toContain("stack");
    expect(JSON.stringify(result.failure)).not.toContain("\"children\"");
  });

  it("returns structured evidence for a missing selected layer", async () => {
    const sampleBytes = await readFile(samplePsdPath);
    const result = await materializeSelectedPsdLayerFromArrayBuffer({
      fileName: "sample_model.psd",
      bytes: sampleBytes,
      selectedLayerNodeRef: "psd:root/layer[99999]"
    });

    expect(result.status).toBe("failed");
    if (result.status !== "failed") {
      throw new Error(`Expected failed result, got ${result.status}.`);
    }

    expect(result.failure).toMatchObject({
      failureKind: "missingLayer",
      selectedLayerNodeRef: "psd:root/layer[99999]",
      provenance: {
        publicDemoAsset: false
      }
    });
    expect(result.failure.sourceDigest?.hex).toBe(samplePsdSourceDigestHex);
  });

  it("returns unsupported layer type evidence when a group node is selected", async () => {
    const sampleBytes = await readFile(samplePsdPath);
    const groupNodeRef = await findFirstRootGroupNodeRef(sampleBytes);
    const result = await materializeSelectedPsdLayerFromArrayBuffer({
      fileName: "sample_model.psd",
      bytes: sampleBytes,
      selectedLayerNodeRef: groupNodeRef
    });

    expect(result.status).toBe("failed");
    if (result.status !== "failed") {
      throw new Error(`Expected failed result, got ${result.status}.`);
    }

    expect(result.failure).toMatchObject({
      failureKind: "unsupportedLayerType",
      selectedLayerNodeRef: groupNodeRef,
      selectedNode: {
        nodeRef: groupNodeRef,
        nodeType: "group"
      },
      provenance: {
        publicDemoAsset: false
      }
    });
  });

  it("returns materialized output oversize evidence without creating a candidate", async () => {
    const sampleBytes = await readFile(samplePsdPath);
    const result = await materializeSelectedPsdLayerFromArrayBuffer({
      fileName: "sample_model.psd",
      bytes: sampleBytes,
      selectedLayerNodeRef: "psd:root/layer[0]",
      maxRawRgbaByteLength: 1
    });

    expect(result.status).toBe("failed");
    if (result.status !== "failed") {
      throw new Error(`Expected failed result, got ${result.status}.`);
    }

    expect(result.failure.failureKind).toBe("materializedLayerOversize");
    expect(result.failure.checks).toEqual(
      expect.arrayContaining([
        "materializedByteLength=460800",
        "maxRawRgbaByteLength=1"
      ])
    );
  });

  it("reports missing and stale materialized candidate bytes", async () => {
    const sampleBytes = await readFile(samplePsdPath);
    const result = await materializeSelectedPsdLayerFromArrayBuffer({
      fileName: "sample_model.psd",
      bytes: sampleBytes,
      selectedLayerNodeRef: "psd:root/layer[0]"
    });

    expect(result.status).toBe("materialized");
    if (result.status !== "materialized") {
      throw new Error(`Expected materialized result, got ${result.status}.`);
    }

    const missing = await verifySelectedPsdLayerMaterializedAssetCandidate({
      candidate: result.candidate
    });
    expect(missing).toMatchObject({
      status: "missing",
      evidence: {
        publicDemoAsset: false,
        staleReasons: ["missingCurrentMaterializedBytes"]
      }
    });

    const current = await verifySelectedPsdLayerMaterializedAssetCandidate({
      candidate: result.candidate,
      currentBytes: result.candidate.bytes,
      expected: {
        candidateId: result.candidate.evidence.candidateId,
        materializationId: result.candidate.evidence.materializationId,
        sourceDigest: result.candidate.evidence.sourcePsd.digest,
        sourceByteLength: result.candidate.evidence.sourcePsd.byteLength,
        sourceLayerId: result.candidate.evidence.sourceLayer.sourceLayerId,
        sourceLayerPath: result.candidate.evidence.sourceLayer.sourceLayerPath,
        sourceLayerName: result.candidate.evidence.sourceLayer.originalName,
        mediaType: result.candidate.evidence.mediaType,
        materializedDigest: result.candidate.evidence.digest,
        materializedByteLength: result.candidate.evidence.byteLength,
        parserPackageName: "@webtoon/psd",
        parserVersion: "0.4.0",
        parserPrivateShapePolicy: result.candidate.evidence.parser.privateShapePolicy,
        extraction: result.candidate.evidence.extraction,
        storageBoundary: result.candidate.evidence.storageBoundary
      }
    });
    expect(current.status).toBe("current");

    const mutatedBytes = new Uint8Array(result.candidate.bytes);
    mutatedBytes[0] = mutatedBytes[0] === 0 ? 1 : 0;
    const stale = await verifySelectedPsdLayerMaterializedAssetCandidate({
      candidate: result.candidate,
      currentBytes: mutatedBytes,
      expected: {
        sourceDigest: result.candidate.evidence.sourcePsd.digest,
        sourceByteLength: result.candidate.evidence.sourcePsd.byteLength,
        sourceLayerId: result.candidate.evidence.sourceLayer.sourceLayerId,
        sourceLayerPath: result.candidate.evidence.sourceLayer.sourceLayerPath,
        sourceLayerName: result.candidate.evidence.sourceLayer.originalName,
        mediaType: result.candidate.evidence.mediaType,
        materializedDigest: result.candidate.evidence.digest,
        materializedByteLength: result.candidate.evidence.byteLength,
        parserPackageName: "@webtoon/psd",
        parserVersion: "0.4.0",
        parserPrivateShapePolicy: result.candidate.evidence.parser.privateShapePolicy,
        storageBoundary: result.candidate.evidence.storageBoundary,
        extraction: result.candidate.evidence.extraction
      }
    });

    expect(stale.status).toBe("stale");
    expect(stale.evidence.staleReasons).toEqual(
      expect.arrayContaining([expect.stringContaining("materializedDigestMismatch")])
    );
  });

  it("reports parser, source layer, candidate, and storage boundary identity mismatches", async () => {
    const sampleBytes = await readFile(samplePsdPath);
    const result = await materializeSelectedPsdLayerFromArrayBuffer({
      fileName: "sample_model.psd",
      bytes: sampleBytes,
      selectedLayerNodeRef: "psd:root/layer[0]"
    });

    expect(result.status).toBe("materialized");
    if (result.status !== "materialized") {
      throw new Error(`Expected materialized result, got ${result.status}.`);
    }

    const stale = await verifySelectedPsdLayerMaterializedAssetCandidate({
      candidate: result.candidate,
      currentBytes: result.candidate.bytes,
      expected: {
        candidateId: "candidate_wrong",
        materializationId: "mat_wrong",
        sourceLayerId: result.candidate.evidence.sourceLayer.sourceLayerId,
        sourceLayerPath: ["wrong", "path"],
        sourceLayerName: "wrong-layer",
        parserPackageName: "@wrong/psd",
        parserVersion: "9.9.9",
        parserPrivateShapePolicy: "parser-private-shape-included-v1",
        storageBoundary: {
          storageScope: "project-persistent-storage-v1",
          packageStorageIdentity: "bin_wrong",
          persistentBinaryAssetRef: "package-binary-asset-ref-v1"
        }
      }
    });

    expect(stale.status).toBe("stale");
    expect(stale.evidence.staleReasons).toEqual(
      expect.arrayContaining([
        "candidateIdentityMismatch",
        "materializationIdentityMismatch",
        "sourceLayerPathMismatch",
        "sourceLayerNameMismatch",
        "parserPackageMismatch",
        "parserVersionMismatch",
        "parserPrivateShapePolicyMismatch",
        "storageScopeMismatch",
        "storageIdentityBoundaryMismatch",
        "persistentBinaryAssetRefBoundaryMismatch"
      ])
    );
  });
});

const findFirstRootGroupNodeRef = async (sampleBytes: Uint8Array): Promise<string> => {
  const parsed = await parseExplicitBrowserPsdArrayBuffer({
    fileName: "sample_model.psd",
    bytes: sampleBytes,
    selectedLayerNodeRef: "psd:root/layer[0]"
  });

  if (parsed.status !== "parsed") {
    throw new Error(`Expected sample PSD to parse before group lookup, got ${parsed.status}.`);
  }

  const rootGroupNodeRef = parsed.adapterResult.sourceGroups
    .map((group) => /^group_psd_root_group_(\d+)$/.exec(group.sourceGroupId)?.[1])
    .find((groupIndex): groupIndex is string => groupIndex !== undefined);

  if (rootGroupNodeRef === undefined) {
    throw new Error("Sample PSD did not expose a root group node reference.");
  }

  return `psd:root/group[${rootGroupNodeRef}]`;
};

const digest = (hex: string): BinaryAssetDigestDto => ({
  algorithm: "sha256",
  hex
});
