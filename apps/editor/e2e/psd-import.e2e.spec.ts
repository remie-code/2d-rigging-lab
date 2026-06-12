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

  await expect(meshInspector).toBeVisible();
  await expect(canvas).toHaveAttribute("data-mesh-preview-drawable-visible", "true");
  await page.getByRole("button", { name: "Preview Standard mesh" }).click();
  await expect(meshStatus).toHaveText("Draft preview");
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
  await expect(canvas).toHaveAttribute("data-deformer-overlay-status", "draft");
  await expect(canvas).toHaveAttribute("data-deformer-overlay-transform-columns", "5");
  await expect(canvas).toHaveAttribute("data-deformer-overlay-child-drawable-count", "1");

  await page.getByRole("button", { name: "Deformers" }).click();
  await expect(page.locator('[data-testid="deformer-tree-draft-summary"]:visible').first()).toContainText(
    "Draft Warp Deformer"
  );
  await expect(page.locator('[data-testid="deformer-tree-empty"]:visible').first()).toBeVisible();
  await page.getByRole("button", { name: "Parts" }).click();
  await expect(page.locator('[data-testid="parts-tree-selected-row"]:visible').first()).toContainText(
    selectedDrawableName
  );

  await page.getByRole("button", { name: "Apply" }).click();
  await expect(canvas).toHaveAttribute("data-deformer-overlay-status", "committed");
  await expect(page.locator('[data-testid="rig-tool-inspector"]:visible').first()).toContainText(
    "Warp Deformer"
  );

  await page.getByRole("button", { name: "Deformers" }).click();
  await expect(page.locator('[data-row-kind="warp-deformer"]:visible').first()).toContainText(
    "Warp Deformer"
  );
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

function visibleInput(page: Page, label: string): Locator {
  return page.locator(`[aria-label="${label}"]:visible`).first();
}
