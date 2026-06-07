import { editorTestIds } from "./test-ids.mjs";

export const selectorScopes = {
  toolbox: {
    label: "Toolbox surface",
    shellSurfaceId: "authoringWorkspace",
    shellSurfaceGroup: "toolbox"
  },
  partsTree: {
    label: "Parts Tree surface",
    shellSurfaceId: "authoringWorkspace",
    shellSurfaceGroup: "parts-tree"
  },
  legacyDrawableAuthoring: {
    label: "legacy Drawable Authoring panel",
    testId: editorTestIds.drawableAuthoringPanel
  },
  psdImportTaskWindow: {
    label: "PSD Import task window",
    shellSurfaceId: "psdImportTask",
    shellSurfaceGroup: "psd-import",
    taskWindowScope: "workspace"
  }
};

export const openExplicitPsdImportTask = async (page) => {
  const isOpen = await hasScopedTestId(
    page,
    selectorScopes.psdImportTaskWindow,
    editorTestIds.explicitPsdImportPanel
  );

  if (!isOpen) {
    await waitForScopedTestId(
      page,
      selectorScopes.toolbox,
      editorTestIds.psdImportTaskOpen
    );
    await clickScopedTestId(
      page,
      selectorScopes.toolbox,
      editorTestIds.psdImportTaskOpen
    );
  }

  await waitForScopedTestId(
    page,
    selectorScopes.psdImportTaskWindow,
    editorTestIds.explicitPsdImportPanel
  );
};

export const waitForScopedTestId = async (page, scope, testId, timeoutMs = 8_000) => {
  await installSelectorScopeHelpers(page);
  await page.waitFor(
    `${scope.label} scoped test id ${testId}`,
    (scopeSpec, id) => window.__editorE2eSelectorScopes.findScopedElement(scopeSpec, id) !== null,
    { timeoutMs },
    scope,
    testId
  );
};

export const hasScopedTestId = async (page, scope, testId) => {
  await installSelectorScopeHelpers(page);
  return page.evaluate(
    (scopeSpec, id) => window.__editorE2eSelectorScopes.findScopedElement(scopeSpec, id) !== null,
    scope,
    testId
  );
};

export const waitForScopedText = async (
  page,
  scope,
  testId,
  expectedText,
  timeoutMs = 8_000
) => {
  await installSelectorScopeHelpers(page);
  await page.waitFor(
    `${scope.label} scoped ${testId} text ${expectedText}`,
    (scopeSpec, id, text) =>
      window.__editorE2eSelectorScopes.findScopedElement(scopeSpec, id)?.textContent?.includes(text) ?? false,
    { timeoutMs },
    scope,
    testId,
    expectedText
  );
};

export const readScopedText = async (page, scope, testId) => {
  await installSelectorScopeHelpers(page);
  return page.evaluate(
    (scopeSpec, id) =>
      window.__editorE2eSelectorScopes.findScopedElement(scopeSpec, id)?.textContent ?? "",
    scope,
    testId
  );
};

export const clickScopedTestId = async (page, scope, testId) => {
  await installSelectorScopeHelpers(page);
  await page.evaluate((scopeSpec, id) => {
    const element = window.__editorE2eSelectorScopes.findScopedElement(scopeSpec, id);

    if (!(element instanceof HTMLElement)) {
      throw new Error(`Missing ${scopeSpec.label} scoped element for test id ${id}.`);
    }

    element.click();
  }, scope, testId);
};

export const assertScopedTestIdUnique = async (page, scope, testId) => {
  await installSelectorScopeHelpers(page);
  const result = await page.evaluate((scopeSpec, id) => {
    const root = window.__editorE2eSelectorScopes.findScopeRoot(scopeSpec);
    const scopedCount =
      root?.querySelectorAll(window.__editorE2eSelectorScopes.testIdSelector(id)).length ?? 0;
    const documentCount =
      document.querySelectorAll(window.__editorE2eSelectorScopes.testIdSelector(id)).length;

    return {
      scopeFound: root !== null,
      scopedCount,
      documentCount
    };
  }, scope, testId);

  if (!result.scopeFound) {
    throw new Error(`Missing selector scope ${scope.label}.`);
  }

  if (result.scopedCount !== 1) {
    throw new Error(
      `Expected one ${scope.label} scoped ${testId}; found ${result.scopedCount} scoped / ${result.documentCount} document.`
    );
  }
};

export const assertScopedTextIncludes = async (page, scope, testId, expectedText) => {
  const text = await readScopedText(page, scope, testId);

  if (!text.includes(expectedText)) {
    throw new Error(
      `Expected ${scope.label} scoped ${testId} to include "${expectedText}", received "${text}".`
    );
  }
};

export const assertScopedTextExcludes = async (page, scope, testId, excludedText) => {
  const text = await readScopedText(page, scope, testId);

  if (text.includes(excludedText)) {
    throw new Error(
      `Expected ${scope.label} scoped ${testId} to exclude "${excludedText}", received "${text}".`
    );
  }
};

const installSelectorScopeHelpers = async (page) => {
  await page.evaluate(() => {
    window.__editorE2eSelectorScopes = {
      findScopedElement(scope, testId) {
        return this.findScopeRoot(scope)?.querySelector(this.testIdSelector(testId)) ?? null;
      },

      findScopeRoot(scope) {
        if (typeof scope.testId === "string") {
          return document.querySelector(this.testIdSelector(scope.testId));
        }

        const selectors = [];

        if (typeof scope.shellSurfaceId === "string") {
          selectors.push(this.attributeSelector("data-shell-surface-id", scope.shellSurfaceId));
        }

        if (typeof scope.shellSurfaceGroup === "string") {
          selectors.push(this.attributeSelector("data-shell-surface-group", scope.shellSurfaceGroup));
        }

        if (typeof scope.taskWindowScope === "string") {
          selectors.push(this.attributeSelector("data-task-window-scope", scope.taskWindowScope));
        }

        if (selectors.length === 0) {
          return document;
        }

        return document.querySelector(selectors.join(""));
      },

      testIdSelector(testId) {
        return this.attributeSelector("data-testid", testId);
      },

      attributeSelector(name, value) {
        return `[${name}="${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`;
      }
    };
  });
};
