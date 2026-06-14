import { expect, test, type Locator, type Page } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const e2eDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixturePsdPath = path.resolve(e2eDirectory, "../../../test_data/sample_model.psd");

test("imports a fixture PSD and reflects the generated structure in the workspace", async ({
  page
}) => {
  await page.goto("/");

  await expect(page.getByText("Authoring Workspace")).toBeVisible();
  await page.getByRole("button", { name: "Import PSD" }).first().click();
  await expect(page.getByRole("dialog", { name: "Import PSD" })).toBeVisible();

  await page.getByLabel("PSD file").setInputFiles(fixturePsdPath);

  const review = page.getByTestId("psd-import-review");
  await expect(review).toBeVisible();
  await expect(review).toContainText("Planned Parts Structure");
  await expect(review).toContainText("sample_model import");
  await expect(review.getByLabel("Part Container").first()).toBeVisible();
  await expect(review.getByLabel("Drawable").first()).toBeVisible();
  await expect(review.getByLabel("Hidden Drawable").first()).toBeVisible();
  const preview = page.getByTestId("psd-import-preview");
  await expect(preview).toBeVisible();
  await expect(preview).toHaveAttribute("data-preview-ready", "true");
  await expect(preview).toHaveAttribute("data-visible-layer-count", /^[1-9]\d*$/);

  await page.getByRole("button", { name: "Import" }).click();

  const visiblePartsTree = page.locator('[data-testid="parts-tree"]:visible').first();
  await expect(page.getByRole("dialog", { name: "Import PSD" })).toBeHidden();
  await expect(visiblePartsTree).toContainText("sample_model import");
  await expect(visiblePartsTree.locator('[title*="Hidden Drawable"]').first()).toBeVisible();
  await expect(page.locator('[data-testid="parts-tree-selected-row"]:visible').first()).toContainText(
    "sample_model import"
  );
  await expect(page.locator('[data-testid="inspector-selection-kind"]:visible').first()).toHaveText(
    "Part"
  );

  const canvas = page.locator('[data-testid="canvas-renderer-surface"]:visible').first();
  const toolbar = page.locator('[data-testid="canvas-toolbar"]:visible').first();
  await expect(canvas).toBeVisible();
  await expect(toolbar).toBeVisible();
  await expect(canvas).toHaveAttribute("data-canvas-has-renderable-artwork", "true");
  await expect(canvas).toHaveAttribute("data-renderable-drawable-count", /^[1-9]\d*$/);
  await expect(canvas).toHaveAttribute("data-selected-drawable-count", /^[1-9]\d*$/);

  await page.getByRole("button", { name: "Fit Canvas" }).first().click();
  await page.getByRole("button", { name: "Fit Artwork" }).first().click();
  const zoomBefore = await canvas.getAttribute("data-zoom-percent");
  await page.getByRole("button", { name: "Zoom in" }).first().click();
  await expect(canvas).not.toHaveAttribute("data-zoom-percent", zoomBefore ?? "");
  await page.getByRole("button", { name: "1:1" }).first().click();

  const isolateSelected = page.getByRole("button", { name: "Isolate Selected" }).first();
  await expect(isolateSelected).toBeEnabled();
  await isolateSelected.click();
  await expect(isolateSelected).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Fit Artwork" }).first().click();
  await expect(canvas).toHaveAttribute("data-primary-hit-screen-x", /^-?\d/);
  await expect(canvas).toHaveAttribute("data-primary-hit-screen-y", /^-?\d/);
  const hitPoint = await canvas.evaluate((node) => ({
    x: Number(node.getAttribute("data-primary-hit-screen-x")),
    y: Number(node.getAttribute("data-primary-hit-screen-y"))
  }));
  expect(Number.isFinite(hitPoint.x)).toBe(true);
  expect(Number.isFinite(hitPoint.y)).toBe(true);
  const canvasBox = await canvas.boundingBox();
  expect(canvasBox).not.toBeNull();
  if (canvasBox === null) {
    throw new Error("Expected visible canvas bounds.");
  }

  await page.mouse.click(canvasBox.x + hitPoint.x, canvasBox.y + hitPoint.y);
  await expect(page.locator('[data-testid="inspector-selection-kind"]:visible').first()).toHaveText(
    "Drawable"
  );
  await expect(canvas).toHaveAttribute("data-selected-drawable-count", "1");
});

test("edits imported parts and drawables through the Parts Tree and Inspector", async ({
  page
}) => {
  await importFixturePsd(page);

  const canvas = page.locator('[data-testid="canvas-renderer-surface"]:visible').first();
  const drawableRows = page.locator('[data-row-kind="drawable"]:visible');
  const visibleDrawableRow = drawableRows
    .filter({ has: page.getByRole("button", { name: "Hide drawable" }) })
    .first();
  await expect(visibleDrawableRow).toBeVisible();

  await rowNameButton(visibleDrawableRow).click();
  await expect(page.locator('[data-testid="inspector-selection-kind"]:visible').first()).toHaveText(
    "Drawable"
  );

  const originalDrawableName = (await visibleInput(page, "Name").inputValue()).trim();
  const editedDrawableName = `${originalDrawableName} edited`;
  await visibleInput(page, "Name").fill(editedDrawableName);
  await visibleInput(page, "Name").press("Enter");
  await expect(visibleDrawableRow).toContainText(editedDrawableName);

  await visibleInput(page, "Opacity percent").fill("40");
  await visibleInput(page, "Opacity percent").press("Enter");
  await expect(canvas).toHaveAttribute("data-selected-drawable-opacity", "0.40");

  const renderableBeforeHide = await readRenderableCount(canvas);
  expect(renderableBeforeHide).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Hide selected drawable" }).click();
  await expect(canvas).toHaveAttribute(
    "data-renderable-drawable-count",
    String(renderableBeforeHide - 1)
  );
  await page.getByRole("button", { name: "Show selected drawable" }).click();
  await expect(canvas).toHaveAttribute(
    "data-renderable-drawable-count",
    String(renderableBeforeHide)
  );

  const clippingSource = visibleInput(page, "Clipping source");
  const firstClipValue = await clippingSource.locator("option").nth(1).getAttribute("value");
  if (firstClipValue !== null) {
    await clippingSource.selectOption(firstClipValue);
    await expect(clippingSource).toHaveValue(firstClipValue);
    await expect(canvas).toHaveAttribute("data-mask-relation-count", /^[1-9]\d*$/);
    await clippingSource.selectOption("");
    await expect(clippingSource).toHaveValue("");
  }

  const partRow = page
    .locator('[data-row-kind="part"]:visible')
    .filter({ has: page.getByRole("button", { name: "Hide part container" }) })
    .first();
  await rowNameButton(partRow).click();
  await expect(page.locator('[data-testid="inspector-selection-kind"]:visible').first()).toHaveText(
    "Part"
  );

  const originalPartName = (await visibleInput(page, "Name").inputValue()).trim();
  const editedPartName = `${originalPartName} group`;
  await visibleInput(page, "Name").fill(editedPartName);
  await visibleInput(page, "Name").press("Enter");
  await expect(partRow).toContainText(editedPartName);

  const renderableBeforePartGate = await readRenderableCount(canvas);
  expect(renderableBeforePartGate).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Hide selected part container" }).click();
  await expect(canvas).toHaveAttribute("data-renderable-drawable-count", "0");
  await page.getByRole("button", { name: "Show selected part container" }).click();
  await expect(canvas).toHaveAttribute(
    "data-renderable-drawable-count",
    String(renderableBeforePartGate)
  );
});

test("authors drawable opacity keyforms from the Parameter Bar and Inspector", async ({
  page
}) => {
  await importFixturePsd(page);

  const canvas = page.locator('[data-testid="canvas-renderer-surface"]:visible').first();
  const drawableRows = page.locator('[data-row-kind="drawable"]:visible');
  const visibleDrawableRow = drawableRows
    .filter({ has: page.getByRole("button", { name: "Hide drawable" }) })
    .first();
  await rowNameButton(visibleDrawableRow).click();
  await expect(page.locator('[data-testid="inspector-selection-kind"]:visible').first()).toHaveText(
    "Drawable"
  );

  const parameterBar = page.getByTestId("parameter-bar");
  await expect(parameterBar).toBeVisible();
  await expect(visibleInput(page, "Active parameter")).toHaveValue("param_face_angle_x");

  const binding = page.getByTestId("parameter-binding-opacity").first();
  const keyState = page.getByTestId("parameter-key-position-state");
  await expect(binding).toBeVisible();
  await expect(keyState).toHaveAttribute("aria-label", "Parameter keyform state: static");
  await expect(binding.getByLabel("Drawable opacity value")).toBeDisabled();

  await page.getByRole("button", { name: "Create end keyforms", exact: true }).click();
  await expect(page.locator('[data-testid="parameter-key-marker"][data-parameter-value="-30"]')).toBeVisible();
  await expect(page.locator('[data-testid="parameter-key-marker"][data-parameter-value="30"]')).toBeVisible();
  await expect(keyState).toHaveAttribute("aria-label", "Parameter keyform state: interpolated");

  await page.getByRole("button", { name: "Create end and center keyforms", exact: true }).click();
  await expect(keyState).toHaveAttribute("aria-label", "Parameter keyform state: keyform");
  await expect(binding.getByLabel("Drawable opacity value")).toBeEnabled();

  await binding.getByLabel("Drawable opacity value").fill("0.4");
  await binding.getByRole("button", { name: "Update", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-selected-drawable-opacity", "0.40");

  await visibleInput(page, "Parameter numeric value").fill("30");
  await expect(canvas).toHaveAttribute("data-selected-drawable-opacity", "1.00");

  await visibleInput(page, "Parameter numeric value").fill("0");
  await expect(canvas).toHaveAttribute("data-selected-drawable-opacity", "0.40");

  await binding.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(keyState).toHaveAttribute("aria-label", "Parameter keyform state: interpolated");
  await expect(canvas).toHaveAttribute("data-selected-drawable-opacity", "1.00");

  await page.getByRole("button", { name: "Add keyform at current value", exact: true }).click();
  await expect(keyState).toHaveAttribute("aria-label", "Parameter keyform state: keyform");
});

test("reorders drawable rows with Parts Tree drag and drop", async ({ page }) => {
  await importFixturePsd(page);

  const drawableRows = page.locator('[data-row-kind="drawable"]:visible');
  await expect(drawableRows.nth(1)).toBeVisible();
  const firstNameBefore = (await rowNameButton(drawableRows.nth(0)).innerText()).trim();
  const secondNameBefore = (await rowNameButton(drawableRows.nth(1)).innerText()).trim();
  expect(secondNameBefore).not.toBe(firstNameBefore);

  await drawableRows.nth(1).dragTo(drawableRows.nth(0), {
    targetPosition: { x: 8, y: 2 }
  });

  await expect(rowNameButton(drawableRows.nth(0))).toHaveText(secondNameBefore);
});

test("generates an initial mesh draft for a selected hidden Drawable and applies it", async ({
  page
}) => {
  await importFixturePsd(page);

  const canvas = page.locator('[data-testid="canvas-renderer-surface"]:visible').first();
  const drawableRows = page.locator('[data-row-kind="drawable"]:visible');
  const visibleDrawableRow = drawableRows
    .filter({ has: page.getByRole("button", { name: "Hide drawable" }) })
    .first();
  await rowNameButton(visibleDrawableRow).click();
  await expect(page.locator('[data-testid="inspector-selection-kind"]:visible').first()).toHaveText(
    "Drawable"
  );

  await page.getByRole("button", { name: "Hide selected drawable" }).click();
  await page.getByRole("button", { name: /^Mesh$/ }).first().click();

  const meshInspector = page.locator('[data-testid="mesh-tool-inspector"]:visible').first();
  const meshStatus = page.locator('[data-testid="mesh-tool-status"]:visible').first();
  const meshSource = page.locator('[data-testid="mesh-tool-source"]:visible').first();

  await expect(meshInspector).toBeVisible();
  await expect(canvas).toHaveAttribute("data-mesh-preview-drawable-visible", "true");
  await page.getByRole("button", { name: "Preview Standard mesh" }).click();
  await expect(meshStatus).toHaveText("Draft preview");
  await expect(meshSource).toHaveText("Auto outline v2.6 soft apron");
  await expect(meshInspector).toContainText("Max edge");
  await expect(meshInspector).toContainText("Min angle");
  await expect(page.locator('[data-testid="mesh-tool-backend-selector"]:visible').first()).toContainText(
    "Temporary"
  );
  const backendSelector = page.locator('[data-testid="mesh-tool-backend-selector"]:visible').first();
  await expect(backendSelector).toContainText("v6D Contour Constrainautor");
  await expect(backendSelector).toContainText("v6E Contour Poly2Tri");
  await expect(backendSelector).toContainText("v6F Custom CDT");
  await expect(backendSelector).not.toContainText("v6A Local");
  await expect(backendSelector).not.toContainText("v6B Constrainautor");
  await expect(backendSelector).not.toContainText("v6C Poly2Tri");
  await page.getByRole("button", { name: "Preview v6D Contour Constrainautor mesh backend" }).click();
  await expect(page.locator('[data-testid="mesh-tool-v6-output-kind"]:visible').first()).toContainText(
    "v6D contour Constrainautor"
  );
  await page.getByRole("button", { name: "Preview Default v2.6 mesh backend" }).click();
  await expect(meshSource).toHaveText("Auto outline v2.6 soft apron");
  await expect(canvas).toHaveAttribute("data-mesh-overlay-visible", "true");
  await expect(canvas).toHaveAttribute("data-mesh-overlay-status", "draft");
  await expect(canvas).toHaveAttribute("data-mesh-overlay-vertex-count", /^[1-9]\d*$/);
  await expect(canvas).toHaveAttribute("data-mesh-overlay-triangle-count", /^[1-9]\d*$/);

  const partRow = page
    .locator('[data-row-kind="part"]:visible')
    .filter({ has: page.getByRole("button", { name: "Hide part container" }) })
    .first();
  await rowNameButton(partRow).click();
  const meshPicker = page.locator('[data-testid="mesh-tool-drawable-picker"]:visible').first();
  await expect(meshPicker).toBeVisible();
  await expect(canvas).toHaveAttribute("data-mesh-overlay-status", "");

  const pickerButton = meshPicker.locator("button").first();
  const pickedDrawableName = (await pickerButton.locator("span").first().innerText()).trim();
  await pickerButton.click();
  await expect(meshInspector).toBeVisible();
  await expect(meshInspector).toContainText(pickedDrawableName);
  await page.getByRole("button", { name: "Preview Standard mesh" }).click();
  await expect(meshStatus).toHaveText("Draft preview");
  await expect(canvas).toHaveAttribute("data-mesh-overlay-status", "draft");

  await page.getByRole("button", { name: "Select" }).first().click();
  await expect(meshInspector).toBeHidden();
  await expect(canvas).toHaveAttribute("data-mesh-overlay-status", "");

  await page.getByRole("button", { name: /^Mesh$/ }).first().click();
  await expect(meshInspector).toBeVisible();
  await page.getByRole("button", { name: "Preview Standard mesh" }).click();
  await expect(meshStatus).toHaveText("Draft preview");
  await expect(canvas).toHaveAttribute("data-mesh-overlay-status", "draft");

  await page.getByRole("button", { name: "Apply mesh" }).click();
  await expect(meshStatus).toHaveText("Generated");
  await expect(canvas).toHaveAttribute("data-mesh-overlay-status", "committed");

  await page.getByRole("button", { name: "Regenerate mesh" }).click();
  await expect(meshStatus).toHaveText("Replacement draft");
  await expect(canvas).toHaveAttribute("data-mesh-overlay-status", "draft");
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(meshStatus).toHaveText("Generated");
  await expect(canvas).toHaveAttribute("data-mesh-overlay-status", "committed");

  await page.getByRole("button", { name: /^Show mesh overlay/ }).click();
  await expect(canvas).toHaveAttribute("data-mesh-overlay-visible", "false");
  await page.getByRole("button", { name: /^Show mesh overlay/ }).click();
  await expect(canvas).toHaveAttribute("data-mesh-overlay-visible", "true");
});

test("creates a Warp Deformer draft from a selected Drawable and reflects it in the Deformer Tree", async ({
  page
}) => {
  await importFixturePsd(page);

  const canvas = page.locator('[data-testid="canvas-renderer-surface"]:visible').first();
  await page.getByRole("button", { name: /^Rig$/ }).first().click();
  await expect(page.locator('[data-testid="rig-tool-target-picker"]:visible').first()).toBeVisible();

  const drawableRows = page.locator('[data-row-kind="drawable"]:visible');
  const visibleDrawableRow = drawableRows
    .filter({ has: page.getByRole("button", { name: "Hide drawable" }) })
    .first();
  const selectedDrawableName = (await rowNameButton(visibleDrawableRow).innerText()).trim();
  await rowNameButton(visibleDrawableRow).click();

  await expect(page.getByRole("button", { name: "Create Rotation Deformer" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create Warp Deformer" })).toBeVisible();
  await page.getByRole("button", { name: "Create Warp Deformer" }).click();
  await expect(page.locator('[data-testid="rig-tool-inspector"]:visible').first()).toContainText(
    "Draft"
  );
  await expect(visibleInput(page, "Transform columns control points")).toHaveValue("5");
  await expect(visibleInput(page, "Transform rows control points")).toHaveValue("5");
  await expect(visibleInput(page, "Bezier columns")).toHaveValue("3");
  await expect(visibleInput(page, "Bezier rows")).toHaveValue("3");
  await expect(visibleInput(page, "Bezier edit type")).toHaveValue("cubicBezierSurfaceV1");
  await expect(canvas).toHaveAttribute("data-deformer-overlay-visible", "true");
  await expect(canvas).toHaveAttribute("data-deformer-overlay-kind", "warp");
  await expect(canvas).toHaveAttribute("data-deformer-overlay-status", "draft");
  await expect(canvas).toHaveAttribute("data-deformer-overlay-transform-columns", "5");
  await expect(canvas).toHaveAttribute("data-deformer-overlay-child-drawable-count", "1");

  await page.getByRole("button", { name: "Deformers" }).click();
  await expect(page.locator('[data-testid="deformer-tree-draft-summary"]:visible').first()).toContainText(
    "Draft Warp Deformer"
  );
  await expect(page.locator('[data-testid="deformer-tree-empty"]:visible').first()).toBeVisible();
  await expect(page.getByTestId("deformer-tree-drawable-pool")).toHaveAttribute(
    "data-collapsed",
    "true"
  );
  await page.getByRole("button", { name: "Parts" }).click();
  await expect(page.locator('[data-testid="parts-tree-selected-row"]:visible').first()).toContainText(
    selectedDrawableName
  );

  await page.getByRole("button", { name: "Apply" }).click();
  await expect(canvas).toHaveAttribute("data-deformer-overlay-kind", "warp");
  await expect(canvas).toHaveAttribute("data-deformer-overlay-status", "committed");
  await expect(page.locator('[data-testid="rig-tool-inspector"]:visible').first()).toContainText(
    "Warp Deformer"
  );
  await visibleInput(page, "Name").fill(`${selectedDrawableName} Warp Edited`);
  await visibleInput(page, "Transform columns control points").fill("6");
  await visibleInput(page, "Opacity multiplier").fill("0.75");
  await page.getByRole("button", { name: "Apply Deformer Edits" }).click();
  await expect(canvas).toHaveAttribute("data-deformer-overlay-transform-columns", "6");

  await page.getByRole("button", { name: "Deformers" }).click();
  const deformerRow = page.locator('[data-row-kind="warp-deformer"]:visible').first();
  await expect(deformerRow).toContainText("Warp Edited");
  await expect(page.locator('[data-testid="deformer-tree-drawable-ref"]:visible').first()).toContainText(
    selectedDrawableName
  );
  await expect(page.getByTestId("deformer-tree-drawable-pool")).toHaveAttribute(
    "data-collapsed",
    "true"
  );
  await page.getByTestId("deformer-tree-drawable-pool-toggle").click();
  await expect(page.getByTestId("deformer-tree-drawable-pool")).toHaveAttribute(
    "data-collapsed",
    "false"
  );
  const poolRow = page.getByTestId("deformer-tree-drawable-pool-row").first();
  await expect(poolRow).toBeVisible();
  await poolRow.dragTo(deformerRow);
  await expect(page.locator('[data-testid="deformer-tree-drawable-ref"]:visible')).toHaveCount(2);
});

test("shows Inspector feedback when a stale insertion Warp draft is rejected", async ({
  page
}) => {
  await importFixturePsd(page);

  await page.getByRole("button", { name: /^Rig$/ }).first().click();

  const drawableRows = page
    .locator('[data-row-kind="drawable"]:visible')
    .filter({ has: page.getByRole("button", { name: "Hide drawable" }) });
  const firstDrawableRow = drawableRows.nth(0);
  const secondDrawableRow = drawableRows.nth(1);
  const firstDrawableName = (await rowNameButton(firstDrawableRow).innerText()).trim();
  const secondDrawableName = (await rowNameButton(secondDrawableRow).innerText()).trim();

  await rowNameButton(firstDrawableRow).click();
  await page.getByRole("button", { name: "Create Warp Deformer" }).click();
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.locator('[data-testid="rig-tool-inspector"]:visible').first()).toContainText(
    "Warp Deformer"
  );

  await rowNameButton(secondDrawableRow).click();
  await page.getByRole("button", { name: "Create Warp Deformer" }).click();
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.locator('[data-testid="rig-tool-inspector"]:visible').first()).toContainText(
    "Warp Deformer"
  );

  await page.getByRole("button", { name: "Deformers" }).click();
  const firstDrawableRef = page
    .locator('[data-testid="deformer-tree-drawable-ref"]:visible')
    .filter({ hasText: firstDrawableName })
    .first();
  const secondWarpRow = page
    .locator('[data-row-kind="warp-deformer"]:visible')
    .filter({ hasText: secondDrawableName })
    .first();

  await firstDrawableRef.click();
  await page.getByRole("button", { name: "Create Warp Deformer" }).click();
  await expect(page.locator('[data-testid="rig-tool-inspector"]:visible').first()).toContainText(
    "Draft"
  );

  await firstDrawableRef.dragTo(secondWarpRow);
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.locator('[data-testid="rig-tool-operation-feedback"]:visible').first()).toBeVisible();
});

test("reparents a committed Deformer from the Inspector without changing Parts order", async ({
  page
}) => {
  await importFixturePsd(page);

  await page.getByRole("button", { name: /^Rig$/ }).first().click();
  const partsDrawableNamesBefore = await readVisibleDrawableRowNames(page);
  const drawableRows = page
    .locator('[data-row-kind="drawable"]:visible')
    .filter({ has: page.getByRole("button", { name: "Hide drawable" }) });
  const childDrawableRow = drawableRows.nth(0);
  const parentDrawableRow = drawableRows.nth(1);
  const childDrawableName = (await rowNameButton(childDrawableRow).innerText()).trim();
  const parentDrawableName = (await rowNameButton(parentDrawableRow).innerText()).trim();
  const childDeformerName = `${childDrawableName} Warp Deformer`;
  const parentDeformerName = `${parentDrawableName} Warp Deformer`;

  await rowNameButton(childDrawableRow).click();
  await page.getByRole("button", { name: "Create Warp Deformer" }).click();
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.locator('[data-testid="rig-tool-inspector"]:visible').first()).toContainText(
    "Warp Deformer"
  );

  await rowNameButton(parentDrawableRow).click();
  await page.getByRole("button", { name: "Create Warp Deformer" }).click();
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.locator('[data-testid="rig-tool-inspector"]:visible').first()).toContainText(
    "Warp Deformer"
  );

  await page.getByRole("button", { name: "Deformers" }).click();
  const childDeformerRow = page
    .locator('[data-row-kind="warp-deformer"]:visible')
    .filter({ hasText: childDeformerName })
    .first();
  await childDeformerRow.click();
  await expect(visibleInput(page, "Name")).toHaveValue(childDeformerName);
  await visibleInput(page, "Parent deformer").selectOption({ label: parentDeformerName });
  const applyDeformerEdits = page.locator('button:has-text("Apply Deformer Edits"):visible').first();
  await expect(applyDeformerEdits).toBeVisible();
  await applyDeformerEdits.click();

  const warpRowsAfter = await page.locator('[data-row-kind="warp-deformer"]:visible').allInnerTexts();
  expect(warpRowsAfter[0]).toContain(parentDeformerName);
  expect(warpRowsAfter[1]).toContain(childDeformerName);

  await page.getByRole("button", { name: "Parts" }).click();
  await expect.poll(() => readVisibleDrawableRowNames(page)).toEqual(partsDrawableNamesBefore);
});

test("creates a Rotation Deformer from UI and inserts a parent Warp above it", async ({
  page
}) => {
  await importFixturePsd(page);

  const canvas = page.locator('[data-testid="canvas-renderer-surface"]:visible').first();
  await page.getByRole("button", { name: /^Rig$/ }).first().click();

  const drawableRows = page.locator('[data-row-kind="drawable"]:visible');
  const visibleDrawableRow = drawableRows
    .filter({ has: page.getByRole("button", { name: "Hide drawable" }) })
    .first();
  const selectedDrawableName = (await rowNameButton(visibleDrawableRow).innerText()).trim();
  await rowNameButton(visibleDrawableRow).click();

  await page.getByRole("button", { name: "Create Rotation Deformer" }).click();
  await expect(page.locator('[data-testid="rig-tool-inspector"]:visible').first()).toContainText(
    "Rotation Deformer"
  );
  await expect(canvas).toHaveAttribute("data-deformer-overlay-visible", "true");
  await expect(canvas).toHaveAttribute("data-deformer-overlay-kind", "rotation");
  await expect(canvas).toHaveAttribute("data-deformer-overlay-status", "committed");
  await expect(canvas).toHaveAttribute("data-deformer-overlay-rest-angle", "0");
  await expect(page.getByRole("button", { name: "Create Parent Rotation Deformer" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create Parent Warp Deformer" })).toBeVisible();

  await page.getByRole("button", { name: "Create Parent Warp Deformer" }).click();
  await expect(page.locator('[data-testid="rig-tool-inspector"]:visible').first()).toContainText(
    "Warp Deformer"
  );
  await expect(canvas).toHaveAttribute("data-deformer-overlay-kind", "warp");
  await expect(canvas).toHaveAttribute("data-deformer-overlay-status", "committed");

  await page.getByRole("button", { name: "Deformers" }).click();
  await expect(page.locator('[data-row-kind="warp-deformer"]:visible').first()).toBeVisible();
  await expect(page.locator('[data-row-kind="rotation-deformer"]:visible').first()).toBeVisible();
  await expect(page.locator('[data-testid="deformer-tree-drawable-ref"]:visible').first()).toContainText(
    selectedDrawableName
  );
});

async function importFixturePsd(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Import PSD" }).first().click();
  await page.getByLabel("PSD file").setInputFiles(fixturePsdPath);
  await expect(page.getByTestId("psd-import-review")).toBeVisible();
  await page
    .getByRole("dialog", { name: "Import PSD" })
    .getByRole("button", { name: "Import" })
    .click();
  await expect(page.getByRole("dialog", { name: "Import PSD" })).toBeHidden();
  await expect(page.locator('[data-testid="parts-tree"]:visible').first()).toContainText(
    "sample_model import"
  );
}

function rowNameButton(row: Locator): Locator {
  return row.locator("button").last();
}

async function readRenderableCount(canvas: Locator): Promise<number> {
  const value = await canvas.getAttribute("data-renderable-drawable-count");
  return Number(value ?? "0");
}

async function readVisibleDrawableRowNames(page: Page): Promise<readonly string[]> {
  return page.locator('[data-row-kind="drawable"]:visible').evaluateAll((rows) =>
    rows.map((row) => {
      const buttons = Array.from(row.querySelectorAll("button"));
      return buttons.at(-1)?.textContent?.trim() ?? "";
    })
  );
}

function visibleInput(page: Page, label: string): Locator {
  return page.locator(`[aria-label="${label}"]:visible`).first();
}
