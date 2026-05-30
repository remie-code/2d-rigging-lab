import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DrawableIdSchema,
  SourceAssetIdSchema
} from "@private-2d-rigging-lab/contracts";
import type { SourceAssetDto } from "@private-2d-rigging-lab/package-format";

import {
  createEmptySourceIntakeDraftState,
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
      "Split PNG manifest path"
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
    expect(findByTestId(panel, editorTestIds.sourceIntakeDiagnostics)?.textContent).toContain(
      "Layer 1 bounds width and height must be greater than zero."
    );
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
});

const createPanel = (
  draft = createEmptySourceIntakeDraftState(),
  onConfirmDraft: Parameters<typeof createSourceIntakePanel>[0]["onConfirmDraft"] = () => {},
  sourceAssets: readonly SourceAssetDto[] = []
): TestElement =>
  createSourceIntakePanel({
    draft,
    viewModel: projectSourceIntakeDraftViewModel(draft, { sourceAssets }),
    onConfirmDraft
  }) as unknown as TestElement;

const findByTestId = (root: TestElement, testId: string): TestElement | null =>
  root.queryByPredicate((element) => element.dataset.testid === testId);

const setNamedFieldValue = (root: TestElement, name: string, value: string): void => {
  const field = root.queryByPredicate((element) => element.name === name);
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
