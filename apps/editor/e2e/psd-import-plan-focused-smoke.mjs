import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
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
const batchId = `batch_${sourceAssetId}_3`;
const batchTotalMaterializedByteLength = 810_360;
const expectedRootCandidateCount = 126;
const expectedHiddenCandidateCount = 5;
const targetLayers = [
  {
    displayName: "headwear",
    sourceLayerId: "psd:root/layer[0]",
    sourceLayerName: "headwear",
    sourceLayerPath: ["headwear"],
    materializationId: "mat_psd_root_layer_0",
    byteLength: 460_800,
    digest: "671e6a363745b1ce2e8d29c1a63438170fe9511c8884ea42298cf9b8886e5c1a",
    previewPartId: "part_headwear_psd_root_layer_0",
    previewDrawableId: "draw_headwear_psd_root_layer_0",
    previewTextureId: "tex_headwear_psd_root_layer_0",
    previewMeshId: "mesh_headwear_psd_root_layer_0",
    partId: "part_headwear",
    drawableId: "draw_headwear",
    meshId: "mesh_headwear",
    textureId: "tex_headwear",
    binaryAssetId: "bin_headwear_raw_rgba",
    texturePackagePath: "assets/textures/psd/psd_root_layer_0_671e6a363745.raw-rgba"
  },
  {
    displayName: "eyewear",
    sourceLayerId: "psd:root/layer[3]",
    sourceLayerName: "eyewear",
    sourceLayerPath: ["eyewear"],
    materializationId: "mat_psd_root_layer_3",
    byteLength: 116_600,
    digest: "a5558168cbf75f7817a139131c764e317a77056138d6be0e591077b3e373e708",
    previewPartId: "part_eyewear_psd_root_layer_3",
    previewDrawableId: "draw_eyewear_psd_root_layer_3",
    previewTextureId: "tex_eyewear_psd_root_layer_3",
    previewMeshId: "mesh_eyewear_psd_root_layer_3",
    partId: "part_eyewear",
    drawableId: "draw_eyewear",
    meshId: "mesh_eyewear",
    textureId: "tex_eyewear",
    binaryAssetId: "bin_eyewear_raw_rgba",
    texturePackagePath: "assets/textures/psd/psd_root_layer_3_a5558168cbf7.raw-rgba"
  },
  {
    displayName: "tie / tie",
    sourceLayerId: "psd:root/group[6]/layer[0]",
    sourceLayerName: "tie",
    sourceLayerPath: ["tie", "tie"],
    materializationId: "mat_psd_root_group_6_layer_0",
    byteLength: 232_960,
    digest: "46ba1a95659ac420d37ca89b0ab919ca6ad2022280bb268313937fcd2cd69673",
    previewPartId: "part_tie_tie_psd_root_group_6_layer_0",
    previewDrawableId: "draw_tie_tie_psd_root_group_6_layer_0",
    previewTextureId: "tex_tie_tie_psd_root_group_6_layer_0",
    previewMeshId: "mesh_tie_tie_psd_root_group_6_layer_0",
    partId: "part_tie_tie",
    drawableId: "draw_tie_tie",
    meshId: "mesh_tie_tie",
    textureId: "tex_tie_tie",
    binaryAssetId: "bin_tie_tie_raw_rgba",
    texturePackagePath: "assets/textures/psd/psd_root_group_6_layer_0_46ba1a95659a.raw-rgba"
  }
];
const targetLayerRefs = targetLayers.map((layer) => layer.sourceLayerId);
const psdImportPlanFocusedSmokeViewports = [
  {
    name: "desktop",
    width: 1280,
    height: 900,
    isMobile: false
  }
];

export const runPsdImportPlanFocusedSmoke = async ({ page, viewport }) => {
  const sample = await readSampleEvidence();
  const temporaryDirectory = await mkdtemp(path.join(tmpdir(), "psd-import-plan-focused-"));

  try {
    await openExplicitPsdImportTask(page);
    await waitForTestId(page, editorTestIds.explicitPsdImportForm);
    await waitForTestId(page, editorTestIds.explicitPsdImportFileInput);
    await waitForTestId(page, editorTestIds.explicitPsdImportSubmit);
    await waitForTestId(page, editorTestIds.explicitPsdImportPlanForm);
    await waitForTestId(page, editorTestIds.explicitPsdImportPlanApprovedBatchForm);
    await assertInitialExplicitPsdImportState(page, `${viewport.name} initial`);
    await assertExplicitPsdImportReachable(page, viewport);

    await setSelectedLayerNodeRef(page, targetLayers[0].sourceLayerId);
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
      approvedLayerRefs: targetLayerRefs,
      destinationParentPartId
    });
    await clickTestId(page, editorTestIds.explicitPsdImportPlanSubmit);
    await waitForText(
      page,
      editorTestIds.explicitPsdImportPlanPreview,
      "Import-plan preview ready",
      90_000
    );
    await assertImportPlanPreviewState(page, sample, `${viewport.name} import-plan preview`);
    await assertNoUnsupportedExplicitPsdImportClaims(page, `${viewport.name} import-plan preview`);

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
    await waitForText(
      page,
      editorTestIds.operationLogSummary,
      "importPsdSourceAsset, importPsdLayerMaterializationBatch"
    );
    await assertImportPlanBatchIntakeCommittedState(page, `${viewport.name} approved batch intake`);
    await assertNoUnsupportedExplicitPsdImportClaims(page, `${viewport.name} approved batch intake`);

    await clickTestId(page, editorTestIds.projectPersistenceSave);
    await waitForText(page, editorTestIds.projectPersistenceStatus, "Saved");
    await assertSavedProjectIncludesImportPlanBatchIntake(page, sample, `${viewport.name} after save`);

    await page.reload();
    await waitForTestId(page, editorTestIds.shell);
    await clickTestId(page, editorTestIds.projectPersistenceLoad);
    await waitForText(page, editorTestIds.projectPersistenceStatus, "Loaded");
    await waitForText(page, editorTestIds.projectPersistenceSummary, "Persistent bytes: 3 restored / 3 checked");
    await openExplicitPsdImportTask(page);
    await assertExplicitPsdImportClearedAfterLoad(page, sample, `${viewport.name} after load`);
    await assertBatchProjectStateAfterLoad(page, `${viewport.name} after load`);
    await assertSavedProjectIncludesImportPlanBatchIntake(page, sample, `${viewport.name} after load`);

    await installPortableBundleExportCapture(page);
    const exportedBundle = await exportPortableBundle(page, targetLayers.length);
    assertExportedImportPlanBundleShape(exportedBundle, sample);

    await resetProject(page);
    await importPortableBundleFile({
      page,
      temporaryDirectory,
      filename: `${viewport.name}-wave48-import-plan.portable-package-bundle-v0.json`,
      bundleJson: exportedBundle.bundleJson
    });
    await waitForText(page, editorTestIds.projectPersistenceStatus, "Portable JSON imported");
    await waitForText(page, editorTestIds.projectPersistenceSummary, "Portable JSON bundle v0");
    await waitForText(page, editorTestIds.projectPersistenceSummary, "3/3 binary assets registered in current session");
    await waitForText(page, editorTestIds.projectPersistenceSummary, "persistent bytes 3/3 stored");
    await assertExplicitPsdImportClearedAfterLoad(page, sample, `${viewport.name} after portable import`);
    await assertBatchProjectStateAfterLoad(page, `${viewport.name} after portable import`, {
      expectOperationLog: false
    });

    const screenshot = await page.captureScreenshot(`${viewport.name} wave48 PSD import-plan focused smoke`);

    return {
      viewport: viewport.name,
      sourcePath: "test_data/sample_model.psd",
      byteLength: sample.byteLength,
      sourceDigest: sample.sourceDigest,
      rootScopeRef: importPlanScopeRef,
      candidateCount: expectedRootCandidateCount,
      approvedLayerRefs: targetLayerRefs,
      materializedByteLength: batchTotalMaterializedByteLength,
      exportedBundleSize: exportedBundle.size,
      screenshot
    };
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
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
  await waitForText(page, editorTestIds.explicitPsdImportSource, "User-selected PSD file only");
  await waitForText(page, editorTestIds.explicitPsdImportDocument, "No parsed PSD document metadata");
  await waitForText(page, editorTestIds.explicitPsdImportPlanPreview, "No import-plan preview generated");
  await waitForText(page, editorTestIds.explicitPsdImportPlanPreview, "No candidate plan preview");
  await waitForText(page, editorTestIds.explicitPsdImportPlanCandidates, "No import-plan leaf candidates");
  await waitForText(page, editorTestIds.explicitPsdImportPlanDiagnostics, "No import-plan preview diagnostics");
  await waitForText(
    page,
    editorTestIds.explicitPsdImportBatchIntakeResult,
    "No selected leaf layer batch materialized yet"
  );

  const state = await readExplicitPsdImportState(page);
  if (
    state.selectedLayerControlValue !== targetLayers[0].sourceLayerId ||
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
  const expectNumberFactAtLeast = (section, key, minimum) => {
    const value = Number(section[key]);
    if (!Number.isInteger(value) || value < minimum) {
      failures.push(`${key}: expected integer >= ${minimum}, received ${JSON.stringify(section[key])}`);
    }
  };

  expectText("status", state.statusText, "PSD parsed in browser session");
  expectText("panel", state.panelText, sample.fileName);
  expectFact(state.sourceFacts, "Filename", sample.fileName);
  expectFact(state.sourceFacts, "Byte length", sample.byteLengthLabel);
  expectFact(state.sourceFacts, "Intake", "explicitFile");
  expectFact(state.sourceFacts, "Raw PSD bytes", "not persisted by parser bridge");
  expectFact(state.documentFacts, "Profile", "layered-character-psd-profile-v1");
  expectFact(state.documentFacts, "Parser", "webtoonPsd / @webtoon/psd / 0.4.0");
  expectFact(state.documentFacts, "Runtime", "browser");
  expectNumberFactAtLeast(state.documentFacts, "Groups", 1);
  expectNumberFactAtLeast(state.documentFacts, "Layers", targetLayers.length);
  expectNumberFactAtLeast(state.documentFacts, "Visible layers", targetLayers.length);
  expectNumberFactAtLeast(state.documentFacts, "Raster candidates", targetLayers.length);
  expectFact(state.persistenceFacts, "Parser objects", "notPersisted");
  expectFact(
    state.persistenceFacts,
    "PSD bytes",
    "sessionReadOnlyNoRawBytesPersistedByParser"
  );
  expectFact(state.persistenceFacts, "Materialized bytes", "summaryOnlyNoRawBytes");
  expectFact(
    state.persistenceFacts,
    "Save/load",
    "sessionEvidenceClearedOnProjectLoadReparseRequiredV1"
  );
  expectFact(state.persistenceFacts, "Compositing claim", "none");
  expectFact(state.persistenceFacts, "Pixel oracle claim", "none");
  expectText("featureSupport", state.featureSupportText, "psd.fullCompositing");
  expectText("featureSupport", state.featureSupportText, "psd.rendererPixelOracle");
  expectText("diagnostics", state.diagnosticsText, "browserPsdParser.parse.completed");
  expectText("diagnostics", state.diagnosticsText, "browserPsdParser.materialization.completed");
  for (const layer of targetLayers) {
    expectText("layerTree", state.layerTreeText, layer.sourceLayerId);
    expectText("layerTree", state.layerTreeText, layer.displayName);
  }

  if (failures.length > 0) {
    throw new Error(`${label} parsed explicit PSD import assertions failed: ${failures.join("; ")}.`);
  }
};

const assertImportPlanPreviewState = async (page, sample, label) => {
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
  expectFactContains(state.importPlanPreviewFacts, "Plan id", "plan_");
  expectFactContains(state.importPlanPreviewFacts, "Candidate plan digest", "sha256:");
  expectFactContains(state.importPlanPreviewFacts, "Source", `${sample.fileName} / ${sample.byteLengthLabel}`);
  expectFactContains(state.importPlanPreviewFacts, "Source digest", `sha256:${sample.sourceDigest}`);
  expectFactContains(state.importPlanPreviewFacts, "Source provenance", "private/local");
  expectFactContains(state.importPlanPreviewFacts, "Source provenance", "sessionReadOnlyNoRawBytesPersistedByImportPlan");
  expectFactContains(state.importPlanPreviewFacts, "Source provenance", "notPersisted");
  expectFactContains(state.importPlanPreviewFacts, "Parser", "webtoonPsd / @webtoon/psd / 0.4.0 / browser");
  expectFactContains(state.importPlanPreviewFacts, "Scope", `${importPlanScopeRef} / ${importPlanScopeRef}`);
  expectFactContains(state.importPlanPreviewFacts, "Destination parent part", destinationParentPartId);
  expectFactContains(
    state.importPlanPreviewFacts,
    "Candidates / eligible / approved / not-approved",
    `${expectedRootCandidateCount} / 121 / ${targetLayers.length} / ${expectedRootCandidateCount - targetLayers.length}`
  );
  expectFactContains(
    state.importPlanPreviewFacts,
    "Hidden / unsupported / collisions / byte blocked",
    `${expectedHiddenCandidateCount} / ${expectedHiddenCandidateCount} / 0 / 0`
  );
  expectFactContains(
    state.importPlanPreviewFacts,
    "Byte estimate total / approved",
    "49172000 bytes / 810360 bytes"
  );
  expectText("diagnostics", state.importPlanDiagnosticsText, "browserPsdImportPlan.candidatePlan.ready");
  expectText("candidates", state.importPlanCandidatesText, "statuses=hidden,unsupported,notApproved");
  expectText("candidates", state.importPlanCandidatesText, "approvalBlocked=hiddenLayerUnsupported");
  for (const layer of targetLayers) {
    expectText("candidates", state.importPlanCandidatesText, layer.sourceLayerId);
    expectText("candidates", state.importPlanCandidatesText, layer.displayName);
    expectText("candidates", state.importPlanCandidatesText, "approval=requested");
    expectText("candidates", state.importPlanCandidatesText, `part=${layer.previewPartId}`);
    expectText("candidates", state.importPlanCandidatesText, `drawable=${layer.previewDrawableId}`);
    expectText("candidates", state.importPlanCandidatesText, `texture=${layer.previewTextureId}`);
    expectText("candidates", state.importPlanCandidatesText, `mesh=${layer.previewMeshId}`);
  }

  if (JSON.stringify(selectedApprovedRefs) !== JSON.stringify(targetLayerRefs)) {
    failures.push(`approved refs mismatch: ${JSON.stringify(selectedApprovedRefs)}`);
  }

  if (failures.length > 0) {
    throw new Error(`${label} import-plan preview assertions failed: ${failures.join("; ")}.`);
  }
};

const assertImportPlanBatchIntakeCommittedState = async (page, label) => {
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
  expectFact(state.batchIntakeResultFacts, "Batch id", batchId);
  expectFact(state.batchIntakeResultFacts, "Requested / success / failure", "3 / 3 / 0");
  expectFact(state.batchIntakeResultFacts, "Materialization requested / success / failure", "3 / 3 / 0");
  expectFact(state.batchIntakeResultFacts, "Destination parent part", destinationParentPartId);
  expectFact(state.batchIntakeResultFacts, "Destination kind", "generatedPartScaffold");
  expectFact(state.batchIntakeResultFacts, "Total materialized byte length", "810360 bytes");
  expectFact(
    state.batchIntakeResultFacts,
    "Provenance",
    "private/local / notPublicDistributable / publicDemoAsset=false"
  );
  expectFactContains(state.batchIntakeResultFacts, "Import plan id", "plan_");
  expectFactContains(state.batchIntakeResultFacts, "Import plan digest", "sha256:");
  expectFactContains(state.batchIntakeResultFacts, "Import plan approval", "approval_");
  expectFact(state.batchIntakeResultFacts, "Approved leaf candidates", "3");
  expectFact(state.batchIntakeResultFacts, "Not-approved / blocked candidates", "123 / 5");
  expectText("persistence", state.batchIntakeResultFacts.Persistence, "binaryAssetRefOnlyNoInlineBytes");
  for (const layer of targetLayers) {
    expectText("persistence", state.batchIntakeResultFacts.Persistence, `${layer.textureId}=stored:`);
    expectText("entry", state.batchIntakeEntriesText, "success");
    expectText("entry", state.batchIntakeEntriesText, layer.sourceLayerId);
    expectText("entry", state.batchIntakeEntriesText, layer.sourceLayerPath.join(" / "));
    expectText("entry", state.batchIntakeEntriesText, `part=${layer.partId}`);
    expectText("entry", state.batchIntakeEntriesText, `drawable=${layer.drawableId}`);
    expectText("entry", state.batchIntakeEntriesText, `texture=${layer.textureId}`);
    expectText("entry", state.batchIntakeEntriesText, `mesh=${layer.meshId}`);
    expectText("entry", state.batchIntakeEntriesText, `bytes=${layer.byteLength}`);
    expectText("entry", state.batchIntakeEntriesText, "publicDemoAsset=false");
  }
  expectText("diagnostics", state.batchIntakeDiagnosticsText, "editor.explicitPsdLayerBatchIntake.committed");

  if (failures.length > 0) {
    throw new Error(`${label} approved import-plan batch intake assertions failed: ${failures.join("; ")}.`);
  }
};

const assertSavedProjectIncludesImportPlanBatchIntake = async (page, sample, label) => {
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
    const rootPart = graph?.parts?.find((candidate) => candidate.partId === expected.destinationParentPartId);
    const batchOperation = operationLogEntries.find(
      (entry) => entry.operationType === "importPsdLayerMaterializationBatch"
    );
    const batchPayload = batchOperation?.payload?.payload ?? batchOperation?.payload;
    const collectLayerState = (layer) => {
      const texture = textureAtlas?.textures?.find((candidate) => candidate.textureId === layer.textureId);
      const drawable = drawables?.drawables?.find((candidate) => candidate.drawableId === layer.drawableId);
      const part = graph?.parts?.find((candidate) => candidate.partId === layer.partId);
      const mesh = meshes?.meshes?.find((candidate) => candidate.meshId === layer.meshId);
      const sourceMaterialization = sourceAsset?.psdProfile?.materializationEvidence?.find(
        (candidate) => candidate.materializationId === layer.materializationId
      );

      return {
        texture: texture ?? null,
        drawable: drawable ?? null,
        part: part ?? null,
        mesh: mesh ?? null,
        sourceMaterialization: sourceMaterialization ?? null
      };
    };

    return {
      schemaVersion: project.schemaVersion,
      packageId: project.packageSummary?.packageId ?? null,
      packageRevision: project.packageSummary?.packageRevision ?? null,
      serializedProject,
      packageText,
      operationLogJsonl,
      operationTypes: operationLogEntries.map((entry) => entry.operationType),
      sourceAsset: sourceAsset === undefined
        ? null
        : {
            sourceAssetId: sourceAsset.sourceAssetId,
            filePath: sourceAsset.filePath,
            binaryAssetRef: sourceAsset.binaryAssetRef ?? null,
            materializationCount: sourceAsset.psdProfile?.materializationEvidence?.length ?? 0,
            importPlanCandidateEvidenceCount: sourceAsset.psdProfile?.importPlanCandidateEvidence?.length ?? 0,
            importPlanApprovalEvidenceCount: sourceAsset.psdProfile?.importPlanApprovalEvidence?.length ?? 0
          },
      rootPart: rootPart === undefined
        ? null
        : {
            partId: rootPart.partId,
            childPartIds: rootPart.childPartIds ?? [],
            drawableIds: rootPart.drawableIds ?? []
          },
      layers: expected.targetLayers.map(collectLayerState),
      batchOperation: batchOperation === undefined
        ? null
        : {
            operationType: batchOperation.operationType,
            operationId: batchOperation.operationId,
            targetIds: batchOperation.targetIds ?? [],
            payloadImportPlanBridge: batchPayload?.importPlanBridge ?? null,
            evidence: batchOperation.result?.psdLayerMaterializationBatchEvidence?.[0] ?? null,
            materializationEvidence: [
              ...(batchOperation.result?.psdLayerMaterializationEvidence ?? []),
              ...((batchPayload?.entries ?? []).map((entry) => entry.materialization))
            ],
            json: JSON.stringify(batchOperation)
          }
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
    destinationParentPartId,
    targetLayers
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

  expect(stored.schemaVersion === "editor-project-persistence-v1", `schemaVersion=${stored.schemaVersion}`);
  expect(stored.packageId === "pkg_editor_browser_sample", `packageId=${stored.packageId}`);
  expect(stored.packageRevision === 2, `packageRevision=${stored.packageRevision}`);
  expect(
    JSON.stringify(stored.operationTypes) ===
      JSON.stringify(["importPsdSourceAsset", "importPsdLayerMaterializationBatch"]),
    `operationTypes=${JSON.stringify(stored.operationTypes)}`
  );
  expect(stored.sourceAsset?.sourceAssetId === sourceAssetId, `sourceAsset=${JSON.stringify(stored.sourceAsset)}`);
  expect(stored.sourceAsset?.filePath === sourcePackagePath, `sourcePath=${JSON.stringify(stored.sourceAsset)}`);
  expect(stored.sourceAsset?.binaryAssetRef === null, "source asset unexpectedly persisted source PSD bytes");
  expect(stored.sourceAsset?.materializationCount === targetLayers.length, "source materialization count mismatch");
  expect(stored.rootPart?.childPartIds?.length >= targetLayers.length, "root part missing generated children");

  for (const [index, layer] of targetLayers.entries()) {
    const state = stored.layers[index] ?? {};
    const expectedTextureBinaryRef = {
      referenceKind: "package-binary-asset-ref-v1",
      binaryAssetId: layer.binaryAssetId,
      packageRelativePath: layer.texturePackagePath,
      digest: {
        algorithm: "sha256",
        hex: layer.digest
      },
      byteLength: layer.byteLength,
      mediaType: materializedMediaType,
      storageStatus: "stored-package-local-v1",
      rightsAssetId: sourceAssetId
    };

    expect(stored.rootPart?.childPartIds?.includes(layer.partId), `root child missing ${layer.partId}`);
    expect(state.part?.partId === layer.partId, `missing generated part ${layer.partId}`);
    expect(state.part?.displayName === layer.displayName, `part display mismatch ${layer.partId}`);
    expect(state.part?.parentPartId === destinationParentPartId, `part parent mismatch ${layer.partId}`);
    expect(state.part?.drawableIds?.includes(layer.drawableId), `part drawable missing ${layer.drawableId}`);
    expect(state.drawable?.drawableId === layer.drawableId, `missing drawable ${layer.drawableId}`);
    expect(state.drawable?.displayName === layer.displayName, `drawable display mismatch ${layer.drawableId}`);
    expect(state.drawable?.partId === layer.partId, `drawable part mismatch ${layer.drawableId}`);
    expect(state.drawable?.textureId === layer.textureId, `drawable texture mismatch ${layer.drawableId}`);
    expect(state.drawable?.meshId === layer.meshId, `drawable mesh mismatch ${layer.drawableId}`);
    expect(state.mesh?.meshId === layer.meshId, `missing mesh ${layer.meshId}`);
    expect(state.texture?.textureId === layer.textureId, `missing texture ${layer.textureId}`);
    expect(state.texture?.sourceAssetId === sourceAssetId, `texture source mismatch ${layer.textureId}`);
    expect(state.texture?.sourceLayerId === layer.sourceLayerId, `texture layer mismatch ${layer.textureId}`);
    expect(
      isPartialMatch(state.texture?.binaryAssetRef, expectedTextureBinaryRef),
      `texture binary ref mismatch ${layer.textureId}: ${JSON.stringify(state.texture?.binaryAssetRef)}`
    );
    expect(
      state.sourceMaterialization?.sourceLayerRef?.sourceLayerId === layer.sourceLayerId,
      `source manifest materialization missing ${layer.sourceLayerId}`
    );
    expect(state.sourceMaterialization?.byteLength === layer.byteLength, `source manifest byte mismatch ${layer.sourceLayerId}`);
    expect(state.sourceMaterialization?.digest?.hex === layer.digest, `source manifest digest mismatch ${layer.sourceLayerId}`);
  }

  const evidence = stored.batchOperation?.evidence;
  const bridge = evidence?.importPlanBridge;
  expect(stored.batchOperation?.operationType === "importPsdLayerMaterializationBatch", "missing batch operation");
  expect(evidence?.schemaVersion === "psd-layer-materialization-batch-operation-evidence-v1", "missing batch evidence schema");
  expect(evidence?.batchId === batchId, `batchId=${evidence?.batchId}`);
  expect(evidence?.sourceAssetId === sourceAssetId, `batch source=${evidence?.sourceAssetId}`);
  expect(evidence?.aggregateStatus === "success", `aggregateStatus=${evidence?.aggregateStatus}`);
  expect(evidence?.selectedLayerCount === targetLayers.length, `selectedLayerCount=${evidence?.selectedLayerCount}`);
  expect(evidence?.successCount === targetLayers.length, `successCount=${evidence?.successCount}`);
  expect(evidence?.failureCount === 0, `failureCount=${evidence?.failureCount}`);
  expect(evidence?.totalMaterializedByteLength === batchTotalMaterializedByteLength, "total byte length mismatch");
  expect(evidence?.destination?.destinationKind === "generatedPartScaffold", "destination kind mismatch");
  expect(evidence?.destination?.parentPartId === destinationParentPartId, "destination parent mismatch");
  expect(evidence?.persistenceBoundary?.rawParserObjectPersistence === "notPersisted", "raw parser persistence mismatch");
  expect(evidence?.persistenceBoundary?.sourcePsdBytePersistence === "metadataOnlyNoRawBytes", "source PSD byte persistence mismatch");
  expect(
    evidence?.persistenceBoundary?.materializedLayerBytePersistence === "binaryAssetRefOnlyNoInlineBytes",
    "materialized byte persistence mismatch"
  );
  expect(bridge?.schemaVersion === "psd-import-plan-approval-bridge-evidence-v1", "missing import-plan bridge schema");
  expect(bridge?.candidatePlan?.planId?.startsWith("plan_") === true, `bridge plan id=${bridge?.candidatePlan?.planId}`);
  expect(bridge?.candidatePlan?.candidatePlanDigest?.algorithm === "sha256", "bridge candidate digest algorithm mismatch");
  expect(/^[a-f0-9]{64}$/.test(bridge?.candidatePlan?.candidatePlanDigest?.hex ?? ""), "bridge candidate digest hex mismatch");
  expect(bridge?.candidatePlan?.sourcePsd?.sourceAssetId === sourceAssetId, "bridge source asset mismatch");
  expect(bridge?.candidatePlan?.sourcePsd?.sourceFilePath === sourcePackagePath, "bridge source path mismatch");
  expect(bridge?.candidatePlan?.sourcePsd?.digest?.hex === sample.sourceDigest, "bridge source digest mismatch");
  expect(bridge?.candidatePlan?.sourcePsd?.byteLength === sample.byteLength, "bridge source byteLength mismatch");
  expect(bridge?.candidatePlan?.sourcePsd?.sourceBytePersistence === "metadataOnlyNoRawBytes", "bridge source byte persistence mismatch");
  expect(bridge?.candidatePlan?.sourcePsd?.publicDemoAsset === false, "bridge source publicDemoAsset mismatch");
  expect(bridge?.candidatePlan?.scope?.scopeRef?.id === importPlanScopeRef, "bridge scope id mismatch");
  expect(bridge?.candidatePlan?.scope?.scopeRef?.path === importPlanScopeRef, "bridge scope path mismatch");
  expect(bridge?.candidatePlan?.scope?.discoveryMode === "recursiveLeafCandidatePreview", "bridge discovery mode mismatch");
  expect(bridge?.candidatePlan?.summary?.candidateCount === expectedRootCandidateCount, "bridge candidate count mismatch");
  expect(bridge?.candidatePlan?.summary?.approvedCandidateCount === targetLayers.length, "bridge approved count mismatch");
  expect(bridge?.candidatePlan?.summary?.notApprovedCandidateCount === expectedRootCandidateCount - targetLayers.length, "bridge not-approved count mismatch");
  expect(bridge?.candidatePlan?.summary?.hiddenCandidateCount === expectedHiddenCandidateCount, "bridge hidden count mismatch");
  expect(bridge?.candidatePlan?.boundary?.rawParserObjectPersistence === "notPersisted", "bridge raw parser boundary mismatch");
  expect(bridge?.candidatePlan?.boundary?.sourcePsdBytePersistence === "metadataOnlyNoRawBytes", "bridge source byte boundary mismatch");
  expect(bridge?.candidatePlan?.boundary?.candidateDiscoveryBytePersistence === "metadataOnlyNoRawBytes", "bridge candidate byte boundary mismatch");
  expect(bridge?.candidatePlan?.boundary?.publicDemoAsset === false, "bridge publicDemoAsset boundary mismatch");
  expect(bridge?.candidatePlan?.boundary?.allLayerOneClickImport === "notProvided", "bridge all-layer boundary mismatch");
  expect(bridge?.candidatePlan?.boundary?.recursiveGroupAutoImport === "notProvided", "bridge recursive group boundary mismatch");
  expect(bridge?.approval?.approvalStatus === "approved", "bridge approval status mismatch");
  expect(bridge?.approval?.destination?.parentPartId === destinationParentPartId, "bridge approval destination mismatch");
  expect(bridge?.approval?.approvedLeafRefs?.length === targetLayers.length, "bridge approved leaf count mismatch");
  expect(
    bridge?.approval?.notApprovedCandidates?.length ===
      expectedRootCandidateCount - targetLayers.length - expectedHiddenCandidateCount,
    "bridge not-approved candidates mismatch"
  );
  expect(bridge?.approval?.blockedCandidates?.length === expectedHiddenCandidateCount, "bridge blocked candidates mismatch");
  expect(bridge?.approval?.collisionPreflight?.notApprovedCandidateCount === expectedRootCandidateCount - targetLayers.length, "bridge preflight not-approved mismatch");
  expect(bridge?.approval?.collisionPreflight?.blockedCandidateCount === expectedHiddenCandidateCount, "bridge preflight blocked mismatch");
  expect(bridge?.approval?.boundary?.onlyApprovedLeafRefsPassedToBatch === true, "bridge approved-only boundary mismatch");
  expect(bridge?.approval?.boundary?.rawParserObjectPersistence === "notPersisted", "bridge approval parser boundary mismatch");
  expect(bridge?.approval?.boundary?.sourcePsdBytePersistence === "metadataOnlyNoRawBytes", "bridge approval source byte boundary mismatch");
  expect(bridge?.approval?.boundary?.materializedLayerBytePersistence === "binaryAssetRefOnlyNoInlineBytes", "bridge approval materialized byte boundary mismatch");
  expect(bridge?.approval?.boundary?.publicDemoAsset === false, "bridge approval publicDemoAsset mismatch");
  expect(bridge?.approval?.boundary?.allLayerOneClickImport === "notProvided", "bridge approval all-layer mismatch");
  expect(bridge?.approval?.boundary?.recursiveGroupAutoImport === "notProvided", "bridge approval recursive group mismatch");
  expect(stored.batchOperation?.payloadImportPlanBridge?.approval?.approvedLeafRefs?.length === targetLayers.length, "request payload bridge missing approved leaves");
  expect(stored.batchOperation?.json.includes("\"publicDemoAsset\":false"), "batch operation missing publicDemoAsset=false");
  expect(stored.batchOperation?.json.includes("rawParserObjectPersistence"), "batch operation missing parser boundary");
  expect(stored.batchOperation?.json.includes("sourcePsdBytePersistence"), "batch operation missing source byte boundary");
  expect(stored.batchOperation?.json.includes("materializedLayerBytePersistence"), "batch operation missing materialized byte boundary");

  for (const [index, layer] of targetLayers.entries()) {
    const evidenceEntry = evidence?.entries?.find(
      (entry) => entry.sourceLayerRef?.sourceLayerId === layer.sourceLayerId
    );
    const perLayerEvidence =
      stored.batchOperation?.materializationEvidence?.find(
        (entry) => entry.materializationId === layer.materializationId && entry.digest?.hex === layer.digest
      ) ??
      stored.batchOperation?.materializationEvidence?.find(
        (entry) => entry.materializationId === layer.materializationId
      );
    const approvedLeaf = bridge?.approval?.approvedLeafRefs?.[index];

    expect(stored.batchOperation?.targetIds?.includes(layer.partId), `batch target missing ${layer.partId}`);
    expect(stored.batchOperation?.targetIds?.includes(layer.drawableId), `batch target missing ${layer.drawableId}`);
    expect(stored.batchOperation?.targetIds?.includes(layer.meshId), `batch target missing ${layer.meshId}`);
    expect(stored.batchOperation?.targetIds?.includes(layer.textureId), `batch target missing ${layer.textureId}`);
    expect(evidenceEntry?.status === "success", `batch entry status mismatch ${layer.sourceLayerId}`);
    expect(evidenceEntry?.materializationId === layer.materializationId, `batch materialization id mismatch ${layer.sourceLayerId}`);
    expect(evidenceEntry?.materializedByteLength === layer.byteLength, `batch byte length mismatch ${layer.sourceLayerId}`);
    expect(evidenceEntry?.generated?.partId === layer.partId, `batch generated part mismatch ${layer.sourceLayerId}`);
    expect(evidenceEntry?.generated?.drawableId === layer.drawableId, `batch generated drawable mismatch ${layer.sourceLayerId}`);
    expect(evidenceEntry?.generated?.textureId === layer.textureId, `batch generated texture mismatch ${layer.sourceLayerId}`);
    expect(evidenceEntry?.generated?.meshId === layer.meshId, `batch generated mesh mismatch ${layer.sourceLayerId}`);
    expect(perLayerEvidence?.digest?.hex === layer.digest, `per-layer digest mismatch ${layer.sourceLayerId}`);
    expect(perLayerEvidence?.byteLength === layer.byteLength, `per-layer byte length mismatch ${layer.sourceLayerId}`);
    expect(perLayerEvidence?.provenance?.privacyLabel === "packageLocalAsset", `provenance privacy mismatch ${layer.sourceLayerId}`);
    expect(perLayerEvidence?.provenance?.publicDistribution === "notPublicDistributable", `provenance distribution mismatch ${layer.sourceLayerId}`);
    expect(perLayerEvidence?.provenance?.publicDemoAsset === false, `provenance publicDemoAsset mismatch ${layer.sourceLayerId}`);
    expect(perLayerEvidence?.binaryAssetRef?.binaryAssetId === layer.binaryAssetId, `per-layer binary ref mismatch ${layer.sourceLayerId}`);
    expect(perLayerEvidence?.textureId === layer.textureId, `per-layer texture id mismatch ${layer.sourceLayerId}`);
    expect(approvedLeaf?.approvalOrder === index, `approved leaf order mismatch ${layer.sourceLayerId}`);
    expect(approvedLeaf?.sourceLayerRef?.sourceLayerId === layer.sourceLayerId, `approved leaf source mismatch ${layer.sourceLayerId}`);
    expect(approvedLeaf?.sourceLayerPath?.join(" / ") === layer.sourceLayerPath.join(" / "), `approved leaf path mismatch ${layer.sourceLayerId}`);
    expect(approvedLeaf?.candidateStatuses?.includes("candidate"), `approved leaf missing candidate status ${layer.sourceLayerId}`);
    expect(!approvedLeaf?.candidateStatuses?.includes("notApproved"), `approved leaf retained notApproved status ${layer.sourceLayerId}`);
    expect(approvedLeaf?.resolvedGeneratedIds?.partId === layer.partId, `approved resolved part mismatch ${layer.sourceLayerId}`);
    expect(approvedLeaf?.resolvedGeneratedIds?.drawableId === layer.drawableId, `approved resolved drawable mismatch ${layer.sourceLayerId}`);
    expect(approvedLeaf?.resolvedGeneratedIds?.textureId === layer.textureId, `approved resolved texture mismatch ${layer.sourceLayerId}`);
    expect(approvedLeaf?.resolvedGeneratedIds?.meshId === layer.meshId, `approved resolved mesh mismatch ${layer.sourceLayerId}`);
  }

  const selectedInNotApproved = bridge?.approval?.notApprovedCandidates
    ?.filter((candidate) => targetLayerRefs.includes(candidate.sourceLayerRef?.sourceLayerId))
    .map((candidate) => candidate.sourceLayerRef?.sourceLayerId) ?? [];
  const selectedInBlocked = bridge?.approval?.blockedCandidates
    ?.filter((candidate) => targetLayerRefs.includes(candidate.sourceLayerRef?.sourceLayerId))
    .map((candidate) => candidate.sourceLayerRef?.sourceLayerId) ?? [];
  expect(selectedInNotApproved.length === 0, `approved refs leaked to not-approved candidates: ${selectedInNotApproved.join(", ")}`);
  expect(selectedInBlocked.length === 0, `approved refs leaked to blocked candidates: ${selectedInBlocked.join(", ")}`);

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

  if (forbiddenSerializedClaims.length > 0 || forbiddenPackagePayloadClaims.length > 0) {
    failures.push(
      `forbidden persisted claims: serialized=${forbiddenSerializedClaims.join(", ")} package=${forbiddenPackagePayloadClaims.join(", ")}`
    );
  }

  if (failures.length > 0) {
    throw new Error(
      `${label} saved project did not preserve Wave48 import-plan batch boundary: ${JSON.stringify({
        failures,
        schemaVersion: stored.schemaVersion,
        packageId: stored.packageId,
        packageRevision: stored.packageRevision,
        operationTypes: stored.operationTypes,
        sourceAsset: stored.sourceAsset,
        rootPart: stored.rootPart,
        batchEvidence: stored.batchOperation?.evidence
      })}.`
    );
  }
};

const assertExportedImportPlanBundleShape = (exportedBundle, sample) => {
  const bundle = JSON.parse(exportedBundle.bundleJson);
  const payloads = Array.isArray(bundle.binaryPayloads) ? bundle.binaryPayloads : [];
  const serialized = JSON.stringify(bundle);
  const failures = [];
  const expect = (condition, message) => {
    if (!condition) {
      failures.push(message);
    }
  };

  expect(bundle.schemaVersion === "portable-package-bundle-v0", `schemaVersion=${bundle.schemaVersion}`);
  expect(bundle.bundleKind === "project-defined-json-bundle-v0", `bundleKind=${bundle.bundleKind}`);
  expect(payloads.length === targetLayers.length, `binaryPayloadCount=${payloads.length}`);
  expect(bundle.packageDocument?.manifest?.packageId === bundle.packageId, "bundle package id drift");
  expect(bundle.packageDocument?.manifest?.packageRevision === bundle.packageRevision, "bundle revision drift");
  expect(serialized.includes("metadataOnlyNoRawBytes"), "bundle missing metadata-only source byte boundary");
  expect(serialized.includes("\"publicDemoAsset\":false"), "bundle missing publicDemoAsset=false evidence");
  expect(
    !serialized.includes("psd-import-plan-approval-bridge-evidence-v1"),
    "portable bundle unexpectedly persisted session import-plan bridge evidence as package capability"
  );
  expect(
    !serialized.includes("onlyApprovedLeafRefsPassedToBatch"),
    "portable bundle unexpectedly persisted session approval bridge boundary"
  );

  for (const layer of targetLayers) {
    const payload = payloads.find((candidate) =>
      candidate.binaryAssetRef?.binaryAssetId === layer.binaryAssetId
    );
    expect(payload !== undefined, `missing portable payload ${layer.binaryAssetId}`);
    expect(payload?.payloadEncoding === "base64-v1", `payload encoding mismatch ${layer.binaryAssetId}`);
    expect(payload?.binaryAssetRef?.packageRelativePath === layer.texturePackagePath, `payload path mismatch ${layer.binaryAssetId}`);
    expect(payload?.binaryAssetRef?.digest?.hex === layer.digest, `payload digest mismatch ${layer.binaryAssetId}`);
    expect(payload?.binaryAssetRef?.byteLength === layer.byteLength, `payload byteLength mismatch ${layer.binaryAssetId}`);
    expect(payload?.binaryAssetRef?.mediaType === materializedMediaType, `payload media type mismatch ${layer.binaryAssetId}`);
    expect(typeof payload?.payloadBase64 === "string" && payload.payloadBase64.length > 0, `missing portable bytes ${layer.binaryAssetId}`);
  }

  const sourceAsset = bundle.packageDocument?.assets?.sourceManifest?.sourceAssets?.find(
    (candidate) => candidate.sourceAssetId === sourceAssetId
  );
  expect(sourceAsset?.filePath === sourcePackagePath, "bundle source asset path mismatch");
  expect(sourceAsset?.binaryAssetRef === undefined, "bundle unexpectedly includes source PSD binary asset ref");
  expect(!payloads.some((payload) => payload.binaryAssetRef?.packageRelativePath === sourcePackagePath), "portable bundle included source PSD bytes");

  const forbiddenBundleClaims = [
    sample.base64Prefix,
    "\"publicDemoAsset\":true",
    "\"rawParserObject\"",
    "rawRgbaBytes",
    "visualBytes",
    "sourcePsdBytes",
    "currentPsdFile",
    "raw materialized bytes",
    "allLayerOneClickImport",
    "recursiveGroupAutoImport"
  ].filter((claim) => serialized.includes(claim));

  if (forbiddenBundleClaims.length > 0) {
    failures.push(`forbidden portable bundle claims: ${forbiddenBundleClaims.join(", ")}`);
  }

  if (failures.length > 0) {
    throw new Error(`Portable import-plan bundle shape mismatch: ${failures.join("; ")}.`);
  }
};

const assertExplicitPsdImportClearedAfterLoad = async (page, sample, label) => {
  await assertInitialExplicitPsdImportState(page, label);
  const state = await readExplicitPsdImportState(page);
  const forbiddenLoadedClaims = [
    sample.fileName,
    ...targetLayers.map((layer) => layer.digest),
    "PSD parsed in browser session",
    "browserPsdParser.parse.completed",
    "Import-plan preview ready",
    "Selected PSD leaf layers added to generated parts"
  ].filter((claim) => state.panelText.includes(claim));

  if (forbiddenLoadedClaims.length > 0) {
    throw new Error(
      `${label} explicit PSD import panel retained session-only import-plan evidence: ${forbiddenLoadedClaims.join(", ")}.`
    );
  }
};

const assertBatchProjectStateAfterLoad = async (page, label, options = {}) => {
  if (options.expectOperationLog !== false) {
    await waitForOperationLogEntryCount(page, 2);
    await waitForText(
      page,
      editorTestIds.operationLogSummary,
      "importPsdSourceAsset, importPsdLayerMaterializationBatch"
    );
  }
  await waitForText(page, editorTestIds.sourceIntakeImportedSources, "1 imported source asset");
  await waitForText(page, editorTestIds.sourceIntakeImportedSources, sourceAssetId);

  for (const layer of targetLayers) {
    await waitForText(page, createLayerTreePartGroupTestId(layer.partId), layer.displayName);
    await waitForText(page, createLayerTreePartGroupTestId(layer.partId), layer.partId);
    await waitForText(
      page,
      createLayerTreeDrawableRowTestId(layer.drawableId),
      `${layer.displayName} / ${layer.drawableId}`
    );
    await waitForText(page, createLayerTreeDrawableRowTestId(layer.drawableId), layer.textureId);
    await waitForText(page, createLayerTreeDrawableRowTestId(layer.drawableId), "Texture resolved");
    await waitForText(page, editorTestIds.sourceIntakeImportedSources, `Texture binary ref ${layer.textureId}`);
    await waitForText(page, editorTestIds.sourceIntakeImportedSources, layer.binaryAssetId);
  }

  const importedSourcesText = await readText(page, editorTestIds.sourceIntakeImportedSources);
  const panelText = await readText(page, editorTestIds.explicitPsdImportPanel);
  const projectText = await page.evaluate(() => document.body?.textContent ?? "");
  const forbiddenPositiveClaims = [
    "public demo asset",
    "raw parser object persisted",
    "source PSD bytes persisted"
  ].filter((claim) => projectText.toLowerCase().includes(claim.toLowerCase()));

  if (
    forbiddenPositiveClaims.length > 0 ||
    importedSourcesText.includes("Source binary ref / ") ||
    panelText.includes("Selected PSD leaf layers added to generated parts")
  ) {
    throw new Error(
      `${label} loaded project boundary mismatch: forbiddenPositiveClaims=${forbiddenPositiveClaims.join(
        ", "
      )} importedSources=${importedSourcesText} panel=${panelText}`
    );
  }
};

const assertExplicitPsdImportReachable = async (page, viewport) => {
  const metrics = await page.evaluate((ids) => {
    const panel = document.querySelector(`[data-testid="${ids.panel}"]`);
    const form = document.querySelector(`[data-testid="${ids.form}"]`);
    const fileInput = document.querySelector(`[data-testid="${ids.fileInput}"]`);
    const submit = document.querySelector(`[data-testid="${ids.submit}"]`);
    const planSubmit = document.querySelector(`[data-testid="${ids.planSubmit}"]`);
    const approvedSubmit = document.querySelector(`[data-testid="${ids.approvedSubmit}"]`);

    if (
      !(panel instanceof HTMLElement) ||
      !(form instanceof HTMLFormElement) ||
      !(fileInput instanceof HTMLInputElement) ||
      !(submit instanceof HTMLButtonElement) ||
      !(planSubmit instanceof HTMLButtonElement) ||
      !(approvedSubmit instanceof HTMLButtonElement)
    ) {
      return null;
    }

    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const rectVisible = (rect) =>
      rect.width > 0 &&
      rect.height > 0 &&
      rect.right > 0 &&
      rect.left < viewportWidth &&
      rect.bottom > 0 &&
      rect.top < viewportHeight;

    submit.scrollIntoView({ block: "center", inline: "nearest" });
    const panelRect = panel.getBoundingClientRect();
    const formRect = form.getBoundingClientRect();
    const inputRect = fileInput.getBoundingClientRect();
    const submitRect = submit.getBoundingClientRect();
    const planSubmitRect = planSubmit.getBoundingClientRect();
    const approvedSubmitRect = approvedSubmit.getBoundingClientRect();

    return {
      panelVisible: rectVisible(panelRect),
      formVisible: rectVisible(formRect),
      fileInputVisible: rectVisible(inputRect),
      submitVisible: rectVisible(submitRect),
      panelWidth: panelRect.width,
      formWidth: formRect.width,
      fileInputWidth: inputRect.width,
      submitWidth: submitRect.width,
      planSubmitWidth: planSubmitRect.width,
      approvedSubmitWidth: approvedSubmitRect.width
    };
  }, {
    panel: editorTestIds.explicitPsdImportPanel,
    form: editorTestIds.explicitPsdImportForm,
    fileInput: editorTestIds.explicitPsdImportFileInput,
    submit: editorTestIds.explicitPsdImportSubmit,
    planSubmit: editorTestIds.explicitPsdImportPlanSubmit,
    approvedSubmit: editorTestIds.explicitPsdImportPlanApprovedBatchSubmit
  });

  if (
    metrics === null ||
    !metrics.panelVisible ||
    !metrics.formVisible ||
    !metrics.fileInputVisible ||
    !metrics.submitVisible ||
    metrics.panelWidth < 1 ||
    metrics.formWidth < 1 ||
    metrics.fileInputWidth < 1 ||
    metrics.submitWidth < 1 ||
    metrics.planSubmitWidth < 1 ||
    metrics.approvedSubmitWidth < 1
  ) {
    throw new Error(
      `${viewport.name} explicit PSD import-plan panel was not reachable/usable: ${JSON.stringify(metrics)}.`
    );
  }
};

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
      `${label} explicit PSD import-plan UI made an unsupported claim (${evidence.forbiddenClaim}): ${evidence.text}`
    );
  }
};

const assertFixtureDocsRegistration = async () => {
  const fixtureManifest = await readFile(fixtureManifestUrl, "utf8");
  const traceabilityMatrix = await readFile(traceabilityMatrixUrl, "utf8");
  const requiredManifestTokens = [
    "wave48-psd-import-plan-focused-e2e-persistence-regression",
    "TC-WAVE48-PSD-IMPORT-PLAN-E2E-001",
    "apps/editor/e2e/psd-import-plan-focused-smoke.mjs",
    "scripts/run-focused-e2e.mjs --id psdImportPlanFocused",
    "psd:root",
    "explicit approved leaf refs only",
    "publicDemoAsset=false"
  ];
  const requiredTraceabilityTokens = [
    "TC-WAVE48-PSD-IMPORT-PLAN-E2E-001",
    "wave48-psd-import-plan-focused-e2e-persistence-regression",
    "psdImportPlanFocused",
    "browserPsdImportPlan.candidatePlan.ready",
    "psd-import-plan-approval-bridge-evidence-v1",
    "onlyApprovedLeafRefsPassedToBatch"
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
    throw new Error(`Wave48 PSD import-plan fixture/traceability registration missing: ${missing.join(", ")}.`);
  }
};

const installPortableBundleExportCapture = async (page) => {
  await page.evaluate(() => {
    if (globalThis.__portableBundleE2eCapture?.installed === true) {
      globalThis.__portableBundleE2eCapture.records.length = 0;
      return;
    }

    const records = [];
    const originalCreateObjectURL = URL.createObjectURL.bind(URL);
    const originalRevokeObjectURL = URL.revokeObjectURL.bind(URL);
    const originalAnchorClick = HTMLAnchorElement.prototype.click;
    let nextRecordId = 0;

    globalThis.__portableBundleE2eCapture = {
      installed: true,
      records
    };

    URL.createObjectURL = (value) => {
      if (!(value instanceof Blob)) {
        return originalCreateObjectURL(value);
      }

      const url = `blob:${location.origin}/psd-import-plan-portable-e2e-${nextRecordId}`;
      nextRecordId += 1;

      const record = {
        url,
        type: value.type,
        size: value.size,
        text: null,
        textReady: false,
        error: null,
        download: null,
        revoked: false
      };
      records.push(record);

      void value.text()
        .then((text) => {
          record.text = text;
          record.textReady = true;
        })
        .catch((error) => {
          record.error = error instanceof Error ? error.message : String(error);
        });

      return url;
    };

    URL.revokeObjectURL = (url) => {
      const record = records.find((candidate) => candidate.url === url);
      if (record !== undefined) {
        record.revoked = true;
        return;
      }

      originalRevokeObjectURL(url);
    };

    HTMLAnchorElement.prototype.click = function click() {
      const href = String(this.href);
      if (this.download.length > 0 && href.includes("/psd-import-plan-portable-e2e-")) {
        const record = records.find((candidate) =>
          candidate.url === href || candidate.url === this.getAttribute("href")
        );
        if (record !== undefined) {
          record.download = this.download;
          return;
        }
      }

      return originalAnchorClick.call(this);
    };
  });
};

const exportPortableBundle = async (page, expectedPayloadCount) => {
  await clickTestId(page, editorTestIds.projectPersistencePortableExport);
  await waitForTextWithStatusSnapshot(
    page,
    editorTestIds.projectPersistenceStatus,
    "Portable JSON exported",
    "portable import-plan bundle export"
  );
  await waitForText(
    page,
    editorTestIds.projectPersistenceSummary,
    "Portable JSON bundle v0 prepared"
  );
  await waitForText(
    page,
    editorTestIds.projectPersistenceSummary,
    `${expectedPayloadCount} binary payloads verified from current editor session bytes`
  );
  await page.waitFor(
    "portable import-plan bundle export blob capture",
    () =>
      globalThis.__portableBundleE2eCapture?.records.some((record) =>
        record.textReady === true || record.error !== null
      ) === true,
    { timeoutMs: 8_000 }
  );

  const captured = await page.evaluate(() => {
    const records = globalThis.__portableBundleE2eCapture?.records ?? [];
    const record = records.find((candidate) =>
      candidate.textReady === true || candidate.error !== null
    );

    return record === undefined
      ? null
      : {
          bundleJson: record.text,
          download: record.download,
          error: record.error,
          revoked: record.revoked,
          size: record.size,
          type: record.type
        };
  });

  if (captured === null) {
    throw new Error("Portable import-plan bundle export did not create a captured Blob.");
  }
  if (captured.error !== null) {
    throw new Error(`Portable import-plan bundle export Blob text failed: ${captured.error}.`);
  }
  if (typeof captured.bundleJson !== "string" || captured.bundleJson.length === 0) {
    throw new Error("Portable import-plan bundle export captured an empty bundle JSON string.");
  }
  if (captured.download?.endsWith(".portable-package-bundle-v0.json") !== true) {
    throw new Error(
      `Portable import-plan bundle export suggested an unexpected filename: ${captured.download}.`
    );
  }
  if (captured.type !== "application/json") {
    throw new Error(`Portable import-plan bundle export Blob used unexpected type ${captured.type}.`);
  }
  if (captured.revoked !== true) {
    throw new Error("Portable import-plan bundle export did not revoke the captured object URL.");
  }

  return captured;
};

const waitForTextWithStatusSnapshot = async (page, testId, expectedText, label) => {
  try {
    await waitForText(page, testId, expectedText);
  } catch (error) {
    const status = await readText(page, editorTestIds.projectPersistenceStatus);
    const summary = await readText(page, editorTestIds.projectPersistenceSummary);
    const message = error instanceof Error ? error.message : String(error);

    throw new Error(
      `${message} Current project persistence state during ${label}: status=${JSON.stringify(status)} summary=${JSON.stringify(summary)}.`
    );
  }
};

const resetProject = async (page) => {
  await clickTestId(page, editorTestIds.projectPersistenceReset);
  await waitForText(page, editorTestIds.projectPersistenceStatus, "Cleared");
  await waitForText(page, editorTestIds.sourceIntakeImportedSources, "0 imported source assets");
  await waitForText(page, editorTestIds.operationLogSummary, "Entries0");
};

const importPortableBundleFile = async ({
  page,
  temporaryDirectory,
  filename,
  bundleJson
}) => {
  const filePath = path.join(temporaryDirectory, filename);
  await writeFile(filePath, bundleJson, "utf8");
  await selectFileInput(page, editorTestIds.projectPersistencePortableImportInput, filePath);
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
      featureFacts: readFacts(ids.featureSupport),
      featureSupportText: readText(ids.featureSupport),
      materializationText: readText(ids.materialization),
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
    materialization: editorTestIds.explicitPsdImportMaterialization,
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

const openExplicitPsdImportTask = async (page) => {
  const isOpen = await page.evaluate(
    (panelId) => document.querySelector(`[data-testid="${panelId}"]`) !== null,
    editorTestIds.explicitPsdImportPanel
  );
  if (!isOpen) {
    await waitForTestId(page, editorTestIds.psdImportTaskOpen);
    await clickTestId(page, editorTestIds.psdImportTaskOpen);
  }
  await waitForTestId(page, editorTestIds.explicitPsdImportPanel);
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

const readText = async (page, testId) =>
  page.evaluate((id) => document.querySelector(`[data-testid="${id}"]`)?.textContent ?? "", testId);

const parseSelectedRefs = (value) =>
  String(value ?? "")
    .split(/[\s,]+/g)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

const isPartialMatch = (actual, expected) => {
  if (actual === null || actual === undefined) {
    return false;
  }

  return Object.entries(expected).every(([key, value]) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return isPartialMatch(actual[key], value);
    }

    return actual[key] === value;
  });
};

const main = async () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  const browser = locateBrowserExecutable();
  const server = await startOrReuseEditorServer({ repoRoot });
  let launchedBrowser;

  try {
    await assertFixtureDocsRegistration();
    console.log(
      `psd-import-plan-focused-e2e: using ${browser.executable} (${browser.source}); server ${
        server.baseUrl
      } ${server.reused ? "reused" : "started"}`
    );

    launchedBrowser = await launchHeadlessBrowser({ executable: browser.executable });

    for (const viewport of psdImportPlanFocusedSmokeViewports) {
      const page = await createPageSession({
        browserPort: launchedBrowser.port,
        viewport,
        url: server.baseUrl
      });

      try {
        await waitForTestId(page, editorTestIds.shell);
        await page.evaluate((storageKey) => localStorage.removeItem(storageKey), editorProjectStorageKey);
        await page.reload();
        await waitForTestId(page, editorTestIds.shell);

        const result = await runPsdImportPlanFocusedSmoke({ page, viewport });
        console.log(
          `psd-import-plan-focused-e2e: ${viewport.name} passed byteLength=${result.byteLength} root=${result.rootScopeRef} candidates=${result.candidateCount} approved=headwear,eyewear,tie/tie materializedBytes=${result.materializedByteLength}`
        );
        console.log(
          `psd-import-plan-focused-e2e: ${viewport.name} portableBundleBytes=${result.exportedBundleSize} screenshot ${result.screenshot.format} base64Length=${result.screenshot.base64Length}`
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
    console.log("psd-import-plan-focused-e2e: smoke passed");
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
