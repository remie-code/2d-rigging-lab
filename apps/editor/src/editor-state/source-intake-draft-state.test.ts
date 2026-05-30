import { describe, expect, it } from "vitest";

import {
  confirmSourceIntakeDraft,
  createEmptySourceIntakeDraftState,
  projectSourceIntakeDraftViewModel
} from "./index.js";

describe("source intake draft state", () => {
  it("keeps split PNG intake as a draft until required source and rights metadata are present", () => {
    const draft = createEmptySourceIntakeDraftState({ defaultPartId: "part_root" });
    const viewModel = projectSourceIntakeDraftViewModel(draft);

    expect(draft.importProfile).toBe("split-png-fallback-v1");
    expect(draft.placementPolicy).toBe("use-metadata");
    expect(draft.defaultPartId).toBe("part_root");
    expect(viewModel.canConfirmDraft).toBe(false);
    expect(viewModel.statusLabel).toBe("3 draft issues");
    expect(viewModel.diagnostics).toEqual([
      "Split PNG manifest path is required.",
      "Creator is required for source provenance.",
      "License is required for rights metadata."
    ]);
  });

  it("confirms manifest, layer rows, rights metadata, and placement policy without creating an operation payload", () => {
    const confirmed = confirmSourceIntakeDraft({
      sourceAssetId: "src_character_split",
      manifestPath: "assets/sources/character/split-manifest.json",
      contentHash: "sha256:character-split",
      defaultPartId: "part_root",
      placementPolicy: "origin-with-warning",
      layers: [
        {
          sourceLayerId: "layer_face",
          originalName: "Face.png",
          normalizedName: "face",
          groupPath: ["Head"],
          bounds: { x: 8, y: 10, width: 96, height: 112 },
          visibleInSource: true,
          opacityInSource: 0.9,
          role: "editableLayer",
          unsupportedFeatures: []
        }
      ],
      rights: {
        rightsStatus: "cleared",
        creator: "Clean Artist",
        license: "original-private-use",
        redistributionAllowed: true,
        aiUsed: false,
        sourceUrl: "https://example.invalid/source-note",
        notes: "Artist supplied split PNG files."
      }
    });

    expect(confirmed).toMatchObject({
      status: "confirmed",
      sourceAssetId: "src_character_split",
      manifestPath: "assets/sources/character/split-manifest.json",
      importProfile: "split-png-fallback-v1",
      placementPolicy: "origin-with-warning",
      diagnostics: [],
      rights: {
        rightsStatus: "cleared",
        creator: "Clean Artist",
        license: "original-private-use",
        redistributionAllowed: true,
        aiUsed: false
      }
    });
    expect(confirmed.layers[0]).toMatchObject({
      sourceLayerId: "layer_face",
      normalizedName: "face",
      bounds: { x: 8, y: 10, width: 96, height: 112 }
    });
    expect("operationType" in confirmed).toBe(false);
  });

  it("keeps invalid layer geometry in diagnostics instead of confirming the draft", () => {
    const rejected = confirmSourceIntakeDraft({
      sourceAssetId: "src_character_split",
      manifestPath: "assets/sources/character/split-manifest.json",
      contentHash: "",
      defaultPartId: "",
      placementPolicy: "use-metadata",
      layers: [
        {
          sourceLayerId: "layer_bad",
          originalName: "Bad",
          normalizedName: "bad",
          groupPath: [],
          bounds: { x: 0, y: 0, width: 0, height: 64 },
          visibleInSource: true,
          opacityInSource: 1.2,
          role: "editableLayer",
          unsupportedFeatures: []
        }
      ],
      rights: {
        rightsStatus: "blocked",
        creator: "Clean Artist",
        license: "blocked-review",
        redistributionAllowed: false,
        aiUsed: false,
        sourceUrl: "",
        notes: "Blocked can be represented in draft metadata."
      }
    });

    expect(rejected.status).toBe("idle");
    expect(rejected.diagnostics).toEqual([
      "Layer 1 bounds width and height must be greater than zero.",
      "Layer 1 opacity must be between 0 and 1."
    ]);
  });
});
