import {
  createMeshVertexNudgeButtonTestId,
  createMeshVertexRowTestId,
  editorTestIds
} from "./test-ids.mjs";

const meshVertexNudgeDirection = "right";

export const createSmokeMeshVertexId = (drawableId) =>
  `vtx_${drawableId.startsWith("draw_") ? drawableId.slice("draw_".length) : drawableId}_0_0`;

export const runMeshVertexEditWorkflow = async ({
  page,
  viewport,
  smokeDrawable,
  initialOperationLogEntryCount = 3
}) => {
  const vertexId = createSmokeMeshVertexId(smokeDrawable.drawableId);
  const vertexRowId = createMeshVertexRowTestId(smokeDrawable.meshId, vertexId);
  const nudgeButtonId = createMeshVertexNudgeButtonTestId(
    smokeDrawable.meshId,
    vertexId,
    meshVertexNudgeDirection
  );
  const initialPosition = {
    x: smokeDrawable.bounds.x,
    y: smokeDrawable.bounds.y
  };
  const nudgedPosition = {
    x: smokeDrawable.bounds.x + 1,
    y: smokeDrawable.bounds.y
  };

  await waitForTestId(page, editorTestIds.meshVertexControls);
  await waitForTestId(page, editorTestIds.meshVertexStatus);
  await waitForTestId(page, vertexRowId);
  await waitForTestId(page, nudgeButtonId);
  await waitForText(page, editorTestIds.meshVertexStatus, smokeDrawable.meshId);
  await waitForText(page, editorTestIds.meshVertexStatus, "9 editable vertices");
  await waitForText(page, editorTestIds.meshVertexStatus, "No mesh edit committed");
  await waitForText(page, vertexRowId, `#0 ${vertexId}`);
  await waitForText(page, vertexRowId, formatPositionLabel(initialPosition));
  await waitForText(page, editorTestIds.previewSummary, "2 visible / 2 total");
  await assertMeshVertexControlsReachable(page, viewport, nudgeButtonId);
  await assertMeshVertexAccessibleNames(page, {
    vertexId,
    vertexRowId,
    nudgeButtonId
  });

  const initialState = await readMeshVertexEditState(page, {
    drawableId: smokeDrawable.drawableId,
    vertexRowId,
    nudgeButtonId
  });

  if (!initialState.visualPoints.includes(formatSvgPoint(initialPosition))) {
    throw new Error(
      `Initial mesh preview points did not include ${formatSvgPoint(initialPosition)}: ${initialState.visualPoints}.`
    );
  }

  await clickTestId(page, nudgeButtonId);
  await page.waitFor(
    "mesh vertex nudge updates labels and preview visual",
    (ids, expected) => {
      const row = document.querySelector(`[data-testid="${ids.row}"]`);
      const status = document.querySelector(`[data-testid="${ids.status}"]`);
      const summary = document.querySelector(`[data-testid="${ids.summary}"]`);
      const visual = document.querySelector(`[data-testid="${ids.visual}"]`);
      const drawable = visual?.querySelector(`[data-drawable-id="${expected.drawableId}"]`);
      const points = drawable?.getAttribute("points") ?? "";

      return (
        (row?.textContent?.includes(expected.positionLabel) ?? false) &&
        (status?.textContent?.includes("moveMeshVertex committed") ?? false) &&
        (summary?.textContent?.includes("2 visible / 2 total") ?? false) &&
        points.length > 0 &&
        points !== expected.initialVisualPoints &&
        points.includes(expected.svgPoint)
      );
    },
    { timeoutMs: 8_000 },
    {
      row: vertexRowId,
      status: editorTestIds.meshVertexStatus,
      summary: editorTestIds.previewSummary,
      visual: editorTestIds.previewVisual
    },
    {
      drawableId: smokeDrawable.drawableId,
      initialVisualPoints: initialState.visualPoints,
      positionLabel: formatPositionLabel(nudgedPosition),
      svgPoint: formatSvgPoint(nudgedPosition)
    }
  );
  await waitForOperationLogEntryCount(page, initialOperationLogEntryCount + 1);
  await waitForText(page, editorTestIds.operationLogSummary, "moveMeshVertex");

  const changedState = await readMeshVertexEditState(page, {
    drawableId: smokeDrawable.drawableId,
    vertexRowId,
    nudgeButtonId
  });

  if (!changedState.previewSummary.includes("0 changes / 0 drawables")) {
    throw new Error(`Unexpected post-nudge preview summary: ${changedState.previewSummary}.`);
  }

  const screenshot = await page.captureScreenshot(`${viewport.name} mesh vertex edit smoke`);

  return {
    viewport: viewport.name,
    meshId: smokeDrawable.meshId,
    vertexId,
    initialPosition,
    nudgedPosition,
    initialPreviewSummary: initialState.previewSummary,
    changedPreviewSummary: changedState.previewSummary,
    initialVisualPoints: initialState.visualPoints,
    changedVisualPoints: changedState.visualPoints,
    rowText: changedState.rowText,
    screenshot
  };
};

export const assertSavedMeshVertexState = async ({ page, storageKey, smokeDrawable }) => {
  const vertexId = createSmokeMeshVertexId(smokeDrawable.drawableId);
  const expectedPosition = {
    x: smokeDrawable.bounds.x + 1,
    y: smokeDrawable.bounds.y
  };
  const saved = await page.evaluate((key, meshId, vertexIdToFind) => {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      return null;
    }

    const project = JSON.parse(raw);
    const meshes = readPackageJsonFile(project, "model/meshes.json")?.meshes ?? [];
    const mesh = meshes.find((candidate) => candidate.meshId === meshId);
    const vertexIndex = mesh?.vertexStableIds?.indexOf(vertexIdToFind) ?? -1;
    const position = vertexIndex < 0 ? null : mesh?.vertices?.[vertexIndex] ?? null;
    const operationLogEntries = String(project.operationLogJsonl ?? "")
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line));
    const moveEntry = operationLogEntries.find(
      (entry) =>
        entry.operationType === "moveMeshVertex" &&
        Array.isArray(entry.targetIds) &&
        entry.targetIds.includes(vertexIdToFind)
    );

    return {
      meshId: mesh?.meshId ?? null,
      vertexIndex,
      position,
      moveEntryPresent: moveEntry !== undefined,
      moveEntryTargetIds: moveEntry?.targetIds ?? []
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
  }, storageKey, smokeDrawable.meshId, vertexId);

  const expected = {
    meshId: smokeDrawable.meshId,
    vertexIndex: 0,
    position: expectedPosition,
    moveEntryPresent: true,
    moveEntryTargetIds: [smokeDrawable.meshId, vertexId]
  };

  if (JSON.stringify(saved) !== JSON.stringify(expected)) {
    throw new Error(
      `Saved mesh vertex state mismatch: expected ${JSON.stringify(expected)}, received ${JSON.stringify(saved)}.`
    );
  }
};

export const assertMeshVertexStateAfterLoad = async ({ page, smokeDrawable }) => {
  const vertexId = createSmokeMeshVertexId(smokeDrawable.drawableId);
  const vertexRowId = createMeshVertexRowTestId(smokeDrawable.meshId, vertexId);
  const expectedPositionLabel = formatPositionLabel({
    x: smokeDrawable.bounds.x + 1,
    y: smokeDrawable.bounds.y
  });

  await waitForTestId(page, editorTestIds.meshVertexControls);
  await waitForTestId(page, editorTestIds.meshVertexStatus);
  await waitForTestId(page, vertexRowId);
  await waitForText(page, editorTestIds.meshVertexStatus, smokeDrawable.meshId);
  await waitForText(page, editorTestIds.meshVertexStatus, "9 editable vertices");
  await waitForText(page, vertexRowId, `#0 ${vertexId}`);
  await waitForText(page, vertexRowId, expectedPositionLabel);
};

const assertMeshVertexControlsReachable = async (page, viewport, nudgeButtonId) => {
  const metrics = await page.evaluate((ids) => {
    const controls = document.querySelector(`[data-testid="${ids.controls}"]`);
    const status = document.querySelector(`[data-testid="${ids.status}"]`);
    const button = document.querySelector(`[data-testid="${ids.button}"]`);

    if (!(controls instanceof HTMLElement) || !(status instanceof HTMLElement) || !(button instanceof HTMLButtonElement)) {
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

    button.scrollIntoView({ block: "center", inline: "nearest" });

    const controlsRect = controls.getBoundingClientRect();
    const statusRect = status.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();

    return {
      controlsVisible: rectVisible(controlsRect),
      statusVisible: rectVisible(statusRect),
      buttonVisible: rectVisible(buttonRect),
      controlsWidth: controlsRect.width,
      buttonWidth: buttonRect.width
    };
  }, {
    controls: editorTestIds.meshVertexControls,
    status: editorTestIds.meshVertexStatus,
    button: nudgeButtonId
  });

  if (
    metrics === null ||
    !metrics.controlsVisible ||
    !metrics.statusVisible ||
    !metrics.buttonVisible ||
    metrics.controlsWidth < 1 ||
    metrics.buttonWidth < 1
  ) {
    throw new Error(
      `${viewport.name} mesh vertex controls were not reachable/usable: ${JSON.stringify(metrics)}.`
    );
  }
};

const assertMeshVertexAccessibleNames = async (
  page,
  { vertexId, vertexRowId, nudgeButtonId }
) => {
  const names = await page.evaluate((ids) => {
    const controls = document.querySelector(`[data-testid="${ids.controls}"]`);
    const headingId = controls?.getAttribute("aria-labelledby");
    const status = document.querySelector(`[data-testid="${ids.status}"]`);
    const row = document.querySelector(`[data-testid="${ids.row}"]`);
    const button = document.querySelector(`[data-testid="${ids.button}"]`);

    if (!(button instanceof HTMLButtonElement)) {
      throw new Error(`Missing mesh vertex nudge button ${ids.button}.`);
    }

    return {
      controlsName: headingId === null ? "" : document.getElementById(headingId)?.textContent ?? "",
      statusRole: status?.getAttribute("role") ?? "",
      statusName: status?.getAttribute("aria-label") ?? "",
      rowText: row?.textContent ?? "",
      buttonText: button.textContent?.trim() ?? "",
      buttonName: button.getAttribute("aria-label") ?? "",
      buttonDisabled: button.disabled
    };
  }, {
    controls: editorTestIds.meshVertexControls,
    status: editorTestIds.meshVertexStatus,
    row: vertexRowId,
    button: nudgeButtonId
  });

  const expected = {
    controlsName: "Mesh Vertex Controls",
    statusRole: "status",
    statusName: "Mesh vertex edit status",
    rowTextIncludes: [`#0 ${vertexId}`, "84, 24"],
    buttonText: "+X",
    buttonName: `Nudge ${vertexId} right`,
    buttonDisabled: false
  };

  if (
    names.controlsName !== expected.controlsName ||
    names.statusRole !== expected.statusRole ||
    names.statusName !== expected.statusName ||
    names.buttonText !== expected.buttonText ||
    names.buttonName !== expected.buttonName ||
    names.buttonDisabled !== expected.buttonDisabled ||
    !expected.rowTextIncludes.every((text) => names.rowText.includes(text))
  ) {
    throw new Error(
      `Mesh vertex accessible names mismatch: expected ${JSON.stringify(expected)}, received ${JSON.stringify(names)}.`
    );
  }
};

const readMeshVertexEditState = async (
  page,
  { drawableId, vertexRowId, nudgeButtonId }
) =>
  page.evaluate((ids, target) => {
    const row = document.querySelector(`[data-testid="${target.row}"]`);
    const status = document.querySelector(`[data-testid="${ids.status}"]`);
    const summary = document.querySelector(`[data-testid="${ids.summary}"]`);
    const visual = document.querySelector(`[data-testid="${ids.visual}"]`);
    const button = document.querySelector(`[data-testid="${target.button}"]`);
    const drawable = visual?.querySelector(`[data-drawable-id="${target.drawableId}"]`);

    if (!(button instanceof HTMLButtonElement)) {
      throw new Error(`Mesh vertex nudge button ${target.button} was missing.`);
    }

    return {
      rowText: row?.textContent ?? "",
      statusText: status?.textContent ?? "",
      previewSummary: summary?.textContent ?? "",
      visualPoints: drawable?.getAttribute("points") ?? "",
      buttonText: button.textContent?.trim() ?? "",
      buttonName: button.getAttribute("aria-label") ?? "",
      buttonDisabled: button.disabled
    };
  }, {
    status: editorTestIds.meshVertexStatus,
    summary: editorTestIds.previewSummary,
    visual: editorTestIds.previewVisual
  }, {
    drawableId,
    row: vertexRowId,
    button: nudgeButtonId
  });

const formatPositionLabel = (position) => `${position.x}, ${position.y}`;

const formatSvgPoint = (position) => `${position.x},${position.y}`;

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
