import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { locateBrowserExecutable } from "./browser-discovery.mjs";
import { launchHeadlessBrowser } from "./chrome-launcher.mjs";
import { createPageSession } from "./page-session.mjs";
import {
  createDrawableRowTestId,
  createMeshCanvasNudgeButtonTestId,
  createMeshCanvasVertexTestId,
  createViewerRuntimeMeshEvidenceRowTestId,
  editorProjectStorageKey,
  editorTestIds
} from "./test-ids.mjs";
import {
  runSourceIntakeWorkflow,
  sourceIntakeSmoke
} from "./source-intake-smoke.mjs";
import { startOrReuseEditorServer } from "./vite-server.mjs";

export const canvasMeshEditSmokeViewports = [
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
  displayName: "Wave 29 Canvas Mesh",
  drawableId: "draw_wave_29_canvas_mesh",
  meshId: "mesh_wave_29_canvas_mesh",
  bounds: sourceIntakeSmoke.bounds
};

const selectedVertices = [
  {
    vertexId: "vtx_wave_29_canvas_mesh_0_0",
    initialPosition: { x: 84, y: 24 },
    nudgedPosition: { x: 85, y: 24 }
  },
  {
    vertexId: "vtx_wave_29_canvas_mesh_0_1",
    initialPosition: { x: 98, y: 24 },
    nudgedPosition: { x: 99, y: 24 }
  }
];

export const runCanvasMeshEditPersistenceSmoke = async ({ page, viewport }) => {
  await runSourceIntakeWorkflow({
    page,
    viewport,
    initialOperationLogEntryCount: 0
  });
  await assertNoHorizontalOverflow(page, `${viewport.name} wave29 post-source-intake`);

  await createCanvasMeshDrawable(page);
  await assertCreatedCanvasMeshDrawable(page);
  await assertCanvasMeshEditorReachable(page, viewport);
  await assertCanvasMeshEditorAccessibleBasics(page);
  await assertNoHorizontalOverflow(page, `${viewport.name} wave29 drawable-created`);

  const initialEvidence = await readCanvasMeshEvidence(page);
  assertVertexEvidence(initialEvidence.vertexStates, selectedVertices, "initial", {
    selected: false,
    positions: selectedVertices.map((vertex) => vertex.initialPosition)
  });

  await selectMeshCanvasVertex(page, selectedVertices[0].vertexId, "replace");
  await waitForText(page, editorTestIds.meshCanvasStatus, "1 selected vertex");
  await selectMeshCanvasVertex(page, selectedVertices[1].vertexId, "add");
  await waitForText(page, editorTestIds.meshCanvasStatus, "2 selected vertices");
  await assertCanvasSelectedVertices(page, selectedVertices.map((vertex) => vertex.vertexId));
  await assertCanvasNudgeButtonEnabled(page, "right");

  await clickTestId(page, createMeshCanvasNudgeButtonTestId("right"));
  await waitForText(page, editorTestIds.operationStatus, "moveMeshVertex committed");
  await waitForOperationLogEntryCount(page, 4);
  await waitForText(page, editorTestIds.operationLogSummary, "moveMeshVertex");
  await assertCanvasMovedVertices(page);
  await selectMeshCanvasVertex(page, selectedVertices[0].vertexId, "replace");
  await waitForText(page, editorTestIds.meshCanvasStatus, "1 selected vertex");
  await selectMeshCanvasVertex(page, selectedVertices[1].vertexId, "add");
  await waitForText(page, editorTestIds.meshCanvasStatus, "2 selected vertices");
  await assertCanvasSelectedVertices(page, selectedVertices.map((vertex) => vertex.vertexId));
  await assertPreviewMeshEvidence(page, "before save");
  await assertNoHorizontalOverflow(page, `${viewport.name} wave29 post-canvas-nudge`);

  await clickTestId(page, editorTestIds.viewerRuntimeOpen);
  await assertViewerMeshEvidence(page, "before save");

  await clickTestId(page, editorTestIds.projectPersistenceSave);
  await waitForText(page, editorTestIds.projectPersistenceStatus, "Saved");
  await assertSavedCanvasMeshProject(page, "after save");

  await page.reload();
  await waitForTestId(page, editorTestIds.shell);
  await clickTestId(page, editorTestIds.projectPersistenceLoad);
  await waitForText(page, editorTestIds.projectPersistenceStatus, "Loaded");
  await assertCanvasMeshStateAfterLoad(page);
  await assertSavedCanvasMeshProject(page, "after load");
  await assertPreviewMeshEvidence(page, "after load");
  await clickTestId(page, editorTestIds.viewerRuntimeOpen);
  await assertViewerMeshEvidence(page, "after load");
  await assertNoHorizontalOverflow(page, `${viewport.name} wave29 loaded`);

  const postLoadEvidence = await readCanvasMeshEvidence(page);
  const screenshot = await page.captureScreenshot(`${viewport.name} wave29 canvas mesh edit smoke`);

  return {
    viewport: viewport.name,
    drawableId: smokeDrawable.drawableId,
    meshId: smokeDrawable.meshId,
    selectedVertexIds: selectedVertices.map((vertex) => vertex.vertexId),
    initialEvidence,
    postLoadEvidence,
    screenshot
  };
};

const createCanvasMeshDrawable = async (page) => {
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

const assertCreatedCanvasMeshDrawable = async (page) => {
  const rowId = createDrawableRowTestId(smokeDrawable.drawableId);

  await waitForText(page, editorTestIds.drawableResult, "Drawable preset committed");
  await waitForText(page, rowId, smokeDrawable.displayName);
  await waitForText(page, rowId, smokeDrawable.drawableId);
  await waitForText(page, rowId, smokeDrawable.meshId);
  await waitForText(page, rowId, "84, 24 / 28 x 36");
  await waitForText(page, rowId, "9 vertices / 8 triangles");
  await waitForOperationLogEntryCount(page, 3);
  await waitForText(page, editorTestIds.operationLogSummary, "importPsdSourceAsset, createDrawable, generateMesh");
  await waitForText(page, editorTestIds.previewSummary, "2 visible / 2 total");
  await waitForText(page, editorTestIds.previewSummary, "1 pattern / 1 fallback");
  await waitForText(page, editorTestIds.meshCanvasStatus, smokeDrawable.meshId);
  await waitForText(page, editorTestIds.meshCanvasStatus, "9 canvas targets");
  await waitForText(page, editorTestIds.meshCanvasStatus, "0 selected vertices");

  for (const vertex of selectedVertices) {
    await waitForTestId(page, createMeshCanvasVertexTestId(smokeDrawable.meshId, vertex.vertexId));
  }
};

const assertCanvasMeshEditorReachable = async (page, viewport) => {
  const metrics = await page.evaluate((ids) => {
    const editor = document.querySelector(`[data-testid="${ids.editor}"]`);
    const surface = document.querySelector(`[data-testid="${ids.surface}"]`);
    const status = document.querySelector(`[data-testid="${ids.status}"]`);
    const nudge = document.querySelector(`[data-testid="${ids.nudge}"]`);

    if (
      !(editor instanceof HTMLElement) ||
      !(surface instanceof SVGSVGElement) ||
      !(status instanceof HTMLElement) ||
      !(nudge instanceof HTMLButtonElement)
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

    status.scrollIntoView({ block: "center", inline: "nearest" });
    const statusRect = status.getBoundingClientRect();
    nudge.scrollIntoView({ block: "center", inline: "nearest" });
    const editorRect = editor.getBoundingClientRect();
    const surfaceRect = surface.getBoundingClientRect();
    const nudgeRect = nudge.getBoundingClientRect();

    return {
      editorVisible: rectVisible(editorRect),
      surfaceVisible: rectVisible(surfaceRect),
      statusReachable: rectVisible(statusRect),
      nudgeVisible: rectVisible(nudgeRect),
      editorWidth: editorRect.width,
      surfaceWidth: surfaceRect.width,
      nudgeWidth: nudgeRect.width
    };
  }, {
    editor: editorTestIds.meshCanvasEditor,
    surface: editorTestIds.meshCanvasSurface,
    status: editorTestIds.meshCanvasStatus,
    nudge: createMeshCanvasNudgeButtonTestId("right")
  });

  if (
    metrics === null ||
    !metrics.editorVisible ||
    !metrics.surfaceVisible ||
    !metrics.statusReachable ||
    !metrics.nudgeVisible ||
    metrics.editorWidth < 1 ||
    metrics.surfaceWidth < 1 ||
    metrics.nudgeWidth < 1
  ) {
    throw new Error(`${viewport.name} mesh canvas editor was not reachable: ${JSON.stringify(metrics)}.`);
  }
};

const assertCanvasMeshEditorAccessibleBasics = async (page) => {
  const names = await page.evaluate((ids) => {
    const editor = document.querySelector(`[data-testid="${ids.editor}"]`);
    const headingId = editor?.getAttribute("aria-labelledby");
    const status = document.querySelector(`[data-testid="${ids.status}"]`);
    const surface = document.querySelector(`[data-testid="${ids.surface}"]`);
    const firstVertex = document.querySelector(`[data-testid="${ids.firstVertex}"]`);
    const rightNudge = document.querySelector(`[data-testid="${ids.rightNudge}"]`);

    if (!(rightNudge instanceof HTMLButtonElement)) {
      throw new Error("Canvas right nudge button was missing.");
    }

    return {
      editorName: headingId === null ? "" : document.getElementById(headingId)?.textContent ?? "",
      statusRole: status?.getAttribute("role") ?? "",
      statusName: status?.getAttribute("aria-label") ?? "",
      surfaceRole: surface?.getAttribute("role") ?? "",
      surfaceName: surface?.getAttribute("aria-label") ?? "",
      firstVertexRole: firstVertex?.getAttribute("role") ?? "",
      firstVertexName: firstVertex?.getAttribute("aria-label") ?? "",
      rightNudgeName: rightNudge.getAttribute("aria-label") ?? "",
      rightNudgeDisabled: rightNudge.disabled
    };
  }, {
    editor: editorTestIds.meshCanvasEditor,
    status: editorTestIds.meshCanvasStatus,
    surface: editorTestIds.meshCanvasSurface,
    firstVertex: createMeshCanvasVertexTestId(smokeDrawable.meshId, selectedVertices[0].vertexId),
    rightNudge: createMeshCanvasNudgeButtonTestId("right")
  });
  const expected = {
    editorName: "Mesh Canvas",
    statusRole: "status",
    statusName: "Mesh canvas selection status",
    surfaceRole: "img",
    surfaceName: "Mesh vertex selection canvas",
    firstVertexRole: "button",
    rightNudgeName: "Nudge selected mesh vertices right",
    rightNudgeDisabled: true
  };

  if (
    names.editorName !== expected.editorName ||
    names.statusRole !== expected.statusRole ||
    names.statusName !== expected.statusName ||
    names.surfaceRole !== expected.surfaceRole ||
    names.surfaceName !== expected.surfaceName ||
    names.firstVertexRole !== expected.firstVertexRole ||
    !names.firstVertexName.includes(selectedVertices[0].vertexId) ||
    !names.firstVertexName.includes("Not selected") ||
    names.rightNudgeName !== expected.rightNudgeName ||
    names.rightNudgeDisabled !== expected.rightNudgeDisabled
  ) {
    throw new Error(
      `Canvas mesh accessible basics mismatch: expected ${JSON.stringify(expected)}, received ${JSON.stringify(names)}.`
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

const assertCanvasSelectedVertices = async (page, expectedVertexIds) => {
  await page.waitFor(
    "canvas selected vertex state",
    (meshId, expected) =>
      expected.every((id) => {
        const target = document.querySelector(`[data-testid="meshCanvas.vertex.${meshId}.${id}"]`);
        return target?.getAttribute("data-selected") === "true";
      }),
    { timeoutMs: 8_000 },
    smokeDrawable.meshId,
    expectedVertexIds
  );
};

const assertCanvasNudgeButtonEnabled = async (page, direction) => {
  const state = await page.evaluate((id) => {
    const button = document.querySelector(`[data-testid="${id}"]`);

    if (!(button instanceof HTMLButtonElement)) {
      throw new Error(`Missing mesh canvas nudge button ${id}.`);
    }

    return {
      text: button.textContent?.trim() ?? "",
      ariaLabel: button.getAttribute("aria-label") ?? "",
      disabled: button.disabled
    };
  }, createMeshCanvasNudgeButtonTestId(direction));
  const expected = {
    text: "+X",
    ariaLabel: "Nudge selected mesh vertices right",
    disabled: false
  };

  if (JSON.stringify(state) !== JSON.stringify(expected)) {
    throw new Error(`Canvas nudge button mismatch: expected ${JSON.stringify(expected)}, received ${JSON.stringify(state)}.`);
  }
};

const assertCanvasMovedVertices = async (page) => {
  await page.waitFor(
    "canvas moved vertex positions",
    (meshId, expected) => {
      for (const vertex of expected) {
        const target = document.querySelector(`[data-testid="meshCanvas.vertex.${meshId}.${vertex.vertexId}"]`);
        const x = Number(target?.getAttribute("cx"));
        const y = Number(target?.getAttribute("cy"));
        if (
          x !== vertex.nudgedPosition.x ||
          y !== vertex.nudgedPosition.y
        ) {
          return false;
        }
      }
      return true;
    },
    { timeoutMs: 8_000 },
    smokeDrawable.meshId,
    selectedVertices
  );
};

const assertSavedCanvasMeshProject = async (page, label) => {
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
    const moveEntry = operationLogEntries.find(
      (entry) =>
        entry.operationType === "moveMeshVertex" &&
        Array.isArray(entry.targetIds) &&
        expected.selectedVertexIds.every((vertexId) => entry.targetIds.includes(vertexId))
    );

    return {
      schemaVersion: project.schemaVersion,
      packageId: project.packageSummary?.packageId ?? null,
      packageRevision: project.packageSummary?.packageRevision ?? null,
      operationTypes: operationLogEntries.map((entry) => entry.operationType),
      moveTargetIds: moveEntry?.targetIds ?? [],
      moveVertexDeltas: moveEntry?.payload?.payload?.vertexDeltas ?? null,
      editorState,
      vertices: expected.selectedVertexIds.map((vertexId) => {
        const vertexIndex = mesh?.vertexStableIds?.indexOf(vertexId) ?? -1;
        return {
          vertexId,
          vertexIndex,
          position: vertexIndex < 0 ? null : mesh?.vertices?.[vertexIndex] ?? null
        };
      }),
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
    selectedVertexIds: selectedVertices.map((vertex) => vertex.vertexId)
  });
  const expected = {
    schemaVersion: "editor-project-persistence-v1",
    packageId: "pkg_editor_browser_sample",
    packageRevision: 4,
    operationTypes: ["importPsdSourceAsset", "createDrawable", "generateMesh", "moveMeshVertex"],
    editorState: {
      schemaVersion: "editor-state-v1",
      selection: selectedVertices.map((vertex) => vertex.vertexId),
      lockedIds: [],
      editorHiddenIds: [],
      activeTool: "meshEdit"
    },
    vertices: selectedVertices.map((vertex, index) => ({
      vertexId: vertex.vertexId,
      vertexIndex: index,
      position: vertex.nudgedPosition
    }))
  };

  if (
    saved === null ||
    saved.schemaVersion !== expected.schemaVersion ||
    saved.packageId !== expected.packageId ||
    saved.packageRevision !== expected.packageRevision ||
    JSON.stringify(saved.operationTypes) !== JSON.stringify(expected.operationTypes) ||
    !saved.moveTargetIds.includes(smokeDrawable.meshId) ||
    !selectedVertices.every((vertex) => saved.moveTargetIds.includes(vertex.vertexId)) ||
    !Array.isArray(saved.moveVertexDeltas) ||
    saved.moveVertexDeltas.length !== selectedVertices.length ||
    !isSameEditorState(saved.editorState, expected.editorState) ||
    JSON.stringify(saved.vertices) !== JSON.stringify(expected.vertices) ||
    saved.generatedRuntimeArtifacts < 1 ||
    saved.generatedValidationArtifacts < 1
  ) {
    throw new Error(
      `Saved canvas mesh project mismatch during ${label}: expected ${JSON.stringify(
        expected
      )} with runtime/validation artifacts, received ${JSON.stringify(saved)}.`
    );
  }
};

const isSameEditorState = (actual, expected) =>
  actual?.schemaVersion === expected.schemaVersion &&
  actual?.activeTool === expected.activeTool &&
  JSON.stringify(actual?.selection ?? []) === JSON.stringify(expected.selection) &&
  JSON.stringify(actual?.lockedIds ?? []) === JSON.stringify(expected.lockedIds) &&
  JSON.stringify(actual?.editorHiddenIds ?? []) === JSON.stringify(expected.editorHiddenIds);

const assertCanvasMeshStateAfterLoad = async (page) => {
  await waitForText(page, editorTestIds.packageStatus, "pkg_editor_browser_sample");
  await waitForOperationLogEntryCount(page, 4);
  await waitForText(page, editorTestIds.operationLogSummary, "importPsdSourceAsset, createDrawable, generateMesh, moveMeshVertex");
  await waitForText(page, createDrawableRowTestId(smokeDrawable.drawableId), smokeDrawable.meshId);
  await waitForText(page, editorTestIds.meshCanvasStatus, smokeDrawable.meshId);
  await waitForText(page, editorTestIds.meshCanvasStatus, "2 selected vertices");
  await assertCanvasMovedVertices(page);
  await assertCanvasSelectedVertices(page, selectedVertices.map((vertex) => vertex.vertexId));
};

const assertPreviewMeshEvidence = async (page, label) => {
  await waitForText(page, editorTestIds.previewSummary, "2 visible / 2 total");
  await waitForText(page, editorTestIds.previewSummary, "topology summaries");
  await assertPreviewTargetDrawableMovedGeometry(page, label);

  const text = await readText(page, editorTestIds.previewSummary);
  if (!text.includes("drawable mesh evidence") || !text.includes("moved vertices")) {
    throw new Error(`Preview mesh evidence missing during ${label}: ${text}.`);
  }
};

const assertPreviewTargetDrawableMovedGeometry = async (page, label) => {
  const geometry = await page.evaluate((ids, expected) => {
    const visual = document.querySelector(`[data-testid="${ids.visual}"]`);
    const drawable = visual?.querySelector(`[data-drawable-id="${expected.drawableId}"]`);

    return {
      points: drawable?.getAttribute("points") ?? "",
      textureId: drawable?.getAttribute("data-texture-id") ?? null,
      textureRender: drawable?.getAttribute("data-texture-render") ?? null,
      runtimeVisible: drawable?.getAttribute("data-runtime-visible") ?? null
    };
  }, {
    visual: editorTestIds.previewVisual
  }, {
    drawableId: smokeDrawable.drawableId
  });
  const movedPoints = selectedVertices.map((vertex) => `${vertex.nudgedPosition.x},${vertex.nudgedPosition.y}`);
  const staleInitialPoints = selectedVertices.map((vertex) => `${vertex.initialPosition.x},${vertex.initialPosition.y}`);

  if (
    !movedPoints.every((point) => geometry.points.includes(point)) ||
    staleInitialPoints.some((point) => geometry.points.includes(point)) ||
    geometry.textureId !== sourceIntakeSmoke.textureId ||
    geometry.textureRender !== "texture_pattern" ||
    geometry.runtimeVisible !== "true"
  ) {
    throw new Error(
      `Preview target drawable moved geometry mismatch during ${label}: expected moved points ${movedPoints.join(
        ", "
      )} without initial points ${staleInitialPoints.join(", ")}, received ${JSON.stringify(geometry)}.`
    );
  }
};

const assertViewerMeshEvidence = async (page, label) => {
  await waitForTestId(page, editorTestIds.viewerRuntimePanel);
  await waitForText(page, editorTestIds.viewerRuntimeSnapshotSummary, "Mesh Evidence");
  await waitForTestId(page, createViewerRuntimeMeshEvidenceRowTestId(smokeDrawable.drawableId));
  await waitForText(page, editorTestIds.viewerRuntimeDiagnostics, "Validation Diagnostics");
  await waitForText(page, editorTestIds.viewerRuntimeDiagnostics, "checks");

  const rowText = await readText(page, createViewerRuntimeMeshEvidenceRowTestId(smokeDrawable.drawableId));
  if (
    !rowText.includes(`${smokeDrawable.drawableId}: mesh ${smokeDrawable.meshId}`) ||
    !rowText.includes("9 vertices /") ||
    !rowText.includes("selected None") ||
    !rowText.includes("moved None") ||
    !rowText.includes("hash vhash_")
  ) {
    throw new Error(`Viewer target mesh evidence mismatch during ${label}: ${rowText}.`);
  }
};

const readCanvasMeshEvidence = async (page) =>
  page.evaluate((ids, expected) => {
    const status = document.querySelector(`[data-testid="${ids.status}"]`);
    const preview = document.querySelector(`[data-testid="${ids.preview}"]`);
    const viewer = document.querySelector(`[data-testid="${ids.viewer}"]`);

    return {
      statusText: status?.textContent ?? "",
      previewText: preview?.textContent ?? "",
      viewerText: viewer?.textContent ?? "",
      vertexStates: expected.selectedVertices.map((vertex) => {
        const target = document.querySelector(`[data-testid="meshCanvas.vertex.${expected.meshId}.${vertex.vertexId}"]`);
        return {
          vertexId: vertex.vertexId,
          selected: target?.getAttribute("data-selected") === "true",
          editable: target?.getAttribute("data-editable") === "true",
          x: Number(target?.getAttribute("cx")),
          y: Number(target?.getAttribute("cy")),
          ariaLabel: target?.getAttribute("aria-label") ?? ""
        };
      })
    };
  }, {
    status: editorTestIds.meshCanvasStatus,
    preview: editorTestIds.previewSummary,
    viewer: editorTestIds.viewerRuntimeSnapshotSummary
  }, {
    selectedVertices,
    meshId: smokeDrawable.meshId
  });

const assertVertexEvidence = (states, vertices, label, expected) => {
  const normalized = states.map((state) => ({
    vertexId: state.vertexId,
    selected: state.selected,
    editable: state.editable,
    position: { x: state.x, y: state.y }
  }));
  const expectedStates = vertices.map((vertex, index) => ({
    vertexId: vertex.vertexId,
    selected: expected.selected,
    editable: true,
    position: expected.positions[index]
  }));

  if (JSON.stringify(normalized) !== JSON.stringify(expectedStates)) {
    throw new Error(
      `Canvas vertex evidence mismatch during ${label}: expected ${JSON.stringify(expectedStates)}, received ${JSON.stringify(normalized)}.`
    );
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
      `canvas-mesh-edit-e2e: using ${browser.executable} (${browser.source}); server ${server.baseUrl} ${
        server.reused ? "reused" : "started"
      }`
    );

    launchedBrowser = await launchHeadlessBrowser({ executable: browser.executable });

    for (const viewport of canvasMeshEditSmokeViewports) {
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

        const result = await runCanvasMeshEditPersistenceSmoke({ page, viewport });
        console.log(`canvas-mesh-edit-e2e: ${viewport.name} smoke passed`);
        console.log(
          `canvas-mesh-edit-e2e: ${viewport.name} screenshot ${result.screenshot.format} base64Length=${result.screenshot.base64Length}`
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
    console.log("canvas-mesh-edit-e2e: smoke passed");
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  }
}
