import {
  createPreviewParameterControlTestId,
  createViewerParameterControlTestId,
  editorProjectStorageKey,
  editorTestIds
} from "./test-ids.mjs";

const viewerSmoke = {
  parameterId: "param_preview_body_yaw",
  drawableId: "draw_body",
  packageId: "pkg_editor_browser_sample"
};

export const runViewerRuntimePersistenceSmoke = async ({ page, viewport }) => {
  await waitForTestId(page, editorTestIds.projectPersistencePanel);
  await clickTestId(page, editorTestIds.projectPersistenceSave);
  await waitForText(page, editorTestIds.projectPersistenceStatus, "Saved");
  await assertSavedViewerProject(page, "before viewer reload");

  await page.reload();
  await waitForTestId(page, editorTestIds.shell);
  await clickTestId(page, editorTestIds.projectPersistenceLoad);
  await waitForText(page, editorTestIds.projectPersistenceStatus, "Loaded");
  await assertSavedViewerProject(page, "after viewer reload");

  await clickTestId(page, editorTestIds.viewerRuntimeOpen);
  await waitForTestId(page, editorTestIds.viewerRuntimePanel);
  await assertViewerRuntimeReachable(page, viewport);
  await assertViewerRuntimeAccessibleBasics(page);
  await assertViewerRuntimeDefaultSnapshot(page);
  const initialViewer = await readViewerRuntimeState(page);
  const initialPreviewPoints = await readPreviewVisualPoints(page);

  await setViewerSliderValue(page, viewerSmoke.parameterId, 1);
  await assertViewerRuntimeOverride(page);
  const changedViewer = await readViewerRuntimeState(page);
  const previewPointsAfterViewerOverride = await readPreviewVisualPoints(page);

  if (previewPointsAfterViewerOverride !== initialPreviewPoints) {
    throw new Error("Viewer parameter override leaked into the editor preview slider state.");
  }

  await setPreviewSliderValue(page, viewerSmoke.parameterId, 1);
  await waitForText(page, editorTestIds.previewSummary, "changes / 1 drawable");
  const changedPreviewPoints = await readPreviewVisualPoints(page);

  if (changedPreviewPoints === initialPreviewPoints) {
    throw new Error("Preview did not respond to the same parameter value used by the viewer smoke.");
  }

  await assertViewerRuntimeDiagnosticsObservable(page);
  await assertViewerRuntimePackageState(page);
  const screenshot = await page.captureScreenshot(`${viewport.name} wave24 viewer runtime smoke`);

  return {
    viewport: viewport.name,
    parameterId: viewerSmoke.parameterId,
    initialViewer,
    changedViewer,
    initialPreviewPoints,
    changedPreviewPoints,
    screenshot
  };
};

const assertSavedViewerProject = async (page, label) => {
  const saved = await page.evaluate((storageKey, expectedPackageId) => {
    const raw = localStorage.getItem(storageKey);
    if (raw === null) {
      return null;
    }

    const project = JSON.parse(raw);
    const packagePaths = Array.isArray(project.packageFileSet)
      ? project.packageFileSet.map((entry) => entry.path)
      : [];

    return {
      schemaVersion: project.schemaVersion,
      packageId: project.packageSummary?.packageId ?? null,
      hasParameters: packagePaths.includes("model/parameters.json"),
      hasDrawables: packagePaths.includes("model/drawables.json"),
      packageFileCount: packagePaths.length,
      expectedPackageId
    };
  }, editorProjectStorageKey, viewerSmoke.packageId);

  if (
    saved === null ||
    saved.schemaVersion !== "editor-project-persistence-v1" ||
    saved.packageId !== saved.expectedPackageId ||
    !saved.hasParameters ||
    !saved.hasDrawables ||
    saved.packageFileCount < 1
  ) {
    throw new Error(`Saved viewer project mismatch during ${label}: ${JSON.stringify(saved)}.`);
  }
};

const assertViewerRuntimeDefaultSnapshot = async (page) => {
  await waitForText(page, editorTestIds.viewerRuntimePackageState, viewerSmoke.packageId);
  await waitForText(page, editorTestIds.viewerRuntimePackageState, "Loaded");
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, "Runtime Snapshot");
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, "viewer");
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, "0 override");
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, "snap_editor_browser_sample_");
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, "runtime/states/");
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, `${viewerSmoke.parameterId}: 0`);
  await waitForText(page, editorTestIds.viewerRuntimeDiff, "Runtime Diff");
  await waitForText(page, editorTestIds.viewerRuntimeDiff, "None");
};

const assertViewerRuntimeOverride = async (page) => {
  await page.waitFor(
    "viewer runtime parameter override",
    (ids, expected) => {
      const slider = document.querySelector(`[data-testid="${ids.slider}"]`);
      const snapshot = document.querySelector(`[data-testid="${ids.snapshot}"]`);
      const diff = document.querySelector(`[data-testid="${ids.diff}"]`);

      return (
        slider instanceof HTMLInputElement &&
        slider.value === "1" &&
        (snapshot?.textContent?.includes("1 override") ?? false) &&
        (snapshot?.textContent?.includes(`${expected.parameterId}: 1 / authoredInput / viewerOverride`) ??
          false) &&
        (diff?.textContent?.includes(expected.drawableId) ?? false)
      );
    },
    { timeoutMs: 8_000 },
    {
      slider: createViewerParameterControlTestId(viewerSmoke.parameterId),
      snapshot: editorTestIds.viewerRuntimeSnapshotSummary,
      diff: editorTestIds.viewerRuntimeDiff
    },
    viewerSmoke
  );
};

const assertViewerRuntimeDiagnosticsObservable = async (page) => {
  await waitForText(page, editorTestIds.viewerRuntimeDiagnostics, "Validation Diagnostics");
  await waitForText(page, editorTestIds.viewerRuntimeDiagnostics, "val_editor_browser_sample_editorIncremental");
  await waitForText(page, editorTestIds.viewerRuntimeDiagnostics, "checks");
  await waitForText(page, editorTestIds.viewerRuntimeDiagnostics, "No diagnostics");
};

const assertViewerRuntimePackageState = async (page) => {
  const facts = await readFacts(page, editorTestIds.viewerRuntimePackageState);

  if (
    facts.Package !== viewerSmoke.packageId ||
    !facts.Revision?.includes("package r") ||
    !facts.Storage?.includes("Loaded") ||
    facts.Reload !== "reloaded"
  ) {
    throw new Error(`Viewer package state facts were not recomputed after load: ${JSON.stringify(facts)}.`);
  }
};

const assertViewerRuntimeReachable = async (page, viewport) => {
  const metrics = await page.evaluate((ids) => {
    const panel = document.querySelector(`[data-testid="${ids.panel}"]`);
    const slider = document.querySelector(`[data-testid="${ids.slider}"]`);

    if (!(panel instanceof HTMLElement) || !(slider instanceof HTMLInputElement)) {
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

    slider.scrollIntoView({ block: "center", inline: "nearest" });
    const panelRect = panel.getBoundingClientRect();
    const sliderRect = slider.getBoundingClientRect();

    return {
      panelVisible: rectVisible(panelRect),
      sliderVisible: rectVisible(sliderRect),
      panelWidth: panelRect.width,
      sliderWidth: sliderRect.width
    };
  }, {
    panel: editorTestIds.viewerRuntimePanel,
    slider: createViewerParameterControlTestId(viewerSmoke.parameterId)
  });

  if (
    metrics === null ||
    !metrics.panelVisible ||
    !metrics.sliderVisible ||
    metrics.panelWidth < 1 ||
    metrics.sliderWidth < 1
  ) {
    throw new Error(`${viewport.name} viewer runtime panel was not reachable: ${JSON.stringify(metrics)}.`);
  }
};

const assertViewerRuntimeAccessibleBasics = async (page) => {
  const names = await page.evaluate((ids) => {
    const open = document.querySelector(`[data-testid="${ids.open}"]`);
    const panel = document.querySelector(`[data-testid="${ids.panel}"]`);
    const headingId = panel?.getAttribute("aria-labelledby");
    const close = document.querySelector(`[data-testid="${ids.close}"]`);
    const reset = document.querySelector(`[data-testid="${ids.reset}"]`);
    const slider = document.querySelector(`[data-testid="${ids.slider}"]`);

    return {
      openExpanded: open?.getAttribute("aria-expanded") ?? "",
      panelName: headingId === null ? "" : document.getElementById(headingId)?.textContent ?? "",
      closeName: close?.textContent?.trim() ?? "",
      resetName: reset?.textContent?.trim() ?? "",
      sliderName: slider?.getAttribute("aria-label") ?? ""
    };
  }, {
    open: editorTestIds.viewerRuntimeOpen,
    panel: editorTestIds.viewerRuntimePanel,
    close: editorTestIds.viewerRuntimeClose,
    reset: editorTestIds.viewerRuntimeReset,
    slider: createViewerParameterControlTestId(viewerSmoke.parameterId)
  });

  const expected = {
    openExpanded: "true",
    panelName: "Viewer / Runtime",
    closeName: "Close Viewer / Runtime",
    resetName: "Reset viewer parameters",
    sliderName: "Viewer Preview Body Yaw"
  };

  if (JSON.stringify(names) !== JSON.stringify(expected)) {
    throw new Error(
      `Viewer runtime accessible basics mismatch: expected ${JSON.stringify(expected)}, received ${JSON.stringify(
        names
      )}.`
    );
  }
};

const readViewerRuntimeState = async (page) => ({
  snapshotFacts: await readFacts(page, editorTestIds.viewerRuntimeSnapshotSummary),
  diffFacts: await readFacts(page, editorTestIds.viewerRuntimeDiff),
  snapshotText: await readText(page, editorTestIds.viewerRuntimeSnapshotSummary),
  diagnosticsText: await readText(page, editorTestIds.viewerRuntimeDiagnostics)
});

const readFacts = async (page, testId) =>
  page.evaluate((id) => {
    const root = document.querySelector(`[data-testid="${id}"]`);
    const facts = {};

    for (const term of root?.querySelectorAll("dt") ?? []) {
      const key = term.textContent?.trim() ?? "";
      const value = term.nextElementSibling?.textContent?.trim() ?? "";
      facts[key] = value;
    }

    return facts;
  }, testId);

const readText = async (page, testId) =>
  page.evaluate((id) => document.querySelector(`[data-testid="${id}"]`)?.textContent ?? "", testId);

const readPreviewVisualPoints = async (page) =>
  page.evaluate((ids, drawableId) => {
    const visual = document.querySelector(`[data-testid="${ids.visual}"]`);
    return visual?.querySelector(`[data-drawable-id="${drawableId}"]`)?.getAttribute("points") ?? "";
  }, {
    visual: editorTestIds.previewVisual
  }, viewerSmoke.drawableId);

const setViewerSliderValue = async (page, parameterId, value) => {
  await page.evaluate((testId, nextValue) => {
    const input = document.querySelector(`[data-testid="${testId}"]`);

    if (!(input instanceof HTMLInputElement)) {
      throw new Error(`Viewer slider ${testId} was missing.`);
    }

    input.value = String(nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, createViewerParameterControlTestId(parameterId), value);
};

const setPreviewSliderValue = async (page, parameterId, value) => {
  await page.evaluate((testId, nextValue) => {
    const input = document.querySelector(`[data-testid="${testId}"]`);

    if (!(input instanceof HTMLInputElement)) {
      throw new Error(`Preview slider ${testId} was missing.`);
    }

    input.value = String(nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, createPreviewParameterControlTestId(parameterId), value);
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
