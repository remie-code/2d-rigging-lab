import {
  createDrawableMoveDownTestId,
  createDrawableMoveUpTestId,
  createDrawableRowTestId,
  createDrawableVisibilityToggleTestId,
  editorTestIds
} from "./test-ids.mjs";
import {
  assertScopedTestIdUnique,
  clickScopedTestId,
  selectorScopes,
  waitForScopedText
} from "./selector-scopes.mjs";

const sampleBodyDrawableId = "draw_body";

export const runLayerControlsWorkflow = async ({
  page,
  viewport,
  smokeDrawable,
  initialOperationLogEntryCount = 3
}) => {
  await waitForTestId(page, editorTestIds.drawableLayerStatus);
  await waitForText(page, editorTestIds.drawableLayerStatus, "2 layers");
  await waitForText(page, editorTestIds.drawableLayerStatus, "No layer operation committed");
  await assertLayerControlState(page, {
    smokeDrawable,
    expectedOrder: [sampleBodyDrawableId, smokeDrawable.drawableId],
    expectedVisibility: {
      [sampleBodyDrawableId]: "Visible",
      [smokeDrawable.drawableId]: "Visible"
    },
    expectedDisabled: {
      [sampleBodyDrawableId]: { up: false, down: true },
      [smokeDrawable.drawableId]: { up: true, down: false }
    }
  });
  await assertLayerControlAccessibleNames(page, smokeDrawable);

  await clickScopedTestId(
    page,
    selectorScopes.partsTree,
    createDrawableVisibilityToggleTestId(smokeDrawable.drawableId)
  );
  await waitForText(page, editorTestIds.drawableLayerStatus, "setRuntimeVisibility committed");
  await waitForScopedText(
    page,
    selectorScopes.partsTree,
    createDrawableRowTestId(smokeDrawable.drawableId),
    "Hidden"
  );
  await waitForText(page, editorTestIds.previewSummary, "1 visible / 2 total");
  await waitForOperationLogEntryCount(page, initialOperationLogEntryCount + 1);
  await assertPreviewDrawablePresent(page, smokeDrawable.drawableId, false);

  await clickScopedTestId(
    page,
    selectorScopes.partsTree,
    createDrawableVisibilityToggleTestId(smokeDrawable.drawableId)
  );
  await waitForText(page, editorTestIds.drawableLayerStatus, "setRuntimeVisibility committed");
  await waitForScopedText(
    page,
    selectorScopes.partsTree,
    createDrawableRowTestId(smokeDrawable.drawableId),
    "Visible"
  );
  await waitForText(page, editorTestIds.previewSummary, "2 visible / 2 total");
  await waitForOperationLogEntryCount(page, initialOperationLogEntryCount + 2);
  await assertPreviewDrawablePresent(page, smokeDrawable.drawableId, true);

  await clickScopedTestId(page, selectorScopes.partsTree, createDrawableMoveUpTestId(sampleBodyDrawableId));
  await waitForText(page, editorTestIds.drawableLayerStatus, "setDrawOrder committed");
  await waitForLayerOrder(page, [smokeDrawable.drawableId, sampleBodyDrawableId]);
  await waitForOperationLogEntryCount(page, initialOperationLogEntryCount + 3);

  await clickScopedTestId(page, selectorScopes.partsTree, createDrawableMoveDownTestId(sampleBodyDrawableId));
  await waitForText(page, editorTestIds.drawableLayerStatus, "setDrawOrder committed");
  await waitForLayerOrder(page, [sampleBodyDrawableId, smokeDrawable.drawableId]);
  await waitForOperationLogEntryCount(page, initialOperationLogEntryCount + 4);

  await clickScopedTestId(page, selectorScopes.partsTree, createDrawableMoveUpTestId(sampleBodyDrawableId));
  await waitForLayerOrder(page, [smokeDrawable.drawableId, sampleBodyDrawableId]);
  await waitForOperationLogEntryCount(page, initialOperationLogEntryCount + 5);

  await clickScopedTestId(
    page,
    selectorScopes.partsTree,
    createDrawableVisibilityToggleTestId(smokeDrawable.drawableId)
  );
  await waitForText(page, editorTestIds.drawableLayerStatus, "setRuntimeVisibility committed");
  await waitForScopedText(
    page,
    selectorScopes.partsTree,
    createDrawableRowTestId(smokeDrawable.drawableId),
    "Hidden"
  );
  await waitForText(page, editorTestIds.previewSummary, "1 visible / 2 total");
  await waitForOperationLogEntryCount(page, initialOperationLogEntryCount + 6);
  await assertPreviewDrawablePresent(page, smokeDrawable.drawableId, false);
  await assertLayerControlState(page, {
    smokeDrawable,
    expectedOrder: [smokeDrawable.drawableId, sampleBodyDrawableId],
    expectedVisibility: {
      [sampleBodyDrawableId]: "Visible",
      [smokeDrawable.drawableId]: "Hidden"
    },
    expectedDisabled: {
      [smokeDrawable.drawableId]: { up: false, down: true },
      [sampleBodyDrawableId]: { up: true, down: false }
    }
  });

  const state = await readLayerControlState(page, smokeDrawable);
  const screenshot = await page.captureScreenshot(`${viewport.name} layer controls smoke`);

  return {
    viewport: viewport.name,
    order: state.order,
    rowTextByDrawableId: state.rowTextByDrawableId,
    previewSummary: state.previewSummary,
    screenshot
  };
};

export const assertSavedLayerState = async ({ page, storageKey, smokeDrawable }) => {
  const saved = await page.evaluate((key, bodyDrawableId, createdDrawableId) => {
    const raw = localStorage.getItem(key);
    if (raw === null) {
      return null;
    }

    const project = JSON.parse(raw);
    const drawables = readPackageJsonFile(project, "model/drawables.json")?.drawables ?? [];
    const drawOrderEntries = readPackageJsonFile(project, "model/draw-order.json")?.entries ?? [];
    const layerOrder = [...drawOrderEntries]
      .sort((left, right) => left.baseDrawOrder - right.baseDrawOrder)
      .map((entry) => entry.drawableId);
    const visibilityByDrawableId = Object.fromEntries(
      drawables.map((drawable) => [drawable.drawableId, drawable.runtimeVisibility])
    );

    return {
      layerOrder,
      bodyVisible: visibilityByDrawableId[bodyDrawableId],
      createdVisible: visibilityByDrawableId[createdDrawableId]
    };

    function readPackageJsonFile(project, path) {
      if (!Array.isArray(project.packageFileSet)) {
        return null;
      }

      const entry = project.packageFileSet.find((candidate) => candidate.path === path);
      if (typeof entry?.text !== "string") {
        return null;
      }

      return JSON.parse(entry.text);
    }
  }, storageKey, sampleBodyDrawableId, smokeDrawable.drawableId);

  const expected = {
    layerOrder: [smokeDrawable.drawableId, sampleBodyDrawableId],
    bodyVisible: true,
    createdVisible: false
  };

  if (JSON.stringify(saved) !== JSON.stringify(expected)) {
    throw new Error(
      `Saved layer state mismatch: expected ${JSON.stringify(expected)}, received ${JSON.stringify(saved)}.`
    );
  }
};

export const assertLayerStateAfterLoad = async ({
  page,
  smokeDrawable,
  expectedOperationLogEntryCount = 9,
  expectedOperationTypesText = "createParameter, createDrawable, generateMesh, setRuntimeVisibility, setDrawOrder"
}) => {
  await waitForText(page, editorTestIds.drawableLayerStatus, "2 layers");
  await waitForText(page, editorTestIds.previewSummary, "1 visible / 2 total");
  await waitForOperationLogEntryCount(page, expectedOperationLogEntryCount);
  await waitForText(page, editorTestIds.operationLogSummary, expectedOperationTypesText);
  await assertPreviewDrawablePresent(page, sampleBodyDrawableId, true);
  await assertPreviewDrawablePresent(page, smokeDrawable.drawableId, false);
  await assertLayerControlState(page, {
    smokeDrawable,
    expectedOrder: [smokeDrawable.drawableId, sampleBodyDrawableId],
    expectedVisibility: {
      [sampleBodyDrawableId]: "Visible",
      [smokeDrawable.drawableId]: "Hidden"
    },
    expectedDisabled: {
      [smokeDrawable.drawableId]: { up: false, down: true },
      [sampleBodyDrawableId]: { up: true, down: false }
    }
  });
};

const assertLayerControlAccessibleNames = async (page, smokeDrawable) => {
  await assertScopedTestIdUnique(page, selectorScopes.partsTree, editorTestIds.drawableList);
  const names = await page.evaluate((ids, scope) => {
    const scopeRoot = window.__editorE2eSelectorScopes.findScopeRoot(scope);
    if (!(scopeRoot instanceof HTMLElement)) {
      throw new Error(`Missing selector scope ${scope.label}.`);
    }

    const readButton = (testId) => {
      const element = scopeRoot.querySelector(`[data-testid="${testId}"]`);

      if (!(element instanceof HTMLButtonElement)) {
        throw new Error(`Missing layer control button ${testId}.`);
      }

      return {
        text: element.textContent?.trim() ?? "",
        ariaLabel: element.getAttribute("aria-label") ?? "",
        disabled: element.disabled,
        ariaPressed: element.getAttribute("aria-pressed")
      };
    };

    const status = document.querySelector(`[data-testid="${ids.status}"]`);

    return {
      statusName: status?.getAttribute("aria-label") ?? "",
      bodyVisibility: readButton(ids.bodyVisibility),
      bodyMoveUp: readButton(ids.bodyMoveUp),
      bodyMoveDown: readButton(ids.bodyMoveDown),
      createdVisibility: readButton(ids.createdVisibility),
      createdMoveUp: readButton(ids.createdMoveUp),
      createdMoveDown: readButton(ids.createdMoveDown)
    };
  }, {
    status: editorTestIds.drawableLayerStatus,
    bodyVisibility: createDrawableVisibilityToggleTestId(sampleBodyDrawableId),
    bodyMoveUp: createDrawableMoveUpTestId(sampleBodyDrawableId),
    bodyMoveDown: createDrawableMoveDownTestId(sampleBodyDrawableId),
    createdVisibility: createDrawableVisibilityToggleTestId(smokeDrawable.drawableId),
    createdMoveUp: createDrawableMoveUpTestId(smokeDrawable.drawableId),
    createdMoveDown: createDrawableMoveDownTestId(smokeDrawable.drawableId)
  }, selectorScopes.partsTree);

  const expected = {
    statusName: "Drawable layer status",
    bodyVisibility: {
      text: "Hide",
      ariaLabel: "Hide Body",
      disabled: false,
      ariaPressed: "true"
    },
    bodyMoveUp: {
      text: "Up",
      ariaLabel: "Move Body up",
      disabled: false,
      ariaPressed: null
    },
    bodyMoveDown: {
      text: "Down",
      ariaLabel: "Move Body down",
      disabled: true,
      ariaPressed: null
    },
    createdVisibility: {
      text: "Hide",
      ariaLabel: `Hide ${smokeDrawable.displayName}`,
      disabled: false,
      ariaPressed: "true"
    },
    createdMoveUp: {
      text: "Up",
      ariaLabel: `Move ${smokeDrawable.displayName} up`,
      disabled: true,
      ariaPressed: null
    },
    createdMoveDown: {
      text: "Down",
      ariaLabel: `Move ${smokeDrawable.displayName} down`,
      disabled: false,
      ariaPressed: null
    }
  };

  if (JSON.stringify(names) !== JSON.stringify(expected)) {
    throw new Error(
      `Layer control accessible names mismatch: expected ${JSON.stringify(expected)}, received ${JSON.stringify(names)}.`
    );
  }
};

const assertLayerControlState = async (
  page,
  { smokeDrawable, expectedOrder, expectedVisibility, expectedDisabled }
) => {
  await waitForLayerOrder(page, expectedOrder);
  const state = await readLayerControlState(page, smokeDrawable);

  for (const [drawableId, visibilityLabel] of Object.entries(expectedVisibility)) {
    if (!state.rowTextByDrawableId[drawableId]?.includes(visibilityLabel)) {
      throw new Error(
        `Expected ${drawableId} row to include ${visibilityLabel}, received ${state.rowTextByDrawableId[drawableId]}.`
      );
    }
  }

  for (const [drawableId, disabled] of Object.entries(expectedDisabled)) {
    const actual = state.disabledByDrawableId[drawableId];
    if (JSON.stringify(actual) !== JSON.stringify(disabled)) {
      throw new Error(
        `Expected ${drawableId} move disabled state ${JSON.stringify(disabled)}, received ${JSON.stringify(actual)}.`
      );
    }
  }
};

const readLayerControlState = async (page, smokeDrawable) => {
  await assertScopedTestIdUnique(page, selectorScopes.partsTree, editorTestIds.drawableList);

  return page.evaluate((ids, scope, drawableIds) => {
    const scopeRoot = window.__editorE2eSelectorScopes.findScopeRoot(scope);
    if (!(scopeRoot instanceof HTMLElement)) {
      throw new Error(`Missing selector scope ${scope.label}.`);
    }

    const rows = [...(scopeRoot.querySelector(`[data-testid="${ids.list}"]`)?.querySelectorAll("tbody tr") ?? [])];
    const order = rows.map((row) => row.getAttribute("data-testid")?.replace("drawable.row.", "") ?? "");
    const rowTextByDrawableId = Object.fromEntries(
      drawableIds.map((drawableId) => [
        drawableId,
        scopeRoot.querySelector(`[data-testid="drawable.row.${drawableId}"]`)?.textContent ?? ""
      ])
    );
    const disabledByDrawableId = Object.fromEntries(
      drawableIds.map((drawableId) => {
        const up = scopeRoot.querySelector(`[data-testid="drawable.moveUp.${drawableId}"]`);
        const down = scopeRoot.querySelector(`[data-testid="drawable.moveDown.${drawableId}"]`);

        if (!(up instanceof HTMLButtonElement) || !(down instanceof HTMLButtonElement)) {
          throw new Error(`Missing move controls for ${drawableId}.`);
        }

        return [drawableId, { up: up.disabled, down: down.disabled }];
      })
    );
    const previewSummary = document.querySelector(`[data-testid="${ids.previewSummary}"]`)?.textContent ?? "";

    return { order, rowTextByDrawableId, disabledByDrawableId, previewSummary };
  }, {
    list: editorTestIds.drawableList,
    previewSummary: editorTestIds.previewSummary
  }, selectorScopes.partsTree, [sampleBodyDrawableId, smokeDrawable.drawableId]);
};

const assertPreviewDrawablePresent = async (page, drawableId, expectedPresent) => {
  const present = await page.evaluate((ids, id) => {
    const drawable = document
      .querySelector(`[data-testid="${ids.visual}"]`)
      ?.querySelector(`[data-drawable-id="${id}"]`);

    return drawable !== null && drawable !== undefined;
  }, { visual: editorTestIds.previewVisual }, drawableId);

  if (present !== expectedPresent) {
    throw new Error(`Expected preview drawable ${drawableId} present=${expectedPresent}, received ${present}.`);
  }
};

const waitForLayerOrder = async (page, expectedOrder) => {
  await assertScopedTestIdUnique(page, selectorScopes.partsTree, editorTestIds.drawableList);
  await page.waitFor(
    `drawable layer order ${expectedOrder.join(", ")}`,
    (ids, scope, order) => {
      const scopeRoot = window.__editorE2eSelectorScopes.findScopeRoot(scope);
      const rows = [...(scopeRoot?.querySelector(`[data-testid="${ids.list}"]`)?.querySelectorAll("tbody tr") ?? [])];
      const actual = rows.map((row) => row.getAttribute("data-testid")?.replace("drawable.row.", "") ?? "");

      return JSON.stringify(actual) === JSON.stringify(order);
    },
    { timeoutMs: 8_000 },
    { list: editorTestIds.drawableList },
    selectorScopes.partsTree,
    expectedOrder
  );
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
