import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { locateBrowserExecutable } from "./browser-discovery.mjs";
import { launchHeadlessBrowser } from "./chrome-launcher.mjs";
import { discloseLegacyDebugQuarantineForE2e } from "./internal-surfaces-harness.mjs";
import { createPageSession } from "./page-session.mjs";
import {
  createProductPreflightCategoryRowTestId,
  editorProjectStorageKey,
  editorTestIds
} from "./test-ids.mjs";
import { startOrReuseEditorServer } from "./vite-server.mjs";

export const productPreflightSmokeViewports = [
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

const expectedPackageId = "pkg_editor_browser_sample";
const expectedReportId = "preflight_editor_browser_sample";
const expectedCategories = [
  "modelStructure",
  "authoringWorkflowEvidence",
  "runtimeViewerEvidence",
  "meshTopologyUv",
  "composition",
  "rigControlDynamics",
  "assetBytes",
  "persistenceTransport",
  "tutorialDemoReadiness",
  "unsupportedClaims"
];
const statusValues = ["pass", "warn", "fail", "not_supported", "not_evaluated"];
const severityRank = {
  info: 0,
  warning: 1,
  error: 2,
  blocking: 3
};
const forbiddenSupportClaims = [
  "AI repair available",
  "LLM provider configured",
  "natural-language repair ready",
  "parser/image decode supported",
  "image decode passed",
  "archive/filesystem supported",
  "standard ZIP supported",
  "File System Access API available",
  "renderer/pixel oracle passed",
  "Cubism compatibility passed",
  "Cubism support available"
];

export const runProductPreflightE2eSmoke = async ({ page, viewport }) => {
  await waitForTestId(page, editorTestIds.shell);
  await discloseLegacyDebugQuarantineForE2e(page);
  await waitForTestId(page, editorTestIds.productPreflightPanel);
  await assertInitialProductPreflightState(page, `${viewport.name} initial`);
  await assertProductPreflightReachable(page, viewport);

  const first = await runAndReadProductPreflight(page, `${viewport.name} first run`);
  await saveProjectToBrowserStorage(page, `${viewport.name} after first preflight`);
  await reloadProjectFromBrowserStorage(page, `${viewport.name} after browser-local load`);
  await assertInitialProductPreflightState(page, `${viewport.name} after load`);

  const second = await runAndReadProductPreflight(page, `${viewport.name} rerun after load`);
  assertStableReportAfterLoad(first, second, viewport.name);

  const screenshot = await page.captureScreenshot(
    `${viewport.name} wave39 product preflight smoke`
  );

  return {
    viewport: viewport.name,
    reportId: first.reportId,
    packageId: first.packageId,
    overallStatus: first.overallStatus,
    categoryCounts: first.summaryCounts,
    sectionCounts: first.sectionCounts,
    screenshot
  };
};

const runAndReadProductPreflight = async (page, label) => {
  await clickTestId(page, editorTestIds.productPreflightRun);
  await waitForText(page, editorTestIds.productPreflightStatus, expectedReportId);
  await waitForText(page, editorTestIds.productPreflightStatus, expectedPackageId);
  await waitForTestId(page, editorTestIds.productPreflightSummary);
  await waitForTestId(page, editorTestIds.productPreflightCategorySummary);
  await waitForTestId(page, editorTestIds.productPreflightBlockingIssues);
  await waitForTestId(page, editorTestIds.productPreflightWarnings);
  await waitForTestId(page, editorTestIds.productPreflightUnsupportedClaims);
  await waitForTestId(page, editorTestIds.productPreflightNotEvaluated);

  for (const category of expectedCategories) {
    await waitForTestId(page, createProductPreflightCategoryRowTestId(category));
  }

  const report = await readProductPreflightReport(page);
  assertProductPreflightReport(report, label);

  return report;
};

const assertInitialProductPreflightState = async (page, label) => {
  await waitForText(page, editorTestIds.productPreflightStatus, "Not run");
  await waitForText(
    page,
    editorTestIds.productPreflightStatus,
    "No product preflight report has run in this editor session."
  );

  const initial = await page.evaluate((ids) => {
    const run = document.querySelector(`[data-testid="${ids.run}"]`);
    const status = document.querySelector(`[data-testid="${ids.status}"]`);

    return {
      runExists: run instanceof HTMLButtonElement,
      runDisabled: run instanceof HTMLButtonElement ? run.disabled : null,
      statusText: status?.textContent ?? "",
      summaryExists: document.querySelector(`[data-testid="${ids.summary}"]`) !== null,
      categorySummaryExists: document.querySelector(`[data-testid="${ids.categorySummary}"]`) !== null
    };
  }, {
    run: editorTestIds.productPreflightRun,
    status: editorTestIds.productPreflightStatus,
    summary: editorTestIds.productPreflightSummary,
    categorySummary: editorTestIds.productPreflightCategorySummary
  });

  if (
    !initial.runExists ||
    initial.runDisabled !== false ||
    initial.summaryExists ||
    initial.categorySummaryExists
  ) {
    throw new Error(
      `${label} Product Preflight initial state mismatch: ${JSON.stringify(initial)}.`
    );
  }
};

const assertProductPreflightReachable = async (page, viewport) => {
  const metrics = await page.evaluate((ids) => {
    const panel = document.querySelector(`[data-testid="${ids.panel}"]`);
    const run = document.querySelector(`[data-testid="${ids.run}"]`);

    if (!(panel instanceof HTMLElement) || !(run instanceof HTMLButtonElement)) {
      return null;
    }

    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const isVisible = (rect) =>
      rect.width > 0 &&
      rect.height > 0 &&
      rect.right > 0 &&
      rect.left < viewportWidth &&
      rect.bottom > 0 &&
      rect.top < viewportHeight;

    panel.scrollIntoView({ block: "center", inline: "nearest" });
    const panelRect = panel.getBoundingClientRect();
    const runRect = run.getBoundingClientRect();

    return {
      panelVisible: isVisible(panelRect),
      runVisible: isVisible(runRect),
      panelWidth: Math.round(panelRect.width),
      runWidth: Math.round(runRect.width),
      runDisabled: run.disabled
    };
  }, {
    panel: editorTestIds.productPreflightPanel,
    run: editorTestIds.productPreflightRun
  });

  if (
    metrics === null ||
    !metrics.panelVisible ||
    !metrics.runVisible ||
    metrics.panelWidth < 1 ||
    metrics.runWidth < 1 ||
    metrics.runDisabled
  ) {
    throw new Error(
      `${viewport.name} Product Preflight panel was not reachable: ${JSON.stringify(metrics)}.`
    );
  }
};

const readProductPreflightReport = async (page) =>
  page.evaluate(({ ids, categoryRows }) => {
    const readText = (testId) =>
      document.querySelector(`[data-testid="${testId}"]`)?.textContent ?? "";
    const readFacts = (testId) => {
      const root = document.querySelector(`[data-testid="${testId}"]`);
      const facts = {};

      for (const term of root?.querySelectorAll("dt") ?? []) {
        const key = term.textContent?.trim() ?? "";
        const value = term.nextElementSibling?.textContent?.trim() ?? "";
        facts[key] = value;
      }

      return facts;
    };
    const readSection = (testId) => {
      const root = document.querySelector(`[data-testid="${testId}"]`);
      const items = [...(root?.querySelectorAll("ul > li") ?? [])].map((item) =>
        item.textContent?.trim() ?? ""
      );
      const empty = root?.querySelector(".product-preflight-panel__empty");

      return {
        exists: root !== null,
        text: root?.textContent ?? "",
        itemCount: items.length,
        items,
        emptyText: empty?.textContent?.trim() ?? ""
      };
    };
    const statusRoot = document.querySelector(`[data-testid="${ids.status}"]`);

    return {
      statusText: statusRoot?.textContent ?? "",
      statusLabel:
        statusRoot?.querySelector(".product-preflight-panel__status-label")?.textContent?.trim() ??
        "",
      statusDetail:
        statusRoot?.querySelector(".product-preflight-panel__status-detail")?.textContent?.trim() ??
        "",
      panelText: readText(ids.panel),
      summaryText: readText(ids.summary),
      summaryFacts: readFacts(ids.summary),
      categorySummaryText: readText(ids.categorySummary),
      categories: categoryRows.map((row) => ({
        expectedCategory: row.category,
        testId: row.testId,
        text: readText(row.testId)
      })),
      sections: {
        blocking: readSection(ids.blockingIssues),
        warnings: readSection(ids.warnings),
        unsupported: readSection(ids.unsupportedClaims),
        notEvaluated: readSection(ids.notEvaluated)
      }
    };
  }, {
    ids: {
      panel: editorTestIds.productPreflightPanel,
      status: editorTestIds.productPreflightStatus,
      summary: editorTestIds.productPreflightSummary,
      categorySummary: editorTestIds.productPreflightCategorySummary,
      blockingIssues: editorTestIds.productPreflightBlockingIssues,
      warnings: editorTestIds.productPreflightWarnings,
      unsupportedClaims: editorTestIds.productPreflightUnsupportedClaims,
      notEvaluated: editorTestIds.productPreflightNotEvaluated
    },
    categoryRows: expectedCategories.map((category) => ({
      category,
      testId: createProductPreflightCategoryRowTestId(category)
    }))
  });

const assertProductPreflightReport = (report, label) => {
  const failures = [];
  const categories = report.categories.map(parseCategoryRow);
  const unparsedCategories = categories.filter((category) => category.parseError !== undefined);
  const summaryCounts = readSummaryCounts(report.summaryFacts, failures);
  const countedStatus = countStatuses(categories);
  const expectedOverallStatus = deriveReportStatus(countedStatus);
  const expectedHighestSeverity = deriveHighestSeverity(categories);
  const rowCountTotals = categories.reduce((totals, category) => ({
    evidenceRefs: totals.evidenceRefs + category.evidenceRefCount,
    diagnostics: totals.diagnostics + category.diagnosticRefCount,
    blocking: totals.blocking + category.blockingCount,
    unsupported: totals.unsupported + category.unsupportedCount,
    notEvaluated: totals.notEvaluated + category.notEvaluatedCount
  }), {
    evidenceRefs: 0,
    diagnostics: 0,
    blocking: 0,
    unsupported: 0,
    notEvaluated: 0
  });

  if (report.statusLabel !== `${expectedOverallStatus} / ${expectedHighestSeverity}`) {
    failures.push(
      `status label ${JSON.stringify(report.statusLabel)} did not match derived ${expectedOverallStatus} / ${expectedHighestSeverity}`
    );
  }
  if (!report.statusDetail.includes(expectedReportId) || !report.statusDetail.includes(expectedPackageId)) {
    failures.push(`status detail did not identify the expected report/package: ${report.statusDetail}`);
  }

  const statusDetail = parseStatusDetail(report.statusDetail);
  if (
    statusDetail === null ||
    statusDetail.reportId !== expectedReportId ||
    statusDetail.packageId !== expectedPackageId
  ) {
    failures.push(`status detail could not be parsed as report/package evidence: ${report.statusDetail}`);
  }

  if (unparsedCategories.length > 0) {
    failures.push(
      `unparsed category rows: ${unparsedCategories.map((category) => category.parseError).join("; ")}`
    );
  }
  if (categories.length !== expectedCategories.length) {
    failures.push(`expected ${expectedCategories.length} category rows, received ${categories.length}`);
  }

  const byCategory = new Map(categories.map((category) => [category.category, category]));
  for (const expectedCategory of expectedCategories) {
    const category = byCategory.get(expectedCategory);
    if (category === undefined) {
      failures.push(`missing category row ${expectedCategory}`);
      continue;
    }
    if (!report.categorySummaryText.includes(`${expectedCategory}: ${category.status}`)) {
      failures.push(`category summary text did not include ${expectedCategory}: ${category.status}`);
    }
  }

  assertEvaluatedCategoryWithEvidence({
    failures,
    category: byCategory.get("runtimeViewerEvidence"),
    categoryName: "runtimeViewerEvidence",
    reason: "editor preflight should run viewer evidence"
  });

  const assetBytes = byCategory.get("assetBytes");
  if (assetBytes?.status !== "pass") {
    failures.push(`assetBytes status ${JSON.stringify(assetBytes?.status)} did not match pass`);
  }
  assertEvaluatedCategoryWithEvidence({
    failures,
    category: assetBytes,
    categoryName: "assetBytes",
    reason: "editor preflight should verify browser package byte availability"
  });

  assertEvaluatedCategoryWithEvidence({
    failures,
    category: byCategory.get("tutorialDemoReadiness"),
    categoryName: "tutorialDemoReadiness",
    reason: "editor preflight should verify tutorial demo readiness"
  });

  if (summaryCounts.evidenceRefs < 1) {
    failures.push(`expected evidence refs to be nonzero, received ${summaryCounts.evidenceRefs}`);
  }

  for (const status of statusValues) {
    if (summaryCounts[status] !== countedStatus[status]) {
      failures.push(
        `summary ${status} count ${summaryCounts[status]} did not match ${countedStatus[status]} category rows`
      );
    }
  }
  if (summaryCounts.blockingIssues !== rowCountTotals.blocking) {
    failures.push(
      `blocking issue summary ${summaryCounts.blockingIssues} did not match row total ${rowCountTotals.blocking}`
    );
  }
  if (summaryCounts.warnings !== report.sections.warnings.itemCount) {
    failures.push(
      `warning summary ${summaryCounts.warnings} did not match warning section item count ${report.sections.warnings.itemCount}`
    );
  }
  if (summaryCounts.evidenceRefs < rowCountTotals.evidenceRefs) {
    failures.push(
      `summary evidence refs ${summaryCounts.evidenceRefs} was lower than category-row evidence refs ${rowCountTotals.evidenceRefs}`
    );
  }
  if (summaryCounts.diagnosticRefs < rowCountTotals.diagnostics) {
    failures.push(
      `summary diagnostic refs ${summaryCounts.diagnosticRefs} was lower than category-row diagnostic refs ${rowCountTotals.diagnostics}`
    );
  }

  assertIssueSection({
    failures,
    label: "blocking",
    section: report.sections.blocking,
    expectedCount: rowCountTotals.blocking,
    emptyText: "No blocking issues in the latest product preflight report."
  });
  assertIssueSection({
    failures,
    label: "warnings",
    section: report.sections.warnings,
    expectedCount: summaryCounts.warnings,
    emptyText: "No warn categories in the latest product preflight report."
  });
  assertIssueSection({
    failures,
    label: "not_supported",
    section: report.sections.unsupported,
    expectedCount: rowCountTotals.unsupported,
    emptyText: "No not_supported claims in the latest product preflight report."
  });
  assertIssueSection({
    failures,
    label: "not_evaluated",
    section: report.sections.notEvaluated,
    expectedCount: rowCountTotals.notEvaluated,
    emptyText: "No not_evaluated claims in the latest product preflight report."
  });

  if (rowCountTotals.notEvaluated !== report.sections.notEvaluated.itemCount) {
    failures.push(
      `not_evaluated row total ${rowCountTotals.notEvaluated} did not match section item count ${report.sections.notEvaluated.itemCount}`
    );
  }
  if (rowCountTotals.unsupported !== report.sections.unsupported.itemCount) {
    failures.push(
      `not_supported row total ${rowCountTotals.unsupported} did not match section item count ${report.sections.unsupported.itemCount}`
    );
  }

  const forbiddenClaims = forbiddenSupportClaims.filter((claim) => report.panelText.includes(claim));
  if (forbiddenClaims.length > 0) {
    failures.push(`forbidden support claims appeared in Product Preflight UI: ${forbiddenClaims.join(", ")}`);
  }

  if (failures.length > 0) {
    throw new Error(`${label} Product Preflight assertions failed: ${failures.join("; ")}.`);
  }

  report.reportId = statusDetail.reportId;
  report.packageId = statusDetail.packageId;
  report.packageRevision = statusDetail.packageRevision;
  report.overallStatus = expectedOverallStatus;
  report.highestSeverity = expectedHighestSeverity;
  report.summaryCounts = summaryCounts;
  report.parsedCategories = categories;
  report.sectionCounts = {
    blocking: report.sections.blocking.itemCount,
    warnings: report.sections.warnings.itemCount,
    unsupported: report.sections.unsupported.itemCount,
    notEvaluated: report.sections.notEvaluated.itemCount
  };
};

const parseCategoryRow = (row) => {
  const titleMatch = row.text.match(
    /^([^:]+): (pass|warn|fail|not_supported|not_evaluated) \/ (info|warning|error|blocking)/
  );
  const metaMatch = row.text.match(
    /(\d+) evidence \/ (\d+) diagnostics \/ (\d+) blocking \/ (\d+) not_supported \/ (\d+) not_evaluated/
  );

  if (titleMatch === null || metaMatch === null) {
    return {
      category: row.expectedCategory,
      status: "unknown",
      severity: "info",
      evidenceRefCount: 0,
      diagnosticRefCount: 0,
      blockingCount: 0,
      unsupportedCount: 0,
      notEvaluatedCount: 0,
      parseError: `${row.expectedCategory} row was not parseable: ${row.text}`
    };
  }

  return {
    category: titleMatch[1],
    expectedCategory: row.expectedCategory,
    status: titleMatch[2],
    severity: titleMatch[3],
    evidenceRefCount: Number(metaMatch[1]),
    diagnosticRefCount: Number(metaMatch[2]),
    blockingCount: Number(metaMatch[3]),
    unsupportedCount: Number(metaMatch[4]),
    notEvaluatedCount: Number(metaMatch[5]),
    text: row.text
  };
};

const readSummaryCounts = (facts, failures) => {
  const read = (key) => {
    const value = facts[key];
    const number = Number(value);

    if (!Number.isInteger(number) || number < 0) {
      failures.push(`summary fact ${key} was not a nonnegative integer: ${JSON.stringify(value)}`);
      return 0;
    }

    return number;
  };

  return {
    pass: read("pass"),
    warn: read("warn"),
    fail: read("fail"),
    not_supported: read("not_supported"),
    not_evaluated: read("not_evaluated"),
    blockingIssues: read("blocking issues"),
    warnings: read("warnings"),
    evidenceRefs: read("evidence refs"),
    diagnosticRefs: read("diagnostic refs")
  };
};

const countStatuses = (categories) => {
  const counts = {
    pass: 0,
    warn: 0,
    fail: 0,
    not_supported: 0,
    not_evaluated: 0
  };

  for (const category of categories) {
    if (statusValues.includes(category.status)) {
      counts[category.status] += 1;
    }
  }

  return counts;
};

const deriveReportStatus = (counts) => {
  if (counts.fail > 0) {
    return "fail";
  }
  if (counts.not_supported > 0) {
    return "not_supported";
  }
  if (counts.not_evaluated > 0) {
    return "not_evaluated";
  }
  if (counts.warn > 0) {
    return "warn";
  }

  return "pass";
};

const deriveHighestSeverity = (categories) =>
  categories.reduce(
    (highest, category) =>
      severityRank[category.severity] > severityRank[highest] ? category.severity : highest,
    "info"
  );

const parseStatusDetail = (detail) => {
  const match = detail.match(
    /^(preflight_[A-Za-z0-9_-]+) for (pkg_[A-Za-z0-9_-]+) (?:r(\d+)|report r(\d+); current r(\d+)); created .+\.$/
  );

  if (match === null) {
    return null;
  }

  return {
    reportId: match[1],
    packageId: match[2],
    packageRevision: Number(match[3] ?? match[4]),
    currentRevision: match[5] === undefined ? Number(match[3]) : Number(match[5])
  };
};

const assertIssueSection = ({ failures, label, section, expectedCount, emptyText }) => {
  if (!section.exists) {
    failures.push(`missing ${label} section`);
    return;
  }

  if (expectedCount === 0) {
    if (section.itemCount !== 0 || section.emptyText !== emptyText) {
      failures.push(
        `${label} section empty state mismatch: expected ${JSON.stringify(emptyText)}, received ${JSON.stringify(section)}`
      );
    }
    return;
  }

  if (section.itemCount !== expectedCount || section.emptyText.length > 0) {
    failures.push(
      `${label} section item count mismatch: expected ${expectedCount}, received ${JSON.stringify(section)}`
    );
  }
};

const assertEvaluatedCategoryWithEvidence = ({ failures, category, categoryName, reason }) => {
  if (category === undefined) {
    return;
  }

  if (category.status === "not_evaluated" || category.notEvaluatedCount > 0) {
    failures.push(
      `${categoryName} stayed not_evaluated even though ${reason}; status=${category.status}, notEvaluatedClaims=${category.notEvaluatedCount}`
    );
  }
  if (category.evidenceRefCount < 1) {
    failures.push(`${categoryName} did not expose any evidence refs`);
  }
};

const assertStableReportAfterLoad = (first, second, viewportName) => {
  const firstStable = toStableReportShape(first);
  const secondStable = toStableReportShape(second);

  if (JSON.stringify(firstStable) !== JSON.stringify(secondStable)) {
    throw new Error(
      `${viewportName} Product Preflight report changed after browser-local save/load: first=${JSON.stringify(
        firstStable
      )} second=${JSON.stringify(secondStable)}.`
    );
  }
};

const toStableReportShape = (report) => ({
  reportId: report.reportId,
  packageId: report.packageId,
  packageRevision: report.packageRevision,
  overallStatus: report.overallStatus,
  highestSeverity: report.highestSeverity,
  summaryCounts: report.summaryCounts,
  categories: report.parsedCategories.map((category) => ({
    category: category.category,
    status: category.status,
    severity: category.severity,
    evidenceRefCount: category.evidenceRefCount,
    diagnosticRefCount: category.diagnosticRefCount,
    blockingCount: category.blockingCount,
    unsupportedCount: category.unsupportedCount,
    notEvaluatedCount: category.notEvaluatedCount
  })),
  sectionCounts: report.sectionCounts
});

const saveProjectToBrowserStorage = async (page, label) => {
  await waitForTestId(page, editorTestIds.projectPersistencePanel);
  await clickTestId(page, editorTestIds.projectPersistenceSave);
  await waitForText(page, editorTestIds.projectPersistenceStatus, "Saved");

  const saved = await page.evaluate((storageKey) => {
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
      packageFileCount: packagePaths.length,
      hasManifest: packagePaths.includes("manifest.json"),
      hasGraph: packagePaths.includes("model/graph.json"),
      hasParameters: packagePaths.includes("model/parameters.json")
    };
  }, editorProjectStorageKey);

  if (
    saved === null ||
    saved.schemaVersion !== "editor-project-persistence-v1" ||
    saved.packageId !== expectedPackageId ||
    saved.packageFileCount < 1 ||
    !saved.hasManifest ||
    !saved.hasGraph ||
    !saved.hasParameters
  ) {
    throw new Error(`${label} browser-local save was invalid: ${JSON.stringify(saved)}.`);
  }
};

const reloadProjectFromBrowserStorage = async (page, label) => {
  await page.reload();
  await waitForTestId(page, editorTestIds.shell);
  await discloseLegacyDebugQuarantineForE2e(page);
  await waitForTestId(page, editorTestIds.projectPersistenceLoad);
  await waitForTestId(page, editorTestIds.productPreflightPanel);
  await clickTestId(page, editorTestIds.projectPersistenceLoad);
  await waitForText(page, editorTestIds.projectPersistenceStatus, "Loaded");
  await waitForText(page, editorTestIds.packageStatus, expectedPackageId);
  await waitForText(page, editorTestIds.productPreflightStatus, "Not run");

  const loaded = await page.evaluate((ids) => ({
    persistenceStatus: document.querySelector(`[data-testid="${ids.persistenceStatus}"]`)?.textContent ?? "",
    preflightStatus: document.querySelector(`[data-testid="${ids.preflightStatus}"]`)?.textContent ?? "",
    hasPreflightSummary:
      document.querySelector(`[data-testid="${ids.preflightSummary}"]`) !== null
  }), {
    persistenceStatus: editorTestIds.projectPersistenceStatus,
    preflightStatus: editorTestIds.productPreflightStatus,
    preflightSummary: editorTestIds.productPreflightSummary
  });

  if (!loaded.persistenceStatus.includes("Loaded") || loaded.hasPreflightSummary) {
    throw new Error(`${label} browser-local load state mismatch: ${JSON.stringify(loaded)}.`);
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
    { timeoutMs: 15_000 },
    testId,
    expectedText
  );
};

const main = async () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  const browser = locateBrowserExecutable();
  const server = await startOrReuseEditorServer({ repoRoot });
  let launchedBrowser;

  try {
    console.log(
      `product-preflight-e2e: using ${browser.executable} (${browser.source}); server ${
        server.baseUrl
      } ${server.reused ? "reused" : "started"}`
    );

    launchedBrowser = await launchHeadlessBrowser({ executable: browser.executable });

    for (const viewport of productPreflightSmokeViewports) {
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

        const result = await runProductPreflightE2eSmoke({ page, viewport });
        console.log(
          `product-preflight-e2e: ${viewport.name} passed report=${result.reportId} status=${result.overallStatus}`
        );
        console.log(
          `product-preflight-e2e: ${viewport.name} screenshot ${result.screenshot.format} base64Length=${result.screenshot.base64Length}`
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
    console.log("product-preflight-e2e: smoke passed");
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
