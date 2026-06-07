import {
  createDrawableRowTestId,
  createPreviewParameterControlTestId,
  createViewerParameterControlTestId,
  editorProjectStorageKey,
  editorTestIds
} from "./test-ids.mjs";
import {
  selectorScopes,
  waitForScopedText
} from "./selector-scopes.mjs";

const compositionSmoke = {
  packageId: "pkg_editor_browser_sample",
  maskDrawableId: "draw_body",
  targetDisplayName: "W27 T",
  targetDrawableId: "draw_w27_t",
  targetMeshId: "mesh_w27_t",
  maskRelationId: "maskrel_w27_t",
  parameterId: "param_preview_body_yaw",
  keyValue: 1,
  opacity: 0.4,
  keyformSetId:
    "keyset_drawable_draw_w27_t_opacity_preview_body_yaw_1",
  bounds: {
    x: 88,
    y: 28,
    width: 30,
    height: 32
  }
};

export const runCompositionPersistenceSmoke = async ({ page, viewport }) => {
  await waitForTestId(page, editorTestIds.compositionPanel);
  await assertCompositionInitialState(page);
  await createCompositionTargetDrawable(page);
  await assertCompositionPanelReachable(page, viewport);
  await assertCompositionAccessibleBasics(page);

  await setMaskRelationFormValues(page, {
    maskRelationId: compositionSmoke.maskRelationId,
    maskDrawableIds: [compositionSmoke.maskDrawableId],
    targetDrawableIds: [compositionSmoke.targetDrawableId],
    enabled: true
  });
  await clickTestId(page, editorTestIds.compositionMaskRelationSubmit);
  await assertMaskRelationCommitted(page);

  await setOpacityKeyformFormValues(page, {
    parameterId: compositionSmoke.parameterId,
    drawableId: compositionSmoke.targetDrawableId,
    keyValue: compositionSmoke.keyValue,
    opacity: compositionSmoke.opacity
  });
  await clickTestId(page, editorTestIds.compositionOpacityKeyformSubmit);
  await assertOpacityKeyformCommitted(page);

  await setPreviewSliderValue(page, compositionSmoke.parameterId, compositionSmoke.keyValue);
  await assertPreviewCompositionEvidence(page);

  await clickTestId(page, editorTestIds.viewerRuntimeOpen);
  await setViewerSliderValue(page, compositionSmoke.parameterId, compositionSmoke.keyValue);
  await assertViewerCompositionEvidence(page);
  const preSaveViewer = await readCompositionEvidenceState(page);

  await clickTestId(page, editorTestIds.projectPersistenceSave);
  await waitForText(page, editorTestIds.projectPersistenceStatus, "Saved");
  await assertSavedCompositionProject(page, "after composition save");

  await page.reload();
  await waitForTestId(page, editorTestIds.shell);
  await clickTestId(page, editorTestIds.projectPersistenceLoad);
  await waitForText(page, editorTestIds.projectPersistenceStatus, "Loaded");
  await assertCompositionStateAfterLoad(page);

  await setPreviewSliderValue(page, compositionSmoke.parameterId, compositionSmoke.keyValue);
  await assertPreviewCompositionEvidence(page);
  await clickTestId(page, editorTestIds.viewerRuntimeOpen);
  await setViewerSliderValue(page, compositionSmoke.parameterId, compositionSmoke.keyValue);
  await assertViewerCompositionEvidence(page);
  await assertSavedCompositionProject(page, "after composition reload");
  const postLoadViewer = await readCompositionEvidenceState(page);
  const screenshot = await page.captureScreenshot(`${viewport.name} wave27 composition smoke`);

  return {
    viewport: viewport.name,
    maskRelationId: compositionSmoke.maskRelationId,
    targetDrawableId: compositionSmoke.targetDrawableId,
    keyformSetId: compositionSmoke.keyformSetId,
    preSaveViewer,
    postLoadViewer,
    screenshot
  };
};

const assertCompositionInitialState = async (page) => {
  await waitForText(page, editorTestIds.compositionPanel, "0 mask relations");
  await waitForText(page, editorTestIds.compositionMaskRelationList, "No mask relations");
  await waitForText(page, editorTestIds.compositionOpacityKeyformList, "0 opacity keyforms");
  await waitForText(
    page,
    editorTestIds.compositionOpacityKeyformList,
    "No drawable opacity keyforms"
  );
  await waitForText(page, editorTestIds.compositionEvidence, "0 authored mask relations");
  await waitForText(page, editorTestIds.compositionEvidence, "draw_body: opacity 1 / visible");
  await waitForText(
    page,
    editorTestIds.compositionEvidence,
    "Open Viewer / Runtime for viewer composition evidence"
  );
  await waitForText(
    page,
    editorTestIds.compositionDiagnostics,
    "No composition operation committed"
  );
  await waitForText(page, editorTestIds.compositionDiagnostics, "No composition diagnostics");
  await assertMaskRelationButtonState(page, { disabled: true });
  await assertOpacityKeyformButtonState(page, { disabled: false });
};

const createCompositionTargetDrawable = async (page) => {
  await waitForTestId(page, editorTestIds.drawableCreateForm);
  await setCreateDrawableFormValues(page, compositionSmoke);
  await clickTestId(page, editorTestIds.drawableCreateSubmit);
  await waitForText(page, editorTestIds.drawableResult, "Drawable preset committed");
  await waitForText(page, editorTestIds.operationStatus, "generateMesh committed");
  await waitForOperationLogEntryCount(page, 2);
  await waitForText(page, editorTestIds.operationLogSummary, "createDrawable, generateMesh");
  await waitForScopedText(
    page,
    selectorScopes.legacyDrawableAuthoring,
    editorTestIds.drawableList,
    compositionSmoke.targetDisplayName
  );
  await waitForScopedText(
    page,
    selectorScopes.legacyDrawableAuthoring,
    createDrawableRowTestId(compositionSmoke.targetDrawableId),
    compositionSmoke.targetMeshId
  );
  await waitForText(page, editorTestIds.previewSummary, "2 visible / 2 total");
  await waitForText(page, editorTestIds.compositionPanel, "0 mask relations");
  await assertMaskRelationButtonState(page, { disabled: false });
};

const assertMaskRelationCommitted = async (page) => {
  await waitForText(page, editorTestIds.operationStatus, "setMaskRelation committed");
  await waitForOperationLogEntryCount(page, 3);
  await waitForText(page, editorTestIds.operationLogSummary, "setMaskRelation");
  await waitForText(page, editorTestIds.generatedEvidenceSummary, "Runtime snapshots");
  await waitForText(page, editorTestIds.generatedEvidenceSummary, "Validation reports");
  await waitForText(page, editorTestIds.compositionPanel, "1 mask relation");
  await waitForText(
    page,
    editorTestIds.compositionMaskRelationList,
    compositionSmoke.maskRelationId
  );
  await waitForText(page, editorTestIds.compositionMaskRelationList, "Enabled");
  await waitForText(page, editorTestIds.compositionMaskRelationList, compositionSmoke.maskDrawableId);
  await waitForText(page, editorTestIds.compositionMaskRelationList, compositionSmoke.targetDrawableId);
  await waitForText(page, editorTestIds.compositionDiagnostics, "setMaskRelation committed");
  await waitForText(page, editorTestIds.compositionDiagnostics, "No composition diagnostics");
  await waitForText(
    page,
    editorTestIds.compositionEvidence,
    `${compositionSmoke.maskRelationId}: semanticClipping / enabled; masks ${compositionSmoke.maskDrawableId}; targets ${compositionSmoke.targetDrawableId}`
  );
};

const assertOpacityKeyformCommitted = async (page) => {
  await waitForText(page, editorTestIds.operationStatus, "addKeyform committed");
  await waitForOperationLogEntryCount(page, 4);
  await waitForText(page, editorTestIds.operationLogSummary, "addKeyform");
  await waitForText(page, editorTestIds.generatedEvidenceSummary, "Runtime snapshots");
  await waitForText(page, editorTestIds.generatedEvidenceSummary, "Validation reports");
  await waitForText(page, editorTestIds.compositionOpacityKeyformList, "1 opacity keyform");
  await waitForText(
    page,
    editorTestIds.compositionOpacityKeyformList,
    compositionSmoke.keyformSetId
  );
  await waitForText(
    page,
    editorTestIds.compositionOpacityKeyformList,
    compositionSmoke.targetDrawableId
  );
  await waitForText(page, editorTestIds.compositionOpacityKeyformList, compositionSmoke.parameterId);
  await waitForText(page, editorTestIds.compositionOpacityKeyformList, "0.4");
  await waitForText(page, editorTestIds.compositionDiagnostics, "addKeyform committed");
  await waitForText(page, editorTestIds.compositionDiagnostics, "No composition diagnostics");
};

const assertPreviewCompositionEvidence = async (page) => {
  await waitForText(
    page,
    editorTestIds.compositionEvidence,
    `${compositionSmoke.maskRelationId}: semanticClipping / enabled; masks ${compositionSmoke.maskDrawableId}; targets ${compositionSmoke.targetDrawableId}`
  );
  await waitForText(
    page,
    editorTestIds.compositionEvidence,
    `${compositionSmoke.targetDrawableId}: opacity ${compositionSmoke.opacity} / visible`
  );
};

const assertViewerCompositionEvidence = async (page) => {
  await waitForTestId(page, editorTestIds.viewerRuntimePanel);
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, "Masks");
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, "1 semantic");
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, "Mask Relation Evidence");
  await waitForText(
    page,
    editorTestIds.viewerRuntimeSnapshotSummary,
    `${compositionSmoke.maskRelationId}: semanticClipping / Resolved; masks ${compositionSmoke.maskDrawableId}; targets ${compositionSmoke.targetDrawableId}`
  );
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, "Drawable Opacity Evidence");
  await waitForText(
    page,
    editorTestIds.viewerRuntimeSnapshotSummary,
    `${compositionSmoke.targetDrawableId}: opacity ${compositionSmoke.opacity} / visible`
  );
  await waitForText(
    page,
    editorTestIds.compositionEvidence,
    `${compositionSmoke.maskRelationId}: semanticClipping / Resolved; masks ${compositionSmoke.maskDrawableId}; targets ${compositionSmoke.targetDrawableId}`
  );
  await waitForText(
    page,
    editorTestIds.compositionEvidence,
    `${compositionSmoke.targetDrawableId}: opacity ${compositionSmoke.opacity} / visible`
  );
  await waitForText(page, editorTestIds.viewerRuntimeDiff, "Runtime Diff");
  await waitForText(page, editorTestIds.viewerRuntimeDiff, "Affected drawables");
  await waitForText(page, editorTestIds.viewerRuntimeDiagnostics, "Validation Diagnostics");
  await waitForText(page, editorTestIds.viewerRuntimeDiagnostics, "No diagnostics");
};

const assertCompositionStateAfterLoad = async (page) => {
  await waitForText(page, editorTestIds.packageStatus, compositionSmoke.packageId);
  await waitForText(page, editorTestIds.projectPersistenceStatus, "Loaded");
  await waitForOperationLogEntryCount(page, 4);
  await waitForText(
    page,
    editorTestIds.operationLogSummary,
    "createDrawable, generateMesh, setMaskRelation, addKeyform"
  );
  await waitForScopedText(
    page,
    selectorScopes.legacyDrawableAuthoring,
    editorTestIds.drawableList,
    compositionSmoke.targetDisplayName
  );
  await waitForScopedText(
    page,
    selectorScopes.legacyDrawableAuthoring,
    createDrawableRowTestId(compositionSmoke.targetDrawableId),
    compositionSmoke.targetMeshId
  );
  await waitForText(
    page,
    editorTestIds.compositionMaskRelationList,
    compositionSmoke.maskRelationId
  );
  await waitForText(page, editorTestIds.compositionMaskRelationList, "Enabled");
  await waitForText(page, editorTestIds.compositionMaskRelationList, compositionSmoke.targetDrawableId);
  await waitForText(
    page,
    editorTestIds.compositionOpacityKeyformList,
    compositionSmoke.keyformSetId
  );
  await waitForText(page, editorTestIds.compositionOpacityKeyformList, "0.4");
  await waitForText(page, editorTestIds.compositionDiagnostics, "No composition diagnostics");
};

const assertSavedCompositionProject = async (page, label) => {
  const saved = await page.evaluate((storageKey, expected) => {
    const raw = localStorage.getItem(storageKey);
    if (raw === null) {
      return null;
    }

    const project = JSON.parse(raw);
    const drawables = readPackageJsonFile(project, "model/drawables.json");
    const masks = readPackageJsonFile(project, "model/masks.json");
    const keyforms = readPackageJsonFile(project, "model/keyforms.json");
    const operationLogEntries = String(project.operationLogJsonl ?? "")
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line));
    const drawable = drawables?.drawables?.find(
      (candidate) => candidate.drawableId === expected.targetDrawableId
    );
    const relation = masks?.masks?.find(
      (candidate) => candidate.maskRelationId === expected.maskRelationId
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
      drawable: drawable === undefined
        ? null
        : {
            drawableId: drawable.drawableId,
            displayName: drawable.displayName,
            meshId: drawable.meshId
          },
      relation: relation === undefined
        ? null
        : {
            maskRelationId: relation.maskRelationId,
            maskDrawableIds: relation.maskDrawableIds,
            targetDrawableIds: relation.targetDrawableIds,
            enabled: relation.enabled
          },
      keyformSet: keyformSet === undefined
        ? null
        : {
            keyformSetId: keyformSet.keyformSetId,
            target: {
              kind: keyformSet.target.kind,
              id: keyformSet.target.id,
              property: keyformSet.target.property
            },
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
  }, editorProjectStorageKey, compositionSmoke);

  const expected = {
    schemaVersion: "editor-project-persistence-v1",
    packageId: compositionSmoke.packageId,
    packageRevision: 4,
    operationTypes: ["createDrawable", "generateMesh", "setMaskRelation", "addKeyform"],
    drawable: {
      drawableId: compositionSmoke.targetDrawableId,
      displayName: compositionSmoke.targetDisplayName,
      meshId: compositionSmoke.targetMeshId
    },
    relation: {
      maskRelationId: compositionSmoke.maskRelationId,
      maskDrawableIds: [compositionSmoke.maskDrawableId],
      targetDrawableIds: [compositionSmoke.targetDrawableId],
      enabled: true
    },
    keyformSet: {
      keyformSetId: compositionSmoke.keyformSetId,
      target: {
        kind: "drawable",
        id: compositionSmoke.targetDrawableId,
        property: "opacity"
      },
      parameterId: compositionSmoke.parameterId,
      evaluator: "linear-1d-v1",
      interpolation: "linear-1d-v1",
      compositionMode: "replace",
      keys: [
        {
          statePatch: compositionSmoke.opacity,
          value: compositionSmoke.keyValue
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
    !saved.operationTargetIds.includes(compositionSmoke.maskRelationId) ||
    !saved.operationTargetIds.includes(compositionSmoke.maskDrawableId) ||
    !saved.operationTargetIds.includes(compositionSmoke.targetDrawableId) ||
    !saved.operationTargetIds.includes(compositionSmoke.parameterId) ||
    !saved.operationTargetIds.includes(compositionSmoke.keyformSetId) ||
    JSON.stringify(saved.drawable) !== JSON.stringify(expected.drawable) ||
    JSON.stringify(saved.relation) !== JSON.stringify(expected.relation) ||
    JSON.stringify(saved.keyformSet) !== JSON.stringify(expected.keyformSet) ||
    saved.generatedRuntimeArtifacts < 1 ||
    saved.generatedValidationArtifacts < 1
  ) {
    throw new Error(
      `Saved composition project mismatch during ${label}: expected ${JSON.stringify(
        expected
      )} with runtime/validation artifacts, received ${JSON.stringify(saved)}.`
    );
  }
};

const assertCompositionPanelReachable = async (page, viewport) => {
  const metrics = await page.evaluate((ids) => {
    const panel = document.querySelector(`[data-testid="${ids.panel}"]`);
    const maskSubmit = document.querySelector(`[data-testid="${ids.maskSubmit}"]`);
    const opacitySubmit = document.querySelector(`[data-testid="${ids.opacitySubmit}"]`);

    if (
      !(panel instanceof HTMLElement) ||
      !(maskSubmit instanceof HTMLButtonElement) ||
      !(opacitySubmit instanceof HTMLButtonElement)
    ) {
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

    maskSubmit.scrollIntoView({ block: "center", inline: "nearest" });
    const maskRect = maskSubmit.getBoundingClientRect();
    opacitySubmit.scrollIntoView({ block: "center", inline: "nearest" });
    const panelRect = panel.getBoundingClientRect();
    const opacityRect = opacitySubmit.getBoundingClientRect();

    return {
      panelVisible: rectVisible(panelRect),
      maskSubmitVisible: rectVisible(maskRect),
      opacitySubmitVisible: rectVisible(opacityRect),
      panelWidth: panelRect.width,
      maskSubmitWidth: maskRect.width,
      opacitySubmitWidth: opacityRect.width
    };
  }, {
    panel: editorTestIds.compositionPanel,
    maskSubmit: editorTestIds.compositionMaskRelationSubmit,
    opacitySubmit: editorTestIds.compositionOpacityKeyformSubmit
  });

  if (
    metrics === null ||
    !metrics.panelVisible ||
    !metrics.maskSubmitVisible ||
    !metrics.opacitySubmitVisible ||
    metrics.panelWidth < 1 ||
    metrics.maskSubmitWidth < 1 ||
    metrics.opacitySubmitWidth < 1
  ) {
    throw new Error(`${viewport.name} composition panel was not reachable: ${JSON.stringify(metrics)}.`);
  }
};

const assertCompositionAccessibleBasics = async (page) => {
  const names = await page.evaluate((ids) => {
    const panel = document.querySelector(`[data-testid="${ids.panel}"]`);
    const headingId = panel?.getAttribute("aria-labelledby");
    const maskForm = document.querySelector(`[data-testid="${ids.maskForm}"]`);
    const opacityForm = document.querySelector(`[data-testid="${ids.opacityForm}"]`);
    const maskSubmit = document.querySelector(`[data-testid="${ids.maskSubmit}"]`);
    const opacitySubmit = document.querySelector(`[data-testid="${ids.opacitySubmit}"]`);

    return {
      panelName: headingId === null ? "" : document.getElementById(headingId)?.textContent ?? "",
      maskFormName: maskForm?.getAttribute("aria-label") ?? "",
      opacityFormName: opacityForm?.getAttribute("aria-label") ?? "",
      maskSubmitName: maskSubmit?.textContent?.trim() ?? "",
      opacitySubmitName: opacitySubmit?.textContent?.trim() ?? "",
      maskLabels: readFormLabels(maskForm),
      opacityLabels: readFormLabels(opacityForm)
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
    panel: editorTestIds.compositionPanel,
    maskForm: editorTestIds.compositionMaskRelationForm,
    opacityForm: editorTestIds.compositionOpacityKeyformForm,
    maskSubmit: editorTestIds.compositionMaskRelationSubmit,
    opacitySubmit: editorTestIds.compositionOpacityKeyformSubmit
  });

  const expected = {
    panelName: "Composition / Mask / Opacity",
    maskFormName: "Commit semantic mask relation",
    opacityFormName: "Add drawable opacity keyform",
    maskSubmitName: "Commit mask relation",
    opacitySubmitName: "Add opacity keyform",
    maskLabels: [
      { label: "Relation ID", controlName: "maskRelationId" },
      { label: "Mask drawables", controlName: "maskDrawableIds" },
      { label: "Target drawables", controlName: "targetDrawableIds" },
      { label: "", controlName: "enabled" }
    ],
    opacityLabels: [
      { label: "Input parameter", controlName: "parameterId" },
      { label: "Drawable", controlName: "drawableId" },
      { label: "Key value", controlName: "keyValue" },
      { label: "Opacity", controlName: "opacity" }
    ]
  };

  if (JSON.stringify(names) !== JSON.stringify(expected)) {
    throw new Error(
      `Composition accessible basics mismatch: expected ${JSON.stringify(expected)}, received ${JSON.stringify(
        names
      )}.`
    );
  }
};

const setCreateDrawableFormValues = async (page, input) => {
  await page.evaluate((ids, values) => {
    const form = document.querySelector(`[data-testid="${ids.form}"]`);

    if (!(form instanceof HTMLFormElement)) {
      throw new Error("Drawable create form was missing.");
    }

    setFieldValue(form, "displayName", values.targetDisplayName);
    setFieldValue(form, "meshMethod", "auto-grid-v1");
    setFieldValue(form, "x", values.bounds.x);
    setFieldValue(form, "y", values.bounds.y);
    setFieldValue(form, "width", values.bounds.width);
    setFieldValue(form, "height", values.bounds.height);

    function setFieldValue(targetForm, name, value) {
      const control = targetForm.elements.namedItem(name);

      if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement)) {
        throw new Error(`Missing drawable create field ${name}.`);
      }

      control.value = String(value);
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }, {
    form: editorTestIds.drawableCreateForm
  }, input);
};

const setMaskRelationFormValues = async (page, input) => {
  await page.evaluate((ids, values) => {
    const form = document.querySelector(`[data-testid="${ids.form}"]`);

    if (!(form instanceof HTMLFormElement)) {
      throw new Error("Composition mask relation form was missing.");
    }

    setFieldValue(form, "maskRelationId", values.maskRelationId);
    setMultiSelectValue(form, "maskDrawableIds", values.maskDrawableIds);
    setMultiSelectValue(form, "targetDrawableIds", values.targetDrawableIds);
    setFieldValue(form, "enabled", values.enabled);

    function setFieldValue(targetForm, name, value) {
      const control = targetForm.elements.namedItem(name);

      if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement)) {
        throw new Error(`Missing composition mask relation field ${name}.`);
      }

      if (control instanceof HTMLInputElement && control.type === "checkbox") {
        control.checked = value === true;
      } else {
        control.value = String(value);
      }
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.dispatchEvent(new Event("change", { bubbles: true }));
    }

    function setMultiSelectValue(targetForm, name, valuesToSelect) {
      const control = targetForm.elements.namedItem(name);

      if (!(control instanceof HTMLSelectElement)) {
        throw new Error(`Missing composition mask relation select ${name}.`);
      }

      const selected = new Set(valuesToSelect);
      for (const option of control.options) {
        option.selected = selected.has(option.value);
      }
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }, {
    form: editorTestIds.compositionMaskRelationForm
  }, input);
};

const setOpacityKeyformFormValues = async (page, input) => {
  await page.evaluate((ids, values) => {
    const form = document.querySelector(`[data-testid="${ids.form}"]`);

    if (!(form instanceof HTMLFormElement)) {
      throw new Error("Composition opacity keyform form was missing.");
    }

    setFieldValue(form, "parameterId", values.parameterId);
    setFieldValue(form, "drawableId", values.drawableId);
    setFieldValue(form, "keyValue", values.keyValue);
    setFieldValue(form, "opacity", values.opacity);

    function setFieldValue(targetForm, name, value) {
      const control = targetForm.elements.namedItem(name);

      if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement)) {
        throw new Error(`Missing composition opacity keyform field ${name}.`);
      }

      control.value = String(value);
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }, {
    form: editorTestIds.compositionOpacityKeyformForm
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

const assertMaskRelationButtonState = async (page, { disabled }) => {
  const state = await page.evaluate((id) => {
    const button = document.querySelector(`[data-testid="${id}"]`);
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error("Composition mask relation button was missing.");
    }

    return { disabled: button.disabled };
  }, editorTestIds.compositionMaskRelationSubmit);

  if (JSON.stringify(state) !== JSON.stringify({ disabled })) {
    throw new Error(`Composition mask relation button state mismatch: ${JSON.stringify(state)}.`);
  }
};

const assertOpacityKeyformButtonState = async (page, { disabled }) => {
  const state = await page.evaluate((id) => {
    const button = document.querySelector(`[data-testid="${id}"]`);
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error("Composition opacity keyform button was missing.");
    }

    return { disabled: button.disabled };
  }, editorTestIds.compositionOpacityKeyformSubmit);

  if (JSON.stringify(state) !== JSON.stringify({ disabled })) {
    throw new Error(`Composition opacity keyform button state mismatch: ${JSON.stringify(state)}.`);
  }
};

const readCompositionEvidenceState = async (page) => ({
  compositionText: await readText(page, editorTestIds.compositionPanel),
  viewerSnapshotText: await readText(page, editorTestIds.viewerRuntimeSnapshotSummary),
  viewerDiagnosticsText: await readText(page, editorTestIds.viewerRuntimeDiagnostics)
});

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
