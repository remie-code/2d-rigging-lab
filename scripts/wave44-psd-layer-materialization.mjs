import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import Psd from "@webtoon/psd";

const require = createRequire(import.meta.url);

const expectedSource = {
  byteLength: 22406225,
  sha256: "44ab43238cd2b2af2fb0ce6a7b5073a60e332d03da7666ea274c02e0462294b5"
};

const expectedMaterialization = {
  layerRef: "psd:root/layer[0]",
  layerName: "headwear",
  rawRgbaByteLength: 460800,
  rawRgbaSha256: "671e6a363745b1ce2e8d29c1a63438170fe9511c8884ea42298cf9b8886e5c1a"
};

function parseArgs(argv) {
  const args = {
    psdPath: undefined,
    layerRef: expectedMaterialization.layerRef,
    outPath: undefined
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const nextArgument = argv[index + 1];

    if (argument === "--psd") {
      if (nextArgument === undefined) {
        throw new Error("--psd requires an explicit file path");
      }
      args.psdPath = nextArgument;
      index += 1;
      continue;
    }

    if (argument === "--layer-ref") {
      if (nextArgument === undefined) {
        throw new Error("--layer-ref requires an explicit PSD node reference");
      }
      args.layerRef = nextArgument;
      index += 1;
      continue;
    }

    if (argument === "--out") {
      if (nextArgument === undefined) {
        throw new Error("--out requires an explicit output path");
      }
      args.outPath = nextArgument;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  if (args.psdPath === undefined) {
    throw new Error("Missing --psd explicit file path");
  }

  return args;
}

function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function toArrayBuffer(buffer) {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function toPortablePath(filePath) {
  return filePath.split(path.sep).join("/");
}

async function readPackageVersion() {
  const packageJsonPath = require.resolve("@webtoon/psd/package.json");
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
  return packageJson.version;
}

function getNodeKind(node) {
  return node.type === "Layer" ? "layer" : "group";
}

function getNodeName(node) {
  return typeof node.name === "string" && node.name.length > 0 ? node.name : "(unnamed)";
}

function findNodeByRef(parsedNode, targetRef, parentRef = "psd:root", parentPath = []) {
  const childNodes = Array.isArray(parsedNode.children) ? parsedNode.children : [];

  for (let index = 0; index < childNodes.length; index += 1) {
    const child = childNodes[index];
    const kind = getNodeKind(child);
    const nodeRef = `${parentRef}/${kind}[${index}]`;
    const sourceLayerPath = [...parentPath, getNodeName(child)];

    if (nodeRef === targetRef) {
      return { node: child, nodeRef, sourceLayerPath };
    }

    const nested = findNodeByRef(child, targetRef, nodeRef, sourceLayerPath);
    if (nested !== undefined) {
      return nested;
    }
  }

  return undefined;
}

function getLayerBounds(layer) {
  return {
    left: layer.left,
    top: layer.top,
    width: layer.width,
    height: layer.height,
    right: layer.left + layer.width,
    bottom: layer.top + layer.height
  };
}

function assertExpectedSource(sourceBytes, sourceSha256) {
  const failures = [];

  if (sourceBytes.byteLength !== expectedSource.byteLength) {
    failures.push(
      `source byteLength mismatch: expected ${expectedSource.byteLength}, got ${sourceBytes.byteLength}`
    );
  }

  if (sourceSha256 !== expectedSource.sha256) {
    failures.push(
      `source sha256 mismatch: expected ${expectedSource.sha256}, got ${sourceSha256}`
    );
  }

  if (failures.length > 0) {
    throw new Error(`Wave44 PSD source check failed: ${failures.join("; ")}`);
  }
}

function assertExpectedLayerMaterialization(layerRef, layer, rgbaBytes, rgbaSha256) {
  const failures = [];

  if (layerRef !== expectedMaterialization.layerRef) {
    failures.push(
      `unsupported pilot layerRef: expected ${expectedMaterialization.layerRef}, got ${layerRef}`
    );
  }

  if (getNodeName(layer) !== expectedMaterialization.layerName) {
    failures.push(
      `layer name mismatch: expected ${expectedMaterialization.layerName}, got ${getNodeName(layer)}`
    );
  }

  if (rgbaBytes.byteLength !== expectedMaterialization.rawRgbaByteLength) {
    failures.push(
      `raw RGBA byteLength mismatch: expected ${expectedMaterialization.rawRgbaByteLength}, got ${rgbaBytes.byteLength}`
    );
  }

  if (rgbaSha256 !== expectedMaterialization.rawRgbaSha256) {
    failures.push(
      `raw RGBA sha256 mismatch: expected ${expectedMaterialization.rawRgbaSha256}, got ${rgbaSha256}`
    );
  }

  if (failures.length > 0) {
    throw new Error(`Wave44 PSD layer materialization failed: ${failures.join("; ")}`);
  }
}

function createMaterializationEvidence({
  parserVersion,
  sourcePath,
  sourceBytes,
  sourceSha256,
  layerRef,
  layer,
  sourceLayerPath,
  rgbaBytes,
  rgbaSha256
}) {
  const parser = {
    evidenceKind: "psd-parser-evidence-v1",
    parserName: "webtoonPsd",
    parserPackageName: "@webtoon/psd",
    parserVersion,
    adapterName: "wave44-node-layer-materialization-pilot",
    adapterVersion: "0.0.0",
    runtime: "node",
    privateShapePolicy: "parser-private-shape-excluded-v1"
  };
  const bounds = getLayerBounds(layer);

  return {
    schemaVersion: "wave44-psd-layer-materialization-pilot-v1",
    fixtureId: "wave44.sampleModel.selectedLayerMaterialization",
    privacy: {
      label: "privateLocalFixture",
      publicDistribution: "notPublicDistributable",
      publicDemoAsset: false,
      derivedRasterBytesPersisted: false
    },
    source: {
      path: sourcePath,
      mediaType: "image/vnd.adobe.photoshop",
      byteLength: sourceBytes.byteLength,
      digest: {
        algorithm: "sha256",
        hex: sourceSha256
      }
    },
    selectedLayer: {
      nodeRef: layerRef,
      name: getNodeName(layer),
      sourceLayerPath,
      bounds,
      visible: !layer.isHidden,
      hidden: layer.isHidden,
      opacity: layer.opacity,
      composedOpacity: layer.composedOpacity
    },
    materializationEvidence: {
      evidenceKind: "psd-layer-materialization-evidence-v1",
      materializationId: "mat_wave44SampleHeadwearRawRgba",
      sourceLayerRef: {
        sourceAssetId: "src_wave44_sample_model_psd",
        sourceLayerId: layerRef,
        sourceLayerPath
      },
      mediaType: "application/vnd.private-2d-rigging-lab.raw-rgba",
      byteLength: rgbaBytes.byteLength,
      digest: {
        algorithm: "sha256",
        hex: rgbaSha256
      },
      provenance: {
        sourceFilePath: sourcePath,
        sourceDigest: {
          algorithm: "sha256",
          hex: sourceSha256
        },
        sourceByteLength: sourceBytes.byteLength,
        sourceMediaType: "image/vnd.adobe.photoshop",
        privacyLabel: "privateLocalFixture",
        publicDistribution: "notPublicDistributable",
        fixtureId: "wave44.sampleModel",
        generatedBy: "wave44.psdLayerMaterialization"
      },
      parser,
      extraction: {
        extractionKind: "selectedLayerRasterV1",
        optionsSchemaVersion: "psd-layer-extraction-options-v1",
        options: {
          parserMethod: "Layer.composite(false, false)",
          effect: false,
          composed: false,
          selectedNodeRef: layerRef,
          layerSelection: "headwear",
          outputEncoding: "raw-rgba",
          rawChannelOrder: "rgba",
          bytesPersisted: false,
          width: bounds.width,
          height: bounds.height
        }
      }
    },
    unsupportedClaims: {
      photoshopStyleFinalCompositing: "notEvaluated",
      rendererPixelOracle: "notEvaluated",
      textureSamplingCorrectness: "notEvaluated",
      publicDemoDistribution: "notSupported"
    }
  };
}

const args = parseArgs(process.argv.slice(2));
const resolvedPsdPath = path.resolve(args.psdPath);
const sourcePath = toPortablePath(path.relative(process.cwd(), resolvedPsdPath));
const sourceBytes = await readFile(resolvedPsdPath);
const sourceSha256 = sha256Hex(sourceBytes);
assertExpectedSource(sourceBytes, sourceSha256);

const parserVersion = await readPackageVersion();
const psd = Psd.parse(toArrayBuffer(sourceBytes));
const selected = findNodeByRef(psd, args.layerRef);
if (selected === undefined) {
  throw new Error(`Unable to find selected PSD layer ${args.layerRef}`);
}
if (selected.node.type !== "Layer") {
  throw new Error(`Selected PSD node is not a layer: ${args.layerRef}`);
}

const rgbaBytes = await selected.node.composite(false, false);
const rgbaSha256 = sha256Hex(rgbaBytes);
assertExpectedLayerMaterialization(args.layerRef, selected.node, rgbaBytes, rgbaSha256);

const evidence = createMaterializationEvidence({
  parserVersion,
  sourcePath,
  sourceBytes,
  sourceSha256,
  layerRef: args.layerRef,
  layer: selected.node,
  sourceLayerPath: selected.sourceLayerPath,
  rgbaBytes,
  rgbaSha256
});
const serialized = `${JSON.stringify(evidence, null, 2)}\n`;

if (args.outPath !== undefined) {
  const resolvedOutPath = path.resolve(args.outPath);
  await mkdir(path.dirname(resolvedOutPath), { recursive: true });
  await writeFile(resolvedOutPath, serialized, "utf8");
}

process.stdout.write(serialized);
