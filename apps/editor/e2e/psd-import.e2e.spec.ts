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
  await expect(review).toContainText("Part Container");
  await expect(review).toContainText("Drawable");
  await expect(review).toContainText("Hidden Drawable");
  await expect(page.getByTestId("psd-import-preview-placeholder")).toBeVisible();

  await page.getByRole("button", { name: "Import" }).click();

  const visiblePartsTree = page.locator('[data-testid="parts-tree"]:visible').first();
  await expect(page.getByRole("dialog", { name: "Import PSD" })).toBeHidden();
  await expect(visiblePartsTree).toContainText("sample_model import");
  await expect(visiblePartsTree).toContainText("Hidden Drawable");
  await expect(page.locator('[data-testid="parts-tree-selected-row"]:visible').first()).toContainText(
    "sample_model import"
  );
  await expect(page.locator('[data-testid="inspector-selection-kind"]:visible').first()).toHaveText(
    "Part"
  );
});
