import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { locateBrowserExecutable } from "./browser-discovery.mjs";
import { launchHeadlessBrowser } from "./chrome-launcher.mjs";
import { createPageSession } from "./page-session.mjs";
import {
  createLayerTreePartGroupTestId,
  editorProjectStorageKey,
  editorTestIds
} from "./test-ids.mjs";
import { startOrReuseEditorServer } from "./vite-server.mjs";

export const productPreflightDiffSmokeViewports = [
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

const tutorialPackage = {
  packageId: "pkg_tutorial_mini_model",
  packageDisplayName: "Tutorial Mini Model",
  packageRevisionAfterCreate: 34,
  parentPartId: "part_tutorial_head"
};

const expectedCurrentReportId = "preflight_tutorial_mini_model";

const proposalTarget = {
  proposalId: "proposal_wave41ProductPreflightDiffE2e",
  operationId: "op_wave41ProductPreflightDiffCreatePart",
  stepId: "step_wave41ProductPreflightDiffCreatePart",
  partId: "part_wave41ProductPreflightDiffPreview",
  displayName: "Wave41 Product Preflight Diff Preview"
};

const forbiddenPositiveClaims = [
  "repo-side candidate generation",
  "candidate ranking available",
  "LLM provider configured",
  "prompt template ready",
  "natural-language repair ready",
  "auto-fix available",
  "automatic commit enabled",
  "automatic commit allowed",
  "automatic commit available",
  "parser/image decode supported",
  "image decode passed",
  "archive/filesystem supported",
  "standard ZIP supported",
  "File System Access API available",
  "renderer/pixel oracle passed",
  "Cubism compatibility passed",
  "Cubism support available",
  "persisted product preflight artifact",
  "exported product preflight artifact",
  "release acceptance gate"
];

export const runProductPreflightDiffE2eSmoke = async ({ page, viewport }) => {
  await waitForTestId(page, editorTestIds.shell);
  await waitForTestId(page, editorTestIds.productPreflightPanel);
  await waitForTestId(page, editorTestIds.codexProposalReviewPanel);

  await clickTestId(page, editorTestIds.tutorialWorkflowCreate);
  await waitForText(page, editorTestIds.packageStatus, tutorialPackage.packageId);
  await waitForText(page, editorTestIds.packageStatus, tutorialPackage.packageDisplayName);
  await waitForText(page, editorTestIds.packageRevision, "Package r34 / authoring r34");
  await waitForOperationLogEntryCount(page, tutorialPackage.packageRevisionAfterCreate);

  const setupRevision = await readPackageRevision(page);
  assertRevision(
    setupRevision,
    tutorialPackage.packageRevisionAfterCreate,
    `${viewport.name} tutorial setup`
  );

  await runProductPreflight(page, `${viewport.name} first Product Preflight run`);
  await assertFirstProductPreflightComparison(page, viewport);
  await assertPreCommitSafety(page, viewport, {
    label: "after first Product Preflight run",
    expectProposalReviewLoaded: false
  });

  const proposal = createCodexProposal({
    basePackageRevision: setupRevision.packageRevision
  });
  await submitCodexProposalReview(page, proposal);
  await waitForText(
    page,
    editorTestIds.codexProposalReviewStatus,
    `${proposalTarget.proposalId} / valid`
  );
  await waitForText(
    page,
    editorTestIds.codexProposalReviewStatus,
    "validation valid / diff ready / rerun pass"
  );
  await waitForText(
    page,
    editorTestIds.productPreflightComparisonSummary,
    "Current -> proposal preview"
  );
  await assertProposalPreviewComparison(page, viewport, "after proposal preview");
  await assertPreCommitSafety(page, viewport, {
    label: "after proposal preview",
    expectProposalReviewLoaded: true
  });

  await runProductPreflight(page, `${viewport.name} manual Product Preflight rerun`);
  await waitForText(
    page,
    editorTestIds.productPreflightComparisonSummary,
    "Current -> proposal preview"
  );
  await assertProposalPreviewComparison(page, viewport, "after manual rerun");
  await assertPreCommitSafety(page, viewport, {
    label: "after manual rerun",
    expectProposalReviewLoaded: true
  });

  const screenshot = await page.captureScreenshot(
    `${viewport.name} wave41 Product Preflight diff smoke`
  );

  return {
    viewport: viewport.name,
    proposalId: proposalTarget.proposalId,
    packageId: tutorialPackage.packageId,
    packageRevision: tutorialPackage.packageRevisionAfterCreate,
    screenshot
  };
};

const createCodexProposal = ({ basePackageRevision }) => ({
  schemaVersion: "codex-rigging-edit-proposal-v0",
  proposalId: proposalTarget.proposalId,
  createdAt: "2026-06-05T00:00:00.000Z",
  source: {
    surface: "codex",
    agentId: "agent_wave41ProductPreflightDiffE2e",
    submittedBy: "codex"
  },
  packageContext: {
    packageId: tutorialPackage.packageId,
    basePackageRevision,
    productPreflightStatus: "pass",
    validationReportIds: []
  },
  metadata: {
    title: "Create Wave41 Product Preflight diff preview part",
    summary: "Codex submitted a structured preview-only createPart proposal.",
    relatedAC: ["AC-MVP-014"],
    relatedScenarios: ["SC-AGENT-002"],
    userVisibleRationale:
      "Adds one semantic part under the tutorial head for deterministic preflight diff review."
  },
  operations: [
    {
      stepId: proposalTarget.stepId,
      operationType: "createPart",
      operationId: proposalTarget.operationId,
      targetRefs: [
        {
          kind: "part",
          id: proposalTarget.partId
        }
      ],
      payload: {
        partId: proposalTarget.partId,
        displayName: proposalTarget.displayName,
        parentPartId: tutorialPackage.parentPartId
      },
      expectedPreconditions: [
        {
          preconditionKind: "packageRevisionMatches",
          summary: "Proposal base package revision matches the current editor package."
        },
        {
          preconditionKind: "preflightAllowsPreview",
          summary: "The current Product Preflight result allows preview validation."
        }
      ],
      expectedOutcome: {
        summary:
          "Dry-run preview adds the part only to the preview session; it is not committed.",
        touchedTargetRefs: [
          {
            kind: "part",
            id: proposalTarget.partId
          }
        ],
        expectedEvidenceRefs: []
      }
    }
  ],
  approvalPolicy: {
    requiresUserApproval: true,
    allowAutomaticCommit: false
  },
  evidenceRefs: []
});

const runProductPreflight = async (page, label) => {
  await clickTestId(page, editorTestIds.productPreflightRun);
  await waitForText(page, editorTestIds.productPreflightStatus, expectedCurrentReportId);
  await waitForText(page, editorTestIds.productPreflightStatus, tutorialPackage.packageId);
  await waitForText(page, editorTestIds.productPreflightStatus, "r34");
  await waitForTestId(page, editorTestIds.productPreflightSummary);
  await waitForTestId(page, editorTestIds.productPreflightComparison);
  await waitForText(page, editorTestIds.productPreflightComparison, "manual rerun only");

  const state = await readProductPreflightStatus(page);
  if (!state.statusText.includes("pass / info")) {
    throw new Error(`${label} expected Product Preflight pass / info: ${state.statusText}.`);
  }
};

const assertFirstProductPreflightComparison = async (page, viewport) => {
  const comparison = await readProductPreflightComparison(page);
  const failures = [];

  expectText(comparison.root.text, "Deterministic report comparison", failures, "comparison heading");
  expectText(comparison.root.text, "0 deterministic report comparisons", failures, "initial comparison count");
  expectText(comparison.root.text, "Session-generated reports", failures, "session-only safety");
  expectText(comparison.summary.text, "No previous or proposal-preview report", failures, "initial diff empty state");
  expectText(comparison.rerun.text, "Current report rerun", failures, "current rerun row");
  expectText(comparison.rerun.text, "manual request available", failures, "manual rerun affordance");
  expectText(comparison.rerun.text, "Automatic rerun disabled", failures, "rerun safety");
  expectText(comparison.rerun.text, "automatic commit disabled", failures, "commit safety");

  if (comparison.rerun.itemCount !== 1) {
    failures.push(`expected exactly one current rerun affordance, received ${comparison.rerun.itemCount}`);
  }

  assertForbiddenPositiveClaimsAbsent(comparison.root.text, `${viewport.name} first comparison`);
  await assertSectionReachable(page, editorTestIds.productPreflightComparisonRerun, viewport);

  if (failures.length > 0) {
    throw new Error(`${viewport.name} first Product Preflight comparison failed: ${failures.join("; ")}.`);
  }
};

const assertProposalPreviewComparison = async (page, viewport, label) => {
  const comparison = await readProductPreflightComparison(page);
  const failures = [];

  expectText(comparison.root.text, "Deterministic report comparison", failures, "comparison heading");
  expectText(comparison.root.text, "2 deterministic report comparisons", failures, "comparison count");
  expectText(comparison.root.text, "Session-generated reports", failures, "session-only safety");
  expectText(comparison.root.text, "manual rerun only", failures, "manual rerun safety");
  expectText(comparison.root.text, "automatic commit disabled", failures, "commit safety");
  expectText(comparison.summary.text, "Previous -> current", failures, "previous to current diff");
  expectText(comparison.summary.text, "Current -> proposal preview", failures, "proposal preview diff");
  expectText(comparison.summary.text, expectedCurrentReportId, failures, "current report id");
  expectText(comparison.transitions.text, "Current -> proposal preview", failures, "proposal transitions");
  expectText(comparison.transitions.text, "modelStructure", failures, "category transition evidence");
  expectText(comparison.refs.text, "Current -> proposal preview", failures, "proposal evidence refs");
  expectAnyText(
    comparison.refs.text,
    [
      "operationLog:operations/log.jsonl",
      "validationReport:validation/reports/",
      "runtimeSnapshot:runtime/snapshots/",
      "byteAvailability:generated/byte-availability/",
      "tutorialReadiness:generated/tutorial-readiness/"
    ],
    failures,
    "evidence navigation artifact ref"
  );
  expectText(comparison.rerun.text, "Current report rerun", failures, "current rerun row");
  expectText(comparison.rerun.text, "Proposal-preview rerun", failures, "proposal rerun row");
  expectText(comparison.rerun.text, "manual request available", failures, "manual rerun affordance");
  expectText(comparison.rerun.text, "Automatic rerun disabled", failures, "rerun safety");
  expectText(comparison.rerun.text, "automatic commit disabled", failures, "commit safety");

  if (comparison.summary.itemCount !== 2) {
    failures.push(`expected two diff summary rows, received ${comparison.summary.itemCount}`);
  }
  if (comparison.transitions.itemCount < 20) {
    failures.push(`expected category transitions for both comparisons, received ${comparison.transitions.itemCount}`);
  }
  if (comparison.refs.itemCount < 1) {
    failures.push("expected at least one evidence or diagnostic ref change row");
  }
  if (comparison.rerun.itemCount !== 2) {
    failures.push(`expected current and proposal rerun affordances, received ${comparison.rerun.itemCount}`);
  }

  assertForbiddenPositiveClaimsAbsent(comparison.root.text, `${viewport.name} ${label} comparison`);
  await assertSectionReachable(page, editorTestIds.productPreflightComparisonRefs, viewport);
  await assertSectionReachable(page, editorTestIds.productPreflightComparisonRerun, viewport);

  if (failures.length > 0) {
    throw new Error(`${viewport.name} Product Preflight proposal comparison failed ${label}: ${failures.join("; ")}.`);
  }
};

const assertPreCommitSafety = async (
  page,
  viewport,
  { label, expectProposalReviewLoaded }
) => {
  const revision = await readPackageRevision(page);
  assertRevision(revision, tutorialPackage.packageRevisionAfterCreate, `${viewport.name} ${label}`);
  await waitForOperationLogEntryCount(page, tutorialPackage.packageRevisionAfterCreate);
  await assertElementAbsent(page, createLayerTreePartGroupTestId(proposalTarget.partId));

  if (!expectProposalReviewLoaded) {
    return;
  }

  const review = await readCodexProposalReview(page);
  const failures = [];

  expectText(review.statusText, `${proposalTarget.proposalId} / valid`, failures, "proposal status");
  expectText(review.statusText, "validation valid / diff ready / rerun pass", failures, "review status");
  expectText(review.diffText, "Preview only / not committed", failures, "preview-only diff");
  expectText(review.diffText, "1 added / 0 removed", failures, "preview diff change");
  expectText(review.rerunText, "pass / preview", failures, "proposal rerun validation");
  expectText(review.approvalText, "User approval required", failures, "approval required");
  expectText(review.approvalText, "Automatic commit disabled", failures, "automatic commit safety");

  const expectedButtons = {
    requestDisabled: false,
    recordDisabled: true,
    commitDisabled: true
  };
  if (JSON.stringify(review.buttons) !== JSON.stringify(expectedButtons)) {
    failures.push(
      `approval buttons should remain pre-commit ${JSON.stringify(expectedButtons)}, received ${JSON.stringify(review.buttons)}`
    );
  }

  assertForbiddenPositiveClaimsAbsent(review.panelText, `${viewport.name} ${label} Codex review`);

  if (failures.length > 0) {
    throw new Error(`${viewport.name} pre-commit safety failed ${label}: ${failures.join("; ")}.`);
  }
};

const submitCodexProposalReview = async (page, proposal) => {
  await page.evaluate((ids, proposalText) => {
    const input = document.querySelector(`[data-testid="${ids.input}"]`);
    const submit = document.querySelector(`[data-testid="${ids.submit}"]`);

    if (!(input instanceof HTMLTextAreaElement) || !(submit instanceof HTMLButtonElement)) {
      throw new Error("Codex proposal review controls were missing.");
    }
    if (submit.disabled) {
      throw new Error("Codex proposal review submit button was disabled.");
    }

    input.value = proposalText;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    submit.click();
  }, {
    input: editorTestIds.codexProposalReviewInput,
    submit: editorTestIds.codexProposalReviewSubmit
  }, JSON.stringify(proposal, null, 2));
};

const readProductPreflightStatus = async (page) =>
  page.evaluate((id) => ({
    statusText: document.querySelector(`[data-testid="${id}"]`)?.textContent ?? ""
  }), editorTestIds.productPreflightStatus);

const readProductPreflightComparison = async (page) =>
  page.evaluate((ids) => {
    const readSection = (id) => {
      const root = document.querySelector(`[data-testid="${id}"]`);
      return {
        exists: root !== null,
        text: root?.textContent ?? "",
        itemCount: root?.querySelectorAll("ul > li").length ?? 0
      };
    };

    return {
      root: readSection(ids.root),
      summary: readSection(ids.summary),
      transitions: readSection(ids.transitions),
      refs: readSection(ids.refs),
      rerun: readSection(ids.rerun)
    };
  }, {
    root: editorTestIds.productPreflightComparison,
    summary: editorTestIds.productPreflightComparisonSummary,
    transitions: editorTestIds.productPreflightComparisonTransitions,
    refs: editorTestIds.productPreflightComparisonRefs,
    rerun: editorTestIds.productPreflightComparisonRerun
  });

const readCodexProposalReview = async (page) =>
  page.evaluate((ids) => {
    const text = (id) => document.querySelector(`[data-testid="${id}"]`)?.textContent ?? "";
    const readDisabled = (id) => {
      const button = document.querySelector(`[data-testid="${id}"]`);
      if (!(button instanceof HTMLButtonElement)) {
        throw new Error(`Missing Codex proposal action button ${id}.`);
      }

      return button.disabled;
    };

    return {
      panelText: text(ids.panel),
      statusText: text(ids.status),
      diffText: text(ids.diff),
      rerunText: text(ids.rerunValidation),
      approvalText: text(ids.approval),
      buttons: {
        requestDisabled: readDisabled(ids.requestApproval),
        recordDisabled: readDisabled(ids.recordApproval),
        commitDisabled: readDisabled(ids.commit)
      }
    };
  }, {
    panel: editorTestIds.codexProposalReviewPanel,
    status: editorTestIds.codexProposalReviewStatus,
    diff: editorTestIds.codexProposalReviewDiff,
    rerunValidation: editorTestIds.codexProposalReviewRerunValidation,
    approval: editorTestIds.codexProposalReviewApproval,
    requestApproval: editorTestIds.codexProposalReviewRequestApproval,
    recordApproval: editorTestIds.codexProposalReviewRecordApproval,
    commit: editorTestIds.codexProposalReviewCommit
  });

const readPackageRevision = async (page) => {
  const revisionText = await readText(page, editorTestIds.packageRevision);
  const match = revisionText.match(/Package r(\d+) \/ authoring r(\d+)/);

  if (match === null) {
    throw new Error(`Could not parse package revision text: ${revisionText}.`);
  }

  return {
    text: revisionText,
    packageRevision: Number(match[1]),
    authoringRevision: Number(match[2])
  };
};

const assertRevision = (revision, expectedRevision, label) => {
  if (
    revision.packageRevision !== expectedRevision ||
    revision.authoringRevision !== expectedRevision
  ) {
    throw new Error(
      `${label} revision mismatch: expected package/authoring r${expectedRevision}, received ${JSON.stringify(revision)}.`
    );
  }
};

const assertSectionReachable = async (page, testId, viewport) => {
  const metrics = await page.evaluate((id) => {
    const element = document.querySelector(`[data-testid="${id}"]`);
    if (!(element instanceof HTMLElement)) {
      return null;
    }

    element.scrollIntoView({ block: "center", inline: "nearest" });
    const rect = element.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;

    return {
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      visible:
        rect.width > 0 &&
        rect.height > 0 &&
        rect.right > 0 &&
        rect.left < viewportWidth &&
        rect.bottom > 0 &&
        rect.top < viewportHeight
    };
  }, testId);

  if (metrics === null || !metrics.visible || metrics.width < 1 || metrics.height < 1) {
    throw new Error(`${viewport.name} section ${testId} was not reachable: ${JSON.stringify(metrics)}.`);
  }
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
    { timeoutMs: 15_000 },
    editorTestIds.operationLogSummary,
    expectedCount
  );
};

const assertElementAbsent = async (page, testId) => {
  const isPresent = await page.evaluate(
    (id) => document.querySelector(`[data-testid="${id}"]`) !== null,
    testId
  );

  if (isPresent) {
    throw new Error(`Expected ${testId} to be absent.`);
  }
};

const assertForbiddenPositiveClaimsAbsent = (text, label) => {
  const lowerText = text.toLowerCase();
  const hits = forbiddenPositiveClaims.filter((claim) =>
    lowerText.includes(claim.toLowerCase())
  );

  if (hits.length > 0) {
    throw new Error(`${label} contained forbidden positive claims: ${hits.join(", ")}.`);
  }
};

const expectText = (actual, expected, failures, label) => {
  if (!actual.includes(expected)) {
    failures.push(`${label} missing ${JSON.stringify(expected)} in ${JSON.stringify(actual.slice(0, 800))}`);
  }
};

const expectAnyText = (actual, expectedValues, failures, label) => {
  if (!expectedValues.some((expected) => actual.includes(expected))) {
    failures.push(
      `${label} missing one of ${JSON.stringify(expectedValues)} in ${JSON.stringify(actual.slice(0, 800))}`
    );
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
  try {
    await page.waitFor(
      `${testId} text ${expectedText}`,
      (id, text) => document.querySelector(`[data-testid="${id}"]`)?.textContent?.includes(text) ?? false,
      { timeoutMs: 15_000 },
      testId,
      expectedText
    );
  } catch (error) {
    const actualText = await readText(page, testId).catch(() => "");
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${message}; actual ${testId} text was "${actualText.slice(0, 1200)}".`);
  }
};

const readText = async (page, testId) =>
  page.evaluate((id) => document.querySelector(`[data-testid="${id}"]`)?.textContent ?? "", testId);

const main = async () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  const browser = locateBrowserExecutable();
  const server = await startOrReuseEditorServer({ repoRoot });
  let launchedBrowser;

  try {
    console.log(
      `product-preflight-diff-e2e: using ${browser.executable} (${browser.source}); server ${
        server.baseUrl
      } ${server.reused ? "reused" : "started"}`
    );

    launchedBrowser = await launchHeadlessBrowser({ executable: browser.executable });

    for (const viewport of productPreflightDiffSmokeViewports) {
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

        const result = await runProductPreflightDiffE2eSmoke({ page, viewport });
        console.log(
          `product-preflight-diff-e2e: ${viewport.name} passed proposal=${result.proposalId} package=${result.packageId} r${result.packageRevision}`
        );
        console.log(
          `product-preflight-diff-e2e: ${viewport.name} screenshot ${result.screenshot.format} base64Length=${result.screenshot.base64Length}`
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
    console.log("product-preflight-diff-e2e: smoke passed");
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
