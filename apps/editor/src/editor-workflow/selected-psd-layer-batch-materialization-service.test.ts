import { readFile } from "node:fs/promises";

import {
  describe,
  expect,
  it
} from "vitest";

import type { BinaryAssetDigestDto } from "@private-2d-rigging-lab/package-format";

import {
  materializeSelectedPsdLayersFromArrayBuffer,
  selectedPsdLayerBatchMaterializationDefaultMaxSelectedLayerCount,
  selectedPsdLayerBatchMaterializationDefaultMaxTotalRawRgbaBytes,
  selectedPsdLayerMaterializedAssetMediaType
} from "./index.js";

const samplePsdPath = "test_data/sample_model.psd";
const samplePsdSourceDigestHex =
  "44ab43238cd2b2af2fb0ce6a7b5073a60e332d03da7666ea274c02e0462294b5";

const sampleTargets = [
  {
    ref: "psd:root/layer[0]",
    name: "headwear",
    path: ["headwear"],
    width: 400,
    height: 288,
    byteLength: 460800,
    bounds: {
      x: 808,
      y: 92,
      width: 400,
      height: 288
    },
    digestHex: "671e6a363745b1ce2e8d29c1a63438170fe9511c8884ea42298cf9b8886e5c1a"
  },
  {
    ref: "psd:root/layer[3]",
    name: "eyewear",
    path: ["eyewear"],
    width: 265,
    height: 110,
    byteLength: 116600,
    bounds: {
      x: 862,
      y: 404,
      width: 265,
      height: 110
    },
    digestHex: "a5558168cbf75f7817a139131c764e317a77056138d6be0e591077b3e373e708"
  },
  {
    ref: "psd:root/group[6]/layer[0]",
    name: "tie",
    path: ["tie", "tie"],
    width: 104,
    height: 560,
    byteLength: 232960,
    bounds: {
      x: 941,
      y: 641,
      width: 104,
      height: 560
    },
    digestHex: "46ba1a95659ac420d37ca89b0ab919ca6ad2022280bb268313937fcd2cd69673"
  }
] as const;

describe("selected PSD layer batch materialization service", () => {
  it("materializes multiple explicit sample leaf layers into private/local raw RGBA candidates", async () => {
    const sampleBytes = await readFile(samplePsdPath);
    const result = await materializeSelectedPsdLayersFromArrayBuffer({
      fileName: "sample_model.psd",
      bytes: sampleBytes,
      declaredMediaType: "image/vnd.adobe.photoshop",
      sourceAssetId: "src_wave47_sample_model_psd",
      selectedLayerNodeRefs: sampleTargets.map((target) => target.ref),
      batchId: "batch_wave47_sample_targets"
    });

    expect(result.status).toBe("success");
    expect(result.summary).toMatchObject({
      requestedCount: 3,
      uniqueRequestedCount: 3,
      successCount: 3,
      failureCount: 0,
      duplicateSelectionCount: 0,
      unsupportedLayerTypeCount: 0,
      missingCurrentSourceBytesCount: 0,
      staleSourceCount: 0,
      materializationFailureCount: 0,
      maxSelectedLayerCount: selectedPsdLayerBatchMaterializationDefaultMaxSelectedLayerCount,
      maxTotalRawRgbaBytes: selectedPsdLayerBatchMaterializationDefaultMaxTotalRawRgbaBytes,
      acceptedRawRgbaByteLength: 810360,
      attemptedRawRgbaByteLength: 810360,
      publicDemoAsset: false
    });

    expect(result.source).toMatchObject({
      intakeKind: "explicitArrayBuffer",
      sourceAssetId: "src_wave47_sample_model_psd",
      fileName: "sample_model.psd",
      byteLength: 22406225
    });

    for (const [index, target] of sampleTargets.entries()) {
      const entry = result.entries[index];
      expect(entry?.status).toBe("materialized");
      if (entry?.status !== "materialized") {
        throw new Error(`Expected materialized entry ${index}.`);
      }

      expect(entry.candidate.bytes.byteLength).toBe(target.byteLength);
      expect(entry.candidate.evidence).toMatchObject({
        mediaType: selectedPsdLayerMaterializedAssetMediaType,
        pixelFormat: "rgba8",
        width: target.width,
        height: target.height,
        byteLength: target.byteLength,
        digest: {
          algorithm: "sha256",
          hex: target.digestHex
        },
        sourcePsd: {
          sourceAssetId: "src_wave47_sample_model_psd",
          fileName: "sample_model.psd",
          byteLength: 22406225,
          digest: {
            algorithm: "sha256",
            hex: samplePsdSourceDigestHex
          }
        },
        sourceLayer: {
          sourceLayerId: target.ref,
          sourceLayerPath: target.path,
          originalName: target.name,
          bounds: target.bounds,
          visibleInSource: true
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
            selectedNodeRef: target.ref,
            outputEncoding: "raw-rgba",
            channelOrder: "rgba",
            pixelFormat: "rgba8",
            width: target.width,
            height: target.height
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
      expect(JSON.stringify(entry.candidate.evidence)).not.toContain("\"children\"");
      expect(JSON.stringify(entry.candidate.evidence)).not.toContain("stack");
    }
  });

  it("reports duplicate explicit selections without silently treating the batch as success", async () => {
    const sampleBytes = await readFile(samplePsdPath);
    const result = await materializeSelectedPsdLayersFromArrayBuffer({
      fileName: "sample_model.psd",
      bytes: sampleBytes,
      selectedLayerNodeRefs: [sampleTargets[0].ref, sampleTargets[0].ref]
    });

    expect(result.status).toBe("partialFailure");
    expect(result.summary).toMatchObject({
      requestedCount: 2,
      successCount: 1,
      failureCount: 1,
      duplicateSelectionCount: 1
    });
    expect(result.entries[1]).toMatchObject({
      status: "failed",
      selectedLayerNodeRef: sampleTargets[0].ref,
      failure: {
        failureKind: "duplicateSelection",
        canonicalRequestIndex: 0,
        provenance: {
          publicDemoAsset: false
        }
      }
    });
  });

  it("returns unsupported layer type evidence for selected groups without recursive import", async () => {
    const sampleBytes = await readFile(samplePsdPath);
    const result = await materializeSelectedPsdLayersFromArrayBuffer({
      fileName: "sample_model.psd",
      bytes: sampleBytes,
      selectedLayerNodeRefs: ["psd:root/group[6]"]
    });

    expect(result.status).toBe("failure");
    expect(result.summary).toMatchObject({
      requestedCount: 1,
      successCount: 0,
      failureCount: 1,
      unsupportedLayerTypeCount: 1
    });
    expect(result.entries[0]).toMatchObject({
      status: "failed",
      selectedLayerNodeRef: "psd:root/group[6]",
      failure: {
        failureKind: "unsupportedLayerType",
        selectedNode: {
          nodeRef: "psd:root/group[6]",
          nodeType: "group",
          sourceNodePath: ["tie"],
          originalName: "tie"
        },
        provenance: {
          publicDemoAsset: false
        }
      }
    });
  });

  it("blocks missing current source bytes before parser execution", async () => {
    const result = await materializeSelectedPsdLayersFromArrayBuffer({
      fileName: "sample_model.psd",
      selectedLayerNodeRefs: [sampleTargets[0].ref],
      expectedSource: {
        byteLength: 22406225,
        digest: digest(samplePsdSourceDigestHex)
      }
    });

    expect(result.status).toBe("preflightBlocked");
    expect(result.summary).toMatchObject({
      requestedCount: 1,
      successCount: 0,
      failureCount: 1,
      missingCurrentSourceBytesCount: 1
    });
    expect(result.entries[0]).toMatchObject({
      status: "failed",
      failure: {
        failureKind: "missingCurrentSourceBytes",
        checks: expect.arrayContaining(["currentSourceBytes=missing", "parserExecuted=false"])
      }
    });
  });

  it("blocks stale source identity before materializing any selected layer", async () => {
    const sampleBytes = await readFile(samplePsdPath);
    const result = await materializeSelectedPsdLayersFromArrayBuffer({
      fileName: "sample_model.psd",
      bytes: sampleBytes,
      selectedLayerNodeRefs: [sampleTargets[0].ref, sampleTargets[1].ref],
      expectedSource: {
        byteLength: 999,
        digest: digest("0000000000000000000000000000000000000000000000000000000000000000")
      }
    });

    expect(result.status).toBe("preflightBlocked");
    expect(result.summary).toMatchObject({
      requestedCount: 2,
      successCount: 0,
      failureCount: 2,
      staleSourceCount: 2
    });
    expect(result.entries.map((entry) => entry.status)).toEqual(["failed", "failed"]);
    expect(result.entries[0]).toMatchObject({
      status: "failed",
      failure: {
        failureKind: "staleSource",
        sourceDigest: {
          algorithm: "sha256",
          hex: samplePsdSourceDigestHex
        },
        checks: expect.arrayContaining([
          expect.stringContaining("sourceByteLengthMismatch"),
          expect.stringContaining("sourceDigestMismatch"),
          "parserExecuted=false"
        ])
      }
    });
  });

  it("reports per-layer materialization failures instead of partial success", async () => {
    const result = await materializeSelectedPsdLayersFromArrayBuffer({
      fileName: "invalid.psd",
      bytes: new Uint8Array([0, 1, 2, 3, 4, 5]),
      selectedLayerNodeRefs: [sampleTargets[0].ref, sampleTargets[1].ref]
    });

    expect(result.status).toBe("failure");
    expect(result.summary).toMatchObject({
      requestedCount: 2,
      successCount: 0,
      failureCount: 2,
      materializationFailureCount: 2
    });
    expect(result.entries).toEqual([
      expect.objectContaining({
        status: "failed",
        failure: expect.objectContaining({
          failureKind: "parserFailure",
          singleLayerFailureKind: "parserFailure"
        })
      }),
      expect.objectContaining({
        status: "failed",
        failure: expect.objectContaining({
          failureKind: "parserFailure",
          singleLayerFailureKind: "parserFailure"
        })
      })
    ]);
  });

  it("preflight-blocks batches above the explicit unique layer cap", async () => {
    const sampleBytes = await readFile(samplePsdPath);
    const selectedLayerNodeRefs = [
      "psd:root/layer[0]",
      "psd:root/layer[2]",
      "psd:root/layer[3]",
      "psd:root/layer[4]",
      "psd:root/layer[5]"
    ];
    const result = await materializeSelectedPsdLayersFromArrayBuffer({
      fileName: "sample_model.psd",
      bytes: sampleBytes,
      selectedLayerNodeRefs,
      maxSelectedLayerCount: 4
    });

    expect(result.status).toBe("preflightBlocked");
    expect(result.summary).toMatchObject({
      requestedCount: 5,
      uniqueRequestedCount: 5,
      successCount: 0,
      failureCount: 5,
      batchLayerCountExceededCount: 5,
      batchCap: {
        exceeded: true,
        requestedUniqueCount: 5,
        maxSelectedLayerCount: 4
      }
    });
    expect(result.entries.every((entry) => entry.status === "failed")).toBe(true);
    expect(result.entries[0]).toMatchObject({
      status: "failed",
      failure: {
        failureKind: "batchLayerCountExceeded",
        checks: expect.arrayContaining([
          "uniqueSelectedLayerCount=5",
          "maxSelectedLayerCount=4",
          "parserExecuted=false"
        ])
      }
    });
  });

  it("reports total byte cap failure while preserving already materialized entry evidence", async () => {
    const sampleBytes = await readFile(samplePsdPath);
    const result = await materializeSelectedPsdLayersFromArrayBuffer({
      fileName: "sample_model.psd",
      bytes: sampleBytes,
      selectedLayerNodeRefs: [sampleTargets[0].ref, sampleTargets[1].ref],
      maxTotalRawRgbaByteLength: sampleTargets[0].byteLength
    });

    expect(result.status).toBe("partialFailure");
    expect(result.summary).toMatchObject({
      requestedCount: 2,
      successCount: 1,
      failureCount: 1,
      batchTotalByteCapExceededCount: 1,
      acceptedRawRgbaByteLength: sampleTargets[0].byteLength,
      attemptedRawRgbaByteLength: sampleTargets[0].byteLength + sampleTargets[1].byteLength,
      totalByteCap: {
        exceeded: true,
        maxTotalRawRgbaBytes: sampleTargets[0].byteLength
      }
    });
    expect(result.entries[0]).toMatchObject({
      status: "materialized",
      selectedLayerNodeRef: sampleTargets[0].ref
    });
    expect(result.entries[1]).toMatchObject({
      status: "failed",
      selectedLayerNodeRef: sampleTargets[1].ref,
      failure: {
        failureKind: "batchTotalByteCapExceeded",
        checks: expect.arrayContaining([
          `acceptedRawRgbaByteLength=${sampleTargets[0].byteLength}`,
          `candidateRawRgbaByteLength=${sampleTargets[1].byteLength}`,
          `attemptedRawRgbaByteLength=${sampleTargets[0].byteLength + sampleTargets[1].byteLength}`,
          `maxTotalRawRgbaByteLength=${sampleTargets[0].byteLength}`
        ])
      }
    });
  });
});

const digest = (hex: string): BinaryAssetDigestDto => ({
  algorithm: "sha256",
  hex
});
