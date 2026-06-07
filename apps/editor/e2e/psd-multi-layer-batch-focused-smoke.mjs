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
import { openExplicitPsdImportTask } from "./selector-scopes.mjs";

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
const batchId = `batch_${sourceAssetId}_3`;
const destinationParentPartId = "part_root";
const batchTotalMaterializedByteLength = 810_360;
const targetLayers = [
  {
    displayName: "headwear",
    sourceLayerId: "psd:root/layer[0]",
    sourceLayerName: "headwear",
    sourceLayerPath: ["headwear"],
    dimensionsLabel: "400 x 288",
    materializationId: "mat_psd_root_layer_0",
    byteLength: 460_800,
    digest: "671e6a363745b1ce2e8d29c1a63438170fe9511c8884ea42298cf9b8886e5c1a",
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
    dimensionsLabel: "265 x 110",
    materializationId: "mat_psd_root_layer_3",
    byteLength: 116_600,
    digest: "a5558168cbf75f7817a139131c764e317a77056138d6be0e591077b3e373e708",
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
    dimensionsLabel: "104 x 560",
    materializationId: "mat_psd_root_group_6_layer_0",
    byteLength: 232_960,
    digest: "46ba1a95659ac420d37ca89b0ab919ca6ad2022280bb268313937fcd2cd69673",
    partId: "part_tie_tie",
    drawableId: "draw_tie_tie",
    meshId: "mesh_tie_tie",
    textureId: "tex_tie_tie",
    binaryAssetId: "bin_tie_tie_raw_rgba",
    texturePackagePath: "assets/textures/psd/psd_root_group_6_layer_0_46ba1a95659a.raw-rgba"
  }
];
const targetLayerRefs = targetLayers.map((layer) => layer.sourceLayerId);
const psdMultiLayerBatchFocusedSmokeViewports = [
  {
    name: "desktop",
    width: 1280,
    height: 900,
    isMobile: false
  }
];

export const runPsdMultiLayerBatchFocusedSmoke = async ({ page, viewport }) => {
  const sample = await readSampleEvidence();

  await openExplicitPsdImportTask(page);
  await waitForTestId(page, editorTestIds.explicitPsdImportForm);
  await waitForTestId(page, editorTestIds.explicitPsdImportFileInput);
  await waitForTestId(page, editorTestIds.explicitPsdImportSubmit);
  await waitForTestId(page, editorTestIds.explicitPsdImportBatchIntakeForm);
  await waitForTestId(page, editorTestIds.explicitPsdImportBatchIntakeSubmit);
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

  await selectBatchLayerRefsThroughLayerTree(page, targetLayerRefs);
  await setBatchDestinationParentPart(page, destinationParentPartId);
  await assertBatchSelectionState(page, `${viewport.name} batch selection`);

  await clickTestId(page, editorTestIds.explicitPsdImportBatchIntakeSubmit);
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
  await assertBatchIntakeCommittedState(page, `${viewport.name} batch intake`);
  await assertNoUnsupportedExplicitPsdImportClaims(page, `${viewport.name} batch intake`);

  await clickTestId(page, editorTestIds.projectPersistenceSave);
  await waitForText(page, editorTestIds.projectPersistenceStatus, "Saved");
  await assertSavedProjectIncludesBatchIntake(page, sample, `${viewport.name} after save`);

  await page.reload();
  await waitForTestId(page, editorTestIds.shell);
  await clickTestId(page, editorTestIds.projectPersistenceLoad);
  await waitForText(page, editorTestIds.projectPersistenceStatus, "Loaded");
  await waitForText(page, editorTestIds.projectPersistenceSummary, "Persistent bytes: 3 restored / 3 checked");
  await openExplicitPsdImportTask(page);
  await assertExplicitPsdImportClearedAfterLoad(page, sample, `${viewport.name} after load`);
  await assertBatchProjectStateAfterLoad(page, `${viewport.name} after load`);
  await assertSavedProjectIncludesBatchIntake(page, sample, `${viewport.name} after load`);

  const screenshot = await page.captureScreenshot(`${viewport.name} wave47 PSD multi-layer batch focused smoke`);

  return {
    viewport: viewport.name,
    sourcePath: "test_data/sample_model.psd",
    byteLength: sample.byteLength,
    sourceDigest: sample.sourceDigest,
    materializedByteLength: batchTotalMaterializedByteLength,
    selectedLayerRefs: targetLayerRefs,
    destinationParentPartId,
    batchId,
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
    sourceDigest: summary.byteEvidence.digest.hex,
    base64Prefix,
    sourcePackagePath
  };
};

const assertInitialExplicitPsdImportState = async (page, label) => {
  await waitForText(page, editorTestIds.explicitPsdImportStatus, "No PSD selected");
  await waitForText(page, editorTestIds.explicitPsdImportStatus, "1 selected PSD leaf layer");
  await waitForText(page, editorTestIds.explicitPsdImportSource, "User-selected PSD file only");
  await waitForText(page, editorTestIds.explicitPsdImportDocument, "No parsed PSD document metadata");
  await waitForText(page, editorTestIds.explicitPsdImportLayerTree, "No parsed PSD layer tree");
  await waitForText(
    page,
    editorTestIds.explicitPsdImportMaterialization,
    "No selected layer materialization evidence summary"
  );
  await waitForText(
    page,
    editorTestIds.explicitPsdImportBatchIntakeResult,
    "No selected leaf layer batch result"
  );
  await waitForText(
    page,
    editorTestIds.explicitPsdImportBatchIntakeResult,
    "No selected leaf layer batch materialized yet"
  );
  await waitForText(
    page,
    editorTestIds.explicitPsdImportBatchIntakeEntries,
    "No selected leaf layer batch entries"
  );
  await waitForText(
    page,
    editorTestIds.explicitPsdImportBatchIntakeDiagnostics,
    "No selected leaf layer batch diagnostics"
  );

  const state = await readExplicitPsdImportState(page);
  if (
    state.selectedLayerControlValue !== targetLayers[0].sourceLayerId ||
    state.batchLayerRefsControlValue.trim() !== targetLayers[0].sourceLayerId
  ) {
    throw new Error(`${label} selected layer controls mismatch: ${JSON.stringify(state)}.`);
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
  const controlFacts = {
    "Selected layer control": state.selectedLayerControlValue,
    "Batch layer refs control": state.batchLayerRefsControlValue.trim()
  };

  expectText("status", state.statusText, "PSD parsed in browser session");
  expectText("status", state.statusText, "1 selected PSD leaf layer");
  expectText("panel", state.panelText, sample.fileName);
  expectFact(controlFacts, "Selected layer control", targetLayers[0].sourceLayerId);
  expectFact(controlFacts, "Batch layer refs control", targetLayers[0].sourceLayerId);
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
    throw new Error(`${label} explicit PSD import assertions failed: ${failures.join("; ")}.`);
  }
};

const selectBatchLayerRefsThroughLayerTree = async (page, layerRefs) => {
  await page.evaluate((refs) => {
    const choices = [...document.querySelectorAll('input[name="explicitPsdLeafLayerBatchSelection"]')];
    if (choices.length === 0) {
      throw new Error("Missing explicit PSD leaf layer batch selection controls.");
    }

    for (const choice of choices) {
      if (!(choice instanceof HTMLInputElement)) {
        continue;
      }

      choice.checked = false;
      choice.dispatchEvent(new Event("change", { bubbles: true }));
    }

    const missing = [];
    for (const ref of refs) {
      const escapedRef = CSS.escape(ref);
      const choice = document.querySelector(
        `input[name="explicitPsdLeafLayerBatchSelection"][value="${escapedRef}"]`
      );
      if (!(choice instanceof HTMLInputElement) || choice.disabled) {
        missing.push(ref);
        continue;
      }

      choice.checked = true;
      choice.dispatchEvent(new Event("change", { bubbles: true }));
    }

    if (missing.length > 0) {
      throw new Error(`Missing selectable Domain A PSD leaf layers: ${missing.join(", ")}.`);
    }
  }, layerRefs);
};

const setBatchDestinationParentPart = async (page, parentPartId) => {
  await page.evaluate((formId, value) => {
    const form = document.querySelector(`[data-testid="${formId}"]`);
    const select = form?.querySelector('select[name="batchDestinationParentPartId"]');

    if (!(select instanceof HTMLSelectElement)) {
      throw new Error("Missing batch destination parent part select.");
    }

    select.value = value;
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }, editorTestIds.explicitPsdImportBatchIntakeForm, parentPartId);
};

const assertBatchSelectionState = async (page, label) => {
  const state = await readExplicitPsdImportState(page);
  const selectedRefs = state.batchLayerRefsControlValue
    .split(/\s+/g)
    .map((ref) => ref.trim())
    .filter((ref) => ref.length > 0);
  const mismatch =
    JSON.stringify(selectedRefs) !== JSON.stringify(targetLayerRefs) ||
    state.selectedLayerControlValue !== targetLayers[0].sourceLayerId;

  if (mismatch) {
    throw new Error(
      `${label} batch selection mismatch: ${JSON.stringify({
        selectedRefs,
        selectedLayerControlValue: state.selectedLayerControlValue,
        statusText: state.statusText
      })}.`
    );
  }
};

const assertBatchIntakeCommittedState = async (page, label) => {
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
  expectText(
    "diagnostics",
    state.batchIntakeDiagnosticsText,
    "Selected PSD leaf layer materialized bytes were added as private/local generated part texture assets."
  );

  if (failures.length > 0) {
    throw new Error(`${label} selected layer batch intake assertions failed: ${failures.join("; ")}.`);
  }
};

const assertSavedProjectIncludesBatchIntake = async (page, sample, label) => {
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
    const sourceOperation = operationLogEntries.find(
      (entry) => entry.operationType === "importPsdSourceAsset"
    );
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
      sourceOperation: sourceOperation === undefined
        ? null
        : {
            operationType: sourceOperation.operationType,
            targetIds: sourceOperation.targetIds ?? []
          },
      sourceAsset: sourceAsset === undefined
        ? null
        : {
            sourceAssetId: sourceAsset.sourceAssetId,
            filePath: sourceAsset.filePath,
            binaryAssetRef: sourceAsset.binaryAssetRef ?? null,
            materializationCount: sourceAsset.psdProfile?.materializationEvidence?.length ?? 0
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
            payload: batchOperation.payload,
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
  expect(stored.sourceOperation?.targetIds?.includes(sourceAssetId), "source import did not target source asset");
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
  expect(stored.batchOperation?.json.includes("\"publicDemoAsset\":false"), "batch operation missing publicDemoAsset=false");
  expect(stored.batchOperation?.json.includes("rawParserObjectPersistence"), "batch operation missing parser boundary");
  expect(stored.batchOperation?.json.includes("sourcePsdBytePersistence"), "batch operation missing source byte boundary");
  expect(stored.batchOperation?.json.includes("materializedLayerBytePersistence"), "batch operation missing materialized byte boundary");
  for (const layer of targetLayers) {
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
  }

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
      `${label} saved project did not preserve Wave47 batch boundary: ${JSON.stringify({
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

const assertExplicitPsdImportClearedAfterLoad = async (page, sample, label) => {
  await assertInitialExplicitPsdImportState(page, label);
  const state = await readExplicitPsdImportState(page);
  const forbiddenLoadedClaims = [
    sample.fileName,
    ...targetLayers.map((layer) => layer.digest),
    "PSD parsed in browser session",
    "browserPsdParser.parse.completed",
    "Selected PSD leaf layers added to generated parts"
  ].filter((claim) => state.panelText.includes(claim));

  if (forbiddenLoadedClaims.length > 0) {
    throw new Error(
      `${label} explicit PSD import panel retained session-only batch evidence: ${forbiddenLoadedClaims.join(", ")}.`
    );
  }
};

const assertBatchProjectStateAfterLoad = async (page, label) => {
  await waitForOperationLogEntryCount(page, 2);
  await waitForText(
    page,
    editorTestIds.operationLogSummary,
    "importPsdSourceAsset, importPsdLayerMaterializationBatch"
  );
  await waitForText(page, editorTestIds.sourceIntakeImportedSources, "1 imported source asset");
  await waitForText(page, editorTestIds.sourceIntakeImportedSources, sourceAssetId);
  await waitForText(page, editorTestIds.sourceIntakeImportedSources, "restored from same-origin browser-local IndexedDB");

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
    const batchSubmit = document.querySelector(`[data-testid="${ids.batchSubmit}"]`);

    if (
      !(panel instanceof HTMLElement) ||
      !(form instanceof HTMLFormElement) ||
      !(fileInput instanceof HTMLInputElement) ||
      !(submit instanceof HTMLButtonElement) ||
      !(batchSubmit instanceof HTMLButtonElement)
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
    const batchSubmitRect = batchSubmit.getBoundingClientRect();

    return {
      panelVisible: rectVisible(panelRect),
      formVisible: rectVisible(formRect),
      fileInputVisible: rectVisible(inputRect),
      submitVisible: rectVisible(submitRect),
      batchSubmitWidth: batchSubmitRect.width,
      panelWidth: panelRect.width,
      formWidth: formRect.width,
      fileInputWidth: inputRect.width,
      submitWidth: submitRect.width
    };
  }, {
    panel: editorTestIds.explicitPsdImportPanel,
    form: editorTestIds.explicitPsdImportForm,
    fileInput: editorTestIds.explicitPsdImportFileInput,
    submit: editorTestIds.explicitPsdImportSubmit,
    batchSubmit: editorTestIds.explicitPsdImportBatchIntakeSubmit
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
    metrics.batchSubmitWidth < 1
  ) {
    throw new Error(
      `${viewport.name} explicit PSD batch import panel was not reachable/usable: ${JSON.stringify(metrics)}.`
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
      `${label} explicit PSD import UI made an unsupported claim (${evidence.forbiddenClaim}): ${evidence.text}`
    );
  }
};

const assertFixtureDocsRegistration = async () => {
  const fixtureManifest = await readFile(fixtureManifestUrl, "utf8");
  const traceabilityMatrix = await readFile(traceabilityMatrixUrl, "utf8");
  const requiredManifestTokens = [
    "wave47-psd-multi-layer-focused-e2e-persistence-regression",
    "TC-WAVE47-PSD-MULTI-LAYER-BATCH-E2E-001",
    "apps/editor/e2e/psd-multi-layer-batch-focused-smoke.mjs",
    "scripts/run-focused-e2e.mjs --id psdMultiLayerBatchFocused",
    "headwear",
    "eyewear",
    "tie / tie",
    "publicDemoAsset=false"
  ];
  const requiredTraceabilityTokens = [
    "TC-WAVE47-PSD-MULTI-LAYER-BATCH-E2E-001",
    "wave47-psd-multi-layer-focused-e2e-persistence-regression",
    "psdMultiLayerBatchFocused",
    "selectedPsdLayer.batchMaterialization.success",
    "editor.explicitPsdLayerBatchIntake.committed",
    "asset.psd.materializedBatchAvailable"
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
    throw new Error(`Wave47 PSD batch fixture/traceability registration missing: ${missing.join(", ")}.`);
  }
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
    const batchLayerRefsControl = document.querySelector(`[data-testid="${ids.batchLayerRefs}"]`);

    return {
      panelText: readText(ids.panel),
      statusText: readText(ids.status),
      sourceFacts: readFacts(ids.source),
      documentFacts: readFacts(ids.document),
      featureFacts: readFacts(ids.featureSupport),
      featureSupportText: readText(ids.featureSupport),
      materializationText: readText(ids.materialization),
      batchIntakeResultText: readText(ids.batchIntakeResult),
      batchIntakeResultFacts: readFacts(ids.batchIntakeResult),
      batchIntakeEntriesText: readText(ids.batchIntakeEntries),
      batchIntakeDiagnosticsText: readText(ids.batchIntakeDiagnostics),
      layerTreeText: readText(ids.layerTree),
      persistenceFacts: readFacts(ids.persistence),
      diagnosticsText: readText(ids.diagnostics),
      selectedLayerControlValue:
        selectedLayerControl instanceof HTMLInputElement ? selectedLayerControl.value : null,
      batchLayerRefsControlValue:
        batchLayerRefsControl instanceof HTMLTextAreaElement ? batchLayerRefsControl.value : null
    };
  }, {
    panel: editorTestIds.explicitPsdImportPanel,
    status: editorTestIds.explicitPsdImportStatus,
    source: editorTestIds.explicitPsdImportSource,
    document: editorTestIds.explicitPsdImportDocument,
    featureSupport: editorTestIds.explicitPsdImportFeatureSupport,
    materialization: editorTestIds.explicitPsdImportMaterialization,
    batchIntakeResult: editorTestIds.explicitPsdImportBatchIntakeResult,
    batchIntakeEntries: editorTestIds.explicitPsdImportBatchIntakeEntries,
    batchIntakeDiagnostics: editorTestIds.explicitPsdImportBatchIntakeDiagnostics,
    layerTree: editorTestIds.explicitPsdImportLayerTree,
    persistence: editorTestIds.explicitPsdImportPersistence,
    diagnostics: editorTestIds.explicitPsdImportDiagnostics,
    selectedLayer: editorTestIds.explicitPsdImportSelectedLayerNodeRef,
    batchLayerRefs: editorTestIds.explicitPsdImportBatchLayerRefs
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

const readText = async (page, testId) =>
  page.evaluate((id) => document.querySelector(`[data-testid="${id}"]`)?.textContent ?? "", testId);

const main = async () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  const browser = locateBrowserExecutable();
  const server = await startOrReuseEditorServer({ repoRoot });
  let launchedBrowser;

  try {
    await assertFixtureDocsRegistration();
    console.log(
      `psd-multi-layer-batch-focused-e2e: using ${browser.executable} (${browser.source}); server ${
        server.baseUrl
      } ${server.reused ? "reused" : "started"}`
    );

    launchedBrowser = await launchHeadlessBrowser({ executable: browser.executable });

    for (const viewport of psdMultiLayerBatchFocusedSmokeViewports) {
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

        const result = await runPsdMultiLayerBatchFocusedSmoke({ page, viewport });
        console.log(
          `psd-multi-layer-batch-focused-e2e: ${viewport.name} passed byteLength=${result.byteLength} materializedBytes=${result.materializedByteLength} layers=headwear,eyewear,tie/tie batch=${result.batchId}`
        );
        console.log(
          `psd-multi-layer-batch-focused-e2e: ${viewport.name} screenshot ${result.screenshot.format} base64Length=${result.screenshot.base64Length}`
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
    console.log("psd-multi-layer-batch-focused-e2e: smoke passed");
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
