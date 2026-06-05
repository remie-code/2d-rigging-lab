import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

const materializationScriptPath = "scripts/wave44-psd-layer-materialization.mjs";
const sourcePsdPath = "test_data/sample_model.psd";
const expectedEvidencePath =
  "test_data/derived/wave44/psd-layer-materialization/headwear.raw-rgba.materialization-evidence.json";

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function getNested(value, pathSegments) {
  return pathSegments.reduce(
    (current, segment) =>
      current !== null && typeof current === "object" ? current[segment] : undefined,
    value
  );
}

function assertEqual(actual, expected, description) {
  if (actual !== expected) {
    throw new Error(`${description}: expected ${expected}, got ${actual}`);
  }
}

function assertAbsent(value, description) {
  if (value !== undefined) {
    throw new Error(`${description} must be absent`);
  }
}

async function runMaterializationScript() {
  const output = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      materializationScriptPath,
      "--psd",
      sourcePsdPath
    ], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(
          `Wave44 PSD materialization command failed with exit code ${code}.\n${stderr}`
        ));
        return;
      }
      resolve(stdout);
    });
  });

  return JSON.parse(output);
}

function assertFixtureBoundary(evidence) {
  assertEqual(evidence.schemaVersion, "wave44-psd-layer-materialization-pilot-v1", "schemaVersion");
  assertEqual(evidence.fixtureId, "wave44.sampleModel.selectedLayerMaterialization", "fixtureId");
  assertEqual(evidence.privacy.label, "privateLocalFixture", "privacy.label");
  assertEqual(evidence.privacy.publicDistribution, "notPublicDistributable", "privacy.publicDistribution");
  assertEqual(evidence.privacy.publicDemoAsset, false, "privacy.publicDemoAsset");
  assertEqual(evidence.privacy.derivedRasterBytesPersisted, false, "privacy.derivedRasterBytesPersisted");
  assertEqual(evidence.source.path, sourcePsdPath, "source.path");
  assertEqual(evidence.source.byteLength, 22406225, "source.byteLength");
  assertEqual(
    evidence.source.digest.hex,
    "44ab43238cd2b2af2fb0ce6a7b5073a60e332d03da7666ea274c02e0462294b5",
    "source.digest.hex"
  );
  assertEqual(evidence.selectedLayer.nodeRef, "psd:root/layer[0]", "selectedLayer.nodeRef");
  assertEqual(evidence.selectedLayer.name, "headwear", "selectedLayer.name");
  assertEqual(
    evidence.materializationEvidence.mediaType,
    "application/vnd.private-2d-rigging-lab.raw-rgba",
    "materializationEvidence.mediaType"
  );
  assertEqual(evidence.materializationEvidence.byteLength, 460800, "materializationEvidence.byteLength");
  assertEqual(
    evidence.materializationEvidence.digest.hex,
    "671e6a363745b1ce2e8d29c1a63438170fe9511c8884ea42298cf9b8886e5c1a",
    "materializationEvidence.digest.hex"
  );
  assertEqual(
    evidence.materializationEvidence.provenance.publicDistribution,
    "notPublicDistributable",
    "materializationEvidence.provenance.publicDistribution"
  );
  assertEqual(
    evidence.materializationEvidence.parser.parserPackageName,
    "@webtoon/psd",
    "materializationEvidence.parser.parserPackageName"
  );
  assertEqual(
    evidence.materializationEvidence.extraction.options.bytesPersisted,
    false,
    "materializationEvidence.extraction.options.bytesPersisted"
  );
  assertAbsent(evidence.materializationEvidence.binaryAssetRef, "materializationEvidence.binaryAssetRef");
  assertAbsent(evidence.materializationEvidence.textureId, "materializationEvidence.textureId");
  assertEqual(evidence.unsupportedClaims.photoshopStyleFinalCompositing, "notEvaluated", "unsupportedClaims.photoshopStyleFinalCompositing");
  assertEqual(evidence.unsupportedClaims.rendererPixelOracle, "notEvaluated", "unsupportedClaims.rendererPixelOracle");
  assertEqual(evidence.unsupportedClaims.textureSamplingCorrectness, "notEvaluated", "unsupportedClaims.textureSamplingCorrectness");
  assertEqual(evidence.unsupportedClaims.publicDemoDistribution, "notSupported", "unsupportedClaims.publicDemoDistribution");

  for (const forbiddenPath of [
    ["materializationEvidence", "rawRgbaBytes"],
    ["materializationEvidence", "visualBytes"],
    ["materializationEvidence", "dataUrl"],
    ["materializationEvidence", "base64"]
  ]) {
    assertAbsent(getNested(evidence, forbiddenPath), forbiddenPath.join("."));
  }
}

const expectedEvidence = JSON.parse(await readFile(expectedEvidencePath, "utf8"));
const regeneratedEvidence = await runMaterializationScript();

assertFixtureBoundary(expectedEvidence);
assertFixtureBoundary(regeneratedEvidence);

const expectedSerialized = stableJson(expectedEvidence);
const regeneratedSerialized = stableJson(regeneratedEvidence);

if (regeneratedSerialized !== expectedSerialized) {
  throw new Error(
    `Wave44 PSD fixture evidence drifted from ${path.normalize(expectedEvidencePath)}`
  );
}

console.log("Wave44 PSD fixture evidence regression passed.");
