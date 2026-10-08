import { describe, expect, it } from "vitest";
import { createTextureAtlasPreview, applyTextureAtlasPreview, sameTextureAtlasSourceSignature } from "@private-2d-rigging-lab/authoring-core";
import { materialFixture } from "./material-command-test-fixtures.js";
import { loadAuthoringPackageDirectory } from "./package-directory-io.js";

describe("material atlas freshness", () => {
  it("old source signature and preview stay stale after material replacement", async () => {
    const f = await materialFixture("replace", true), base = await loadAuthoringPackageDirectory(f.packageDirectory);
    const settings = { pageWidth: 64, pageHeight: 64, paddingPixels: 1 };
    const oldPreview = createTextureAtlasPreview(base.session, settings);
    expect(oldPreview.status).toBe("ready"); if (oldPreview.status !== "ready") throw new Error(JSON.stringify(oldPreview));
    const candidate = await f.next("buildMaterialCandidate", await f.register()), working = (await f.load(candidate)).workingPackage!.session;
    const newPreview = createTextureAtlasPreview(working, settings);
    expect(newPreview.status).toBe("ready"); if (newPreview.status !== "ready") throw new Error(JSON.stringify(newPreview));
    expect(sameTextureAtlasSourceSignature(oldPreview.layoutSummary.sourceSignature, newPreview.layoutSummary.sourceSignature)).toBe(false);
    const applied = await applyTextureAtlasPreview(working, { preview: oldPreview });
    expect(applied.status).toBe("failed");
  }, 25000);
});
