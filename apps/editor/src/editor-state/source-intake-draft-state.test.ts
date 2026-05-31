import { describe, expect, it } from "vitest";

import {
  confirmSourceIntakeDraft,
  createEmptySourceIntakeDraftState,
  createPsdAdapterProfileSourceIntakeDraftState,
  projectSourceIntakeDraftViewModel
} from "./index.js";

describe("source intake draft state", () => {
  it("keeps split PNG intake as a draft until required source and rights metadata are present", () => {
    const draft = createEmptySourceIntakeDraftState({ defaultPartId: "part_root" });
    const viewModel = projectSourceIntakeDraftViewModel(draft);

    expect(draft.importProfile).toBe("split-png-fallback-v1");
    expect(draft.placementPolicy).toBe("use-metadata");
    expect(draft.defaultPartId).toBe("part_root");
    expect(draft.layers[0]).toMatchObject({
      texturePreviewReference: "assets/textures/layer_body.preview.png",
      textureId: "tex_body",
      targetPartId: "part_root"
    });
    expect(viewModel.canConfirmDraft).toBe(false);
    expect(viewModel.statusLabel).toBe("3 draft issues");
    expect(viewModel.layerRows[0]).toMatchObject({
      texturePreviewReferenceLabel: "assets/textures/layer_body.preview.png",
      textureIdLabel: "tex_body",
      targetPartLabel: "part_root",
      textureMappingStatusLabel: "tex_body / part_root"
    });
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
          unsupportedFeatures: [],
          texturePreviewReference: "assets/textures/face-preview.png",
          textureId: "tex_face",
          targetPartId: "part_head"
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
      bounds: { x: 8, y: 10, width: 96, height: 112 },
      texturePreviewReference: "assets/textures/face-preview.png",
      textureId: "tex_face",
      targetPartId: "part_head"
    });
    expect("operationType" in confirmed).toBe(false);
  });

  it("confirms deterministic image data URL texture preview references", () => {
    const dataUrl = "data:image/png;base64,iVBORw0KGgo=";

    const confirmed = confirmSourceIntakeDraft({
      sourceAssetId: "src_character_split",
      manifestPath: "assets/sources/character/split-manifest.json",
      contentHash: "sha256:character-split",
      defaultPartId: "part_root",
      placementPolicy: "use-metadata",
      layers: [
        {
          sourceLayerId: "layer_face",
          originalName: "Face.png",
          normalizedName: "face",
          groupPath: ["Head"],
          bounds: { x: 8, y: 10, width: 96, height: 112 },
          visibleInSource: true,
          opacityInSource: 1,
          role: "editableLayer",
          unsupportedFeatures: [],
          texturePreviewReference: dataUrl,
          textureId: "tex_face",
          targetPartId: "part_head"
        }
      ],
      rights: {
        rightsStatus: "cleared",
        creator: "Clean Artist",
        license: "original-private-use",
        redistributionAllowed: true,
        aiUsed: false,
        sourceUrl: "",
        notes: ""
      }
    });
    const viewModel = projectSourceIntakeDraftViewModel(confirmed);

    expect(confirmed.status).toBe("confirmed");
    expect(confirmed.diagnostics).toEqual([]);
    expect(confirmed.layers[0]?.texturePreviewReference).toBe(dataUrl);
    expect(viewModel.canConfirmDraft).toBe(true);
    expect(viewModel.layerRows[0]?.texturePreviewReferenceLabel).toBe(dataUrl);
  });

  it("confirms manual PSD adapter/profile metadata without parser or file-picker claims", () => {
    const confirmed = confirmSourceIntakeDraft({
      intakeMode: "psdAdapterProfile",
      sourceAssetId: "src_character_psd_profile",
      manifestPath: "assets/sources/character/source.psd",
      contentHash: "sha256:manual-psd-reference",
      defaultPartId: "part_root",
      placementPolicy: "use-metadata",
      psdProfile: {
        adapterName: "manual-psd-profile-entry",
        canvasWidth: 2048,
        canvasHeight: 3072
      },
      layers: [
        {
          sourceLayerId: "layer_face",
          originalName: "Face",
          normalizedName: "face",
          groupPath: ["Root", "Head"],
          bounds: { x: 320, y: 240, width: 512, height: 512 },
          visibleInSource: true,
          opacityInSource: 0.8,
          role: "editableLayer",
          unsupportedFeatures: ["psd.textLayer"],
          texturePreviewReference: "assets/sources/character/face.preview.png",
          textureId: "tex_face",
          targetPartId: "part_root"
        }
      ],
      rights: {
        rightsStatus: "cleared",
        creator: "Clean Artist",
        license: "original-private-use",
        redistributionAllowed: false,
        aiUsed: false,
        sourceUrl: "",
        notes: "Manual PSD profile metadata only."
      }
    });
    const viewModel = projectSourceIntakeDraftViewModel(confirmed);

    expect(confirmed).toMatchObject({
      status: "confirmed",
      intakeMode: "psdAdapterProfile",
      importProfile: "layered-character-psd-profile-v1",
      sourceAssetId: "src_character_psd_profile",
      manifestPath: "assets/sources/character/source.psd",
      diagnostics: [],
      psdProfile: {
        adapterName: "manual-psd-profile-entry",
        canvasWidth: 2048,
        canvasHeight: 3072
      }
    });
    expect(viewModel).toMatchObject({
      sourceModeLabel: "PSD adapter/profile metadata (manual)",
      sourceReferenceLabel: "assets/sources/character/source.psd",
      psdCanvasLabel: "2048 x 3072",
      canConfirmDraft: true
    });
    expect(JSON.stringify(viewModel)).not.toMatch(/file picker|parsed from bytes|raster extraction/i);
  });

  it("keeps manual PSD profile validation local and wraps long diagnostics as strings", () => {
    const rejected = confirmSourceIntakeDraft({
      ...createPsdAdapterProfileSourceIntakeDraftState(),
      manifestPath: "",
      psdProfile: {
        adapterName: "",
        canvasWidth: 0,
        canvasHeight: 3072
      },
      layers: [
        {
          sourceLayerId: "layer_face",
          originalName: "Face",
          normalizedName: "face",
          groupPath: ["Root"],
          bounds: { x: 0, y: 0, width: 64, height: 64 },
          visibleInSource: true,
          opacityInSource: 1,
          role: "editableLayer",
          unsupportedFeatures: [],
          texturePreviewReference: "generated://texture-preview/this-reference-is-long-and-not-accepted-for-manual-psd-profile-metadata",
          textureId: "tex_face",
          targetPartId: "part_root"
        }
      ],
      rights: {
        rightsStatus: "needs_review",
        creator: "Clean Artist",
        license: "private-review",
        redistributionAllowed: false,
        aiUsed: false,
        sourceUrl: "",
        notes: ""
      }
    });

    expect(rejected.status).toBe("idle");
    expect(rejected.diagnostics).toEqual([
      "PSD source reference is required for adapter/profile metadata.",
      "PSD adapter/profile name is required.",
      "PSD canvas width must be greater than zero.",
      "Layer 1 generated://texture-preview/ references are not supported by Source Intake commits; use assets/sources/, assets/textures/, assets/thumbnails/, or deterministic data:image/(png|jpeg|webp);base64,... references."
    ]);
  });

  it("surfaces invalid texture preview references and missing target parts in the draft view model", () => {
    const rejected = confirmSourceIntakeDraft({
      sourceAssetId: "src_character_split",
      manifestPath: "assets/sources/character/split-manifest.json",
      contentHash: "",
      defaultPartId: "",
      placementPolicy: "use-metadata",
      layers: [
        {
          sourceLayerId: "layer_face",
          originalName: "Face",
          normalizedName: "face",
          groupPath: ["Head"],
          bounds: { x: 0, y: 0, width: 64, height: 64 },
          visibleInSource: true,
          opacityInSource: 1,
          role: "editableLayer",
          unsupportedFeatures: [],
          texturePreviewReference: "https://example.invalid/face.png",
          textureId: "tex_face",
          targetPartId: ""
        }
      ],
      rights: {
        rightsStatus: "cleared",
        creator: "Clean Artist",
        license: "original-private-use",
        redistributionAllowed: false,
        aiUsed: false,
        sourceUrl: "",
        notes: ""
      }
    });
    const viewModel = projectSourceIntakeDraftViewModel(rejected);

    expect(rejected.status).toBe("idle");
    expect(viewModel.canConfirmDraft).toBe(false);
    expect(viewModel.layerRows[0]).toMatchObject({
      texturePreviewReferenceLabel: "https://example.invalid/face.png",
      targetPartLabel: "No target part",
      textureMappingStatusLabel: "Missing target part"
    });
    expect(viewModel.diagnostics).toEqual([
      "Layer 1 texture preview reference is invalid; use assets/textures/, assets/thumbnails/, or deterministic data:image/(png|jpeg|webp);base64,... references.",
      "Layer 1 target part ID is required."
    ]);
  });

  it("rejects generated texture preview references before confirming the draft", () => {
    const rejected = confirmSourceIntakeDraft({
      sourceAssetId: "src_character_split",
      manifestPath: "assets/sources/character/split-manifest.json",
      contentHash: "",
      defaultPartId: "part_root",
      placementPolicy: "use-metadata",
      layers: [
        {
          sourceLayerId: "layer_face",
          originalName: "Face",
          normalizedName: "face",
          groupPath: ["Head"],
          bounds: { x: 0, y: 0, width: 64, height: 64 },
          visibleInSource: true,
          opacityInSource: 1,
          role: "editableLayer",
          unsupportedFeatures: [],
          texturePreviewReference: "generated://texture-preview/layer_face",
          textureId: "tex_face",
          targetPartId: "part_root"
        }
      ],
      rights: {
        rightsStatus: "cleared",
        creator: "Clean Artist",
        license: "original-private-use",
        redistributionAllowed: false,
        aiUsed: false,
        sourceUrl: "",
        notes: ""
      }
    });
    const viewModel = projectSourceIntakeDraftViewModel(rejected);

    expect(rejected.status).toBe("idle");
    expect(viewModel.canConfirmDraft).toBe(false);
    expect(viewModel.diagnostics).toEqual([
      "Layer 1 generated://texture-preview/ references are not supported by Source Intake commits; use assets/textures/, assets/thumbnails/, or deterministic data:image/(png|jpeg|webp);base64,... references."
    ]);
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
          unsupportedFeatures: [],
          texturePreviewReference: "assets/textures/layer_bad.preview.png",
          textureId: "tex_bad",
          targetPartId: "part_root"
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
