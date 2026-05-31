import { createPageSession } from "./page-session.mjs";
import {
  createAiTranscriptEventRowTestId,
  createDrawableRowTestId,
  createDrawableVisibilityToggleTestId,
  createPreviewParameterControlTestId,
  editorProjectStorageKey,
  editorTestIds
} from "./test-ids.mjs";
import {
  assertLayerStateAfterLoad,
  assertSavedLayerState,
  runLayerControlsWorkflow
} from "./layer-controls-smoke.mjs";
import {
  assertMeshVertexStateAfterLoad,
  assertSavedMeshVertexState,
  runMeshVertexEditWorkflow
} from "./mesh-vertex-smoke.mjs";
import {
  assertSavedSourceIntakeState,
  assertSourceIntakeStateAfterLoad,
  assertSourceIntakeStateAfterReset,
  runSplitPngSourceIntakeCompatibilitySmoke,
  runSourceIntakeWorkflow,
  sourceIntakeSmoke
} from "./source-intake-smoke.mjs";

const previewSampleParameterId = "param_preview_body_yaw";
const smokeDrawable = {
  displayName: "Wave 15 Smoke Drawable",
  drawableId: "draw_wave_15_smoke_drawable",
  meshId: "mesh_wave_15_smoke_drawable",
  bounds: {
    x: 84,
    y: 24,
    width: 28,
    height: 36
  }
};

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
    const previewEvidence = await runPreviewWorkflow(page, viewport);
    await assertInitialAiApprovalRendered(page);
    await assertHorizontalOverflow(page, `${viewport.name} initial`);
    await runAiApprovalFlow(page);
    await assertHorizontalOverflow(page, `${viewport.name} post-AI`);
    const sourceIntakeEvidence = await runSourceIntakeWorkflow({
      page,
      viewport,
      initialOperationLogEntryCount: 1
    });
    const postSourceIntakeOverflow = await readHorizontalOverflow(page, `${viewport.name} post-source-intake`);
    const drawableEvidence = await runCreateDrawableWorkflow(page, viewport, {
      expectedOperationLogEntryCount: 4,
      expectedOperationTypesText:
        "createParameter, importPsdSourceAsset, createDrawable, generateMesh"
    });
    assertNoHorizontalOverflowEvidence(postSourceIntakeOverflow);
    await assertHorizontalOverflow(page, `${viewport.name} post-drawable`);
    const meshVertexEvidence = await runMeshVertexEditWorkflow({
      page,
      viewport,
      smokeDrawable,
      initialOperationLogEntryCount: 4
    });
    await assertHorizontalOverflow(page, `${viewport.name} post-mesh-vertex`);
    const layerEvidence = await runLayerControlsWorkflow({
      page,
      viewport,
      smokeDrawable,
      initialOperationLogEntryCount: 5
    });
    await assertHorizontalOverflow(page, `${viewport.name} post-layer-controls`);
    await saveProject(page, {
      expectedOperationLogLineCount: 11,
      expectedDrawableId: smokeDrawable.drawableId
    });
    await assertSavedSourceIntakeState({ page, storageKey: editorProjectStorageKey, smokeDrawable });
    await assertSavedMeshVertexState({ page, storageKey: editorProjectStorageKey, smokeDrawable });
    await assertSavedLayerState({ page, storageKey: editorProjectStorageKey, smokeDrawable });
    await reloadProjectFromStorage(page, {
      expectedOperationLogEntryCount: 11,
      expectedOperationTypesText:
        "createParameter, importPsdSourceAsset, createDrawable, generateMesh, moveMeshVertex, setRuntimeVisibility, setDrawOrder"
    });
    await assertSourceIntakeStateAfterLoad({ page, smokeDrawable });
    await assertMeshVertexStateAfterLoad({ page, smokeDrawable });
    await assertLayerStateAfterLoad({
      page,
      smokeDrawable,
      expectedOperationLogEntryCount: 11,
      expectedOperationTypesText:
        "createParameter, importPsdSourceAsset, createDrawable, generateMesh, moveMeshVertex, setRuntimeVisibility, setDrawOrder"
    });
    await restoreLoadedTextureBackedPreview(page, smokeDrawable);
    await assertHorizontalOverflow(page, `${viewport.name} loaded`);
    await resetProject(page);
    await assertSourceIntakeStateAfterReset(page);
    await assertHorizontalOverflow(page, `${viewport.name} reset`);
    const splitPngCompatibilityEvidence = await runSplitPngSourceIntakeCompatibilitySmoke({
      page,
      viewport,
      initialOperationLogEntryCount: 0
    });
    await assertHorizontalOverflow(page, `${viewport.name} split-png-source-intake`);
    await resetProject(page);
    await assertSourceIntakeStateAfterReset(page);
    await assertHorizontalOverflow(page, `${viewport.name} final-reset`);

    return {
      viewport: viewport.name,
      previewEvidence,
      sourceIntakeEvidence,
      splitPngCompatibilityEvidence,
      drawableEvidence,
      meshVertexEvidence,
      layerEvidence
    };
  } finally {
    await page.close();
  }
};

const assertShellRendered = async (page) => {
  await waitForTestId(page, editorTestIds.parameterCreateForm);
  await waitForTestId(page, editorTestIds.parameterCreateSubmit);
  await assertTextIncludes(page, editorTestIds.packageStatus, "pkg_editor_browser_sample");
  await assertTextIncludes(page, editorTestIds.operationStatus, "No operation committed");
  await assertTextIncludes(page, editorTestIds.parameterList, "Preview Body Yaw");
  await assertTextIncludes(page, editorTestIds.parameterList, previewSampleParameterId);
};

const runPreviewWorkflow = async (page, viewport) => {
  await waitForTestId(page, editorTestIds.previewPanel);
  await waitForTestId(page, editorTestIds.previewVisual);
  await waitForTestId(page, editorTestIds.previewSummary);

  await assertPreviewPanelReachable(page, viewport);
  await assertPreviewAccessibleNames(page);
  const initialState = await readPreviewState(page);

  if (!initialState.visualPoints.includes("24,16 72,16 48,80")) {
    throw new Error(`Preview visual started from unexpected polygon points: ${initialState.visualPoints}.`);
  }

  if (!initialState.summaryText.includes("0 changes")) {
    throw new Error(`Preview summary did not start at the default diff state: ${initialState.summaryText}.`);
  }

  await setPreviewSliderValue(page, 1);
  await page.waitFor(
    "preview slider visual and summary update",
    (ids, initialPoints) => {
      const visual = document.querySelector(`[data-testid="${ids.visual}"]`);
      const summary = document.querySelector(`[data-testid="${ids.summary}"]`);
      const slider = document.querySelector(`[data-testid="${ids.slider}"]`);
      const points = visual?.querySelector("[data-drawable-id='draw_body']")?.getAttribute("points") ?? "";

      return (
        slider instanceof HTMLInputElement &&
        slider.value === "1" &&
        points.length > 0 &&
        points !== initialPoints &&
        (summary?.textContent?.includes("changes / 1 drawable") ?? false) &&
        !(summary?.textContent?.includes("0 changes") ?? false)
      );
    },
    { timeoutMs: 8_000 },
    {
      visual: editorTestIds.previewVisual,
      summary: editorTestIds.previewSummary,
      slider: createPreviewParameterControlTestId(previewSampleParameterId)
    },
    initialState.visualPoints
  );
  const changedState = await readPreviewState(page);

  await clickTestId(page, editorTestIds.previewReset);
  await page.waitFor(
    "preview reset restores default visual and summary",
    (ids, initialPoints) => {
      const visual = document.querySelector(`[data-testid="${ids.visual}"]`);
      const summary = document.querySelector(`[data-testid="${ids.summary}"]`);
      const slider = document.querySelector(`[data-testid="${ids.slider}"]`);
      const points = visual?.querySelector("[data-drawable-id='draw_body']")?.getAttribute("points") ?? "";

      return (
        slider instanceof HTMLInputElement &&
        slider.value === "0" &&
        points === initialPoints &&
        (summary?.textContent?.includes("0 changes") ?? false)
      );
    },
    { timeoutMs: 8_000 },
    {
      visual: editorTestIds.previewVisual,
      summary: editorTestIds.previewSummary,
      slider: createPreviewParameterControlTestId(previewSampleParameterId)
    },
    initialState.visualPoints
  );

  const screenshot = await page.captureScreenshot(`${viewport.name} preview smoke`);

  return {
    viewport: viewport.name,
    initialVisualPoints: initialState.visualPoints,
    changedVisualPoints: changedState.visualPoints,
    changedSummary: changedState.summaryText,
    screenshot
  };
};

const runCreateDrawableWorkflow = async (
  page,
  viewport,
  {
    expectedOperationLogEntryCount = 3,
    expectedOperationTypesText = "createParameter, createDrawable, generateMesh"
  } = {}
) => {
  await waitForTestId(page, editorTestIds.drawableAuthoringPanel);
  await waitForTestId(page, editorTestIds.drawableCreateForm);
  await waitForTestId(page, editorTestIds.drawableCreateSubmit);
  await waitForTestId(page, editorTestIds.drawableList);
  await scrollTestIdIntoView(page, editorTestIds.drawableAuthoringPanel);

  await assertDrawableAuthoringPanelReachable(page, viewport);
  await assertDrawableAuthoringAccessibleNames(page);
  await assertTextIncludes(page, editorTestIds.drawableList, "Body");
  await assertTextIncludes(page, editorTestIds.drawableList, "draw_body");

  await setCreateDrawableFormValues(page, smokeDrawable);
  await clickTestId(page, editorTestIds.drawableCreateSubmit);

  await waitForText(page, editorTestIds.drawableResult, "Drawable preset committed");
  await waitForText(page, editorTestIds.drawableList, smokeDrawable.displayName);
  await waitForText(page, createDrawableRowTestId(smokeDrawable.drawableId), smokeDrawable.drawableId);
  await waitForText(page, createDrawableRowTestId(smokeDrawable.drawableId), smokeDrawable.meshId);
  await waitForText(page, createDrawableRowTestId(smokeDrawable.drawableId), "84, 24 / 28 x 36");
  await waitForText(page, createDrawableRowTestId(smokeDrawable.drawableId), "9 vertices / 8 triangles");
  await waitForOperationLogEntryCount(page, expectedOperationLogEntryCount);
  await waitForText(page, editorTestIds.operationLogSummary, expectedOperationTypesText);
  await waitForText(page, editorTestIds.generatedEvidenceSummary, "Runtime snapshots");
  await waitForText(page, editorTestIds.generatedEvidenceSummary, "Validation reports");
  await waitForText(page, editorTestIds.previewSummary, "2 visible / 2 total");
  await waitForText(page, editorTestIds.previewSummary, "1 pattern / 1 fallback");

  await page.waitFor(
    "created drawable appears in preview visual",
    (ids, drawableId, expectedBounds) => {
      const visual = document.querySelector(`[data-testid="${ids.visual}"]`);
      const drawable = visual?.querySelector(`[data-drawable-id="${drawableId}"]`);
      const points = drawable?.getAttribute("points") ?? "";

      return (
        points.includes(`${expectedBounds.x},${expectedBounds.y}`) &&
        points.includes(`${expectedBounds.x + expectedBounds.width},${expectedBounds.y + expectedBounds.height}`)
      );
    },
    { timeoutMs: 8_000 },
    { visual: editorTestIds.previewVisual },
    smokeDrawable.drawableId,
    smokeDrawable.bounds
  );
  await assertTextureBackedPreviewDrawable(page, smokeDrawable.drawableId);

  const state = await readCreatedDrawableState(page);
  const screenshot = await page.captureScreenshot(`${viewport.name} drawable authoring smoke`);

  return {
    viewport: viewport.name,
    drawableId: state.drawableId,
    listText: state.listText,
    previewSummary: state.previewSummary,
    visualPoints: state.visualPoints,
    screenshot
  };
};

const assertPreviewPanelReachable = async (page, viewport) => {
  const metrics = await page.evaluate((ids) => {
    const panel = document.querySelector(`[data-testid="${ids.panel}"]`);
    const slider = document.querySelector(`[data-testid="${ids.slider}"]`);

    if (!(panel instanceof HTMLElement) || !(slider instanceof HTMLInputElement)) {
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
    const initialPanelRect = panel.getBoundingClientRect();
    const panelVisibleBeforeScroll = rectVisible(initialPanelRect);

    slider.scrollIntoView({ block: "center", inline: "nearest" });

    const panelRect = panel.getBoundingClientRect();
    const sliderRect = slider.getBoundingClientRect();

    return {
      panelVisibleBeforeScroll,
      panelVisible: rectVisible(panelRect),
      sliderVisible: rectVisible(sliderRect),
      panelWidth: panelRect.width,
      sliderWidth: sliderRect.width
    };
  }, {
    panel: editorTestIds.previewPanel,
    slider: createPreviewParameterControlTestId(previewSampleParameterId)
  });

  if (
    metrics === null ||
    (!viewport.isMobile && !metrics.panelVisibleBeforeScroll) ||
    !metrics.panelVisible ||
    !metrics.sliderVisible ||
    metrics.panelWidth < 1 ||
    metrics.sliderWidth < 1
  ) {
    throw new Error(
      `${viewport.name} preview panel was not reachable/usable: ${JSON.stringify(metrics)}.`
    );
  }
};

const restoreLoadedTextureBackedPreview = async (page, smokeDrawable) => {
  await clickTestId(page, createDrawableVisibilityToggleTestId(smokeDrawable.drawableId));
  await waitForText(page, editorTestIds.drawableLayerStatus, "setRuntimeVisibility committed");
  await waitForText(page, createDrawableRowTestId(smokeDrawable.drawableId), "Visible");
  await waitForText(page, editorTestIds.previewSummary, "2 visible / 2 total");
  await waitForText(page, editorTestIds.previewSummary, "1 pattern / 1 fallback");
  await assertTextureBackedPreviewDrawable(page, smokeDrawable.drawableId);
};

const assertTextureBackedPreviewDrawable = async (page, drawableId) => {
  const textureEvidence = await page.evaluate(async (ids, expected) => {
    const visual = document.querySelector(`[data-testid="${ids.visual}"]`);
    const drawable = visual?.querySelector(`[data-drawable-id="${expected.drawableId}"]`);
    const pattern = visual?.querySelector(
      `pattern[data-texture-preview-asset-id="${expected.previewAssetId}"]`
    );
    const image = pattern?.querySelector("image");
    const texturePatternCount = [
      ...(visual?.querySelectorAll('[data-texture-render="texture_pattern"]') ?? [])
    ].length;
    const dishonestPatternCount = [
      ...(visual?.querySelectorAll('[data-texture-render="texture_pattern"]') ?? [])
    ].filter((shape) => {
      const previewAssetId = shape.getAttribute("data-texture-preview-asset-id");
      const shapePattern = previewAssetId === null
        ? null
        : visual?.querySelector(`pattern[data-texture-preview-asset-id="${previewAssetId}"]`);
      const shapeImage = shapePattern?.querySelector("image");

      return shapeImage?.getAttribute("data-texture-reference-kind") !== "deterministic-data-url-v1";
    }).length;
    const href = image?.getAttribute("href") ?? null;
    const imageDecode = await decodeImageReference(href);

    return {
      render: drawable?.getAttribute("data-texture-render") ?? null,
      status: drawable?.getAttribute("data-texture-status") ?? null,
      textureId: drawable?.getAttribute("data-texture-id") ?? null,
      previewAssetId: drawable?.getAttribute("data-texture-preview-asset-id") ?? null,
      href,
      referenceKind: image?.getAttribute("data-texture-reference-kind") ?? null,
      texturePatternCount,
      dishonestPatternCount,
      imageDecode
    };

    async function decodeImageReference(src) {
      if (typeof src !== "string" || src.length === 0) {
        return {
          loaded: false,
          width: 0,
          height: 0,
          reason: "missing-src"
        };
      }

      const imageElement = new Image();
      imageElement.src = src;

      try {
        if (typeof imageElement.decode === "function") {
          await imageElement.decode();
        } else if (!imageElement.complete) {
          await new Promise((resolve, reject) => {
            imageElement.addEventListener("load", resolve, { once: true });
            imageElement.addEventListener("error", reject, { once: true });
          });
        }
      } catch (error) {
        return {
          loaded: false,
          width: imageElement.naturalWidth,
          height: imageElement.naturalHeight,
          reason: error instanceof Error ? error.name : "decode-error"
        };
      }

      return {
        loaded: imageElement.complete && imageElement.naturalWidth > 0 && imageElement.naturalHeight > 0,
        width: imageElement.naturalWidth,
        height: imageElement.naturalHeight,
        reason: null
      };
    }
  }, {
    visual: editorTestIds.previewVisual
  }, {
    drawableId,
    textureId: sourceIntakeSmoke.textureId,
    previewAssetId: sourceIntakeSmoke.texturePreviewAssetId
  });

  const expected = {
    render: "texture_pattern",
    status: "resolved",
    textureId: sourceIntakeSmoke.textureId,
    previewAssetId: sourceIntakeSmoke.texturePreviewAssetId,
    href: sourceIntakeSmoke.texturePreviewReference,
    referenceKind: "deterministic-data-url-v1",
    texturePatternCount: 1,
    dishonestPatternCount: 0,
    imageDecode: {
      loaded: true,
      width: 1,
      height: 1,
      reason: null
    }
  };

  if (JSON.stringify(textureEvidence) !== JSON.stringify(expected)) {
    throw new Error(
      `Texture-backed preview evidence mismatch: expected ${JSON.stringify(expected)}, received ${JSON.stringify(
        textureEvidence
      )}.`
    );
  }
};

const assertPreviewAccessibleNames = async (page) => {
  const names = await page.evaluate((ids) => {
    const panel = document.querySelector(`[data-testid="${ids.panel}"]`);
    const headingId = panel?.getAttribute("aria-labelledby");
    const visual = document.querySelector(`[data-testid="${ids.visual}"]`);
    const slider = document.querySelector(`[data-testid="${ids.slider}"]`);
    const reset = document.querySelector(`[data-testid="${ids.reset}"]`);

    return {
      panelName: headingId === null ? "" : document.getElementById(headingId)?.textContent ?? "",
      visualRole: visual?.getAttribute("role") ?? "",
      visualName: visual?.getAttribute("aria-label") ?? "",
      sliderName: slider?.getAttribute("aria-label") ?? "",
      resetName: reset?.textContent?.trim() ?? ""
    };
  }, {
    panel: editorTestIds.previewPanel,
    visual: editorTestIds.previewVisual,
    slider: createPreviewParameterControlTestId(previewSampleParameterId),
    reset: editorTestIds.previewReset
  });

  const expected = {
    panelName: "Preview",
    visualRole: "img",
    visualName: "Runtime preview visual, 0 texture pattern, 1 texture fallback",
    sliderName: "Preview Body Yaw",
    resetName: "Reset preview parameters"
  };

  if (JSON.stringify(names) !== JSON.stringify(expected)) {
    throw new Error(
      `Preview accessible names mismatch: expected ${JSON.stringify(expected)}, received ${JSON.stringify(names)}.`
    );
  }
};

const assertDrawableAuthoringPanelReachable = async (page, viewport) => {
  const metrics = await page.evaluate((ids) => {
    const panel = document.querySelector(`[data-testid="${ids.panel}"]`);
    const form = document.querySelector(`[data-testid="${ids.form}"]`);
    const submit = document.querySelector(`[data-testid="${ids.submit}"]`);

    if (!(panel instanceof HTMLElement) || !(form instanceof HTMLFormElement) || !(submit instanceof HTMLButtonElement)) {
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
    const initialPanelRect = panel.getBoundingClientRect();
    const panelVisibleBeforeScroll = rectVisible(initialPanelRect);

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
    panel: editorTestIds.drawableAuthoringPanel,
    form: editorTestIds.drawableCreateForm,
    submit: editorTestIds.drawableCreateSubmit
  });

  if (
    metrics === null ||
    (!viewport.isMobile && !metrics.panelVisibleBeforeScroll) ||
    !metrics.panelVisible ||
    !metrics.submitVisible ||
    metrics.panelWidth < 1 ||
    metrics.submitWidth < 1
  ) {
    throw new Error(
      `${viewport.name} drawable authoring panel was not reachable/usable: ${JSON.stringify(metrics)}.`
    );
  }
};

const assertDrawableAuthoringAccessibleNames = async (page) => {
  const names = await page.evaluate((ids) => {
    const panel = document.querySelector(`[data-testid="${ids.panel}"]`);
    const headingId = panel?.getAttribute("aria-labelledby");
    const form = document.querySelector(`[data-testid="${ids.form}"]`);
    const submit = document.querySelector(`[data-testid="${ids.submit}"]`);
    const list = document.querySelector(`[data-testid="${ids.list}"]`);
    const controlLabels = [...(form?.querySelectorAll("input, select") ?? [])].map((control) => {
      const label = control.closest("label");
      const labelText = label === null
        ? ""
        : [...label.childNodes]
            .filter((node) => node.nodeType === Node.TEXT_NODE)
            .map((node) => node.textContent ?? "")
            .join("")
            .trim();

      return {
        name: control.getAttribute("name") ?? "",
        label: labelText,
        tagName: control.tagName.toLowerCase()
      };
    });

    return {
      panelName: headingId === null ? "" : document.getElementById(headingId)?.textContent ?? "",
      formName: form?.getAttribute("aria-label") ?? "",
      submitName: submit?.textContent?.trim() ?? "",
      listName: list?.getAttribute("aria-label") ?? "",
      controlLabels
    };
  }, {
    panel: editorTestIds.drawableAuthoringPanel,
    form: editorTestIds.drawableCreateForm,
    submit: editorTestIds.drawableCreateSubmit,
    list: editorTestIds.drawableList
  });

  const expectedControlLabels = [
    { name: "displayName", label: "Display name", tagName: "input" },
    { name: "meshMethod", label: "Shape preset", tagName: "select" },
    { name: "x", label: "X", tagName: "input" },
    { name: "y", label: "Y", tagName: "input" },
    { name: "width", label: "Width", tagName: "input" },
    { name: "height", label: "Height", tagName: "input" }
  ];
  const expected = {
    panelName: "Drawable Authoring",
    formName: "Create generated drawable",
    submitName: "Create drawable",
    listName: "Drawable list",
    controlLabels: expectedControlLabels
  };

  if (JSON.stringify(names) !== JSON.stringify(expected)) {
    throw new Error(
      `Drawable authoring accessible names mismatch: expected ${JSON.stringify(expected)}, received ${JSON.stringify(names)}.`
    );
  }
};

const readPreviewState = async (page) =>
  page.evaluate((ids) => {
    const visual = document.querySelector(`[data-testid="${ids.visual}"]`);
    const summary = document.querySelector(`[data-testid="${ids.summary}"]`);
    const slider = document.querySelector(`[data-testid="${ids.slider}"]`);
    const reset = document.querySelector(`[data-testid="${ids.reset}"]`);
    const drawable = visual?.querySelector("[data-drawable-id='draw_body']");

    if (!(slider instanceof HTMLInputElement) || !(reset instanceof HTMLButtonElement)) {
      throw new Error("Preview slider or reset control was missing.");
    }

    return {
      visualPoints: drawable?.getAttribute("points") ?? "",
      summaryText: summary?.textContent ?? "",
      sliderValue: slider.value,
      resetDisabled: reset.disabled
    };
  }, {
    visual: editorTestIds.previewVisual,
    summary: editorTestIds.previewSummary,
    slider: createPreviewParameterControlTestId(previewSampleParameterId),
    reset: editorTestIds.previewReset
  });

const setPreviewSliderValue = async (page, value) => {
  await page.evaluate((ids, nextValue) => {
    const input = document.querySelector(`[data-testid="${ids.slider}"]`);

    if (!(input instanceof HTMLInputElement)) {
      throw new Error("Preview slider was missing.");
    }

    input.value = String(nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, {
    slider: createPreviewParameterControlTestId(previewSampleParameterId)
  }, value);
};

const setCreateDrawableFormValues = async (page, drawable) => {
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
  }, drawable);
};

const readCreatedDrawableState = async (page) =>
  page.evaluate((ids, drawableId) => {
    const list = document.querySelector(`[data-testid="${ids.list}"]`);
    const row = document.querySelector(`[data-testid="${ids.row}"]`);
    const visual = document.querySelector(`[data-testid="${ids.visual}"]`);
    const summary = document.querySelector(`[data-testid="${ids.summary}"]`);
    const drawable = visual?.querySelector(`[data-drawable-id="${drawableId}"]`);

    return {
      drawableId,
      listText: row?.textContent ?? list?.textContent ?? "",
      previewSummary: summary?.textContent ?? "",
      visualPoints: drawable?.getAttribute("points") ?? ""
    };
  }, {
    list: editorTestIds.drawableList,
    row: createDrawableRowTestId(smokeDrawable.drawableId),
    visual: editorTestIds.previewVisual,
    summary: editorTestIds.previewSummary
  }, smokeDrawable.drawableId);

const assertCreatedDrawableRestoredAfterLoad = async (page) => {
  await waitForText(page, editorTestIds.drawableResult, "Drawable preset ready");
  await waitForText(page, editorTestIds.drawableList, smokeDrawable.displayName);
  await waitForText(page, createDrawableRowTestId(smokeDrawable.drawableId), smokeDrawable.meshId);
  await waitForText(page, createDrawableRowTestId(smokeDrawable.drawableId), "84, 24 / 28 x 36");
  await waitForText(page, createDrawableRowTestId(smokeDrawable.drawableId), "9 vertices / 8 triangles");
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

const saveProject = async (page, options) => {
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
        : [],
      generatedArtifactPathCount: Array.isArray(project.generatedArtifactPaths)
        ? project.generatedArtifactPaths.length
        : 0,
      packageText: Array.isArray(project.packageFileSet)
        ? project.packageFileSet.map((entry) => entry.text).join("\n")
        : ""
    };
  }, editorProjectStorageKey);

  if (
    saved === null ||
    saved.schemaVersion !== "editor-project-persistence-v1" ||
    saved.operationLogLineCount < options.expectedOperationLogLineCount ||
    saved.packageFileCount < 1 ||
    saved.generatedArtifactPathCount < 1 ||
    !saved.packageText.includes(options.expectedDrawableId) ||
    !saved.packageText.includes(smokeDrawable.meshId) ||
    !saved.packageText.includes(smokeDrawable.displayName) ||
    saved.aiCommandTranscriptSchemaVersion !== "ai-command-transcript-v1" ||
    saved.aiCommandTranscriptEntryCount < 3 ||
    !saved.aiCommandTranscriptEntryIds.includes("cmd_editor_ai_dry_run_create_parameter_r0_1") ||
    !saved.aiCommandTranscriptEntryIds.includes("cmd_editor_ai_commit_create_parameter_r0_1") ||
    !saved.aiCommandTranscriptOperationIds.includes("op_editor_ai_create_parameter_r0_1")
  ) {
    throw new Error("Save to browser storage did not persist a valid editor project.");
  }
};

const reloadProjectFromStorage = async (page, {
  expectedOperationLogEntryCount = 9,
  expectedOperationTypesText = "createParameter, createDrawable, generateMesh, setRuntimeVisibility, setDrawOrder"
} = {}) => {
  await page.reload();
  await waitForTestId(page, editorTestIds.shell);
  await assertTextIncludes(page, editorTestIds.parameterList, "Preview Body Yaw");
  await assertTextIncludes(page, editorTestIds.previewSummary, "0 changes");
  await assertInitialAiApprovalRendered(page);
  await clickTestId(page, editorTestIds.projectPersistenceLoad);
  await waitForText(page, editorTestIds.projectPersistenceStatus, "Loaded");
  await waitForText(page, editorTestIds.parameterList, "Preview Body Yaw");
  await waitForText(page, editorTestIds.parameterList, "AI Approval Smile");
  await waitForText(page, editorTestIds.previewSummary, "0 changes");
  await assertCreatedDrawableRestoredAfterLoad(page);
  await waitForOperationLogEntryCount(page, expectedOperationLogEntryCount);
  await waitForText(page, editorTestIds.operationLogSummary, expectedOperationTypesText);
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
  await waitForText(page, editorTestIds.parameterList, "Preview Body Yaw");
  await waitForText(page, editorTestIds.previewSummary, "0 changes");
  await waitForText(page, editorTestIds.previewSummary, "1 visible / 1 total");
  await assertTextIncludes(page, editorTestIds.drawableList, "Body");
  await assertTextExcludes(page, editorTestIds.drawableList, smokeDrawable.displayName);
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
  assertNoHorizontalOverflowEvidence(await readHorizontalOverflow(page, label));
};

const readHorizontalOverflow = async (page, label) => {
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

  return { label, ...overflow };
};

const assertNoHorizontalOverflowEvidence = (overflow) => {
  if (overflow.count !== 0) {
    throw new Error(`${overflow.label} horizontal overflow was ${JSON.stringify(overflow)}; expected 0.`);
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

const scrollTestIdIntoView = async (page, testId) => {
  await page.evaluate((id) => {
    const element = document.querySelector(`[data-testid="${id}"]`);

    if (!(element instanceof HTMLElement)) {
      throw new Error(`Missing element for test id ${id}.`);
    }

    element.scrollIntoView({ block: "center", inline: "nearest" });
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

const assertTextExcludes = async (page, testId, excludedText) => {
  const text = await page.evaluate(
    (id) => document.querySelector(`[data-testid="${id}"]`)?.textContent ?? null,
    testId
  );

  if (text === null || text.includes(excludedText)) {
    throw new Error(`Expected ${testId} to exclude "${excludedText}", received "${text}".`);
  }
};
