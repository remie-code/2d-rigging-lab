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
  const visibleDrawableRows = page
    .locator('[data-row-kind="drawable"]:visible')
    .filter({ has: page.getByRole("button", { name: "Hide drawable" }) });
  await expect(visibleDrawableRows.nth(1)).toBeVisible();
  const selectedDrawableName = (await rowNameButton(visibleDrawableRows.nth(0)).innerText()).trim();
  const runtimeHiddenDrawableName = (await rowNameButton(visibleDrawableRows.nth(1)).innerText()).trim();

  await visibleDrawableRows.nth(1).dragTo(visibleDrawableRows.nth(0), {
    targetPosition: { x: 8, y: 2 }
  });
  const reorderedVisibleDrawableRows = page
    .locator('[data-row-kind="drawable"]:visible')
    .filter({ has: page.getByRole("button", { name: "Hide drawable" }) });
  await expect(rowNameButton(reorderedVisibleDrawableRows.nth(0))).toHaveText(
    runtimeHiddenDrawableName
  );
  await expect(rowNameButton(reorderedVisibleDrawableRows.nth(1))).toHaveText(
    selectedDrawableName
  );

  const visibleDrawableRow = drawableRowByName(page, selectedDrawableName);
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
  await expect(canvas).toHaveAttribute("data-selected-drawable-opacity", "0.40");

  await page.getByRole("button", { name: /^Rig$/ }).first().click();
  await rowNameButton(drawableRowByName(page, selectedDrawableName)).click();
  await page.getByRole("button", { name: "Create Rotation Deformer" }).click();
  await expect(canvas).toHaveAttribute("data-deformer-overlay-kind", "rotation");
  await expect(canvas).toHaveAttribute("data-deformer-overlay-status", "committed");

  const rotationAngleBinding = page.getByTestId("parameter-binding-angleDegrees").first();
  await expect(rotationAngleBinding).toBeVisible();
  await page.getByRole("button", { name: "Add keyform at current value", exact: true }).click();
  await expect(rotationAngleBinding.getByLabel("Rotation angle value")).toBeEnabled();
  await rotationAngleBinding.getByLabel("Rotation angle value").fill("18");
  await expect(canvas).toHaveAttribute("data-deformer-overlay-evaluated-angle", "18");

  const rotationTranslationBinding = page.getByTestId("parameter-binding-translation").first();
  await expect(rotationTranslationBinding).toBeVisible();
  await visibleInput(page, "Keyform target").selectOption({ label: "Translation" });
  await page.getByRole("button", { name: "Add keyform at current value", exact: true }).click();
  await expect(rotationTranslationBinding.getByLabel("Translation X")).toBeEnabled();
  await rotationTranslationBinding.getByLabel("Translation X").fill("7");
  await rotationTranslationBinding.getByLabel("Translation Y").fill("-3");
  await expect(canvas).toHaveAttribute("data-deformer-overlay-translation-x", "7");
  await expect(canvas).toHaveAttribute("data-deformer-overlay-translation-y", "-3");

  await page.getByRole("button", { name: "Create Parent Warp Deformer" }).click();
  await expect(canvas).toHaveAttribute("data-deformer-overlay-kind", "warp");
  await expect(canvas).toHaveAttribute("data-deformer-overlay-status", "committed");

  const warpOffsetsBinding = page.getByTestId("parameter-binding-controlPointOffsets").first();
  await expect(warpOffsetsBinding).toBeVisible();
  await visibleInput(page, "Keyform target").selectOption({ label: "Warp lattice offsets" });
  await page.getByRole("button", { name: "Add keyform at current value", exact: true }).click();
  await expect(warpOffsetsBinding.getByLabel("Uniform offset X")).toBeEnabled();
  await warpOffsetsBinding.getByLabel("Uniform offset X").fill("5");
  await warpOffsetsBinding.getByLabel("Uniform offset Y").fill("9");
  await expect(canvas).toHaveAttribute("data-deformer-overlay-control-point-offset-count", "25");
  await expect(canvas).toHaveAttribute("data-deformer-overlay-first-control-point-offset-x", "5");
  await expect(canvas).toHaveAttribute("data-deformer-overlay-first-control-point-offset-y", "9");

  await page.getByRole("button", { name: "Deformers" }).click();
  await expect(page.locator('[data-row-kind="warp-deformer"]:visible').first()).toBeVisible();
  await expect(page.locator('[data-row-kind="rotation-deformer"]:visible').first()).toBeVisible();
  await expectKeyformBadge(page.locator('[data-row-kind="warp-deformer"]:visible').first(), 1, 1);
  await expectKeyformBadge(
    page.locator('[data-row-kind="rotation-deformer"]:visible').first(),
    2,
    2
  );

  await visibleInput(page, "Parameter numeric value").fill("30");
  await expect(visibleInput(page, "Parameter numeric value")).toHaveValue("30");
  await page.getByRole("button", { name: /^Select$/ }).first().click();
  await page.getByRole("button", { name: "Parts" }).click();
  await expandVisiblePartContainers(page);
  await rowNameButton(drawableRowByName(page, runtimeHiddenDrawableName)).click();
  await expect(page.locator('[data-testid="inspector-selection-kind"]:visible').first()).toHaveText(
    "Drawable"
  );
  await page.getByRole("button", { name: "Hide selected drawable" }).click();
  await expect(page.getByRole("button", { name: "Show selected drawable" })).toBeVisible();

  const importRootRow = page
    .locator('[data-row-kind="part"]:visible')
    .filter({ hasText: "sample_model import" })
    .first();
  await importRootRow.getByRole("button", { name: "Hide part container" }).click();
  await expect(importRootRow.getByRole("button", { name: "Show part container" })).toBeVisible();
  await expect(canvas).toHaveAttribute("data-canvas-has-renderable-artwork", "false");

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
  await expect(page.locator('[data-testid="parts-tree-selected-row"]:visible')).toHaveCount(0);
  await expect(page.locator('[data-testid="inspector-selection-kind"]:visible').first()).toHaveText(
    "Project"
  );
  await expect(visibleInput(page, "Active parameter")).toHaveValue("param_face_angle_x");
  await expect(visibleInput(page, "Parameter numeric value")).toHaveValue("0");
  await expect(keyState).toHaveAttribute("aria-label", "Parameter keyform state: No target");

  await page.getByRole("button", { name: /^Rig$/ }).first().click();
  await page.getByRole("button", { name: "Deformers" }).click();
  const discoveredWarpRow = page.locator('[data-row-kind="warp-deformer"]:visible').first();
  const discoveredRotationRow = page
    .locator('[data-row-kind="rotation-deformer"]:visible')
    .first();
  await expect(discoveredWarpRow).toBeVisible();
  await expect(discoveredRotationRow).toBeVisible();
  await expect(page.locator('[data-testid="deformer-tree-selected-row"]:visible')).toHaveCount(0);
  await expectKeyformBadge(discoveredWarpRow, 1, 1);
  await expectKeyformBadge(discoveredRotationRow, 2, 2);
  const discoveredWarpId = await discoveredWarpRow.getAttribute("data-row-id");
  if (discoveredWarpId === null) {
    throw new Error("Expected restored Warp Deformer row id.");
  }
  await expect(discoveredRotationRow).toHaveAttribute(
    "data-parent-rig-control-id",
    discoveredWarpId
  );

  await page.getByRole("button", { name: /^Select$/ }).first().click();
  await page.getByRole("button", { name: "Parts" }).click();
  const restoredImportRootRow = page
    .locator('[data-row-kind="part"]:visible')
    .filter({ hasText: "sample_model import" })
    .first();
  await expect(restoredImportRootRow.getByRole("button", { name: "Show part container" }))
    .toBeVisible();
  await expect(canvas).toHaveAttribute("data-canvas-has-renderable-artwork", "false");
  await restoredImportRootRow.getByRole("button", { name: "Show part container" }).click();
  await expect(canvas).toHaveAttribute("data-canvas-has-renderable-artwork", "true");
  await expandVisiblePartContainers(page);
  await expect(partsTree).toContainText(selectedDrawableName);
  const restoredDrawableNames = await readVisibleDrawableRowNames(page);
  expect(restoredDrawableNames.indexOf(runtimeHiddenDrawableName)).toBeLessThan(
    restoredDrawableNames.indexOf(selectedDrawableName)
  );
  const restoredRuntimeHiddenRow = drawableRowByName(page, runtimeHiddenDrawableName);
  await expect(
    restoredRuntimeHiddenRow.getByRole("button", { name: "Show drawable" })
  ).toBeVisible();
  const renderableBeforeDrawableShow = await readRenderableCount(canvas);
  await rowNameButton(restoredRuntimeHiddenRow).click();
  await expect(page.getByRole("button", { name: "Show selected drawable" })).toBeVisible();
  await page.getByRole("button", { name: "Show selected drawable" }).click();
  await expect(canvas).toHaveAttribute(
    "data-renderable-drawable-count",
    String(renderableBeforeDrawableShow + 1)
  );
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
  await expectKeyformBadge(restoredWarpRow, 1, 1);
  await expectKeyformBadge(restoredRotationRow, 2, 2);
  await restoredRotationRow.click();
  await expect(canvas).toHaveAttribute("data-deformer-overlay-kind", "rotation");
  await expect(canvas).toHaveAttribute("data-deformer-overlay-status", "committed");
  await expect(canvas).toHaveAttribute("data-deformer-overlay-evaluated-angle", "18");
  await expect(canvas).toHaveAttribute("data-deformer-overlay-translation-x", "7");
  await expect(canvas).toHaveAttribute("data-deformer-overlay-translation-y", "-3");
  await expect(
    page
      .getByTestId("parameter-binding-angleDegrees")
      .getByLabel("Rotation angle value")
      .first()
  )
    .toHaveValue("18");
  await expect(page.getByTestId("parameter-binding-translation").getByLabel("Translation X").first())
    .toHaveValue("7");
  await expect(page.getByTestId("parameter-binding-translation").getByLabel("Translation Y").first())
    .toHaveValue("-3");
  await restoredWarpRow.click();
  await expect(canvas).toHaveAttribute("data-deformer-overlay-kind", "warp");
  await expect(canvas).toHaveAttribute("data-deformer-overlay-status", "committed");
  await expect(canvas).toHaveAttribute("data-deformer-overlay-control-point-offset-count", "25");
  await expect(canvas).toHaveAttribute("data-deformer-overlay-first-control-point-offset-x", "5");
  await expect(canvas).toHaveAttribute("data-deformer-overlay-first-control-point-offset-y", "9");
  await expect(
    page
      .getByTestId("parameter-binding-controlPointOffsets")
      .getByLabel("Uniform offset X")
      .first()
  )
    .toHaveValue("5");
  await expect(
    page
      .getByTestId("parameter-binding-controlPointOffsets")
      .getByLabel("Uniform offset Y")
      .first()
  )
    .toHaveValue("9");
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
  await expandVisiblePartContainers(page);
}

function rowNameButton(row: Locator): Locator {
  return row.locator("button").last();
}

function drawableRowByName(page: Page, name: string): Locator {
  return page
    .locator('[data-row-kind="drawable"]:visible')
    .filter({ has: page.getByRole("button", { name, exact: true }) })
    .first();
}

function visibleInput(page: Page, label: string): Locator {
  return page.locator(`[aria-label="${label}"]:visible`).first();
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

async function expectKeyformBadge(
  row: Locator,
  expectedSetCount: number,
  expectedKeyCount: number
): Promise<void> {
  await expect(row).toHaveAttribute("data-keyform-set-count", String(expectedSetCount));
  await expect(row).toHaveAttribute("data-keyform-key-count", String(expectedKeyCount));
  const badge = row.getByTestId("deformer-tree-keyform-count");
  await expect(badge).toBeVisible();
  await expect(badge).toContainText(`Keyed ${expectedKeyCount}`);
}

async function expandVisiblePartContainers(page: Page): Promise<void> {
  const partsTree = page.locator('[data-testid="parts-tree"]:visible').first();

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const expandButton = partsTree.getByRole("button", { name: /^Expand / }).first();
    if (await expandButton.count() === 0) {
      return;
    }

    await expandButton.click();
  }

  throw new Error("Parts Tree did not finish expanding visible Part Containers.");
}
