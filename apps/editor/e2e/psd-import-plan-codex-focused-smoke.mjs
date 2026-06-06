import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { locateBrowserExecutable } from "./browser-discovery.mjs";
import { launchHeadlessBrowser } from "./chrome-launcher.mjs";
import { createPageSession } from "./page-session.mjs";
import { startOrReuseEditorServer } from "./vite-server.mjs";
import {
  createLayerTreeDrawableRowTestId,
  createLayerTreePartGroupTestId,
  editorProjectStorageKey,
  editorTestIds
} from "./test-ids.mjs";

const sampleFileUrl = new URL("../../../test_data/sample_model.psd", import.meta.url);
const sampleSummaryUrl = new URL(
  "../../../fixtures/contracts/wave31-byte-sample-characterization/expected/sample-model-byte-characterization-summary.json",
  import.meta.url
);
const fixtureManifestUrl = new URL(
  "../../../discussion/tests/fixtures/fixture-manifest.md",
  import.meta.url
);
const traceabilityMatrixUrl = new URL(
  "../../../discussion/tests/traceability/test-traceability-matrix.md",
  import.meta.url
);

const materializedMediaType = "application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8";
const sourceAssetId = "src_explicit_psd_sample_model_22406225";
const sourcePackagePath = "assets/sources/psd/sample_model_22406225.psd";
const importPlanScopeRef = "psd:root";
const destinationParentPartId = "part_root";
const expectedRootCandidateCount = 126;
const expectedEligibleCandidateCount = 121;
const expectedHiddenCandidateCount = 5;
const expectedTotalRawRgbaByteEstimate = 49_172_000;
const codexWorkflowStorageKey = "private-2d-rigging-lab.editor-project.wave49-codex-focused";
const frontHairLayer = {
  displayName: "front hair",
  fullPathLabel: "hair_front / front hair",
  sourceLayerId: "psd:root/group[2]/layer[0]",
  sourceLayerName: "front hair",
  sourceLayerPath: ["hair_front", "front hair"],
  materializationId: "mat_psd_root_group_2_layer_0",
  byteLength: 1_537_600,
  previewPartId: "part_hair_front_front_hair_psd_root_group_2_layer_0",
  previewDrawableId: "draw_hair_front_front_hair_psd_root_group_2_layer_0",
  previewTextureId: "tex_hair_front_front_hair_psd_root_group_2_layer_0",
  previewMeshId: "mesh_hair_front_front_hair_psd_root_group_2_layer_0",
  partId: "part_hair_front_front_hair",
  drawableId: "draw_hair_front_front_hair",
  meshId: "mesh_hair_front_front_hair",
  textureId: "tex_hair_front_front_hair",
  binaryAssetId: "bin_hair_front_front_hair_raw_rgba"
};
const hiddenHeadwearLayer = {
  displayName: "headwear",
  sourceLayerId: "psd:root/layer[1]"
};
const staleContextLayerRef = "psd:root/layer[3]";
const psdImportPlanCodexFocusedSmokeViewports = [
  {
    name: "desktop",
    width: 1280,
    height: 900,
    isMobile: false
  }
];

export const runPsdImportPlanCodexFocusedSmoke = async ({ page, viewport }) => {
  const sample = await readSampleEvidence();

  await waitForTestId(page, editorTestIds.explicitPsdImportPanel);
  await waitForTestId(page, editorTestIds.explicitPsdImportForm);
  await waitForTestId(page, editorTestIds.explicitPsdImportFileInput);
  await waitForTestId(page, editorTestIds.explicitPsdImportSubmit);
  await waitForTestId(page, editorTestIds.explicitPsdImportPlanForm);
  await waitForTestId(page, editorTestIds.explicitPsdImportPlanApprovedBatchForm);
  await assertInitialExplicitPsdImportState(page, `${viewport.name} initial`);

  await setSelectedLayerNodeRef(page, frontHairLayer.sourceLayerId);
  await selectFileInput(page, editorTestIds.explicitPsdImportFileInput, fileURLToPath(sampleFileUrl));
  await clickTestId(page, editorTestIds.explicitPsdImportSubmit);
  await waitForText(
    page,
    editorTestIds.explicitPsdImportStatus,
    "PSD parsed in browser session",
    60_000
  );
  await assertParsedExplicitPsdImportState(page, sample, `${viewport.name} parsed`);
  await assertNoUnsupportedExplicitPsdImportClaims(page, `${viewport.name} parsed`);

  await setImportPlanPreviewInputs(page, {
    scopeRef: importPlanScopeRef,
    approvedLayerRefs: [frontHairLayer.sourceLayerId],
    destinationParentPartId
  });
  await clickTestId(page, editorTestIds.explicitPsdImportPlanSubmit);
  await waitForText(
    page,
    editorTestIds.explicitPsdImportPlanPreview,
    "Import-plan preview ready",
    90_000
  );
  await assertFrontHairImportPlanPreviewState(page, sample, `${viewport.name} front hair preview`);
  await assertHiddenHeadwearBlockedState(page, `${viewport.name} hidden headwear taxonomy`);
  await assertNoUnsupportedExplicitPsdImportClaims(page, `${viewport.name} front hair preview`);

  await setApprovedImportPlanDestinationParentPart(page, destinationParentPartId);
  await clickTestId(page, editorTestIds.explicitPsdImportPlanApprovedBatchSubmit);
  await waitForText(
    page,
    editorTestIds.explicitPsdImportBatchIntakeResult,
    "Selected PSD leaf layers added to generated parts",
    90_000
  );
  await waitForText(page, editorTestIds.operationStatus, "importPsdLayerMaterializationBatch committed");
  await waitForOperationLogEntryCount(page, 2);
  await assertFrontHairBatchCommittedState(page, `${viewport.name} UI approved batch`);
  await assertNoUnsupportedExplicitPsdImportClaims(page, `${viewport.name} UI approved batch`);

  await clickTestId(page, editorTestIds.projectPersistenceSave);
  await waitForText(page, editorTestIds.projectPersistenceStatus, "Saved");
  await assertSavedProjectIncludesFrontHair(page, sample, `${viewport.name} UI save`);

  await page.reload();
  await waitForTestId(page, editorTestIds.shell);
  await clickTestId(page, editorTestIds.projectPersistenceLoad);
  await waitForText(page, editorTestIds.projectPersistenceStatus, "Loaded");
  await waitForText(page, editorTestIds.projectPersistenceSummary, "Persistent bytes: 1 restored / 1 checked");
  await assertExplicitPsdImportClearedAfterLoad(page, sample, `${viewport.name} UI load`);
  await assertFrontHairProjectStateAfterLoad(page, `${viewport.name} UI load`);
  await assertSavedProjectIncludesFrontHair(page, sample, `${viewport.name} UI load`);

  const codexResult = await runCodexFacingImportPlanCommandPath(page, {
    sampleAbsolutePath: fileURLToPath(sampleFileUrl),
    sourceDigest: sample.sourceDigest,
    sourceByteLength: sample.byteLength
  });

  const screenshot = await page.captureScreenshot(`${viewport.name} wave49 PSD import-plan Codex focused smoke`);

  return {
    viewport: viewport.name,
    sourcePath: "test_data/sample_model.psd",
    byteLength: sample.byteLength,
    sourceDigest: sample.sourceDigest,
    rootScopeRef: importPlanScopeRef,
    candidateCount: expectedRootCandidateCount,
    approvedLayerRefs: [frontHairLayer.sourceLayerId],
    materializedByteLength: frontHairLayer.byteLength,
    codexOperationId: codexResult.operationId,
    codexStaleContextStatus: codexResult.staleContextStatus,
    screenshot
  };
};

const readSampleEvidence = async () => {
  const summary = JSON.parse(await readFile(sampleSummaryUrl, "utf8"));
  const sampleBytes = await readFile(sampleFileUrl);
  const base64Prefix = Buffer.from(sampleBytes.subarray(0, 256)).toString("base64").slice(0, 96);

  return {
    fileName: "sample_model.psd",
    byteLength: summary.byteEvidence.byteLength,
    byteLengthLabel: `${summary.byteEvidence.byteLength} bytes`,
    sourceDigest: String(summary.byteEvidence.digest.hex).toLowerCase(),
    base64Prefix,
    sourcePackagePath
  };
};

const assertInitialExplicitPsdImportState = async (page, label) => {
  await waitForText(page, editorTestIds.explicitPsdImportStatus, "No PSD selected");
  await waitForText(page, editorTestIds.explicitPsdImportPlanPreview, "No import-plan preview generated");
  await waitForText(page, editorTestIds.explicitPsdImportPlanCandidates, "No import-plan leaf candidates");

  const state = await readExplicitPsdImportState(page);
  if (
    state.importPlanScopeRefControlValue !== importPlanScopeRef ||
    state.importPlanApprovedRefsControlValue.trim() !== ""
  ) {
    throw new Error(`${label} initial import-plan controls mismatch: ${JSON.stringify(state)}.`);
  }
};

const assertParsedExplicitPsdImportState = async (page, sample, label) => {
  const state = await readExplicitPsdImportState(page);
  const failures = [];
  const expectText = (field, text, expected) => {
    if (!String(text).includes(expected)) {
      failures.push(`${field} missing ${JSON.stringify(expected)} in ${JSON.stringify(text)}`);
    }
  };
  const expectFact = (section, key, expected) => {
    if (section[key] !== expected) {
      failures.push(`${key}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(section[key])}`);
    }
  };

  expectText("status", state.statusText, "PSD parsed in browser session");
  expectText("panel", state.panelText, sample.fileName);
  expectFact(state.sourceFacts, "Filename", sample.fileName);
  expectFact(state.sourceFacts, "Byte length", sample.byteLengthLabel);
  expectFact(state.sourceFacts, "Raw PSD bytes", "not persisted by parser bridge");
  expectFact(state.documentFacts, "Layers", String(expectedRootCandidateCount));
  expectFact(state.documentFacts, "Visible layers", String(expectedEligibleCandidateCount));
  expectFact(state.persistenceFacts, "Parser objects", "notPersisted");
  expectFact(state.persistenceFacts, "PSD bytes", "sessionReadOnlyNoRawBytesPersistedByParser");
  expectFact(state.persistenceFacts, "Compositing claim", "none");
  expectFact(state.persistenceFacts, "Pixel oracle claim", "none");
  expectText("layerTree", state.layerTreeText, frontHairLayer.sourceLayerId);
  expectText("layerTree", state.layerTreeText, frontHairLayer.displayName);
  expectText("diagnostics", state.diagnosticsText, "browserPsdParser.parse.completed");
  expectText("diagnostics", state.diagnosticsText, "browserPsdParser.materialization.completed");

  if (failures.length > 0) {
    throw new Error(`${label} parsed explicit PSD import assertions failed: ${failures.join("; ")}.`);
  }
};

const assertFrontHairImportPlanPreviewState = async (page, sample, label) => {
  const state = await readExplicitPsdImportState(page);
  const selectedApprovedRefs = parseSelectedRefs(state.importPlanApprovedRefsControlValue);
  const failures = [];
  const expectText = (field, text, expected) => {
    if (!String(text).includes(expected)) {
      failures.push(`${field} missing ${JSON.stringify(expected)} in ${JSON.stringify(text)}`);
    }
  };
  const expectFactContains = (section, key, expected) => {
    const value = section[key];
    if (!String(value).includes(expected)) {
      failures.push(`${key}: expected ${JSON.stringify(value)} to include ${JSON.stringify(expected)}`);
    }
  };

  expectText("preview", state.importPlanPreviewText, "Import-plan preview ready");
  expectFactContains(state.importPlanPreviewFacts, "Candidate plan digest", "sha256:");
  expectFactContains(state.importPlanPreviewFacts, "Source", `${sample.fileName} / ${sample.byteLengthLabel}`);
  expectFactContains(state.importPlanPreviewFacts, "Source digest", `sha256:${sample.sourceDigest}`);
  expectFactContains(state.importPlanPreviewFacts, "Scope", `${importPlanScopeRef} / ${importPlanScopeRef}`);
  expectFactContains(state.importPlanPreviewFacts, "Destination parent part", destinationParentPartId);
  expectFactContains(
    state.importPlanPreviewFacts,
    "Candidates / eligible / approved / not-approved",
    `${expectedRootCandidateCount} / ${expectedEligibleCandidateCount} / 1 / ${expectedRootCandidateCount - 1}`
  );
  expectFactContains(
    state.importPlanPreviewFacts,
    "Hidden / unsupported / collisions / byte blocked",
    `${expectedHiddenCandidateCount} / ${expectedHiddenCandidateCount} / 0 / 0`
  );
  expectFactContains(
    state.importPlanPreviewFacts,
    "Byte estimate total / approved",
    `${expectedTotalRawRgbaByteEstimate} bytes / ${frontHairLayer.byteLength} bytes`
  );
  expectText("diagnostics", state.importPlanDiagnosticsText, "browserPsdImportPlan.candidatePlan.ready");
  expectText("candidates", state.importPlanCandidatesText, frontHairLayer.sourceLayerId);
  expectText("candidates", state.importPlanCandidatesText, frontHairLayer.fullPathLabel);
  expectText("candidates", state.importPlanCandidatesText, "statuses=candidate");
  expectText("candidates", state.importPlanCandidatesText, "approval=requested");
  expectText("candidates", state.importPlanCandidatesText, `part=${frontHairLayer.previewPartId}`);
  expectText("candidates", state.importPlanCandidatesText, `drawable=${frontHairLayer.previewDrawableId}`);
  expectText("candidates", state.importPlanCandidatesText, `texture=${frontHairLayer.previewTextureId}`);
  expectText("candidates", state.importPlanCandidatesText, `mesh=${frontHairLayer.previewMeshId}`);

  if (JSON.stringify(selectedApprovedRefs) !== JSON.stringify([frontHairLayer.sourceLayerId])) {
    failures.push(`approved refs mismatch: ${JSON.stringify(selectedApprovedRefs)}`);
  }

  if (failures.length > 0) {
    throw new Error(`${label} import-plan preview assertions failed: ${failures.join("; ")}.`);
  }
};

const assertHiddenHeadwearBlockedState = async (page, label) => {
  const state = await readExplicitPsdImportState(page);
  const failures = [];
  const expectText = (field, text, expected) => {
    if (!String(text).includes(expected)) {
      failures.push(`${field} missing ${JSON.stringify(expected)} in ${JSON.stringify(text)}`);
    }
  };

  expectText("candidates", state.importPlanCandidatesText, hiddenHeadwearLayer.sourceLayerId);
  expectText("candidates", state.importPlanCandidatesText, hiddenHeadwearLayer.displayName);
  expectText("candidates", state.importPlanCandidatesText, "statuses=hidden,unsupported,notApproved");
  expectText("candidates", state.importPlanCandidatesText, "approvalBlocked=hiddenLayerUnsupported");

  if (failures.length > 0) {
    throw new Error(`${label} blocked hidden candidate assertions failed: ${failures.join("; ")}.`);
  }
};

const assertFrontHairBatchCommittedState = async (page, label) => {
  const state = await readExplicitPsdImportState(page);
  const failures = [];
  const expectText = (field, text, expected) => {
    if (!String(text).includes(expected)) {
      failures.push(`${field} missing ${JSON.stringify(expected)} in ${JSON.stringify(text)}`);
    }
  };
  const expectFact = (section, key, expected) => {
    if (section[key] !== expected) {
      failures.push(`${key}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(section[key])}`);
    }
  };
  const expectFactContains = (section, key, expected) => {
    if (!String(section[key]).includes(expected)) {
      failures.push(`${key}: expected ${JSON.stringify(section[key])} to include ${JSON.stringify(expected)}`);
    }
  };

  expectText("batchResult", state.batchIntakeResultText, "Selected PSD leaf layers added to generated parts");
  expectFact(state.batchIntakeResultFacts, "Batch id", `batch_${sourceAssetId}_1`);
  expectFact(state.batchIntakeResultFacts, "Requested / success / failure", "1 / 1 / 0");
  expectFact(state.batchIntakeResultFacts, "Materialization requested / success / failure", "1 / 1 / 0");
  expectFact(state.batchIntakeResultFacts, "Destination parent part", destinationParentPartId);
  expectFact(state.batchIntakeResultFacts, "Total materialized byte length", `${frontHairLayer.byteLength} bytes`);
  expectFact(state.batchIntakeResultFacts, "Approved leaf candidates", "1");
  expectFact(state.batchIntakeResultFacts, "Not-approved / blocked candidates", "125 / 5");
  expectFactContains(state.batchIntakeResultFacts, "Batch evidence id", `evidence_batch_${sourceAssetId}_1`);
  expectFactContains(state.batchIntakeResultFacts, "Persistence", "binaryAssetRefOnlyNoInlineBytes");
  expectText("entry", state.batchIntakeEntriesText, frontHairLayer.sourceLayerId);
  expectText("entry", state.batchIntakeEntriesText, frontHairLayer.sourceLayerPath.join(" / "));
  expectText("entry", state.batchIntakeEntriesText, "approvalOrder=0");
  expectText("entry", state.batchIntakeEntriesText, `materializationEvidence=${frontHairLayer.materializationId}`);
  expectText("entry", state.batchIntakeEntriesText, `part=${frontHairLayer.partId}`);
  expectText("entry", state.batchIntakeEntriesText, `drawable=${frontHairLayer.drawableId}`);
  expectText("entry", state.batchIntakeEntriesText, `texture=${frontHairLayer.textureId}`);
  expectText("entry", state.batchIntakeEntriesText, `mesh=${frontHairLayer.meshId}`);
  expectText("entry", state.batchIntakeEntriesText, "issues=none");
  expectText("entry", state.batchIntakeEntriesText, "publicDemoAsset=false");
  expectText("diagnostics", state.batchIntakeDiagnosticsText, "editor.explicitPsdLayerBatchIntake.committed");

  if (failures.length > 0) {
    throw new Error(`${label} front hair batch assertions failed: ${failures.join("; ")}.`);
  }
};

const assertSavedProjectIncludesFrontHair = async (page, sample, label) => {
  const stored = await page.evaluate((storageKey, expected) => {
    const raw = localStorage.getItem(storageKey);
    if (raw === null) {
      return null;
    }

    const project = JSON.parse(raw);
    const graph = readPackageJsonFile(project, "model/graph.json");
    const drawables = readPackageJsonFile(project, "model/drawables.json");
    const meshes = readPackageJsonFile(project, "model/meshes.json");
    const sourceManifest = readPackageJsonFile(project, "assets/sources/source-manifest.json");
    const textureAtlas = readPackageJsonFile(project, "assets/textures/texture-atlas.json");
    const serializedProject = JSON.stringify(project);
    const packageText = Array.isArray(project.packageFileSet)
      ? project.packageFileSet.map((entry) => entry.text ?? "").join("\n")
      : "";
    const operationLogJsonl = String(project.operationLogJsonl ?? "");
    const operationLogEntries = operationLogJsonl
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line));
    const sourceAsset = sourceManifest?.sourceAssets?.find(
      (candidate) => candidate.sourceAssetId === expected.sourceAssetId
    );
    const texture = textureAtlas?.textures?.find((candidate) => candidate.textureId === expected.textureId);
    const drawable = drawables?.drawables?.find((candidate) => candidate.drawableId === expected.drawableId);
    const mesh = meshes?.meshes?.find((candidate) => candidate.meshId === expected.meshId);
    const part = graph?.parts?.find((candidate) => candidate.partId === expected.partId);
    const batchOperation = operationLogEntries.find(
      (entry) => entry.operationType === "importPsdLayerMaterializationBatch"
    );
    const batchEvidence = batchOperation?.evidence?.psdLayerMaterializationBatchEvidence?.[0] ??
      batchOperation?.operationResult?.psdLayerMaterializationBatchEvidence?.[0] ??
      batchOperation?.payload?.psdLayerMaterializationBatchEvidence?.[0] ??
      null;

    return {
      schemaVersion: project.schemaVersion,
      packageId: project.packageSummary?.packageId ?? null,
      packageRevision: project.packageSummary?.packageRevision ?? null,
      serializedProject,
      packageText,
      operationLogJsonl,
      operationTypes: operationLogEntries.map((entry) => entry.operationType),
      sourceAsset: sourceAsset ?? null,
      texture: texture ?? null,
      drawable: drawable ?? null,
      mesh: mesh ?? null,
      part: part ?? null,
      batchOperationJson: batchOperation === undefined ? "" : JSON.stringify(batchOperation),
      batchEvidence
    };

    function readPackageJsonFile(projectValue, packagePath) {
      if (!Array.isArray(projectValue.packageFileSet)) {
        return null;
      }

      const entry = projectValue.packageFileSet.find((candidate) => candidate.path === packagePath);
      if (typeof entry?.text !== "string") {
        return null;
      }

      return JSON.parse(entry.text);
    }
  }, editorProjectStorageKey, {
    sourceAssetId,
    partId: frontHairLayer.partId,
    drawableId: frontHairLayer.drawableId,
    meshId: frontHairLayer.meshId,
    textureId: frontHairLayer.textureId
  });

  if (stored === null) {
    throw new Error(`${label} did not save a browser-local project.`);
  }

  const failures = [];
  const expect = (condition, message) => {
    if (!condition) {
      failures.push(message);
    }
  };

  expect(stored.schemaVersion === "editor-project-persistence-v1", "unexpected persisted schema version");
  expect(stored.packageId === "pkg_editor_browser_sample", "unexpected package id");
  expect(JSON.stringify(stored.operationTypes) === JSON.stringify([
    "importPsdSourceAsset",
    "importPsdLayerMaterializationBatch"
  ]), `unexpected operation types ${JSON.stringify(stored.operationTypes)}`);
  expect(stored.sourceAsset?.sourceAssetId === sourceAssetId, "missing source asset");
  expect(stored.sourceAsset?.filePath === sample.sourcePackagePath, "source package path mismatch");
  expect(stored.sourceAsset?.binaryAssetRef === undefined || stored.sourceAsset?.binaryAssetRef === null, "source PSD bytes persisted as binary asset");
  expect(stored.texture?.textureId === frontHairLayer.textureId, "missing front hair texture");
  expect(stored.texture?.sourceLayerId === frontHairLayer.sourceLayerId, "texture source layer mismatch");
  expect(stored.texture?.binaryAssetRef?.binaryAssetId === frontHairLayer.binaryAssetId, "texture binary ref mismatch");
  expect(stored.texture?.binaryAssetRef?.byteLength === frontHairLayer.byteLength, "texture byte length mismatch");
  expect(stored.texture?.binaryAssetRef?.mediaType === materializedMediaType, "texture media type mismatch");
  expect(stored.drawable?.drawableId === frontHairLayer.drawableId, "missing front hair drawable");
  expect(stored.drawable?.partId === frontHairLayer.partId, "drawable part mismatch");
  expect(stored.part?.partId === frontHairLayer.partId, "missing front hair part");
  expect(stored.part?.drawableIds?.includes(frontHairLayer.drawableId) === true, "front hair part missing drawable");
  expect(stored.mesh?.meshId === frontHairLayer.meshId, "missing front hair mesh");
  expect(stored.batchOperationJson.includes("psd-import-plan-approval-bridge-evidence-v1"), "missing approval bridge evidence");
  expect(stored.batchOperationJson.includes(frontHairLayer.sourceLayerId), "batch operation missing front hair ref");
  expect(stored.batchOperationJson.includes("\"publicDemoAsset\":false"), "missing private/local publicDemoAsset=false evidence");

  const forbiddenSerializedClaims = [
    sample.base64Prefix,
    "\"publicDemoAsset\":true",
    "\"rawParserObject\"",
    "rawRgbaBytes",
    "visualBytes",
    "sourcePsdBytes",
    "currentPsdFile",
    "raw materialized bytes"
  ].filter((claim) => stored.serializedProject.includes(claim));
  const forbiddenPackagePayloadClaims = [
    "arrayBuffer",
    "\"bytes\"",
    "bytesBase64",
    "payloadBase64",
    "rawRgbaBytes",
    "visualBytes",
    sample.base64Prefix
  ].filter((claim) => stored.packageText.includes(claim) || stored.operationLogJsonl.includes(claim));
  expect(forbiddenSerializedClaims.length === 0, `forbidden serialized claims: ${forbiddenSerializedClaims.join(", ")}`);
  expect(forbiddenPackagePayloadClaims.length === 0, `forbidden package payload claims: ${forbiddenPackagePayloadClaims.join(", ")}`);

  if (failures.length > 0) {
    throw new Error(`${label} saved project front hair assertions failed: ${failures.join("; ")}.`);
  }
};

const assertExplicitPsdImportClearedAfterLoad = async (page, sample, label) => {
  await waitForText(page, editorTestIds.explicitPsdImportStatus, "No PSD selected");
  await waitForText(page, editorTestIds.explicitPsdImportPlanPreview, "No import-plan preview generated");
  const state = await readExplicitPsdImportState(page);
  const forbiddenLoadedClaims = [
    sample.fileName,
    frontHairLayer.sourceLayerId,
    "PSD parsed in browser session",
    "browserPsdImportPlan.candidatePlan.ready",
    "Selected PSD leaf layers added to generated parts"
  ].filter((claim) => state.panelText.includes(claim));

  if (forbiddenLoadedClaims.length > 0) {
    throw new Error(
      `${label} explicit PSD import panel retained session-only evidence: ${forbiddenLoadedClaims.join(", ")}.`
    );
  }
};

const assertFrontHairProjectStateAfterLoad = async (page, label) => {
  await waitForOperationLogEntryCount(page, 2);
  await waitForText(
    page,
    editorTestIds.operationLogSummary,
    "importPsdSourceAsset, importPsdLayerMaterializationBatch"
  );
  await waitForText(page, editorTestIds.sourceIntakeImportedSources, "1 imported source asset");
  await waitForText(page, editorTestIds.sourceIntakeImportedSources, sourceAssetId);
  await waitForText(page, editorTestIds.sourceIntakeImportedSources, "restored from same-origin browser-local IndexedDB");
  await waitForText(page, createLayerTreePartGroupTestId(frontHairLayer.partId), frontHairLayer.displayName);
  await waitForText(page, createLayerTreePartGroupTestId(frontHairLayer.partId), frontHairLayer.partId);
  await waitForText(
    page,
    createLayerTreeDrawableRowTestId(frontHairLayer.drawableId),
    `${frontHairLayer.displayName} / ${frontHairLayer.drawableId}`
  );
  await waitForText(page, createLayerTreeDrawableRowTestId(frontHairLayer.drawableId), frontHairLayer.textureId);
  await waitForText(page, createLayerTreeDrawableRowTestId(frontHairLayer.drawableId), "Texture resolved");
  await waitForText(page, editorTestIds.sourceIntakeImportedSources, `Texture binary ref ${frontHairLayer.textureId}`);
  await waitForText(page, editorTestIds.sourceIntakeImportedSources, frontHairLayer.binaryAssetId);

  const projectText = await page.evaluate(() => document.body?.textContent ?? "");
  const forbiddenPositiveClaims = [
    "public demo asset",
    "raw parser object persisted",
    "source PSD bytes persisted"
  ].filter((claim) => projectText.toLowerCase().includes(claim.toLowerCase()));

  if (forbiddenPositiveClaims.length > 0) {
    throw new Error(`${label} loaded project boundary mismatch: ${forbiddenPositiveClaims.join(", ")}.`);
  }
};

const runCodexFacingImportPlanCommandPath = async (page, input) => {
  const result = await page.evaluate(async (options) => {
    const [{ createEditorWorkflowController }, { createBrowserProjectStore }] = await Promise.all([
      import("/src/editor-workflow/index.ts"),
      import("/src/project-persistence/index.ts")
    ]);
    const workflow = createEditorWorkflowController({
      projectStore: createBrowserProjectStore({
        storage: window.localStorage,
        storageKey: options.storageKey
      }),
      now: () => new Date("2026-06-06T00:00:00.000Z")
    });
    window.localStorage.removeItem(options.storageKey);

    const samplePath = options.sampleAbsolutePath.replace(/\\/g, "/");
    const response = await fetch(`/@fs/${samplePath}`);
    if (!response.ok) {
      throw new Error(`Could not fetch sample PSD for Codex focused path: HTTP ${response.status}.`);
    }
    const bytes = await response.arrayBuffer();
    const file = new File([bytes], "sample_model.psd", {
      type: "image/vnd.adobe.photoshop"
    });

    const makeRequest = (commandId, command, capabilities, payload) => ({
      schemaVersion: "ai-command-request-v1",
      commandId,
      session: {
        agentId: "agent_wave49_codex_focused_e2e",
        capabilities
      },
      basis: {
        packageRevision: workflow.state.revision.packageRevision,
        relatedAC: ["AC-MVP-014"],
        relatedScenarios: ["SC-AGENT-002"]
      },
      command,
      payload
    });
    const expect = (condition, message) => {
      if (!condition) {
        throw new Error(message);
      }
    };
    const findCandidate = (plan, layerRef) =>
      plan?.candidates.find((candidate) => candidate.layerRef === layerRef) ?? null;

    await workflow.parseExplicitBrowserPsdImportFile({
      file,
      selectedLayerNodeRef: options.frontHairRef
    });

    const setApprovalResponse = await workflow.aiCommandHost.execute(
      makeRequest(
        "cmd_wave49_set_front_hair_import_plan",
        "setPsdImportPlanApproval",
        ["dryRunEdit"],
        {
          scopeRef: options.scopeRef,
          approvedLayerNodeRefs: [options.frontHairRef],
          destinationParentPartId: options.destinationParentPartId
        }
      )
    );
    const approvedPlan = setApprovalResponse.payload?.result?.importPlan;
    expect(setApprovalResponse.status === "ok", `set approval failed: ${JSON.stringify(setApprovalResponse)}`);
    expect(approvedPlan !== null && approvedPlan !== undefined, "Codex set approval did not return an import plan.");
    expect(approvedPlan.candidateCount === options.expectedCandidateCount, "Codex plan candidate count mismatch.");
    expect(approvedPlan.eligibleCandidateCount === options.expectedEligibleCount, "Codex plan eligible count mismatch.");
    expect(approvedPlan.approvedLayerNodeRefs.join(",") === options.frontHairRef, "Codex approved refs mismatch.");
    expect(approvedPlan.approvedRawRgbaByteEstimate === options.frontHairBytes, "Codex approved byte estimate mismatch.");
    expect(approvedPlan.sourceDigest === `sha256:${options.sourceDigest}`, "Codex source digest mismatch.");
    const frontHairCandidate = findCandidate(approvedPlan, options.frontHairRef);
    const hiddenCandidate = findCandidate(approvedPlan, options.hiddenHeadwearRef);
    expect(frontHairCandidate?.approved === true, "Codex front hair candidate was not approved.");
    expect(frontHairCandidate?.statuses.includes("candidate") === true, "Codex front hair candidate missing candidate status.");
    expect(frontHairCandidate?.generatedRefs.partId === options.frontHairPreviewPartId, "Codex front hair preview part ref mismatch.");
    expect(
      frontHairCandidate?.generatedRefs.drawableId === options.frontHairPreviewDrawableId,
      "Codex front hair preview drawable ref mismatch."
    );
    expect(
      frontHairCandidate?.generatedRefs.textureId === options.frontHairPreviewTextureId,
      "Codex front hair preview texture ref mismatch."
    );
    expect(frontHairCandidate?.generatedRefs.meshId === options.frontHairPreviewMeshId, "Codex front hair preview mesh ref mismatch.");
    expect(hiddenCandidate?.approved === false, "Codex hidden headwear candidate should not be approved.");
    expect(hiddenCandidate?.statuses.includes("hidden") === true, "Codex hidden headwear missing hidden status.");
    expect(hiddenCandidate?.statuses.includes("unsupported") === true, "Codex hidden headwear missing unsupported status.");
    expect(
      hiddenCandidate?.approvalBlockedReasons.includes("hiddenLayerUnsupported") === true,
      "Codex hidden headwear missing hiddenLayerUnsupported blocker."
    );

    const expectedPlan = {
      planId: approvedPlan.planId,
      candidatePlanDigest: approvedPlan.candidatePlanDigest,
      sourceDigest: approvedPlan.sourceDigest,
      sourceFileName: approvedPlan.sourceFileName,
      sourceByteLength: approvedPlan.sourceByteLength,
      scopeRef: approvedPlan.scopeRef,
      destinationParentPartId: approvedPlan.destinationParentPartId
    };
    const preflightResponse = await workflow.aiCommandHost.execute(
      makeRequest(
        "cmd_wave49_preflight_front_hair_import_plan",
        "preflightPsdImportPlanIntake",
        ["dryRunEdit"],
        {
          approvedLayerNodeRefs: [options.frontHairRef],
          destinationParentPartId: options.destinationParentPartId,
          expectedPlan
        }
      )
    );
    const preflightOperation = preflightResponse.operationResult ?? preflightResponse.payload?.operationResult;
    const preflightBatch = preflightResponse.payload?.result?.latestBatch;
    expect(preflightResponse.status === "ok", `Codex preflight failed: ${JSON.stringify(preflightResponse)}`);
    expect(preflightOperation?.status === "dry_run", "Codex preflight did not return a dry-run operation.");
    expect(preflightBatch?.status === "preflightReady", "Codex preflight latest batch was not preflightReady.");
    expect(preflightBatch?.generatedResultRefs?.[0]?.partId === options.frontHairPartId, "Codex preflight part result ref mismatch.");
    expect(preflightBatch?.generatedResultRefs?.[0]?.drawableId === options.frontHairDrawableId, "Codex preflight drawable result ref mismatch.");
    expect(preflightBatch?.generatedResultRefs?.[0]?.textureId === options.frontHairTextureId, "Codex preflight texture result ref mismatch.");
    expect(preflightBatch?.generatedResultRefs?.[0]?.meshId === options.frontHairMeshId, "Codex preflight mesh result ref mismatch.");
    expect(preflightBatch?.issues.length === 0, "Codex preflight returned unexpected issues.");

    workflow.aiCommandHost.approvalPolicy.approveDryRunCommand({
      dryRunCommandId: "cmd_wave49_preflight_front_hair_import_plan",
      operationId: preflightOperation.operationId
    });

    const staleContextResponse = await workflow.aiCommandHost.execute(
      makeRequest(
        "cmd_wave49_execute_stale_context_import_plan",
        "executePsdImportPlanIntake",
        ["commitWithApproval"],
        {
          approvedLayerNodeRefs: [options.staleContextLayerRef],
          destinationParentPartId: options.destinationParentPartId,
          expectedPlan,
          approvedPreflightCommandId: "cmd_wave49_preflight_front_hair_import_plan",
          expectedOperationId: preflightOperation.operationId
        }
      )
    );
    expect(staleContextResponse.status === "rejected", "Codex stale approval context was not rejected.");
    expect(
      staleContextResponse.diagnostics.some((diagnostic) =>
        diagnostic.checkId === "ai.approvalRejected" &&
        diagnostic.message.includes("does not match commit context")
      ),
      `Codex stale context diagnostics mismatch: ${JSON.stringify(staleContextResponse.diagnostics)}`
    );

    const executeResponse = await workflow.aiCommandHost.execute(
      makeRequest(
        "cmd_wave49_execute_front_hair_import_plan",
        "executePsdImportPlanIntake",
        ["commitWithApproval"],
        {
          approvedLayerNodeRefs: [options.frontHairRef],
          destinationParentPartId: options.destinationParentPartId,
          expectedPlan,
          approvedPreflightCommandId: "cmd_wave49_preflight_front_hair_import_plan",
          expectedOperationId: preflightOperation.operationId
        }
      )
    );
    const executeOperation = executeResponse.operationResult ?? executeResponse.payload?.operationResult;
    const executeBatch = executeResponse.payload?.result?.latestBatch;
    const generated = executeBatch?.generatedResultRefs?.[0];
    expect(executeResponse.status === "ok", `Codex execute failed: ${JSON.stringify(executeResponse)}`);
    expect(executeOperation?.status === "committed", "Codex execute did not commit.");
    expect(executeBatch?.status === "committed", "Codex latest batch did not commit.");
    expect(executeBatch?.approvedLayerNodeRefs.join(",") === options.frontHairRef, "Codex execute approved refs mismatch.");
    expect(executeBatch?.operationIds.includes(preflightOperation.operationId) === true, "Codex execute missing batch operation id.");
    expect(generated?.sourceLayerId === options.frontHairRef, "Codex execute source layer ref mismatch.");
    expect(generated?.approvalOrder === 0, "Codex execute approval order mismatch.");
    expect(generated?.materializationId === options.frontHairMaterializationId, "Codex execute materialization id mismatch.");
    expect(generated?.partId === options.frontHairPartId, "Codex execute part ref mismatch.");
    expect(generated?.drawableId === options.frontHairDrawableId, "Codex execute drawable ref mismatch.");
    expect(generated?.textureId === options.frontHairTextureId, "Codex execute texture ref mismatch.");
    expect(generated?.meshId === options.frontHairMeshId, "Codex execute mesh ref mismatch.");
    expect(generated?.issues.length === 0, "Codex execute generated result had issues.");
    expect(executeBatch?.issues.length === 0, "Codex execute latest batch had issues.");
    expect(
      executeResponse.evidenceRefs.includes(`operations/log.jsonl#${preflightOperation.operationId}`),
      "Codex execute response missing operation log evidence ref."
    );

    const saveResult = workflow.saveProject();
    expect(saveResult.status === "saved", "Codex workflow save failed.");
    const loadResult = await workflow.loadProjectWithPersistentBytes();
    expect(loadResult.status === "loaded", "Codex workflow load failed.");
    expect(
      workflow.state.parts.some((part) => part.partId === options.frontHairPartId),
      "Codex workflow loaded project missing front hair part."
    );
    expect(
      workflow.state.drawables.some((drawable) => drawable.drawableId === options.frontHairDrawableId),
      "Codex workflow loaded project missing front hair drawable."
    );

    return {
      operationId: preflightOperation.operationId,
      staleContextStatus: staleContextResponse.status,
      candidatePlanDigest: approvedPlan.candidatePlanDigest,
      generatedResultRefs: executeBatch.generatedResultRefs,
      transcript: workflow.aiCommandHost.transcript.entries.map((entry) => ({
        commandId: entry.commandId,
        command: entry.command,
        status: entry.status,
        operationId: entry.operationId ?? null
      }))
    };
  }, {
    storageKey: codexWorkflowStorageKey,
    sampleAbsolutePath: input.sampleAbsolutePath,
    sourceDigest: input.sourceDigest,
    sourceByteLength: input.sourceByteLength,
    scopeRef: importPlanScopeRef,
    destinationParentPartId,
    frontHairRef: frontHairLayer.sourceLayerId,
    hiddenHeadwearRef: hiddenHeadwearLayer.sourceLayerId,
    staleContextLayerRef,
    expectedCandidateCount: expectedRootCandidateCount,
    expectedEligibleCount: expectedEligibleCandidateCount,
    frontHairBytes: frontHairLayer.byteLength,
    frontHairMaterializationId: frontHairLayer.materializationId,
    frontHairPreviewPartId: frontHairLayer.previewPartId,
    frontHairPreviewDrawableId: frontHairLayer.previewDrawableId,
    frontHairPreviewTextureId: frontHairLayer.previewTextureId,
    frontHairPreviewMeshId: frontHairLayer.previewMeshId,
    frontHairPartId: frontHairLayer.partId,
    frontHairDrawableId: frontHairLayer.drawableId,
    frontHairTextureId: frontHairLayer.textureId,
    frontHairMeshId: frontHairLayer.meshId
  });

  if (
    typeof result?.operationId !== "string" ||
    result.staleContextStatus !== "rejected" ||
    !Array.isArray(result.generatedResultRefs) ||
    result.generatedResultRefs.length !== 1
  ) {
    throw new Error(`Codex-facing PSD import-plan result shape mismatch: ${JSON.stringify(result)}.`);
  }

  return result;
};

const setSelectedLayerNodeRef = async (page, nodeRef) => {
  await page.evaluate((id, value) => {
    const input = document.querySelector(`[data-testid="${id}"]`);

    if (!(input instanceof HTMLInputElement)) {
      throw new Error(`Missing selected layer input for test id ${id}.`);
    }

    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, editorTestIds.explicitPsdImportSelectedLayerNodeRef, nodeRef);
};

const setImportPlanPreviewInputs = async (page, input) => {
  await page.evaluate((ids, value) => {
    const scope = document.querySelector(`[data-testid="${ids.scopeRef}"]`);
    const approvedRefs = document.querySelector(`[data-testid="${ids.approvedRefs}"]`);
    const form = document.querySelector(`[data-testid="${ids.form}"]`);
    const parentPart = form?.querySelector('select[name="importPlanDestinationParentPartId"]');

    if (!(scope instanceof HTMLInputElement)) {
      throw new Error("Missing import-plan scope input.");
    }
    if (!(approvedRefs instanceof HTMLTextAreaElement)) {
      throw new Error("Missing import-plan approved refs textarea.");
    }
    if (!(parentPart instanceof HTMLSelectElement)) {
      throw new Error("Missing import-plan destination parent select.");
    }

    scope.value = value.scopeRef;
    approvedRefs.value = value.approvedLayerRefs.join("\n");
    parentPart.value = value.destinationParentPartId;
    scope.dispatchEvent(new Event("input", { bubbles: true }));
    scope.dispatchEvent(new Event("change", { bubbles: true }));
    approvedRefs.dispatchEvent(new Event("input", { bubbles: true }));
    approvedRefs.dispatchEvent(new Event("change", { bubbles: true }));
    parentPart.dispatchEvent(new Event("input", { bubbles: true }));
    parentPart.dispatchEvent(new Event("change", { bubbles: true }));
  }, {
    form: editorTestIds.explicitPsdImportPlanForm,
    scopeRef: editorTestIds.explicitPsdImportPlanScopeRef,
    approvedRefs: editorTestIds.explicitPsdImportPlanApprovedRefs
  }, input);
};

const setApprovedImportPlanDestinationParentPart = async (page, parentPartId) => {
  await page.evaluate((formId, value) => {
    const form = document.querySelector(`[data-testid="${formId}"]`);
    const select = form?.querySelector('select[name="importPlanApprovedDestinationParentPartId"]');

    if (!(select instanceof HTMLSelectElement)) {
      throw new Error("Missing approved import-plan destination parent part select.");
    }

    select.value = value;
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }, editorTestIds.explicitPsdImportPlanApprovedBatchForm, parentPartId);
};

const selectFileInput = async (page, testId, filePath) => {
  await page.client.call("DOM.enable");
  const { root } = await page.client.call("DOM.getDocument", {
    depth: -1,
    pierce: true
  });
  const { nodeId } = await page.client.call("DOM.querySelector", {
    nodeId: root.nodeId,
    selector: `[data-testid="${testId}"]`
  });

  if (nodeId === 0) {
    throw new Error(`Missing file input for test id ${testId}.`);
  }

  await page.client.call("DOM.setFileInputFiles", {
    nodeId,
    files: [filePath]
  });
  await page.evaluate((id) => {
    const input = document.querySelector(`[data-testid="${id}"]`);

    if (!(input instanceof HTMLInputElement)) {
      throw new Error(`Missing file input for test id ${id}.`);
    }

    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, testId);
};

const clickTestId = async (page, testId) => {
  await page.evaluate((id) => {
    const element = document.querySelector(`[data-testid="${id}"]`);

    if (!(element instanceof HTMLElement)) {
      throw new Error(`Missing element for test id ${id}.`);
    }

    element.click();
  }, testId);
};

const waitForTestId = async (page, testId) => {
  await page.waitFor(
    `test id ${testId}`,
    (id) => document.querySelector(`[data-testid="${id}"]`) !== null,
    { timeoutMs: 8_000 },
    testId
  );
};

const waitForText = async (page, testId, expectedText, timeoutMs = 15_000) => {
  await page.waitFor(
    `${testId} text ${expectedText}`,
    (id, text) => document.querySelector(`[data-testid="${id}"]`)?.textContent?.includes(text) ?? false,
    { timeoutMs },
    testId,
    expectedText
  );
};

const waitForOperationLogEntryCount = async (page, expectedCount) => {
  await page.waitFor(
    `operation log entry count ${expectedCount}`,
    (id, count) => {
      const panel = document.querySelector(`[data-testid="${id}"]`);
      const terms = [...(panel?.querySelectorAll("dt") ?? [])];
      const entryTerm = terms.find((term) => term.textContent === "Entries");

      return entryTerm?.nextElementSibling?.textContent === String(count);
    },
    { timeoutMs: 15_000 },
    editorTestIds.operationLogSummary,
    expectedCount
  );
};

const readExplicitPsdImportState = async (page) =>
  page.evaluate((ids) => {
    const readText = (testId) =>
      document.querySelector(`[data-testid="${testId}"]`)?.textContent ?? "";
    const readFacts = (testId) => {
      const root = document.querySelector(`[data-testid="${testId}"]`);
      const facts = {};

      for (const term of root?.querySelectorAll("dt") ?? []) {
        const key = term.textContent?.trim() ?? "";
        const value = term.nextElementSibling?.textContent?.trim() ?? "";
        facts[key] = value;
      }

      return facts;
    };
    const selectedLayerControl = document.querySelector(`[data-testid="${ids.selectedLayer}"]`);
    const importPlanScopeRefControl = document.querySelector(`[data-testid="${ids.importPlanScopeRef}"]`);
    const importPlanApprovedRefsControl = document.querySelector(`[data-testid="${ids.importPlanApprovedRefs}"]`);

    return {
      panelText: readText(ids.panel),
      statusText: readText(ids.status),
      sourceFacts: readFacts(ids.source),
      documentFacts: readFacts(ids.document),
      featureSupportText: readText(ids.featureSupport),
      importPlanPreviewText: readText(ids.importPlanPreview),
      importPlanPreviewFacts: readFacts(ids.importPlanPreview),
      importPlanCandidatesText: readText(ids.importPlanCandidates),
      importPlanDiagnosticsText: readText(ids.importPlanDiagnostics),
      batchIntakeResultText: readText(ids.batchIntakeResult),
      batchIntakeResultFacts: readFacts(ids.batchIntakeResult),
      batchIntakeEntriesText: readText(ids.batchIntakeEntries),
      batchIntakeDiagnosticsText: readText(ids.batchIntakeDiagnostics),
      layerTreeText: readText(ids.layerTree),
      persistenceFacts: readFacts(ids.persistence),
      diagnosticsText: readText(ids.diagnostics),
      selectedLayerControlValue:
        selectedLayerControl instanceof HTMLInputElement ? selectedLayerControl.value : null,
      importPlanScopeRefControlValue:
        importPlanScopeRefControl instanceof HTMLInputElement ? importPlanScopeRefControl.value : null,
      importPlanApprovedRefsControlValue:
        importPlanApprovedRefsControl instanceof HTMLTextAreaElement ? importPlanApprovedRefsControl.value : null
    };
  }, {
    panel: editorTestIds.explicitPsdImportPanel,
    status: editorTestIds.explicitPsdImportStatus,
    source: editorTestIds.explicitPsdImportSource,
    document: editorTestIds.explicitPsdImportDocument,
    featureSupport: editorTestIds.explicitPsdImportFeatureSupport,
    importPlanPreview: editorTestIds.explicitPsdImportPlanPreview,
    importPlanCandidates: editorTestIds.explicitPsdImportPlanCandidates,
    importPlanDiagnostics: editorTestIds.explicitPsdImportPlanDiagnostics,
    batchIntakeResult: editorTestIds.explicitPsdImportBatchIntakeResult,
    batchIntakeEntries: editorTestIds.explicitPsdImportBatchIntakeEntries,
    batchIntakeDiagnostics: editorTestIds.explicitPsdImportBatchIntakeDiagnostics,
    layerTree: editorTestIds.explicitPsdImportLayerTree,
    persistence: editorTestIds.explicitPsdImportPersistence,
    diagnostics: editorTestIds.explicitPsdImportDiagnostics,
    selectedLayer: editorTestIds.explicitPsdImportSelectedLayerNodeRef,
    importPlanScopeRef: editorTestIds.explicitPsdImportPlanScopeRef,
    importPlanApprovedRefs: editorTestIds.explicitPsdImportPlanApprovedRefs
  });

const parseSelectedRefs = (value) =>
  String(value ?? "")
    .split(/[\s,]+/g)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

const assertNoUnsupportedExplicitPsdImportClaims = async (page, label) => {
  const evidence = await page.evaluate((ids) => {
    const panel = document.querySelector(`[data-testid="${ids.panel}"]`);
    const text = panel?.textContent ?? "";
    const positivePhraseClaimPatterns = [
      {
        label: "public demo asset",
        pattern: /\bpublic demo asset\b/gi
      },
      {
        label: "raw bytes persisted",
        pattern: /\braw bytes\s+(?:are\s+)?persisted\b/gi
      },
      {
        label: "visual bytes persisted",
        pattern: /\bvisual bytes\s+(?:are\s+)?persisted\b/gi
      }
    ];
    const unsupportedScopeClaimPatterns = [
      {
        label: "Cubism compatibility",
        pattern: new RegExp(["Cubism", "compatibility"].join("\\s+"), "i")
      },
      {
        label: "archive import",
        pattern: /archive import/i
      },
      {
        label: "drag-drop",
        pattern: /drag-drop/i
      },
      {
        label: "all-layer import",
        pattern: /\ball-layer import\b/i
      },
      {
        label: "recursive group import",
        pattern: /\brecursive group import\b/i
      }
    ];
    const isNegatedAt = (index) => {
      const prefix = text.slice(Math.max(0, index - 40), index).toLowerCase();
      const directNegationPattern = /(?:^|\W)(?:not|no|never|without)\s+(?:a\s+|an\s+)?$/;
      const joinedByteNegationPattern = /\b(?:not|no|never|without)\s+(?:raw|visual)\s+(?:or|and)\s+$/;
      return directNegationPattern.test(prefix) || joinedByteNegationPattern.test(prefix) || /non-$/.test(prefix);
    };
    const positivePhraseClaim = positivePhraseClaimPatterns.find(({ pattern }) => {
      pattern.lastIndex = 0;

      for (const match of text.matchAll(pattern)) {
        if (!isNegatedAt(match.index ?? 0)) {
          return true;
        }
      }

      return false;
    });
    const unsupportedScopeClaim = unsupportedScopeClaimPatterns.find(({ pattern }) => pattern.test(text));

    return {
      text,
      forbiddenClaim: positivePhraseClaim?.label ?? unsupportedScopeClaim?.label ?? null
    };
  }, {
    panel: editorTestIds.explicitPsdImportPanel
  });

  if (evidence.forbiddenClaim) {
    throw new Error(
      `${label} explicit PSD import UI made an unsupported claim (${evidence.forbiddenClaim}): ${evidence.text}`
    );
  }
};

const assertFixtureDocsRegistration = async () => {
  const fixtureManifest = await readFile(fixtureManifestUrl, "utf8");
  const traceabilityMatrix = await readFile(traceabilityMatrixUrl, "utf8");
  const requiredManifestTokens = [
    "wave49-psd-import-plan-codex-focused-e2e-regression",
    "TC-WAVE49-PSD-IMPORT-PLAN-CODEX-E2E-001",
    "apps/editor/e2e/psd-import-plan-codex-focused-smoke.mjs",
    "scripts/run-focused-e2e.mjs --id psdImportPlanCodexFocused",
    frontHairLayer.sourceLayerId,
    hiddenHeadwearLayer.sourceLayerId,
    "executePsdImportPlanIntake",
    "ai.approvalRejected"
  ];
  const requiredTraceabilityTokens = [
    "TC-WAVE49-PSD-IMPORT-PLAN-CODEX-E2E-001",
    "wave49-psd-import-plan-codex-focused-e2e-regression",
    "psdImportPlanCodexFocused",
    "front hair",
    "psdImportPlanCommand",
    "hiddenLayerUnsupported",
    "ai.approvalRejected"
  ];
  const missing = [
    ...requiredManifestTokens
      .filter((token) => !fixtureManifest.includes(token))
      .map((token) => `fixture-manifest:${token}`),
    ...requiredTraceabilityTokens
      .filter((token) => !traceabilityMatrix.includes(token))
      .map((token) => `traceability:${token}`)
  ];

  if (missing.length > 0) {
    throw new Error(`Wave49 PSD import-plan Codex fixture/traceability registration missing: ${missing.join(", ")}.`);
  }
};

const main = async () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  const browser = locateBrowserExecutable();
  const server = await startOrReuseEditorServer({ repoRoot });
  let launchedBrowser;

  try {
    await assertFixtureDocsRegistration();
    console.log(
      `psd-import-plan-codex-focused-e2e: using ${browser.executable} (${browser.source}); server ${
        server.baseUrl
      } ${server.reused ? "reused" : "started"}`
    );

    launchedBrowser = await launchHeadlessBrowser({ executable: browser.executable });

    for (const viewport of psdImportPlanCodexFocusedSmokeViewports) {
      const page = await createPageSession({
        browserPort: launchedBrowser.port,
        viewport,
        url: server.baseUrl
      });

      try {
        await waitForTestId(page, editorTestIds.shell);
        await page.evaluate((storageKey, codexStorageKeyValue) => {
          localStorage.removeItem(storageKey);
          localStorage.removeItem(codexStorageKeyValue);
        }, editorProjectStorageKey, codexWorkflowStorageKey);
        await page.reload();
        await waitForTestId(page, editorTestIds.shell);

        const result = await runPsdImportPlanCodexFocusedSmoke({ page, viewport });
        console.log(
          `psd-import-plan-codex-focused-e2e: ${viewport.name} passed byteLength=${result.byteLength} root=${result.rootScopeRef} candidates=${result.candidateCount} approved=front hair materializedBytes=${result.materializedByteLength}`
        );
        console.log(
          `psd-import-plan-codex-focused-e2e: ${viewport.name} codexOperation=${result.codexOperationId} staleContext=${result.codexStaleContextStatus} screenshot ${result.screenshot.format} base64Length=${result.screenshot.base64Length}`
        );
      } finally {
        await page.close();
      }
    }
  } finally {
    if (launchedBrowser !== undefined) {
      await launchedBrowser.close();
    }

    await server.close();
  }
};

const isDirectRun = () => {
  if (process.argv[1] === undefined) {
    return false;
  }

  return pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
};

if (isDirectRun()) {
  try {
    await main();
    console.log("psd-import-plan-codex-focused-e2e: smoke passed");
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
