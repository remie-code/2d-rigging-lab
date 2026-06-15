import { expect, test, type Locator, type Page } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const e2eDirectory = path.dirname(fileURLToPath(import.meta.url));
const fixturePsdPath = path.resolve(e2eDirectory, "../../../test_data/sample_model.psd");

test("saves a portable project bundle and restores authored mesh, deformers, keyforms, and render state", async ({
  page
}, testInfo) => {
  await importFixturePsd(page);

  const canvas = page.locator('[data-testid="canvas-renderer-surface"]:visible').first();
  const visibleDrawableRow = page
    .locator('[data-row-kind="drawable"]:visible')
    .filter({ has: page.getByRole("button", { name: "Hide drawable" }) })
    .first();
  const selectedDrawableName = (await rowNameButton(visibleDrawableRow).innerText()).trim();

  await rowNameButton(visibleDrawableRow).click();
  await expect(page.locator('[data-testid="inspector-selection-kind"]:visible').first()).toHaveText(
    "Drawable"
  );

  await page.getByRole("button", { name: /^Mesh$/ }).first().click();
  await expect(page.locator('[data-testid="mesh-tool-inspector"]:visible').first()).toBeVisible();
  await page.getByRole("button", { name: "Preview Standard mesh" }).click();
  await expect(canvas).toHaveAttribute("data-mesh-overlay-status", "draft");
  await page.getByRole("button", { name: "Apply mesh" }).click();
  await expect(page.locator('[data-testid="mesh-tool-status"]:visible').first()).toHaveText(
    "Generated"
  );
  await expect(canvas).toHaveAttribute("data-mesh-overlay-status", "committed");
  await page.getByRole("button", { name: "Select" }).first().click();

  await rowNameButton(visibleDrawableRow).click();
  const parameterBar = page.getByTestId("parameter-bar");
  await expect(parameterBar).toBeVisible();
  await expect(visibleInput(page, "Active parameter")).toHaveValue("param_face_angle_x");
  const keyState = page.getByTestId("parameter-key-position-state");
  const opacityBinding = page.getByTestId("parameter-binding-opacity").first();
  await expect(opacityBinding).toBeVisible();
  await page.getByRole("button", { name: "Create end and center keyforms", exact: true }).click();
  await expect(keyState).toHaveAttribute("aria-label", "Parameter keyform state: keyform");
  await opacityBinding.getByLabel("Drawable opacity value").fill("0.4");
  await opacityBinding.getByRole("button", { name: "Update", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-selected-drawable-opacity", "0.40");

  await page.getByRole("button", { name: /^Rig$/ }).first().click();
  await rowNameButton(visibleDrawableRow).click();
  await page.getByRole("button", { name: "Create Rotation Deformer" }).click();
  await expect(canvas).toHaveAttribute("data-deformer-overlay-kind", "rotation");
  await expect(canvas).toHaveAttribute("data-deformer-overlay-status", "committed");
  await page.getByRole("button", { name: "Create Parent Warp Deformer" }).click();
  await expect(canvas).toHaveAttribute("data-deformer-overlay-kind", "warp");
  await expect(canvas).toHaveAttribute("data-deformer-overlay-status", "committed");
  await page.getByRole("button", { name: "Deformers" }).click();
  await expect(page.locator('[data-row-kind="warp-deformer"]:visible').first()).toBeVisible();
  await expect(page.locator('[data-row-kind="rotation-deformer"]:visible').first()).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save project" }).click();
  const download = await downloadPromise;
  const savedBundlePath = testInfo.outputPath("wave72-saved-project.portable-project.json");
  await download.saveAs(savedBundlePath);

  await page.reload();
  await expect(page.locator('[data-testid="parts-tree"]:visible').first()).not.toContainText(
    "sample_model import"
  );
  await page.getByLabel("Open portable project bundle file").setInputFiles(savedBundlePath);

  const partsTree = page.locator('[data-testid="parts-tree"]:visible').first();
  await expect(partsTree).toContainText("sample_model import");
  await expect(partsTree).toContainText(selectedDrawableName);
  await expect(canvas).toHaveAttribute("data-canvas-has-renderable-artwork", "true");
  await expect(canvas).toHaveAttribute("data-renderable-drawable-count", /^[1-9]\d*$/);

  const restoredDrawableRow = page
    .locator('[data-row-kind="drawable"]:visible')
    .filter({ hasText: selectedDrawableName })
    .first();
  await rowNameButton(restoredDrawableRow).click();
  await expect(page.locator('[data-testid="inspector-selection-kind"]:visible').first()).toHaveText(
    "Drawable"
  );

  await page.getByRole("button", { name: /^Mesh$/ }).first().click();
  await expect(page.locator('[data-testid="mesh-tool-status"]:visible').first()).toHaveText(
    "Generated"
  );
  await expect(canvas).toHaveAttribute("data-mesh-overlay-status", "committed");
  await expect(canvas).toHaveAttribute("data-mesh-overlay-triangle-count", /^[1-9]\d*$/);
  await page.getByRole("button", { name: "Select" }).first().click();

  await rowNameButton(restoredDrawableRow).click();
  await expect(visibleInput(page, "Active parameter")).toHaveValue("param_face_angle_x");
  await expect(keyState).toHaveAttribute("aria-label", "Parameter keyform state: keyform");
  await expect(opacityBinding.getByLabel("Drawable opacity value")).toHaveValue("0.40");
  await expect(canvas).toHaveAttribute("data-selected-drawable-opacity", "0.40");

  await page.getByRole("button", { name: /^Rig$/ }).first().click();
  await page.getByRole("button", { name: "Deformers" }).click();
  const restoredWarpRow = page.locator('[data-row-kind="warp-deformer"]:visible').first();
  const restoredRotationRow = page.locator('[data-row-kind="rotation-deformer"]:visible').first();
  await expect(restoredWarpRow).toBeVisible();
  await expect(restoredRotationRow).toBeVisible();
  await restoredRotationRow.click();
  await expect(canvas).toHaveAttribute("data-deformer-overlay-kind", "rotation");
  await expect(canvas).toHaveAttribute("data-deformer-overlay-status", "committed");
  await restoredWarpRow.click();
  await expect(canvas).toHaveAttribute("data-deformer-overlay-kind", "warp");
  await expect(canvas).toHaveAttribute("data-deformer-overlay-status", "committed");
});

async function importFixturePsd(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Import PSD" }).first().click();
  await page.getByLabel("PSD file").setInputFiles(fixturePsdPath);
  const review = page.getByTestId("psd-import-review");
  await expect(review).toBeVisible();
  await expect(review).toContainText("sample_model import");
  await expect(review.getByLabel("Drawable").first()).toBeVisible();
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

function visibleInput(page: Page, label: string): Locator {
  return page.locator(`[aria-label="${label}"]:visible`).first();
}
