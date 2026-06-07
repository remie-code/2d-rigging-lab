import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { locateBrowserExecutable } from "./browser-discovery.mjs";
import { launchHeadlessBrowser } from "./chrome-launcher.mjs";
import { createPageSession } from "./page-session.mjs";
import { startOrReuseEditorServer } from "./vite-server.mjs";
import { editorProjectStorageKey, editorTestIds } from "./test-ids.mjs";
import {
  clickScopedTestId,
  selectorScopes,
  waitForScopedTestId
} from "./selector-scopes.mjs";

const taskWindowRoutingFocusedViewports = [
  {
    name: "desktop",
    width: 1280,
    height: 900,
    isMobile: false
  }
];

const diagnosticsEvidenceSkeletonTestId = "diagnosticsEvidenceView.skeleton";

export const runTaskWindowRoutingFocusedSmoke = async ({ page, viewport }) => {
  await waitForTestId(page, editorTestIds.shell);
  await assertNoTaskWindowRoute(page, `${viewport.name} initial`);

  await openPsdImportTaskFromToolbox(page);
  await assertTaskWindow(page, {
    label: "PSD Import",
    surfaceId: "psdImportTask",
    surfaceKind: "task",
    surfaceGroup: "psd-import",
    expectedText: "PSD Import"
  });
  await waitForScopedTestId(
    page,
    selectorScopes.psdImportTaskWindow,
    editorTestIds.explicitPsdImportPanel
  );
  await closeActiveTaskWindowWithEscape(page);
  await assertNoTaskWindowRoute(page, `${viewport.name} after PSD Escape`);

  await clickToolboxItem(page, "diagnostics");
  await assertTaskWindow(page, {
    label: "Diagnostics / Evidence",
    surfaceId: "diagnosticsEvidenceView",
    surfaceKind: "view",
    surfaceGroup: "diagnostics-evidence",
    expectedText: "Read-only skeleton"
  });
  await assertTestIdInsideActiveTaskWindow(page, diagnosticsEvidenceSkeletonTestId);
  await assertReadOnlySkeleton(page, `[data-testid="${diagnosticsEvidenceSkeletonTestId}"]`, {
    label: "Diagnostics / Evidence skeleton",
    requiredTexts: [
      "Separated read-only home",
      "Operation Log",
      "PSD Import / Structural Scaffold Evidence"
    ],
    forbiddenTexts: ["fully implemented", "complete evidence browser", "final view"]
  });
  await closeActiveTaskWindowByAriaLabel(page, "Close Diagnostics / Evidence view");
  await assertNoTaskWindowRoute(page, `${viewport.name} after Diagnostics close`);

  await clickToolboxItem(page, "codex");
  await assertTaskWindow(page, {
    label: "Codex / Automation",
    surfaceId: "codexAutomationView",
    surfaceKind: "view",
    surfaceGroup: "codex-automation",
    expectedText: "Bounded read-only skeleton"
  });
  await assertReadOnlySkeleton(page, '[data-codex-automation-skeleton="true"]', {
    label: "Codex / Automation skeleton",
    requiredTexts: [
      "Repo/Editor-side proposal generation unavailable",
      "Auto-fix blocked",
      "External HTTP/WebSocket/MCP transport unavailable"
    ],
    forbiddenTexts: [
      [
        "automatic",
        "commit",
        "enabled"
      ].join(" "),
      [
        "external",
        "transport",
        "ready"
      ].join(" "),
      "final Codex implementation"
    ]
  });
  const screenshot = await page.captureScreenshot(
    `${viewport.name} wave54 task window routing focused smoke`
  );
  await closeActiveTaskWindowWithEscape(page);
  await assertNoTaskWindowRoute(page, `${viewport.name} after Codex Escape`);

  return {
    viewport: viewport.name,
    routedSurfaces: ["psdImportTask", "diagnosticsEvidenceView", "codexAutomationView"],
    screenshot
  };
};

const openPsdImportTaskFromToolbox = async (page) => {
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
};

const assertNoTaskWindowRoute = async (page, label) => {
  await page.waitFor(
    `${label} no workspace task window route`,
    (ids) => {
      const activeTaskWindow = document.querySelector(
        '[data-task-window-scope="workspace"][data-task-window-region="window"]'
      );

      return (
        activeTaskWindow === null &&
        document.querySelector(`[data-testid="${ids.psdPanel}"]`) === null &&
        document.querySelector(`[data-testid="${ids.diagnosticsSkeleton}"]`) === null &&
        document.querySelector('[data-codex-automation-skeleton="true"]') === null
      );
    },
    { timeoutMs: 8_000 },
    {
      psdPanel: editorTestIds.explicitPsdImportPanel,
      diagnosticsSkeleton: diagnosticsEvidenceSkeletonTestId
    }
  );
};

const assertTaskWindow = async (
  page,
  { label, surfaceId, surfaceKind, surfaceGroup, expectedText }
) => {
  await page.waitFor(
    `${label} workspace task window`,
    (expected) => {
      const taskWindow = document.querySelector(
        '[data-task-window-scope="workspace"][data-task-window-region="window"]'
      );

      return (
        taskWindow instanceof HTMLElement &&
        taskWindow.dataset.shellSurfaceId === expected.surfaceId &&
        taskWindow.dataset.shellSurfaceKind === expected.surfaceKind &&
        taskWindow.dataset.shellSurfaceGroup === expected.surfaceGroup &&
        taskWindow.getAttribute("role") === "dialog" &&
        taskWindow.getAttribute("aria-modal") === "false" &&
        taskWindow.getAttribute("aria-keyshortcuts") === "Escape" &&
        taskWindow.textContent?.includes(expected.expectedText) === true &&
        document.activeElement === taskWindow
      );
    },
    { timeoutMs: 8_000 },
    { surfaceId, surfaceKind, surfaceGroup, expectedText }
  );
};

const assertTestIdInsideActiveTaskWindow = async (page, testId) => {
  await page.waitFor(
    `active task window contains ${testId}`,
    (id) => {
      const taskWindow = document.querySelector(
        '[data-task-window-scope="workspace"][data-task-window-region="window"]'
      );

      return taskWindow?.querySelector(`[data-testid="${id}"]`) !== null;
    },
    { timeoutMs: 8_000 },
    testId
  );
};

const assertReadOnlySkeleton = async (
  page,
  selector,
  { label, requiredTexts, forbiddenTexts }
) => {
  const result = await page.evaluate(
    (input) => {
      const root = document.querySelector(input.selector);
      const text = root?.textContent ?? "";
      const normalizedText = text.toLowerCase();
      const interactiveCount =
        root?.querySelectorAll("a, button, form, input, select, textarea").length ?? 0;

      return {
        found: root !== null,
        interactiveCount,
        missingTexts: input.requiredTexts.filter((requiredText) => !text.includes(requiredText)),
        presentForbiddenTexts: input.forbiddenTexts.filter((forbiddenText) =>
          normalizedText.includes(forbiddenText.toLowerCase())
        ),
        text
      };
    },
    { selector, requiredTexts, forbiddenTexts }
  );

  if (
    !result.found ||
    result.interactiveCount !== 0 ||
    result.missingTexts.length > 0 ||
    result.presentForbiddenTexts.length > 0
  ) {
    throw new Error(`${label} did not stay bounded/read-only: ${JSON.stringify(result)}.`);
  }
};

const clickToolboxItem = async (page, itemId) => {
  await page.evaluate((id) => {
    const toolbox = document.querySelector(
      '[data-shell-surface-id="authoringWorkspace"][data-shell-surface-group="toolbox"]'
    );
    const button = toolbox?.querySelector(`[data-toolbox-item-id="${id}"]`);

    if (!(button instanceof HTMLButtonElement)) {
      throw new Error(`Missing Toolbox item ${id}.`);
    }

    if (button.disabled) {
      throw new Error(`Toolbox item ${id} is disabled.`);
    }

    button.click();
  }, itemId);
};

const closeActiveTaskWindowByAriaLabel = async (page, ariaLabel) => {
  await page.evaluate((label) => {
    const taskWindow = document.querySelector(
      '[data-task-window-scope="workspace"][data-task-window-region="window"]'
    );
    const button = taskWindow?.querySelector(`[aria-label="${label}"]`);

    if (!(button instanceof HTMLButtonElement)) {
      throw new Error(`Missing active task window affordance ${label}.`);
    }

    button.click();
  }, ariaLabel);
};

const closeActiveTaskWindowWithEscape = async (page) => {
  await page.evaluate(() => {
    const taskWindow = document.querySelector(
      '[data-task-window-scope="workspace"][data-task-window-region="window"]'
    );

    if (!(taskWindow instanceof HTMLElement)) {
      throw new Error("Missing active task window for Escape close.");
    }

    taskWindow.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true
      })
    );
  });
};

const waitForTestId = async (page, testId) => {
  await page.waitFor(
    `test id ${testId}`,
    (id) => document.querySelector(`[data-testid="${id}"]`) !== null,
    { timeoutMs: 8_000 },
    testId
  );
};

const main = async () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  const browser = locateBrowserExecutable();
  const server = await startOrReuseEditorServer({ repoRoot });
  let launchedBrowser;

  try {
    console.log(
      `task-window-routing-focused-e2e: using ${browser.executable} (${browser.source}); server ${
        server.baseUrl
      } ${server.reused ? "reused" : "started"}`
    );

    launchedBrowser = await launchHeadlessBrowser({ executable: browser.executable });

    for (const viewport of taskWindowRoutingFocusedViewports) {
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

        const result = await runTaskWindowRoutingFocusedSmoke({ page, viewport });
        console.log(
          `task-window-routing-focused-e2e: ${viewport.name} passed surfaces=${result.routedSurfaces.join(",")}`
        );
        console.log(
          `task-window-routing-focused-e2e: ${viewport.name} screenshot ${result.screenshot.format} base64Length=${result.screenshot.base64Length}`
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
    console.log("task-window-routing-focused-e2e: smoke passed");
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
