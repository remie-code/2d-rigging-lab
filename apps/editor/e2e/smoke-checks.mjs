import { createPageSession } from "./page-session.mjs";
import {
  createAiTranscriptEventRowTestId,
  editorProjectStorageKey,
  editorTestIds
} from "./test-ids.mjs";

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

  try {
    await waitForTestId(page, editorTestIds.shell);
    await page.evaluate((storageKey) => localStorage.removeItem(storageKey), editorProjectStorageKey);
    await page.reload();
    await waitForTestId(page, editorTestIds.shell);

    await assertShellRendered(page);
    await assertInitialAiApprovalRendered(page);
    await assertHorizontalOverflow(page, `${viewport.name} initial`);
    await runAiApprovalFlow(page);
    await assertHorizontalOverflow(page, `${viewport.name} post-AI`);
    await saveProject(page);
    await reloadProjectFromStorage(page);
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

const assertInitialAiApprovalRendered = async (page) => {
  await waitForTestId(page, editorTestIds.aiApprovalPanel);
  await waitForTestId(page, editorTestIds.aiApprovalStatus);
  await waitForTestId(page, editorTestIds.aiApprovalResultSummary);
  await waitForTestId(page, editorTestIds.aiApprovalLatestTranscriptEntry);
  await waitForTestId(page, editorTestIds.aiTranscriptPanel);
  await waitForTestId(page, editorTestIds.aiTranscriptEmpty);
  await waitForText(page, editorTestIds.aiApprovalStatus, "Idle");
  await waitForText(page, editorTestIds.aiApprovalStatus, "No AI dry-run pending");
  await waitForText(page, editorTestIds.aiTranscriptEmpty, "No AI command transcript entries yet.");
  await assertApprovalActionState(page, {
    dryRunDisabled: false,
    approveDisabled: true,
    rejectDisabled: true,
    commitDisabled: true
  });
};

const runAiApprovalFlow = async (page) => {
  await clickTestId(page, editorTestIds.aiApprovalDryRun);
  await waitForText(page, editorTestIds.aiApprovalStatus, "Pending approval");
  await waitForText(page, editorTestIds.aiApprovalStatus, "op_editor_ai_create_parameter_r0_1");
  await waitForText(
    page,
    editorTestIds.aiApprovalResultSummary,
    "createParameter dry_run"
  );
  await waitForText(
    page,
    editorTestIds.aiApprovalResultSummary,
    "cmd_editor_ai_dry_run_create_parameter_r0_1"
  );
  await waitForText(
    page,
    editorTestIds.aiApprovalResultSummary,
    "op_editor_ai_create_parameter_r0_1"
  );
  await waitForText(
    page,
    createAiTranscriptEventRowTestId(0),
    "cmd_editor_ai_dry_run_create_parameter_r0_1"
  );
  await waitForText(page, createAiTranscriptEventRowTestId(0), "dryRunOperation");
  await waitForText(page, createAiTranscriptEventRowTestId(0), "dry_run");
  await assertApprovalActionState(page, {
    dryRunDisabled: true,
    approveDisabled: false,
    rejectDisabled: false,
    commitDisabled: true
  });

  await clickTestId(page, editorTestIds.aiApprovalApprove);
  await waitForText(page, editorTestIds.aiApprovalStatus, "Approved");
  await waitForText(page, createAiTranscriptEventRowTestId(1), "Approval");
  await waitForText(page, createAiTranscriptEventRowTestId(1), "approved");
  await waitForText(page, createAiTranscriptEventRowTestId(1), "op_editor_ai_create_parameter_r0_1");
  await assertApprovalActionState(page, {
    dryRunDisabled: true,
    approveDisabled: true,
    rejectDisabled: false,
    commitDisabled: false
  });

  await clickTestId(page, editorTestIds.aiApprovalCommit);
  await waitForText(page, editorTestIds.aiApprovalStatus, "Idle");
  await waitForText(page, editorTestIds.aiApprovalStatus, "No AI dry-run pending");
  await waitForText(page, editorTestIds.operationStatus, "createParameter committed");
  await waitForText(page, editorTestIds.parameterList, "AI Approval Smile");
  await waitForText(page, editorTestIds.reloadSummary, "Reloaded");
  await waitForOperationLogEntryCount(page, 1);
  await waitForText(page, editorTestIds.operationLogSummary, "createParameter");
  await waitForText(
    page,
    createAiTranscriptEventRowTestId(2),
    "cmd_editor_ai_commit_create_parameter_r0_1"
  );
  await waitForText(page, createAiTranscriptEventRowTestId(2), "commitOperation");
  await waitForText(page, createAiTranscriptEventRowTestId(2), "ok");
  await waitForText(page, createAiTranscriptEventRowTestId(2), "op_editor_ai_create_parameter_r0_1");
  await waitForText(page, editorTestIds.aiApprovalLatestTranscriptEntry, "commitOperation ok");
  await assertApprovalActionState(page, {
    dryRunDisabled: false,
    approveDisabled: true,
    rejectDisabled: true,
    commitDisabled: true
  });
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
      packageFileCount: Array.isArray(project.packageFileSet) ? project.packageFileSet.length : 0,
      aiCommandTranscriptSchemaVersion: project.aiCommandTranscript?.schemaVersion,
      aiCommandTranscriptEntryCount: Array.isArray(project.aiCommandTranscript?.entries)
        ? project.aiCommandTranscript.entries.length
        : 0,
      aiCommandTranscriptEntryIds: Array.isArray(project.aiCommandTranscript?.entries)
        ? project.aiCommandTranscript.entries.map((entry) =>
            entry.entryType === "approval" ? entry.dryRunCommandId : entry.commandId
          )
        : [],
      aiCommandTranscriptOperationIds: Array.isArray(project.aiCommandTranscript?.entries)
        ? project.aiCommandTranscript.entries.map((entry) => entry.operationId ?? null)
        : []
    };
  }, editorProjectStorageKey);

  if (
    saved === null ||
    saved.schemaVersion !== "editor-project-persistence-v1" ||
    saved.operationLogLineCount < 1 ||
    saved.packageFileCount < 1 ||
    saved.aiCommandTranscriptSchemaVersion !== "ai-command-transcript-v1" ||
    saved.aiCommandTranscriptEntryCount < 3 ||
    !saved.aiCommandTranscriptEntryIds.includes("cmd_editor_ai_dry_run_create_parameter_r0_1") ||
    !saved.aiCommandTranscriptEntryIds.includes("cmd_editor_ai_commit_create_parameter_r0_1") ||
    !saved.aiCommandTranscriptOperationIds.includes("op_editor_ai_create_parameter_r0_1")
  ) {
    throw new Error("Save to browser storage did not persist a valid editor project.");
  }
};

const reloadProjectFromStorage = async (page) => {
  await page.reload();
  await waitForTestId(page, editorTestIds.shell);
  await assertTextIncludes(page, editorTestIds.parameterList, "No parameters yet.");
  await assertInitialAiApprovalRendered(page);
  await clickTestId(page, editorTestIds.projectPersistenceLoad);
  await waitForText(page, editorTestIds.projectPersistenceStatus, "Loaded");
  await waitForText(page, editorTestIds.parameterList, "AI Approval Smile");
  await waitForOperationLogEntryCount(page, 1);
  await waitForText(page, editorTestIds.operationLogSummary, "createParameter");
  await waitForText(page, editorTestIds.aiApprovalStatus, "Idle");
  await waitForText(page, editorTestIds.aiApprovalStatus, "No AI dry-run pending");
  await waitForText(
    page,
    createAiTranscriptEventRowTestId(0),
    "cmd_editor_ai_dry_run_create_parameter_r0_1"
  );
  await waitForText(page, createAiTranscriptEventRowTestId(1), "approved");
  await waitForText(
    page,
    createAiTranscriptEventRowTestId(2),
    "cmd_editor_ai_commit_create_parameter_r0_1"
  );
  await assertApprovalActionState(page, {
    dryRunDisabled: false,
    approveDisabled: true,
    rejectDisabled: true,
    commitDisabled: true
  });
};

const resetProject = async (page) => {
  await clickTestId(page, editorTestIds.projectPersistenceReset);
  await waitForText(page, editorTestIds.projectPersistenceStatus, "Cleared");
  await waitForText(page, editorTestIds.packageStatus, "pkg_editor_browser_sample");
  await waitForText(page, editorTestIds.parameterList, "No parameters yet.");
  await waitForText(page, editorTestIds.aiApprovalStatus, "Idle");
  await waitForTestId(page, editorTestIds.aiTranscriptEmpty);
  await assertElementAbsent(page, editorTestIds.aiTranscriptEvents);

  const storedValue = await page.evaluate((storageKey) => localStorage.getItem(storageKey), editorProjectStorageKey);
  if (storedValue !== null) {
    throw new Error("Reset sample did not clear browser project storage.");
  }
};

const assertApprovalActionState = async (
  page,
  { dryRunDisabled, approveDisabled, rejectDisabled, commitDisabled }
) => {
  const actionState = await page.evaluate((ids) => {
    const readDisabled = (id) => {
      const element = document.querySelector(`[data-testid="${id}"]`);

      if (!(element instanceof HTMLButtonElement)) {
        throw new Error(`Missing action button for test id ${id}.`);
      }

      return element.disabled;
    };

    return {
      dryRunDisabled: readDisabled(ids.dryRun),
      approveDisabled: readDisabled(ids.approve),
      rejectDisabled: readDisabled(ids.reject),
      commitDisabled: readDisabled(ids.commit)
    };
  }, {
    dryRun: editorTestIds.aiApprovalDryRun,
    approve: editorTestIds.aiApprovalApprove,
    reject: editorTestIds.aiApprovalReject,
    commit: editorTestIds.aiApprovalCommit
  });

  const expected = { dryRunDisabled, approveDisabled, rejectDisabled, commitDisabled };
  if (JSON.stringify(actionState) !== JSON.stringify(expected)) {
    throw new Error(
      `AI approval action state mismatch: expected ${JSON.stringify(expected)}, received ${JSON.stringify(
        actionState
      )}.`
    );
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

const assertElementAbsent = async (page, testId) => {
  const isPresent = await page.evaluate(
    (id) => document.querySelector(`[data-testid="${id}"]`) !== null,
    testId
  );

  if (isPresent) {
    throw new Error(`Expected ${testId} to be absent.`);
  }
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
