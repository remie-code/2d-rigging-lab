import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { locateBrowserExecutable } from "./browser-discovery.mjs";
import { launchHeadlessBrowser } from "./chrome-launcher.mjs";
import { createPageSession } from "./page-session.mjs";
import {
  createLayerTreeDrawableRowTestId,
  createLayerTreePartGroupTestId,
  createLayerTreeSelectDrawableTestId,
  createLayerTreeToggleEditorHiddenTestId,
  createLayerTreeToggleLockTestId,
  editorProjectStorageKey,
  editorTestIds
} from "./test-ids.mjs";
import { startOrReuseEditorServer } from "./vite-server.mjs";

export const partTextureLayerSmokeViewports = [
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
  rootPartLabel: "Root / part_root",
  displayName: "Wave 28 Face",
  partId: "part_wave_28_face",
  drawableId: "draw_body",
  drawableDisplayName: "Body",
  textureId: "tex_w28"
};

const textureSeed = {
  sourceAssetId: "src_w28",
  sourceLayerId: "layer_w28",
  textureId: smoke.textureId,
  previewAssetId: "preview_src_w28_layer_w28",
  texturePreviewReference:
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  manifestPath: "assets/sources/w28.psd",
  contentHash: "metadata:w28-texture-seed",
  adapterName: "w28-texture-seed-profile",
  creator: "Wave28 E2E Texture Seed",
  license: "internal-test-fixture",
  sourceUrl: "https://example.invalid/private-2d-rigging-lab/w28-texture-seed",
  notes: "Metadata-only texture atlas seed; no PSD bytes, file picker, parser, or image decode.",
  bounds: {
    x: 24,
    y: 16,
    width: 48,
    height: 64
  }
};

export const runPartTextureLayerPersistenceSmoke = async ({ page, viewport }) => {
  await waitForTestId(page, editorTestIds.layerTreePanel);
  await waitForText(page, editorTestIds.layerTreeSummary, "1 part group / 1 drawable");
  await waitForText(page, editorTestIds.layerTreeSummary, "1 missing texture");
  await assertPartTextureLayerPanelReachable(page, viewport);
  await assertPartTextureLayerAccessibleBasics(page);
  await assertNoHorizontalOverflow(page, `${viewport.name} wave28 initial`);

  const textureSeedEvidence = await seedTextureAtlasEntry(page);
  await waitForText(page, editorTestIds.layerTreeSummary, "1 missing texture");

  await setCreatePartFormValues(page, {
    displayName: smoke.displayName,
    parentPartId: smoke.rootPartId
  });
  await clickTestId(page, editorTestIds.layerTreeCreatePartSubmit);
  await assertPartCreated(page);

  await setAssignmentFormValues(page, editorTestIds.layerTreeAssignPartForm, [
    smoke.drawableId,
    smoke.partId
  ]);
  await clickTestId(page, editorTestIds.layerTreeAssignPartSubmit);
  await assertDrawableReassigned(page);

  await setAssignmentFormValues(page, editorTestIds.layerTreeAssignTextureForm, [
    smoke.drawableId,
    smoke.textureId
  ]);
  await clickTestId(page, editorTestIds.layerTreeAssignTextureSubmit);
  await assertTextureAssigned(page);

  await clickTestId(page, createLayerTreeSelectDrawableTestId(smoke.drawableId));
  await clickTestId(page, createLayerTreeToggleLockTestId(smoke.drawableId));
  await clickTestId(page, createLayerTreeToggleEditorHiddenTestId(smoke.drawableId));
  await assertLayerDraftState(page);
  await assertPreviewSemanticEvidence(page);

  await clickTestId(page, editorTestIds.viewerRuntimeOpen);
  await assertViewerSemanticEvidence(page);
  const preSaveEvidence = await readSemanticEvidence(page);

  await clickTestId(page, editorTestIds.projectPersistenceSave);
  await waitForText(page, editorTestIds.projectPersistenceStatus, "Saved");
  await assertSavedPartTextureLayerProject(page, "after save");

  await page.reload();
  await waitForTestId(page, editorTestIds.shell);
  await clickTestId(page, editorTestIds.projectPersistenceLoad);
  await waitForText(page, editorTestIds.projectPersistenceStatus, "Loaded");
  await assertPartTextureLayerStateAfterLoad(page);
  await assertSavedPartTextureLayerProject(page, "after load");
  await assertPreviewSemanticEvidence(page);
  await clickTestId(page, editorTestIds.viewerRuntimeOpen);
  await assertViewerSemanticEvidence(page);
  await assertNoHorizontalOverflow(page, `${viewport.name} wave28 loaded`);

  const postLoadEvidence = await readSemanticEvidence(page);
  const screenshot = await page.captureScreenshot(`${viewport.name} wave28 part texture layer smoke`);

  return {
    viewport: viewport.name,
    textureSeedEvidence,
    partId: smoke.partId,
    drawableId: smoke.drawableId,
    textureId: smoke.textureId,
    preSaveEvidence,
    postLoadEvidence,
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
    setValue("originalName.0", "Wave28 Texture");
    setValue("normalizedName.0", "wave28_texture");
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
    previewAssetId: textureSeed.previewAssetId
  };
};

const assertPartCreated = async (page) => {
  await waitForText(page, editorTestIds.operationStatus, "createPart committed");
  await waitForOperationLogEntryCount(page, 2);
  await waitForText(page, editorTestIds.operationLogSummary, "importPsdSourceAsset, createPart");
  await waitForText(page, editorTestIds.layerTreeSummary, "2 part groups / 1 drawable");
  await waitForText(page, createLayerTreePartGroupTestId(smoke.rootPartId), smoke.rootPartLabel);
  await waitForText(page, createLayerTreePartGroupTestId(smoke.partId), `${smoke.displayName} / ${smoke.partId}`);
  await waitForText(page, createLayerTreePartGroupTestId(smoke.partId), "0 drawables");
};

const assertDrawableReassigned = async (page) => {
  const rowId = createLayerTreeDrawableRowTestId(smoke.drawableId);
  await waitForText(page, editorTestIds.operationStatus, "setDrawablePart committed");
  await waitForOperationLogEntryCount(page, 3);
  await waitForText(page, editorTestIds.operationLogSummary, "setDrawablePart");
  await waitForText(page, createLayerTreePartGroupTestId(smoke.rootPartId), "0 drawables");
  await waitForText(page, createLayerTreePartGroupTestId(smoke.partId), "1 drawable");
  await waitForText(page, rowId, `${smoke.drawableDisplayName} / ${smoke.drawableId}`);
  await waitForText(page, rowId, "Runtime visible");
  await waitForText(page, rowId, "Editor visible");
  await waitForText(page, rowId, "Unlocked");
  await waitForText(page, rowId, "Not selected");
  await waitForText(page, editorTestIds.layerTreeSummary, "1 missing texture");
};

const assertTextureAssigned = async (page) => {
  const rowId = createLayerTreeDrawableRowTestId(smoke.drawableId);
  await waitForText(page, editorTestIds.operationStatus, "setDrawableTexture committed");
  await waitForOperationLogEntryCount(page, 4);
  await waitForText(page, editorTestIds.operationLogSummary, "setDrawableTexture");
  await waitForText(page, editorTestIds.layerTreeSummary, "0 missing texture");
  await waitForText(page, rowId, "Texture resolved");
  await waitForText(page, rowId, smoke.textureId);
  await waitForText(page, editorTestIds.previewSummary, "1 pattern / 0 fallback");
};

const assertLayerDraftState = async (page) => {
  const rowId = createLayerTreeDrawableRowTestId(smoke.drawableId);
  await waitForText(page, editorTestIds.layerTreeSummary, "1 selected / 1 locked / 1 editor-hidden");
  await waitForText(page, rowId, "Editor hidden");
  await waitForText(page, rowId, "Locked");
  await waitForText(page, rowId, "Selected");

  const controls = await page.evaluate((ids) => {
    const readButton = (id) => {
      const button = document.querySelector(`[data-testid="${id}"]`);
      if (!(button instanceof HTMLButtonElement)) {
        throw new Error(`Missing layer action button ${id}.`);
      }

      return {
        text: button.textContent?.trim() ?? "",
        ariaLabel: button.getAttribute("aria-label") ?? "",
        ariaPressed: button.getAttribute("aria-pressed") ?? ""
      };
    };

    return {
      select: readButton(ids.select),
      lock: readButton(ids.lock),
      hide: readButton(ids.hide)
    };
  }, {
    select: createLayerTreeSelectDrawableTestId(smoke.drawableId),
    lock: createLayerTreeToggleLockTestId(smoke.drawableId),
    hide: createLayerTreeToggleEditorHiddenTestId(smoke.drawableId)
  });
  const expected = {
    select: {
      text: "Selected",
      ariaLabel: "Select Body",
      ariaPressed: "true"
    },
    lock: {
      text: "Unlock",
      ariaLabel: "Unlock Body",
      ariaPressed: "true"
    },
    hide: {
      text: "Show in editor",
      ariaLabel: "Show Body in editor",
      ariaPressed: "true"
    }
  };

  if (JSON.stringify(controls) !== JSON.stringify(expected)) {
    throw new Error(
      `Layer action accessibility state mismatch: expected ${JSON.stringify(expected)}, received ${JSON.stringify(controls)}.`
    );
  }
};

const assertPreviewSemanticEvidence = async (page) => {
  await waitForText(page, editorTestIds.previewSummary, "1 visible / 1 total");
  await waitForText(page, editorTestIds.previewSummary, "2 part groups / 1 drawable memberships");
  await waitForText(
    page,
    editorTestIds.previewSummary,
    "1 selected / 1 locked / 1 editor-hidden / 0 texture unresolved / 1 texture-backed"
  );
  await waitForText(page, editorTestIds.previewSummary, "1 pattern / 0 fallback");

  const visualState = await page.evaluate((ids, expected) => {
    const visual = document.querySelector(`[data-testid="${ids.visual}"]`);
    const drawable = visual?.querySelector(`[data-drawable-id="${expected.drawableId}"]`);
    const pattern = visual?.querySelector(
      `pattern[data-texture-preview-asset-id="${expected.previewAssetId}"]`
    );
    const image = pattern?.querySelector("image");

    return {
      visualAriaLabel: visual?.getAttribute("aria-label") ?? "",
      textureStatus: drawable?.getAttribute("data-texture-status") ?? null,
      textureRender: drawable?.getAttribute("data-texture-render") ?? null,
      textureId: drawable?.getAttribute("data-texture-id") ?? null,
      runtimeVisible: drawable?.getAttribute("data-runtime-visible") ?? null,
      editorHidden: drawable?.getAttribute("data-editor-hidden") ?? null,
      layerLocked: drawable?.getAttribute("data-layer-locked") ?? null,
      layerSelected: drawable?.getAttribute("data-layer-selected") ?? null,
      textureBacked: drawable?.getAttribute("data-texture-backed") ?? null,
      textureUnresolved: drawable?.getAttribute("data-texture-unresolved") ?? null,
      referenceKind: image?.getAttribute("data-texture-reference-kind") ?? null
    };
  }, {
    visual: editorTestIds.previewVisual
  }, {
    drawableId: smoke.drawableId,
    previewAssetId: textureSeed.previewAssetId
  });
  const expected = {
    visualAriaLabel: "Runtime preview visual, 1 texture pattern, 0 texture fallback",
    textureStatus: "resolved",
    textureRender: "texture_pattern",
    textureId: smoke.textureId,
    runtimeVisible: "true",
    editorHidden: "true",
    layerLocked: "true",
    layerSelected: "true",
    textureBacked: "true",
    textureUnresolved: "false",
    referenceKind: "deterministic-data-url-v1"
  };

  if (JSON.stringify(visualState) !== JSON.stringify(expected)) {
    throw new Error(
      `Preview visual semantic evidence mismatch: expected ${JSON.stringify(expected)}, received ${JSON.stringify(visualState)}.`
    );
  }
};

const assertViewerSemanticEvidence = async (page) => {
  await waitForTestId(page, editorTestIds.viewerRuntimePanel);
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, "Part Layer Evidence");
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, smoke.rootPartId);
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, smoke.partId);
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, `drawables ${smoke.drawableId}`);
  await waitForText(
    page,
    editorTestIds.viewerRuntimeSnapshotSummary,
    `${smoke.partId}: depth 1`
  );
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, "Drawable Layer Evidence");
  await waitForText(
    page,
    editorTestIds.viewerRuntimeSnapshotSummary,
    `${smoke.drawableId}: part ${smoke.partId} / texture ${smoke.textureId}`
  );
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, "runtime visible / editor hidden / locked / selected");
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, "texture-backed");
  await waitForText(page, editorTestIds.viewerRuntimeDiagnostics, "Validation Diagnostics");
};

const assertPartTextureLayerStateAfterLoad = async (page) => {
  await waitForText(page, editorTestIds.packageStatus, smoke.packageId);
  await waitForOperationLogEntryCount(page, 4);
  await waitForText(
    page,
    editorTestIds.operationLogSummary,
    "importPsdSourceAsset, createPart, setDrawablePart, setDrawableTexture"
  );
  await waitForText(page, createLayerTreePartGroupTestId(smoke.partId), `${smoke.displayName} / ${smoke.partId}`);
  await waitForText(page, createLayerTreePartGroupTestId(smoke.partId), "1 drawable");
  await waitForText(page, createLayerTreeDrawableRowTestId(smoke.drawableId), smoke.textureId);
  await waitForText(page, createLayerTreeDrawableRowTestId(smoke.drawableId), "Editor hidden");
  await waitForText(page, createLayerTreeDrawableRowTestId(smoke.drawableId), "Locked");
  await waitForText(page, createLayerTreeDrawableRowTestId(smoke.drawableId), "Selected");
  await waitForText(page, editorTestIds.layerTreeSummary, "1 selected / 1 locked / 1 editor-hidden");
  await waitForText(page, editorTestIds.layerTreeSummary, "0 missing texture");
};

const assertSavedPartTextureLayerProject = async (page, label) => {
  const saved = await page.evaluate((storageKey, expected) => {
    const raw = localStorage.getItem(storageKey);
    if (raw === null) {
      return null;
    }

    const project = JSON.parse(raw);
    const graph = readPackageJsonFile(project, "model/graph.json");
    const drawables = readPackageJsonFile(project, "model/drawables.json");
    const textureAtlas = readPackageJsonFile(project, "assets/textures/texture-atlas.json");
    const editorState = readPackageJsonFile(project, "model/editor-state.json");
    const operationLogEntries = String(project.operationLogJsonl ?? "")
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line));
    const rootPart = graph?.parts?.find((candidate) => candidate.partId === expected.rootPartId);
    const createdPart = graph?.parts?.find((candidate) => candidate.partId === expected.partId);
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
      operationTargetIds: operationLogEntries.flatMap((entry) => entry.targetIds ?? []),
      rootPart: rootPart === undefined
        ? null
        : {
            partId: rootPart.partId,
            childPartIds: rootPart.childPartIds,
            drawableIds: rootPart.drawableIds
          },
      createdPart: createdPart === undefined
        ? null
        : {
            partId: createdPart.partId,
            displayName: createdPart.displayName,
            parentPartId: createdPart.parentPartId ?? null,
            childPartIds: createdPart.childPartIds,
            drawableIds: createdPart.drawableIds
          },
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
            referenceKind: previewAsset.reference?.referenceKind ?? null
          },
      editorState,
      generatedRuntimeArtifacts: (project.generatedArtifactPaths ?? []).filter((entry) =>
        entry.startsWith("runtime/")
      ).length,
      generatedValidationArtifacts: (project.generatedArtifactPaths ?? []).filter((entry) =>
        entry.startsWith("validation/reports/")
      ).length
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
    ...smoke,
    previewAssetId: textureSeed.previewAssetId
  });
  const expected = {
    schemaVersion: "editor-project-persistence-v1",
    packageId: smoke.packageId,
    packageRevision: 4,
    operationTypes: ["importPsdSourceAsset", "createPart", "setDrawablePart", "setDrawableTexture"],
    rootPart: {
      partId: smoke.rootPartId,
      childPartIds: [smoke.partId],
      drawableIds: []
    },
    createdPart: {
      partId: smoke.partId,
      displayName: smoke.displayName,
      parentPartId: smoke.rootPartId,
      childPartIds: [],
      drawableIds: [smoke.drawableId]
    },
    drawable: {
      drawableId: smoke.drawableId,
      partId: smoke.partId,
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
      referenceKind: "deterministic-data-url-v1"
    },
    editorState: {
      schemaVersion: "editor-state-v1",
      selection: [smoke.drawableId],
      lockedIds: [smoke.drawableId],
      editorHiddenIds: [smoke.drawableId]
    }
  };

  if (
    saved === null ||
    saved.schemaVersion !== expected.schemaVersion ||
    saved.packageId !== expected.packageId ||
    saved.packageRevision !== expected.packageRevision ||
    JSON.stringify(saved.operationTypes) !== JSON.stringify(expected.operationTypes) ||
    !saved.operationTargetIds.includes(smoke.partId) ||
    !saved.operationTargetIds.includes(smoke.drawableId) ||
    !saved.operationTargetIds.includes(smoke.textureId) ||
    JSON.stringify(saved.rootPart) !== JSON.stringify(expected.rootPart) ||
    JSON.stringify(saved.createdPart) !== JSON.stringify(expected.createdPart) ||
    JSON.stringify(saved.drawable) !== JSON.stringify(expected.drawable) ||
    JSON.stringify(saved.texture) !== JSON.stringify(expected.texture) ||
    JSON.stringify(saved.previewAsset) !== JSON.stringify(expected.previewAsset) ||
    !isSameEditorState(saved.editorState, expected.editorState) ||
    saved.generatedRuntimeArtifacts < 1 ||
    saved.generatedValidationArtifacts < 1
  ) {
    throw new Error(
      `Saved part/texture/layer project mismatch during ${label}: expected ${JSON.stringify(
        expected
      )} with runtime/validation artifacts, received ${JSON.stringify(saved)}.`
    );
  }
};

const isSameEditorState = (actual, expected) =>
  actual?.schemaVersion === expected.schemaVersion &&
  JSON.stringify(actual.selection ?? []) === JSON.stringify(expected.selection) &&
  JSON.stringify(actual.lockedIds ?? []) === JSON.stringify(expected.lockedIds) &&
  JSON.stringify(actual.editorHiddenIds ?? []) === JSON.stringify(expected.editorHiddenIds);

const assertPartTextureLayerPanelReachable = async (page, viewport) => {
  const metrics = await page.evaluate((ids) => {
    const panel = document.querySelector(`[data-testid="${ids.panel}"]`);
    const createSubmit = document.querySelector(`[data-testid="${ids.createSubmit}"]`);
    const assignPartSubmit = document.querySelector(`[data-testid="${ids.assignPartSubmit}"]`);
    const assignTextureSubmit = document.querySelector(`[data-testid="${ids.assignTextureSubmit}"]`);

    if (
      !(panel instanceof HTMLElement) ||
      !(createSubmit instanceof HTMLButtonElement) ||
      !(assignPartSubmit instanceof HTMLButtonElement) ||
      !(assignTextureSubmit instanceof HTMLButtonElement)
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

    assignTextureSubmit.scrollIntoView({ block: "center", inline: "nearest" });
    const panelRect = panel.getBoundingClientRect();
    const createRect = createSubmit.getBoundingClientRect();
    const assignPartRect = assignPartSubmit.getBoundingClientRect();
    const assignTextureRect = assignTextureSubmit.getBoundingClientRect();

    return {
      panelVisible: rectVisible(panelRect),
      createSubmitVisible: rectVisible(createRect),
      assignPartSubmitVisible: rectVisible(assignPartRect),
      assignTextureSubmitVisible: rectVisible(assignTextureRect),
      panelWidth: panelRect.width,
      createSubmitWidth: createRect.width,
      assignPartSubmitWidth: assignPartRect.width,
      assignTextureSubmitWidth: assignTextureRect.width
    };
  }, {
    panel: editorTestIds.layerTreePanel,
    createSubmit: editorTestIds.layerTreeCreatePartSubmit,
    assignPartSubmit: editorTestIds.layerTreeAssignPartSubmit,
    assignTextureSubmit: editorTestIds.layerTreeAssignTextureSubmit
  });

  if (
    metrics === null ||
    !metrics.panelVisible ||
    !metrics.createSubmitVisible ||
    !metrics.assignPartSubmitVisible ||
    !metrics.assignTextureSubmitVisible ||
    metrics.panelWidth < 1 ||
    metrics.createSubmitWidth < 1 ||
    metrics.assignPartSubmitWidth < 1 ||
    metrics.assignTextureSubmitWidth < 1
  ) {
    throw new Error(`${viewport.name} layer tree panel was not reachable: ${JSON.stringify(metrics)}.`);
  }
};

const assertPartTextureLayerAccessibleBasics = async (page) => {
  const names = await page.evaluate((ids) => {
    const panel = document.querySelector(`[data-testid="${ids.panel}"]`);
    const headingId = panel?.getAttribute("aria-labelledby");
    const createForm = document.querySelector(`[data-testid="${ids.createForm}"]`);
    const updateForm = document.querySelector(`[data-testid="${ids.updateForm}"]`);
    const assignPartForm = document.querySelector(`[data-testid="${ids.assignPartForm}"]`);
    const assignTextureForm = document.querySelector(`[data-testid="${ids.assignTextureForm}"]`);

    return {
      panelName: headingId === null ? "" : document.getElementById(headingId)?.textContent ?? "",
      createSubmitName: document.querySelector(`[data-testid="${ids.createSubmit}"]`)?.textContent?.trim() ?? "",
      updateSubmitName: document.querySelector(`[data-testid="${ids.updateSubmit}"]`)?.textContent?.trim() ?? "",
      assignPartSubmitName: document.querySelector(`[data-testid="${ids.assignPartSubmit}"]`)?.textContent?.trim() ?? "",
      assignTextureSubmitName: document.querySelector(`[data-testid="${ids.assignTextureSubmit}"]`)?.textContent?.trim() ?? "",
      createLabels: readFormLabels(createForm),
      updateLabels: readFormLabels(updateForm),
      assignPartLabels: readFormLabels(assignPartForm),
      assignTextureLabels: readFormLabels(assignTextureForm)
    };

    function readFormLabels(form) {
      if (!(form instanceof HTMLFormElement)) {
        return [];
      }

      return [...form.querySelectorAll("label")].map((label) =>
        [...label.childNodes]
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .map((node) => node.textContent ?? "")
          .join("")
          .trim()
      );
    }
  }, {
    panel: editorTestIds.layerTreePanel,
    createForm: editorTestIds.layerTreeCreatePartForm,
    createSubmit: editorTestIds.layerTreeCreatePartSubmit,
    updateForm: editorTestIds.layerTreeUpdatePartForm,
    updateSubmit: editorTestIds.layerTreeUpdatePartSubmit,
    assignPartForm: editorTestIds.layerTreeAssignPartForm,
    assignPartSubmit: editorTestIds.layerTreeAssignPartSubmit,
    assignTextureForm: editorTestIds.layerTreeAssignTextureForm,
    assignTextureSubmit: editorTestIds.layerTreeAssignTextureSubmit
  });
  const expected = {
    panelName: "Layer Tree",
    createSubmitName: "Create part",
    updateSubmitName: "Update part",
    assignPartSubmitName: "Move drawable",
    assignTextureSubmitName: "Assign texture",
    createLabels: ["Display name", "Parent"],
    updateLabels: ["Part", "Display name"],
    assignPartLabels: ["Drawable", "Part"],
    assignTextureLabels: ["Drawable", "Texture"]
  };

  if (JSON.stringify(names) !== JSON.stringify(expected)) {
    throw new Error(
      `Layer tree accessible basics mismatch: expected ${JSON.stringify(expected)}, received ${JSON.stringify(names)}.`
    );
  }
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

const setAssignmentFormValues = async (page, formTestId, values) => {
  await page.evaluate((testId, nextValues) => {
    const form = document.querySelector(`[data-testid="${testId}"]`);
    if (!(form instanceof HTMLFormElement)) {
      throw new Error(`Assignment form ${testId} was missing.`);
    }

    const selects = [...form.querySelectorAll("select")];
    if (selects.length !== nextValues.length) {
      throw new Error(`Assignment form ${testId} expected ${nextValues.length} selects, found ${selects.length}.`);
    }

    for (const [index, value] of nextValues.entries()) {
      const select = selects[index];
      if (!(select instanceof HTMLSelectElement)) {
        throw new Error(`Assignment form ${testId} select ${index} was missing.`);
      }

      select.value = value;
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }, formTestId, values);
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

const main = async () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  const browser = locateBrowserExecutable();
  const server = await startOrReuseEditorServer({ repoRoot });
  let launchedBrowser;

  try {
    console.log(
      `part-texture-layer-e2e: using ${browser.executable} (${browser.source}); server ${server.baseUrl} ${
        server.reused ? "reused" : "started"
      }`
    );

    launchedBrowser = await launchHeadlessBrowser({ executable: browser.executable });

    for (const viewport of partTextureLayerSmokeViewports) {
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

        const result = await runPartTextureLayerPersistenceSmoke({ page, viewport });
        console.log(`part-texture-layer-e2e: ${viewport.name} smoke passed`);
        console.log(
          `part-texture-layer-e2e: ${viewport.name} screenshot ${result.screenshot.format} base64Length=${result.screenshot.base64Length}`
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
    console.log("part-texture-layer-e2e: smoke passed");
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
