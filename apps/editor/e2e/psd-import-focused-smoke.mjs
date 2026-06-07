import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { locateBrowserExecutable } from "./browser-discovery.mjs";
import { launchHeadlessBrowser } from "./chrome-launcher.mjs";
import { createPageSession } from "./page-session.mjs";
import { startOrReuseEditorServer } from "./vite-server.mjs";
import {
  createLayerTreeDrawableRowTestId,
  editorProjectStorageKey,
  editorTestIds
} from "./test-ids.mjs";

const sampleFileUrl = new URL("../../../test_data/sample_model.psd", import.meta.url);
const sampleSummaryUrl = new URL(
  "../../../fixtures/contracts/wave31-byte-sample-characterization/expected/sample-model-byte-characterization-summary.json",
  import.meta.url
);
const materializationEvidenceUrl = new URL(
  "../../../test_data/derived/wave44/psd-layer-materialization/headwear.raw-rgba.materialization-evidence.json",
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

const selectedLayerNodeRef = "psd:root/layer[0]";
const materializedMediaType = "application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8";
const selectedLayerIntake = {
  destinationPartId: "part_root",
  destinationKind: "existingPart",
  drawableDisplayName: "headwear",
  drawableId: "draw_headwear",
  textureId: "tex_headwear",
  binaryAssetId: "bin_headwear_raw_rgba",
  sourceAssetId: "src_explicit_psd_sample_model_22406225"
};
const psdImportFocusedSmokeViewports = [
  {
    name: "desktop",
    width: 1280,
    height: 900,
    isMobile: false
  }
];

export const runPsdImportFocusedSmoke = async ({ page, viewport }) => {
  const sample = await readSampleEvidence();

  await openExplicitPsdImportTask(page);
  await waitForTestId(page, editorTestIds.explicitPsdImportForm);
  await waitForTestId(page, editorTestIds.explicitPsdImportFileInput);
  await waitForTestId(page, editorTestIds.explicitPsdImportSubmit);
  await waitForTestId(page, editorTestIds.explicitPsdImportLayerIntakeSubmit);
  await assertInitialExplicitPsdImportState(page, `${viewport.name} initial`);
  await assertExplicitPsdImportReachable(page, viewport);

  await setSelectedLayerNodeRef(page, selectedLayerNodeRef);
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

  await clickTestId(page, editorTestIds.explicitPsdImportLayerIntakeSubmit);
  await waitForText(
    page,
    editorTestIds.explicitPsdImportLayerIntakeResult,
    "Selected PSD layer added to project",
    60_000
  );
  await waitForText(page, editorTestIds.operationStatus, "importPsdLayerMaterialization committed");
  await waitForOperationLogEntryCount(page, 2);
  await waitForText(
    page,
    editorTestIds.operationLogSummary,
    "importPsdSourceAsset, importPsdLayerMaterialization"
  );
  await assertSelectedLayerIntakeCommittedState(page, sample, `${viewport.name} intake`);
  await assertNoUnsupportedExplicitPsdImportClaims(page, `${viewport.name} intake`);

  await clickTestId(page, editorTestIds.projectPersistenceSave);
  await waitForText(page, editorTestIds.projectPersistenceStatus, "Saved");
  await assertSavedProjectIncludesSelectedLayerIntake(page, sample, `${viewport.name} after save`);

  await page.reload();
  await waitForTestId(page, editorTestIds.shell);
  await clickTestId(page, editorTestIds.projectPersistenceLoad);
  await waitForText(page, editorTestIds.projectPersistenceStatus, "Loaded");
  await waitForText(page, editorTestIds.projectPersistenceSummary, "Persistent bytes: 1 restored / 1 checked");
  await openExplicitPsdImportTask(page);
  await assertExplicitPsdImportClearedAfterLoad(page, sample, `${viewport.name} after load`);
  await assertSelectedLayerProjectStateAfterLoad(page, `${viewport.name} after load`);
  await assertSavedProjectIncludesSelectedLayerIntake(page, sample, `${viewport.name} after load`);

  const screenshot = await page.captureScreenshot(`${viewport.name} wave46 PSD selected layer focused smoke`);

  return {
    viewport: viewport.name,
    sourcePath: "test_data/sample_model.psd",
    byteLength: sample.byteLength,
    sourceDigest: sample.sourceDigest,
    materializedByteLength: sample.materializedByteLength,
    materializedDigest: sample.materializedDigest,
    destinationPartId: selectedLayerIntake.destinationPartId,
    drawableId: selectedLayerIntake.drawableId,
    textureId: selectedLayerIntake.textureId,
    screenshot
  };
};

const readSampleEvidence = async () => {
  const summary = JSON.parse(await readFile(sampleSummaryUrl, "utf8"));
  const materialization = JSON.parse(await readFile(materializationEvidenceUrl, "utf8"));
  const sampleBytes = await readFile(sampleFileUrl);
  const base64Prefix = Buffer.from(sampleBytes.subarray(0, 256)).toString("base64").slice(0, 96);

  return {
    fileName: "sample_model.psd",
    byteLength: summary.byteEvidence.byteLength,
    byteLengthLabel: `${summary.byteEvidence.byteLength} bytes`,
    sourceDigest: summary.byteEvidence.digest.hex,
    base64Prefix,
    selectedLayerName: materialization.selectedLayer.name,
    selectedLayerNodeRef: materialization.selectedLayer.nodeRef,
    materializationId: "mat_psd_root_layer_0",
    materializedByteLength: materialization.materializationEvidence.byteLength,
    materializedByteLengthLabel: `${materialization.materializationEvidence.byteLength} bytes`,
    materializedDigest: materialization.materializationEvidence.digest.hex,
    materializedMediaType,
    materializedDimensionsLabel: "400 x 288",
    sourcePackagePath: "assets/sources/psd/sample_model_22406225.psd",
    texturePackagePath: `assets/textures/psd/psd_root_layer_0_${materialization.materializationEvidence.digest.hex.slice(0, 12)}.raw-rgba`
  };
};

const assertInitialExplicitPsdImportState = async (page, label) => {
  await waitForText(page, editorTestIds.explicitPsdImportStatus, "No PSD selected");
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
    editorTestIds.explicitPsdImportLayerIntakeResult,
    "No materialized project asset yet"
  );
  await waitForText(
    page,
    editorTestIds.explicitPsdImportLayerIntakeDiagnostics,
    "No selected layer intake diagnostics"
  );
  await waitForText(page, editorTestIds.explicitPsdImportDiagnostics, "No PSD parser diagnostics");

  const state = await readExplicitPsdImportState(page);
  if (state.selectedLayerControlValue !== selectedLayerNodeRef) {
    throw new Error(`${label} selected layer control mismatch: ${JSON.stringify(state)}.`);
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
  expectText("status", state.statusText, selectedLayerNodeRef);
  expectText("panel", state.panelText, "sample_model.psd");
  expectFact(state.sourceFacts, "Filename", sample.fileName);
  expectFact(state.sourceFacts, "Byte length", sample.byteLengthLabel);
  expectFact(state.sourceFacts, "Intake", "explicitFile");
  expectFact(state.sourceFacts, "Raw PSD bytes", "not persisted by parser bridge");
  expectFact(state.documentFacts, "Profile", "layered-character-psd-profile-v1");
  expectFact(
    state.documentFacts,
    "Adapter",
    "wave45-browser-explicit-psd-import-adapter / 0.1.0"
  );
  expectFact(state.documentFacts, "Parser", "webtoonPsd / @webtoon/psd / 0.4.0");
  expectFact(state.documentFacts, "Runtime", "browser");
  expectNumberFactAtLeast(state.documentFacts, "Groups", 1);
  expectNumberFactAtLeast(state.documentFacts, "Layers", 1);
  expectNumberFactAtLeast(state.documentFacts, "Visible layers", 1);
  expectNumberFactAtLeast(state.documentFacts, "Raster candidates", 1);
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
  expectText("layerTree", state.layerTreeText, sample.selectedLayerName);
  expectText("layerTree", state.layerTreeText, sample.selectedLayerNodeRef);
  expectText("layerTree", state.layerTreeText, "referenceOnly");
  expectText("materialization", state.materializationText, sample.materializationId);
  expectText("materialization", state.materializationText, sample.selectedLayerNodeRef);
  expectText("materialization", state.materializationText, sample.materializedMediaType);
  expectText("materialization", state.materializationText, sample.materializedByteLengthLabel);
  expectText("materialization", state.materializationText, `sha256:${sample.materializedDigest}`);
  expectText(
    "materialization",
    state.materializationText,
    "summary only; raw materialized bytes not persisted"
  );
  expectText("diagnostics", state.diagnosticsText, "browserPsdParser.parse.completed");
  expectText("diagnostics", state.diagnosticsText, "browserPsdParser.materialization.completed");
  expectText("diagnostics", state.diagnosticsText, "browserPsdParser.mainThreadRisk.recorded");

  if (failures.length > 0) {
    throw new Error(`${label} explicit PSD import assertions failed: ${failures.join("; ")}.`);
  }
};

const assertSelectedLayerIntakeCommittedState = async (page, sample, label) => {
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

  expectText("intakeResult", state.intakeResultText, "Selected PSD layer added to project");
  expectFact(state.intakeResultFacts, "Materialized digest", `sha256:${sample.materializedDigest}`);
  expectFact(state.intakeResultFacts, "Materialized byte length", sample.materializedByteLengthLabel);
  expectFact(state.intakeResultFacts, "Media type", sample.materializedMediaType);
  expectFact(state.intakeResultFacts, "Dimensions", sample.materializedDimensionsLabel);
  expectText("texture evidence", state.intakeResultFacts["Texture evidence"], selectedLayerIntake.textureId);
  expectText("texture evidence", state.intakeResultFacts["Texture evidence"], selectedLayerIntake.binaryAssetId);
  expectText("texture evidence", state.intakeResultFacts["Texture evidence"], sample.texturePackagePath);
  expectFact(
    state.intakeResultFacts,
    "Drawable evidence",
    `${selectedLayerIntake.drawableId} -> ${selectedLayerIntake.destinationPartId}`
  );
  expectFact(
    state.intakeResultFacts,
    "Part destination",
    `${selectedLayerIntake.destinationKind} / ${selectedLayerIntake.destinationPartId}`
  );
  expectText("source layer", state.intakeResultFacts["Source layer"], sample.selectedLayerNodeRef);
  expectText("source layer", state.intakeResultFacts["Source layer"], sample.selectedLayerName);
  expectFact(
    state.intakeResultFacts,
    "Source PSD",
    `${sample.sourcePackagePath} / sha256:${sample.sourceDigest} / ${sample.byteLengthLabel}`
  );
  expectFact(
    state.intakeResultFacts,
    "Provenance",
    "packageLocalAsset / notPublicDistributable / publicDemoAsset=false"
  );
  expectText("persistence", state.intakeResultFacts.Persistence, "packageLocalBinaryAssetRef");
  expectText("persistence", state.intakeResultFacts.Persistence, "binaryAssetRefOnlyNoInlineBytes");
  expectText("persistence", state.intakeResultFacts.Persistence, "browserLocalStore=stored:");
  expectText("intake diagnostics", state.intakeDiagnosticsText, "editor.explicitPsdLayerIntake.committed");
  expectText(
    "intake diagnostics",
    state.intakeDiagnosticsText,
    "Selected PSD layer materialized bytes were added as a private/local package texture asset."
  );

  if (failures.length > 0) {
    throw new Error(`${label} selected layer intake assertions failed: ${failures.join("; ")}.`);
  }
};

const assertSavedProjectIncludesSelectedLayerIntake = async (page, sample, label) => {
  const stored = await page.evaluate((storageKey) => {
    const raw = localStorage.getItem(storageKey);
    if (raw === null) {
      return null;
    }

    const project = JSON.parse(raw);
    const graph = readPackageJsonFile(project, "model/graph.json");
    const drawables = readPackageJsonFile(project, "model/drawables.json");
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
      (candidate) => candidate.sourceAssetId === "src_explicit_psd_sample_model_22406225"
    );
    const texture = textureAtlas?.textures?.find((candidate) => candidate.textureId === "tex_headwear");
    const drawable = drawables?.drawables?.find((candidate) => candidate.drawableId === "draw_headwear");
    const rootPart = graph?.parts?.find((candidate) => candidate.partId === "part_root");
    const materializationOperation = operationLogEntries.find(
      (entry) => entry.operationType === "importPsdLayerMaterialization"
    );

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
            materializationCount: sourceAsset.psdProfile?.materializationEvidence?.length ?? 0
          },
      texture: texture === undefined
        ? null
        : {
            textureId: texture.textureId,
            sourceAssetId: texture.sourceAssetId,
            sourceLayerId: texture.sourceLayerId,
            binaryAssetRef: texture.binaryAssetRef ?? null
          },
      drawable: drawable === undefined
        ? null
        : {
            drawableId: drawable.drawableId,
            displayName: drawable.displayName,
            partId: drawable.partId,
            textureId: drawable.textureId
          },
      rootPart: rootPart === undefined
        ? null
        : {
            partId: rootPart.partId,
            drawableIds: rootPart.drawableIds
          },
      materializationOperation: materializationOperation === undefined
        ? null
        : {
            operationType: materializationOperation.operationType,
            targetIds: materializationOperation.targetIds ?? [],
            json: JSON.stringify(materializationOperation)
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
  }, editorProjectStorageKey);

  if (stored === null) {
    throw new Error(`${label} did not save a browser-local project.`);
  }

  const expectedTextureBinaryRef = {
    referenceKind: "package-binary-asset-ref-v1",
    binaryAssetId: selectedLayerIntake.binaryAssetId,
    packageRelativePath: sample.texturePackagePath,
    digest: {
      algorithm: "sha256",
      hex: sample.materializedDigest
    },
    byteLength: sample.materializedByteLength,
    mediaType: sample.materializedMediaType,
    storageStatus: "stored-package-local-v1",
    rightsAssetId: selectedLayerIntake.sourceAssetId
  };
  const forbiddenSerializedClaims = [
    sample.base64Prefix,
    "explicitPsdImport",
    "browser-explicit-file",
    "public demo asset",
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

  if (
    stored.schemaVersion !== "editor-project-persistence-v1" ||
    stored.packageId !== "pkg_editor_browser_sample" ||
    stored.packageRevision !== 2 ||
    JSON.stringify(stored.operationTypes) !== JSON.stringify(["importPsdSourceAsset", "importPsdLayerMaterialization"]) ||
    stored.sourceAsset?.sourceAssetId !== selectedLayerIntake.sourceAssetId ||
    stored.sourceAsset?.filePath !== sample.sourcePackagePath ||
    stored.sourceAsset?.binaryAssetRef !== null ||
    stored.sourceAsset?.materializationCount !== 1 ||
    stored.texture?.textureId !== selectedLayerIntake.textureId ||
    stored.texture?.sourceAssetId !== selectedLayerIntake.sourceAssetId ||
    stored.texture?.sourceLayerId !== sample.selectedLayerNodeRef ||
    !isPartialMatch(stored.texture?.binaryAssetRef, expectedTextureBinaryRef) ||
    stored.drawable?.drawableId !== selectedLayerIntake.drawableId ||
    stored.drawable?.displayName !== selectedLayerIntake.drawableDisplayName ||
    stored.drawable?.partId !== selectedLayerIntake.destinationPartId ||
    stored.drawable?.textureId !== selectedLayerIntake.textureId ||
    stored.rootPart?.drawableIds?.includes(selectedLayerIntake.drawableId) !== true ||
    stored.materializationOperation?.operationType !== "importPsdLayerMaterialization" ||
    !stored.materializationOperation.targetIds.includes(selectedLayerIntake.textureId) ||
    !stored.materializationOperation.targetIds.includes(selectedLayerIntake.drawableId) ||
    !stored.materializationOperation.json.includes("psd-layer-materialization-operation-evidence-v1") ||
    !stored.materializationOperation.json.includes("rawParserObjectPersistence") ||
    !stored.materializationOperation.json.includes("notPersisted") ||
    !stored.materializationOperation.json.includes("sourcePsdBytePersistence") ||
    !stored.materializationOperation.json.includes("metadataOnlyNoRawBytes") ||
    !stored.materializationOperation.json.includes("packageLocalAsset") ||
    !stored.materializationOperation.json.includes("\"publicDemoAsset\":false") ||
    forbiddenSerializedClaims.length > 0 ||
    forbiddenPackagePayloadClaims.length > 0
  ) {
    throw new Error(
      `${label} saved project did not preserve Wave46 selected layer intake boundary: ${JSON.stringify({
        schemaVersion: stored.schemaVersion,
        packageId: stored.packageId,
        packageRevision: stored.packageRevision,
        operationTypes: stored.operationTypes,
        sourceAsset: stored.sourceAsset,
        texture: stored.texture,
        drawable: stored.drawable,
        rootPart: stored.rootPart,
        materializationOperation: stored.materializationOperation,
        forbiddenSerializedClaims,
        forbiddenPackagePayloadClaims
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
    sample.selectedLayerName,
    sample.materializedDigest,
    "PSD parsed in browser session",
    "browserPsdParser.parse.completed"
  ].filter((claim) => state.panelText.includes(claim));

  if (forbiddenLoadedClaims.length > 0) {
    throw new Error(
      `${label} explicit PSD import panel retained session-only evidence: ${forbiddenLoadedClaims.join(", ")}.`
    );
  }
};

const assertSelectedLayerProjectStateAfterLoad = async (page, label) => {
  await waitForOperationLogEntryCount(page, 2);
  await waitForText(
    page,
    editorTestIds.operationLogSummary,
    "importPsdSourceAsset, importPsdLayerMaterialization"
  );
  await waitForText(
    page,
    createLayerTreeDrawableRowTestId(selectedLayerIntake.drawableId),
    `${selectedLayerIntake.drawableDisplayName} / ${selectedLayerIntake.drawableId}`
  );
  await waitForText(
    page,
    createLayerTreeDrawableRowTestId(selectedLayerIntake.drawableId),
    selectedLayerIntake.textureId
  );
  await waitForText(
    page,
    createLayerTreeDrawableRowTestId(selectedLayerIntake.drawableId),
    "Texture resolved"
  );
  await waitForText(page, editorTestIds.sourceIntakeImportedSources, "1 imported source asset");
  await waitForText(page, editorTestIds.sourceIntakeImportedSources, selectedLayerIntake.sourceAssetId);
  await waitForText(
    page,
    editorTestIds.sourceIntakeImportedSources,
    `Texture binary ref ${selectedLayerIntake.textureId}`
  );
  await waitForText(page, editorTestIds.sourceIntakeImportedSources, selectedLayerIntake.binaryAssetId);
  await waitForText(page, editorTestIds.sourceIntakeImportedSources, "restored from same-origin browser-local IndexedDB");

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
    panelText.includes("Selected PSD layer added to project")
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
    const intakeSubmit = document.querySelector(`[data-testid="${ids.intakeSubmit}"]`);

    if (
      !(panel instanceof HTMLElement) ||
      !(form instanceof HTMLFormElement) ||
      !(fileInput instanceof HTMLInputElement) ||
      !(submit instanceof HTMLButtonElement) ||
      !(intakeSubmit instanceof HTMLButtonElement)
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
    const intakeSubmitRect = intakeSubmit.getBoundingClientRect();

    return {
      panelVisible: rectVisible(panelRect),
      formVisible: rectVisible(formRect),
      fileInputVisible: rectVisible(inputRect),
      submitVisible: rectVisible(submitRect),
      intakeSubmitVisible: rectVisible(intakeSubmitRect),
      panelWidth: panelRect.width,
      formWidth: formRect.width,
      fileInputWidth: inputRect.width,
      submitWidth: submitRect.width,
      intakeSubmitWidth: intakeSubmitRect.width
    };
  }, {
    panel: editorTestIds.explicitPsdImportPanel,
    form: editorTestIds.explicitPsdImportForm,
    fileInput: editorTestIds.explicitPsdImportFileInput,
    submit: editorTestIds.explicitPsdImportSubmit,
    intakeSubmit: editorTestIds.explicitPsdImportLayerIntakeSubmit
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
    metrics.intakeSubmitWidth < 1
  ) {
    throw new Error(
      `${viewport.name} explicit PSD import panel was not reachable/usable: ${JSON.stringify(metrics)}.`
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
    "wave45-psd-import-focused-e2e-regression",
    "private/local",
    "not a public demo asset",
    "apps/editor/e2e/psd-import-focused-smoke.mjs",
    "scripts/check-psd-parser-import-boundary.mjs",
    "wave46-psd-selected-layer-focused-e2e-persistence-regression"
  ];
  const requiredTraceabilityTokens = [
    "TC-WAVE45-PSD-IMPORT-FOCUSED-E2E-001",
    "wave45-psd-import-focused-e2e-regression",
    "TC-WAVE46-PSD-SELECTED-LAYER-E2E-001",
    "wave46-psd-selected-layer-focused-e2e-persistence-regression",
    "private/local",
    "no source PSD bytes or raw parser objects",
    "check-psd-parser-import-boundary"
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
    throw new Error(`Wave45/Wave46 PSD import fixture/traceability registration missing: ${missing.join(", ")}.`);
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

    return {
      panelText: readText(ids.panel),
      statusText: readText(ids.status),
      sourceFacts: readFacts(ids.source),
      documentFacts: readFacts(ids.document),
      featureFacts: readFacts(ids.featureSupport),
      featureSupportText: readText(ids.featureSupport),
      materializationText: readText(ids.materialization),
      intakeResultText: readText(ids.intakeResult),
      intakeResultFacts: readFacts(ids.intakeResult),
      intakeDiagnosticsText: readText(ids.intakeDiagnostics),
      layerTreeText: readText(ids.layerTree),
      persistenceFacts: readFacts(ids.persistence),
      diagnosticsText: readText(ids.diagnostics),
      selectedLayerControlValue:
        selectedLayerControl instanceof HTMLInputElement ? selectedLayerControl.value : null
    };
  }, {
    panel: editorTestIds.explicitPsdImportPanel,
    status: editorTestIds.explicitPsdImportStatus,
    source: editorTestIds.explicitPsdImportSource,
    document: editorTestIds.explicitPsdImportDocument,
    featureSupport: editorTestIds.explicitPsdImportFeatureSupport,
    materialization: editorTestIds.explicitPsdImportMaterialization,
    intakeResult: editorTestIds.explicitPsdImportLayerIntakeResult,
    intakeDiagnostics: editorTestIds.explicitPsdImportLayerIntakeDiagnostics,
    layerTree: editorTestIds.explicitPsdImportLayerTree,
    persistence: editorTestIds.explicitPsdImportPersistence,
    diagnostics: editorTestIds.explicitPsdImportDiagnostics,
    selectedLayer: editorTestIds.explicitPsdImportSelectedLayerNodeRef
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

const main = async () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  const browser = locateBrowserExecutable();
  const server = await startOrReuseEditorServer({ repoRoot });
  let launchedBrowser;

  try {
    await assertFixtureDocsRegistration();
    console.log(
      `psd-import-focused-e2e: using ${browser.executable} (${browser.source}); server ${
        server.baseUrl
      } ${server.reused ? "reused" : "started"}`
    );

    launchedBrowser = await launchHeadlessBrowser({ executable: browser.executable });

    for (const viewport of psdImportFocusedSmokeViewports) {
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

        const result = await runPsdImportFocusedSmoke({ page, viewport });
        console.log(
          `psd-import-focused-e2e: ${viewport.name} passed byteLength=${result.byteLength} materializedBytes=${result.materializedByteLength} drawable=${result.drawableId} texture=${result.textureId}`
        );
        console.log(
          `psd-import-focused-e2e: ${viewport.name} screenshot ${result.screenshot.format} base64Length=${result.screenshot.base64Length}`
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
    console.log("psd-import-focused-e2e: smoke passed");
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
