import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createPreviewParameterControlTestId,
  createRigControlRowTestId,
  createViewerParameterControlTestId,
  editorProjectStorageKey,
  editorTestIds
} from "./test-ids.mjs";

const warpLatticeSmoke = {
  packageId: "pkg_editor_browser_sample",
  displayName: "E2E Body Warp",
  draftRigControlId: "rig_e2e_body_warp",
  rigControlId: "rig_e2e_body_warp",
  drawableId: "draw_body",
  parameterId: "param_preview_body_yaw",
  keyformSetId: "keyset_rigcontrol_rig_e2e_body_warp_controlpointoffsets_preview_body_yaw_1",
  partId: "part_root",
  keyValue: 1,
  compositionMode: "replace",
  domainBounds: {
    x: 24,
    y: 16,
    width: 60,
    height: 64
  },
  controlPointOffsets: [
    { x: 0, y: 0 },
    { x: 6, y: 0 },
    { x: 0, y: 4 },
    { x: 6, y: 4 }
  ]
};

export const runWarpLatticePersistenceSmoke = async ({ page, viewport }) => {
  await waitForTestId(page, editorTestIds.rigControlPanel);
  await assertWarpLatticePanelBasics(page, viewport);
  await assertInitialWarpLatticeState(page);

  await setWarpLatticeCreateFormValues(page, {
    draftRigControlId: warpLatticeSmoke.draftRigControlId,
    displayName: warpLatticeSmoke.displayName,
    partId: warpLatticeSmoke.partId,
    ...warpLatticeSmoke.domainBounds
  });
  await clickTestId(page, editorTestIds.rigControlWarpLatticeCreateDraftSubmit);
  await assertWarpLatticeCreated(page);

  await setWarpLatticeBindFormValues(page, {
    warpParentTarget: `package:${warpLatticeSmoke.rigControlId}`,
    childTarget: `drawable:${warpLatticeSmoke.drawableId}`
  });
  await clickTestId(page, editorTestIds.rigControlWarpLatticeBindDraftSubmit);
  await assertWarpLatticeDrawableBound(page);

  await setWarpLatticeKeyformFormValues(page, {
    parameterId: warpLatticeSmoke.parameterId,
    warpTarget: `package:${warpLatticeSmoke.rigControlId}`,
    keyValue: warpLatticeSmoke.keyValue,
    compositionMode: warpLatticeSmoke.compositionMode,
    controlPointOffsets: warpLatticeSmoke.controlPointOffsets
  });
  await clickTestId(page, editorTestIds.rigControlWarpLatticeKeyformDraftSubmit);
  await assertWarpLatticeKeyformCreated(page);

  await setPreviewSliderValue(page, warpLatticeSmoke.parameterId, warpLatticeSmoke.keyValue);
  await assertWarpLatticePreviewEvidence(page);
  const preSavePreview = await readWarpLatticeEvidenceState(page);

  await clickTestId(page, editorTestIds.viewerRuntimeOpen);
  await setViewerSliderValue(page, warpLatticeSmoke.parameterId, warpLatticeSmoke.keyValue);
  await assertWarpLatticeViewerEvidence(page);
  const preSaveViewer = await readWarpLatticeEvidenceState(page);

  await clickTestId(page, editorTestIds.projectPersistenceSave);
  await waitForText(page, editorTestIds.projectPersistenceStatus, "Saved");
  await assertSavedWarpLatticeProject(page, "after warp lattice save");

  await page.reload();
  await waitForTestId(page, editorTestIds.shell);
  await clickTestId(page, editorTestIds.projectPersistenceLoad);
  await waitForText(page, editorTestIds.projectPersistenceStatus, "Loaded");
  await assertWarpLatticeStateAfterLoad(page);

  await setPreviewSliderValue(page, warpLatticeSmoke.parameterId, warpLatticeSmoke.keyValue);
  await assertWarpLatticePreviewEvidence(page);
  await clickTestId(page, editorTestIds.viewerRuntimeOpen);
  await setViewerSliderValue(page, warpLatticeSmoke.parameterId, warpLatticeSmoke.keyValue);
  await assertWarpLatticeViewerEvidence(page);
  await assertSavedWarpLatticeProject(page, "after warp lattice reload");
  const postLoadEvidence = await readWarpLatticeEvidenceState(page);
  const screenshot = await page.captureScreenshot(`${viewport.name} wave32 warp lattice smoke`);

  return {
    viewport: viewport.name,
    rigControlId: warpLatticeSmoke.rigControlId,
    drawableId: warpLatticeSmoke.drawableId,
    keyformSetId: warpLatticeSmoke.keyformSetId,
    preSavePreview,
    preSaveViewer,
    postLoadEvidence,
    screenshot
  };
};

const assertInitialWarpLatticeState = async (page) => {
  await waitForText(page, editorTestIds.rigControlPanel, "0 rig controls");
  await waitForText(page, editorTestIds.rigControlList, "No project-defined rig controls");
  await waitForText(page, editorTestIds.rigControlWarpLatticeKeyformList, "No controlPointOffsets draft keyforms");
  await waitForText(page, editorTestIds.rigControlEvidence, "No preview rig control affected targets");
  await waitForText(page, editorTestIds.rigControlEvidence, "Open Viewer / Runtime for viewer rig control evidence");
  await assertWarpButtonState(page, editorTestIds.rigControlWarpLatticeCreateDraftSubmit, { disabled: false });
  await assertWarpButtonState(page, editorTestIds.rigControlWarpLatticeBindDraftSubmit, { disabled: false });
  await assertWarpButtonState(page, editorTestIds.rigControlWarpLatticeKeyformDraftSubmit, { disabled: false });
};

const assertWarpLatticeCreated = async (page) => {
  await waitForText(page, editorTestIds.operationStatus, "createWarpLattice2dRigControl committed");
  await waitForOperationLogEntryCount(page, 1);
  await waitForText(page, editorTestIds.operationLogSummary, "createWarpLattice2dRigControl");
  await waitForText(page, createRigControlRowTestId(warpLatticeSmoke.rigControlId), warpLatticeSmoke.displayName);
  await waitForText(page, createRigControlRowTestId(warpLatticeSmoke.rigControlId), "warpLattice2d");
  await waitForText(page, createRigControlRowTestId(warpLatticeSmoke.rigControlId), "2 x 2 lattice");
  await waitForText(page, createRigControlRowTestId(warpLatticeSmoke.rigControlId), "bilinear-grid-v1");
  await waitForText(page, editorTestIds.rigControlEvidence, warpLatticeSmoke.rigControlId);
  await waitForText(page, editorTestIds.rigControlEvidence, "controlPointOffsets draft keyforms None");
  await waitForText(page, editorTestIds.rigControlDiagnostics, "No rig control diagnostics");
};

const assertWarpLatticeDrawableBound = async (page) => {
  await waitForText(page, editorTestIds.operationStatus, "bindRigControlChild committed");
  await waitForOperationLogEntryCount(page, 2);
  await waitForText(page, editorTestIds.operationLogSummary, "createWarpLattice2dRigControl, bindRigControlChild");
  await waitForText(
    page,
    createRigControlRowTestId(warpLatticeSmoke.rigControlId),
    warpLatticeSmoke.drawableId
  );
  await waitForText(page, editorTestIds.rigControlEvidence, `drawable children ${warpLatticeSmoke.drawableId}`);
  await waitForText(page, editorTestIds.rigControlDiagnostics, "bindRigControlChild committed");
  await waitForText(page, editorTestIds.rigControlDiagnostics, "No rig control diagnostics");
};

const assertWarpLatticeKeyformCreated = async (page) => {
  await waitForText(page, editorTestIds.operationStatus, "addKeyform committed");
  await waitForOperationLogEntryCount(page, 3);
  await waitForText(page, editorTestIds.operationLogSummary, "createWarpLattice2dRigControl, bindRigControlChild, addKeyform");
  await waitForText(page, editorTestIds.generatedEvidenceSummary, "Runtime snapshots");
  await waitForText(page, editorTestIds.generatedEvidenceSummary, "Validation reports");
  await waitForText(page, editorTestIds.rigControlWarpLatticeKeyformList, "1 controlPointOffsets keyform");
  await waitForText(page, editorTestIds.rigControlWarpLatticeKeyformList, warpLatticeSmoke.keyformSetId);
  await waitForText(page, editorTestIds.rigControlWarpLatticeKeyformList, warpLatticeSmoke.rigControlId);
  await waitForText(page, editorTestIds.rigControlWarpLatticeKeyformList, warpLatticeSmoke.parameterId);
  await waitForText(
    page,
    editorTestIds.rigControlWarpLatticeKeyformList,
    "p0 0, 0; p1 6, 0; p2 0, 4; p3 6, 4"
  );
  await waitForText(
    page,
    editorTestIds.rigControlEvidence,
    "controlPointOffsets draft keyforms param_preview_body_yaw@1 replace p0 0, 0; p1 6, 0; p2 0, 4; p3 6, 4"
  );
  await waitForText(page, editorTestIds.rigControlDiagnostics, "addKeyform committed");
  await waitForText(page, editorTestIds.rigControlDiagnostics, "No rig control diagnostics");
};

const assertWarpLatticePreviewEvidence = async (page) => {
  await waitForText(page, editorTestIds.previewSummary, "changes / 1 drawable");
  await waitForText(page, editorTestIds.rigControlEvidence, "Preview");
  await waitForText(page, editorTestIds.rigControlEvidence, `${warpLatticeSmoke.rigControlId}: warpLattice2d / preview`);
  await waitForText(page, editorTestIds.rigControlEvidence, `drawable children ${warpLatticeSmoke.drawableId}`);
  await waitForText(page, editorTestIds.rigControlEvidence, "controlPointOffsets draft keyforms");
};

const assertWarpLatticeViewerEvidence = async (page) => {
  await waitForTestId(page, editorTestIds.viewerRuntimePanel);
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, "Rig controls");
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, "1 evaluated / 1 total");
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, "1 override");
  await waitForText(
    page,
    editorTestIds.viewerRuntimeSnapshotSummary,
    `${warpLatticeSmoke.parameterId}: ${warpLatticeSmoke.keyValue} / authoredInput / viewerOverride`
  );
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, `${warpLatticeSmoke.rigControlId}: warpLattice2d / evaluated / order 0`);
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, `drawables ${warpLatticeSmoke.drawableId}`);
  await waitForText(page, editorTestIds.viewerRuntimeDiff, "Runtime Diff");
  await waitForText(page, editorTestIds.viewerRuntimeDiff, "Affected drawables");
  await waitForText(page, editorTestIds.viewerRuntimeDiff, warpLatticeSmoke.drawableId);
  await waitForText(page, editorTestIds.viewerRuntimeDiagnostics, "Validation Diagnostics");
  await waitForText(page, editorTestIds.viewerRuntimeDiagnostics, "No diagnostics");
  await waitForText(page, editorTestIds.rigControlEvidence, `${warpLatticeSmoke.rigControlId}: evaluated / order 0; local n/a / world n/a; affected ${warpLatticeSmoke.drawableId}`);
};

const assertWarpLatticeStateAfterLoad = async (page) => {
  await waitForText(page, editorTestIds.packageStatus, warpLatticeSmoke.packageId);
  await waitForText(page, editorTestIds.projectPersistenceStatus, "Loaded");
  await waitForOperationLogEntryCount(page, 3);
  await waitForText(page, editorTestIds.operationLogSummary, "createWarpLattice2dRigControl, bindRigControlChild, addKeyform");
  await waitForText(page, editorTestIds.rigControlPanel, "1 rig control");
  await waitForText(page, createRigControlRowTestId(warpLatticeSmoke.rigControlId), warpLatticeSmoke.displayName);
  await waitForText(page, createRigControlRowTestId(warpLatticeSmoke.rigControlId), warpLatticeSmoke.drawableId);
  await waitForText(page, editorTestIds.rigControlWarpLatticeKeyformList, "1 controlPointOffsets keyform");
  await waitForText(page, editorTestIds.rigControlWarpLatticeKeyformList, warpLatticeSmoke.keyformSetId);
  await waitForText(page, editorTestIds.rigControlEvidence, `drawable children ${warpLatticeSmoke.drawableId}`);
  await waitForText(page, editorTestIds.rigControlDiagnostics, "No rig control diagnostics");
};

const assertSavedWarpLatticeProject = async (page, label) => {
  const saved = await page.evaluate((storageKey, expected) => {
    const raw = localStorage.getItem(storageKey);
    if (raw === null) {
      return null;
    }

    const project = JSON.parse(raw);
    const rigControls = readPackageJsonFile(project, "model/rig-controls.json");
    const keyforms = readPackageJsonFile(project, "model/keyforms.json");
    const operationLogEntries = String(project.operationLogJsonl ?? "")
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line));
    const rigControl = rigControls?.rigControls?.find(
      (candidate) => candidate.rigControlId === expected.rigControlId
    );
    const keyformSet = keyforms?.keyformSets?.find(
      (candidate) => candidate.keyformSetId === expected.keyformSetId
    );

    return {
      schemaVersion: project.schemaVersion,
      packageId: project.packageSummary?.packageId ?? null,
      packageRevision: project.packageSummary?.packageRevision ?? null,
      operationTypes: operationLogEntries.map((entry) => entry.operationType),
      operationTargetIds: operationLogEntries.flatMap((entry) => entry.targetIds ?? []),
      rigControl: rigControl === undefined
        ? null
        : {
            rigControlId: rigControl.rigControlId,
            displayName: rigControl.displayName,
            kind: rigControl.kind,
            parentId: rigControl.parentId ?? null,
            childDrawableIds: rigControl.childDrawableIds,
            childRigControlIds: rigControl.childRigControlIds,
            domainBounds: {
              x: rigControl.domainBounds.x,
              y: rigControl.domainBounds.y,
              width: rigControl.domainBounds.width,
              height: rigControl.domainBounds.height
            },
            latticeColumns: rigControl.latticeColumns,
            latticeRows: rigControl.latticeRows,
            restControlPoints: rigControl.restControlPoints,
            interpolationMethod: rigControl.interpolationMethod
          },
      keyformSet: keyformSet === undefined
        ? null
        : {
            keyformSetId: keyformSet.keyformSetId,
            target: keyformSet.target,
            parameterId: keyformSet.parameterId,
            evaluator: keyformSet.evaluator,
            interpolation: keyformSet.interpolation,
            compositionMode: keyformSet.compositionMode,
            keys: keyformSet.keys
          },
      generatedRuntimeArtifacts: (project.generatedArtifactPaths ?? []).filter((path) =>
        path.startsWith("runtime/")
      ).length,
      generatedValidationArtifacts: (project.generatedArtifactPaths ?? []).filter((path) =>
        path.startsWith("validation/reports/")
      ).length
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
  }, editorProjectStorageKey, warpLatticeSmoke);

  const expected = {
    schemaVersion: "editor-project-persistence-v1",
    packageId: warpLatticeSmoke.packageId,
    packageRevision: 3,
    operationTypes: [
      "createWarpLattice2dRigControl",
      "bindRigControlChild",
      "addKeyform"
    ],
    rigControl: {
      rigControlId: warpLatticeSmoke.rigControlId,
      displayName: warpLatticeSmoke.displayName,
      kind: "warpLattice2d",
      parentId: null,
      childDrawableIds: [warpLatticeSmoke.drawableId],
      childRigControlIds: [],
      domainBounds: warpLatticeSmoke.domainBounds,
      latticeColumns: 2,
      latticeRows: 2,
      restControlPoints: [
        { x: 24, y: 16 },
        { x: 84, y: 16 },
        { x: 24, y: 80 },
        { x: 84, y: 80 }
      ],
      interpolationMethod: "bilinear-grid-v1"
    },
    keyformSet: {
      keyformSetId: warpLatticeSmoke.keyformSetId,
      target: {
        id: warpLatticeSmoke.rigControlId,
        kind: "rigControl",
        property: "controlPointOffsets"
      },
      parameterId: warpLatticeSmoke.parameterId,
      evaluator: "linear-1d-v1",
      interpolation: "linear-1d-v1",
      compositionMode: warpLatticeSmoke.compositionMode,
      keys: [
        {
          statePatch: warpLatticeSmoke.controlPointOffsets,
          value: warpLatticeSmoke.keyValue
        }
      ]
    }
  };

  if (
    saved === null ||
    saved.schemaVersion !== expected.schemaVersion ||
    saved.packageId !== expected.packageId ||
    saved.packageRevision !== expected.packageRevision ||
    JSON.stringify(saved.operationTypes) !== JSON.stringify(expected.operationTypes) ||
    !saved.operationTargetIds.includes(warpLatticeSmoke.rigControlId) ||
    !saved.operationTargetIds.includes(warpLatticeSmoke.drawableId) ||
    !saved.operationTargetIds.includes(warpLatticeSmoke.parameterId) ||
    !saved.operationTargetIds.includes(warpLatticeSmoke.keyformSetId) ||
    JSON.stringify(saved.rigControl) !== JSON.stringify(expected.rigControl) ||
    JSON.stringify(saved.keyformSet) !== JSON.stringify(expected.keyformSet) ||
    saved.generatedRuntimeArtifacts < 1 ||
    saved.generatedValidationArtifacts < 1
  ) {
    throw new Error(
      `Saved warp lattice project mismatch during ${label}: expected ${JSON.stringify(
        expected
      )} with runtime/validation artifacts, received ${JSON.stringify(saved)}.`
    );
  }
};

const assertWarpLatticePanelBasics = async (page, viewport) => {
  const basics = await page.evaluate((ids) => {
    const panel = document.querySelector(`[data-testid="${ids.panel}"]`);
    const createForm = document.querySelector(`[data-testid="${ids.createForm}"]`);
    const bindForm = document.querySelector(`[data-testid="${ids.bindForm}"]`);
    const keyformForm = document.querySelector(`[data-testid="${ids.keyformForm}"]`);
    const createSubmit = document.querySelector(`[data-testid="${ids.createSubmit}"]`);

    if (!(panel instanceof HTMLElement) || !(createSubmit instanceof HTMLButtonElement)) {
      return null;
    }

    createSubmit.scrollIntoView({ block: "center", inline: "nearest" });
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const submitRect = createSubmit.getBoundingClientRect();

    return {
      createFormName: createForm?.getAttribute("aria-label") ?? "",
      bindFormName: bindForm?.getAttribute("aria-label") ?? "",
      keyformFormName: keyformForm?.getAttribute("aria-label") ?? "",
      createSubmitName: createSubmit.textContent?.trim() ?? "",
      createSubmitVisible:
        submitRect.width > 0 &&
        submitRect.height > 0 &&
        submitRect.right > 0 &&
        submitRect.left < viewportWidth &&
        submitRect.bottom > 0 &&
        submitRect.top < viewportHeight
    };
  }, {
    panel: editorTestIds.rigControlPanel,
    createForm: editorTestIds.rigControlWarpLatticeCreateDraftForm,
    bindForm: editorTestIds.rigControlWarpLatticeBindDraftForm,
    keyformForm: editorTestIds.rigControlWarpLatticeKeyformDraftForm,
    createSubmit: editorTestIds.rigControlWarpLatticeCreateDraftSubmit
  });

  const expected = {
    createFormName: "Draft minimum 2x2 warpLattice2d rig control",
    bindFormName: "Draft child binding for minimum warpLattice2d",
    keyformFormName: "Draft warpLattice2d controlPointOffsets keyform",
    createSubmitName: "Stage warp draft",
    createSubmitVisible: true
  };

  if (JSON.stringify(basics) !== JSON.stringify(expected)) {
    throw new Error(
      `${viewport.name} warp lattice panel basics mismatch: expected ${JSON.stringify(
        expected
      )}, received ${JSON.stringify(basics)}.`
    );
  }
};

const setWarpLatticeCreateFormValues = async (page, input) => {
  await setFormValues(page, editorTestIds.rigControlWarpLatticeCreateDraftForm, {
    draftRigControlId: input.draftRigControlId,
    displayName: input.displayName,
    partId: input.partId,
    domainX: input.x,
    domainY: input.y,
    domainWidth: input.width,
    domainHeight: input.height
  });
};

const setWarpLatticeBindFormValues = async (page, input) => {
  await setFormValues(page, editorTestIds.rigControlWarpLatticeBindDraftForm, input);
};

const setWarpLatticeKeyformFormValues = async (page, input) => {
  await setFormValues(page, editorTestIds.rigControlWarpLatticeKeyformDraftForm, {
    parameterId: input.parameterId,
    warpTarget: input.warpTarget,
    keyValue: input.keyValue,
    compositionMode: input.compositionMode,
    offsetX0: input.controlPointOffsets[0].x,
    offsetY0: input.controlPointOffsets[0].y,
    offsetX1: input.controlPointOffsets[1].x,
    offsetY1: input.controlPointOffsets[1].y,
    offsetX2: input.controlPointOffsets[2].x,
    offsetY2: input.controlPointOffsets[2].y,
    offsetX3: input.controlPointOffsets[3].x,
    offsetY3: input.controlPointOffsets[3].y
  });
};

const setFormValues = async (page, formTestId, values) => {
  await page.evaluate((id, nextValues) => {
    const form = document.querySelector(`[data-testid="${id}"]`);

    if (!(form instanceof HTMLFormElement)) {
      throw new Error(`Missing form for test id ${id}.`);
    }

    for (const [name, value] of Object.entries(nextValues)) {
      const control = form.elements.namedItem(name);
      if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement)) {
        throw new Error(`Missing form field ${name} in ${id}.`);
      }

      control.value = String(value);
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }, formTestId, values);
};

const setPreviewSliderValue = async (page, parameterId, value) => {
  await setSliderValue(page, createPreviewParameterControlTestId(parameterId), value);
};

const setViewerSliderValue = async (page, parameterId, value) => {
  await setSliderValue(page, createViewerParameterControlTestId(parameterId), value);
};

const setSliderValue = async (page, testId, value) => {
  await page.evaluate((id, nextValue) => {
    const input = document.querySelector(`[data-testid="${id}"]`);

    if (!(input instanceof HTMLInputElement)) {
      throw new Error(`Slider ${id} was missing.`);
    }

    input.value = String(nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, testId, value);
};

const readWarpLatticeEvidenceState = async (page) => ({
  previewSummaryText: await readText(page, editorTestIds.previewSummary),
  panelText: await readText(page, editorTestIds.rigControlPanel),
  viewerSnapshotText: await readText(page, editorTestIds.viewerRuntimeSnapshotSummary),
  viewerDiagnosticsText: await readText(page, editorTestIds.viewerRuntimeDiagnostics)
});

const assertWarpButtonState = async (page, testId, { disabled }) => {
  const state = await page.evaluate((id) => {
    const button = document.querySelector(`[data-testid="${id}"]`);
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error(`Missing warp lattice button ${id}.`);
    }

    return { disabled: button.disabled };
  }, testId);

  if (JSON.stringify(state) !== JSON.stringify({ disabled })) {
    throw new Error(`Warp lattice button ${testId} state mismatch: ${JSON.stringify(state)}.`);
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

const readText = async (page, testId) =>
  page.evaluate((id) => document.querySelector(`[data-testid="${id}"]`)?.textContent ?? "", testId);

const standaloneViewports = [
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

const runStandalone = async () => {
  const [{ locateBrowserExecutable }, { launchHeadlessBrowser }, { createPageSession }, { startOrReuseEditorServer }] =
    await Promise.all([
      import("./browser-discovery.mjs"),
      import("./chrome-launcher.mjs"),
      import("./page-session.mjs"),
      import("./vite-server.mjs")
    ]);
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  const browser = locateBrowserExecutable();
  const server = await startOrReuseEditorServer({ repoRoot });
  let launchedBrowser;

  try {
    launchedBrowser = await launchHeadlessBrowser({ executable: browser.executable });

    for (const viewport of standaloneViewports) {
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
        const result = await runWarpLatticePersistenceSmoke({ page, viewport });
        console.log(
          `warp-lattice-e2e: ${viewport.name} smoke passed screenshot ${result.screenshot.format} base64Length=${result.screenshot.base64Length}`
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

if (process.argv[1] !== undefined && import.meta.url === pathToFileUrl(process.argv[1])) {
  try {
    await runStandalone();
    console.log("warp-lattice-e2e: smoke passed");
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}

function pathToFileUrl(filePath) {
  return new URL(`file://${path.resolve(filePath).replace(/\\/g, "/")}`).href;
}
