import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DrawableIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import type {
  BinaryAssetReferenceDto,
  SourceAssetDto,
  TextureAtlasFileDto
} from "@private-2d-rigging-lab/package-format";

import {
  createEmptySourceIntakeDraftState,
  createPsdAdapterProfileSourceIntakeDraftState,
  createSourceIntakeLayerRowTestId,
  editorTestIds,
  projectSourceIntakeDraftViewModel
} from "../../editor-state/index.js";
import { createSourceIntakePanel } from "./source-intake-panel.js";

describe("source intake panel", () => {
  let originalFormData: typeof FormData | undefined;

  beforeEach(() => {
    installTestDocument();
    originalFormData = globalThis.FormData;
    (globalThis as unknown as { FormData: typeof FormData }).FormData =
      TestFormData as unknown as typeof FormData;
  });

  afterEach(() => {
    delete (globalThis as Partial<{ document: Document }>).document;
    if (originalFormData === undefined) {
      delete (globalThis as Partial<{ FormData: typeof FormData }>).FormData;
    } else {
      globalThis.FormData = originalFormData;
    }
  });

  it("renders split PNG manifest, layer row, rights, and placement controls", () => {
    const draft = createEmptySourceIntakeDraftState({ defaultPartId: "part_root" });
    const panel = createPanel(draft);

    expect(findByTestId(panel, editorTestIds.sourceIntakePanel)?.getAttribute("aria-labelledby")).toBe(
      "editor-source-intake-heading"
    );
    expect(findByTestId(panel, editorTestIds.sourceIntakeSummary)?.textContent).toContain(
      "3 draft issues"
    );
    expect(findByTestId(panel, editorTestIds.sourceIntakeForm)?.textContent).toContain(
      "Split PNG manifest path / PSD source reference"
    );
    expect(findByTestId(panel, editorTestIds.sourceIntakeForm)?.textContent).toContain(
      "Source intake mode"
    );
    expect(findByTestId(panel, editorTestIds.sourceIntakeForm)?.textContent).toContain(
      "Source file draft"
    );
    expect(findByTestId(panel, editorTestIds.sourceIntakeFileInput)?.type).toBe("file");
    expect(findByTestId(panel, editorTestIds.sourceIntakeSelectedFile)?.textContent).toContain(
      "No browser file selected"
    );
    expect(findByTestId(panel, editorTestIds.sourceIntakeForm)?.textContent).toContain(
      "PSD adapter/profile name"
    );
    expect(findByTestId(panel, editorTestIds.sourceIntakeForm)?.textContent).toContain(
      "Texture preview reference"
    );
    expect(findByTestId(panel, editorTestIds.sourceIntakeForm)?.textContent).toContain(
      "Target part ID"
    );
    expect(findByTestId(panel, editorTestIds.sourceIntakePlacementPolicy)?.value).toBe("use-metadata");
    expect(findByTestId(panel, editorTestIds.sourceIntakeRightsStatus)?.value).toBe("needs_review");
    expect(findByTestId(panel, createSourceIntakeLayerRowTestId("layer_body"))?.textContent).toContain(
      "Layer ID"
    );
    expect(findByTestId(panel, createSourceIntakeLayerRowTestId("layer_body"))?.textContent).toContain(
      "tex_body / part_root"
    );
    expect(findByTestId(panel, editorTestIds.sourceIntakeLayerRows)?.getAttribute("aria-label")).toBe(
      "Source intake layer rows"
    );
    expect(findNamedField(panel, "texturePreviewReference.0")?.required).toBe(true);
    expect(findNamedField(panel, "textureId.0")?.required).toBe(true);
  });

  it("lets the form choose manual PSD adapter/profile mode without file parsing wording", () => {
    const calls: unknown[] = [];
    const panel = createPanel(createEmptySourceIntakeDraftState({ defaultPartId: "part_root" }), (draft) =>
      calls.push(draft)
    );

    setNamedFieldValue(panel, "intakeMode", "psdAdapterProfile");
    setNamedFieldValue(panel, "manifestPath", "assets/sources/character/source.psd");
    setNamedFieldValue(panel, "sourceAssetId", "src_panel_psd_profile");
    setNamedFieldValue(panel, "contentHash", "sha256:manual-psd-reference");
    setNamedFieldValue(panel, "psdAdapterName", "manual-psd-profile-entry");
    setNamedFieldValue(panel, "psdCanvasWidth", "2048");
    setNamedFieldValue(panel, "psdCanvasHeight", "3072");
    setNamedFieldValue(panel, "creator", "Clean Artist");
    setNamedFieldValue(panel, "license", "private-review");
    setNamedFieldValue(panel, "sourceLayerId.0", "layer_face");
    setNamedFieldValue(panel, "originalName.0", "Face");
    setNamedFieldValue(panel, "normalizedName.0", "face");
    setNamedFieldValue(panel, "groupPath.0", "Root/Head");
    setNamedFieldValue(panel, "texturePreviewReference.0", "assets/sources/character/face.preview.png");
    setNamedFieldValue(panel, "textureId.0", "tex_face");
    setNamedFieldValue(panel, "targetPartId.0", "part_root");
    findByTestId(panel, editorTestIds.sourceIntakeForm)?.emit("submit");

    expect(findByTestId(panel, editorTestIds.sourceIntakeForm)?.textContent).toContain(
      "PSD adapter/profile metadata (manual)"
    );
    expect(findByTestId(panel, editorTestIds.sourceIntakeForm)?.textContent).not.toMatch(
      /file picker|parsed from bytes|raster extraction/i
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      status: "confirmed",
      intakeMode: "psdAdapterProfile",
      importProfile: "layered-character-psd-profile-v1",
      sourceAssetId: "src_panel_psd_profile",
      manifestPath: "assets/sources/character/source.psd",
      psdProfile: {
        adapterName: "manual-psd-profile-entry",
        canvasWidth: 2048,
        canvasHeight: 3072
      },
      layers: [
        expect.objectContaining({
          sourceLayerId: "layer_face",
          groupPath: ["Root", "Head"],
          texturePreviewReference: "assets/sources/character/face.preview.png"
        })
      ],
      diagnostics: []
    });
  });

  it("keeps native texture requirements aligned with PSD unsupported layer rules", () => {
    const panel = createPanel(createUnsupportedPsdDraft());
    const intakeMode = findNamedField(panel, "intakeMode");
    const role = findNamedField(panel, "role.0");
    const texturePreview = findNamedField(panel, "texturePreviewReference.0");
    const textureId = findNamedField(panel, "textureId.0");

    expect(intakeMode?.value).toBe("psdAdapterProfile");
    expect(role?.value).toBe("unsupported");
    expect(texturePreview?.required).toBe(false);
    expect(textureId?.required).toBe(false);

    setNamedFieldValue(panel, "role.0", "editableLayer");
    role?.emit("change");
    expect(texturePreview?.required).toBe(true);
    expect(textureId?.required).toBe(true);

    setNamedFieldValue(panel, "role.0", "unsupported");
    role?.emit("change");
    expect(texturePreview?.required).toBe(false);
    expect(textureId?.required).toBe(false);

    setNamedFieldValue(panel, "intakeMode", "splitPng");
    intakeMode?.emit("change");
    expect(texturePreview?.required).toBe(true);
    expect(textureId?.required).toBe(true);

    setNamedFieldValue(panel, "intakeMode", "psdAdapterProfile");
    intakeMode?.emit("change");
    expect(texturePreview?.required).toBe(false);
    expect(textureId?.required).toBe(false);
  });

  it("confirms a valid source intake draft without committing an operation", () => {
    const calls: unknown[] = [];
    const panel = createPanel(createEmptySourceIntakeDraftState(), (draft) => calls.push(draft));

    setNamedFieldValue(panel, "manifestPath", "assets/sources/character/split-manifest.json");
    setNamedFieldValue(panel, "sourceAssetId", "src_character_split");
    setNamedFieldValue(panel, "contentHash", "sha256:character-split");
    setNamedFieldValue(panel, "placementPolicy", "origin-with-warning");
    setNamedFieldValue(panel, "rightsStatus", "cleared");
    setNamedFieldValue(panel, "creator", "Clean Artist");
    setNamedFieldValue(panel, "license", "original-private-use");
    setNamedFieldValue(panel, "sourceUrl", "https://example.invalid/source-note");
    setNamedFieldValue(panel, "sourceLayerId.0", "layer_face");
    setNamedFieldValue(panel, "originalName.0", "Face.png");
    setNamedFieldValue(panel, "normalizedName.0", "face");
    setNamedFieldValue(panel, "groupPath.0", "Head");
    setNamedFieldValue(panel, "texturePreviewReference.0", "assets/textures/face-preview.png");
    setNamedFieldValue(panel, "textureId.0", "tex_face");
    setNamedFieldValue(panel, "targetPartId.0", "part_head");
    setNamedFieldValue(panel, "x.0", "8");
    setNamedFieldValue(panel, "y.0", "10");
    setNamedFieldValue(panel, "width.0", "96");
    setNamedFieldValue(panel, "height.0", "112");
    setNamedFieldValue(panel, "opacityInSource.0", "0.9");
    setNamedFieldChecked(panel, "redistributionAllowed", true);
    findByTestId(panel, editorTestIds.sourceIntakeForm)?.emit("submit");

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      status: "confirmed",
      sourceAssetId: "src_character_split",
      manifestPath: "assets/sources/character/split-manifest.json",
      placementPolicy: "origin-with-warning",
      rights: {
        rightsStatus: "cleared",
        creator: "Clean Artist",
        license: "original-private-use",
        redistributionAllowed: true,
        aiUsed: false
      },
      layers: [
        {
          sourceLayerId: "layer_face",
          originalName: "Face.png",
          normalizedName: "face",
          groupPath: ["Head"],
          bounds: { x: 8, y: 10, width: 96, height: 112 },
          opacityInSource: 0.9,
          texturePreviewReference: "assets/textures/face-preview.png",
          textureId: "tex_face",
          targetPartId: "part_head"
        }
      ],
      diagnostics: []
    });
    expect("operationType" in (calls[0] as object)).toBe(false);
  });

  it("confirms deterministic data URL texture preview references from the draft form", () => {
    const dataUrl = "data:image/png;base64,iVBORw0KGgo=";
    const calls: unknown[] = [];
    const panel = createPanel(
      createEmptySourceIntakeDraftState({ defaultPartId: "part_root" }),
      (draft) => calls.push(draft)
    );

    setNamedFieldValue(panel, "manifestPath", "assets/sources/character/split-manifest.json");
    setNamedFieldValue(panel, "creator", "Clean Artist");
    setNamedFieldValue(panel, "license", "original-private-use");
    setNamedFieldValue(panel, "texturePreviewReference.0", dataUrl);
    findByTestId(panel, editorTestIds.sourceIntakeForm)?.emit("submit");

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      status: "confirmed",
      layers: [
        expect.objectContaining({
          texturePreviewReference: dataUrl,
          textureId: "tex_body",
          targetPartId: "part_root"
        })
      ],
      diagnostics: []
    });
  });

  it("shows selected browser file metadata and confirms only the local draft", () => {
    const calls: unknown[] = [];
    const panel = createPanel(
      createPsdAdapterProfileSourceIntakeDraftState({ defaultPartId: "part_root" }),
      (draft) => calls.push(draft)
    );

    setNamedFieldValue(panel, "manifestPath", "assets/sources/character/source.psd");
    setNamedFieldValue(panel, "sourceAssetId", "src_panel_selected_psd");
    setNamedFieldValue(panel, "creator", "Clean Artist");
    setNamedFieldValue(panel, "license", "private-review");
    setNamedFieldValue(panel, "sourceLayerId.0", "layer_face");
    setNamedFieldValue(panel, "originalName.0", "Face");
    setNamedFieldValue(panel, "normalizedName.0", "face");
    setNamedFieldValue(panel, "groupPath.0", "Root/Head");
    setNamedFieldValue(panel, "texturePreviewReference.0", "assets/sources/character/face.preview.png");
    setNamedFieldValue(panel, "textureId.0", "tex_face");
    setNamedFieldValue(panel, "targetPartId.0", "part_root");
    setNamedFieldFiles(panel, "sourceFileDraft", [
      {
        name: "sample_model.psd",
        size: 4096,
        type: "application/vnd.adobe.photoshop"
      }
    ]);
    findByTestId(panel, editorTestIds.sourceIntakeFileInput)?.emit("change");

    const selectedFileSummary = findByTestId(panel, editorTestIds.sourceIntakeSelectedFile);
    expect(selectedFileSummary?.textContent).toContain("sample_model.psd");
    expect(selectedFileSummary?.textContent).toContain("4096 bytes");
    expect(selectedFileSummary?.textContent).toContain("application/vnd.adobe.photoshop");
    expect(selectedFileSummary?.textContent).toContain(
      "Bytes are selected in browser memory only; not committed to package; reupload is required after reload."
    );
    expect(selectedFileSummary?.textContent).toContain("Needs review / private-review");
    expect(selectedFileSummary?.textContent).toContain("Clean Artist / No AI use");
    expect(selectedFileSummary?.textContent).not.toMatch(
      /parsed from bytes|decoded from bytes|raster extraction|archive import/i
    );

    findByTestId(panel, editorTestIds.sourceIntakeForm)?.emit("submit");

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      status: "confirmed",
      intakeMode: "psdAdapterProfile",
      sourceAssetId: "src_panel_selected_psd",
      selectedFile: {
        fileName: "sample_model.psd",
        byteLength: 4096,
        declaredMediaType: "application/vnd.adobe.photoshop",
        storageStatus: "ephemeral-browser-memory-v1",
        availabilityStatus: "selected-in-current-browser-session-v1",
        commitStatus: "not-committed-v1"
      },
      diagnostics: []
    });
    expect("operationType" in (calls[0] as object)).toBe(false);
  });

  it("shows committed selected file bytes as current-session registered memory in panel and form summaries", () => {
    const panel = createPanel({
      ...createPsdAdapterProfileSourceIntakeDraftState({ defaultPartId: "part_root" }),
      selectedFile: {
        fileName: "sample_model.psd",
        byteLength: 4096,
        declaredMediaType: "application/vnd.adobe.photoshop",
        storageStatus: "package-local-current-session-memory-v1",
        availabilityStatus: "available-package-local-bytes-v1",
        commitStatus: "committed-to-package-binary-boundary-v1"
      },
      rights: {
        rightsStatus: "cleared",
        creator: "Clean Artist",
        license: "private-review",
        redistributionAllowed: false,
        aiUsed: false,
        sourceUrl: "",
        notes: ""
      },
      diagnostics: []
    });

    const storageTruth =
      "Bytes are registered in current editor session memory; same-origin browser-local IndexedDB stores bytes separately on a best-effort basis and load verifies bytes before availability.";
    const panelSummary = findByTestId(panel, editorTestIds.sourceIntakeSummary);
    const selectedFileSummary = findByTestId(panel, editorTestIds.sourceIntakeSelectedFile);
    expect(panelSummary?.textContent).toContain(storageTruth);
    expect(panelSummary?.textContent).not.toContain("not committed to package");
    expect(selectedFileSummary?.textContent).toContain("sample_model.psd");
    expect(selectedFileSummary?.textContent).toContain(storageTruth);
    expect(selectedFileSummary?.textContent).not.toContain("not committed to package");
    expect(selectedFileSummary?.textContent).not.toMatch(
      /parsed from bytes|decoded from bytes|raster extraction|archive import/i
    );
  });

  it("passes selected browser file bytes to the confirm callback when the File exposes bytes", async () => {
    const calls: Array<{
      readonly draft: unknown;
      readonly selectedFileBytes: unknown;
    }> = [];
    const panel = createPanel(
      createPsdAdapterProfileSourceIntakeDraftState({ defaultPartId: "part_root" }),
      (draft, selectedFileBytes) => calls.push({ draft, selectedFileBytes })
    );

    setNamedFieldValue(panel, "manifestPath", "assets/sources/character/source.psd");
    setNamedFieldValue(panel, "sourceAssetId", "src_panel_selected_psd");
    setNamedFieldValue(panel, "creator", "Clean Artist");
    setNamedFieldValue(panel, "license", "private-review");
    setNamedFieldValue(panel, "sourceLayerId.0", "layer_face");
    setNamedFieldValue(panel, "originalName.0", "Face");
    setNamedFieldValue(panel, "normalizedName.0", "face");
    setNamedFieldValue(panel, "groupPath.0", "Root/Head");
    setNamedFieldValue(panel, "texturePreviewReference.0", "assets/sources/character/face.preview.png");
    setNamedFieldValue(panel, "textureId.0", "tex_face");
    setNamedFieldValue(panel, "targetPartId.0", "part_root");
    setNamedFieldFiles(panel, "sourceFileDraft", [
      {
        name: "sample_model.psd",
        size: 3,
        type: "application/vnd.adobe.photoshop",
        arrayBuffer: async () => new Uint8Array([0x50, 0x53, 0x44]).buffer
      }
    ]);
    findByTestId(panel, editorTestIds.sourceIntakeFileInput)?.emit("change");
    findByTestId(panel, editorTestIds.sourceIntakeForm)?.emit("submit");
    await Promise.resolve();
    await Promise.resolve();

    expect(calls).toHaveLength(1);
    expect(calls[0]?.draft).toMatchObject({
      selectedFile: {
        fileName: "sample_model.psd",
        byteLength: 3,
        declaredMediaType: "application/vnd.adobe.photoshop"
      }
    });
    expect(calls[0]?.selectedFileBytes).toMatchObject({
      fileName: "sample_model.psd",
      declaredMediaType: "application/vnd.adobe.photoshop",
      bytes: new Uint8Array([0x50, 0x53, 0x44])
    });
  });

  it("refreshes selected file rights and provenance summary after rights draft edits", () => {
    const panel = createPanel(
      createPsdAdapterProfileSourceIntakeDraftState({ defaultPartId: "part_root" })
    );

    setNamedFieldFiles(panel, "sourceFileDraft", [
      {
        name: "sample_model.psd",
        size: 4096,
        type: "application/vnd.adobe.photoshop"
      }
    ]);
    findByTestId(panel, editorTestIds.sourceIntakeFileInput)?.emit("change");

    const selectedFileSummary = findByTestId(panel, editorTestIds.sourceIntakeSelectedFile);
    expect(selectedFileSummary?.textContent).toContain("Needs review / No license");
    expect(selectedFileSummary?.textContent).toContain("No creator / No AI use");

    setNamedFieldValue(panel, "rightsStatus", "cleared");
    findNamedField(panel, "rightsStatus")?.emit("change");
    setNamedFieldValue(panel, "creator", "Clean Artist");
    findNamedField(panel, "creator")?.emit("input");
    setNamedFieldValue(panel, "license", "original-private-use");
    findNamedField(panel, "license")?.emit("input");
    setNamedFieldChecked(panel, "aiUsed", true);
    findNamedField(panel, "aiUsed")?.emit("change");

    expect(selectedFileSummary?.textContent).toContain("Cleared / original-private-use");
    expect(selectedFileSummary?.textContent).toContain("Clean Artist / AI used");
    expect(selectedFileSummary?.textContent).not.toMatch(
      /parsed from bytes|decoded from bytes|raster extraction|archive import|renderer correctness/i
    );
  });

  it("keeps invalid draft input local and reports diagnostics", () => {
    const calls: unknown[] = [];
    const panel = createPanel(createEmptySourceIntakeDraftState(), (draft) => calls.push(draft));

    setNamedFieldValue(panel, "manifestPath", "assets/sources/character/split-manifest.json");
    setNamedFieldValue(panel, "creator", "Clean Artist");
    setNamedFieldValue(panel, "license", "original-private-use");
    setNamedFieldValue(panel, "targetPartId.0", "part_root");
    setNamedFieldValue(panel, "width.0", "0");
    findByTestId(panel, editorTestIds.sourceIntakeForm)?.emit("submit");

    expect(calls).toEqual([]);
    const diagnostics = findByTestId(panel, editorTestIds.sourceIntakeDiagnostics);
    expect(diagnostics?.textContent).toContain(
      "Layer 1 bounds width and height must be greater than zero."
    );
    expect(diagnostics?.children[0]?.style.overflowWrap).toBe("anywhere");
  });

  it("reports invalid layer texture references and missing target part mappings locally", () => {
    const calls: unknown[] = [];
    const panel = createPanel(createEmptySourceIntakeDraftState(), (draft) => calls.push(draft));

    setNamedFieldValue(panel, "manifestPath", "assets/sources/character/split-manifest.json");
    setNamedFieldValue(panel, "creator", "Clean Artist");
    setNamedFieldValue(panel, "license", "original-private-use");
    setNamedFieldValue(panel, "texturePreviewReference.0", "https://example.invalid/face.png");
    setNamedFieldValue(panel, "targetPartId.0", "");
    findByTestId(panel, editorTestIds.sourceIntakeForm)?.emit("submit");

    expect(calls).toEqual([]);
    expect(findByTestId(panel, editorTestIds.sourceIntakeDiagnostics)?.textContent).toContain(
      "Layer 1 texture preview reference is invalid"
    );
    expect(findByTestId(panel, editorTestIds.sourceIntakeDiagnostics)?.textContent).toContain(
      "Layer 1 target part ID is required."
    );
  });

  it("rejects generated texture preview references locally instead of confirming the draft", () => {
    const calls: unknown[] = [];
    const panel = createPanel(
      createEmptySourceIntakeDraftState({ defaultPartId: "part_root" }),
      (draft) => calls.push(draft)
    );

    setNamedFieldValue(panel, "manifestPath", "assets/sources/character/split-manifest.json");
    setNamedFieldValue(panel, "creator", "Clean Artist");
    setNamedFieldValue(panel, "license", "original-private-use");
    setNamedFieldValue(panel, "texturePreviewReference.0", "generated://texture-preview/layer_face");
    findByTestId(panel, editorTestIds.sourceIntakeForm)?.emit("submit");

    expect(calls).toEqual([]);
    expect(findByTestId(panel, editorTestIds.sourceIntakeDiagnostics)?.textContent).toContain(
      "generated://texture-preview/ references are not supported"
    );
  });

  it("renders imported source asset rows for the create drawable handoff", () => {
    const draft = createEmptySourceIntakeDraftState({ defaultPartId: "part_root" });
    const panel = createPanel(draft, () => {}, [createImportedSourceAsset()]);

    expect(findByTestId(panel, editorTestIds.sourceIntakeImportedSources)?.textContent).toContain(
      "1 imported source asset"
    );
    expect(findByTestId(panel, "sourceIntake.imported.src_panel_split")?.textContent).toContain(
      "layer_face / Face.png -> face"
    );
    expect(findByTestId(panel, "sourceIntake.imported.src_panel_split")?.textContent).toContain(
      "1 mapped drawable"
    );
  });

  it("renders structured PSD profile evidence without parser or raster claims", () => {
    const draft = createEmptySourceIntakeDraftState({ defaultPartId: "part_root" });
    const panel = createPanel(draft, () => {}, [createImportedPsdSourceAsset()]);
    const row = findByTestId(panel, "sourceIntake.imported.src_panel_psd_profile");

    expect(row?.textContent).toContain(
      "Structured PSD profile metadata from manual-psd-profile-entry; editor did not parse PSD bytes."
    );
    expect(row?.textContent).toContain("manual-psd-profile-entry / adapter-supplied-metadata-v1");
    expect(row?.textContent).toContain("2048 x 3072");
    expect(row?.textContent).toContain("group_root_head / Root / Head");
    expect(row?.textContent).toContain("layer layer_face / psd.textLayer");
    expect(row?.textContent).toContain("adapter.psd.manualProfileMetadata");
    expect(row?.textContent).toContain(
      "assets/sources/panel/face.preview.png / tex_face / part_root"
    );
    expect(row?.textContent).not.toMatch(/file picker|parsed from bytes|decode|raster extraction/i);
    expect(
      row?.queryByPredicate((element) =>
        element.tagName === "section" &&
        element.getAttribute("aria-label") ===
          "Structured PSD profile metadata for src_panel_psd_profile"
      )
    ).not.toBeNull();
    expect(
      row?.queryByPredicate((element) =>
        element.tagName === "li" &&
        element.textContent.includes("adapter.psd.manualProfileMetadata")
      )?.style.overflowWrap
    ).toBe("anywhere");
  });

  it("renders package-local binary refs as metadata-only availability states", () => {
    const draft = createEmptySourceIntakeDraftState({ defaultPartId: "part_root" });
    const panel = createPanel(
      draft,
      () => {},
      [createImportedPsdSourceAssetWithBinaryRefs()],
      createTextureAtlasWithBinaryRef()
    );
    const row = findByTestId(panel, "sourceIntake.imported.src_panel_psd_profile");

    expect(row?.textContent).toContain("Binary asset references for src_panel_psd_profile");
    expect(row?.textContent).toContain(
      "Source binary ref / bin_panel_psd_source / missing-package-local-bytes-v1; package-local bytes are missing / assets/sources/panel/source.psd"
    );
    expect(row?.textContent).toContain("application/vnd.adobe.photoshop / 4096 bytes / sha256:aaaaaaaaaaaa...");
    expect(row?.textContent).toContain(
      "Texture binary ref tex_face / bin_panel_face_preview / storage-unsupported-v1; current workflow cannot store bytes / assets/sources/panel/face.preview.png"
    );
    expect(row?.textContent).toContain("image/png / 2048 bytes / sha256:bbbbbbbbbbbb...");
    expect(row?.textContent).toContain("metadata only; no editor file import or image decode");
    expect(row?.textContent).not.toMatch(/file picker|FileReader|readFile|decoded from bytes|parsed from bytes|raster extraction/i);
    expect(
      row?.queryByPredicate((element) =>
        element.tagName === "section" &&
        element.getAttribute("aria-label") ===
          "Binary asset references for src_panel_psd_profile"
      )
    ).not.toBeNull();
    expect(
      row?.queryByPredicate((element) =>
        element.tagName === "li" &&
        element.textContent.includes("bin_panel_face_preview")
      )?.style.overflowWrap
    ).toBe("anywhere");
  });
});

const createPanel = (
  draft = createEmptySourceIntakeDraftState(),
  onConfirmDraft: Parameters<typeof createSourceIntakePanel>[0]["onConfirmDraft"] = () => {},
  sourceAssets: readonly SourceAssetDto[] = [],
  textureAtlas?: TextureAtlasFileDto
): TestElement =>
  createSourceIntakePanel({
    draft,
    viewModel: projectSourceIntakeDraftViewModel(draft, {
      sourceAssets,
      ...(textureAtlas === undefined ? {} : { textureAtlas })
    }),
    onConfirmDraft
  }) as unknown as TestElement;

const findByTestId = (root: TestElement, testId: string): TestElement | null =>
  root.queryByPredicate((element) => element.dataset.testid === testId);

const findNamedField = (root: TestElement, name: string): TestElement | null =>
  root.queryByPredicate((element) => element.name === name);

const setNamedFieldValue = (root: TestElement, name: string, value: string): void => {
  const field = findNamedField(root, name);
  if (field === null) {
    throw new Error(`Missing form field ${name}`);
  }
  field.value = value;
};

const setNamedFieldChecked = (root: TestElement, name: string, checked: boolean): void => {
  const field = root.queryByPredicate((element) => element.name === name);
  if (field === null) {
    throw new Error(`Missing checkbox ${name}`);
  }
  field.checked = checked;
};

const setNamedFieldFiles = (
  root: TestElement,
  name: string,
  files: readonly TestFile[]
): void => {
  const field = findNamedField(root, name);
  if (field === null) {
    throw new Error(`Missing file field ${name}`);
  }
  field.files = createTestFileList(files);
};

interface TestFile {
  readonly name: string;
  readonly size: number;
  readonly type: string;
  readonly arrayBuffer?: () => Promise<ArrayBuffer>;
}

const createTestFileList = (files: readonly TestFile[]): FileList =>
  ({
    length: files.length,
    item(index: number): File | null {
      return (files[index] ?? null) as File | null;
    }
  }) as FileList;

class TestFormData {
  private readonly fields = new Map<string, string[]>();

  constructor(form: TestElement) {
    for (const field of form.queryAllByPredicate((element) => element.name.length > 0)) {
      if (field.type === "checkbox" && !field.checked) {
        continue;
      }
      this.fields.set(field.name, [...(this.fields.get(field.name) ?? []), field.value]);
    }
  }

  get(name: string): string | null {
    return this.fields.get(name)?.[0] ?? null;
  }

  getAll(name: string): readonly string[] {
    return this.fields.get(name) ?? [];
  }
}

class TestElement {
  readonly children: TestElement[] = [];
  readonly dataset: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, Array<(event: { preventDefault(): void }) => void>>();
  readonly style: Record<string, string> = {};
  parentElement: TestElement | null = null;
  className = "";
  id = "";
  type = "";
  min = "";
  max = "";
  step = "";
  value = "";
  name = "";
  autocomplete = "";
  required = false;
  checked = false;
  files: FileList | null = null;
  private ownText = "";

  constructor(readonly tagName: string) {}

  get textContent(): string {
    return `${this.ownText}${this.children.map((child) => child.textContent).join("")}`;
  }

  set textContent(value: string | null) {
    this.ownText = value ?? "";
    this.children.splice(0, this.children.length);
  }

  append(...nodes: Array<TestElement | string>): void {
    for (const node of nodes) {
      if (typeof node === "string") {
        const text = new TestElement("#text");
        text.textContent = node;
        this.append(text);
        continue;
      }

      node.parentElement = this;
      this.children.push(node);
    }
  }

  replaceChildren(...nodes: TestElement[]): void {
    this.children.splice(0, this.children.length);
    this.append(...nodes);
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
    if (name === "id") {
      this.id = value;
    }
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  addEventListener(type: string, listener: (event: { preventDefault(): void }) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  emit(type: string): void {
    const event = { preventDefault() {} };
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }

  queryByPredicate(predicate: (element: TestElement) => boolean): TestElement | null {
    if (predicate(this)) {
      return this;
    }

    for (const child of this.children) {
      const match = child.queryByPredicate(predicate);
      if (match !== null) {
        return match;
      }
    }

    return null;
  }

  queryAllByPredicate(predicate: (element: TestElement) => boolean): readonly TestElement[] {
    return [
      ...(predicate(this) ? [this] : []),
      ...this.children.flatMap((child) => child.queryAllByPredicate(predicate))
    ];
  }
}

const installTestDocument = (): void => {
  const document = {
    createElement(tagName: string) {
      return new TestElement(tagName);
    }
  };

  (globalThis as unknown as { document: Document }).document = document as unknown as Document;
};

const createImportedSourceAsset = (): SourceAssetDto => ({
  sourceAssetId: SourceAssetIdSchema.parse("src_panel_split"),
  kind: "split-png-set-v1",
  filePath: "assets/sources/panel/split-manifest.json",
  contentHash: "sha256:panel-split",
  importProfile: "split-png-fallback-v1",
  layers: [
    {
      sourceLayerId: "layer_face",
      sourceAssetId: SourceAssetIdSchema.parse("src_panel_split"),
      originalName: "Face.png",
      normalizedName: "face",
      groupPath: ["Head"],
      bounds: { x: 4, y: 6, width: 40, height: 50 },
      visibleInSource: true,
      opacityInSource: 1,
      role: "editableLayer",
      unsupportedFeatures: [],
      mappedDrawableIds: [DrawableIdSchema.parse("draw_panel_face")]
    }
  ],
  diagnostics: ["split-png-fallback-v1"]
});

const createImportedPsdSourceAsset = (): SourceAssetDto => ({
  sourceAssetId: SourceAssetIdSchema.parse("src_panel_psd_profile"),
  kind: "psd-source-v1",
  filePath: "assets/sources/panel/source.psd",
  contentHash: "sha256:panel-psd-reference",
  importProfile: "layered-character-psd-profile-v1",
  layers: [
    {
      sourceLayerId: "layer_face",
      sourceAssetId: SourceAssetIdSchema.parse("src_panel_psd_profile"),
      originalName: "Face",
      normalizedName: "face",
      groupPath: ["Root", "Head"],
      bounds: { x: 32, y: 48, width: 128, height: 160 },
      visibleInSource: true,
      opacityInSource: 0.8,
      role: "editableLayer",
      unsupportedFeatures: ["psd.textLayer"],
      mappedDrawableIds: [DrawableIdSchema.parse("draw_panel_face")]
    }
  ],
  diagnostics: ["adapter.psd.manualProfileMetadata: manual profile metadata"],
  psdProfile: {
    schemaVersion: "layered-character-psd-profile-v1",
    adapter: {
      adapterName: "manual-psd-profile-entry",
      adapterResultSchemaVersion: "psd-adapter-result-v1",
      sourceProfile: "layered-character-psd-profile-v1",
      evidenceKind: "adapter-supplied-metadata-v1"
    },
    canvas: {
      width: 2048,
      height: 3072,
      bounds: { x: 0, y: 0, width: 2048, height: 3072 }
    },
    sourceGroups: [
      {
        sourceGroupId: "group_root_head",
        originalName: "Head",
        normalizedName: "head",
        groupPath: ["Root", "Head"],
        sourceOrder: 0,
        visibleInSource: true,
        opacityInSource: 1,
        targetPartId: PartIdSchema.parse("part_root"),
        unsupportedFeatures: []
      }
    ],
    sourceLayers: [
      {
        sourceLayerId: "layer_face",
        originalName: "Face",
        normalizedName: "face",
        parentGroupId: "group_root_head",
        groupPath: ["Root", "Head"],
        sourceOrder: 1,
        bounds: { x: 32, y: 48, width: 128, height: 160 },
        visibleInSource: true,
        opacityInSource: 0.8,
        role: "editableLayer",
        unsupportedFeatures: [
          {
            featureId: "psd.textLayer",
            scope: "layer",
            severity: "warning",
            message:
              "Text layer metadata was supplied by the adapter profile and needs manual review.",
            source: { kind: "layer", id: "layer_face" },
            rasterizeCandidate: false,
            manualConfirmationRequired: true
          }
        ],
        texturePreviewReference: "assets/sources/panel/face.preview.png",
        textureId: TextureIdSchema.parse("tex_face"),
        targetPartId: PartIdSchema.parse("part_root")
      }
    ],
    unsupportedFeatures: [],
    diagnostics: [
      {
        checkId: "adapter.psd.manualProfileMetadata",
        severity: "info",
        message:
          "Manual PSD adapter/profile metadata was supplied; no editor PSD byte parsing occurred.",
        source: { kind: "adapter", path: "/source-intake" },
        evidence: ["source-intake-mode:psdAdapterProfile"]
      }
    ],
    compatibility: {
      structuredProfilePrecedence: "structured-profile-preferred-v1",
      flattenedDiagnosticsFallback: "sourceAsset.diagnostics-summary-fallback-v1",
      flattenedUnsupportedFeaturesFallback:
        "sourceLayer.unsupportedFeatures-feature-id-fallback-v1"
    }
  }
});

const createImportedPsdSourceAssetWithBinaryRefs = (): SourceAssetDto => ({
  ...createImportedPsdSourceAsset(),
  binaryAssetRef: createBinaryAssetReference({
    binaryAssetId: "bin_panel_psd_source",
    packageRelativePath: "assets/sources/panel/source.psd",
    mediaType: "application/vnd.adobe.photoshop",
    byteLength: 4096,
    storageStatus: "missing-package-local-bytes-v1",
    digestHex: "a".repeat(64)
  })
});

const createTextureAtlasWithBinaryRef = (): TextureAtlasFileDto => ({
  schemaVersion: "texture-atlas-v1",
  textures: [
    {
      textureId: TextureIdSchema.parse("tex_face"),
      filePath: "assets/textures/tex_face.png",
      sourceAssetId: SourceAssetIdSchema.parse("src_panel_psd_profile"),
      sourceLayerId: "layer_face",
      provenanceId: ProvenanceIdSchema.parse("prov_panel_psd_profile"),
      binaryAssetRef: createBinaryAssetReference({
        binaryAssetId: "bin_panel_face_preview",
        packageRelativePath: "assets/sources/panel/face.preview.png",
        mediaType: "image/png",
        byteLength: 2048,
        storageStatus: "storage-unsupported-v1",
        digestHex: "b".repeat(64)
      })
    }
  ]
});

const createBinaryAssetReference = (input: {
  readonly binaryAssetId: string;
  readonly packageRelativePath: string;
  readonly mediaType: string;
  readonly byteLength: number;
  readonly storageStatus: BinaryAssetReferenceDto["storageStatus"];
  readonly digestHex: string;
}): BinaryAssetReferenceDto => ({
  referenceKind: "package-binary-asset-ref-v1",
  binaryAssetId: input.binaryAssetId,
  packageRelativePath: input.packageRelativePath,
  digest: {
    algorithm: "sha256",
    hex: input.digestHex
  },
  byteLength: input.byteLength,
  mediaType: input.mediaType,
  storageStatus: input.storageStatus,
  provenanceId: ProvenanceIdSchema.parse("prov_panel_psd_profile"),
  rightsAssetId: "src_panel_psd_profile"
});

const createUnsupportedPsdDraft = () => ({
  ...createPsdAdapterProfileSourceIntakeDraftState({ defaultPartId: "part_root" }),
  manifestPath: "assets/sources/character/source.psd",
  layers: [
    {
      sourceLayerId: "layer_unsupported",
      originalName: "Unsupported Text",
      normalizedName: "unsupported_text",
      groupPath: ["Root"],
      bounds: { x: 0, y: 0, width: 64, height: 64 },
      visibleInSource: true,
      opacityInSource: 1,
      role: "unsupported",
      unsupportedFeatures: ["psd.textLayer"],
      texturePreviewReference: "",
      textureId: "",
      targetPartId: ""
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
  },
  diagnostics: []
} as const);
