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
const expectedSourceGroupCount = 20;
const expectedSourceLayerCount = 126;
const expectedVisibleLayerCount = 121;
const expectedHiddenLayerCount = 5;
const expectedApprovedByteEstimate = 2_344_760;
const defaultSelectedLayerNodeRef = "psd:root/layer[0]";
const expectedOperationTypes = ["importPsdSourceAsset", "importPsdStructuralScaffold"];
const codexWorkflowStorageKey = `${editorProjectStorageKey}.wave50-structural-codex`;
const expectedGeneratedGroupPartCount = 2;
const expectedGeneratedDrawableCount = 4;
const expectedRuntimeHiddenDrawableCount = 1;
const expectedSourceOrderLeafRefs = [
  "psd:root/layer[1]",
  "psd:root/group[2]/layer[0]",
  "psd:root/layer[3]",
  "psd:root/group[6]/layer[0]"
];
const expectedSourceOrderStructuralRefs = [
  "psd:root/layer[1]",
  "group_psd_root_group_2",
  "psd:root/group[2]/layer[0]",
  "psd:root/layer[3]",
  "group_psd_root_group_6",
  "psd:root/group[6]/layer[0]"
];
const approvalInputNodeRefs = [
  "psd:root/group[6]/layer[0]",
  "psd:root/group[2]/layer[0]",
  "psd:root/layer[1]",
  "psd:root/layer[3]"
];
const structuralGroups = [
  {
    displayName: "hair_front",
    sourceGroupId: "group_psd_root_group_2",
    sourceGroupPath: ["hair_front"],
    partId: "part_hair_front_group_psd_root_group_2_structural"
  },
  {
    displayName: "tie",
    sourceGroupId: "group_psd_root_group_6",
    sourceGroupPath: ["tie"],
    partId: "part_tie_group_psd_root_group_6_structural"
  }
];
const hairFrontGroup = structuralGroups[0];
const tieGroup = structuralGroups[1];
const structuralLeaves = [
  {
    displayName: "headwear",
    fullPathLabel: "headwear",
    sourceLayerId: "psd:root/layer[1]",
    sourceLayerPath: ["headwear"],
    sourceOrder: 1,
    materializationId: "mat_psd_root_layer_1",
    byteLength: 457_600,
    partId: destinationParentPartId,
    drawableId: "draw_headwear_psd_root_layer_1_structural",
    textureId: "tex_headwear_psd_root_layer_1_structural",
    meshId: "mesh_headwear_psd_root_layer_1_structural",
    binaryAssetId: "bin_headwear_psd_root_layer_1_structural_raw_rgba",
    texturePathPrefix: "assets/textures/psd/psd_root_layer_1_",
    initialRuntimeVisibility: false
  },
  {
    displayName: "front hair",
    fullPathLabel: "hair_front / front hair",
    sourceLayerId: "psd:root/group[2]/layer[0]",
    sourceLayerPath: ["hair_front", "front hair"],
    sourceOrder: 3,
    materializationId: "mat_psd_root_group_2_layer_0",
    byteLength: 1_537_600,
    partId: hairFrontGroup.partId,
    drawableId: "draw_hair_front_front_hair_psd_root_group_2_layer_0_structural",
    textureId: "tex_hair_front_front_hair_psd_root_group_2_layer_0_structural",
    meshId: "mesh_hair_front_front_hair_psd_root_group_2_layer_0_structural",
    binaryAssetId: "bin_hair_front_front_hair_psd_root_group_2_layer_0_structural_raw_rgba",
    texturePathPrefix: "assets/textures/psd/psd_root_group_2_layer_0_",
    initialRuntimeVisibility: true
  },
  {
    displayName: "eyewear",
    fullPathLabel: "eyewear",
    sourceLayerId: "psd:root/layer[3]",
    sourceLayerPath: ["eyewear"],
    sourceOrder: 6,
    materializationId: "mat_psd_root_layer_3",
    byteLength: 116_600,
    partId: destinationParentPartId,
    drawableId: "draw_eyewear_psd_root_layer_3_structural",
    textureId: "tex_eyewear_psd_root_layer_3_structural",
    meshId: "mesh_eyewear_psd_root_layer_3_structural",
    binaryAssetId: "bin_eyewear_psd_root_layer_3_structural_raw_rgba",
    texturePathPrefix: "assets/textures/psd/psd_root_layer_3_",
    initialRuntimeVisibility: true
  },
  {
    displayName: "tie",
    fullPathLabel: "tie / tie",
    sourceLayerId: "psd:root/group[6]/layer[0]",
    sourceLayerPath: ["tie", "tie"],
    sourceOrder: 115,
    materializationId: "mat_psd_root_group_6_layer_0",
    byteLength: 232_960,
    partId: tieGroup.partId,
    drawableId: "draw_tie_tie_psd_root_group_6_layer_0_structural",
    textureId: "tex_tie_tie_psd_root_group_6_layer_0_structural",
    meshId: "mesh_tie_tie_psd_root_group_6_layer_0_structural",
    binaryAssetId: "bin_tie_tie_psd_root_group_6_layer_0_structural_raw_rgba",
    texturePathPrefix: "assets/textures/psd/psd_root_group_6_layer_0_",
    initialRuntimeVisibility: true
  }
];
const approvedStructuralNodeRefs = expectedSourceOrderLeafRefs;
const frontHairLeaf = structuralLeaves.find((leaf) => leaf.sourceLayerId === "psd:root/group[2]/layer[0]");
const hiddenHeadwearLeaf = structuralLeaves.find((leaf) => leaf.sourceLayerId === "psd:root/layer[1]");
const psdStructuralInitialStateFocusedSmokeViewports = [{
  name: "desktop",
  width: 1280,
  height: 900,
  isMobile: false
}];

export const runPsdStructuralInitialStateFocusedSmoke = async ({ page, viewport }) => {
  const sample = await readSampleEvidence();

  await waitForTestId(page, editorTestIds.explicitPsdImportPanel);
  await waitForTestId(page, editorTestIds.explicitPsdImportForm);
  await waitForTestId(page, editorTestIds.explicitPsdStructuralScaffoldForm);
  await waitForTestId(page, editorTestIds.explicitPsdStructuralScaffoldApprovedForm);
  await assertInitialExplicitPsdImportState(page, `${viewport.name} initial`);
  await assertExplicitPsdImportReachable(page, viewport);

  await setSelectedLayerNodeRef(page, frontHairLeaf.sourceLayerId);
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

  await setStructuralScaffoldPreviewInputs(page, {
    scopeRef: importPlanScopeRef,
    approvedNodeRefs: approvalInputNodeRefs,
    destinationParentPartId
  });
  await clickTestId(page, editorTestIds.explicitPsdStructuralScaffoldSubmit);
  await waitForText(
    page,
    editorTestIds.explicitPsdStructuralScaffoldPreview,
    "Structural scaffold preview ready",
    90_000
  );
  await assertStructuralScaffoldPreviewState(page, sample, `${viewport.name} structural preview`);
  await assertNoUnsupportedExplicitPsdImportClaims(page, `${viewport.name} structural preview`);

  await setStructuralScaffoldApprovedRefs(page, expectedSourceOrderStructuralRefs);
  await setApprovedStructuralScaffoldDestinationParentPart(page, destinationParentPartId);
  await clickTestId(page, editorTestIds.explicitPsdStructuralScaffoldApprovedSubmit);
  await waitForText(
    page,
    editorTestIds.explicitPsdStructuralScaffoldResult,
    "Structural scaffold added to project",
    180_000
  );
  await waitForText(page, editorTestIds.operationStatus, "importPsdStructuralScaffold committed", 60_000);
  await waitForOperationLogEntryCount(page, 2);
  await waitForText(
    page,
    editorTestIds.operationLogSummary,
    "importPsdSourceAsset, importPsdStructuralScaffold"
  );
  await assertStructuralScaffoldCommittedState(page, `${viewport.name} structural commit`);
  await assertNoUnsupportedExplicitPsdImportClaims(page, `${viewport.name} structural commit`);

  await clickTestId(page, editorTestIds.projectPersistenceSave);
  await waitForText(page, editorTestIds.projectPersistenceStatus, "Saved");
  await assertSavedProjectIncludesStructuralScaffold(page, sample, `${viewport.name} after save`);

  await page.reload();
  await waitForTestId(page, editorTestIds.shell);
  await clickTestId(page, editorTestIds.projectPersistenceLoad);
  await waitForText(page, editorTestIds.projectPersistenceStatus, "Loaded");
  await waitForText(page, editorTestIds.projectPersistenceSummary, "Persistent bytes: 4 restored / 4 checked");
  await assertExplicitPsdImportClearedAfterLoad(page, sample, `${viewport.name} after load`);
  await assertStructuralProjectStateAfterLoad(page, `${viewport.name} after load`);
  await assertSavedProjectIncludesStructuralScaffold(page, sample, `${viewport.name} after load`);

  const codexResult = await runCodexFacingStructuralProjection(page, {
    sampleAbsolutePath: fileURLToPath(sampleFileUrl),
    sourceDigest: sample.sourceDigest,
    sourceByteLength: sample.byteLength
  });
  const screenshot = await page.captureScreenshot(`${viewport.name} wave50 PSD structural scaffold focused smoke`);

  return {
    viewport: viewport.name,
    sourcePath: "test_data/sample_model.psd",
    byteLength: sample.byteLength,
    sourceDigest: sample.sourceDigest,
    scopeRef: importPlanScopeRef,
    approvedNodeRefs: approvedStructuralNodeRefs,
    approvalInputNodeRefs,
    approvedByteEstimate: expectedApprovedByteEstimate,
    generatedGroupPartIds: structuralGroups.map((group) => group.partId),
    runtimeHiddenDrawableId: hiddenHeadwearLeaf.drawableId,
    codexStatus: codexResult.readStatus,
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
  await waitForText(page, editorTestIds.explicitPsdStructuralScaffoldPreview, "No structural scaffold preview generated");
  await waitForText(page, editorTestIds.explicitPsdStructuralScaffoldPreview, "No structural scaffold preview");
  await waitForText(page, editorTestIds.explicitPsdStructuralScaffoldNodes, "No structural scaffold nodes");
  await waitForText(page, editorTestIds.explicitPsdStructuralScaffoldDiagnostics, "No structural scaffold preview diagnostics");
  await waitForText(page, editorTestIds.explicitPsdStructuralScaffoldResult, "No structural scaffold result");
  await waitForText(page, editorTestIds.explicitPsdStructuralScaffoldEntries, "No structural scaffold entries");
  await waitForText(page, editorTestIds.explicitPsdStructuralScaffoldResultDiagnostics, "No structural scaffold result diagnostics");

  const state = await readExplicitPsdImportState(page);
  if (
    state.selectedLayerControlValue !== defaultSelectedLayerNodeRef ||
    state.structuralScopeRefControlValue !== importPlanScopeRef ||
    state.structuralApprovedRefsControlValue.trim() !== ""
  ) {
    throw new Error(`${label} initial structural controls mismatch: ${JSON.stringify(state)}.`);
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
  expectFact(state.sourceFacts, "Filename", sample.fileName);
  expectFact(state.sourceFacts, "Byte length", sample.byteLengthLabel);
  expectFact(state.documentFacts, "Groups", String(expectedSourceGroupCount));
  expectFact(state.documentFacts, "Layers", String(expectedSourceLayerCount));
  expectFact(state.documentFacts, "Visible layers", String(expectedVisibleLayerCount));
  expectFact(state.documentFacts, "Hidden layers", String(expectedHiddenLayerCount));
  expectFact(state.persistenceFacts, "Parser objects", "notPersisted");
  expectFact(state.persistenceFacts, "PSD bytes", "sessionReadOnlyNoRawBytesPersistedByParser");
  expectFact(state.persistenceFacts, "Compositing claim", "none");
  expectFact(state.persistenceFacts, "Pixel oracle claim", "none");
  expectText("diagnostics", state.diagnosticsText, "browserPsdParser.parse.completed");
  for (const leaf of structuralLeaves) {
    expectText("layerTree", state.layerTreeText, leaf.sourceLayerId);
    expectText("layerTree", state.layerTreeText, leaf.displayName);
  }

  if (failures.length > 0) {
    throw new Error(`${label} parsed explicit PSD import assertions failed: ${failures.join("; ")}.`);
  }
};

const assertStructuralScaffoldPreviewState = async (page, sample, label) => {
  const state = await readExplicitPsdImportState(page);
  const selectedApprovedRefs = parseSelectedRefs(state.structuralApprovedRefsControlValue);
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

  expectText("preview", state.structuralPreviewText, "Structural scaffold preview ready");
  expectFactContains(state.structuralPreviewFacts, "Plan id", "plan_");
  expectFactContains(state.structuralPreviewFacts, "Plan digest", "sha256:");
  expectFactContains(state.structuralPreviewFacts, "Approval id", "approval_");
  expectFactContains(state.structuralPreviewFacts, "Approval digest", "sha256:");
  expectFact(state.structuralPreviewFacts, "Approval status", "approved");
  expectFactContains(state.structuralPreviewFacts, "Source", `${sample.sourcePackagePath} / ${sample.byteLengthLabel}`);
  expectFactContains(state.structuralPreviewFacts, "Source digest", `sha256:${sample.sourceDigest}`);
  expectFactContains(state.structuralPreviewFacts, "Scope", importPlanScopeRef);
  expectFact(state.structuralPreviewFacts, "Destination parent part", destinationParentPartId);
  expectFact(
    state.structuralPreviewFacts,
    "Groups / leaves / approved groups / approved leaves",
    `${expectedSourceGroupCount} / ${expectedSourceLayerCount} / ${expectedGeneratedGroupPartCount} / ${structuralLeaves.length}`
  );
  expectFact(
    state.structuralPreviewFacts,
    "Generated group parts / drawables",
    `${expectedGeneratedGroupPartCount} / ${expectedGeneratedDrawableCount}`
  );
  expectFact(
    state.structuralPreviewFacts,
    "Hidden leaves / runtime-hidden drawables",
    `${expectedRuntimeHiddenDrawableCount} / ${expectedRuntimeHiddenDrawableCount}`
  );
  expectFact(state.structuralPreviewFacts, "Approved byte estimate", `${expectedApprovedByteEstimate} bytes`);
  expectText("diagnostics", state.structuralDiagnosticsText, "browserPsdStructuralScaffold.plan.ready");
  for (const group of structuralGroups) {
    expectText("nodes", state.structuralNodesText, group.sourceGroupId);
    expectText("nodes", state.structuralNodesText, group.displayName);
    expectText("nodes", state.structuralNodesText, "runtime=part-container");
    expectText("nodes", state.structuralNodesText, `part=${group.partId}`);
  }
  for (const leaf of structuralLeaves) {
    expectText("nodes", state.structuralNodesText, leaf.sourceLayerId);
    expectText("nodes", state.structuralNodesText, leaf.displayName);
    expectText("nodes", state.structuralNodesText, leaf.fullPathLabel);
    expectText("nodes", state.structuralNodesText, `drawable=${leaf.drawableId}`);
    expectText("nodes", state.structuralNodesText, `texture=${leaf.textureId}`);
    expectText("nodes", state.structuralNodesText, `mesh=${leaf.meshId}`);
    expectText("nodes", state.structuralNodesText, `parent=${leaf.partId}`);
    expectText("nodes", state.structuralNodesText, leaf.initialRuntimeVisibility ? "runtime=visible" : "runtime=hidden");
    expectText("nodes", state.structuralNodesText, "approved=true");
  }
  if (
    JSON.stringify(selectedApprovedRefs) !== JSON.stringify(approvalInputNodeRefs) &&
    JSON.stringify(selectedApprovedRefs) !== JSON.stringify(approvedStructuralNodeRefs) &&
    JSON.stringify(selectedApprovedRefs) !== JSON.stringify(expectedSourceOrderStructuralRefs)
  ) {
    failures.push(`approved refs mismatch: ${JSON.stringify(selectedApprovedRefs)}`);
  }
  if (JSON.stringify(approvalInputNodeRefs) === JSON.stringify(approvedStructuralNodeRefs)) {
    failures.push("approval input refs should be deliberately out of sourceOrder for this regression");
  }
  pushRelativeOrderFailure(failures, state.structuralNodesText, expectedSourceOrderLeafRefs, "structural preview sourceOrder leaf refs");

  if (failures.length > 0) {
    throw new Error(`${label} structural scaffold preview assertions failed: ${failures.join("; ")}.`);
  }
};

const assertStructuralScaffoldCommittedState = async (page, label) => {
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

  expectText("result", state.structuralResultText, "Structural scaffold added to project");
  expectFact(state.structuralResultFacts, "Aggregate status", "success");
  expectFact(state.structuralResultFacts, "Destination parent part", destinationParentPartId);
  expectFact(state.structuralResultFacts, "Generated group parts", String(expectedGeneratedGroupPartCount));
  expectFact(state.structuralResultFacts, "Generated drawables", String(expectedGeneratedDrawableCount));
  expectFact(state.structuralResultFacts, "Runtime-hidden drawables", String(expectedRuntimeHiddenDrawableCount));
  expectFact(state.structuralResultFacts, "Issues", "none");
  for (const group of structuralGroups) {
    expectText("entries", state.structuralEntriesText, "group");
    expectText("entries", state.structuralEntriesText, group.sourceGroupId);
    expectText("entries", state.structuralEntriesText, `part=${group.partId}`);
  }
  for (const leaf of structuralLeaves) {
    expectText("entries", state.structuralEntriesText, "leaf");
    expectText("entries", state.structuralEntriesText, leaf.sourceLayerId);
    expectText("entries", state.structuralEntriesText, `drawable=${leaf.drawableId}`);
    expectText("entries", state.structuralEntriesText, `texture=${leaf.textureId}`);
    expectText("entries", state.structuralEntriesText, `mesh=${leaf.meshId}`);
    expectText("entries", state.structuralEntriesText, `parent=${leaf.partId}`);
    expectText("entries", state.structuralEntriesText, leaf.initialRuntimeVisibility ? "runtime=visible" : "runtime=hidden");
  }
  pushRelativeOrderFailure(failures, state.structuralEntriesText, expectedSourceOrderLeafRefs, "structural result sourceOrder leaf refs");
  expectText("diagnostics", state.structuralResultDiagnosticsText, "editor.psdStructuralScaffold.committed");

  if (failures.length > 0) {
    throw new Error(`${label} structural commit assertions failed: ${failures.join("; ")}.`);
  }
};

const assertSavedProjectIncludesStructuralScaffold = async (page, sample, label) => {
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
    const structuralOperation = operationLogEntries.find(
      (entry) => entry.operationType === "importPsdStructuralScaffold"
    );
    const structuralEvidence =
      structuralOperation?.result?.psdStructuralScaffoldEvidence?.[0] ??
      structuralOperation?.evidence?.psdStructuralScaffoldEvidence?.[0] ??
      structuralOperation?.operationResult?.psdStructuralScaffoldEvidence?.[0] ??
      null;
    const rootPart = graph?.parts?.find((candidate) => candidate.partId === expected.destinationParentPartId);
    const groupParts = expected.groups.map((group) => ({
      sourceGroupId: group.sourceGroupId,
      partId: group.partId,
      part: graph?.parts?.find((candidate) => candidate.partId === group.partId) ?? null
    }));
    const layers = expected.leaves.map((leaf) => {
      const texture = textureAtlas?.textures?.find((candidate) => candidate.textureId === leaf.textureId);
      const drawable = drawables?.drawables?.find((candidate) => candidate.drawableId === leaf.drawableId);
      const mesh = meshes?.meshes?.find((candidate) => candidate.meshId === leaf.meshId);
      const sourceMaterialization = sourceAsset?.psdProfile?.materializationEvidence?.find(
        (candidate) => candidate.sourceLayerRef?.sourceLayerId === leaf.sourceLayerId
      );

      return {
        sourceLayerId: leaf.sourceLayerId,
        texture: texture ?? null,
        drawable: drawable ?? null,
        mesh: mesh ?? null,
        sourceMaterialization: sourceMaterialization ?? null
      };
    });

    return {
      schemaVersion: project.schemaVersion,
      packageId: project.packageSummary?.packageId ?? null,
      packageRevision: project.packageSummary?.packageRevision ?? null,
      serializedProject,
      packageText,
      operationLogJsonl,
      operationTypes: operationLogEntries.map((entry) => entry.operationType),
      sourceAsset: sourceAsset ?? null,
      rootPart: rootPart ?? null,
      groupParts,
      layers,
      structuralOperationJson: structuralOperation === undefined ? "" : JSON.stringify(structuralOperation),
      structuralEvidence
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
    groups: structuralGroups,
    leaves: structuralLeaves
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
    JSON.stringify(stored.operationTypes) === JSON.stringify(expectedOperationTypes),
    `operationTypes=${JSON.stringify(stored.operationTypes)}`
  );
  expect(stored.sourceAsset?.sourceAssetId === sourceAssetId, `sourceAsset=${JSON.stringify(stored.sourceAsset)}`);
  expect(stored.sourceAsset?.filePath === sourcePackagePath, `sourcePath=${JSON.stringify(stored.sourceAsset)}`);
  expect(stored.sourceAsset?.binaryAssetRef == null, "source asset unexpectedly persisted source PSD bytes");
  expect(stored.sourceAsset?.psdProfile?.materializationEvidence?.length === structuralLeaves.length, "source materialization count mismatch");
  for (const group of structuralGroups) {
    const state = stored.groupParts.find((candidate) => candidate.partId === group.partId);
    expect(stored.rootPart?.childPartIds?.includes(group.partId), `root part missing generated group part ${group.partId}`);
    expect(state?.part?.partId === group.partId, `missing generated group part ${group.partId}`);
    expect(state?.part?.parentPartId === destinationParentPartId, `generated group parent mismatch ${group.partId}`);
  }
  expect(stored.rootPart?.drawableIds?.includes(hiddenHeadwearLeaf.drawableId), "root part missing hidden root drawable");
  expect(stored.rootPart?.drawableIds?.includes(structuralLeaves[2].drawableId), "root part missing eyewear root drawable");
  expect(
    indexOrder(stored.rootPart?.drawableIds ?? [], [hiddenHeadwearLeaf.drawableId, structuralLeaves[2].drawableId]) === true,
    `root drawable order mismatch ${JSON.stringify(stored.rootPart?.drawableIds)}`
  );
  expect(
    stored.groupParts.find((candidate) => candidate.partId === hairFrontGroup.partId)?.part?.drawableIds?.includes(frontHairLeaf.drawableId),
    "hair_front group part missing front hair drawable"
  );
  expect(
    stored.groupParts.find((candidate) => candidate.partId === tieGroup.partId)?.part?.drawableIds?.includes(structuralLeaves[3].drawableId),
    "tie group part missing tie drawable"
  );

  for (const leaf of structuralLeaves) {
    const state = stored.layers.find((candidate) => candidate.sourceLayerId === leaf.sourceLayerId) ?? {};
    expect(state.drawable?.drawableId === leaf.drawableId, `missing drawable ${leaf.drawableId}`);
    expect(state.drawable?.partId === leaf.partId, `drawable part mismatch ${leaf.drawableId}`);
    expect(state.drawable?.textureId === leaf.textureId, `drawable texture mismatch ${leaf.drawableId}`);
    expect(state.drawable?.meshId === leaf.meshId, `drawable mesh mismatch ${leaf.drawableId}`);
    expect(state.drawable?.runtimeVisibility === leaf.initialRuntimeVisibility, `runtime visibility mismatch ${leaf.drawableId}`);
    expect(state.mesh?.meshId === leaf.meshId, `missing mesh ${leaf.meshId}`);
    expect(state.texture?.textureId === leaf.textureId, `missing texture ${leaf.textureId}`);
    expect(state.texture?.sourceAssetId === sourceAssetId, `texture source mismatch ${leaf.textureId}`);
    expect(state.texture?.sourceLayerId === leaf.sourceLayerId, `texture layer mismatch ${leaf.textureId}`);
    expect(state.texture?.binaryAssetRef?.binaryAssetId === leaf.binaryAssetId, `texture binary ref mismatch ${leaf.textureId}`);
    expect(state.texture?.binaryAssetRef?.byteLength === leaf.byteLength, `texture byte length mismatch ${leaf.textureId}`);
    expect(state.texture?.binaryAssetRef?.mediaType === materializedMediaType, `texture media type mismatch ${leaf.textureId}`);
    expect(
      String(state.texture?.binaryAssetRef?.packageRelativePath ?? "").startsWith(leaf.texturePathPrefix),
      `texture path prefix mismatch ${leaf.textureId}`
    );
    expect(
      String(state.texture?.binaryAssetRef?.packageRelativePath ?? "").endsWith(".raw-rgba"),
      `texture path suffix mismatch ${leaf.textureId}`
    );
    expect(state.sourceMaterialization?.sourceLayerRef?.sourceLayerId === leaf.sourceLayerId, `source materialization missing ${leaf.sourceLayerId}`);
    expect(state.sourceMaterialization?.byteLength === leaf.byteLength, `source materialization byte mismatch ${leaf.sourceLayerId}`);
    expect(state.sourceMaterialization?.textureId === leaf.textureId, `source materialization texture mismatch ${leaf.sourceLayerId}`);
    expect(state.sourceMaterialization?.binaryAssetRef?.binaryAssetId === leaf.binaryAssetId, `source materialization binary ref mismatch ${leaf.sourceLayerId}`);
    expect(state.sourceMaterialization?.provenance?.publicDemoAsset === false, `publicDemoAsset mismatch ${leaf.sourceLayerId}`);
    expect(state.sourceMaterialization?.provenance?.publicDistribution === "notPublicDistributable", `distribution mismatch ${leaf.sourceLayerId}`);
  }

  const evidence = stored.structuralEvidence;
  expect(stored.structuralOperationJson.includes("psd-structural-scaffold-approval-bridge-evidence-v1"), "missing structural bridge evidence");
  expect(stored.structuralOperationJson.includes("\"publicDemoAsset\":false"), "missing private/local publicDemoAsset=false evidence");
  expect(stored.structuralOperationJson.includes("semanticRecognition"), "missing semanticRecognition boundary");
  expect(stored.structuralOperationJson.includes("repoProposalGeneration"), "missing repoProposalGeneration boundary");
  expect(evidence?.schemaVersion === "psd-structural-scaffold-operation-evidence-v1", "missing structural operation evidence schema");
  expect(evidence?.operationType === "importPsdStructuralScaffold", "structural evidence operation type mismatch");
  expect(evidence?.aggregateStatus === "success", `aggregateStatus=${evidence?.aggregateStatus}`);
  expect(evidence?.destination?.parentPartId === destinationParentPartId, "evidence destination mismatch");
  expect(evidence?.generatedGroupPartScaffolds?.length === expectedGeneratedGroupPartCount, "evidence generated group count mismatch");
  expect(evidence?.generatedLeafScaffolds?.length === structuralLeaves.length, "evidence generated leaf count mismatch");
  expect(
    JSON.stringify(evidence?.generatedLeafScaffolds?.map((leaf) => leaf.sourceLayerRef?.sourceLayerId) ?? []) ===
      JSON.stringify(expectedSourceOrderLeafRefs),
    `evidence generated leaf sourceOrder refs mismatch ${JSON.stringify(evidence?.generatedLeafScaffolds)}`
  );
  expect(
    JSON.stringify(evidence?.generatedLeafScaffolds?.map((leaf) => leaf.sourceOrder) ?? []) ===
      JSON.stringify(structuralLeaves.map((leaf) => leaf.sourceOrder)),
    `evidence generated leaf sourceOrder numbers mismatch ${JSON.stringify(evidence?.generatedLeafScaffolds)}`
  );
  expect(
    JSON.stringify(evidence?.structuralScaffoldBridge?.approval?.approvedLeafScaffolds?.map(
      (leaf) => leaf.sourceLayerRef?.sourceLayerId
    ) ?? []) === JSON.stringify(expectedSourceOrderLeafRefs),
    "approval bridge approved leaves are not sourceOrder-normalized"
  );
  expect(
    JSON.stringify(evidence?.structuralScaffoldBridge?.approval?.approvedLeafScaffolds?.map(
      (leaf) => leaf.sourceOrder
    ) ?? []) === JSON.stringify(structuralLeaves.map((leaf) => leaf.sourceOrder)),
    "approval bridge approved leaf sourceOrder numbers mismatch"
  );
  expect(
    JSON.stringify(evidence?.structuralScaffoldBridge?.approval?.approvedLeafScaffolds?.map(
      (leaf) => leaf.sourceLayerRef?.sourceLayerId
    ) ?? []) !== JSON.stringify(approvalInputNodeRefs),
    "approval bridge unexpectedly preserved approval input order"
  );
  for (const group of evidence?.generatedGroupPartScaffolds ?? []) {
    expect(group.generatedDrawableId === undefined, `group scaffold has drawable claim ${JSON.stringify(group)}`);
    expect(group.generatedTextureId === undefined, `group scaffold has texture claim ${JSON.stringify(group)}`);
    expect(group.generatedMeshId === undefined, `group scaffold has mesh claim ${JSON.stringify(group)}`);
  }
  expect(evidence?.issues?.length === 0, "evidence issues mismatch");
  expect(evidence?.persistenceBoundary?.rawParserObjectPersistence === "notPersisted", "raw parser persistence mismatch");
  expect(evidence?.persistenceBoundary?.sourcePsdBytePersistence === "metadataOnlyNoRawBytes", "source PSD byte persistence mismatch");
  expect(evidence?.persistenceBoundary?.materializedLayerBytePersistence === "binaryAssetRefOnlyNoInlineBytes", "materialized byte persistence mismatch");
  expect(evidence?.persistenceBoundary?.photoshopCompositingClaim === "none", "photoshop compositing claim mismatch");
  expect(evidence?.persistenceBoundary?.rendererPixelOracleClaim === "none", "renderer pixel oracle mismatch");
  expect(evidence?.persistenceBoundary?.initialGridMeshGeneration === "notProvided", "initial grid mesh boundary mismatch");
  expect(evidence?.persistenceBoundary?.semanticRecognition === "notProvided", "semantic recognition boundary mismatch");
  expect(evidence?.persistenceBoundary?.repoProposalGeneration === "notProvided", "repo proposal boundary mismatch");

  const forbiddenSerializedClaims = [
    sample.base64Prefix,
    "\"publicDemoAsset\":true",
    "\"rawParserObject\"",
    "rawRgbaBytes",
    "visualBytes",
    "sourcePsdBytes",
    "currentPsdFile"
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
      `${label} saved project did not preserve Wave50 structural scaffold boundary: ${JSON.stringify({
        failures,
        schemaVersion: stored.schemaVersion,
        packageId: stored.packageId,
        packageRevision: stored.packageRevision,
        operationTypes: stored.operationTypes,
        sourceAsset: stored.sourceAsset,
        rootPart: stored.rootPart,
        groupParts: stored.groupParts,
        structuralEvidence: stored.structuralEvidence
      })}.`
    );
  }
};

const assertExplicitPsdImportClearedAfterLoad = async (page, sample, label) => {
  await assertInitialExplicitPsdImportState(page, label);
  const state = await readExplicitPsdImportState(page);
  const forbiddenLoadedClaims = [
    sample.fileName,
    ...structuralLeaves.map((leaf) => leaf.binaryAssetId),
    "PSD parsed in browser session",
    "browserPsdParser.parse.completed",
    "Structural scaffold added to project"
  ].filter((claim) => state.panelText.includes(claim));

  if (forbiddenLoadedClaims.length > 0) {
    throw new Error(
      `${label} explicit PSD import panel retained session-only structural evidence: ${forbiddenLoadedClaims.join(", ")}.`
    );
  }
};

const assertStructuralProjectStateAfterLoad = async (page, label) => {
  await waitForOperationLogEntryCount(page, 2);
  await waitForText(
    page,
    editorTestIds.operationLogSummary,
    "importPsdSourceAsset, importPsdStructuralScaffold"
  );
  await waitForText(page, editorTestIds.sourceIntakeImportedSources, "1 imported source asset");
  await waitForText(page, editorTestIds.sourceIntakeImportedSources, sourceAssetId);
  await waitForText(page, editorTestIds.sourceIntakeImportedSources, "restored from same-origin browser-local IndexedDB");
  for (const group of structuralGroups) {
    await waitForText(page, createLayerTreePartGroupTestId(group.partId), group.displayName);
    await waitForText(page, createLayerTreePartGroupTestId(group.partId), group.partId);
  }
  for (const leaf of structuralLeaves) {
    await waitForText(
      page,
      createLayerTreeDrawableRowTestId(leaf.drawableId),
      `${leaf.displayName} / ${leaf.drawableId}`
    );
    await waitForText(page, createLayerTreeDrawableRowTestId(leaf.drawableId), leaf.textureId);
    await waitForText(page, createLayerTreeDrawableRowTestId(leaf.drawableId), "Texture resolved");
    await waitForText(
      page,
      createLayerTreeDrawableRowTestId(leaf.drawableId),
      leaf.initialRuntimeVisibility ? "Runtime visible" : "Runtime hidden"
    );
    await waitForText(page, editorTestIds.sourceIntakeImportedSources, `Texture binary ref ${leaf.textureId}`);
    await waitForText(page, editorTestIds.sourceIntakeImportedSources, leaf.binaryAssetId);
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
    panelText.includes("Structural scaffold added to project")
  ) {
    throw new Error(
      `${label} loaded project boundary mismatch: forbiddenPositiveClaims=${forbiddenPositiveClaims.join(
        ", "
      )} importedSources=${importedSourcesText} panel=${panelText}`
    );
  }
};

const runCodexFacingStructuralProjection = async (page, input) => {
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
      throw new Error(`Could not fetch sample PSD for structural Codex projection: HTTP ${response.status}.`);
    }
    const bytes = await response.arrayBuffer();
    const file = new File([bytes], "sample_model.psd", {
      type: "image/vnd.adobe.photoshop"
    });
    const expect = (condition, message) => {
      if (!condition) {
        throw new Error(message);
      }
    };
    const includesInOrder = (values, orderedValues) => {
      let previousIndex = -1;
      for (const value of orderedValues) {
        const index = values.indexOf(value);
        if (index <= previousIndex) {
          return false;
        }
        previousIndex = index;
      }

      return true;
    };
    const makeReadRequest = () => ({
      schemaVersion: "ai-command-request-v1",
      commandId: "cmd_wave50_read_structural_scaffold_state",
      session: {
        agentId: "agent_wave50_structural_e2e",
        capabilities: ["read"]
      },
      basis: {
        packageRevision: workflow.state.revision.packageRevision,
        relatedAC: ["AC-MVP-014"],
        relatedScenarios: ["SC-AGENT-002"]
      },
      command: "getPsdImportPlanState",
      payload: {
        detail: "full"
      }
    });

    await workflow.parseExplicitBrowserPsdImportFile({
      file,
      selectedLayerNodeRef: options.selectedLayerNodeRef
    });
    const preview = await workflow.generateExplicitPsdStructuralScaffoldPreview({
      scopeRef: options.scopeRef,
      approvedNodeRefs: options.approvalInputNodeRefs,
      destinationParentPartId: options.destinationParentPartId
    });
    expect(preview.status === "ready", `structural preview failed: ${JSON.stringify(preview)}`);
    expect(preview.approvedGroupCount === options.expectedGeneratedGroupPartCount, "structural preview group count mismatch");
    expect(preview.approvedLeafCount === options.approvedNodeRefs.length, "structural preview leaf count mismatch");
    expect(
      [options.approvedNodeRefs.join(","), options.expectedSourceOrderStructuralRefs.join(",")].includes(
        preview.approvedNodeRefs.join(",")
      ),
      "structural preview approved refs were not sourceOrder-normalized"
    );

    const commit = await workflow.commitExplicitPsdStructuralScaffold({
      destinationParentPartId: options.destinationParentPartId
    });
    expect(commit.status === "committed", `structural commit failed: ${JSON.stringify(commit)}`);
    const readResponse = await workflow.aiCommandHost.execute(makeReadRequest());
    const projection = readResponse.payload?.result;
    const structural = projection?.structuralScaffold;
    const latest = projection?.latestStructuralScaffold;
    expect(readResponse.status === "ok", `read command failed: ${JSON.stringify(readResponse)}`);
    expect(structural?.status === "ready", "projected structural state missing ready status");
    expect(structural?.sourceDigest === `sha256:${options.sourceDigest}`, "projected structural source digest mismatch");
    expect(structural?.sourceByteLength === options.sourceByteLength, "projected structural source byte length mismatch");
    expect(structural?.scopeRef === options.scopeRef, "projected structural scope mismatch");
    expect(structural?.approvedGroupCount === options.expectedGeneratedGroupPartCount, "projected structural group count mismatch");
    expect(structural?.approvedLeafCount === options.approvedNodeRefs.length, "projected structural leaf count mismatch");
    expect(structural?.hiddenLeafCount === options.expectedRuntimeHiddenDrawableCount, "projected hidden leaf count mismatch");
    expect(structural?.runtimeHiddenDrawableCount === options.expectedRuntimeHiddenDrawableCount, "projected runtime hidden count mismatch");
    expect(structural?.generatedGroupPartCount === options.expectedGeneratedGroupPartCount, "projected generated group count mismatch");
    expect(structural?.generatedDrawableCount === options.approvedNodeRefs.length, "projected generated drawable count mismatch");
    expect(
      [options.approvedNodeRefs.join(","), options.expectedSourceOrderStructuralRefs.join(",")].includes(
        structural?.approvedNodeRefs.join(",")
      ),
      "projected approved refs mismatch"
    );
    expect(
      structural?.approvedNodeRefs.join(",") !== options.approvalInputNodeRefs.join(","),
      "projected approved refs unexpectedly preserved approval input order"
    );
    for (const group of options.groups) {
      const projectedGroup = structural?.groupPartRefs.find(
        (candidate) => candidate.sourceGroupId === group.sourceGroupId
      );
      expect(projectedGroup?.generatedPartId === group.partId, `projected group part ref missing ${group.partId}`);
      expect(projectedGroup?.generatedParentPartId === options.destinationParentPartId, `projected group parent mismatch ${group.partId}`);
    }
    expect(
      includesInOrder(
        structural?.leafDrawableRefs.map((leaf) => leaf.sourceLayerId) ?? [],
        options.approvedNodeRefs
      ),
      "projected structural leaf refs are not sourceOrder-normalized"
    );
    for (const leaf of options.leaves) {
      const projectedLeaf = structural?.leafDrawableRefs.find(
        (candidate) => candidate.sourceLayerId === leaf.sourceLayerId
      );
      expect(projectedLeaf?.sourceOrder === leaf.sourceOrder, `projected sourceOrder mismatch ${leaf.sourceLayerId}`);
      expect(projectedLeaf?.generatedParentPartId === leaf.partId, `projected parent mismatch ${leaf.sourceLayerId}`);
      expect(projectedLeaf?.generatedDrawableId === leaf.drawableId, `projected drawable mismatch ${leaf.sourceLayerId}`);
      expect(projectedLeaf?.generatedTextureId === leaf.textureId, `projected texture mismatch ${leaf.sourceLayerId}`);
      expect(projectedLeaf?.generatedMeshId === leaf.meshId, `projected mesh mismatch ${leaf.sourceLayerId}`);
      expect(projectedLeaf?.initialRuntimeVisibility === leaf.initialRuntimeVisibility, `projected runtime visibility mismatch ${leaf.sourceLayerId}`);
    }
    expect(latest?.status === "committed", `latest structural status mismatch: ${JSON.stringify(latest)}`);
    expect(
      latest?.operationStatus === undefined || latest.operationStatus === "committed",
      `latest structural operation status mismatch: ${JSON.stringify(latest)}`
    );
    expect(
      latest?.aggregateStatus === undefined || latest.aggregateStatus === "success",
      `latest structural aggregate status mismatch: ${JSON.stringify(latest)}`
    );
    expect(
      includesInOrder(latest?.approvedNodeRefs ?? [], options.approvedNodeRefs),
      `latest structural approved refs mismatch: ${JSON.stringify(latest)}`
    );
    expect(
      latest?.approvedNodeRefs.join(",") !== options.approvalInputNodeRefs.join(","),
      `latest structural approved refs unexpectedly preserved input order: ${JSON.stringify(latest)}`
    );
    for (const group of options.groups) {
      const latestGroup = latest?.generatedGroupPartRefs.find(
        (candidate) => candidate.sourceGroupId === group.sourceGroupId
      );
      expect(latestGroup?.generatedPartId === group.partId, `latest group ref missing ${group.partId}: ${JSON.stringify(latest)}`);
      expect(
        latestGroup?.generatedParentPartId === options.destinationParentPartId,
        `latest group parent mismatch ${group.partId}: ${JSON.stringify(latest)}`
      );
    }
    expect(
      includesInOrder(
        latest?.generatedLeafDrawableRefs.map((leaf) => leaf.sourceLayerId) ?? [],
        options.approvedNodeRefs
      ),
      `latest structural leaf refs are not sourceOrder-normalized: ${JSON.stringify(latest)}`
    );
    for (const leaf of options.leaves) {
      const latestLeaf = latest?.generatedLeafDrawableRefs.find(
        (candidate) => candidate.sourceLayerId === leaf.sourceLayerId
      );
      expect(latestLeaf?.sourceOrder === leaf.sourceOrder, `latest leaf sourceOrder mismatch ${leaf.sourceLayerId}: ${JSON.stringify(latest)}`);
      expect(latestLeaf?.generatedParentPartId === leaf.partId, `latest leaf parent mismatch ${leaf.sourceLayerId}: ${JSON.stringify(latest)}`);
      expect(latestLeaf?.generatedDrawableId === leaf.drawableId, `latest leaf drawable mismatch ${leaf.sourceLayerId}: ${JSON.stringify(latest)}`);
      expect(latestLeaf?.generatedTextureId === leaf.textureId, `latest leaf texture mismatch ${leaf.sourceLayerId}: ${JSON.stringify(latest)}`);
      expect(latestLeaf?.generatedMeshId === leaf.meshId, `latest leaf mesh mismatch ${leaf.sourceLayerId}: ${JSON.stringify(latest)}`);
      expect(
        latestLeaf?.initialRuntimeVisibility === leaf.initialRuntimeVisibility,
        `latest leaf runtime visibility mismatch ${leaf.sourceLayerId}: ${JSON.stringify(latest)}`
      );
    }

    const saveResult = workflow.saveProject();
    expect(saveResult.status === "saved", "structural workflow save failed");
    const loadResult = await workflow.loadProjectWithPersistentBytes();
    expect(loadResult.status === "loaded", "structural workflow load failed");
    for (const group of options.groups) {
      expect(
        workflow.state.parts.some((part) => part.partId === group.partId),
        `loaded workflow missing structural group part ${group.partId}`
      );
    }
    for (const leaf of options.leaves) {
      const loadedDrawable = workflow.state.drawables.find(
        (drawable) => drawable.drawableId === leaf.drawableId
      );
      const loadedRuntimeVisibility =
        loadedDrawable?.runtimeVisibility ?? loadedDrawable?.visible ?? loadedDrawable?.runtimeVisible;
      expect(
        loadedDrawable !== undefined,
        `loaded workflow missing structural drawable ${leaf.drawableId}`
      );
      expect(
        loadedRuntimeVisibility === leaf.initialRuntimeVisibility,
        `loaded workflow runtime visibility mismatch ${leaf.drawableId}: ${JSON.stringify(loadedDrawable)}`
      );
    }

    return {
      readStatus: readResponse.status,
      structuralPlanId: structural.structuralPlanId,
      latestStatus: latest.status,
      latestShape: {
        hasOperationStatus: latest.operationStatus !== undefined,
        hasAggregateStatus: latest.aggregateStatus !== undefined,
        generatedGroupPartRefCount: latest.generatedGroupPartRefs.length,
        generatedLeafDrawableRefCount: latest.generatedLeafDrawableRefs.length
      },
      projectedApprovedNodeRefs: structural.approvedNodeRefs,
      latestApprovedNodeRefs: latest.approvedNodeRefs,
      projectedLeafRefs: structural.leafDrawableRefs.map((leaf) => leaf.sourceLayerId),
      latestLeafRefs: latest.generatedLeafDrawableRefs.map((leaf) => leaf.sourceLayerId),
      staleRejectionPath: "psdImportPlanCodexFocused",
      transcript: workflow.aiCommandHost.transcript.entries.map((entry) => ({
        commandId: entry.commandId,
        command: entry.command,
        status: entry.status
      }))
    };
  }, {
    storageKey: codexWorkflowStorageKey,
    sampleAbsolutePath: input.sampleAbsolutePath,
    sourceDigest: input.sourceDigest,
    sourceByteLength: input.sourceByteLength,
    scopeRef: importPlanScopeRef,
    destinationParentPartId,
    selectedLayerNodeRef: frontHairLeaf.sourceLayerId,
    approvalInputNodeRefs,
    approvedNodeRefs: approvedStructuralNodeRefs,
    expectedSourceOrderStructuralRefs,
    expectedGeneratedGroupPartCount,
    expectedRuntimeHiddenDrawableCount,
    groups: structuralGroups,
    leaves: structuralLeaves.map((leaf) => ({
      sourceLayerId: leaf.sourceLayerId,
      sourceOrder: leaf.sourceOrder,
      partId: leaf.partId,
      drawableId: leaf.drawableId,
      textureId: leaf.textureId,
      meshId: leaf.meshId,
      initialRuntimeVisibility: leaf.initialRuntimeVisibility
    }))
  });

  if (
    result?.readStatus !== "ok" ||
    typeof result.structuralPlanId !== "string" ||
    result.latestStatus !== "committed" ||
    ![
      JSON.stringify(approvedStructuralNodeRefs),
      JSON.stringify(expectedSourceOrderStructuralRefs)
    ].includes(JSON.stringify(result.projectedApprovedNodeRefs)) ||
    indexOrder(result.latestApprovedNodeRefs, approvedStructuralNodeRefs) !== true ||
    indexOrder(result.projectedLeafRefs, approvedStructuralNodeRefs) !== true ||
    indexOrder(result.latestLeafRefs, approvedStructuralNodeRefs) !== true ||
    result.staleRejectionPath !== "psdImportPlanCodexFocused" ||
    !Array.isArray(result.transcript) ||
    result.transcript.some((entry) => entry.command !== "getPsdImportPlanState") !== false
  ) {
    throw new Error(`Codex-facing structural scaffold projection result mismatch: ${JSON.stringify(result)}.`);
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

const setStructuralScaffoldPreviewInputs = async (page, input) => {
  await page.evaluate((ids, value) => {
    const scope = document.querySelector(`[data-testid="${ids.scopeRef}"]`);
    const approvedRefs = document.querySelector(`[data-testid="${ids.approvedRefs}"]`);
    const form = document.querySelector(`[data-testid="${ids.form}"]`);
    const parentPart = form?.querySelector('select[name="structuralScaffoldDestinationParentPartId"]');

    if (!(scope instanceof HTMLInputElement)) {
      throw new Error("Missing structural scaffold scope input.");
    }
    if (!(approvedRefs instanceof HTMLTextAreaElement)) {
      throw new Error("Missing structural scaffold approved refs textarea.");
    }
    if (!(parentPart instanceof HTMLSelectElement)) {
      throw new Error("Missing structural scaffold destination parent select.");
    }

    scope.value = value.scopeRef;
    approvedRefs.value = value.approvedNodeRefs.join("\n");
    parentPart.value = value.destinationParentPartId;
    scope.dispatchEvent(new Event("input", { bubbles: true }));
    scope.dispatchEvent(new Event("change", { bubbles: true }));
    approvedRefs.dispatchEvent(new Event("input", { bubbles: true }));
    approvedRefs.dispatchEvent(new Event("change", { bubbles: true }));
    parentPart.dispatchEvent(new Event("input", { bubbles: true }));
    parentPart.dispatchEvent(new Event("change", { bubbles: true }));
  }, {
    form: editorTestIds.explicitPsdStructuralScaffoldForm,
    scopeRef: editorTestIds.explicitPsdStructuralScaffoldScopeRef,
    approvedRefs: editorTestIds.explicitPsdStructuralScaffoldApprovedRefs
  }, input);
};

const setStructuralScaffoldApprovedRefs = async (page, refs) => {
  await page.evaluate((id, value) => {
    const approvedRefs = document.querySelector(`[data-testid="${id}"]`);

    if (!(approvedRefs instanceof HTMLTextAreaElement)) {
      throw new Error("Missing structural scaffold approved refs textarea.");
    }

    approvedRefs.value = value.join("\n");
    approvedRefs.dispatchEvent(new Event("input", { bubbles: true }));
    approvedRefs.dispatchEvent(new Event("change", { bubbles: true }));
  }, editorTestIds.explicitPsdStructuralScaffoldApprovedRefs, refs);
};

const setApprovedStructuralScaffoldDestinationParentPart = async (page, parentPartId) => {
  await page.evaluate((formId, value) => {
    const form = document.querySelector(`[data-testid="${formId}"]`);
    const select = form?.querySelector('select[name="structuralScaffoldApprovedDestinationParentPartId"]');

    if (!(select instanceof HTMLSelectElement)) {
      throw new Error("Missing approved structural scaffold destination parent part select.");
    }

    select.value = value;
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }, editorTestIds.explicitPsdStructuralScaffoldApprovedForm, parentPartId);
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
    const structuralScopeRefControl = document.querySelector(`[data-testid="${ids.structuralScopeRef}"]`);
    const structuralApprovedRefsControl = document.querySelector(`[data-testid="${ids.structuralApprovedRefs}"]`);

    return {
      panelText: readText(ids.panel),
      statusText: readText(ids.status),
      sourceFacts: readFacts(ids.source),
      documentFacts: readFacts(ids.document),
      featureSupportText: readText(ids.featureSupport),
      layerTreeText: readText(ids.layerTree),
      persistenceFacts: readFacts(ids.persistence),
      diagnosticsText: readText(ids.diagnostics),
      structuralPreviewText: readText(ids.structuralPreview),
      structuralPreviewFacts: readFacts(ids.structuralPreview),
      structuralNodesText: readText(ids.structuralNodes),
      structuralDiagnosticsText: readText(ids.structuralDiagnostics),
      structuralResultText: readText(ids.structuralResult),
      structuralResultFacts: readFacts(ids.structuralResult),
      structuralEntriesText: readText(ids.structuralEntries),
      structuralResultDiagnosticsText: readText(ids.structuralResultDiagnostics),
      selectedLayerControlValue:
        selectedLayerControl instanceof HTMLInputElement ? selectedLayerControl.value : null,
      structuralScopeRefControlValue:
        structuralScopeRefControl instanceof HTMLInputElement ? structuralScopeRefControl.value : null,
      structuralApprovedRefsControlValue:
        structuralApprovedRefsControl instanceof HTMLTextAreaElement ? structuralApprovedRefsControl.value : null
    };
  }, {
    panel: editorTestIds.explicitPsdImportPanel,
    status: editorTestIds.explicitPsdImportStatus,
    source: editorTestIds.explicitPsdImportSource,
    document: editorTestIds.explicitPsdImportDocument,
    featureSupport: editorTestIds.explicitPsdImportFeatureSupport,
    layerTree: editorTestIds.explicitPsdImportLayerTree,
    persistence: editorTestIds.explicitPsdImportPersistence,
    diagnostics: editorTestIds.explicitPsdImportDiagnostics,
    structuralPreview: editorTestIds.explicitPsdStructuralScaffoldPreview,
    structuralNodes: editorTestIds.explicitPsdStructuralScaffoldNodes,
    structuralDiagnostics: editorTestIds.explicitPsdStructuralScaffoldDiagnostics,
    structuralResult: editorTestIds.explicitPsdStructuralScaffoldResult,
    structuralEntries: editorTestIds.explicitPsdStructuralScaffoldEntries,
    structuralResultDiagnostics: editorTestIds.explicitPsdStructuralScaffoldResultDiagnostics,
    selectedLayer: editorTestIds.explicitPsdImportSelectedLayerNodeRef,
    structuralScopeRef: editorTestIds.explicitPsdStructuralScaffoldScopeRef,
    structuralApprovedRefs: editorTestIds.explicitPsdStructuralScaffoldApprovedRefs
  });

const assertExplicitPsdImportReachable = async (page, viewport) => {
  const metrics = await page.evaluate((ids) => {
    const panel = document.querySelector(`[data-testid="${ids.panel}"]`);
    const form = document.querySelector(`[data-testid="${ids.form}"]`);
    const fileInput = document.querySelector(`[data-testid="${ids.fileInput}"]`);
    const submit = document.querySelector(`[data-testid="${ids.submit}"]`);
    const structuralSubmit = document.querySelector(`[data-testid="${ids.structuralSubmit}"]`);

    if (
      !(panel instanceof HTMLElement) ||
      !(form instanceof HTMLFormElement) ||
      !(fileInput instanceof HTMLInputElement) ||
      !(submit instanceof HTMLButtonElement) ||
      !(structuralSubmit instanceof HTMLButtonElement)
    ) {
      return {
        ok: false,
        reason: "missing required PSD import controls"
      };
    }

    const panelBox = panel.getBoundingClientRect();
    const submitBox = submit.getBoundingClientRect();
    const structuralBox = structuralSubmit.getBoundingClientRect();

    return {
      ok: true,
      panelWidth: panelBox.width,
      panelHeight: panelBox.height,
      submitVisible: submitBox.width > 0 && submitBox.height > 0,
      structuralSubmitVisible: structuralBox.width > 0 && structuralBox.height > 0
    };
  }, {
    panel: editorTestIds.explicitPsdImportPanel,
    form: editorTestIds.explicitPsdImportForm,
    fileInput: editorTestIds.explicitPsdImportFileInput,
    submit: editorTestIds.explicitPsdImportSubmit,
    structuralSubmit: editorTestIds.explicitPsdStructuralScaffoldSubmit
  });

  if (
    metrics.ok !== true ||
    metrics.panelWidth <= 0 ||
    metrics.panelHeight <= 0 ||
    metrics.submitVisible !== true ||
    metrics.structuralSubmitVisible !== true
  ) {
    throw new Error(`${viewport.name} explicit PSD structural scaffold controls are not reachable: ${JSON.stringify(metrics)}.`);
  }
};

const readText = async (page, testId) =>
  page.evaluate((id) => document.querySelector(`[data-testid="${id}"]`)?.textContent ?? "", testId);

const parseSelectedRefs = (value) =>
  String(value ?? "")
    .split(/[\s,]+/g)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

const indexOrder = (values, orderedValues) => {
  let previousIndex = -1;
  for (const value of orderedValues) {
    const index = values.indexOf(value);
    if (index <= previousIndex) {
      return false;
    }
    previousIndex = index;
  }

  return true;
};

const pushRelativeOrderFailure = (failures, text, orderedTokens, label) => {
  let previousIndex = -1;
  for (const token of orderedTokens) {
    const index = String(text).indexOf(token);
    if (index === -1) {
      failures.push(`${label} missing ${token}`);
      return;
    }
    if (index <= previousIndex) {
      failures.push(`${label} order mismatch for ${token}`);
      return;
    }
    previousIndex = index;
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
        label: "source PSD bytes persisted",
        pattern: /\bsource PSD bytes\s+(?:are\s+)?persisted\b/gi
      },
      {
        label: "raw parser object persisted",
        pattern: /\braw parser object\s+(?:is\s+)?persisted\b/gi
      },
      {
        label: "semantic recognition",
        pattern: /\bsemantic recognition\b/gi
      },
      {
        label: "repo proposal generation",
        pattern: /\brepo proposal generation\b/gi
      },
      {
        label: "initial grid mesh generation",
        pattern: /\binitial grid mesh generation\b/gi
      },
      {
        label: "photoshop compositing",
        pattern: /\bphotoshop compositing\b/gi
      }
    ];
    const unsupportedScopeClaimPatterns = [
      {
        label: "Cubism compatibility",
        pattern: /\bCubism compatibility\b/gi
      }
    ];
    const isNegatedAt = (index) => {
      const prefix = text.slice(Math.max(0, index - 48), index).toLowerCase();
      const directNegationPattern = /\b(?:not|no|never|without)\s+(?:a\s+|an\s+)?$/;
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
      `${label} explicit PSD structural scaffold UI made an unsupported claim (${evidence.forbiddenClaim}): ${evidence.text}`
    );
  }
};

const assertFixtureDocsRegistration = async () => {
  const fixtureManifest = await readFile(fixtureManifestUrl, "utf8");
  const traceabilityMatrix = await readFile(traceabilityMatrixUrl, "utf8");
  const requiredManifestTokens = [
    "wave50-psd-structural-initial-state-focused-e2e-regression",
    "TC-WAVE50-PSD-STRUCTURAL-INITIAL-STATE-E2E-001",
    "apps/editor/e2e/psd-structural-initial-state-focused-smoke.mjs",
    "scripts/run-focused-e2e.mjs --id psdStructuralInitialStateFocused",
    "explicit structural scaffold approval",
    "psd:root/group[6]/layer[0]",
    "psd:root/layer[3]",
    "sourceOrder-derived refs",
    "groupsAsPartContainersOnly",
    "part_tie_group_psd_root_group_6_structural",
    "runtimeHiddenDrawableCount=1",
    "materializedBytes=2344760",
    "stale approval-context rejection",
    "publicDemoAsset=false"
  ];
  const requiredTraceabilityTokens = [
    "TC-WAVE50-PSD-STRUCTURAL-INITIAL-STATE-E2E-001",
    "wave50-psd-structural-initial-state-focused-e2e-regression",
    "psdStructuralInitialStateFocused",
    "psd:root/group[6]/layer[0]",
    "sourceOrder-derived structural refs",
    "browserPsdStructuralScaffold.plan.ready",
    "psd-structural-scaffold-approval-bridge-evidence-v1",
    "groupsAsPartContainersOnly",
    "materialized texture refs totaling `2344760` bytes",
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
    throw new Error(`Wave50 PSD structural scaffold fixture/traceability registration missing: ${missing.join(", ")}.`);
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
      `psd-structural-initial-state-focused-e2e: using ${browser.executable} (${browser.source}); server ${
        server.baseUrl
      } ${server.reused ? "reused" : "started"}`
    );

    launchedBrowser = await launchHeadlessBrowser({ executable: browser.executable });

    for (const viewport of psdStructuralInitialStateFocusedSmokeViewports) {
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

        const result = await runPsdStructuralInitialStateFocusedSmoke({ page, viewport });
        console.log(
          `psd-structural-initial-state-focused-e2e: ${viewport.name} passed byteLength=${result.byteLength} scope=${result.scopeRef} inputApproval=${result.approvalInputNodeRefs.join(",")} sourceOrderApproved=${result.approvedNodeRefs.join(",")} groups=${result.generatedGroupPartIds.join(",")} runtimeHidden=${result.runtimeHiddenDrawableId} codex=${result.codexStatus}`
        );
        console.log(
          `psd-structural-initial-state-focused-e2e: ${viewport.name} screenshot ${result.screenshot.format} base64Length=${result.screenshot.base64Length}`
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
    console.log("psd-structural-initial-state-focused-e2e: smoke passed");
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
