import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { locateBrowserExecutable } from "./browser-discovery.mjs";
import { launchHeadlessBrowser } from "./chrome-launcher.mjs";
import { createPageSession } from "./page-session.mjs";
import { capturePngEvidence } from "./png-evidence.mjs";
import { startOrReuseEditorServer } from "./vite-server.mjs";
import { editorProjectStorageKey, editorTestIds } from "./test-ids.mjs";
import {
  clickScopedTestId,
  selectorScopes,
  waitForScopedTestId
} from "./selector-scopes.mjs";

const activeTaskSelector =
  '[data-task-window-scope="workspace"][data-task-window-region="window"]';

const taskWindowUxFocusedViewports = [
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

const scrollTolerancePx = 1;

const legacySupportSelectors = [
  ".authoring-workspace-support",
  '[data-shell-surface-group="legacy-support"]',
  `[data-testid="${editorTestIds.drawableAuthoringPanel}"]`,
  `[data-testid="${editorTestIds.sourceIntakePanel}"]`,
  `[data-testid="${editorTestIds.projectPersistencePanel}"]`,
  `[data-testid="${editorTestIds.productPreflightPanel}"]`,
  `[data-testid="${editorTestIds.codexProposalReviewPanel}"]`,
  `[data-testid="${editorTestIds.aiApprovalPanel}"]`,
  `[data-testid="${editorTestIds.aiTranscriptPanel}"]`,
  `[data-testid="${editorTestIds.operationLogSummary}"]`,
  `[data-testid="${editorTestIds.generatedEvidenceSummary}"]`,
  `[data-testid="${editorTestIds.tutorialWorkflowPanel}"]`,
  `[data-testid="${editorTestIds.compositionPanel}"]`,
  `[data-testid="${editorTestIds.rigControlPanel}"]`,
  `[data-testid="${editorTestIds.dynamicsPanel}"]`,
  `[data-testid="${editorTestIds.viewerRuntimePanel}"]`
];

const legacySupportTextTerms = [
  "Workspace support panels",
  "Operation persistence evidence",
  "Operation Log",
  "Generated Evidence",
  "Package File Set",
  "Reload Summary",
  "Drawable Authoring",
  "Source Intake",
  "Project Storage",
  "Project Persistence",
  "Product Preflight",
  "Codex Proposal Review",
  "AI Approval",
  "AI Transcript",
  "Tutorial Workflow",
  "Rig Control",
  "Dynamics",
  "Composition"
];

const forbiddenPrimaryTextPatterns = [
  { label: "Task Summary heading", pattern: /\bTask Summary\b/i },
  { label: "raw PSD ref", pattern: /\bpsd:root(?:\b|\/|\[)/i },
  { label: "operation id label", pattern: /\boperation id\b/i },
  { label: "operation id token", pattern: /\bop_[a-z0-9][a-z0-9_.:-]*\b/i },
  { label: "command id token", pattern: /\bcmd_[a-z0-9][a-z0-9_.:-]*\b/i },
  { label: "diagnostic id label", pattern: /\bdiagnostic id\b/i },
  { label: "evidence path label", pattern: /\bevidence path\b/i },
  { label: "evidence path literal", pattern: /\b(?:evidence|generated|artifacts?)[/\\][^\s]+/i },
  { label: "command payload", pattern: /\bcommand payload\b/i },
  { label: "parser payload", pattern: /\b(?:raw parser|parser payload)\b/i },
  { label: "approval id", pattern: /\bapproval id\b/i },
  { label: "plan digest", pattern: /\b(?:plan|candidate|approval) digest\b/i },
  { label: "generated refs", pattern: /\bgenerated refs?\b/i },
  { label: "test selector text", pattern: /\bdata-testid\b/i },
  { label: "diagnostics route id", pattern: /\bdiagnosticsEvidenceView\b/ },
  { label: "codex route id", pattern: /\bcodexAutomationView\b/ }
];

export const runTaskWindowUxFocusedGate = async ({ page, viewport }) => {
  await waitForTestId(page, editorTestIds.shell);
  await page.evaluate((storageKey) => localStorage.removeItem(storageKey), editorProjectStorageKey);
  await page.reload();
  await waitForTestId(page, editorTestIds.shell);
  await scrollDocumentToTop(page);
  await waitForAnimationFrames(page, 2);

  const initialLegacySupport = await collectVisibleLegacySupport(page, {
    excludeActiveTask: true
  });
  assertNoVisibleLegacySupport(
    initialLegacySupport,
    `${viewport.name} primary first viewport before task open`
  );
  assertNoForbiddenVisibleText(
    await readVisibleTextEvidence(page, {
      rootSelector: "body",
      excludeActiveTask: true,
      firstViewportOnly: true
    }),
    `${viewport.name} primary first viewport before task open`
  );

  const beforeOpen = await readDocumentGeometry(page);
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

  const afterClick = await readDocumentGeometry(page);
  assertNoScrollJump(beforeOpen, afterClick, `${viewport.name} immediately after PSD Toolbox click`);

  await waitForActivePsdImportTask(page);
  await waitForAnimationFrames(page, 3);

  const afterFocusSettled = await readDocumentGeometry(page);
  assertNoScrollJump(
    beforeOpen,
    afterFocusSettled,
    `${viewport.name} after PSD task focus settled`
  );

  const metrics = await readTaskWindowUxMetrics(page, {
    beforeOpen,
    afterClick,
    afterFocusSettled
  });
  const screenshot = await capturePngEvidence(
    page,
    `${viewport.name} wave55 task window UX focused PSD open`
  );
  assertPngEvidence(screenshot, viewport);
  assertTaskWindowUxMetrics(metrics, `${viewport.name} PSD Import active task`);

  const activeLegacySupport = await collectVisibleLegacySupport(page, {
    excludeActiveTask: true
  });
  assertNoVisibleLegacySupport(
    activeLegacySupport,
    `${viewport.name} primary first viewport with PSD task open`
  );
  assertNoForbiddenVisibleText(
    await readVisibleTextEvidence(page, {
      rootSelector: activeTaskSelector,
      excludeActiveTask: false,
      firstViewportOnly: true
    }),
    `${viewport.name} active PSD primary task area`
  );

  return {
    viewport: viewport.name,
    scroll: {
      beforeOpen,
      afterClick,
      afterFocusSettled
    },
    taskWindow: summarizeTaskWindowMetrics(metrics),
    screenshot
  };
};

const waitForActivePsdImportTask = async (page) => {
  await page.waitFor(
    "active PSD Import task window with supplementary route markers",
    (selector, ids) => {
      const taskWindow = document.querySelector(selector);

      return (
        taskWindow instanceof HTMLElement &&
        taskWindow.dataset.shellSurfaceId === "psdImportTask" &&
        taskWindow.dataset.shellSurfaceKind === "task" &&
        taskWindow.dataset.shellSurfaceGroup === "psd-import" &&
        taskWindow.getAttribute("role") === "dialog" &&
        taskWindow.querySelector(`[data-testid="${ids.explicitPsdImportPanel}"]`) !== null &&
        document.activeElement === taskWindow
      );
    },
    { timeoutMs: 8_000 },
    activeTaskSelector,
    editorTestIds
  );
};

const readDocumentGeometry = async (page) =>
  page.evaluate(() => {
    const scrollingElement = document.scrollingElement ?? document.documentElement;
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;

    return {
      scrollY: window.scrollY,
      scrollTop: scrollingElement.scrollTop,
      scrollHeight: Math.max(
        document.body?.scrollHeight ?? 0,
        document.documentElement.scrollHeight
      ),
      scrollWidth: Math.max(
        document.body?.scrollWidth ?? 0,
        document.documentElement.scrollWidth
      ),
      viewportWidth,
      viewportHeight
    };
  });

const readTaskWindowUxMetrics = async (page, scrollEvidence) =>
  page.evaluate((selector, scrollInput) => {
    const taskWindow = document.querySelector(selector);
    const root = taskWindow instanceof HTMLElement ? taskWindow : null;
    const windowFrame =
      root?.querySelector('[data-task-window-region="window-frame"]') ??
      root?.querySelector(".editor-task-shell__window") ??
      root;
    const backButton = root?.querySelector('[data-task-window-affordance="back"]');
    const closeButton = root?.querySelector('[data-task-window-affordance="close"]');
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const scrollingElement = document.scrollingElement ?? document.documentElement;

    const readRect = (element) => {
      if (!(element instanceof HTMLElement)) {
        return null;
      }

      const rect = element.getBoundingClientRect();
      return {
        top: rect.top,
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height
      };
    };

    const readStyle = (element) => {
      if (!(element instanceof HTMLElement)) {
        return null;
      }

      const style = window.getComputedStyle(element);
      return {
        position: style.position,
        zIndex: style.zIndex,
        overflow: style.overflow,
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        display: style.display,
        visibility: style.visibility
      };
    };

    const rectContainsViewportPoint = (rect) =>
      rect !== null &&
      rect.width > 0 &&
      rect.height > 0 &&
      rect.left >= -1 &&
      rect.top >= -1 &&
      rect.right <= viewportWidth + 1 &&
      rect.bottom <= viewportHeight + 1;

    const centerRect = readRect(windowFrame);
    const centerPoint =
      centerRect === null
        ? null
        : {
            x: Math.min(Math.max(centerRect.left + centerRect.width / 2, 0), viewportWidth - 1),
            y: Math.min(Math.max(centerRect.top + centerRect.height / 2, 0), viewportHeight - 1)
          };
    const centerElement =
      centerPoint === null ? null : document.elementFromPoint(centerPoint.x, centerPoint.y);
    const rootRect = readRect(root);
    const frameRect = readRect(windowFrame);
    const backRect = readRect(backButton);
    const closeRect = readRect(closeButton);
    const rootStyle = readStyle(root);
    const frameStyle = readStyle(windowFrame);
    const documentScrollWidth = Math.max(
      document.body?.scrollWidth ?? 0,
      document.documentElement.scrollWidth
    );
    const overflowingElements = [...document.body.querySelectorAll("*")]
      .filter((element) => {
        if (!(element instanceof HTMLElement)) {
          return false;
        }

        const rect = element.getBoundingClientRect();
        return rect.width > 0 && (rect.left < -1 || rect.right > viewportWidth + 1);
      })
      .slice(0, 8)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          tagName: element.tagName.toLowerCase(),
          className: element.getAttribute("class") ?? "",
          testId: element.getAttribute("data-testid") ?? "",
          shellSurfaceId: element.getAttribute("data-shell-surface-id") ?? "",
          left: rect.left,
          right: rect.right,
          width: rect.width,
          text: (element.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 120)
        };
      });

    return {
      markers: {
        hasRoot: root !== null,
        role: root?.getAttribute("role") ?? null,
        ariaModal: root?.getAttribute("aria-modal") ?? null,
        taskWindowScope: root?.dataset.taskWindowScope ?? null,
        taskWindowRegion: root?.dataset.taskWindowRegion ?? null,
        shellSurfaceId: root?.dataset.shellSurfaceId ?? null,
        shellSurfaceKind: root?.dataset.shellSurfaceKind ?? null,
        shellSurfaceGroup: root?.dataset.shellSurfaceGroup ?? null,
        activeElementIsRoot: document.activeElement === root
      },
      viewport: {
        width: viewportWidth,
        height: viewportHeight,
        visualViewport:
          window.visualViewport == null
            ? null
            : {
                width: window.visualViewport.width,
                height: window.visualViewport.height,
                offsetLeft: window.visualViewport.offsetLeft,
                offsetTop: window.visualViewport.offsetTop
              }
      },
      scroll: {
        ...scrollInput,
        currentScrollTop: scrollingElement.scrollTop,
        currentScrollY: window.scrollY,
        currentScrollHeight: Math.max(
          document.body?.scrollHeight ?? 0,
          document.documentElement.scrollHeight
        )
      },
      root: {
        rect: rootRect,
        style: rootStyle
      },
      frame: {
        rect: frameRect,
        style: frameStyle
      },
      affordances: {
        back: {
          exists: backButton instanceof HTMLButtonElement,
          disabled: backButton instanceof HTMLButtonElement ? backButton.disabled : null,
          rect: backRect,
          contained: rectContainsViewportPoint(backRect)
        },
        close: {
          exists: closeButton instanceof HTMLButtonElement,
          disabled: closeButton instanceof HTMLButtonElement ? closeButton.disabled : null,
          rect: closeRect,
          contained: rectContainsViewportPoint(closeRect)
        }
      },
      stacking: {
        centerPoint,
        centerElementTag: centerElement?.tagName.toLowerCase() ?? null,
        centerElementClass: centerElement?.getAttribute("class") ?? "",
        centerElementTaskRegion: centerElement?.closest(selector)?.getAttribute("data-task-window-region") ?? null,
        centerResolvesInsideActiveTask: root !== null && centerElement !== null && root.contains(centerElement)
      },
      overflow: {
        documentScrollWidth,
        documentOverflowsHorizontally: documentScrollWidth > viewportWidth + 1,
        overflowingElements
      },
      documentHeightDelta:
        scrollInput.afterFocusSettled.scrollHeight - scrollInput.beforeOpen.scrollHeight,
      hasGeometryEvidence:
        rootRect !== null &&
        frameRect !== null &&
        rootRect.width > 0 &&
        rootRect.height > 0 &&
        frameRect.width > 0 &&
        frameRect.height > 0 &&
        rootStyle !== null &&
        frameStyle !== null &&
        centerPoint !== null
    };
  }, activeTaskSelector, scrollEvidence);

const collectVisibleLegacySupport = async (page, { excludeActiveTask }) =>
  page.evaluate(
    (input) => {
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = document.documentElement.clientHeight;
      const activeTask = document.querySelector(input.activeTaskSelector);

      const isElementSkipped = (element) => {
        if (!(element instanceof HTMLElement)) {
          return true;
        }

        if (input.excludeActiveTask && activeTask?.contains(element)) {
          return true;
        }

        if (element.closest('[data-quarantine-surface="true"]') !== null) {
          return true;
        }

        return false;
      };

      const isStyleVisible = (element) => {
        const style = window.getComputedStyle(element);

        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          Number(style.opacity || "1") > 0 &&
          !element.hidden &&
          element.getAttribute("aria-hidden") !== "true"
        );
      };

      const intersectsFirstViewport = (rect) =>
        rect.width > 0 &&
        rect.height > 0 &&
        rect.right > 0 &&
        rect.left < viewportWidth &&
        rect.bottom > 0 &&
        rect.top < viewportHeight;

      const isTopVisible = (element, rect) => {
        const samples = [
          [rect.left + rect.width / 2, rect.top + rect.height / 2],
          [rect.left + Math.min(8, rect.width / 2), rect.top + Math.min(8, rect.height / 2)]
        ];

        return samples.some(([rawX, rawY]) => {
          const x = Math.min(Math.max(rawX, 0), viewportWidth - 1);
          const y = Math.min(Math.max(rawY, 0), viewportHeight - 1);
          const topElement = document.elementFromPoint(x, y);

          return topElement !== null && (element === topElement || element.contains(topElement));
        });
      };

      const selectorMatches = input.selectors.flatMap((selector) =>
        [...document.querySelectorAll(selector)].flatMap((element) => {
          if (isElementSkipped(element) || !isStyleVisible(element)) {
            return [];
          }

          const rect = element.getBoundingClientRect();
          if (!intersectsFirstViewport(rect) || !isTopVisible(element, rect)) {
            return [];
          }

          return [
            {
              kind: "selector",
              selector,
              tagName: element.tagName.toLowerCase(),
              className: element.getAttribute("class") ?? "",
              testId: element.getAttribute("data-testid") ?? "",
              shellSurfaceGroup: element.getAttribute("data-shell-surface-group") ?? "",
              rect: {
                top: rect.top,
                left: rect.left,
                right: rect.right,
                bottom: rect.bottom,
                width: rect.width,
                height: rect.height
              },
              text: (element.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 160)
            }
          ];
        })
      );

      const textMatches = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
        const text = (node.nodeValue ?? "").replace(/\s+/g, " ").trim();
        const parent = node.parentElement;

        if (text.length === 0 || parent === null || isElementSkipped(parent) || !isStyleVisible(parent)) {
          continue;
        }

        const matchedTerm = input.textTerms.find((term) =>
          text.toLowerCase().includes(term.toLowerCase())
        );
        if (matchedTerm === undefined) {
          continue;
        }

        const range = document.createRange();
        range.selectNodeContents(node);
        const rect = [...range.getClientRects()].find(
          (candidate) => intersectsFirstViewport(candidate) && isTopVisible(parent, candidate)
        );
        range.detach();

        if (rect === undefined) {
          continue;
        }

        textMatches.push({
          kind: "text",
          term: matchedTerm,
          tagName: parent.tagName.toLowerCase(),
          className: parent.getAttribute("class") ?? "",
          testId: parent.getAttribute("data-testid") ?? "",
          shellSurfaceGroup: parent.getAttribute("data-shell-surface-group") ?? "",
          rect: {
            top: rect.top,
            left: rect.left,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height
          },
          text: text.slice(0, 160)
        });
      }

      return {
        viewport: {
          width: viewportWidth,
          height: viewportHeight
        },
        visibleMatches: [...selectorMatches, ...textMatches].slice(0, 20)
      };
    },
    {
      activeTaskSelector,
      excludeActiveTask,
      selectors: legacySupportSelectors,
      textTerms: legacySupportTextTerms
    }
  );

const readVisibleTextEvidence = async (
  page,
  { rootSelector, excludeActiveTask, firstViewportOnly }
) =>
  page.evaluate(
    (input) => {
      const root = document.querySelector(input.rootSelector);
      const activeTask = document.querySelector(input.activeTaskSelector);
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = document.documentElement.clientHeight;

      if (root === null) {
        return {
          rootSelector: input.rootSelector,
          found: false,
          text: "",
          segments: []
        };
      }

      const skippedTags = new Set([
        "input",
        "textarea",
        "select",
        "option",
        "script",
        "style",
        "noscript",
        "template"
      ]);

      const isStyleVisible = (element) => {
        for (
          let current = element;
          current instanceof HTMLElement;
          current = current.parentElement
        ) {
          const tagName = current.tagName.toLowerCase();
          if (skippedTags.has(tagName)) {
            return false;
          }

          const style = window.getComputedStyle(current);
          if (
            style.display === "none" ||
            style.visibility === "hidden" ||
            Number(style.opacity || "1") <= 0 ||
            current.hidden ||
            current.getAttribute("aria-hidden") === "true"
          ) {
            return false;
          }
        }

        return true;
      };

      const intersectsViewport = (rect) =>
        rect.width > 0 &&
        rect.height > 0 &&
        rect.right > 0 &&
        rect.left < viewportWidth &&
        (!input.firstViewportOnly || (rect.bottom > 0 && rect.top < viewportHeight));

      const segments = [];
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
        const text = (node.nodeValue ?? "").replace(/\s+/g, " ").trim();
        const parent = node.parentElement;

        if (text.length === 0 || parent === null) {
          continue;
        }

        if (input.excludeActiveTask && activeTask?.contains(parent)) {
          continue;
        }

        if (!isStyleVisible(parent)) {
          continue;
        }

        const range = document.createRange();
        range.selectNodeContents(node);
        const rect = [...range.getClientRects()].find(intersectsViewport);
        range.detach();

        if (rect === undefined) {
          continue;
        }

        segments.push({
          text,
          tagName: parent.tagName.toLowerCase(),
          className: parent.getAttribute("class") ?? "",
          testId: parent.getAttribute("data-testid") ?? "",
          rect: {
            top: rect.top,
            left: rect.left,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height
          }
        });
      }

      return {
        rootSelector: input.rootSelector,
        found: true,
        text: segments.map((segment) => segment.text).join(" "),
        segments
      };
    },
    {
      rootSelector,
      activeTaskSelector,
      excludeActiveTask,
      firstViewportOnly
    }
  );

const assertNoScrollJump = (before, after, label) => {
  const scrollYDelta = Math.abs(after.scrollY - before.scrollY);
  const scrollTopDelta = Math.abs(after.scrollTop - before.scrollTop);

  if (scrollYDelta > scrollTolerancePx || scrollTopDelta > scrollTolerancePx) {
    throw new Error(
      `[scroll-jump] ${label}: expected <=${scrollTolerancePx}px, received ${JSON.stringify({
        before,
        after,
        scrollYDelta,
        scrollTopDelta
      })}.`
    );
  }
};

const assertTaskWindowUxMetrics = (metrics, label) => {
  const failures = [];
  const viewport = metrics.viewport;

  if (
    metrics.markers.role !== "dialog" ||
    metrics.markers.taskWindowScope !== "workspace" ||
    metrics.markers.taskWindowRegion !== "window" ||
    metrics.markers.shellSurfaceId !== "psdImportTask"
  ) {
    failures.push({ category: "supplementary-markers", markers: metrics.markers });
  }

  if (metrics.hasGeometryEvidence !== true) {
    failures.push({ category: "missing-geometry-evidence", root: metrics.root, frame: metrics.frame });
  }

  if (!isRectContainedInViewport(metrics.root.rect, viewport)) {
    failures.push({ category: "root-not-viewport-contained", rect: metrics.root.rect, viewport });
  }

  if (!isRectContainedInViewport(metrics.frame.rect, viewport)) {
    failures.push({ category: "frame-not-viewport-contained", rect: metrics.frame.rect, viewport });
  }

  if (!hasNonStaticPosition(metrics.root.style, metrics.frame.style)) {
    failures.push({
      category: "not-overlay-positioned",
      rootPosition: metrics.root.style?.position ?? null,
      framePosition: metrics.frame.style?.position ?? null
    });
  }

  if (metrics.documentHeightDelta > 1) {
    failures.push({
      category: "document-height-inflated",
      documentHeightDelta: metrics.documentHeightDelta,
      beforeOpen: metrics.scroll.beforeOpen.scrollHeight,
      afterFocusSettled: metrics.scroll.afterFocusSettled.scrollHeight
    });
  }

  if (metrics.stacking.centerResolvesInsideActiveTask !== true) {
    failures.push({ category: "center-not-stacked-in-active-task", stacking: metrics.stacking });
  }

  for (const affordanceName of ["back", "close"]) {
    const affordance = metrics.affordances[affordanceName];
    if (
      affordance.exists !== true ||
      affordance.disabled === true ||
      affordance.contained !== true
    ) {
      failures.push({ category: `${affordanceName}-affordance-not-visible`, affordance });
    }
  }

  if (metrics.overflow.documentOverflowsHorizontally || metrics.overflow.overflowingElements.length > 0) {
    failures.push({ category: "horizontal-overflow", overflow: metrics.overflow });
  }

  if (failures.length > 0) {
    throw new Error(`[task-window-ux-geometry] ${label}: ${JSON.stringify(failures)}.`);
  }
};

const assertNoVisibleLegacySupport = (evidence, label) => {
  if (evidence.visibleMatches.length > 0) {
    throw new Error(
      `[legacy-support-first-viewport] ${label}: ${JSON.stringify(evidence.visibleMatches)}.`
    );
  }
};

const assertNoForbiddenVisibleText = (evidence, label) => {
  if (!evidence.found) {
    throw new Error(`[forbidden-primary-text] ${label}: root ${evidence.rootSelector} was missing.`);
  }

  const matches = forbiddenPrimaryTextPatterns.flatMap(({ label: patternLabel, pattern }) => {
    const match = evidence.text.match(pattern);
    return match === null
      ? []
      : [
          {
            pattern: patternLabel,
            match: match[0],
            context: createMatchContext(evidence.text, match.index ?? 0)
          }
        ];
  });

  if (matches.length > 0) {
    throw new Error(`[forbidden-primary-text] ${label}: ${JSON.stringify(matches)}.`);
  }
};

const assertPngEvidence = (evidence, viewport) => {
  const failures = [];

  if (evidence.format !== "png") {
    failures.push({ category: "unexpected-format", format: evidence.format });
  }

  if (!Number.isInteger(evidence.byteLength) || evidence.byteLength < 1024) {
    failures.push({ category: "png-byte-count-too-small", byteLength: evidence.byteLength });
  }

  if (!/^[a-f0-9]{64}$/.test(evidence.sha256)) {
    failures.push({ category: "missing-sha256", sha256: evidence.sha256 });
  }

  if (
    evidence.dimensions.width !== viewport.width ||
    evidence.dimensions.height !== viewport.height
  ) {
    failures.push({
      category: "png-dimensions-mismatch",
      dimensions: evidence.dimensions,
      viewport: {
        width: viewport.width,
        height: viewport.height
      }
    });
  }

  if (failures.length > 0) {
    throw new Error(`[screenshot-evidence] ${viewport.name}: ${JSON.stringify(failures)}.`);
  }
};

const isRectContainedInViewport = (rect, viewport) =>
  rect !== null &&
  rect.width > 0 &&
  rect.height > 0 &&
  rect.left >= -1 &&
  rect.top >= -1 &&
  rect.right <= viewport.width + 1 &&
  rect.bottom <= viewport.height + 1;

const hasNonStaticPosition = (...styles) =>
  styles.some((style) => style !== null && style.position !== "static");

const createMatchContext = (text, index) => {
  const start = Math.max(index - 60, 0);
  const end = Math.min(index + 120, text.length);

  return text.slice(start, end);
};

const summarizeTaskWindowMetrics = (metrics) => ({
  markers: metrics.markers,
  viewport: metrics.viewport,
  rootRect: metrics.root.rect,
  frameRect: metrics.frame.rect,
  rootPosition: metrics.root.style?.position ?? null,
  framePosition: metrics.frame.style?.position ?? null,
  documentHeightDelta: metrics.documentHeightDelta,
  centerResolvesInsideActiveTask: metrics.stacking.centerResolvesInsideActiveTask,
  affordances: metrics.affordances,
  horizontalOverflow: {
    documentOverflowsHorizontally: metrics.overflow.documentOverflowsHorizontally,
    overflowingElementCount: metrics.overflow.overflowingElements.length
  },
  hasGeometryEvidence: metrics.hasGeometryEvidence
});

const waitForTestId = async (page, testId) => {
  await page.waitFor(
    `test id ${testId}`,
    (id) => document.querySelector(`[data-testid="${id}"]`) !== null,
    { timeoutMs: 8_000 },
    testId
  );
};

const scrollDocumentToTop = async (page) => {
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document.scrollingElement?.scrollTo(0, 0);
  });
};

const waitForAnimationFrames = async (page, frameCount) => {
  await page.evaluate(
    (count) =>
      new Promise((resolve) => {
        let remaining = count;
        const step = () => {
          remaining -= 1;
          if (remaining <= 0) {
            resolve(true);
            return;
          }

          window.requestAnimationFrame(step);
        };

        window.requestAnimationFrame(step);
      }),
    frameCount
  );
};

const main = async () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  const browser = locateBrowserExecutable();
  const server = await startOrReuseEditorServer({ repoRoot });
  let launchedBrowser;

  try {
    console.log(
      `task-window-ux-focused-e2e: using ${browser.executable} (${browser.source}); server ${
        server.baseUrl
      } ${server.reused ? "reused" : "started"}`
    );

    launchedBrowser = await launchHeadlessBrowser({ executable: browser.executable });

    const failures = [];
    for (const viewport of taskWindowUxFocusedViewports) {
      const page = await createPageSession({
        browserPort: launchedBrowser.port,
        viewport,
        url: server.baseUrl
      });

      try {
        const result = await runTaskWindowUxFocusedGate({ page, viewport });
        console.log(
          `task-window-ux-focused-e2e: ${viewport.name} passed ${JSON.stringify({
            rootPosition: result.taskWindow.rootPosition,
            framePosition: result.taskWindow.framePosition,
            documentHeightDelta: result.taskWindow.documentHeightDelta,
            centerResolvesInsideActiveTask: result.taskWindow.centerResolvesInsideActiveTask,
            screenshot: result.screenshot
          })}`
        );
      } catch (error) {
        const message = formatErrorMessage(error);
        failures.push({ viewport: viewport.name, message });
        console.error(`task-window-ux-focused-e2e: ${viewport.name} failed: ${message}`);
      } finally {
        await page.close();
      }
    }

    if (failures.length > 0) {
      throw new Error(`task-window-ux-focused-e2e failures: ${JSON.stringify(failures)}.`);
    }
  } finally {
    if (launchedBrowser !== undefined) {
      await launchedBrowser.close();
    }

    await server.close();
  }
};

const formatErrorMessage = (error) => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
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
    console.log("task-window-ux-focused-e2e: gate passed");
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
