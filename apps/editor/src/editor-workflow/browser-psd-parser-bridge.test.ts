import { readFile } from "node:fs/promises";

import {
  describe,
  expect,
  it
} from "vitest";

import {
  browserPsdParserBridgeDefaultSizeCapBytes,
  parseExplicitBrowserPsdFile,
  parseExplicitBrowserPsdArrayBuffer
} from "./index.js";

describe("browser PSD parser bridge", () => {
  it("parses the private sample PSD into parser-free layer tree and selected layer evidence", async () => {
    const sampleBytes = await readFile("test_data/sample_model.psd");
    const result = await parseExplicitBrowserPsdArrayBuffer({
      fileName: "sample_model.psd",
      bytes: sampleBytes,
      declaredMediaType: "image/vnd.adobe.photoshop",
      sourceAssetId: "src_wave45_sample_model_psd",
      selectedLayerNodeRef: "psd:root/layer[0]"
    });

    expect(result.status).toBe("parsed");
    if (result.status !== "parsed") {
      throw new Error(`Expected parsed result, got ${result.status}.`);
    }

    expect(result.source.byteLength).toBe(22406225);
    expect(result.source.sizeCapBytes).toBe(browserPsdParserBridgeDefaultSizeCapBytes);
    expect(result.threading.execution).toBe("main-thread");
    expect(result.adapterResult.parser?.privateShapePolicy).toBe("parser-private-shape-excluded-v1");
    expect(result.adapterResult.layerTreeEvidence).toMatchObject({
      evidenceKind: "psd-layer-tree-evidence-v1",
      intakeKind: "realPsdParseResult",
      groupCount: 20,
      layerCount: 126,
      maxDepth: 3,
      privateShapePolicy: "parser-private-shape-excluded-v1"
    });
    expect(result.treeSummary).toMatchObject({
      groupCount: 20,
      layerCount: 126,
      visibleLayerCount: 121,
      hiddenLayerCount: 5
    });
    expect(result.adapterResult.sourceLayers[0]).toMatchObject({
      sourceLayerId: "psd:root/layer[0]",
      originalName: "headwear",
      bounds: {
        x: 808,
        y: 92,
        width: 400,
        height: 288
      },
      visibleInSource: true,
      role: "referenceOnly"
    });
    expect(result.adapterResult.featureSupportEvidence?.map((evidence) => evidence.status)).toContain(
      "notEvaluated"
    );
    expect(result.adapterResult.materializationEvidence?.[0]).toMatchObject({
      evidenceKind: "psd-layer-materialization-evidence-v1",
      sourceLayerRef: {
        sourceAssetId: "src_wave45_sample_model_psd",
        sourceLayerId: "psd:root/layer[0]"
      },
      mediaType: "application/vnd.private-2d-rigging-lab.raw-rgba",
      byteLength: 460800,
      digest: {
        algorithm: "sha256",
        hex: "671e6a363745b1ce2e8d29c1a63438170fe9511c8884ea42298cf9b8886e5c1a"
      }
    });
    expect(JSON.stringify(result.adapterResult)).not.toContain("\"children\"");
  });

  it("rejects selected PSD bytes above the configured size cap without parsing", async () => {
    const result = await parseExplicitBrowserPsdArrayBuffer({
      fileName: "oversize.psd",
      bytes: new Uint8Array([1, 2, 3, 4]),
      sizeCapBytes: 3
    });

    expect(result.status).toBe("rejected");
    expect(result.errorEvidence[0]).toMatchObject({
      failureKind: "sizeLimitExceeded",
      source: {
        fileName: "oversize.psd",
        byteLength: 4,
        sizeCapBytes: 3
      }
    });
  });

  it("accepts explicit File input and records file intake evidence before size rejection", async () => {
    const file = new File([new Uint8Array([1, 2, 3, 4])], "oversize-file.psd", {
      type: "image/vnd.adobe.photoshop"
    });
    const result = await parseExplicitBrowserPsdFile({
      file,
      sizeCapBytes: 3
    });

    expect(result.status).toBe("rejected");
    expect(result.source).toMatchObject({
      intakeKind: "explicitFile",
      fileName: "oversize-file.psd",
      declaredMediaType: "image/vnd.adobe.photoshop",
      byteLength: 4,
      sizeCapBytes: 3
    });
  });

  it("preflights File.size before reading oversize browser file bytes", async () => {
    let arrayBufferReadCount = 0;
    const file = {
      name: "oversize-preflight.psd",
      size: browserPsdParserBridgeDefaultSizeCapBytes + 1,
      type: "image/vnd.adobe.photoshop",
      async arrayBuffer() {
        arrayBufferReadCount += 1;
        return new Uint8Array([1, 2, 3, 4]).buffer;
      }
    } as File;

    const result = await parseExplicitBrowserPsdFile({ file });

    expect(result.status).toBe("rejected");
    expect(result.source.byteLength).toBe(browserPsdParserBridgeDefaultSizeCapBytes + 1);
    expect(arrayBufferReadCount).toBe(0);
  });

  it("returns structured parser-free error evidence for invalid PSD bytes", async () => {
    const result = await parseExplicitBrowserPsdArrayBuffer({
      fileName: "invalid.psd",
      bytes: new Uint8Array([0, 1, 2, 3, 4, 5])
    });

    expect(result.status).toBe("failed");
    expect(result.errorEvidence[0]).toMatchObject({
      evidenceKind: "psd-parser-error-evidence-v1",
      failureKind: "parserFailure",
      severity: "error",
      source: {
        fileName: "invalid.psd",
        byteLength: 6
      },
      parser: {
        privateShapePolicy: "parser-private-shape-excluded-v1"
      }
    });
    expect(JSON.stringify(result.errorEvidence)).not.toContain("stack");
  });
});
