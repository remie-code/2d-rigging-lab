import { expect, test } from "@playwright/test";
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
  await expect(page.getByTestId("psd-import-preview-placeholder")).toBeVisible();

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
