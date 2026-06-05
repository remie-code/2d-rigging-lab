import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

import Psd from "@webtoon/psd";

const expectedSource = {
  byteLength: 22406225,
  sha256: "44AB43238CD2B2AF2FB0CE6A7B5073A60E332D03DA7666EA274C02E0462294B5"
};

const require = createRequire(import.meta.url);

function parseArgs(argv) {
  const args = {
    psdPath: undefined
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

async function readPackageVersion() {
  const packageJsonPath = require.resolve("@webtoon/psd/package.json");
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
  return packageJson.version;
}

function createNodeEvidence(node, parentRef, siblingIndex, depth) {
  const kind = node.type === "Layer" ? "layer" : "group";
  const nodeRef = `${parentRef}/${kind}[${siblingIndex}]`;
  const displayName = typeof node.name === "string" ? node.name : "";
  const base = {
    kind,
    nodeRef,
    name: displayName,
    depth,
    opacity: node.opacity,
    composedOpacity: node.composedOpacity
  };

  if (node.type === "Layer") {
    const bounds = {
      left: node.left,
      top: node.top,
      width: node.width,
      height: node.height,
      right: node.left + node.width,
      bottom: node.top + node.height
    };

    return {
      ...base,
      bounds,
      visible: !node.isHidden,
      hidden: node.isHidden,
      rasterCandidate: node.width > 0 && node.height > 0
    };
  }

  const children = [];
  const childNodes = Array.isArray(node.children) ? node.children : [];
  for (let index = 0; index < childNodes.length; index += 1) {
    children.push(createNodeEvidence(childNodes[index], nodeRef, index, depth + 1));
  }

  return {
    ...base,
    childCount: children.length,
    children
  };
}

function collectSummary(nodeEvidence, summary) {
  if (nodeEvidence.kind === "group") {
    summary.groupCount += 1;
    summary.maxDepth = Math.max(summary.maxDepth, nodeEvidence.depth);
    for (const child of nodeEvidence.children) {
      collectSummary(child, summary);
    }
    return;
  }

  summary.layerCount += 1;
  summary.maxDepth = Math.max(summary.maxDepth, nodeEvidence.depth);
  if (nodeEvidence.visible) {
    summary.visibleLayerCount += 1;
  } else {
    summary.hiddenLayerCount += 1;
  }
  if (nodeEvidence.rasterCandidate) {
    summary.rasterCandidateLayerCount += 1;
  }
  if (summary.layerSamples.length < 10) {
    summary.layerSamples.push({
      nodeRef: nodeEvidence.nodeRef,
      name: nodeEvidence.name,
      bounds: nodeEvidence.bounds,
      visible: nodeEvidence.visible,
      opacity: nodeEvidence.opacity,
      composedOpacity: nodeEvidence.composedOpacity
    });
  }
}

function findNodeByRef(parsedNode, targetRef, parentRef = "psd:root") {
  const childNodes = Array.isArray(parsedNode.children) ? parsedNode.children : [];

  for (let index = 0; index < childNodes.length; index += 1) {
    const child = childNodes[index];
    const kind = child.type === "Layer" ? "layer" : "group";
    const nodeRef = `${parentRef}/${kind}[${index}]`;
    if (nodeRef === targetRef) {
      return child;
    }
    const nested = findNodeByRef(child, targetRef, nodeRef);
    if (nested !== undefined) {
      return nested;
    }
  }

  return undefined;
}

function findRasterCandidate(nodeEvidence) {
  if (
    nodeEvidence.kind === "layer" &&
    nodeEvidence.visible &&
    nodeEvidence.rasterCandidate
  ) {
    return nodeEvidence;
  }

  if (nodeEvidence.kind === "group") {
    for (const child of nodeEvidence.children) {
      const candidate = findRasterCandidate(child);
      if (candidate !== undefined) {
        return candidate;
      }
    }
  }

  return undefined;
}

function assertSmokePass(evidence) {
  const failures = [];

  if (evidence.source.byteLength !== expectedSource.byteLength) {
    failures.push(
      `source byteLength mismatch: expected ${expectedSource.byteLength}, got ${evidence.source.byteLength}`
    );
  }

  if (evidence.source.sha256 !== expectedSource.sha256) {
    failures.push(`source sha256 mismatch: expected ${expectedSource.sha256}, got ${evidence.source.sha256}`);
  }

  if (evidence.document.width <= 0 || evidence.document.height <= 0) {
    failures.push("document dimensions must be positive");
  }

  if (evidence.treeSummary.layerCount <= 0) {
    failures.push("layer tree must contain at least one layer");
  }

  if (evidence.treeSummary.groupCount <= 0) {
    failures.push("layer tree must contain at least one group");
  }

  if (!evidence.rasterExtraction.available) {
    failures.push("raster extraction must be available for at least one visible layer");
  }

  if (failures.length > 0) {
    const error = new Error(`Wave44 PSD parser smoke failed: ${failures.join("; ")}`);
    error.failures = failures;
    throw error;
  }
}

const args = parseArgs(process.argv.slice(2));
const resolvedPsdPath = path.resolve(args.psdPath);
const sourceBytes = await readFile(resolvedPsdPath);
const sourceSha256 = sha256Hex(sourceBytes).toUpperCase();
const parserVersion = await readPackageVersion();
const psd = Psd.parse(toArrayBuffer(sourceBytes));
const tree = {
  kind: "document",
  nodeRef: "psd:root",
  name: psd.name,
  depth: 0,
  childCount: psd.children.length,
  children: psd.children.map((child, index) => createNodeEvidence(child, "psd:root", index, 1))
};
const treeSummary = {
  groupCount: 0,
  layerCount: 0,
  visibleLayerCount: 0,
  hiddenLayerCount: 0,
  rasterCandidateLayerCount: 0,
  maxDepth: 0,
  layerSamples: []
};

for (const child of tree.children) {
  collectSummary(child, treeSummary);
}

const rasterCandidate = tree.children
  .map((child) => findRasterCandidate(child))
  .find((candidate) => candidate !== undefined);
let rasterExtraction;

if (rasterCandidate === undefined) {
  rasterExtraction = {
    available: false,
    reason: "no visible non-empty layer found",
    unsupportedClaims: {
      photoshopStyleFinalCompositing: "notEvaluated",
      rendererPixelOracle: "notEvaluated",
      textureSamplingCorrectness: "notEvaluated"
    }
  };
} else {
  const layer = findNodeByRef(psd, rasterCandidate.nodeRef);
  if (layer === undefined || layer.type !== "Layer") {
    throw new Error(`Unable to resolve raster candidate ${rasterCandidate.nodeRef}`);
  }
  const rgbaBytes = await layer.composite(false, false);
  rasterExtraction = {
    available: true,
    parserMethod: "Layer.composite(false, false)",
    mediaType: "application/vnd.private-2d-rigging-lab.raw-rgba",
    byteLength: rgbaBytes.byteLength,
    sha256: sha256Hex(rgbaBytes).toUpperCase(),
    sourceLayer: {
      nodeRef: rasterCandidate.nodeRef,
      name: rasterCandidate.name,
      bounds: rasterCandidate.bounds,
      visible: rasterCandidate.visible,
      opacity: rasterCandidate.opacity,
      composedOpacity: rasterCandidate.composedOpacity
    },
    extractionOptions: {
      effect: false,
      composed: false,
      bytesPersisted: false
    },
    derivedArtifactPolicy: {
      privacyLabel: "private/local fixture evidence",
      sourcePath: path.relative(process.cwd(), resolvedPsdPath).split(path.sep).join("/"),
      sourceByteLength: sourceBytes.byteLength,
      sourceSha256,
      parserPackage: "@webtoon/psd",
      parserVersion,
      publicDemoAsset: false
    },
    unsupportedClaims: {
      photoshopStyleFinalCompositing: "notEvaluated",
      rendererPixelOracle: "notEvaluated",
      textureSamplingCorrectness: "notEvaluated"
    }
  };
}

const evidence = {
  schemaId: "wave44.psdParserNodeSmokeEvidence.v1",
  parser: {
    packageName: "@webtoon/psd",
    version: parserVersion
  },
  source: {
    path: path.relative(process.cwd(), resolvedPsdPath).split(path.sep).join("/"),
    byteLength: sourceBytes.byteLength,
    sha256: sourceSha256,
    privacyLabel: "private/local fixture",
    publicDemoAsset: false
  },
  document: {
    width: psd.width,
    height: psd.height,
    channelCount: psd.channelCount,
    depth: psd.depth,
    colorMode: psd.colorMode,
    childCount: psd.children.length
  },
  treeSummary,
  tree,
  rasterExtraction
};

assertSmokePass(evidence);
console.log(JSON.stringify(evidence, null, 2));
