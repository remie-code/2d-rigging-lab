import {
  createRigControlRowTestId,
  createViewerParameterControlTestId,
  editorProjectStorageKey,
  editorTestIds
} from "./test-ids.mjs";

const rigControlSmoke = {
  packageId: "pkg_editor_browser_sample",
  parentDisplayName: "E2E Parent Rotation",
  parentRigControlId: "rig_e2e_parent_rotation",
  childDisplayName: "E2E Child Rotation",
  childRigControlId: "rig_e2e_child_rotation",
  drawableId: "draw_body",
  parameterId: "param_preview_body_yaw",
  keyformSetId: "keyset_rigcontrol_rig_e2e_parent_rotation_angledegrees_preview_body_yaw_1",
  partId: "part_root",
  parentRestAngleDegrees: 30,
  childRestAngleDegrees: 15,
  keyValue: 1,
  angleDegrees: 45
};

export const runRigControlPersistenceSmoke = async ({ page, viewport }) => {
  await waitForTestId(page, editorTestIds.rigControlPanel);
  await assertRigControlPanelReachable(page, viewport);
  await assertRigControlAccessibleBasics(page);
  await assertInitialRigControlState(page);

  await setRigControlCreateFormValues(page, {
    displayName: rigControlSmoke.parentDisplayName,
    partId: rigControlSmoke.partId,
    pivotX: 48,
    pivotY: 48,
    restAngleDegrees: rigControlSmoke.parentRestAngleDegrees
  });
  await clickTestId(page, editorTestIds.rigControlCreateSubmit);
  await assertRigControlCreated(page, {
    expectedOperationLogEntryCount: 1,
    rigControlId: rigControlSmoke.parentRigControlId,
    displayName: rigControlSmoke.parentDisplayName,
    restAngleDegrees: rigControlSmoke.parentRestAngleDegrees
  });

  await setRigControlCreateFormValues(page, {
    displayName: rigControlSmoke.childDisplayName,
    partId: rigControlSmoke.partId,
    pivotX: 48,
    pivotY: 48,
    restAngleDegrees: rigControlSmoke.childRestAngleDegrees
  });
  await clickTestId(page, editorTestIds.rigControlCreateSubmit);
  await assertRigControlCreated(page, {
    expectedOperationLogEntryCount: 2,
    rigControlId: rigControlSmoke.childRigControlId,
    displayName: rigControlSmoke.childDisplayName,
    restAngleDegrees: rigControlSmoke.childRestAngleDegrees
  });

  await setRigControlBindFormValues(page, {
    parentRigControlId: rigControlSmoke.parentRigControlId,
    childTarget: `rigControl:${rigControlSmoke.childRigControlId}`
  });
  await clickTestId(page, editorTestIds.rigControlBindSubmit);
  await assertChildRigControlBound(page);

  await setRigControlBindFormValues(page, {
    parentRigControlId: rigControlSmoke.childRigControlId,
    childTarget: `drawable:${rigControlSmoke.drawableId}`
  });
  await clickTestId(page, editorTestIds.rigControlBindSubmit);
  await assertChildDrawableBound(page);

  await setRigControlKeyformFormValues(page, {
    parameterId: rigControlSmoke.parameterId,
    rigControlId: rigControlSmoke.parentRigControlId,
    keyValue: rigControlSmoke.keyValue,
    angleDegrees: rigControlSmoke.angleDegrees
  });
  await clickTestId(page, editorTestIds.rigControlKeyformSubmit);
  await assertRigControlAngleKeyformCreated(page);

  await clickTestId(page, editorTestIds.viewerRuntimeOpen);
  await setViewerSliderValue(page, rigControlSmoke.parameterId, rigControlSmoke.keyValue);
  await assertRigControlViewerEvidence(page);
  const preSaveViewer = await readRigControlEvidenceState(page);

  await clickTestId(page, editorTestIds.projectPersistenceSave);
  await waitForText(page, editorTestIds.projectPersistenceStatus, "Saved");
  await assertSavedRigControlProject(page, "after rig control save");

  await page.reload();
  await waitForTestId(page, editorTestIds.shell);
  await clickTestId(page, editorTestIds.projectPersistenceLoad);
  await waitForText(page, editorTestIds.projectPersistenceStatus, "Loaded");
  await assertRigControlStateAfterLoad(page);

  await clickTestId(page, editorTestIds.viewerRuntimeOpen);
  await setViewerSliderValue(page, rigControlSmoke.parameterId, rigControlSmoke.keyValue);
  await assertRigControlViewerEvidence(page);
  await assertSavedRigControlProject(page, "after rig control reload");
  const postLoadViewer = await readRigControlEvidenceState(page);
  const screenshot = await page.captureScreenshot(`${viewport.name} wave25 rig control smoke`);

  return {
    viewport: viewport.name,
    parentRigControlId: rigControlSmoke.parentRigControlId,
    childRigControlId: rigControlSmoke.childRigControlId,
    drawableId: rigControlSmoke.drawableId,
    preSaveViewer,
    postLoadViewer,
    screenshot
  };
};

const assertInitialRigControlState = async (page) => {
  await waitForText(page, editorTestIds.rigControlPanel, "0 rig controls");
  await waitForText(page, editorTestIds.rigControlList, "No project-defined rig controls");
  await waitForText(page, editorTestIds.rigControlKeyformForm, "No rotation2d rig control");
  await waitForText(page, editorTestIds.rigControlKeyformList, "No rig control angle keyforms");
  await waitForText(page, editorTestIds.rigControlEvidence, "No preview rig control affected targets");
  await waitForText(page, editorTestIds.rigControlEvidence, "Open Viewer / Runtime for viewer rig control evidence");
  await waitForText(page, editorTestIds.rigControlDiagnostics, "No rig control operation committed");
  await assertRigControlBindButtonState(page, { disabled: true });
  await assertRigControlKeyformButtonState(page, { disabled: true });
};

const assertRigControlCreated = async (
  page,
  { expectedOperationLogEntryCount, rigControlId, displayName, restAngleDegrees }
) => {
  await waitForText(page, editorTestIds.operationStatus, "createRotation2dRigControl committed");
  await waitForOperationLogEntryCount(page, expectedOperationLogEntryCount);
  await waitForText(page, editorTestIds.operationLogSummary, "createRotation2dRigControl");
  await waitForText(page, editorTestIds.generatedEvidenceSummary, "Runtime snapshots");
  await waitForText(page, editorTestIds.generatedEvidenceSummary, "Validation reports");
  await waitForText(page, createRigControlRowTestId(rigControlId), displayName);
  await waitForText(page, createRigControlRowTestId(rigControlId), rigControlId);
  await waitForText(page, createRigControlRowTestId(rigControlId), `rest ${restAngleDegrees} deg`);
  await waitForText(page, editorTestIds.rigControlEvidence, rigControlId);
  await waitForText(page, editorTestIds.rigControlEvidence, `rest ${restAngleDegrees}`);
  await waitForText(page, editorTestIds.rigControlDiagnostics, "createRotation2dRigControl committed");
  await waitForText(page, editorTestIds.rigControlDiagnostics, "No rig control diagnostics");
};

const assertChildRigControlBound = async (page) => {
  await waitForText(page, editorTestIds.operationStatus, "bindRigControlChild committed");
  await waitForOperationLogEntryCount(page, 3);
  await waitForText(page, editorTestIds.operationLogSummary, "bindRigControlChild");
  await waitForText(
    page,
    createRigControlRowTestId(rigControlSmoke.parentRigControlId),
    rigControlSmoke.childRigControlId
  );
  await waitForText(
    page,
    createRigControlRowTestId(rigControlSmoke.childRigControlId),
    rigControlSmoke.parentRigControlId
  );
  await waitForText(page, editorTestIds.rigControlEvidence, `child controls ${rigControlSmoke.childRigControlId}`);
  await waitForText(page, editorTestIds.rigControlDiagnostics, "bindRigControlChild committed");
  await waitForText(page, editorTestIds.rigControlDiagnostics, "No rig control diagnostics");
};

const assertChildDrawableBound = async (page) => {
  await waitForText(page, editorTestIds.operationStatus, "bindRigControlChild committed");
  await waitForOperationLogEntryCount(page, 4);
  await waitForText(page, editorTestIds.operationLogSummary, "createRotation2dRigControl, bindRigControlChild");
  await waitForText(
    page,
    createRigControlRowTestId(rigControlSmoke.childRigControlId),
    rigControlSmoke.drawableId
  );
  await waitForText(page, editorTestIds.rigControlEvidence, `drawable children ${rigControlSmoke.drawableId}`);
  await waitForText(page, editorTestIds.rigControlDiagnostics, "No rig control diagnostics");
};

const assertRigControlAngleKeyformCreated = async (page) => {
  await waitForText(page, editorTestIds.operationStatus, "addKeyform committed");
  await waitForOperationLogEntryCount(page, 5);
  await waitForText(page, editorTestIds.operationLogSummary, "addKeyform");
  await waitForText(page, editorTestIds.generatedEvidenceSummary, "Runtime snapshots");
  await waitForText(page, editorTestIds.generatedEvidenceSummary, "Validation reports");
  await waitForText(page, editorTestIds.rigControlKeyformList, "1 angle keyform");
  await waitForText(page, editorTestIds.rigControlKeyformList, rigControlSmoke.keyformSetId);
  await waitForText(page, editorTestIds.rigControlKeyformList, rigControlSmoke.parentRigControlId);
  await waitForText(page, editorTestIds.rigControlKeyformList, rigControlSmoke.parameterId);
  await waitForText(page, editorTestIds.rigControlKeyformList, `${rigControlSmoke.angleDegrees} deg`);
  await waitForText(
    page,
    editorTestIds.rigControlEvidence,
    `angle keyforms ${rigControlSmoke.parameterId}@${rigControlSmoke.keyValue} -> ${rigControlSmoke.angleDegrees} deg`
  );
  await waitForText(page, editorTestIds.rigControlDiagnostics, "addKeyform committed");
  await waitForText(page, editorTestIds.rigControlDiagnostics, "No rig control diagnostics");
};

const assertRigControlStateAfterLoad = async (page) => {
  await waitForText(page, editorTestIds.packageStatus, rigControlSmoke.packageId);
  await waitForText(page, editorTestIds.projectPersistenceStatus, "Loaded");
  await waitForOperationLogEntryCount(page, 5);
  await waitForText(page, editorTestIds.operationLogSummary, "createRotation2dRigControl, bindRigControlChild, addKeyform");
  await waitForText(page, editorTestIds.rigControlPanel, "2 rig controls");
  await waitForText(
    page,
    createRigControlRowTestId(rigControlSmoke.parentRigControlId),
    rigControlSmoke.childRigControlId
  );
  await waitForText(
    page,
    createRigControlRowTestId(rigControlSmoke.childRigControlId),
    rigControlSmoke.drawableId
  );
  await waitForText(page, editorTestIds.rigControlKeyformList, "1 angle keyform");
  await waitForText(page, editorTestIds.rigControlKeyformList, rigControlSmoke.keyformSetId);
  await waitForText(page, editorTestIds.rigControlKeyformList, `${rigControlSmoke.angleDegrees} deg`);
  await waitForText(page, editorTestIds.rigControlEvidence, `child controls ${rigControlSmoke.childRigControlId}`);
  await waitForText(page, editorTestIds.rigControlEvidence, `drawable children ${rigControlSmoke.drawableId}`);
  await waitForText(
    page,
    editorTestIds.rigControlEvidence,
    `angle keyforms ${rigControlSmoke.parameterId}@${rigControlSmoke.keyValue} -> ${rigControlSmoke.angleDegrees} deg`
  );
  await waitForText(page, editorTestIds.rigControlDiagnostics, "No rig control diagnostics");
};

const assertRigControlViewerEvidence = async (page) => {
  await waitForTestId(page, editorTestIds.viewerRuntimePanel);
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, "Rig controls");
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, "2 evaluated / 2 total");
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, "1 override");
  await waitForText(
    page,
    editorTestIds.viewerRuntimeSnapshotSummary,
    `${rigControlSmoke.parameterId}: ${rigControlSmoke.keyValue} / authoredInput / viewerOverride`
  );
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, rigControlSmoke.parentRigControlId);
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, rigControlSmoke.childRigControlId);
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, "Rig Control Evidence");
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, "order 0");
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, "order 1");
  await waitForText(
    page,
    editorTestIds.viewerRuntimeSnapshotSummary,
    `local ${rigControlSmoke.angleDegrees} / world ${rigControlSmoke.angleDegrees}`
  );
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, "local 15 / world 60");
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, `drawables ${rigControlSmoke.drawableId}`);
  await waitForText(page, editorTestIds.viewerRuntimeDiff, "Runtime Diff");
  await waitForText(page, editorTestIds.viewerRuntimeDiff, "Affected drawables");
  await waitForText(page, editorTestIds.viewerRuntimeDiff, rigControlSmoke.drawableId);
  await waitForText(page, editorTestIds.viewerRuntimeDiagnostics, "Validation Diagnostics");
  await waitForText(page, editorTestIds.viewerRuntimeDiagnostics, "No diagnostics");
  await waitForText(page, editorTestIds.rigControlEvidence, `${rigControlSmoke.parentRigControlId}: evaluated`);
  await waitForText(page, editorTestIds.rigControlEvidence, `${rigControlSmoke.childRigControlId}: evaluated`);
  await waitForText(
    page,
    editorTestIds.rigControlEvidence,
    `${rigControlSmoke.parentRigControlId}: evaluated / order 0; local ${rigControlSmoke.angleDegrees} / world ${rigControlSmoke.angleDegrees}`
  );
  await waitForText(page, editorTestIds.rigControlEvidence, `${rigControlSmoke.childRigControlId}: evaluated / order 1; local 15 / world 60`);
  await waitForText(page, editorTestIds.rigControlEvidence, `affected ${rigControlSmoke.drawableId}`);
};

const assertSavedRigControlProject = async (page, label) => {
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
    const parent = rigControls?.rigControls?.find(
      (candidate) => candidate.rigControlId === expected.parentRigControlId
    );
    const child = rigControls?.rigControls?.find(
      (candidate) => candidate.rigControlId === expected.childRigControlId
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
      parent: parent === undefined
        ? null
        : {
            rigControlId: parent.rigControlId,
            displayName: parent.displayName,
            kind: parent.kind,
            parentId: parent.parentId ?? null,
            childDrawableIds: parent.childDrawableIds,
            childRigControlIds: parent.childRigControlIds,
            restAngleDegrees: parent.restAngleDegrees
          },
      child: child === undefined
        ? null
        : {
            rigControlId: child.rigControlId,
            displayName: child.displayName,
            kind: child.kind,
            parentId: child.parentId ?? null,
            childDrawableIds: child.childDrawableIds,
            childRigControlIds: child.childRigControlIds,
            restAngleDegrees: child.restAngleDegrees
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
  }, editorProjectStorageKey, rigControlSmoke);

  const expected = {
    schemaVersion: "editor-project-persistence-v1",
    packageId: rigControlSmoke.packageId,
    packageRevision: 5,
    operationTypes: [
      "createRotation2dRigControl",
      "createRotation2dRigControl",
      "bindRigControlChild",
      "bindRigControlChild",
      "addKeyform"
    ],
    parent: {
      rigControlId: rigControlSmoke.parentRigControlId,
      displayName: rigControlSmoke.parentDisplayName,
      kind: "rotation2d",
      parentId: null,
      childDrawableIds: [],
      childRigControlIds: [rigControlSmoke.childRigControlId],
      restAngleDegrees: rigControlSmoke.parentRestAngleDegrees
    },
    child: {
      rigControlId: rigControlSmoke.childRigControlId,
      displayName: rigControlSmoke.childDisplayName,
      kind: "rotation2d",
      parentId: rigControlSmoke.parentRigControlId,
      childDrawableIds: [rigControlSmoke.drawableId],
      childRigControlIds: [],
      restAngleDegrees: rigControlSmoke.childRestAngleDegrees
    },
    keyformSet: {
      keyformSetId: rigControlSmoke.keyformSetId,
      target: {
        id: rigControlSmoke.parentRigControlId,
        kind: "rigControl",
        property: "angleDegrees"
      },
      parameterId: rigControlSmoke.parameterId,
      evaluator: "linear-1d-v1",
      interpolation: "linear-1d-v1",
      compositionMode: "replace",
      keys: [
        {
          statePatch: rigControlSmoke.angleDegrees,
          value: rigControlSmoke.keyValue
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
    !saved.operationTargetIds.includes(rigControlSmoke.parentRigControlId) ||
    !saved.operationTargetIds.includes(rigControlSmoke.childRigControlId) ||
    !saved.operationTargetIds.includes(rigControlSmoke.drawableId) ||
    !saved.operationTargetIds.includes(rigControlSmoke.parameterId) ||
    !saved.operationTargetIds.includes(rigControlSmoke.keyformSetId) ||
    JSON.stringify(saved.parent) !== JSON.stringify(expected.parent) ||
    JSON.stringify(saved.child) !== JSON.stringify(expected.child) ||
    JSON.stringify(saved.keyformSet) !== JSON.stringify(expected.keyformSet) ||
    saved.generatedRuntimeArtifacts < 1 ||
    saved.generatedValidationArtifacts < 1
  ) {
    throw new Error(
      `Saved rig control project mismatch during ${label}: expected ${JSON.stringify(
        expected
      )} with runtime/validation artifacts, received ${JSON.stringify(saved)}.`
    );
  }
};

const assertRigControlPanelReachable = async (page, viewport) => {
  const metrics = await page.evaluate((ids) => {
    const panel = document.querySelector(`[data-testid="${ids.panel}"]`);
    const submit = document.querySelector(`[data-testid="${ids.submit}"]`);

    if (!(panel instanceof HTMLElement) || !(submit instanceof HTMLButtonElement)) {
      return null;
    }

    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const rectVisible = (rect) =>
      rect.width > 0 &&
      rect.height > 0 &&
      rect.right > 0 &&
      rect.left < viewportWidth &&
      rect.bottom > 0 &&
      rect.top < viewportHeight;

    submit.scrollIntoView({ block: "center", inline: "nearest" });
    const panelRect = panel.getBoundingClientRect();
    const submitRect = submit.getBoundingClientRect();

    return {
      panelVisible: rectVisible(panelRect),
      submitVisible: rectVisible(submitRect),
      panelWidth: panelRect.width,
      submitWidth: submitRect.width
    };
  }, {
    panel: editorTestIds.rigControlPanel,
    submit: editorTestIds.rigControlCreateSubmit
  });

  if (
    metrics === null ||
    !metrics.panelVisible ||
    !metrics.submitVisible ||
    metrics.panelWidth < 1 ||
    metrics.submitWidth < 1
  ) {
    throw new Error(`${viewport.name} rig control panel was not reachable: ${JSON.stringify(metrics)}.`);
  }
};

const assertRigControlAccessibleBasics = async (page) => {
  const names = await page.evaluate((ids) => {
    const panel = document.querySelector(`[data-testid="${ids.panel}"]`);
    const headingId = panel?.getAttribute("aria-labelledby");
    const createForm = document.querySelector(`[data-testid="${ids.createForm}"]`);
    const bindForm = document.querySelector(`[data-testid="${ids.bindForm}"]`);
    const keyformForm = document.querySelector(`[data-testid="${ids.keyformForm}"]`);
    const createSubmit = document.querySelector(`[data-testid="${ids.createSubmit}"]`);
    const bindSubmit = document.querySelector(`[data-testid="${ids.bindSubmit}"]`);
    const keyformSubmit = document.querySelector(`[data-testid="${ids.keyformSubmit}"]`);

    return {
      panelName: headingId === null ? "" : document.getElementById(headingId)?.textContent ?? "",
      createFormName: createForm?.getAttribute("aria-label") ?? "",
      bindFormName: bindForm?.getAttribute("aria-label") ?? "",
      keyformFormName: keyformForm?.getAttribute("aria-label") ?? "",
      createSubmitName: createSubmit?.textContent?.trim() ?? "",
      bindSubmitName: bindSubmit?.textContent?.trim() ?? "",
      keyformSubmitName: keyformSubmit?.textContent?.trim() ?? "",
      createLabels: readFormLabels(createForm),
      bindLabels: readFormLabels(bindForm),
      keyformLabels: readFormLabels(keyformForm)
    };

    function readFormLabels(form) {
      if (!(form instanceof HTMLFormElement)) {
        return [];
      }

      return [...form.querySelectorAll("label")].map((label) => ({
        label: [...label.childNodes]
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .map((node) => node.textContent ?? "")
          .join("")
          .trim(),
        controlName: label.querySelector("input, select")?.getAttribute("name") ?? ""
      }));
    }
  }, {
    panel: editorTestIds.rigControlPanel,
    createForm: editorTestIds.rigControlCreateForm,
    bindForm: editorTestIds.rigControlBindForm,
    keyformForm: editorTestIds.rigControlKeyformForm,
    createSubmit: editorTestIds.rigControlCreateSubmit,
    bindSubmit: editorTestIds.rigControlBindSubmit,
    keyformSubmit: editorTestIds.rigControlKeyformSubmit
  });

  const expected = {
    panelName: "Project-defined Rig Controls",
    createFormName: "Create project-defined rotation2d rig control",
    bindFormName: "Bind drawable or child rig control to a project-defined rig control",
    keyformFormName: "Add rotation2d angle keyform",
    createSubmitName: "Create rotation control",
    bindSubmitName: "Bind child",
    keyformSubmitName: "Add angle keyform",
    createLabels: [
      { label: "Control name", controlName: "displayName" },
      { label: "Part", controlName: "partId" },
      { label: "Pivot X", controlName: "pivotX" },
      { label: "Pivot Y", controlName: "pivotY" },
      { label: "Rest angle", controlName: "restAngleDegrees" }
    ],
    bindLabels: [
      { label: "Parent control", controlName: "parentRigControlId" },
      { label: "Child target", controlName: "childTarget" }
    ],
    keyformLabels: [
      { label: "Input parameter", controlName: "parameterId" },
      { label: "Rotation control", controlName: "rigControlId" },
      { label: "Key value", controlName: "keyValue" },
      { label: "Angle patch", controlName: "angleDegrees" }
    ]
  };

  if (JSON.stringify(names) !== JSON.stringify(expected)) {
    throw new Error(
      `Rig control accessible basics mismatch: expected ${JSON.stringify(expected)}, received ${JSON.stringify(
        names
      )}.`
    );
  }
};

const setRigControlCreateFormValues = async (page, input) => {
  await page.evaluate((ids, values) => {
    const form = document.querySelector(`[data-testid="${ids.form}"]`);

    if (!(form instanceof HTMLFormElement)) {
      throw new Error("Rig control create form was missing.");
    }

    setFieldValue(form, "displayName", values.displayName);
    setFieldValue(form, "partId", values.partId);
    setFieldValue(form, "pivotX", values.pivotX);
    setFieldValue(form, "pivotY", values.pivotY);
    setFieldValue(form, "restAngleDegrees", values.restAngleDegrees);

    function setFieldValue(targetForm, name, value) {
      const control = targetForm.elements.namedItem(name);

      if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement)) {
        throw new Error(`Missing rig control field ${name}.`);
      }

      control.value = String(value);
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }, {
    form: editorTestIds.rigControlCreateForm
  }, input);
};

const setRigControlBindFormValues = async (page, input) => {
  await page.evaluate((ids, values) => {
    const form = document.querySelector(`[data-testid="${ids.form}"]`);

    if (!(form instanceof HTMLFormElement)) {
      throw new Error("Rig control bind form was missing.");
    }

    setFieldValue(form, "parentRigControlId", values.parentRigControlId);
    setFieldValue(form, "childTarget", values.childTarget);

    function setFieldValue(targetForm, name, value) {
      const control = targetForm.elements.namedItem(name);

      if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement)) {
        throw new Error(`Missing rig control field ${name}.`);
      }

      control.value = String(value);
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }, {
    form: editorTestIds.rigControlBindForm
  }, input);
};

const setRigControlKeyformFormValues = async (page, input) => {
  await page.evaluate((ids, values) => {
    const form = document.querySelector(`[data-testid="${ids.form}"]`);

    if (!(form instanceof HTMLFormElement)) {
      throw new Error("Rig control keyform form was missing.");
    }

    setFieldValue(form, "parameterId", values.parameterId);
    setFieldValue(form, "rigControlId", values.rigControlId);
    setFieldValue(form, "keyValue", values.keyValue);
    setFieldValue(form, "angleDegrees", values.angleDegrees);

    function setFieldValue(targetForm, name, value) {
      const control = targetForm.elements.namedItem(name);

      if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement)) {
        throw new Error(`Missing rig control keyform field ${name}.`);
      }

      control.value = String(value);
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }, {
    form: editorTestIds.rigControlKeyformForm
  }, input);
};

const readRigControlEvidenceState = async (page) => ({
  panelText: await readText(page, editorTestIds.rigControlPanel),
  viewerSnapshotText: await readText(page, editorTestIds.viewerRuntimeSnapshotSummary),
  viewerDiagnosticsText: await readText(page, editorTestIds.viewerRuntimeDiagnostics)
});

const assertRigControlBindButtonState = async (page, { disabled }) => {
  const state = await page.evaluate((id) => {
    const button = document.querySelector(`[data-testid="${id}"]`);
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error("Rig control bind button was missing.");
    }

    return { disabled: button.disabled };
  }, editorTestIds.rigControlBindSubmit);

  if (JSON.stringify(state) !== JSON.stringify({ disabled })) {
    throw new Error(`Rig control bind button state mismatch: ${JSON.stringify(state)}.`);
  }
};

const assertRigControlKeyformButtonState = async (page, { disabled }) => {
  const state = await page.evaluate((id) => {
    const button = document.querySelector(`[data-testid="${id}"]`);
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error("Rig control keyform button was missing.");
    }

    return { disabled: button.disabled };
  }, editorTestIds.rigControlKeyformSubmit);

  if (JSON.stringify(state) !== JSON.stringify({ disabled })) {
    throw new Error(`Rig control keyform button state mismatch: ${JSON.stringify(state)}.`);
  }
};

const setViewerSliderValue = async (page, parameterId, value) => {
  await page.evaluate((testId, nextValue) => {
    const input = document.querySelector(`[data-testid="${testId}"]`);

    if (!(input instanceof HTMLInputElement)) {
      throw new Error(`Viewer slider ${testId} was missing.`);
    }

    input.value = String(nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, createViewerParameterControlTestId(parameterId), value);
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
