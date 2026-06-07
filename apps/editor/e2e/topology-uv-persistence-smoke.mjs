import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { locateBrowserExecutable } from "./browser-discovery.mjs";
import { launchHeadlessBrowser } from "./chrome-launcher.mjs";
import { createPageSession } from "./page-session.mjs";
import {
  createDrawableRowTestId,
  createMeshCanvasVertexTestId,
  createMeshTopologyActionTestId,
  createMeshTriangleRemoveButtonTestId,
  createViewerRuntimeMeshEvidenceRowTestId,
  editorProjectStorageKey,
  editorTestIds
} from "./test-ids.mjs";
import {
  runSourceIntakeWorkflow,
  sourceIntakeSmoke
} from "./source-intake-smoke.mjs";
import {
  selectorScopes,
  waitForScopedText
} from "./selector-scopes.mjs";
import { startOrReuseEditorServer } from "./vite-server.mjs";

export const topologyUvSmokeViewports = [
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

const smokeDrawable = {
  displayName: "Wave 38 Topology UV",
  drawableId: "draw_wave_38_topology_uv",
  meshId: "mesh_wave_38_topology_uv",
  bounds: sourceIntakeSmoke.bounds
};

const existingVertices = [
  {
    vertexId: "vtx_wave_38_topology_uv_0_0",
    uvAfterNudge: { x: 0.05, y: 0 }
  },
  {
    vertexId: "vtx_wave_38_topology_uv_0_1"
  }
];

const addedVertex = {
  vertexId: "vtx_wave_38_topology_uv_editor_0_9",
  position: { x: 98, y: 42 },
  uv: { x: 0.5, y: 0.5 }
};

const addedTriangle = {
  triangleId: "tri_wave_38_topology_uv_editor_1_8",
  vertexIds: [
    existingVertices[0].vertexId,
    existingVertices[1].vertexId,
    addedVertex.vertexId
  ]
};

export const runTopologyUvPersistenceSmoke = async ({ page, viewport }) => {
  await runSourceIntakeWorkflow({
    page,
    viewport,
    initialOperationLogEntryCount: 0
  });
  await assertNoHorizontalOverflow(page, `${viewport.name} wave38 post-source-intake`);

  await createTopologyDrawable(page);
  await assertTopologyDrawableCreated(page);
  await assertTopologyControlsReachable(page, viewport);
  await assertTopologyAccessibleBasics(page);
  await assertNoHorizontalOverflow(page, `${viewport.name} wave38 drawable-created`);

  await assertReferencedVertexRemovalBlocked(page, {
    vertexId: existingVertices[0].vertexId,
    expectedOperationLogEntryCount: 3,
    label: "initial referenced vertex"
  });
  await selectMeshCanvasVertex(page, existingVertices[0].vertexId, "toggle");
  await waitForText(page, editorTestIds.meshTopologyStatus, "0 selected vertices");

  await commitAddVertexThenReplayStaleAdd(page);
  await assertAddedVertexLive(page);

  await selectMeshCanvasVertex(page, existingVertices[0].vertexId, "replace");
  await selectMeshCanvasVertex(page, existingVertices[1].vertexId, "add");
  await selectMeshCanvasVertex(page, addedVertex.vertexId, "add");
  await waitForText(page, editorTestIds.meshTopologyStatus, "3 selected vertices");
  await assertTopologyActionState(page, createMeshTopologyActionTestId("addTriangle"), {
    disabled: false,
    ariaIncludes: "Add triangle"
  });
  await clickTestId(page, createMeshTopologyActionTestId("addTriangle"));
  await waitForText(page, editorTestIds.operationStatus, "addMeshTriangle committed");
  await waitForText(page, editorTestIds.meshTopologyStatus, "Topology r2");
  await waitForText(page, editorTestIds.meshTopologyStatus, "10 vertices / 9 triangles");
  await waitForOperationLogEntryCount(page, 5);
  await waitForText(page, editorTestIds.operationLogSummary, "addMeshTriangle");
  await waitForTestId(page, createMeshTriangleRemoveButtonTestId(smokeDrawable.meshId, addedTriangle.triangleId));

  await assertReferencedVertexRemovalBlocked(page, {
    vertexId: addedVertex.vertexId,
    expectedOperationLogEntryCount: 5,
    label: "new triangle referenced vertex"
  });

  await selectMeshCanvasVertex(page, existingVertices[0].vertexId, "replace");
  await waitForText(page, editorTestIds.meshTopologyStatus, "1 selected vertex");
  await assertTopologyActionState(page, createMeshTopologyActionTestId("uvRight"), {
    disabled: false,
    ariaIncludes: "Nudge selected mesh UV right"
  });
  await clickTestId(page, createMeshTopologyActionTestId("uvRight"));
  await waitForText(page, editorTestIds.operationStatus, "moveMeshUvPoint committed");
  await waitForText(page, editorTestIds.meshTopologyStatus, "Topology r3");
  await waitForOperationLogEntryCount(page, 6);
  await waitForText(page, editorTestIds.operationLogSummary, "moveMeshUvPoint");

  await assertPreviewViewerValidatorEvidence(page, "before save");
  await assertNoHorizontalOverflow(page, `${viewport.name} wave38 topology-uv-edited`);

  await clickTestId(page, editorTestIds.projectPersistenceSave);
  await waitForText(page, editorTestIds.projectPersistenceStatus, "Saved");
  await assertSavedTopologyUvProject(page, "after save");

  await page.reload();
  await waitForTestId(page, editorTestIds.shell);
  await clickTestId(page, editorTestIds.projectPersistenceLoad);
  await waitForText(page, editorTestIds.projectPersistenceStatus, "Loaded");
  await assertTopologyUvStateAfterLoad(page);
  await assertSavedTopologyUvProject(page, "after load");
  await assertPreviewViewerValidatorEvidence(page, "after load");
  await assertNoHorizontalOverflow(page, `${viewport.name} wave38 loaded`);

  const evidence = await readTopologyUvEvidence(page);
  const screenshot = await page.captureScreenshot(`${viewport.name} wave38 topology uv smoke`);

  return {
    viewport: viewport.name,
    drawableId: smokeDrawable.drawableId,
    meshId: smokeDrawable.meshId,
    addedVertexId: addedVertex.vertexId,
    addedTriangleId: addedTriangle.triangleId,
    evidence,
    screenshot
  };
};

const createTopologyDrawable = async (page) => {
  await waitForTestId(page, editorTestIds.drawableCreateForm);
  await page.evaluate((ids, input) => {
    const form = document.querySelector(`[data-testid="${ids.form}"]`);

    if (!(form instanceof HTMLFormElement)) {
      throw new Error("Drawable create form was missing.");
    }

    const setValue = (name, value) => {
      const control = form.elements.namedItem(name);

      if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement)) {
        throw new Error(`Missing drawable create field ${name}.`);
      }

      control.value = String(value);
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.dispatchEvent(new Event("change", { bubbles: true }));
    };

    setValue("displayName", input.displayName);
    setValue("meshMethod", "auto-grid-v1");
    setValue("x", input.bounds.x);
    setValue("y", input.bounds.y);
    setValue("width", input.bounds.width);
    setValue("height", input.bounds.height);
  }, {
    form: editorTestIds.drawableCreateForm
  }, smokeDrawable);

  await clickTestId(page, editorTestIds.drawableCreateSubmit);
};

const assertTopologyDrawableCreated = async (page) => {
  const rowId = createDrawableRowTestId(smokeDrawable.drawableId);

  await waitForText(page, editorTestIds.drawableResult, "Drawable preset committed");
  await waitForScopedText(page, selectorScopes.legacyDrawableAuthoring, rowId, smokeDrawable.displayName);
  await waitForScopedText(page, selectorScopes.legacyDrawableAuthoring, rowId, smokeDrawable.drawableId);
  await waitForScopedText(page, selectorScopes.legacyDrawableAuthoring, rowId, smokeDrawable.meshId);
  await waitForScopedText(page, selectorScopes.legacyDrawableAuthoring, rowId, "9 vertices / 8 triangles");
  await waitForText(page, editorTestIds.meshCanvasStatus, smokeDrawable.meshId);
  await waitForText(page, editorTestIds.meshCanvasStatus, "9 canvas targets");
  await waitForText(page, editorTestIds.meshTopologyStatus, smokeDrawable.meshId);
  await waitForText(page, editorTestIds.meshTopologyStatus, "9 vertices / 8 triangles");
  await waitForText(page, editorTestIds.meshTopologyStatus, "Topology r0");
  await waitForText(page, editorTestIds.meshTopologyStatus, "Stable triangle IDs available");
  await waitForText(page, editorTestIds.meshTopologyStatus, "0 selected vertices");
  await waitForOperationLogEntryCount(page, 3);
  await waitForText(page, editorTestIds.operationLogSummary, "importPsdSourceAsset, createDrawable, generateMesh");
};

const assertTopologyControlsReachable = async (page, viewport) => {
  const metrics = await page.evaluate((ids) => {
    const controls = document.querySelector(`[data-testid="${ids.controls}"]`);
    const status = document.querySelector(`[data-testid="${ids.status}"]`);
    const addVertex = document.querySelector(`[data-testid="${ids.addVertex}"]`);
    const uvRight = document.querySelector(`[data-testid="${ids.uvRight}"]`);

    if (
      !(controls instanceof HTMLElement) ||
      !(status instanceof HTMLElement) ||
      !(addVertex instanceof HTMLButtonElement) ||
      !(uvRight instanceof HTMLButtonElement)
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

    uvRight.scrollIntoView({ block: "center", inline: "nearest" });

    const controlsRect = controls.getBoundingClientRect();
    const statusRect = status.getBoundingClientRect();
    const addVertexRect = addVertex.getBoundingClientRect();
    const uvRightRect = uvRight.getBoundingClientRect();

    return {
      controlsVisible: rectVisible(controlsRect),
      statusVisible: rectVisible(statusRect),
      addVertexVisible: rectVisible(addVertexRect),
      uvRightVisible: rectVisible(uvRightRect),
      controlsWidth: controlsRect.width,
      uvRightWidth: uvRightRect.width
    };
  }, {
    controls: editorTestIds.meshTopologyControls,
    status: editorTestIds.meshTopologyStatus,
    addVertex: createMeshTopologyActionTestId("addVertex"),
    uvRight: createMeshTopologyActionTestId("uvRight")
  });

  if (
    metrics === null ||
    !metrics.controlsVisible ||
    !metrics.statusVisible ||
    !metrics.addVertexVisible ||
    !metrics.uvRightVisible ||
    metrics.controlsWidth < 1 ||
    metrics.uvRightWidth < 1
  ) {
    throw new Error(`${viewport.name} topology/UV controls were not reachable: ${JSON.stringify(metrics)}.`);
  }
};

const assertTopologyAccessibleBasics = async (page) => {
  const names = await page.evaluate((ids) => {
    const controls = document.querySelector(`[data-testid="${ids.controls}"]`);
    const headingId = controls?.getAttribute("aria-labelledby");
    const status = document.querySelector(`[data-testid="${ids.status}"]`);
    const addVertex = document.querySelector(`[data-testid="${ids.addVertex}"]`);
    const uvRight = document.querySelector(`[data-testid="${ids.uvRight}"]`);

    if (!(addVertex instanceof HTMLButtonElement) || !(uvRight instanceof HTMLButtonElement)) {
      throw new Error("Topology action buttons were missing.");
    }

    return {
      controlsName: headingId === null ? "" : document.getElementById(headingId)?.textContent ?? "",
      statusRole: status?.getAttribute("role") ?? "",
      statusName: status?.getAttribute("aria-label") ?? "",
      addVertexText: addVertex.textContent?.trim() ?? "",
      addVertexName: addVertex.getAttribute("aria-label") ?? "",
      addVertexDisabled: addVertex.disabled,
      uvRightText: uvRight.textContent?.trim() ?? "",
      uvRightName: uvRight.getAttribute("aria-label") ?? "",
      uvRightDisabled: uvRight.disabled
    };
  }, {
    controls: editorTestIds.meshTopologyControls,
    status: editorTestIds.meshTopologyStatus,
    addVertex: createMeshTopologyActionTestId("addVertex"),
    uvRight: createMeshTopologyActionTestId("uvRight")
  });
  const expected = {
    controlsName: "Mesh Topology / UV",
    statusRole: "status",
    statusName: "Mesh topology and UV edit status",
    addVertexText: "Add vertex",
    addVertexName: "Add vertex",
    addVertexDisabled: false,
    uvRightText: "+U",
    uvRightName: "Nudge selected mesh UV right: No selected vertices",
    uvRightDisabled: true
  };

  if (JSON.stringify(names) !== JSON.stringify(expected)) {
    throw new Error(`Topology accessible basics mismatch: expected ${JSON.stringify(expected)}, received ${JSON.stringify(names)}.`);
  }
};

const assertReferencedVertexRemovalBlocked = async (
  page,
  { vertexId, expectedOperationLogEntryCount, label }
) => {
  await selectMeshCanvasVertex(page, vertexId, "replace");
  await waitForText(page, editorTestIds.meshTopologyStatus, "1 selected vertex");
  await assertTopologyActionState(page, createMeshTopologyActionTestId("removeVertex"), {
    disabled: true,
    ariaIncludes: "Selected vertex is referenced by a triangle"
  });
  await clickTestId(page, createMeshTopologyActionTestId("removeVertex"));
  await waitForOperationLogEntryCount(page, expectedOperationLogEntryCount);

  const evidence = await readTopologyUvEvidence(page);
  if (
    evidence.operationStatus.includes("removeMeshVertex committed") ||
    evidence.operationLogEntryCount !== expectedOperationLogEntryCount
  ) {
    throw new Error(`Invalid remove vertex path changed state during ${label}: ${JSON.stringify(evidence)}.`);
  }
};

const commitAddVertexThenReplayStaleAdd = async (page) => {
  await page.evaluate((ids) => {
    const button = document.querySelector(`[data-testid="${ids.addVertex}"]`);

    if (!(button instanceof HTMLButtonElement) || button.disabled) {
      throw new Error("Add vertex button was unavailable for stale replay check.");
    }

    button.click();
    button.click();
  }, {
    addVertex: createMeshTopologyActionTestId("addVertex")
  });

  await waitForText(page, editorTestIds.operationStatus, "addMeshVertex rejected");
  await waitForText(page, editorTestIds.meshTopologyStatus, "addMeshVertex rejected");
  await waitForText(page, editorTestIds.meshTopologyStatus, "Topology r1");
  await waitForText(page, editorTestIds.meshTopologyStatus, "10 vertices / 8 triangles");
  await waitForOperationLogEntryCount(page, 4);
  await waitForText(page, editorTestIds.operationLogSummary, "addMeshVertex");
};

const assertAddedVertexLive = async (page) => {
  await waitForTestId(page, createMeshCanvasVertexTestId(smokeDrawable.meshId, addedVertex.vertexId));

  const state = await page.evaluate((expected) => {
    const target = document.querySelector(`[data-testid="${expected.testId}"]`);

    return {
      selected: target?.getAttribute("data-selected") ?? null,
      editable: target?.getAttribute("data-editable") ?? null,
      x: Number(target?.getAttribute("cx")),
      y: Number(target?.getAttribute("cy")),
      ariaLabel: target?.getAttribute("aria-label") ?? ""
    };
  }, {
    testId: createMeshCanvasVertexTestId(smokeDrawable.meshId, addedVertex.vertexId)
  });
  const expected = {
    selected: "false",
    editable: "true",
    x: addedVertex.position.x,
    y: addedVertex.position.y
  };

  if (
    state.selected !== expected.selected ||
    state.editable !== expected.editable ||
    state.x !== expected.x ||
    state.y !== expected.y ||
    !state.ariaLabel.includes(addedVertex.vertexId)
  ) {
    throw new Error(`Added vertex live state mismatch: expected ${JSON.stringify(expected)}, received ${JSON.stringify(state)}.`);
  }
};

const assertPreviewViewerValidatorEvidence = async (page, label) => {
  await waitForText(page, editorTestIds.previewSummary, "2 visible / 2 total");
  await waitForText(page, editorTestIds.previewSummary, "drawable mesh evidence");
  await waitForText(page, editorTestIds.previewSummary, "topology summaries");
  await waitForText(page, editorTestIds.generatedEvidenceSummary, "Runtime snapshots");
  await waitForText(page, editorTestIds.generatedEvidenceSummary, "Validation reports");
  await waitForText(page, editorTestIds.previewSummary, "0 error / 0 warning");

  const previewText = await readText(page, editorTestIds.previewSummary);
  if (!previewText.includes("Diagnostics") || !previewText.includes("0 error / 0 warning")) {
    throw new Error(`Preview validator summary was not clean during ${label}: ${previewText}.`);
  }

  await clickViewerOpenIfClosed(page);
  await waitForTestId(page, editorTestIds.viewerRuntimePanel);
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, "Mesh Evidence");
  await waitForTestId(page, createViewerRuntimeMeshEvidenceRowTestId(smokeDrawable.drawableId));
  await waitForText(page, editorTestIds.viewerRuntimeDiagnostics, "Validation Diagnostics");
  await waitForText(page, editorTestIds.viewerRuntimeDiagnostics, "val_editor_browser_sample_editorIncremental");
  await waitForText(page, editorTestIds.viewerRuntimeDiagnostics, "checks");

  const viewerEvidence = await page.evaluate((ids, expected) => {
    const row = document.querySelector(`[data-testid="${ids.row}"]`);
    const diagnostics = document.querySelector(`[data-testid="${ids.diagnostics}"]`);

    return {
      rowText: row?.textContent ?? "",
      diagnosticsText: diagnostics?.textContent ?? ""
    };
  }, {
    row: createViewerRuntimeMeshEvidenceRowTestId(smokeDrawable.drawableId),
    diagnostics: editorTestIds.viewerRuntimeDiagnostics
  }, {});

  if (
    !viewerEvidence.rowText.includes(`${smokeDrawable.drawableId}: mesh ${smokeDrawable.meshId}`) ||
    !viewerEvidence.rowText.includes("10 vertices / 9 triangles") ||
    !viewerEvidence.rowText.includes("hash vhash_") ||
    !viewerEvidence.diagnosticsText.includes("Validation Diagnostics") ||
    !viewerEvidence.diagnosticsText.includes("val_editor_browser_sample_editorIncremental") ||
    !viewerEvidence.diagnosticsText.includes("checks")
  ) {
    throw new Error(`Viewer/validator evidence mismatch during ${label}: ${JSON.stringify(viewerEvidence)}.`);
  }
};

const assertSavedTopologyUvProject = async (page, label) => {
  const saved = await page.evaluate((storageKey, expected) => {
    const raw = localStorage.getItem(storageKey);
    if (raw === null) {
      return null;
    }

    const project = JSON.parse(raw);
    const meshes = readPackageJsonFile(project, "model/meshes.json")?.meshes ?? [];
    const editorState = readPackageJsonFile(project, "model/editor-state.json");
    const mesh = meshes.find((candidate) => candidate.meshId === expected.meshId);
    const operationLogEntries = String(project.operationLogJsonl ?? "")
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line));
    const firstVertexIndex = mesh?.vertexStableIds?.indexOf(expected.firstVertexId) ?? -1;
    const addedVertexIndex = mesh?.vertexStableIds?.indexOf(expected.addedVertexId) ?? -1;
    const addedTriangleIndex = mesh?.triangleStableIds?.indexOf(expected.addedTriangleId) ?? -1;

    return {
      schemaVersion: project.schemaVersion,
      packageId: project.packageSummary?.packageId ?? null,
      packageRevision: project.packageSummary?.packageRevision ?? null,
      operationTypes: operationLogEntries.map((entry) => entry.operationType),
      rejectedOperationLogged: operationLogEntries.some((entry) => entry.status === "rejected"),
      editorState,
      mesh: mesh === undefined
        ? null
        : {
            meshId: mesh.meshId,
            vertexCount: mesh.vertices.length,
            uvCount: mesh.uvs.length,
            triangleCount: mesh.triangles.length,
            triangleStableIdCount: mesh.triangleStableIds?.length ?? 0,
            topologyRevision: mesh.topologyRevision,
            addedVertexIndex,
            addedVertex: addedVertexIndex < 0 ? null : mesh.vertices[addedVertexIndex],
            addedVertexUv: addedVertexIndex < 0 ? null : mesh.uvs[addedVertexIndex],
            addedTriangleIndex,
            addedTriangle: addedTriangleIndex < 0 ? null : mesh.triangles[addedTriangleIndex],
            firstVertexUv: firstVertexIndex < 0 ? null : mesh.uvs[firstVertexIndex]
          },
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
  }, editorProjectStorageKey, {
    meshId: smokeDrawable.meshId,
    firstVertexId: existingVertices[0].vertexId,
    addedVertexId: addedVertex.vertexId,
    addedTriangleId: addedTriangle.triangleId
  });

  const expected = {
    schemaVersion: "editor-project-persistence-v1",
    packageId: "pkg_editor_browser_sample",
    packageRevision: 6,
    operationTypes: [
      "importPsdSourceAsset",
      "createDrawable",
      "generateMesh",
      "addMeshVertex",
      "addMeshTriangle",
      "moveMeshUvPoint"
    ],
    editorSelection: [existingVertices[0].vertexId],
    mesh: {
      meshId: smokeDrawable.meshId,
      vertexCount: 10,
      uvCount: 10,
      triangleCount: 9,
      triangleStableIdCount: 9,
      topologyRevision: 3,
      addedVertexIndex: 9,
      addedVertex: addedVertex.position,
      addedVertexUv: addedVertex.uv,
      addedTriangleIndex: 8,
      addedTriangle: [0, 1, 9],
      firstVertexUv: existingVertices[0].uvAfterNudge
    }
  };

  if (
    saved === null ||
    saved.schemaVersion !== expected.schemaVersion ||
    saved.packageId !== expected.packageId ||
    saved.packageRevision !== expected.packageRevision ||
    JSON.stringify(saved.operationTypes) !== JSON.stringify(expected.operationTypes) ||
    saved.rejectedOperationLogged ||
    JSON.stringify(saved.editorState?.selection ?? []) !== JSON.stringify(expected.editorSelection) ||
    saved.editorState?.activeTool !== "meshEdit" ||
    JSON.stringify(saved.mesh) !== JSON.stringify(expected.mesh) ||
    saved.generatedRuntimeArtifacts < 1 ||
    saved.generatedValidationArtifacts < 1
  ) {
    throw new Error(
      `Saved topology/UV project mismatch during ${label}: expected ${JSON.stringify(
        expected
      )} with runtime/validation artifacts, received ${JSON.stringify(saved)}.`
    );
  }
};

const assertTopologyUvStateAfterLoad = async (page) => {
  await waitForText(page, editorTestIds.packageStatus, "pkg_editor_browser_sample");
  await waitForOperationLogEntryCount(page, 6);
  await waitForText(
    page,
    editorTestIds.operationLogSummary,
    "importPsdSourceAsset, createDrawable, generateMesh, addMeshVertex, addMeshTriangle, moveMeshUvPoint"
  );
  await waitForScopedText(
    page,
    selectorScopes.legacyDrawableAuthoring,
    createDrawableRowTestId(smokeDrawable.drawableId),
    smokeDrawable.meshId
  );
  await waitForScopedText(
    page,
    selectorScopes.legacyDrawableAuthoring,
    createDrawableRowTestId(smokeDrawable.drawableId),
    "10 vertices / 9 triangles"
  );
  await waitForText(page, editorTestIds.meshCanvasStatus, smokeDrawable.meshId);
  await waitForText(page, editorTestIds.meshCanvasStatus, "10 canvas targets");
  await waitForText(page, editorTestIds.meshCanvasStatus, "1 selected vertex");
  await waitForText(page, editorTestIds.meshTopologyStatus, smokeDrawable.meshId);
  await waitForText(page, editorTestIds.meshTopologyStatus, "10 vertices / 9 triangles");
  await waitForText(page, editorTestIds.meshTopologyStatus, "Topology r3");
  await waitForTestId(page, createMeshCanvasVertexTestId(smokeDrawable.meshId, addedVertex.vertexId));
  await waitForTestId(page, createMeshTriangleRemoveButtonTestId(smokeDrawable.meshId, addedTriangle.triangleId));
};

const readTopologyUvEvidence = async (page) =>
  page.evaluate((ids) => {
    const operationLogPanel = document.querySelector(`[data-testid="${ids.operationLog}"]`);
    const terms = [...(operationLogPanel?.querySelectorAll("dt") ?? [])];
    const entryTerm = terms.find((term) => term.textContent === "Entries");

    return {
      operationStatus: document.querySelector(`[data-testid="${ids.operationStatus}"]`)?.textContent ?? "",
      topologyStatus: document.querySelector(`[data-testid="${ids.topologyStatus}"]`)?.textContent ?? "",
      previewSummary: document.querySelector(`[data-testid="${ids.previewSummary}"]`)?.textContent ?? "",
      viewerSummary: document.querySelector(`[data-testid="${ids.viewerSummary}"]`)?.textContent ?? "",
      validationDiagnostics: document.querySelector(`[data-testid="${ids.viewerDiagnostics}"]`)?.textContent ?? "",
      operationLogEntryCount: Number(entryTerm?.nextElementSibling?.textContent ?? "0")
    };
  }, {
    operationStatus: editorTestIds.operationStatus,
    topologyStatus: editorTestIds.meshTopologyStatus,
    previewSummary: editorTestIds.previewSummary,
    viewerSummary: editorTestIds.viewerRuntimeSnapshotSummary,
    viewerDiagnostics: editorTestIds.viewerRuntimeDiagnostics,
    operationLog: editorTestIds.operationLogSummary
  });

const assertTopologyActionState = async (page, testId, expected) => {
  const actual = await page.evaluate((id) => {
    const button = document.querySelector(`[data-testid="${id}"]`);

    if (!(button instanceof HTMLButtonElement)) {
      throw new Error(`Missing topology action ${id}.`);
    }

    return {
      disabled: button.disabled,
      ariaLabel: button.getAttribute("aria-label") ?? "",
      text: button.textContent?.trim() ?? ""
    };
  }, testId);

  if (
    actual.disabled !== expected.disabled ||
    !actual.ariaLabel.includes(expected.ariaIncludes)
  ) {
    throw new Error(
      `Topology action ${testId} state mismatch: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`
    );
  }
};

const selectMeshCanvasVertex = async (page, vertexId, mode) => {
  await page.evaluate((id, selectionMode) => {
    const target = document.querySelector(`[data-testid="${id}"]`);

    if (!(target instanceof Element)) {
      throw new Error(`Missing mesh canvas vertex target ${id}.`);
    }

    target.dispatchEvent(new MouseEvent("click", {
      bubbles: true,
      shiftKey: selectionMode === "add",
      ctrlKey: selectionMode === "toggle"
    }));
  }, createMeshCanvasVertexTestId(smokeDrawable.meshId, vertexId), mode);
};

const clickViewerOpenIfClosed = async (page) => {
  const isOpen = await page.evaluate((id) =>
    document.querySelector(`[data-testid="${id}"]`) !== null,
    editorTestIds.viewerRuntimePanel
  );

  if (!isOpen) {
    await clickTestId(page, editorTestIds.viewerRuntimeOpen);
  }
};

const assertNoHorizontalOverflow = async (page, label) => {
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

  if (overflow.count !== 0) {
    throw new Error(`${label} horizontal overflow was ${JSON.stringify(overflow)}; expected 0.`);
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
      { timeoutMs: 8_000 },
      testId,
      expectedText
    );
  } catch (error) {
    const actualText = await readText(page, testId).catch(() => "");
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${message}; actual ${testId} text was "${actualText.slice(0, 1000)}".`);
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
      `topology-uv-e2e: using ${browser.executable} (${browser.source}); server ${server.baseUrl} ${
        server.reused ? "reused" : "started"
      }`
    );

    launchedBrowser = await launchHeadlessBrowser({ executable: browser.executable });

    for (const viewport of topologyUvSmokeViewports) {
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

        const result = await runTopologyUvPersistenceSmoke({ page, viewport });
        console.log(`topology-uv-e2e: ${viewport.name} smoke passed`);
        console.log(
          `topology-uv-e2e: ${viewport.name} screenshot ${result.screenshot.format} base64Length=${result.screenshot.base64Length}`
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
    console.log("topology-uv-e2e: smoke passed");
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
