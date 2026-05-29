import { createPageSession } from "./page-session.mjs";
import { editorProjectStorageKey, editorTestIds } from "./test-ids.mjs";

export const editorSmokeViewports = [
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

export const runEditorSmoke = async ({ baseUrl, browserPort, viewport }) => {
  const page = await createPageSession({ browserPort, viewport, url: baseUrl });
  const parameterName = `Wave7 Smoke ${viewport.name}`;

  try {
    await waitForTestId(page, editorTestIds.shell);
    await page.evaluate((storageKey) => localStorage.removeItem(storageKey), editorProjectStorageKey);
    await page.reload();
    await waitForTestId(page, editorTestIds.shell);

    await assertShellRendered(page);
    await assertHorizontalOverflow(page, `${viewport.name} initial`);
    await commitCreateParameter(page, parameterName);
    await saveProject(page);
    await reloadProjectFromStorage(page, parameterName);
    await assertHorizontalOverflow(page, `${viewport.name} loaded`);
    await resetProject(page);
    await assertHorizontalOverflow(page, `${viewport.name} reset`);

    return { viewport: viewport.name };
  } finally {
    await page.close();
  }
};

const assertShellRendered = async (page) => {
  await waitForTestId(page, editorTestIds.parameterCreateForm);
  await waitForTestId(page, editorTestIds.parameterCreateSubmit);
  await assertTextIncludes(page, editorTestIds.packageStatus, "pkg_editor_browser_sample");
  await assertTextIncludes(page, editorTestIds.operationStatus, "No operation committed");
  await assertTextIncludes(page, editorTestIds.parameterList, "No parameters yet.");
};

const commitCreateParameter = async (page, parameterName) => {
  await page.evaluate(
    (formTestId, submitTestId, displayName) => {
      const form = document.querySelector(`[data-testid="${formTestId}"]`);
      const input = form?.querySelector('input[name="displayName"]');
      const submit = document.querySelector(`[data-testid="${submitTestId}"]`);

      if (!(input instanceof HTMLInputElement) || !(submit instanceof HTMLButtonElement)) {
        throw new Error("Create parameter form was not rendered.");
      }

      input.value = displayName;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      submit.click();
    },
    editorTestIds.parameterCreateForm,
    editorTestIds.parameterCreateSubmit,
    parameterName
  );

  await waitForText(page, editorTestIds.operationStatus, "createParameter committed");
  await waitForText(page, editorTestIds.parameterList, parameterName);
  await waitForText(page, editorTestIds.reloadSummary, "Reloaded");
  await waitForOperationLogEntryCount(page, 1);
  await waitForText(page, editorTestIds.operationLogSummary, "createParameter");
};

const saveProject = async (page) => {
  await clickTestId(page, editorTestIds.projectPersistenceSave);
  await waitForText(page, editorTestIds.projectPersistenceStatus, "Saved");

  const saved = await page.evaluate((storageKey) => {
    const raw = localStorage.getItem(storageKey);

    if (raw === null) {
      return null;
    }

    const project = JSON.parse(raw);

    return {
      schemaVersion: project.schemaVersion,
      operationLogLineCount: String(project.operationLogJsonl ?? "")
        .split("\n")
        .filter((line) => line.trim().length > 0).length,
      packageFileCount: Array.isArray(project.packageFileSet) ? project.packageFileSet.length : 0
    };
  }, editorProjectStorageKey);

  if (
    saved === null ||
    saved.schemaVersion !== "editor-project-persistence-v1" ||
    saved.operationLogLineCount < 1 ||
    saved.packageFileCount < 1
  ) {
    throw new Error("Save to browser storage did not persist a valid editor project.");
  }
};

const reloadProjectFromStorage = async (page, parameterName) => {
  await page.reload();
  await waitForTestId(page, editorTestIds.shell);
  await assertTextIncludes(page, editorTestIds.parameterList, "No parameters yet.");
  await clickTestId(page, editorTestIds.projectPersistenceLoad);
  await waitForText(page, editorTestIds.projectPersistenceStatus, "Loaded");
  await waitForText(page, editorTestIds.parameterList, parameterName);
  await waitForOperationLogEntryCount(page, 1);
  await waitForText(page, editorTestIds.operationLogSummary, "createParameter");
};

const resetProject = async (page) => {
  await clickTestId(page, editorTestIds.projectPersistenceReset);
  await waitForText(page, editorTestIds.projectPersistenceStatus, "Cleared");
  await waitForText(page, editorTestIds.packageStatus, "pkg_editor_browser_sample");
  await waitForText(page, editorTestIds.parameterList, "No parameters yet.");

  const storedValue = await page.evaluate((storageKey) => localStorage.getItem(storageKey), editorProjectStorageKey);
  if (storedValue !== null) {
    throw new Error("Reset sample did not clear browser project storage.");
  }
};

const assertHorizontalOverflow = async (page, label) => {
  const overflowCount = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const documentOverflows =
      Math.max(document.body?.scrollWidth ?? 0, document.documentElement.scrollWidth) > viewportWidth + 1
        ? 1
        : 0;
    const elementOverflows = [...document.body.querySelectorAll("*")].filter((element) => {
      const rect = element.getBoundingClientRect();

      return rect.left < -1 || rect.right > viewportWidth + 1;
    }).length;

    return documentOverflows + elementOverflows;
  });

  if (overflowCount !== 0) {
    throw new Error(`${label} horizontal overflow count was ${overflowCount}; expected 0.`);
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

const assertTextIncludes = async (page, testId, expectedText) => {
  const text = await page.evaluate(
    (id) => document.querySelector(`[data-testid="${id}"]`)?.textContent ?? null,
    testId
  );

  if (text === null || !text.includes(expectedText)) {
    throw new Error(`Expected ${testId} to include "${expectedText}", received "${text}".`);
  }
};
