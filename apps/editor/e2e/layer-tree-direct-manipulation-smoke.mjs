import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { locateBrowserExecutable } from "./browser-discovery.mjs";
import { launchHeadlessBrowser } from "./chrome-launcher.mjs";
import { createPageSession } from "./page-session.mjs";
import {
  createLayerTreeDrawablePartDraftFormTestId,
  createLayerTreeDrawablePartDraftSubmitTestId,
  createLayerTreeDrawableRowTestId,
  createLayerTreeDrawableTextureDraftFormTestId,
  createLayerTreeDrawableTextureDraftSubmitTestId,
  createLayerTreeEmptyLeafDeleteDraftTestId,
  createLayerTreePartGroupTestId,
  createLayerTreePartRenameFormTestId,
  createLayerTreePartRenameSubmitTestId,
  createLayerTreePartReparentFormTestId,
  createLayerTreePartReparentSubmitTestId,
  editorProjectStorageKey,
  editorTestIds
} from "./test-ids.mjs";
import { startOrReuseEditorServer } from "./vite-server.mjs";

export const layerTreeDirectManipulationSmokeViewports = [
  {
    name: "desktop",
    width: 1280,
    height: 900,
    isMobile: false
  },
  {
    name: "mobile",
    width: 390,
    height: 844,
    isMobile: true
  }
];

const smoke = {
  packageId: "pkg_editor_browser_sample",
  rootPartId: "part_root",
  parentDisplayName: "Wave 33 Parent",
  parentPartId: "part_wave_33_parent",
  headDisplayName: "Wave 33 Head",
  headPartId: "part_wave_33_head",
  renamedHeadDisplayName: "Wave 33 Head Renamed",
  emptyDisplayName: "Wave 33 Empty",
  emptyPartId: "part_wave_33_empty",
  pendingDisplayName: "Wave 33 Pending Delete",
  pendingPartId: "part_wave_33_pending_delete",
  drawableId: "draw_body",
  drawableDisplayName: "Body",
  textureId: "tex_wave33"
};

const textureSeed = {
  sourceAssetId: "src_w33",
  sourceLayerId: "layer_w33",
  textureId: smoke.textureId,
  previewAssetId: "preview_src_w33_layer_w33",
  texturePreviewReference: "assets/thumbnails/wave33-head.preview.png",
  manifestPath: "assets/sources/w33.psd",
  contentHash: "metadata:w33-texture-seed",
  adapterName: "w33-texture-seed-profile",
  creator: "Wave33 E2E Texture Seed",
  license: "internal-test-fixture",
  sourceUrl: "https://example.invalid/private-2d-rigging-lab/w33-texture-seed",
  notes:
    "Metadata-only texture atlas seed; no PSD bytes, file picker, parser, image decode, or real image bytes.",
  bounds: {
    x: 24,
    y: 16,
    width: 48,
    height: 64
  }
};

export const runLayerTreeDirectManipulationSmoke = async ({ page, viewport }) => {
  await waitForTestId(page, editorTestIds.layerTreePanel);
  await waitForText(page, editorTestIds.layerTreeSummary, "1 part group / 1 drawable");
  await waitForText(page, editorTestIds.layerTreeSummary, "1 missing texture");
  await assertNoHorizontalOverflow(page, `${viewport.name} wave33 initial`);

  const textureSeedEvidence = await seedTextureAtlasEntry(page);
  await createPart(page, {
    displayName: smoke.parentDisplayName,
    partId: smoke.parentPartId,
    parentPartId: smoke.rootPartId,
    expectedOperationLogEntryCount: 2
  });
  await createPart(page, {
    displayName: smoke.headDisplayName,
    partId: smoke.headPartId,
    parentPartId: smoke.rootPartId,
    expectedOperationLogEntryCount: 3
  });
  await createPart(page, {
    displayName: smoke.emptyDisplayName,
    partId: smoke.emptyPartId,
    parentPartId: smoke.rootPartId,
    expectedOperationLogEntryCount: 4
  });
  await assertCreatedLayerTreeState(page);

  await draftPassPathDirectManipulations(page);
  await commitPassPathDirectManipulations(page);
  await assertPassPathLayerTreeState(page);
  await assertPreviewSemanticEvidence(page);
  await clickTestId(page, editorTestIds.viewerRuntimeOpen);
  await assertViewerSemanticEvidence(page);
  const preSaveEvidence = await readSemanticEvidence(page);

  await clickTestId(page, editorTestIds.projectPersistenceSave);
  await waitForText(page, editorTestIds.projectPersistenceStatus, "Saved");
  await assertSavedLayerTreeProject(page, "after save");

  await page.reload();
  await waitForTestId(page, editorTestIds.shell);
  await clickTestId(page, editorTestIds.projectPersistenceLoad);
  await waitForText(page, editorTestIds.projectPersistenceStatus, "Loaded");
  await assertLoadedLayerTreeState(page);
  await assertSavedLayerTreeProject(page, "after load");
  await assertPreviewSemanticEvidence(page);
  await clickTestId(page, editorTestIds.viewerRuntimeOpen);
  await assertViewerSemanticEvidence(page);
  await assertNoHorizontalOverflow(page, `${viewport.name} wave33 loaded`);
  const postLoadEvidence = await readSemanticEvidence(page);

  await resetBrowserProject(page);
  const pendingDeletePreflightEvidence = await runPendingDeletePreflightSmoke(page);
  const screenshot = await page.captureScreenshot(`${viewport.name} wave33 layer tree direct smoke`);

  return {
    viewport: viewport.name,
    textureSeedEvidence,
    partIds: [smoke.parentPartId, smoke.headPartId, smoke.emptyPartId],
    drawableId: smoke.drawableId,
    textureId: smoke.textureId,
    preSaveEvidence,
    postLoadEvidence,
    pendingDeletePreflightEvidence,
    screenshot
  };
};

const seedTextureAtlasEntry = async (page) => {
  await waitForTestId(page, editorTestIds.sourceIntakeForm);
  await page.evaluate((ids, values) => {
    const form = document.querySelector(`[data-testid="${ids.form}"]`);

    if (!(form instanceof HTMLFormElement)) {
      throw new Error("Source intake form was missing.");
    }

    const setValue = (name, value) => {
      const control = form.elements.namedItem(name);

      if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement)) {
        throw new Error(`Missing source intake field ${name}.`);
      }

      control.value = String(value);
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.dispatchEvent(new Event("change", { bubbles: true }));
    };
    const setChecked = (name, checked) => {
      const control = form.elements.namedItem(name);

      if (!(control instanceof HTMLInputElement)) {
        throw new Error(`Missing source intake checkbox ${name}.`);
      }

      control.checked = checked;
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.dispatchEvent(new Event("change", { bubbles: true }));
    };

    setValue("intakeMode", "psdAdapterProfile");
    setValue("manifestPath", values.manifestPath);
    setValue("sourceAssetId", values.sourceAssetId);
    setValue("contentHash", values.contentHash);
    setValue("psdAdapterName", values.adapterName);
    setValue("psdCanvasWidth", 128);
    setValue("psdCanvasHeight", 128);
    setValue("defaultPartId", "part_root");
    setValue("placementPolicy", "use-metadata");
    setValue("rightsStatus", "cleared");
    setValue("creator", values.creator);
    setValue("license", values.license);
    setValue("sourceUrl", values.sourceUrl);
    setValue("notes", values.notes);
    setChecked("redistributionAllowed", false);
    setChecked("aiUsed", false);
    setValue("sourceLayerId.0", values.sourceLayerId);
    setValue("originalName.0", "Wave33 Texture");
    setValue("normalizedName.0", "wave33_texture");
    setValue("groupPath.0", "Root");
    setValue("texturePreviewReference.0", values.texturePreviewReference);
    setValue("textureId.0", values.textureId);
    setValue("targetPartId.0", "part_root");
    setValue("x.0", values.bounds.x);
    setValue("y.0", values.bounds.y);
    setValue("width.0", values.bounds.width);
    setValue("height.0", values.bounds.height);
    setValue("opacityInSource.0", 1);
    setValue("role.0", "editableLayer");
    setChecked("visibleInSource.0", true);
    setValue("unsupportedFeatures.0", "");
  }, {
    form: editorTestIds.sourceIntakeForm
  }, textureSeed);

  await clickTestId(page, editorTestIds.sourceIntakeSubmit);
  await waitForText(page, editorTestIds.operationStatus, "importPsdSourceAsset committed");
  await waitForOperationLogEntryCount(page, 1);
  await waitForText(page, editorTestIds.operationLogSummary, "importPsdSourceAsset");
  await waitForText(page, editorTestIds.layerTreeAssignTextureForm, textureSeed.textureId);

  return {
    sourceAssetId: textureSeed.sourceAssetId,
    sourceLayerId: textureSeed.sourceLayerId,
    textureId: textureSeed.textureId,
    previewAssetId: textureSeed.previewAssetId,
    texturePreviewReference: textureSeed.texturePreviewReference
  };
};

const createPart = async (
  page,
  { displayName, partId, parentPartId, expectedOperationLogEntryCount }
) => {
  await setCreatePartFormValues(page, { displayName, parentPartId });
  await clickTestId(page, editorTestIds.layerTreeCreatePartSubmit);
  await waitForText(page, editorTestIds.operationStatus, "createPart committed");
  await waitForOperationLogEntryCount(page, expectedOperationLogEntryCount);
  await waitForText(page, createLayerTreePartGroupTestId(partId), `${displayName} / ${partId}`);
};

const assertCreatedLayerTreeState = async (page) => {
  await waitForText(page, editorTestIds.operationLogSummary, "importPsdSourceAsset, createPart");
  await waitForText(page, editorTestIds.layerTreeSummary, "4 part groups / 1 drawable");
  await waitForText(page, editorTestIds.layerTreeSummary, "1 missing texture");
  await waitForText(page, createLayerTreePartGroupTestId(smoke.rootPartId), "1 drawable");
  await waitForText(page, createLayerTreePartGroupTestId(smoke.parentPartId), "No drawables in this part.");
  await waitForText(page, createLayerTreePartGroupTestId(smoke.headPartId), "No drawables in this part.");
  await waitForText(page, createLayerTreePartGroupTestId(smoke.emptyPartId), "No drawables in this part.");
};

const draftPassPathDirectManipulations = async (page) => {
  await setFormInputValue(
    page,
    createLayerTreePartRenameFormTestId(smoke.headPartId),
    smoke.renamedHeadDisplayName
  );
  await clickTestId(page, createLayerTreePartRenameSubmitTestId(smoke.headPartId));
  await waitForText(page, createLayerTreePartGroupTestId(smoke.headPartId), "Rename draft: Wave 33 Head Renamed");

  await setFormSelectValues(page, createLayerTreePartReparentFormTestId(smoke.headPartId), [
    smoke.parentPartId
  ]);
  await clickTestId(page, createLayerTreePartReparentSubmitTestId(smoke.headPartId));
  await waitForText(page, createLayerTreePartGroupTestId(smoke.headPartId), "Parent draft: Wave 33 Parent");

  await setFormSelectValues(page, createLayerTreeDrawablePartDraftFormTestId(smoke.drawableId), [
    smoke.headPartId
  ]);
  await clickTestId(page, createLayerTreeDrawablePartDraftSubmitTestId(smoke.drawableId));
  await waitForText(page, createLayerTreeDrawableRowTestId(smoke.drawableId), "Part draft: Wave 33 Head");

  await setFormSelectValues(page, createLayerTreeDrawableTextureDraftFormTestId(smoke.drawableId), [
    smoke.textureId
  ]);
  await clickTestId(page, createLayerTreeDrawableTextureDraftSubmitTestId(smoke.drawableId));
  await waitForText(page, createLayerTreeDrawableRowTestId(smoke.drawableId), "Texture draft: tex_wave33");

  await clickTestId(page, createLayerTreeEmptyLeafDeleteDraftTestId(smoke.emptyPartId));
  await waitForText(page, createLayerTreePartGroupTestId(smoke.emptyPartId), "Empty-leaf delete draft pending");
  await waitForText(page, editorTestIds.layerTreePanel, "5 direct drafts");
};

const commitPassPathDirectManipulations = async (page) => {
  await clickTestId(page, editorTestIds.layerTreeDirectDraftCommit);
  await waitForText(page, editorTestIds.operationStatus, "deletePart committed");
  await waitForOperationLogEntryCount(page, 8);
  await waitForText(
    page,
    editorTestIds.operationLogSummary,
    "importPsdSourceAsset, createPart, updatePart, setDrawablePart, setDrawableTexture, deletePart"
  );
  await waitForText(page, editorTestIds.layerTreePanel, "No direct manipulation drafts");
};

const assertPassPathLayerTreeState = async (page) => {
  await waitForText(page, editorTestIds.layerTreeSummary, "3 part groups / 1 drawable");
  await waitForText(page, editorTestIds.layerTreeSummary, "0 missing texture");
  await assertElementAbsent(page, createLayerTreePartGroupTestId(smoke.emptyPartId));
  await waitForText(
    page,
    createLayerTreePartGroupTestId(smoke.headPartId),
    `${smoke.renamedHeadDisplayName} / ${smoke.headPartId}`
  );
  await waitForText(page, createLayerTreePartGroupTestId(smoke.headPartId), "1 drawable");
  await waitForText(page, createLayerTreeDrawableRowTestId(smoke.drawableId), smoke.textureId);
  await waitForText(page, createLayerTreeDrawableRowTestId(smoke.drawableId), "Texture resolved");
  await waitForText(page, createLayerTreePartGroupTestId(smoke.parentPartId), "Part has child parts");
  await assertButtonDisabled(page, createLayerTreeEmptyLeafDeleteDraftTestId(smoke.parentPartId), true);
};

const assertPreviewSemanticEvidence = async (page) => {
  await waitForText(page, editorTestIds.previewSummary, "1 visible / 1 total");
  await waitForText(page, editorTestIds.previewSummary, "3 part groups / 1 drawable memberships");
  await waitForText(
    page,
    editorTestIds.previewSummary,
    "0 selected / 0 locked / 0 editor-hidden / 0 texture unresolved / 1 texture-backed"
  );
  await waitForText(page, editorTestIds.previewSummary, "0 pattern / 1 fallback");
  await waitForText(page, editorTestIds.previewSummary, "1 package-local unavailable");
  await waitForText(page, editorTestIds.previewSummary, "0 error / 0 warning");

  const visualState = await page.evaluate((ids, expected) => {
    const visual = document.querySelector(`[data-testid="${ids.visual}"]`);
    const drawable = visual?.querySelector(`[data-drawable-id="${expected.drawableId}"]`);

    return {
      visualAriaLabel: visual?.getAttribute("aria-label") ?? "",
      textureStatus: drawable?.getAttribute("data-texture-status") ?? null,
      textureRender: drawable?.getAttribute("data-texture-render") ?? null,
      textureId: drawable?.getAttribute("data-texture-id") ?? null,
      previewAssetId: drawable?.getAttribute("data-texture-preview-asset-id") ?? null,
      textureBacked: drawable?.getAttribute("data-texture-backed") ?? null,
      title: drawable?.querySelector("title")?.textContent ?? ""
    };
  }, {
    visual: editorTestIds.previewVisual
  }, {
    drawableId: smoke.drawableId
  });
  const expected = {
    visualAriaLabel: "Runtime preview visual, 0 texture pattern, 1 texture fallback",
    textureStatus: "resolved",
    textureRender: "solid_fallback",
    textureId: smoke.textureId,
    previewAssetId: textureSeed.previewAssetId,
    textureBacked: "true"
  };

  if (
    visualState.visualAriaLabel !== expected.visualAriaLabel ||
    visualState.textureStatus !== expected.textureStatus ||
    visualState.textureRender !== expected.textureRender ||
    visualState.textureId !== expected.textureId ||
    visualState.previewAssetId !== expected.previewAssetId ||
    visualState.textureBacked !== expected.textureBacked ||
    !visualState.title.includes("package-local texture preview not browser materialized")
  ) {
    throw new Error(
      `Preview semantic evidence mismatch: expected ${JSON.stringify(expected)}, received ${JSON.stringify(visualState)}.`
    );
  }
};

const assertViewerSemanticEvidence = async (page) => {
  await waitForTestId(page, editorTestIds.viewerRuntimePanel);
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, "Part Layer Evidence");
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, smoke.rootPartId);
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, smoke.parentPartId);
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, smoke.headPartId);
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, `${smoke.headPartId}: depth 2`);
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, "Drawable Layer Evidence");
  await waitForText(
    page,
    editorTestIds.viewerRuntimeSnapshotSummary,
    `${smoke.drawableId}: part ${smoke.headPartId} / texture ${smoke.textureId}`
  );
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, "runtime visible / editor visible / unlocked / not selected");
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, "texture-backed");
  await waitForText(page, editorTestIds.viewerRuntimeDiagnostics, "Validation Diagnostics");
  await waitForText(page, editorTestIds.viewerRuntimeDiagnostics, "fail / error / 2 checks");
  await waitForText(page, editorTestIds.viewerRuntimeDiagnostics, "asset.psd.adapterDiagnostic");
  await waitForText(page, editorTestIds.viewerRuntimeDiagnostics, "ref.textureSourceLayerMismatch");
};

const assertLoadedLayerTreeState = async (page) => {
  await waitForText(page, editorTestIds.packageStatus, smoke.packageId);
  await waitForOperationLogEntryCount(page, 8);
  await waitForText(page, editorTestIds.operationLogSummary, "updatePart");
  await waitForText(page, editorTestIds.operationLogSummary, "deletePart");
  await assertPassPathLayerTreeState(page);
};

const assertSavedLayerTreeProject = async (page, label) => {
  const saved = await page.evaluate((storageKey, expected) => {
    const raw = localStorage.getItem(storageKey);
    if (raw === null) {
      return null;
    }

    const project = JSON.parse(raw);
    const graph = readPackageJsonFile(project, "model/graph.json");
    const drawables = readPackageJsonFile(project, "model/drawables.json");
    const textureAtlas = readPackageJsonFile(project, "assets/textures/texture-atlas.json");
    const operationLogEntries = String(project.operationLogJsonl ?? "")
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line));
    const rootPart = graph?.parts?.find((candidate) => candidate.partId === expected.rootPartId);
    const parentPart = graph?.parts?.find((candidate) => candidate.partId === expected.parentPartId);
    const headPart = graph?.parts?.find((candidate) => candidate.partId === expected.headPartId);
    const emptyPart = graph?.parts?.find((candidate) => candidate.partId === expected.emptyPartId);
    const drawable = drawables?.drawables?.find(
      (candidate) => candidate.drawableId === expected.drawableId
    );
    const texture = textureAtlas?.textures?.find(
      (candidate) => candidate.textureId === expected.textureId
    );
    const previewAsset = textureAtlas?.previewAssets?.find(
      (candidate) => candidate.previewAssetId === expected.previewAssetId
    );

    return {
      schemaVersion: project.schemaVersion,
      packageId: project.packageSummary?.packageId ?? null,
      packageRevision: project.packageSummary?.packageRevision ?? null,
      operationTypes: operationLogEntries.map((entry) => entry.operationType),
      rootPart: summarizePart(rootPart),
      parentPart: summarizePart(parentPart),
      headPart: summarizePart(headPart),
      emptyPartPresent: emptyPart !== undefined,
      drawable: drawable === undefined
        ? null
        : {
            drawableId: drawable.drawableId,
            partId: drawable.partId,
            textureId: drawable.textureId,
            runtimeVisibility: drawable.runtimeVisibility
          },
      texture: texture === undefined
        ? null
        : {
            textureId: texture.textureId,
            sourceAssetId: texture.sourceAssetId,
            sourceLayerId: texture.sourceLayerId
          },
      previewAsset: previewAsset === undefined
        ? null
        : {
            previewAssetId: previewAsset.previewAssetId,
            textureId: previewAsset.textureId,
            referenceKind: previewAsset.reference?.referenceKind ?? null,
            filePath: previewAsset.reference?.filePath ?? null
          },
      generatedRuntimeArtifacts: (project.generatedArtifactPaths ?? []).filter((entry) =>
        entry.startsWith("runtime/")
      ).length,
      generatedValidationArtifacts: (project.generatedArtifactPaths ?? []).filter((entry) =>
        entry.startsWith("validation/reports/")
      ).length
    };

    function summarizePart(part) {
      return part === undefined
        ? null
        : {
            partId: part.partId,
            displayName: part.displayName,
            parentPartId: part.parentPartId ?? null,
            childPartIds: part.childPartIds,
            drawableIds: part.drawableIds
          };
    }

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
    ...smoke,
    previewAssetId: textureSeed.previewAssetId
  });
  const expected = {
    schemaVersion: "editor-project-persistence-v1",
    packageId: smoke.packageId,
    packageRevision: 8,
    operationTypes: [
      "importPsdSourceAsset",
      "createPart",
      "createPart",
      "createPart",
      "updatePart",
      "setDrawablePart",
      "setDrawableTexture",
      "deletePart"
    ],
    rootPart: {
      partId: smoke.rootPartId,
      displayName: "Root",
      parentPartId: null,
      childPartIds: [smoke.parentPartId],
      drawableIds: []
    },
    parentPart: {
      partId: smoke.parentPartId,
      displayName: smoke.parentDisplayName,
      parentPartId: smoke.rootPartId,
      childPartIds: [smoke.headPartId],
      drawableIds: []
    },
    headPart: {
      partId: smoke.headPartId,
      displayName: smoke.renamedHeadDisplayName,
      parentPartId: smoke.parentPartId,
      childPartIds: [],
      drawableIds: [smoke.drawableId]
    },
    drawable: {
      drawableId: smoke.drawableId,
      partId: smoke.headPartId,
      textureId: smoke.textureId,
      runtimeVisibility: true
    },
    texture: {
      textureId: smoke.textureId,
      sourceAssetId: textureSeed.sourceAssetId,
      sourceLayerId: textureSeed.sourceLayerId
    },
    previewAsset: {
      previewAssetId: textureSeed.previewAssetId,
      textureId: smoke.textureId,
      referenceKind: "package-local-file-v1",
      filePath: textureSeed.texturePreviewReference
    }
  };

  if (
    saved === null ||
    saved.schemaVersion !== expected.schemaVersion ||
    saved.packageId !== expected.packageId ||
    saved.packageRevision !== expected.packageRevision ||
    JSON.stringify(saved.operationTypes) !== JSON.stringify(expected.operationTypes) ||
    JSON.stringify(saved.rootPart) !== JSON.stringify(expected.rootPart) ||
    JSON.stringify(saved.parentPart) !== JSON.stringify(expected.parentPart) ||
    JSON.stringify(saved.headPart) !== JSON.stringify(expected.headPart) ||
    saved.emptyPartPresent ||
    JSON.stringify(saved.drawable) !== JSON.stringify(expected.drawable) ||
    JSON.stringify(saved.texture) !== JSON.stringify(expected.texture) ||
    JSON.stringify(saved.previewAsset) !== JSON.stringify(expected.previewAsset) ||
    saved.generatedRuntimeArtifacts < 1 ||
    saved.generatedValidationArtifacts < 1
  ) {
    throw new Error(
      `Saved layer tree direct manipulation project mismatch during ${label}: expected ${JSON.stringify(
        expected
      )} with runtime/validation artifacts, received ${JSON.stringify(saved)}.`
    );
  }
};

const runPendingDeletePreflightSmoke = async (page) => {
  await createPart(page, {
    displayName: smoke.pendingDisplayName,
    partId: smoke.pendingPartId,
    parentPartId: smoke.rootPartId,
    expectedOperationLogEntryCount: 1
  });
  await setFormSelectValues(page, createLayerTreeDrawablePartDraftFormTestId(smoke.drawableId), [
    smoke.pendingPartId
  ]);
  await clickTestId(page, createLayerTreeDrawablePartDraftSubmitTestId(smoke.drawableId));
  await waitForText(page, createLayerTreeDrawableRowTestId(smoke.drawableId), "Part draft: Wave 33 Pending Delete");
  await clickTestId(page, createLayerTreeEmptyLeafDeleteDraftTestId(smoke.pendingPartId));
  await waitForText(page, createLayerTreePartGroupTestId(smoke.pendingPartId), "Empty-leaf delete draft pending");
  await waitForText(page, editorTestIds.layerTreePanel, "2 direct drafts");
  await assertPartOptionDisabled(page, createLayerTreeDrawablePartDraftFormTestId(smoke.drawableId), smoke.pendingPartId);

  await clickTestId(page, editorTestIds.layerTreeDirectDraftCommit);
  await sleep(100);
  await waitForOperationLogEntryCount(page, 1);
  await waitForText(page, editorTestIds.operationStatus, "createPart committed");
  await waitForText(page, editorTestIds.layerTreePanel, "2 direct drafts");
  await waitForText(page, createLayerTreePartGroupTestId(smoke.pendingPartId), "No drawables in this part.");
  await waitForText(page, createLayerTreePartGroupTestId(smoke.rootPartId), "1 drawable");
  await waitForText(page, createLayerTreeDrawableRowTestId(smoke.drawableId), smoke.drawableDisplayName);

  const operationLogText = await readText(page, editorTestIds.operationLogSummary);
  if (operationLogText.includes("setDrawablePart") || operationLogText.includes("deletePart")) {
    throw new Error(`Pending-delete preflight mutated operation log: ${operationLogText}.`);
  }

  return {
    status: "rejected",
    committedCount: 0,
    expectedCheckId: "editor.layerTreeDirectDraft.drawablePartToPendingDelete",
    operationLogText,
    draftStatePreserved: true,
    graphMutationAllowed: false
  };
};

const resetBrowserProject = async (page) => {
  await page.evaluate((storageKey) => localStorage.removeItem(storageKey), editorProjectStorageKey);
  await page.reload();
  await waitForTestId(page, editorTestIds.shell);
  await waitForText(page, editorTestIds.layerTreeSummary, "1 part group / 1 drawable");
  await waitForOperationLogEntryCount(page, 0);
};

const setCreatePartFormValues = async (page, values) => {
  await page.evaluate((ids, input) => {
    const form = document.querySelector(`[data-testid="${ids.form}"]`);
    if (!(form instanceof HTMLFormElement)) {
      throw new Error("Create part form was missing.");
    }

    const nameInput = form.querySelector("input");
    const parentSelect = form.querySelector("select");
    if (!(nameInput instanceof HTMLInputElement) || !(parentSelect instanceof HTMLSelectElement)) {
      throw new Error("Create part form controls were missing.");
    }

    nameInput.value = input.displayName;
    nameInput.dispatchEvent(new Event("input", { bubbles: true }));
    nameInput.dispatchEvent(new Event("change", { bubbles: true }));
    parentSelect.value = input.parentPartId;
    parentSelect.dispatchEvent(new Event("input", { bubbles: true }));
    parentSelect.dispatchEvent(new Event("change", { bubbles: true }));
  }, {
    form: editorTestIds.layerTreeCreatePartForm
  }, values);
};

const setFormInputValue = async (page, formTestId, value) => {
  await page.evaluate((testId, nextValue) => {
    const form = document.querySelector(`[data-testid="${testId}"]`);
    if (!(form instanceof HTMLFormElement)) {
      throw new Error(`Form ${testId} was missing.`);
    }

    const input = form.querySelector("input");
    if (!(input instanceof HTMLInputElement)) {
      throw new Error(`Form ${testId} input was missing.`);
    }

    input.value = nextValue;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, formTestId, value);
};

const setFormSelectValues = async (page, formTestId, values) => {
  await page.evaluate((testId, nextValues) => {
    const form = document.querySelector(`[data-testid="${testId}"]`);
    if (!(form instanceof HTMLFormElement)) {
      throw new Error(`Form ${testId} was missing.`);
    }

    const selects = [...form.querySelectorAll("select")];
    if (selects.length !== nextValues.length) {
      throw new Error(`Form ${testId} expected ${nextValues.length} selects, found ${selects.length}.`);
    }

    for (const [index, value] of nextValues.entries()) {
      const select = selects[index];
      if (!(select instanceof HTMLSelectElement)) {
        throw new Error(`Form ${testId} select ${index} was missing.`);
      }

      select.value = value;
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }, formTestId, values);
};

const assertButtonDisabled = async (page, testId, expectedDisabled) => {
  const disabled = await page.evaluate((id) => {
    const button = document.querySelector(`[data-testid="${id}"]`);
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error(`Button ${id} was missing.`);
    }

    return button.disabled;
  }, testId);

  if (disabled !== expectedDisabled) {
    throw new Error(`Expected ${testId} disabled=${expectedDisabled}, received ${disabled}.`);
  }
};

const assertPartOptionDisabled = async (page, formTestId, partId) => {
  const disabled = await page.evaluate((testId, expectedPartId) => {
    const form = document.querySelector(`[data-testid="${testId}"]`);
    if (!(form instanceof HTMLFormElement)) {
      throw new Error(`Form ${testId} was missing.`);
    }

    const select = form.querySelector("select");
    if (!(select instanceof HTMLSelectElement)) {
      throw new Error(`Form ${testId} select was missing.`);
    }

    const option = [...select.options].find((candidate) => candidate.value === expectedPartId);
    return option?.disabled ?? null;
  }, formTestId, partId);

  if (disabled !== true) {
    throw new Error(`Expected ${partId} option in ${formTestId} to be disabled, received ${disabled}.`);
  }
};

const readSemanticEvidence = async (page) => ({
  layerTreeText: await readText(page, editorTestIds.layerTreePanel),
  previewText: await readText(page, editorTestIds.previewSummary),
  viewerSnapshotText: await readText(page, editorTestIds.viewerRuntimeSnapshotSummary),
  viewerDiagnosticsText: await readText(page, editorTestIds.viewerRuntimeDiagnostics)
});

const assertNoHorizontalOverflow = async (page, label) => {
  const overflow = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const documentOverflows =
      Math.max(document.body?.scrollWidth ?? 0, document.documentElement.scrollWidth) > viewportWidth + 1
        ? 1
        : 0;
    const overflowingElements = [...document.body.querySelectorAll("*")].filter((element) => {
      const rect = element.getBoundingClientRect();

      return rect.left < -1 || rect.right > viewportWidth + 1;
    });

    return {
      count: documentOverflows + overflowingElements.length,
      viewportWidth,
      documentScrollWidth: Math.max(document.body?.scrollWidth ?? 0, document.documentElement.scrollWidth),
      elements: overflowingElements.slice(0, 8).map((element) => {
        const rect = element.getBoundingClientRect();

        return {
          tagName: element.tagName.toLowerCase(),
          className: element.getAttribute("class") ?? "",
          testId: element.getAttribute("data-testid") ?? "",
          text: (element.textContent ?? "").trim().slice(0, 96),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width)
        };
      })
    };
  });

  if (overflow.count !== 0) {
    throw new Error(`${label} horizontal overflow was ${JSON.stringify(overflow)}; expected 0.`);
  }
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

const assertElementAbsent = async (page, testId) => {
  const isPresent = await page.evaluate(
    (id) => document.querySelector(`[data-testid="${id}"]`) !== null,
    testId
  );

  if (isPresent) {
    throw new Error(`Expected ${testId} to be absent.`);
  }
};

const waitForText = async (page, testId, expectedText) => {
  try {
    await page.waitFor(
      `${testId} text ${expectedText}`,
      (id, text) => document.querySelector(`[data-testid="${id}"]`)?.textContent?.includes(text) ?? false,
      { timeoutMs: 8_000 },
      testId,
      expectedText
    );
  } catch (error) {
    const actualText = await readText(page, testId).catch(() => "");
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${message}; actual ${testId} text was "${actualText.slice(0, 1000)}".`);
  }
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
    { timeoutMs: 8_000 },
    editorTestIds.operationLogSummary,
    expectedCount
  );
};

const readText = async (page, testId) =>
  page.evaluate((id) => document.querySelector(`[data-testid="${id}"]`)?.textContent ?? "", testId);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const main = async () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  const browser = locateBrowserExecutable();
  const server = await startOrReuseEditorServer({ repoRoot });
  let launchedBrowser;

  try {
    console.log(
      `layer-tree-direct-manipulation-e2e: using ${browser.executable} (${browser.source}); server ${server.baseUrl} ${
        server.reused ? "reused" : "started"
      }`
    );

    launchedBrowser = await launchHeadlessBrowser({ executable: browser.executable });

    for (const viewport of layerTreeDirectManipulationSmokeViewports) {
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

        const result = await runLayerTreeDirectManipulationSmoke({ page, viewport });
        console.log(`layer-tree-direct-manipulation-e2e: ${viewport.name} smoke passed`);
        console.log(
          `layer-tree-direct-manipulation-e2e: ${viewport.name} screenshot ${result.screenshot.format} base64Length=${result.screenshot.base64Length}`
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
    console.log("layer-tree-direct-manipulation-e2e: smoke passed");
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
