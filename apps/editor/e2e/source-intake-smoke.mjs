import {
  createImportedSourceAssetRowTestId,
  editorTestIds
} from "./test-ids.mjs";

export const sourceIntakeSmoke = {
  sourceAssetId: "src_e2e_split_png_smoke",
  sourceLayerId: "layer_e2e_body",
  manifestPath: "assets/sources/e2e-character/split-png-manifest.json",
  contentHash: "sha256:e2e-source-intake-smoke",
  defaultPartId: "part_root",
  creator: "E2E Rights Fixture",
  license: "CC0-1.0",
  sourceUrl: "https://example.invalid/private-2d-rigging-lab/e2e-source",
  notes: "Metadata-only E2E source intake; PNG decode is not exercised.",
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
  await waitForText(page, editorTestIds.sourceIntakeSummary, "No manifest path");
  await waitForText(page, editorTestIds.sourceIntakeImportedSources, "0 imported source assets");

  await assertSourceIntakePanelReachable(page, viewport);
  await assertSourceIntakeAccessibleNames(page);
  await setSourceIntakeFormValues(page, sourceIntakeSmoke);
  await clickTestId(page, editorTestIds.sourceIntakeSubmit);

  const importedSourceRow = createImportedSourceAssetRowTestId(sourceIntakeSmoke.sourceAssetId);
  await waitForText(page, editorTestIds.operationStatus, "importSplitPngSourceAsset committed");
  await waitForText(page, editorTestIds.sourceIntakeSummary, "Draft confirmed");
  await waitForText(page, editorTestIds.sourceIntakeSummary, sourceIntakeSmoke.manifestPath);
  await waitForText(page, editorTestIds.sourceIntakeSummary, "Cleared / CC0-1.0");
  await waitForText(page, editorTestIds.sourceIntakeImportedSources, "1 imported source asset");
  await waitForText(page, importedSourceRow, sourceIntakeSmoke.sourceAssetId);
  await waitForText(page, importedSourceRow, sourceIntakeSmoke.manifestPath);
  await waitForText(page, importedSourceRow, sourceIntakeSmoke.sourceLayerId);
  await waitForText(page, importedSourceRow, "0 mapped drawables");
  await waitForText(
    page,
    editorTestIds.drawableAuthoringPanel,
    `${sourceIntakeSmoke.sourceAssetId} / ${sourceIntakeSmoke.sourceLayerId}`
  );
  await waitForOperationLogEntryCount(page, initialOperationLogEntryCount + 1);
  await waitForText(page, editorTestIds.operationLogSummary, "importSplitPngSourceAsset");

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
    const importEntry = operationLogEntries.find(
      (entry) =>
        entry.operationType === "importSplitPngSourceAsset" &&
        Array.isArray(entry.targetIds) &&
        entry.targetIds.includes(expected.sourceAssetId) &&
        entry.targetIds.includes(expected.sourceLayerId)
    );

    return {
      sourceAssetId: sourceAsset?.sourceAssetId ?? null,
      sourceFilePath: sourceAsset?.filePath ?? null,
      sourceDiagnostics: sourceAsset?.diagnostics ?? [],
      layerMappedDrawableIds: sourceLayer?.mappedDrawableIds ?? [],
      rightsStatus: rightsRecord?.rightsStatus ?? null,
      rightsLicense: rightsRecord?.license ?? null,
      provenanceCreator: provenanceRecord?.creator ?? null,
      provenanceLicense: provenanceRecord?.license ?? null,
      provenanceHistory: provenanceRecord?.transformHistory ?? [],
      drawableSourceAssetId: drawable?.sourceAssetId ?? null,
      importEntryPresent: importEntry !== undefined
    };

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
    creator: sourceIntakeSmoke.creator,
    license: sourceIntakeSmoke.license,
    drawableId: smokeDrawable.drawableId
  });

  const expected = {
    sourceAssetId: sourceIntakeSmoke.sourceAssetId,
    sourceFilePath: sourceIntakeSmoke.manifestPath,
    sourceDiagnostics: ["split-png-fallback-v1"],
    layerMappedDrawableIds: [smokeDrawable.drawableId],
    rightsStatus: "cleared",
    rightsLicense: sourceIntakeSmoke.license,
    provenanceCreator: sourceIntakeSmoke.creator,
    provenanceLicense: sourceIntakeSmoke.license,
    provenanceHistory: [
      "importSplitPngSourceAsset:manifest-metadata",
      `source-intake-note:${sourceIntakeSmoke.notes}`
    ],
    drawableSourceAssetId: sourceIntakeSmoke.sourceAssetId,
    importEntryPresent: true
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
  await waitForText(page, importedSourceRow, sourceIntakeSmoke.sourceLayerId);
  await waitForText(page, importedSourceRow, "1 mapped drawable");
};

export const assertSourceIntakeStateAfterReset = async (page) => {
  await waitForText(page, editorTestIds.sourceIntakeSummary, "No manifest path");
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
        manifestPath: readLabel("manifestPath"),
        sourceAssetId: readLabel("sourceAssetId"),
        placementPolicy: readLabel("placementPolicy"),
        rightsStatus: readLabel("rightsStatus"),
        creator: readLabel("creator"),
        license: readLabel("license"),
        sourceLayerId: readLabel("sourceLayerId.0"),
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
    formName: "Confirm split PNG source intake draft",
    layerRowsName: "Split PNG source layer rows",
    importedSourcesName: "Imported source assets",
    submitName: "Confirm source draft",
    addLayerName: "Add layer row",
    labels: {
      manifestPath: "Split PNG manifest path",
      sourceAssetId: "Source asset ID",
      placementPolicy: "Placement policy",
      rightsStatus: "Rights status",
      creator: "Creator",
      license: "License",
      sourceLayerId: "Layer ID",
      width: "Width"
    }
  };

  if (JSON.stringify(names) !== JSON.stringify(expected)) {
    throw new Error(
      `Source intake accessible names mismatch: expected ${JSON.stringify(expected)}, received ${JSON.stringify(names)}.`
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

    setValue("manifestPath", values.manifestPath);
    setValue("sourceAssetId", values.sourceAssetId);
    setValue("contentHash", values.contentHash);
    setValue("defaultPartId", values.defaultPartId);
    setValue("placementPolicy", "use-metadata");
    setValue("rightsStatus", "cleared");
    setValue("creator", values.creator);
    setValue("license", values.license);
    setValue("sourceUrl", values.sourceUrl);
    setValue("notes", values.notes);
    setChecked("redistributionAllowed", true);
    setChecked("aiUsed", false);
    setValue("sourceLayerId.0", values.sourceLayerId);
    setValue("originalName.0", "E2E Body");
    setValue("normalizedName.0", "e2e_body");
    setValue("groupPath.0", "Root/Character");
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
