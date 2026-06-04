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

export const codexProposalReviewSmokeViewports = [
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
  packageRevisionAfterCommit: 35,
  parentPartId: "part_tutorial_head"
};

const proposalTarget = {
  proposalId: "proposal_wave40E2eCodexReview",
  operationId: "op_wave40E2eCodexReviewCreatePart",
  stepId: "step_wave40E2eCreateReviewPart",
  partId: "part_wave40E2eCodexReview",
  displayName: "Wave40 E2E Codex Review"
};

const forbiddenSupportClaims = [
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
  "Cubism support available"
];

export const runCodexProposalReviewSmoke = async ({ page, viewport }) => {
  await waitForTestId(page, editorTestIds.shell);
  await waitForTestId(page, editorTestIds.codexProposalReviewPanel);
  await assertInitialCodexProposalReviewState(page, viewport);

  await clickTestId(page, editorTestIds.tutorialWorkflowCreate);
  await waitForText(page, editorTestIds.packageStatus, tutorialPackage.packageId);
  await waitForText(page, editorTestIds.packageStatus, tutorialPackage.packageDisplayName);
  await waitForText(page, editorTestIds.packageRevision, "Package r34 / authoring r34");
  await waitForOperationLogEntryCount(page, tutorialPackage.packageRevisionAfterCreate);

  const revisionBeforeReview = await readPackageRevision(page);
  assertRevision(
    revisionBeforeReview,
    tutorialPackage.packageRevisionAfterCreate,
    `${viewport.name} tutorial package setup`
  );

  const proposal = createCodexProposal({ basePackageRevision: revisionBeforeReview.packageRevision });
  await submitCodexProposalReview(page, proposal);
  await waitForText(page, editorTestIds.codexProposalReviewStatus, `${proposalTarget.proposalId} / valid`);
  await waitForText(page, editorTestIds.codexProposalReviewStatus, "validation valid / diff ready / rerun pass");
  await assertReviewedProposal(page, viewport, {
    expectedRevision: revisionBeforeReview.packageRevision,
    expectedButtonState: {
      requestDisabled: false,
      recordDisabled: true,
      commitDisabled: true
    },
    label: "after review"
  });

  await clickTestId(page, editorTestIds.codexProposalReviewRequestApproval);
  await waitForText(page, editorTestIds.codexProposalReviewStatus, "approval requested");
  await waitForText(page, editorTestIds.codexProposalReviewApproval, "needs_approval");
  await assertReviewedProposal(page, viewport, {
    expectedRevision: revisionBeforeReview.packageRevision,
    expectedButtonState: {
      requestDisabled: true,
      recordDisabled: false,
      commitDisabled: true
    },
    label: "after approval request"
  });

  await clickTestId(page, editorTestIds.codexProposalReviewRecordApproval);
  await waitForText(page, editorTestIds.codexProposalReviewStatus, "approval approved");
  await waitForText(page, editorTestIds.codexProposalReviewApproval, "approved_not_committed");
  await assertReviewedProposal(page, viewport, {
    expectedRevision: revisionBeforeReview.packageRevision,
    expectedButtonState: {
      requestDisabled: true,
      recordDisabled: true,
      commitDisabled: false
    },
    label: "after approval record"
  });

  await clickTestId(page, editorTestIds.codexProposalReviewCommit);
  await waitForText(page, editorTestIds.packageRevision, "Package r35 / authoring r35");
  await waitForText(page, editorTestIds.codexProposalReviewStatus, "commit committed");
  await waitForText(page, editorTestIds.codexProposalReviewApproval, "committed");
  await waitForText(page, editorTestIds.operationStatus, "createPart committed");
  await waitForText(page, createLayerTreePartGroupTestId(proposalTarget.partId), proposalTarget.displayName);
  await waitForOperationLogEntryCount(page, tutorialPackage.packageRevisionAfterCommit);
  await assertCommittedProposalState(page, viewport);

  const screenshot = await page.captureScreenshot(`${viewport.name} wave40 Codex proposal review smoke`);

  return {
    viewport: viewport.name,
    proposalId: proposalTarget.proposalId,
    packageId: tutorialPackage.packageId,
    revisionBeforeReview: revisionBeforeReview.packageRevision,
    revisionAfterCommit: tutorialPackage.packageRevisionAfterCommit,
    screenshot
  };
};

const createCodexProposal = ({ basePackageRevision }) => ({
  schemaVersion: "codex-rigging-edit-proposal-v0",
  proposalId: proposalTarget.proposalId,
  createdAt: "2026-06-04T00:00:00.000Z",
  source: {
    surface: "codex",
    agentId: "agent_wave40E2eCodexReview",
    submittedBy: "codex"
  },
  packageContext: {
    packageId: tutorialPackage.packageId,
    basePackageRevision,
    productPreflightStatus: "pass",
    validationReportIds: []
  },
  metadata: {
    title: "Create Wave40 e2e review part",
    summary: "Codex submitted a structured createPart proposal for browser review.",
    relatedAC: ["AC-MVP-014"],
    relatedScenarios: ["SC-AGENT-002"],
    userVisibleRationale: "Adds one semantic part under the tutorial head for manual approval review."
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
        summary: "Dry-run preview adds the part without committing it.",
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

const assertInitialCodexProposalReviewState = async (page, viewport) => {
  await waitForText(page, editorTestIds.codexProposalReviewStatus, "No Codex proposal loaded");
  await waitForText(
    page,
    editorTestIds.codexProposalReviewStatus,
    "No proposal has been submitted to the review surface in this editor session."
  );

  const state = await page.evaluate((ids) => {
    const panel = document.querySelector(`[data-testid="${ids.panel}"]`);
    const form = document.querySelector(`[data-testid="${ids.form}"]`);
    const input = document.querySelector(`[data-testid="${ids.input}"]`);
    const submit = document.querySelector(`[data-testid="${ids.submit}"]`);
    const clear = document.querySelector(`[data-testid="${ids.clear}"]`);
    const proposal = document.querySelector(`[data-testid="${ids.proposal}"]`);

    if (
      !(panel instanceof HTMLElement) ||
      !(form instanceof HTMLFormElement) ||
      !(input instanceof HTMLTextAreaElement) ||
      !(submit instanceof HTMLButtonElement) ||
      !(clear instanceof HTMLButtonElement)
    ) {
      return null;
    }

    input.scrollIntoView({ block: "center", inline: "nearest" });
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const rectVisible = (rect) =>
      rect.width > 0 &&
      rect.height > 0 &&
      rect.right > 0 &&
      rect.left < viewportWidth &&
      rect.bottom > 0 &&
      rect.top < viewportHeight;

    return {
      panelVisible: rectVisible(panel.getBoundingClientRect()),
      inputVisible: rectVisible(input.getBoundingClientRect()),
      submitVisible: rectVisible(submit.getBoundingClientRect()),
      formName: form.getAttribute("aria-label") ?? "",
      inputDisabled: input.disabled,
      submitDisabled: submit.disabled,
      clearDisabled: clear.disabled,
      proposalSectionPresent: proposal !== null,
      panelText: panel.textContent ?? ""
    };
  }, {
    panel: editorTestIds.codexProposalReviewPanel,
    form: editorTestIds.codexProposalReviewForm,
    input: editorTestIds.codexProposalReviewInput,
    submit: editorTestIds.codexProposalReviewSubmit,
    clear: editorTestIds.codexProposalReviewClear,
    proposal: editorTestIds.codexProposalReviewProposal
  });

  if (
    state === null ||
    !state.panelVisible ||
    !state.inputVisible ||
    !state.submitVisible ||
    state.formName !== "Review pasted Codex proposal JSON" ||
    state.inputDisabled ||
    state.submitDisabled ||
    !state.clearDisabled ||
    state.proposalSectionPresent
  ) {
    throw new Error(`${viewport.name} initial Codex proposal review state mismatch: ${JSON.stringify(state)}.`);
  }

  assertForbiddenSupportClaimsAbsent(state.panelText, `${viewport.name} initial Codex proposal panel`);
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

const assertReviewedProposal = async (
  page,
  viewport,
  { expectedRevision, expectedButtonState, label }
) => {
  const revision = await readPackageRevision(page);
  assertRevision(revision, expectedRevision, `${viewport.name} ${label}`);
  await assertElementAbsent(page, createLayerTreePartGroupTestId(proposalTarget.partId));

  const review = await readCodexProposalReview(page);
  const failures = [];

  expectText(review.proposal.text, proposalTarget.proposalId, failures, "proposal id");
  expectText(review.proposal.text, "Create Wave40 e2e review part", failures, "proposal title");
  expectText(review.proposal.text, "User approval required / automatic commit disabled", failures, "proposal policy");
  expectText(review.operations.text, `${proposalTarget.stepId}: createPart`, failures, "operation step");
  expectText(review.operations.text, proposalTarget.operationId, failures, "operation id");
  expectText(review.operations.text, `part:${proposalTarget.partId}`, failures, "operation target");
  expectText(review.validation.text, "valid / preview yes / approval yes", failures, "validation status");
  expectText(review.validation.text, "Preview available", failures, "validation preview");
  expectText(review.validationIssues.text, "No proposal validation issues.", failures, "validation issues");
  expectText(review.diff.text, "ready", failures, "diff status");
  expectText(review.diff.text, "Preview only / not committed", failures, "diff safety");
  expectText(review.diff.text, "1 added / 0 removed", failures, "model diff");
  expectText(review.diff.text, "1 operation ids", failures, "model operation diff");
  expectText(review.rerunValidation.text, "pass / preview", failures, "rerun validation status");
  expectText(review.rerunValidation.text, "Product Preflight", failures, "rerun product preflight section");
  expectText(review.rerunValidation.text, tutorialPackage.packageId, failures, "rerun package id");
  expectText(review.approval.text, "User approval required", failures, "approval requirement");
  expectText(review.approval.text, "Automatic commit disabled", failures, "automatic commit safety");
  expectText(review.approval.text, "evidence refs", failures, "approval evidence");

  if (JSON.stringify(review.buttons) !== JSON.stringify(expectedButtonState)) {
    failures.push(
      `button state mismatch: expected ${JSON.stringify(expectedButtonState)}, received ${JSON.stringify(review.buttons)}`
    );
  }

  assertForbiddenSupportClaimsAbsent(review.panelText, `${viewport.name} ${label} Codex proposal panel`);

  if (failures.length > 0) {
    throw new Error(`${viewport.name} Codex proposal review assertions failed ${label}: ${failures.join("; ")}.`);
  }
};

const assertCommittedProposalState = async (page, viewport) => {
  const revision = await readPackageRevision(page);
  assertRevision(revision, tutorialPackage.packageRevisionAfterCommit, `${viewport.name} after explicit commit`);

  const review = await readCodexProposalReview(page);
  const failures = [];

  expectText(review.approval.text, "approved", failures, "approval status");
  expectText(review.approval.text, "committed", failures, "commit status");
  expectText(review.approval.text, "Automatic commit disabled", failures, "automatic commit safety");
  expectText(review.approval.text, "User approval required", failures, "approval requirement");
  expectText(review.diff.text, "Preview only / not committed", failures, "diff safety retained");
  expectText(review.rerunValidation.text, "pass / preview", failures, "rerun retained");

  const expectedButtonState = {
    requestDisabled: true,
    recordDisabled: true,
    commitDisabled: true
  };
  if (JSON.stringify(review.buttons) !== JSON.stringify(expectedButtonState)) {
    failures.push(
      `post-commit button state mismatch: expected ${JSON.stringify(expectedButtonState)}, received ${JSON.stringify(review.buttons)}`
    );
  }

  assertForbiddenSupportClaimsAbsent(review.panelText, `${viewport.name} committed Codex proposal panel`);

  if (failures.length > 0) {
    throw new Error(`${viewport.name} Codex proposal committed assertions failed: ${failures.join("; ")}.`);
  }
};

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
      proposal: { text: text(ids.proposal) },
      operations: { text: text(ids.operations) },
      validation: { text: text(ids.validation) },
      validationIssues: { text: text(ids.validationIssues) },
      diff: { text: text(ids.diff) },
      rerunValidation: { text: text(ids.rerunValidation) },
      approval: { text: text(ids.approval) },
      buttons: {
        requestDisabled: readDisabled(ids.requestApproval),
        recordDisabled: readDisabled(ids.recordApproval),
        commitDisabled: readDisabled(ids.commit)
      }
    };
  }, {
    panel: editorTestIds.codexProposalReviewPanel,
    status: editorTestIds.codexProposalReviewStatus,
    proposal: editorTestIds.codexProposalReviewProposal,
    operations: editorTestIds.codexProposalReviewOperations,
    validation: editorTestIds.codexProposalReviewValidation,
    validationIssues: editorTestIds.codexProposalReviewValidationIssues,
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

const assertForbiddenSupportClaimsAbsent = (text, label) => {
  const hits = forbiddenSupportClaims.filter((claim) =>
    text.toLowerCase().includes(claim.toLowerCase())
  );

  if (hits.length > 0) {
    throw new Error(`${label} contained forbidden positive support claims: ${hits.join(", ")}.`);
  }
};

const expectText = (actual, expected, failures, label) => {
  if (!actual.includes(expected)) {
    failures.push(`${label} missing ${JSON.stringify(expected)} in ${JSON.stringify(actual.slice(0, 800))}`);
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

const readText = async (page, testId) =>
  page.evaluate((id) => document.querySelector(`[data-testid="${id}"]`)?.textContent ?? "", testId);

const main = async () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  const browser = locateBrowserExecutable();
  const server = await startOrReuseEditorServer({ repoRoot });
  let launchedBrowser;

  try {
    console.log(
      `codex-proposal-review-e2e: using ${browser.executable} (${browser.source}); server ${server.baseUrl} ${
        server.reused ? "reused" : "started"
      }`
    );

    launchedBrowser = await launchHeadlessBrowser({ executable: browser.executable });

    for (const viewport of codexProposalReviewSmokeViewports) {
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

        const result = await runCodexProposalReviewSmoke({ page, viewport });
        console.log(
          `codex-proposal-review-e2e: ${viewport.name} passed proposal=${result.proposalId} r${result.revisionBeforeReview}->r${result.revisionAfterCommit}`
        );
        console.log(
          `codex-proposal-review-e2e: ${viewport.name} screenshot ${result.screenshot.format} base64Length=${result.screenshot.base64Length}`
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
    console.log("codex-proposal-review-e2e: smoke passed");
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
