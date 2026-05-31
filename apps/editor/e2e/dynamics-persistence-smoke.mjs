import {
  createDynamicsGroupUpdateTestId,
  createPreviewParameterControlTestId,
  editorProjectStorageKey,
  editorTestIds
} from "./test-ids.mjs";

const dynamicsSmoke = {
  displayName: "E2E Hair Sway",
  groupId: "dyn_e2e_hair_sway",
  outputDisplayName: "E2E Hair Sway Output",
  outputParameterId: "param_dynamics_e2e_hair_sway_output_r0",
  driverParameterId: "param_preview_body_yaw",
  runFrameCount: 5,
  reloadRunFrameCount: 3
};

export const runDynamicsPersistenceSmoke = async ({ page, viewport }) => {
  await waitForTestId(page, editorTestIds.dynamicsPanel);
  await assertDynamicsPanelReachable(page, viewport);
  await assertDynamicsAccessibleBasics(page);
  await assertInitialDynamicsState(page);

  await setDynamicsCreateFormValues(page, dynamicsSmoke);
  await clickTestId(page, editorTestIds.dynamicsCreateSubmit);
  await assertDynamicsGroupCreated(page);

  await setPreviewSliderValue(page, dynamicsSmoke.driverParameterId, 1);
  await setDynamicsFrameCount(page, dynamicsSmoke.runFrameCount);
  await clickTestId(page, editorTestIds.dynamicsPreviewRun);
  await assertDynamicsPreviewRan(page, dynamicsSmoke.runFrameCount);
  const ranPreview = await readDynamicsPreviewState(page);

  await clickTestId(page, editorTestIds.dynamicsPreviewReset);
  await assertDynamicsPreviewReset(page);
  const resetPreview = await readDynamicsPreviewState(page);

  await clickTestId(page, editorTestIds.projectPersistenceSave);
  await waitForText(page, editorTestIds.projectPersistenceStatus, "Saved");
  await assertSavedDynamicsProject(page, "after dynamics save");

  await page.reload();
  await waitForTestId(page, editorTestIds.shell);
  await clickTestId(page, editorTestIds.projectPersistenceLoad);
  await waitForText(page, editorTestIds.projectPersistenceStatus, "Loaded");
  await assertDynamicsStateAfterLoad(page);

  await setPreviewSliderValue(page, dynamicsSmoke.driverParameterId, 1);
  await setDynamicsFrameCount(page, dynamicsSmoke.reloadRunFrameCount);
  await clickTestId(page, editorTestIds.dynamicsPreviewRun);
  await assertDynamicsPreviewRan(page, dynamicsSmoke.reloadRunFrameCount);

  await assertSavedDynamicsProject(page, "after dynamics reload");
  const reloadedPreview = await readDynamicsPreviewState(page);
  const screenshot = await page.captureScreenshot(`${viewport.name} wave23 dynamics smoke`);

  return {
    viewport: viewport.name,
    dynamicsGroupId: dynamicsSmoke.groupId,
    outputParameterId: dynamicsSmoke.outputParameterId,
    ranPreview,
    resetPreview,
    reloadedPreview,
    screenshot
  };
};

const assertInitialDynamicsState = async (page) => {
  await waitForText(page, editorTestIds.dynamicsPanel, "0 dynamics groups");
  await waitForText(page, editorTestIds.dynamicsCreateForm, "Create group");
  await waitForText(page, editorTestIds.dynamicsPanel, "No dynamics preview run");
  await waitForText(page, editorTestIds.dynamicsPreviewOutputs, "No computed output");
  await waitForText(page, editorTestIds.dynamicsPreviewEvidence, "No runtime evidence");
  await waitForText(page, editorTestIds.dynamicsValidatorDiagnostics, "No diagnostics");
  await assertDynamicsPreviewButtonState(page, {
    runDisabled: true,
    resetDisabled: true
  });
};

const assertDynamicsGroupCreated = async (page) => {
  await waitForText(page, editorTestIds.operationStatus, "createDynamicsGroup committed");
  await waitForOperationLogEntryCount(page, 2);
  await waitForText(page, editorTestIds.operationLogSummary, "createParameter, createDynamicsGroup");
  await waitForText(page, editorTestIds.parameterList, dynamicsSmoke.outputParameterId);
  await waitForText(page, editorTestIds.parameterList, dynamicsSmoke.outputDisplayName);
  await waitForTestId(page, createDynamicsGroupUpdateTestId(dynamicsSmoke.groupId));
  await waitForText(page, editorTestIds.dynamicsPanel, "1 dynamics group");
  await waitForText(page, editorTestIds.dynamicsPanel, dynamicsSmoke.displayName);
  await waitForText(page, editorTestIds.dynamicsPanel, dynamicsSmoke.groupId);
  await waitForText(page, editorTestIds.dynamicsPanel, dynamicsSmoke.outputParameterId);
  await waitForText(page, editorTestIds.generatedEvidenceSummary, "Runtime snapshots");
  await waitForText(page, editorTestIds.generatedEvidenceSummary, "Validation reports");
  await assertDynamicsPreviewButtonState(page, {
    runDisabled: false,
    resetDisabled: false
  });
};

const assertDynamicsPreviewRan = async (page, frameCount) => {
  await waitForText(page, editorTestIds.dynamicsPanel, `Ran ${frameCount} frames`);
  await waitForText(page, editorTestIds.dynamicsPreviewOutputs, dynamicsSmoke.groupId);
  await waitForText(page, editorTestIds.dynamicsPreviewOutputs, dynamicsSmoke.outputParameterId);
  await waitForText(page, editorTestIds.dynamicsPreviewOutputs, "position");
  await waitForText(page, editorTestIds.dynamicsPreviewOutputs, "resets");
  await waitForText(page, editorTestIds.dynamicsPreviewOutputs, `${dynamicsSmoke.driverParameterId} 1`);
  await waitForText(page, editorTestIds.dynamicsPreviewEvidence, "snap_editor_browser_sample_");
  await waitForText(page, editorTestIds.dynamicsPreviewEvidence, "val_editor_browser_sample_editorIncremental");
  await waitForText(page, editorTestIds.dynamicsPreviewEvidence, "checks");
  await waitForText(page, editorTestIds.dynamicsValidatorDiagnostics, "No diagnostics");
};

const assertDynamicsPreviewReset = async (page) => {
  await waitForText(page, editorTestIds.dynamicsPanel, "Reset 0 frames");
  await waitForText(page, editorTestIds.dynamicsPreviewOutputs, dynamicsSmoke.groupId);
  await waitForText(page, editorTestIds.dynamicsPreviewOutputs, dynamicsSmoke.outputParameterId);
  await waitForText(page, editorTestIds.dynamicsPreviewOutputs, "position");
  await waitForText(page, editorTestIds.dynamicsPreviewOutputs, "resets");
  await waitForText(page, editorTestIds.dynamicsPreviewEvidence, "snap_editor_browser_sample_");
  await waitForText(page, editorTestIds.dynamicsPreviewEvidence, "val_editor_browser_sample_editorIncremental");
  await waitForText(page, editorTestIds.dynamicsValidatorDiagnostics, "No diagnostics");
};

const assertDynamicsStateAfterLoad = async (page) => {
  await waitForText(page, editorTestIds.packageStatus, "pkg_editor_browser_sample");
  await waitForText(page, editorTestIds.projectPersistenceStatus, "Loaded");
  await waitForOperationLogEntryCount(page, 2);
  await waitForText(page, editorTestIds.operationLogSummary, "createParameter, createDynamicsGroup");
  await waitForText(page, editorTestIds.parameterList, dynamicsSmoke.outputParameterId);
  await waitForText(page, editorTestIds.parameterList, dynamicsSmoke.outputDisplayName);
  await waitForTestId(page, createDynamicsGroupUpdateTestId(dynamicsSmoke.groupId));
  await waitForText(page, editorTestIds.dynamicsPanel, dynamicsSmoke.displayName);
  await waitForText(page, editorTestIds.dynamicsPanel, dynamicsSmoke.groupId);
  await waitForText(page, editorTestIds.dynamicsPanel, "No dynamics preview run");
  await waitForText(page, editorTestIds.dynamicsPreviewOutputs, "No computed output");
  await waitForText(page, editorTestIds.dynamicsPreviewEvidence, "No runtime evidence");
  await assertDynamicsPreviewButtonState(page, {
    runDisabled: false,
    resetDisabled: false
  });
};

const assertSavedDynamicsProject = async (page, label) => {
  const saved = await page.evaluate((storageKey, expected) => {
    const raw = localStorage.getItem(storageKey);
    if (raw === null) {
      return null;
    }

    const project = JSON.parse(raw);
    const dynamics = readPackageJsonFile(project, "model/dynamics.json");
    const parameters = readPackageJsonFile(project, "model/parameters.json");
    const operationLogEntries = String(project.operationLogJsonl ?? "")
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line));
    const group = dynamics?.dynamicsGroups?.find(
      (candidate) => candidate.dynamicsGroupId === expected.groupId
    );
    const outputParameter = parameters?.parameters?.find(
      (candidate) => candidate.parameterId === expected.outputParameterId
    );

    return {
      schemaVersion: project.schemaVersion,
      packageId: project.packageSummary?.packageId ?? null,
      packageRevision: project.packageSummary?.packageRevision ?? null,
      operationTypes: operationLogEntries.map((entry) => entry.operationType),
      operationTargetIds: operationLogEntries.flatMap((entry) => entry.targetIds ?? []),
      group: group === undefined
        ? null
        : {
            dynamicsGroupId: group.dynamicsGroupId,
            displayName: group.displayName,
            enabled: group.enabled,
            solverKind: group.solverKind,
            resetPolicy: group.resetPolicy,
            driverParameterIds: group.drivers.map((driver) => driver.sourceParameterId),
            outputParameterId: group.output.targetParameterId,
            stiffness: group.settings.stiffness,
            damping: group.settings.damping,
            maxVelocity: group.settings.maxVelocity,
            maxAmplitude: group.settings.maxAmplitude
          },
      outputParameter: outputParameter === undefined
        ? null
        : {
            parameterId: outputParameter.parameterId,
            displayName: outputParameter.displayName,
            valueSource: outputParameter.valueSource,
            min: outputParameter.min,
            max: outputParameter.max,
            default: outputParameter.default
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
  }, editorProjectStorageKey, dynamicsSmoke);

  const expected = {
    schemaVersion: "editor-project-persistence-v1",
    packageId: "pkg_editor_browser_sample",
    packageRevision: 2,
    operationTypes: ["createParameter", "createDynamicsGroup"],
    operationTargetIds: [
      dynamicsSmoke.outputParameterId,
      dynamicsSmoke.groupId,
      dynamicsSmoke.driverParameterId,
      dynamicsSmoke.outputParameterId
    ],
    group: {
      dynamicsGroupId: dynamicsSmoke.groupId,
      displayName: dynamicsSmoke.displayName,
      enabled: true,
      solverKind: "scalarDampedFollowV1",
      resetPolicy: "reset-on-manual-command",
      driverParameterIds: [dynamicsSmoke.driverParameterId],
      outputParameterId: dynamicsSmoke.outputParameterId,
      stiffness: 0.25,
      damping: 0.35,
      maxVelocity: 2,
      maxAmplitude: 1
    },
    outputParameter: {
      parameterId: dynamicsSmoke.outputParameterId,
      displayName: dynamicsSmoke.outputDisplayName,
      valueSource: "computedDynamics",
      min: -1,
      max: 1,
      default: 0
    }
  };

  if (
    saved === null ||
    saved.schemaVersion !== expected.schemaVersion ||
    saved.packageId !== expected.packageId ||
    saved.packageRevision !== expected.packageRevision ||
    JSON.stringify(saved.operationTypes) !== JSON.stringify(expected.operationTypes) ||
    JSON.stringify(saved.operationTargetIds) !== JSON.stringify(expected.operationTargetIds) ||
    JSON.stringify(saved.group) !== JSON.stringify(expected.group) ||
    JSON.stringify(saved.outputParameter) !== JSON.stringify(expected.outputParameter) ||
    saved.generatedRuntimeArtifacts < 1 ||
    saved.generatedValidationArtifacts < 1
  ) {
    throw new Error(
      `Saved dynamics project mismatch during ${label}: expected ${JSON.stringify(
        expected
      )} with runtime/validation artifacts, received ${JSON.stringify(saved)}.`
    );
  }
};

const assertDynamicsPanelReachable = async (page, viewport) => {
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
    const panelVisibleBeforeScroll = rectVisible(panel.getBoundingClientRect());

    submit.scrollIntoView({ block: "center", inline: "nearest" });
    const panelRect = panel.getBoundingClientRect();
    const submitRect = submit.getBoundingClientRect();

    return {
      panelVisibleBeforeScroll,
      panelVisible: rectVisible(panelRect),
      submitVisible: rectVisible(submitRect),
      panelWidth: panelRect.width,
      submitWidth: submitRect.width
    };
  }, {
    panel: editorTestIds.dynamicsPanel,
    submit: editorTestIds.dynamicsCreateSubmit
  });

  if (
    metrics === null ||
    !metrics.panelVisible ||
    !metrics.submitVisible ||
    metrics.panelWidth < 1 ||
    metrics.submitWidth < 1
  ) {
    throw new Error(
      `${viewport.name} dynamics panel was not reachable/usable: ${JSON.stringify(metrics)}.`
    );
  }
};

const assertDynamicsAccessibleBasics = async (page) => {
  const names = await page.evaluate((ids) => {
    const panel = document.querySelector(`[data-testid="${ids.panel}"]`);
    const headingId = panel?.getAttribute("aria-labelledby");
    const createSubmit = document.querySelector(`[data-testid="${ids.createSubmit}"]`);
    const run = document.querySelector(`[data-testid="${ids.run}"]`);
    const reset = document.querySelector(`[data-testid="${ids.reset}"]`);

    return {
      panelName: headingId === null ? "" : document.getElementById(headingId)?.textContent ?? "",
      createSubmitName: createSubmit?.textContent?.trim() ?? "",
      runName: run?.textContent?.trim() ?? "",
      resetName: reset?.textContent?.trim() ?? ""
    };
  }, {
    panel: editorTestIds.dynamicsPanel,
    createSubmit: editorTestIds.dynamicsCreateSubmit,
    run: editorTestIds.dynamicsPreviewRun,
    reset: editorTestIds.dynamicsPreviewReset
  });

  const expected = {
    panelName: "Dynamics",
    createSubmitName: "Create group",
    runName: "Run preview",
    resetName: "Reset preview"
  };

  if (JSON.stringify(names) !== JSON.stringify(expected)) {
    throw new Error(
      `Dynamics accessible basics mismatch: expected ${JSON.stringify(expected)}, received ${JSON.stringify(names)}.`
    );
  }
};

const setDynamicsCreateFormValues = async (page, input) => {
  await page.evaluate((ids, values) => {
    const form = document.querySelector(`[data-testid="${ids.form}"]`);

    if (!(form instanceof HTMLFormElement)) {
      throw new Error("Dynamics create form was missing.");
    }

    setFieldValue(form, "displayName", values.displayName);
    setFieldValue(form, "driverParameterId", values.driverParameterId);
    setFieldValue(form, "outputParameterId", "__new__");
    setFieldValue(form, "outputParameterDisplayName", values.outputDisplayName);
    setFieldValue(form, "outputMin", "-1");
    setFieldValue(form, "outputMax", "1");
    setFieldValue(form, "stiffness", "0.25");
    setFieldValue(form, "damping", "0.35");
    setFieldValue(form, "maxVelocity", "2");
    setFieldValue(form, "maxAmplitude", "1");
    setFieldValue(form, "resetPolicy", "reset-on-manual-command");
    setFieldValue(form, "enabled", true);

    function setFieldValue(targetForm, name, value) {
      const control = targetForm.elements.namedItem(name);

      if (
        !(
          control instanceof HTMLInputElement ||
          control instanceof HTMLSelectElement
        )
      ) {
        throw new Error(`Missing dynamics create field ${name}.`);
      }

      if (control instanceof HTMLInputElement && control.type === "checkbox") {
        control.checked = value === true;
      } else {
        control.value = String(value);
      }
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }, {
    form: editorTestIds.dynamicsCreateForm
  }, input);
};

const setPreviewSliderValue = async (page, parameterId, value) => {
  await page.evaluate((testId, nextValue) => {
    const input = document.querySelector(`[data-testid="${testId}"]`);

    if (!(input instanceof HTMLInputElement)) {
      throw new Error(`Preview slider ${testId} was missing.`);
    }

    input.value = String(nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, createPreviewParameterControlTestId(parameterId), value);
};

const setDynamicsFrameCount = async (page, value) => {
  await page.evaluate((ids, nextValue) => {
    const panel = document.querySelector(`[data-testid="${ids.panel}"]`);
    const input = panel?.querySelector('input[name="frameCount"]');

    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Dynamics frame count input was missing.");
    }

    input.value = String(nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, {
    panel: editorTestIds.dynamicsPanel
  }, value);
};

const readDynamicsPreviewState = async (page) =>
  page.evaluate((ids) => ({
    panelText: document.querySelector(`[data-testid="${ids.panel}"]`)?.textContent ?? "",
    outputText: document.querySelector(`[data-testid="${ids.outputs}"]`)?.textContent ?? "",
    evidenceText: document.querySelector(`[data-testid="${ids.evidence}"]`)?.textContent ?? "",
    diagnosticsText: document.querySelector(`[data-testid="${ids.diagnostics}"]`)?.textContent ?? ""
  }), {
    panel: editorTestIds.dynamicsPanel,
    outputs: editorTestIds.dynamicsPreviewOutputs,
    evidence: editorTestIds.dynamicsPreviewEvidence,
    diagnostics: editorTestIds.dynamicsValidatorDiagnostics
  });

const assertDynamicsPreviewButtonState = async (page, { runDisabled, resetDisabled }) => {
  const state = await page.evaluate((ids) => {
    const run = document.querySelector(`[data-testid="${ids.run}"]`);
    const reset = document.querySelector(`[data-testid="${ids.reset}"]`);

    if (!(run instanceof HTMLButtonElement) || !(reset instanceof HTMLButtonElement)) {
      throw new Error("Dynamics preview buttons were missing.");
    }

    return {
      runDisabled: run.disabled,
      resetDisabled: reset.disabled
    };
  }, {
    run: editorTestIds.dynamicsPreviewRun,
    reset: editorTestIds.dynamicsPreviewReset
  });

  const expected = { runDisabled, resetDisabled };
  if (JSON.stringify(state) !== JSON.stringify(expected)) {
    throw new Error(
      `Dynamics preview button state mismatch: expected ${JSON.stringify(expected)}, received ${JSON.stringify(state)}.`
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
