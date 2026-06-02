import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { locateBrowserExecutable } from "./browser-discovery.mjs";
import { launchHeadlessBrowser } from "./chrome-launcher.mjs";
import { createPageSession } from "./page-session.mjs";
import {
  createViewerParameterControlTestId,
  createViewerRuntimeMeshEvidenceRowTestId,
  editorProjectStorageKey,
  editorTestIds
} from "./test-ids.mjs";
import { startOrReuseEditorServer } from "./vite-server.mjs";

export const tutorialMiniModelSmokeViewports = [
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

const tutorialSmoke = {
  packageId: "pkg_tutorial_mini_model",
  packageDisplayName: "Tutorial Mini Model",
  readinessReportId: "val_tutorial_mini_model_tutorialReadiness",
  createOperationCount: 34,
  postSmallEditOperationCount: 35,
  bodyMeshId: "mesh_tutorial_body",
  frontHairDrawableId: "draw_tutorial_front_hair",
  frontHairMeshId: "mesh_tutorial_front_hair",
  frontHairVertexId: "vtx_tutorial_front_hair_0_1",
  smallEditOperationId:
    "op_editor_tutorial_small_mesh_nudge_mesh_tutorial_front_hair_vtx_tutorial_front_hair_0_1_r34",
  faceYawParameterId: "param_face_yaw",
  dynamicsGroupId: "dyn_tutorial_hair_sway",
  maskRelationId: "maskrel_tutorial_eye_mask_to_eye",
  rigControlId: "rig_tutorial_head_rotation",
  headRotationKeyformSetId:
    "keyset_rigcontrol_rig_tutorial_head_rotation_angledegrees_face_yaw_1",
  mouthOpacityKeyformSetId: "keyset_drawable_draw_tutorial_mouth_opacity_mouth_open_1"
};

export const runTutorialMiniModelPersistenceSmoke = async ({ page, viewport }) => {
  const layoutEvidence = [];

  await waitForTestId(page, editorTestIds.tutorialWorkflowPanel);
  await assertTutorialInitialState(page, viewport);
  layoutEvidence.push(
    await observeHorizontalOverflow(page, `${viewport.name} tutorial initial`)
  );

  await clickTestId(page, editorTestIds.tutorialWorkflowCreate);
  await assertTutorialCreatedState(page);
  await assertPreviewTutorialEvidence(page);
  await assertTutorialTargetOptions(page);
  layoutEvidence.push(
    await observeHorizontalOverflow(page, `${viewport.name} tutorial created`)
  );

  await clickTestId(page, editorTestIds.tutorialWorkflowSmallEdit);
  await assertTutorialSmallEditCommitted(page);
  await assertPreviewTutorialEvidence(page);
  layoutEvidence.push(
    await observeHorizontalOverflow(page, `${viewport.name} tutorial small edit`)
  );

  await ensureViewerRuntimeOpen(page);
  await setViewerSliderValue(page, tutorialSmoke.faceYawParameterId, 1);
  await assertViewerTutorialEvidence(page);
  layoutEvidence.push(
    await observeHorizontalOverflow(page, `${viewport.name} tutorial viewer`)
  );
  const preSaveEvidence = await readTutorialEvidenceState(page);

  await clickTestId(page, editorTestIds.projectPersistenceSave);
  await waitForText(page, editorTestIds.projectPersistenceStatus, "Saved");
  await assertSavedTutorialProject(page, "after save");

  await page.reload();
  await waitForTestId(page, editorTestIds.shell);
  await clickTestId(page, editorTestIds.projectPersistenceLoad);
  await waitForText(page, editorTestIds.projectPersistenceStatus, "Loaded");
  await assertTutorialStateAfterLoad(page);
  await assertSavedTutorialProject(page, "after load");

  await ensureViewerRuntimeOpen(page);
  await setViewerSliderValue(page, tutorialSmoke.faceYawParameterId, 1);
  await assertViewerTutorialEvidence(page);
  layoutEvidence.push(
    await observeHorizontalOverflow(page, `${viewport.name} tutorial loaded`)
  );
  const postLoadEvidence = await readTutorialEvidenceState(page);
  const screenshot = await page.captureScreenshot(`${viewport.name} tutorial mini model smoke`);

  return {
    viewport: viewport.name,
    packageId: tutorialSmoke.packageId,
    readinessReportId: tutorialSmoke.readinessReportId,
    smallEditOperationId: tutorialSmoke.smallEditOperationId,
    layoutEvidence,
    preSaveEvidence,
    postLoadEvidence,
    screenshot
  };
};

const assertTutorialInitialState = async (page, viewport) => {
  await waitForText(page, editorTestIds.tutorialWorkflowPanel, "Tutorial Mini Model v0");
  await waitForText(
    page,
    editorTestIds.tutorialWorkflowPanel,
    "In progress: 2 of 8 tutorial steps ready"
  );
  await waitForText(page, editorTestIds.tutorialWorkflowSteps, "Part and layer selection: Ready");
  await waitForText(page, editorTestIds.tutorialWorkflowSteps, "Generated drawable and mesh: Ready");
  await waitForText(page, editorTestIds.tutorialWorkflowSteps, "Browser-local save/load: Missing evidence");
  await waitForText(page, editorTestIds.tutorialWorkflowNonGoals, "no real asset import");
  await waitForText(page, editorTestIds.tutorialWorkflowNonGoals, "no full renderer");
  await waitForText(page, editorTestIds.tutorialWorkflowNonGoals, "no pixel oracle");
  await assertTutorialWorkflowReachable(page, viewport);
  await assertTutorialWorkflowAccessibleBasics(page, {
    readinessLabel: "In progress: 2 of 8 tutorial steps ready",
    smallEditDisabled: false,
    smallEditLabel: "Apply front hair mesh nudge"
  });
};

const assertTutorialCreatedState = async (page) => {
  await waitForText(page, editorTestIds.packageStatus, tutorialSmoke.packageId);
  await waitForText(page, editorTestIds.packageStatus, tutorialSmoke.packageDisplayName);
  await waitForText(page, editorTestIds.operationStatus, "addKeyform committed");
  await waitForOperationLogEntryCount(page, tutorialSmoke.createOperationCount);
  await waitForText(page, editorTestIds.operationLogSummary, "createPart");
  await waitForText(page, editorTestIds.operationLogSummary, "createParameter");
  await waitForText(page, editorTestIds.operationLogSummary, "createDrawable");
  await waitForText(page, editorTestIds.operationLogSummary, "setDrawableTexture");
  await waitForText(page, editorTestIds.operationLogSummary, "generateMesh");
  await waitForText(page, editorTestIds.operationLogSummary, "moveMeshVertex");
  await waitForText(page, editorTestIds.operationLogSummary, "setMaskRelation");
  await waitForText(page, editorTestIds.operationLogSummary, "setDrawOrder");
  await waitForText(page, editorTestIds.operationLogSummary, "createRotation2dRigControl");
  await waitForText(page, editorTestIds.operationLogSummary, "createDynamicsGroup");
  await waitForText(page, editorTestIds.operationLogSummary, "addKeyform");
  await waitForText(
    page,
    editorTestIds.tutorialWorkflowPanel,
    "In progress: 7 of 8 tutorial steps ready"
  );
  await waitForText(page, editorTestIds.tutorialWorkflowSteps, "Part and layer selection: Ready");
  await waitForText(page, editorTestIds.tutorialWorkflowSteps, "Generated drawable and mesh: Ready");
  await waitForText(page, editorTestIds.tutorialWorkflowSteps, "Texture metadata: Ready");
  await waitForText(page, editorTestIds.tutorialWorkflowSteps, "Mask or opacity evidence: Ready");
  await waitForText(page, editorTestIds.tutorialWorkflowSteps, "rotation2d rig-control keyform: Ready");
  await waitForText(page, editorTestIds.tutorialWorkflowSteps, "Dynamics evidence: Ready");
  await waitForText(page, editorTestIds.tutorialWorkflowSteps, "Preview, Viewer, and Validator evidence: Ready");
  await waitForText(page, editorTestIds.tutorialWorkflowSteps, "Browser-local save/load: Missing evidence");
  await waitForText(page, editorTestIds.tutorialWorkflowSteps, tutorialSmoke.readinessReportId);
  await assertTutorialSmallEditButton(page, {
    disabled: false,
    label: "Apply front hair mesh nudge"
  });
};

const assertPreviewTutorialEvidence = async (page) => {
  await waitForText(page, editorTestIds.previewSummary, "8 visible / 8 total");
  await waitForText(page, editorTestIds.previewSummary, "5 part groups / 8 drawable memberships");
  await waitForText(page, editorTestIds.previewSummary, "8 drawable mesh evidence");
  await waitForText(page, editorTestIds.previewSummary, "moved vertices");
  await waitForText(page, editorTestIds.previewSummary, "8 fallback");

  const visual = await page.evaluate((ids, expected) => {
    const root = document.querySelector(`[data-testid="${ids.visual}"]`);
    const drawable = root?.querySelector(`[data-drawable-id="${expected.frontHairDrawableId}"]`);

    return {
      ariaLabel: root?.getAttribute("aria-label") ?? "",
      viewBox: root?.getAttribute("viewBox") ?? "",
      frontHairPresent: drawable !== null,
      textureId: drawable?.getAttribute("data-texture-id") ?? null,
      textureRender: drawable?.getAttribute("data-texture-render") ?? null,
      textureStatus: drawable?.getAttribute("data-texture-status") ?? null,
      points: drawable?.getAttribute("points") ?? ""
    };
  }, {
    visual: editorTestIds.previewVisual
  }, tutorialSmoke);

  if (
    visual.ariaLabel !== "Runtime preview visual, 0 texture pattern, 8 texture fallback" ||
    visual.viewBox !== "0 0 320 420" ||
    !visual.frontHairPresent ||
    visual.textureId !== "tex_tutorial_front_hair" ||
    visual.textureRender !== "solid_fallback" ||
    visual.textureStatus !== "resolved" ||
    visual.points.length === 0
  ) {
    throw new Error(`Tutorial preview semantic evidence mismatch: ${JSON.stringify(visual)}.`);
  }
};

const assertTutorialTargetOptions = async (page) => {
  const state = await page.evaluate((ids, expected) => {
    const select = document.querySelector(`[data-testid="${ids.select}"]`);
    if (!(select instanceof HTMLSelectElement)) {
      throw new Error("Tutorial target select was missing.");
    }

    const options = [...select.options].map((option) => ({
      value: option.value,
      text: option.textContent ?? "",
      selected: option.selected
    }));
    const targetValue = `mesh:${expected.bodyMeshId}`;
    select.value = targetValue;
    select.dispatchEvent(new Event("change", { bubbles: true }));

    return {
      ariaLabel: select.getAttribute("aria-label") ?? "",
      options,
      selectedAfterChange: select.value
    };
  }, {
    select: editorTestIds.tutorialWorkflowTargetSelect
  }, tutorialSmoke);

  const optionTexts = state.options.map((option) => option.text);

  if (
    state.ariaLabel !== "Selected tutorial evidence target" ||
    !optionTexts.includes(`Mesh ${tutorialSmoke.bodyMeshId}`) ||
    !optionTexts.includes(`Tutorial readiness report ${tutorialSmoke.readinessReportId}`) ||
    state.selectedAfterChange !== `mesh:${tutorialSmoke.bodyMeshId}`
  ) {
    throw new Error(`Tutorial target options were not observable: ${JSON.stringify(state)}.`);
  }

  await waitForText(page, editorTestIds.tutorialWorkflowTargetSelect, `Mesh ${tutorialSmoke.bodyMeshId}`);
};

const assertTutorialSmallEditCommitted = async (page) => {
  await waitForText(page, editorTestIds.operationStatus, "moveMeshVertex committed");
  await waitForOperationLogEntryCount(page, tutorialSmoke.postSmallEditOperationCount);
  await waitForText(page, editorTestIds.operationLogSummary, "moveMeshVertex");
  await waitForText(
    page,
    editorTestIds.tutorialWorkflowPanel,
    "In progress: 7 of 8 tutorial steps ready"
  );

  const operationEvidence = await page.evaluate((storageKey, expected) => {
    const raw = localStorage.getItem(storageKey);
    return {
      savedBeforeExplicitSave: raw !== null,
      operationStatus: document.querySelector(`[data-testid="${expected.operationStatusId}"]`)?.textContent ?? "",
      meshStatus: document.querySelector(`[data-testid="${expected.meshStatusId}"]`)?.textContent ?? ""
    };
  }, editorProjectStorageKey, {
    operationStatusId: editorTestIds.operationStatus,
    meshStatusId: editorTestIds.meshVertexStatus
  });

  if (operationEvidence.savedBeforeExplicitSave) {
    throw new Error("Tutorial project was written to browser storage before explicit save.");
  }
};

const assertViewerTutorialEvidence = async (page) => {
  await waitForTestId(page, editorTestIds.viewerRuntimePanel);
  await waitForText(page, editorTestIds.viewerRuntimePackageState, tutorialSmoke.packageId);
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, "Runtime Snapshot");
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, "viewer");
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, "4 total / 1 override");
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, "8 visible / 8 total");
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, "1 evaluated / 1 total");
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, "1 semantic");
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, tutorialSmoke.faceYawParameterId);
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, `${tutorialSmoke.faceYawParameterId}: 1 / authoredInput / viewerOverride`);
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, tutorialSmoke.rigControlId);
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, tutorialSmoke.maskRelationId);
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, tutorialSmoke.dynamicsGroupId);
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, "Part Layer Evidence");
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, tutorialSmoke.frontHairDrawableId);
  await waitForText(page, editorTestIds.viewerRuntimeDiff, "Affected drawables");
  await waitForText(page, editorTestIds.viewerRuntimeDiagnostics, "Validation Diagnostics");
  await waitForText(page, editorTestIds.viewerRuntimeDiagnostics, "No diagnostics");

  const meshEvidence = await readText(
    page,
    createViewerRuntimeMeshEvidenceRowTestId(tutorialSmoke.frontHairDrawableId)
  );

  if (
    !meshEvidence.includes(`mesh ${tutorialSmoke.frontHairMeshId}`) ||
    !meshEvidence.includes("9 vertices") ||
    !meshEvidence.includes("hash ")
  ) {
    throw new Error(`Tutorial viewer mesh evidence mismatch: ${meshEvidence}.`);
  }
};

const assertSavedTutorialProject = async (page, label) => {
  const saved = await page.evaluate((storageKey, expected) => {
    const raw = localStorage.getItem(storageKey);
    if (raw === null) {
      return null;
    }

    const project = JSON.parse(raw);
    const graph = readPackageJsonFile(project, "model/graph.json");
    const drawables = readPackageJsonFile(project, "model/drawables.json");
    const meshes = readPackageJsonFile(project, "model/meshes.json");
    const masks = readPackageJsonFile(project, "model/masks.json");
    const rigControls = readPackageJsonFile(project, "model/rig-controls.json");
    const dynamics = readPackageJsonFile(project, "model/dynamics.json");
    const keyforms = readPackageJsonFile(project, "model/keyforms.json");
    const editorState = readPackageJsonFile(project, "model/editor-state.json");
    const operationLogEntries = String(project.operationLogJsonl ?? "")
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line));
    const smallEditEntry = operationLogEntries.find(
      (entry) => entry.operationId === expected.smallEditOperationId
    );
    const frontHairMesh = meshes?.meshes?.find(
      (candidate) => candidate.meshId === expected.frontHairMeshId
    );
    const frontHairVertexIndex = frontHairMesh?.vertexStableIds?.indexOf(expected.frontHairVertexId) ?? -1;

    return {
      schemaVersion: project.schemaVersion,
      packageId: project.packageSummary?.packageId ?? null,
      packageRevision: project.packageSummary?.packageRevision ?? null,
      packageDisplayName: project.packageSummary?.packageDisplayName ?? null,
      packageFileCount: Array.isArray(project.packageFileSet) ? project.packageFileSet.length : 0,
      operationCount: operationLogEntries.length,
      operationTypes: operationLogEntries.map((entry) => entry.operationType),
      smallEditEntry: smallEditEntry === undefined
        ? null
        : {
            operationType: smallEditEntry.operationType,
            targetIds: smallEditEntry.targetIds
          },
      partCount: graph?.parts?.length ?? null,
      drawableCount: drawables?.drawables?.length ?? null,
      meshCount: meshes?.meshes?.length ?? null,
      maskRelationIds: masks?.masks?.map((relation) => relation.maskRelationId) ?? [],
      rigControlIds: rigControls?.rigControls?.map((rigControl) => rigControl.rigControlId) ?? [],
      dynamicsGroupIds: dynamics?.dynamicsGroups?.map((group) => group.dynamicsGroupId) ?? [],
      keyformSetIds: keyforms?.keyformSets?.map((keyformSet) => keyformSet.keyformSetId) ?? [],
      frontHairVertexIndex,
      frontHairVertex:
        frontHairVertexIndex < 0 ? null : frontHairMesh?.vertices?.[frontHairVertexIndex] ?? null,
      editorState,
      generatedRuntimeArtifacts: (project.generatedArtifactPaths ?? []).filter((entry) =>
        entry.startsWith("runtime/")
      ).length,
      generatedValidationArtifacts: (project.generatedArtifactPaths ?? []).filter((entry) =>
        entry.startsWith("validation/reports/")
      ).length
    };

    function readPackageJsonFile(projectValue, packagePath) {
      if (!Array.isArray(projectValue.packageFileSet)) {
        return null;
      }

      const entry = projectValue.packageFileSet.find((candidate) => candidate.path === packagePath);
      if (typeof entry?.text !== "string") {
        return null;
      }

      return JSON.parse(entry.text);
    }
  }, editorProjectStorageKey, tutorialSmoke);

  if (
    saved === null ||
    saved.schemaVersion !== "editor-project-persistence-v1" ||
    saved.packageId !== tutorialSmoke.packageId ||
    saved.packageRevision !== tutorialSmoke.postSmallEditOperationCount ||
    saved.packageDisplayName !== tutorialSmoke.packageDisplayName ||
    saved.packageFileCount < 1 ||
    saved.operationCount !== tutorialSmoke.postSmallEditOperationCount ||
    !saved.operationTypes.includes("moveMeshVertex") ||
    JSON.stringify(saved.smallEditEntry) !== JSON.stringify({
      operationType: "moveMeshVertex",
      targetIds: [tutorialSmoke.frontHairMeshId, tutorialSmoke.frontHairVertexId]
    }) ||
    saved.partCount !== 5 ||
    saved.drawableCount !== 8 ||
    saved.meshCount !== 8 ||
    !saved.maskRelationIds.includes(tutorialSmoke.maskRelationId) ||
    !saved.rigControlIds.includes(tutorialSmoke.rigControlId) ||
    !saved.dynamicsGroupIds.includes(tutorialSmoke.dynamicsGroupId) ||
    !saved.keyformSetIds.includes(tutorialSmoke.headRotationKeyformSetId) ||
    !saved.keyformSetIds.includes(tutorialSmoke.mouthOpacityKeyformSetId) ||
    saved.frontHairVertexIndex < 0 ||
    saved.frontHairVertex === null ||
    saved.generatedRuntimeArtifacts < 1 ||
    saved.generatedValidationArtifacts < 1
  ) {
    throw new Error(`Saved tutorial project mismatch during ${label}: ${JSON.stringify(saved)}.`);
  }
};

const assertTutorialStateAfterLoad = async (page) => {
  await waitForText(page, editorTestIds.packageStatus, tutorialSmoke.packageId);
  await waitForText(page, editorTestIds.packageStatus, tutorialSmoke.packageDisplayName);
  await waitForOperationLogEntryCount(page, tutorialSmoke.postSmallEditOperationCount);
  await waitForText(page, editorTestIds.operationLogSummary, "moveMeshVertex");
  await waitForText(
    page,
    editorTestIds.tutorialWorkflowPanel,
    "Ready: 8 of 8 tutorial steps ready"
  );
  await waitForText(page, editorTestIds.tutorialWorkflowSteps, "Browser-local save/load: Ready");
  await waitForText(page, editorTestIds.tutorialWorkflowSteps, "Reload packageRevision:35");
  await waitForText(page, editorTestIds.tutorialWorkflowSteps, tutorialSmoke.readinessReportId);
  await waitForText(page, editorTestIds.reloadSummary, "Package revision35");
  await assertPreviewTutorialEvidence(page);
};

const assertTutorialWorkflowReachable = async (page, viewport) => {
  const metrics = await page.evaluate((ids) => {
    const panel = document.querySelector(`[data-testid="${ids.panel}"]`);
    const create = document.querySelector(`[data-testid="${ids.create}"]`);
    const smallEdit = document.querySelector(`[data-testid="${ids.smallEdit}"]`);
    const select = document.querySelector(`[data-testid="${ids.select}"]`);

    if (
      !(panel instanceof HTMLElement) ||
      !(create instanceof HTMLButtonElement) ||
      !(smallEdit instanceof HTMLButtonElement) ||
      !(select instanceof HTMLSelectElement)
    ) {
      return null;
    }

    select.scrollIntoView({ block: "center", inline: "nearest" });
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const rectVisible = (rect) =>
      rect.width > 0 &&
      rect.height > 0 &&
      rect.right > 0 &&
      rect.left < viewportWidth &&
      rect.bottom > 0 &&
      rect.top < viewportHeight;

    const panelRect = panel.getBoundingClientRect();
    const createRect = create.getBoundingClientRect();
    const smallEditRect = smallEdit.getBoundingClientRect();
    const selectRect = select.getBoundingClientRect();

    return {
      panelVisible: rectVisible(panelRect),
      createVisible: rectVisible(createRect),
      smallEditVisible: rectVisible(smallEditRect),
      selectVisible: rectVisible(selectRect),
      panelWidth: panelRect.width,
      createWidth: createRect.width,
      smallEditWidth: smallEditRect.width,
      selectWidth: selectRect.width
    };
  }, {
    panel: editorTestIds.tutorialWorkflowPanel,
    create: editorTestIds.tutorialWorkflowCreate,
    smallEdit: editorTestIds.tutorialWorkflowSmallEdit,
    select: editorTestIds.tutorialWorkflowTargetSelect
  });

  if (
    metrics === null ||
    !metrics.panelVisible ||
    !metrics.createVisible ||
    !metrics.smallEditVisible ||
    !metrics.selectVisible ||
    metrics.panelWidth < 1 ||
    metrics.createWidth < 1 ||
    metrics.smallEditWidth < 1 ||
    metrics.selectWidth < 1
  ) {
    throw new Error(`${viewport.name} tutorial workflow panel was not reachable: ${JSON.stringify(metrics)}.`);
  }
};

const assertTutorialWorkflowAccessibleBasics = async (
  page,
  { readinessLabel, smallEditDisabled, smallEditLabel }
) => {
  const names = await page.evaluate((ids) => {
    const panel = document.querySelector(`[data-testid="${ids.panel}"]`);
    const headingId = panel?.getAttribute("aria-labelledby");
    const create = document.querySelector(`[data-testid="${ids.create}"]`);
    const smallEdit = document.querySelector(`[data-testid="${ids.smallEdit}"]`);
    const select = document.querySelector(`[data-testid="${ids.select}"]`);
    const readiness = panel?.querySelector(".editor-panel__meta");

    if (!(smallEdit instanceof HTMLButtonElement)) {
      throw new Error("Tutorial small edit button was missing.");
    }

    return {
      panelName: headingId === null ? "" : document.getElementById(headingId)?.textContent ?? "",
      readinessLabel: readiness?.textContent ?? "",
      createName: create?.textContent?.trim() ?? "",
      smallEditName: smallEdit.textContent?.trim() ?? "",
      smallEditDisabled: smallEdit.disabled,
      selectName: select?.getAttribute("aria-label") ?? ""
    };
  }, {
    panel: editorTestIds.tutorialWorkflowPanel,
    create: editorTestIds.tutorialWorkflowCreate,
    smallEdit: editorTestIds.tutorialWorkflowSmallEdit,
    select: editorTestIds.tutorialWorkflowTargetSelect
  });
  const expected = {
    panelName: "Tutorial Mini Model v0",
    readinessLabel,
    createName: "Create tutorial mini model",
    smallEditName: smallEditLabel,
    smallEditDisabled,
    selectName: "Selected tutorial evidence target"
  };

  if (JSON.stringify(names) !== JSON.stringify(expected)) {
    throw new Error(
      `Tutorial workflow accessible basics mismatch: expected ${JSON.stringify(expected)}, received ${JSON.stringify(names)}.`
    );
  }
};

const assertTutorialSmallEditButton = async (page, { disabled, label }) => {
  const button = await page.evaluate((id) => {
    const element = document.querySelector(`[data-testid="${id}"]`);
    if (!(element instanceof HTMLButtonElement)) {
      throw new Error("Tutorial small edit button was missing.");
    }

    return {
      label: element.textContent?.trim() ?? "",
      disabled: element.disabled
    };
  }, editorTestIds.tutorialWorkflowSmallEdit);

  if (JSON.stringify(button) !== JSON.stringify({ label, disabled })) {
    throw new Error(`Tutorial small edit button mismatch: ${JSON.stringify(button)}.`);
  }
};

const ensureViewerRuntimeOpen = async (page) => {
  if (!(await hasTestId(page, editorTestIds.viewerRuntimePanel))) {
    await clickTestId(page, editorTestIds.viewerRuntimeOpen);
  }

  await waitForTestId(page, editorTestIds.viewerRuntimePanel);
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

const readTutorialEvidenceState = async (page) => ({
  tutorialPanelText: await readText(page, editorTestIds.tutorialWorkflowPanel),
  previewSummaryText: await readText(page, editorTestIds.previewSummary),
  viewerSnapshotText: await readText(page, editorTestIds.viewerRuntimeSnapshotSummary),
  viewerDiagnosticsText: await readText(page, editorTestIds.viewerRuntimeDiagnostics)
});

const observeHorizontalOverflow = async (page, label, { allowOverflow = false } = {}) => {
  const overflow = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const documentOverflows =
      Math.max(document.body?.scrollWidth ?? 0, document.documentElement.scrollWidth) > viewportWidth + 1
        ? 1
        : 0;
    const overflowingElements = [...document.body.querySelectorAll("*")].filter((element) => {
      const rect = element.getBoundingClientRect();

      return rect.left < -1 || rect.right > viewportWidth + 1;
    });

    return {
      count: documentOverflows + overflowingElements.length,
      viewportWidth,
      documentScrollWidth: Math.max(document.body?.scrollWidth ?? 0, document.documentElement.scrollWidth),
      elements: overflowingElements.slice(0, 8).map((element) => {
        const rect = element.getBoundingClientRect();

        return {
          tagName: element.tagName.toLowerCase(),
          className: element.getAttribute("class") ?? "",
          testId: element.getAttribute("data-testid") ?? "",
          text: (element.textContent ?? "").trim().slice(0, 96),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width)
        };
      })
    };
  });

  if (!allowOverflow && overflow.count !== 0) {
    throw new Error(`${label} horizontal overflow was ${JSON.stringify(overflow)}; expected 0.`);
  }

  return { label, ...overflow };
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

const hasTestId = async (page, testId) =>
  page.evaluate((id) => document.querySelector(`[data-testid="${id}"]`) !== null, testId);

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
      { timeoutMs: 8_000 },
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
    { timeoutMs: 8_000 },
    editorTestIds.operationLogSummary,
    expectedCount
  );
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
      `tutorial-mini-model-e2e: using ${browser.executable} (${browser.source}); server ${server.baseUrl} ${
        server.reused ? "reused" : "started"
      }`
    );

    launchedBrowser = await launchHeadlessBrowser({ executable: browser.executable });

    for (const viewport of tutorialMiniModelSmokeViewports) {
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

        const result = await runTutorialMiniModelPersistenceSmoke({ page, viewport });
        const layoutSummary = result.layoutEvidence
          .map((evidence) =>
            `${evidence.label}: count=${evidence.count} scrollWidth=${evidence.documentScrollWidth}`
          )
          .join("; ");
        console.log(`tutorial-mini-model-e2e: ${viewport.name} smoke passed`);
        console.log(`tutorial-mini-model-e2e: ${viewport.name} layout ${layoutSummary}`);
        console.log(
          `tutorial-mini-model-e2e: ${viewport.name} screenshot ${result.screenshot.format} base64Length=${result.screenshot.base64Length}`
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
    console.log("tutorial-mini-model-e2e: smoke passed");
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
