import {
  createImportedSourceAssetRowTestId,
  editorTestIds
} from "./test-ids.mjs";

export const sourceIntakeSmoke = {
  sourceAssetId: "src_psd_e2e",
  sourceLayerId: "layer_psd_face",
  textureId: "tex_psd_e2e_face",
  texturePreviewReference:
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  texturePreviewAssetId: "preview_src_psd_e2e_layer_psd_face",
  manifestPath: "assets/sources/e2e/source-reference.psd",
  contentHash: "metadata:e2e-psd-adapter-profile",
  adapterName: "manual-e2e-psd-profile",
  canvasWidth: 2048,
  canvasHeight: 3072,
  defaultPartId: "part_root",
  originalName: "E2E PSD Face",
  normalizedName: "e2e_psd_face",
  groupPath: "Root/Head",
  creator: "E2E PSD Adapter Fixture",
  license: "internal-test-fixture",
  sourceUrl: "https://example.invalid/private-2d-rigging-lab/e2e-psd-source-reference",
  notes: "Manual PSD adapter/profile metadata only; no PSD bytes are parsed by the editor.",
  redistributionAllowed: false,
  aiUsed: false,
  unsupportedFeatures: "",
  bounds: {
    x: 84,
    y: 24,
    width: 28,
    height: 36
  }
};

export const runSourceIntakeWorkflow = async ({
  page,
  viewport,
  initialOperationLogEntryCount = 0
}) => {
  await waitForTestId(page, editorTestIds.sourceIntakePanel);
  await waitForTestId(page, editorTestIds.sourceIntakeForm);
  await waitForTestId(page, editorTestIds.sourceIntakeSubmit);
  await waitForTestId(page, editorTestIds.sourceIntakeSummary);
  await waitForTestId(page, editorTestIds.sourceIntakeImportedSources);
  await waitForText(page, editorTestIds.sourceIntakeSummary, "No split PNG manifest path");
  await waitForText(page, editorTestIds.sourceIntakeImportedSources, "0 imported source assets");

  await assertSourceIntakePanelReachable(page, viewport);
  await assertSourceIntakeAccessibleNames(page);
  await assertPsdNativeFormValidation(page, sourceIntakeSmoke);
  await setSourceIntakeFormValues(page, sourceIntakeSmoke);
  await clickTestId(page, editorTestIds.sourceIntakeSubmit);

  const importedSourceRow = createImportedSourceAssetRowTestId(sourceIntakeSmoke.sourceAssetId);
  await waitForText(page, editorTestIds.operationStatus, "importPsdSourceAsset committed");
  await waitForText(page, editorTestIds.sourceIntakeSummary, "Draft confirmed");
  await waitForText(page, editorTestIds.sourceIntakeSummary, "PSD adapter/profile metadata (manual)");
  await waitForText(page, editorTestIds.sourceIntakeSummary, sourceIntakeSmoke.manifestPath);
  await waitForText(page, editorTestIds.sourceIntakeSummary, "layered-character-psd-profile-v1");
  await waitForText(page, editorTestIds.sourceIntakeSummary, sourceIntakeSmoke.adapterName);
  await waitForText(
    page,
    editorTestIds.sourceIntakeSummary,
    `${sourceIntakeSmoke.canvasWidth} x ${sourceIntakeSmoke.canvasHeight}`
  );
  await waitForText(page, editorTestIds.sourceIntakeSummary, `Cleared / ${sourceIntakeSmoke.license}`);
  await waitForText(page, editorTestIds.sourceIntakeImportedSources, "1 imported source asset");
  await waitForText(page, importedSourceRow, sourceIntakeSmoke.sourceAssetId);
  await waitForText(page, importedSourceRow, sourceIntakeSmoke.manifestPath);
  await waitForText(page, importedSourceRow, "layered-character-psd-profile-v1");
  await waitForText(page, importedSourceRow, sourceIntakeSmoke.sourceLayerId);
  await waitForText(page, importedSourceRow, "psd.adapterName");
  await waitForText(page, importedSourceRow, "psd.layerTexturePreview");
  await waitForText(page, importedSourceRow, "0 mapped drawables");
  await waitForText(
    page,
    editorTestIds.sourceIntakeLayerRows,
    `${sourceIntakeSmoke.textureId} / ${sourceIntakeSmoke.defaultPartId}`
  );
  await waitForText(
    page,
    editorTestIds.drawableAuthoringPanel,
    `${sourceIntakeSmoke.sourceAssetId} / ${sourceIntakeSmoke.sourceLayerId}`
  );
  await waitForOperationLogEntryCount(page, initialOperationLogEntryCount + 1);
  await waitForText(page, editorTestIds.operationLogSummary, "importPsdSourceAsset");

  const screenshot = await page.captureScreenshot(`${viewport.name} source intake smoke`);

  return {
    viewport: viewport.name,
    sourceAssetId: sourceIntakeSmoke.sourceAssetId,
    sourceLayerId: sourceIntakeSmoke.sourceLayerId,
    importedSourceRow,
    screenshot
  };
};

export const assertSavedSourceIntakeState = async ({ page, storageKey, smokeDrawable }) => {
  const saved = await page.evaluate((key, expected) => {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      return null;
    }

    const project = JSON.parse(raw);
    const sourceManifest = readPackageJsonFile(project, "assets/sources/source-manifest.json");
    const provenance = readPackageJsonFile(project, "assets/provenance.json");
    const rights = readPackageJsonFile(project, "assets/rights.json");
    const textureAtlas = readPackageJsonFile(project, "assets/textures/texture-atlas.json");
    const drawables = readPackageJsonFile(project, "model/drawables.json")?.drawables ?? [];
    const operationLogEntries = String(project.operationLogJsonl ?? "")
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line));

    const sourceAsset = sourceManifest?.sourceAssets?.find(
      (candidate) => candidate.sourceAssetId === expected.sourceAssetId
    );
    const sourceLayer = sourceAsset?.layers?.find(
      (candidate) => candidate.sourceLayerId === expected.sourceLayerId
    );
    const rightsRecord = rights?.records?.find(
      (candidate) => candidate.assetId === expected.sourceAssetId
    );
    const provenanceRecord = provenance?.records?.find(
      (candidate) =>
        candidate.assetId === expected.sourceAssetId &&
        candidate.creator === expected.creator &&
        candidate.license === expected.license
    );
    const drawable = drawables.find((candidate) => candidate.drawableId === expected.drawableId);
    const texture = textureAtlas?.textures?.find(
      (candidate) => candidate.textureId === expected.textureId
    );
    const texturePreviewAsset = textureAtlas?.previewAssets?.find(
      (candidate) => candidate.textureId === expected.textureId
    );
    const importEntry = operationLogEntries.find(
      (entry) =>
        entry.operationType === "importPsdSourceAsset" &&
        Array.isArray(entry.targetIds) &&
        entry.targetIds.includes(expected.sourceAssetId) &&
        entry.targetIds.includes(expected.sourceLayerId) &&
        entry.targetIds.includes(expected.textureId)
    );
    const importPayload = importEntry?.payload?.payload;
    const importEntryLayer = importPayload?.adapterResult?.sourceLayers?.find(
      (candidate) => candidate.sourceLayerId === expected.sourceLayerId
    );

    return {
      sourceAssetId: sourceAsset?.sourceAssetId ?? null,
      sourceKind: sourceAsset?.kind ?? null,
      sourceFilePath: sourceAsset?.filePath ?? null,
      sourceContentHash: sourceAsset?.contentHash ?? null,
      sourceImportProfile: sourceAsset?.importProfile ?? null,
      sourceDiagnosticsContainProfile:
        sourceAsset?.diagnostics?.includes("layered-character-psd-profile-v1") ?? false,
      sourceDiagnosticsContainAdapterSchema:
        sourceAsset?.diagnostics?.includes("psd-adapter-result-v1") ?? false,
      sourceDiagnosticsContainAdapterName:
        sourceAsset?.diagnostics?.includes(`psd.adapterName:${expected.adapterName}`) ?? false,
      sourceDiagnosticsContainCanvas:
        sourceAsset?.diagnostics?.includes(`psd.canvas:${expected.canvasWidth}x${expected.canvasHeight}`) ?? false,
      sourceDiagnosticsContainRequestedRole:
        sourceAsset?.diagnostics?.includes(`psd.requestedLayerRole:${expected.sourceLayerId}:editableLayer`) ?? false,
      sourceDiagnosticsContainLayerTargetPart:
        sourceAsset?.diagnostics?.includes(`psd.layerTargetPart:${expected.sourceLayerId}:${expected.defaultPartId}`) ?? false,
      sourceDiagnosticsContainLayerTexture:
        sourceAsset?.diagnostics?.includes(`psd.layerTexture:${expected.sourceLayerId}:${expected.textureId}`) ?? false,
      sourceDiagnosticsContainLayerTexturePreview:
        sourceAsset?.diagnostics?.includes(
          `psd.layerTexturePreview:${expected.sourceLayerId}:${expected.texturePreviewReference}`
        ) ?? false,
      sourceDiagnosticsContainAdapterDiagnostic:
        sourceAsset?.diagnostics?.some((diagnostic) =>
          diagnostic.includes("psd.adapterDiagnostic:") &&
          diagnostic.includes("adapter.psd.manualProfileMetadata") &&
          diagnostic.includes("no PSD bytes were parsed by the editor")
        ) ?? false,
      sourceDiagnosticsContainSourceAsset:
        sourceAsset?.diagnostics?.includes(`psd.sourceAsset:${expected.sourceAssetId}`) ?? false,
      sourceLayerOriginalName: sourceLayer?.originalName ?? null,
      sourceLayerNormalizedName: sourceLayer?.normalizedName ?? null,
      sourceLayerGroupPath: sourceLayer?.groupPath ?? [],
      sourceLayerBounds: normalizeBounds(sourceLayer?.bounds),
      sourceLayerRole: sourceLayer?.role ?? null,
      sourceLayerUnsupportedFeatures: sourceLayer?.unsupportedFeatures ?? [],
      layerMappedDrawableIds: sourceLayer?.mappedDrawableIds ?? [],
      rightsStatus: rightsRecord?.rightsStatus ?? null,
      rightsLicense: rightsRecord?.license ?? null,
      rightsRedistributionAllowed: rightsRecord?.redistributionAllowed ?? null,
      provenanceFilePath: provenanceRecord?.filePath ?? null,
      provenanceContentHash: provenanceRecord?.contentHash ?? null,
      provenanceCreator: provenanceRecord?.creator ?? null,
      provenanceLicense: provenanceRecord?.license ?? null,
      provenanceRedistributionAllowed: provenanceRecord?.redistributionAllowed ?? null,
      provenanceAiUsed: provenanceRecord?.aiUsed ?? null,
      provenanceHistory: provenanceRecord?.transformHistory ?? [],
      drawableSourceAssetId: drawable?.sourceAssetId ?? null,
      drawableSourceLayerId: drawable?.sourceLayerId ?? null,
      drawableTextureId: drawable?.textureId ?? null,
      drawablePartId: drawable?.partId ?? null,
      textureAtlasVersion: textureAtlas?.schemaVersion ?? null,
      textureFilePath: texture?.filePath ?? null,
      textureSourceAssetId: texture?.sourceAssetId ?? null,
      textureSourceLayerId: texture?.sourceLayerId ?? null,
      texturePreviewAssetId: texturePreviewAsset?.previewAssetId ?? null,
      texturePreviewReferenceKind: texturePreviewAsset?.reference?.referenceKind ?? null,
      texturePreviewDataUrl: texturePreviewAsset?.reference?.dataUrl ?? null,
      texturePreviewSourceAssetId: texturePreviewAsset?.sourceAssetId ?? null,
      texturePreviewSourceLayerId: texturePreviewAsset?.sourceLayerId ?? null,
      texturePreviewRightsAssetId: texturePreviewAsset?.rightsAssetId ?? null,
      importEntryPresent: importEntry !== undefined,
      importEntryOperationType: importEntry?.operationType ?? null,
      importEntryTargetIds: importEntry?.targetIds ?? [],
      importEntryPayloadImportProfile: importPayload?.importProfile ?? null,
      importEntryPayloadFilePath: importPayload?.fileRef?.packageRelativePath ?? null,
      importEntryPayloadContentHash: importPayload?.fileRef?.contentHash ?? null,
      importEntryPayloadRequestedRole:
        importPayload?.requestedLayerRoles?.[expected.sourceLayerId] ?? null,
      importEntryAdapterSchema: importPayload?.adapterResult?.schemaVersion ?? null,
      importEntryAdapterSourceProfile: importPayload?.adapterResult?.sourceProfile ?? null,
      importEntryAdapterName: importPayload?.adapterResult?.adapterName ?? null,
      importEntryCanvas: normalizeCanvas(importPayload?.adapterResult?.canvas),
      importEntryLayer: importEntryLayer === undefined
        ? null
        : {
            sourceLayerId: importEntryLayer.sourceLayerId,
            originalName: importEntryLayer.originalName,
            normalizedName: importEntryLayer.normalizedName,
            parentGroupId: importEntryLayer.parentGroupId ?? null,
            groupPath: importEntryLayer.groupPath ?? [],
            sourceOrder: importEntryLayer.sourceOrder,
            bounds: normalizeBounds(importEntryLayer.bounds),
            visibleInSource: importEntryLayer.visibleInSource,
            opacityInSource: importEntryLayer.opacityInSource,
            role: importEntryLayer.role,
            unsupportedFeatures: importEntryLayer.unsupportedFeatures ?? [],
            texturePreviewReference: importEntryLayer.texturePreviewReference ?? null,
            textureId: importEntryLayer.textureId ?? null,
            targetPartId: importEntryLayer.targetPartId ?? null
          },
      importEntryAdapterDiagnosticMessage:
        importPayload?.adapterResult?.diagnostics?.[0]?.message ?? null,
      importEntryRights: importPayload?.rights ?? null
    };

    function normalizeBounds(bounds) {
      if (bounds === undefined || bounds === null) {
        return null;
      }

      return {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height
      };
    }

    function normalizeCanvas(canvas) {
      if (canvas === undefined || canvas === null) {
        return null;
      }

      return {
        width: canvas.width,
        height: canvas.height,
        bounds: normalizeBounds(canvas.bounds)
      };
    }

    function readPackageJsonFile(projectValue, path) {
      if (!Array.isArray(projectValue.packageFileSet)) {
        return null;
      }

      const entry = projectValue.packageFileSet.find((candidate) => candidate.path === path);
      if (typeof entry?.text !== "string") {
        return null;
      }

      return JSON.parse(entry.text);
    }
  }, storageKey, {
    sourceAssetId: sourceIntakeSmoke.sourceAssetId,
    sourceLayerId: sourceIntakeSmoke.sourceLayerId,
    manifestPath: sourceIntakeSmoke.manifestPath,
    contentHash: sourceIntakeSmoke.contentHash,
    adapterName: sourceIntakeSmoke.adapterName,
    canvasWidth: sourceIntakeSmoke.canvasWidth,
    canvasHeight: sourceIntakeSmoke.canvasHeight,
    originalName: sourceIntakeSmoke.originalName,
    normalizedName: sourceIntakeSmoke.normalizedName,
    groupPath: sourceIntakeSmoke.groupPath.split("/"),
    creator: sourceIntakeSmoke.creator,
    license: sourceIntakeSmoke.license,
    redistributionAllowed: sourceIntakeSmoke.redistributionAllowed,
    aiUsed: sourceIntakeSmoke.aiUsed,
    textureId: sourceIntakeSmoke.textureId,
    texturePreviewReference: sourceIntakeSmoke.texturePreviewReference,
    defaultPartId: sourceIntakeSmoke.defaultPartId,
    bounds: sourceIntakeSmoke.bounds,
    drawableId: smokeDrawable.drawableId
  });

  const expected = {
    sourceAssetId: sourceIntakeSmoke.sourceAssetId,
    sourceKind: "psd-source-v1",
    sourceFilePath: sourceIntakeSmoke.manifestPath,
    sourceContentHash: sourceIntakeSmoke.contentHash,
    sourceImportProfile: "layered-character-psd-profile-v1",
    sourceDiagnosticsContainProfile: true,
    sourceDiagnosticsContainAdapterSchema: true,
    sourceDiagnosticsContainAdapterName: true,
    sourceDiagnosticsContainCanvas: true,
    sourceDiagnosticsContainRequestedRole: true,
    sourceDiagnosticsContainLayerTargetPart: true,
    sourceDiagnosticsContainLayerTexture: true,
    sourceDiagnosticsContainLayerTexturePreview: true,
    sourceDiagnosticsContainAdapterDiagnostic: true,
    sourceDiagnosticsContainSourceAsset: true,
    sourceLayerOriginalName: sourceIntakeSmoke.originalName,
    sourceLayerNormalizedName: sourceIntakeSmoke.normalizedName,
    sourceLayerGroupPath: sourceIntakeSmoke.groupPath.split("/"),
    sourceLayerBounds: sourceIntakeSmoke.bounds,
    sourceLayerRole: "editableLayer",
    sourceLayerUnsupportedFeatures: [],
    layerMappedDrawableIds: [smokeDrawable.drawableId],
    rightsStatus: "cleared",
    rightsLicense: sourceIntakeSmoke.license,
    rightsRedistributionAllowed: sourceIntakeSmoke.redistributionAllowed,
    provenanceFilePath: sourceIntakeSmoke.manifestPath,
    provenanceContentHash: sourceIntakeSmoke.contentHash,
    provenanceCreator: sourceIntakeSmoke.creator,
    provenanceLicense: sourceIntakeSmoke.license,
    provenanceRedistributionAllowed: sourceIntakeSmoke.redistributionAllowed,
    provenanceAiUsed: sourceIntakeSmoke.aiUsed,
    provenanceHistory: [
      "importPsdSourceAsset:adapter-result-metadata",
      `psdAdapter:${sourceIntakeSmoke.adapterName}`,
      "psdAdapterSchema:psd-adapter-result-v1"
    ],
    drawableSourceAssetId: sourceIntakeSmoke.sourceAssetId,
    drawableSourceLayerId: null,
    drawableTextureId: sourceIntakeSmoke.textureId,
    drawablePartId: sourceIntakeSmoke.defaultPartId,
    textureAtlasVersion: "texture-atlas-v1",
    textureFilePath: `assets/textures/${sourceIntakeSmoke.textureId}.png`,
    textureSourceAssetId: sourceIntakeSmoke.sourceAssetId,
    textureSourceLayerId: sourceIntakeSmoke.sourceLayerId,
    texturePreviewAssetId: sourceIntakeSmoke.texturePreviewAssetId,
    texturePreviewReferenceKind: "deterministic-data-url-v1",
    texturePreviewDataUrl: sourceIntakeSmoke.texturePreviewReference,
    texturePreviewSourceAssetId: sourceIntakeSmoke.sourceAssetId,
    texturePreviewSourceLayerId: sourceIntakeSmoke.sourceLayerId,
    texturePreviewRightsAssetId: sourceIntakeSmoke.sourceAssetId,
    importEntryPresent: true,
    importEntryOperationType: "importPsdSourceAsset",
    importEntryTargetIds: [
      sourceIntakeSmoke.sourceAssetId,
      "group_root",
      "group_root_head",
      sourceIntakeSmoke.sourceLayerId,
      sourceIntakeSmoke.textureId,
      sourceIntakeSmoke.defaultPartId
    ],
    importEntryPayloadImportProfile: "layered-character-psd-profile-v1",
    importEntryPayloadFilePath: sourceIntakeSmoke.manifestPath,
    importEntryPayloadContentHash: sourceIntakeSmoke.contentHash,
    importEntryPayloadRequestedRole: "editableLayer",
    importEntryAdapterSchema: "psd-adapter-result-v1",
    importEntryAdapterSourceProfile: "layered-character-psd-profile-v1",
    importEntryAdapterName: sourceIntakeSmoke.adapterName,
    importEntryCanvas: {
      width: sourceIntakeSmoke.canvasWidth,
      height: sourceIntakeSmoke.canvasHeight,
      bounds: {
        x: 0,
        y: 0,
        width: sourceIntakeSmoke.canvasWidth,
        height: sourceIntakeSmoke.canvasHeight
      }
    },
    importEntryLayer: {
      sourceLayerId: sourceIntakeSmoke.sourceLayerId,
      originalName: sourceIntakeSmoke.originalName,
      normalizedName: sourceIntakeSmoke.normalizedName,
      parentGroupId: "group_root_head",
      groupPath: sourceIntakeSmoke.groupPath.split("/"),
      sourceOrder: 2,
      bounds: sourceIntakeSmoke.bounds,
      visibleInSource: true,
      opacityInSource: 1,
      role: "editableLayer",
      unsupportedFeatures: [],
      texturePreviewReference: sourceIntakeSmoke.texturePreviewReference,
      textureId: sourceIntakeSmoke.textureId,
      targetPartId: sourceIntakeSmoke.defaultPartId
    },
    importEntryAdapterDiagnosticMessage:
      "PSD adapter/profile metadata was entered manually in Source Intake; no PSD bytes were parsed by the editor.",
    importEntryRights: {
      creator: sourceIntakeSmoke.creator,
      license: sourceIntakeSmoke.license,
      redistributionAllowed: sourceIntakeSmoke.redistributionAllowed,
      aiUsed: sourceIntakeSmoke.aiUsed
    }
  };

  if (JSON.stringify(saved) !== JSON.stringify(expected)) {
    throw new Error(
      `Saved source intake state mismatch: expected ${JSON.stringify(expected)}, received ${JSON.stringify(saved)}.`
    );
  }
};

export const assertSourceIntakeStateAfterLoad = async ({ page, smokeDrawable }) => {
  const importedSourceRow = createImportedSourceAssetRowTestId(sourceIntakeSmoke.sourceAssetId);

  await waitForTestId(page, editorTestIds.sourceIntakePanel);
  await waitForText(page, editorTestIds.sourceIntakeImportedSources, "1 imported source asset");
  await waitForText(page, importedSourceRow, sourceIntakeSmoke.sourceAssetId);
  await waitForText(page, importedSourceRow, sourceIntakeSmoke.manifestPath);
  await waitForText(page, importedSourceRow, "layered-character-psd-profile-v1");
  await waitForText(page, importedSourceRow, sourceIntakeSmoke.sourceLayerId);
  await waitForText(page, importedSourceRow, "1 mapped drawable");
};

export const assertSourceIntakeStateAfterReset = async (page) => {
  await waitForText(page, editorTestIds.sourceIntakeSummary, "No split PNG manifest path");
  await waitForText(page, editorTestIds.sourceIntakeImportedSources, "0 imported source assets");
};

const assertSourceIntakePanelReachable = async (page, viewport) => {
  const metrics = await page.evaluate((ids) => {
    const panel = document.querySelector(`[data-testid="${ids.panel}"]`);
    const form = document.querySelector(`[data-testid="${ids.form}"]`);
    const submit = document.querySelector(`[data-testid="${ids.submit}"]`);

    if (!(panel instanceof HTMLElement) || !(form instanceof HTMLFormElement) || !(submit instanceof HTMLButtonElement)) {
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
    const submitRect = submit.getBoundingClientRect();

    return {
      panelVisible: rectVisible(panelRect),
      formVisible: rectVisible(formRect),
      submitVisible: rectVisible(submitRect),
      panelWidth: panelRect.width,
      formWidth: formRect.width,
      submitWidth: submitRect.width
    };
  }, {
    panel: editorTestIds.sourceIntakePanel,
    form: editorTestIds.sourceIntakeForm,
    submit: editorTestIds.sourceIntakeSubmit
  });

  if (
    metrics === null ||
    !metrics.panelVisible ||
    !metrics.formVisible ||
    !metrics.submitVisible ||
    metrics.panelWidth < 1 ||
    metrics.formWidth < 1 ||
    metrics.submitWidth < 1
  ) {
    throw new Error(
      `${viewport.name} source intake panel was not reachable/usable: ${JSON.stringify(metrics)}.`
    );
  }
};

const assertSourceIntakeAccessibleNames = async (page) => {
  const names = await page.evaluate((ids) => {
    const panel = document.querySelector(`[data-testid="${ids.panel}"]`);
    const headingId = panel?.getAttribute("aria-labelledby");
    const form = document.querySelector(`[data-testid="${ids.form}"]`);
    const layerRows = document.querySelector(`[data-testid="${ids.layerRows}"]`);
    const importedSources = document.querySelector(`[data-testid="${ids.importedSources}"]`);
    const submit = document.querySelector(`[data-testid="${ids.submit}"]`);
    const addLayer = document.querySelector(`[data-testid="${ids.addLayer}"]`);

    const readLabel = (name) => {
      const control = form?.elements.namedItem(name);
      if (!(control instanceof HTMLElement)) {
        return "";
      }

      const label = control.closest("label");
      if (label === null) {
        return "";
      }

      return [...label.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent ?? "")
        .join("")
        .trim();
    };

    return {
      panelName: headingId === null ? "" : document.getElementById(headingId)?.textContent ?? "",
      formName: form?.getAttribute("aria-label") ?? "",
      layerRowsName: layerRows?.getAttribute("aria-label") ?? "",
      importedSourcesName: importedSources?.getAttribute("aria-label") ?? "",
      submitName: submit?.textContent?.trim() ?? "",
      addLayerName: addLayer?.textContent?.trim() ?? "",
      labels: {
        intakeMode: readLabel("intakeMode"),
        manifestPath: readLabel("manifestPath"),
        sourceAssetId: readLabel("sourceAssetId"),
        psdAdapterName: readLabel("psdAdapterName"),
        psdCanvasWidth: readLabel("psdCanvasWidth"),
        psdCanvasHeight: readLabel("psdCanvasHeight"),
        placementPolicy: readLabel("placementPolicy"),
        rightsStatus: readLabel("rightsStatus"),
        creator: readLabel("creator"),
        license: readLabel("license"),
        sourceLayerId: readLabel("sourceLayerId.0"),
        texturePreviewReference: readLabel("texturePreviewReference.0"),
        textureId: readLabel("textureId.0"),
        targetPartId: readLabel("targetPartId.0"),
        role: readLabel("role.0"),
        width: readLabel("width.0")
      }
    };
  }, {
    panel: editorTestIds.sourceIntakePanel,
    form: editorTestIds.sourceIntakeForm,
    layerRows: editorTestIds.sourceIntakeLayerRows,
    importedSources: editorTestIds.sourceIntakeImportedSources,
    submit: editorTestIds.sourceIntakeSubmit,
    addLayer: editorTestIds.sourceIntakeAddLayer
  });

  const expected = {
    panelName: "Source Intake",
    formName: "Confirm source intake adapter profile draft",
    layerRowsName: "Source intake layer rows",
    importedSourcesName: "Imported source assets",
    submitName: "Confirm source draft",
    addLayerName: "Add layer row",
    labels: {
      intakeMode: "Source intake mode",
      manifestPath: "Split PNG manifest path / PSD source reference",
      sourceAssetId: "Source asset ID",
      psdAdapterName: "PSD adapter/profile name",
      psdCanvasWidth: "PSD canvas width",
      psdCanvasHeight: "PSD canvas height",
      placementPolicy: "Placement policy",
      rightsStatus: "Rights status",
      creator: "Creator",
      license: "License",
      sourceLayerId: "Layer ID",
      texturePreviewReference: "Texture preview reference",
      textureId: "Texture ID",
      targetPartId: "Target part ID",
      role: "Layer role",
      width: "Width"
    }
  };

  if (JSON.stringify(names) !== JSON.stringify(expected)) {
    throw new Error(
      `Source intake accessible names mismatch: expected ${JSON.stringify(expected)}, received ${JSON.stringify(names)}.`
    );
  }
};

const assertPsdNativeFormValidation = async (page, input) => {
  const validation = await page.evaluate((ids, values) => {
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

    setValue("intakeMode", "psdAdapterProfile");
    setValue("manifestPath", values.manifestPath);
    setValue("sourceAssetId", values.sourceAssetId);
    setValue("contentHash", values.contentHash);
    setValue("psdAdapterName", values.adapterName);
    setValue("psdCanvasWidth", values.canvasWidth);
    setValue("psdCanvasHeight", values.canvasHeight);
    setValue("defaultPartId", values.defaultPartId);
    setValue("rightsStatus", "cleared");
    setValue("creator", values.creator);
    setValue("license", values.license);
    setValue("sourceLayerId.0", values.sourceLayerId);
    setValue("originalName.0", values.originalName);
    setValue("normalizedName.0", values.normalizedName);
    setValue("groupPath.0", values.groupPath);
    setValue("x.0", values.bounds.x);
    setValue("y.0", values.bounds.y);
    setValue("width.0", values.bounds.width);
    setValue("height.0", values.bounds.height);
    setValue("opacityInSource.0", 1);
    setValue("texturePreviewReference.0", "");
    setValue("textureId.0", "");
    setValue("targetPartId.0", "");
    setValue("role.0", "unsupported");

    const texturePreview = form.elements.namedItem("texturePreviewReference.0");
    const textureId = form.elements.namedItem("textureId.0");
    const role = form.elements.namedItem("role.0");

    if (
      !(texturePreview instanceof HTMLInputElement) ||
      !(textureId instanceof HTMLInputElement) ||
      !(role instanceof HTMLSelectElement)
    ) {
      throw new Error("PSD native validation controls were missing.");
    }

    const unsupportedState = {
      texturePreviewRequired: texturePreview.required,
      textureIdRequired: textureId.required,
      texturePreviewValueMissing: texturePreview.validity.valueMissing,
      textureIdValueMissing: textureId.validity.valueMissing,
      formValid: form.checkValidity()
    };

    setValue("role.0", "editableLayer");

    const mappedState = {
      texturePreviewRequired: texturePreview.required,
      textureIdRequired: textureId.required,
      texturePreviewValueMissing: texturePreview.validity.valueMissing,
      textureIdValueMissing: textureId.validity.valueMissing,
      formValid: form.checkValidity()
    };

    return {
      unsupportedState,
      mappedState
    };
  }, {
    form: editorTestIds.sourceIntakeForm
  }, input);

  const expected = {
    unsupportedState: {
      texturePreviewRequired: false,
      textureIdRequired: false,
      texturePreviewValueMissing: false,
      textureIdValueMissing: false,
      formValid: true
    },
    mappedState: {
      texturePreviewRequired: true,
      textureIdRequired: true,
      texturePreviewValueMissing: true,
      textureIdValueMissing: true,
      formValid: false
    }
  };

  if (JSON.stringify(validation) !== JSON.stringify(expected)) {
    throw new Error(
      `PSD native form validation mismatch: expected ${JSON.stringify(expected)}, received ${JSON.stringify(
        validation
      )}.`
    );
  }
};

const setSourceIntakeFormValues = async (page, input) => {
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
    setValue("psdCanvasWidth", values.canvasWidth);
    setValue("psdCanvasHeight", values.canvasHeight);
    setValue("defaultPartId", values.defaultPartId);
    setValue("placementPolicy", "use-metadata");
    setValue("rightsStatus", "cleared");
    setValue("creator", values.creator);
    setValue("license", values.license);
    setValue("sourceUrl", values.sourceUrl);
    setValue("notes", values.notes);
    setChecked("redistributionAllowed", values.redistributionAllowed);
    setChecked("aiUsed", values.aiUsed);
    setValue("sourceLayerId.0", values.sourceLayerId);
    setValue("originalName.0", values.originalName);
    setValue("normalizedName.0", values.normalizedName);
    setValue("groupPath.0", values.groupPath);
    setValue("texturePreviewReference.0", values.texturePreviewReference);
    setValue("textureId.0", values.textureId);
    setValue("targetPartId.0", values.defaultPartId);
    setValue("x.0", values.bounds.x);
    setValue("y.0", values.bounds.y);
    setValue("width.0", values.bounds.width);
    setValue("height.0", values.bounds.height);
    setValue("opacityInSource.0", 1);
    setValue("role.0", "editableLayer");
    setChecked("visibleInSource.0", true);
    setValue("unsupportedFeatures.0", values.unsupportedFeatures);
  }, {
    form: editorTestIds.sourceIntakeForm
  }, input);
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
  await page.waitFor(
    `${testId} text ${expectedText}`,
    (id, text) => document.querySelector(`[data-testid="${id}"]`)?.textContent?.includes(text) ?? false,
    { timeoutMs: 8_000 },
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
    { timeoutMs: 8_000 },
    editorTestIds.operationLogSummary,
    expectedCount
  );
};
