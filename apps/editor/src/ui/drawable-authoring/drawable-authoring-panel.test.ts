import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DrawableIdSchema,
  MeshIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";

import {
  createDrawableRowTestId,
  editorTestIds,
  projectEditorWorkflowViewModel,
  projectLoadedPackageState
} from "../../editor-state/index.js";
import { createDrawableAuthoringPanel } from "./drawable-authoring-panel.js";

describe("drawable authoring panel", () => {
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

  it("renders defaults, result state, and the existing drawable list", () => {
    const state = createDrawableState();
    const panel = createPanel(state);

    expect(findByTestId(panel, editorTestIds.drawableAuthoringPanel)?.getAttribute("aria-labelledby")).toBe(
      "editor-drawable-authoring-heading"
    );
    expect(findByTestId(panel, editorTestIds.drawableCreateForm)?.textContent).toContain("Shape preset");
    expect(findByTestId(panel, editorTestIds.drawableResult)?.textContent).toContain("Drawable preset ready");
    expect(findByTestId(panel, createDrawableRowTestId("draw_body"))?.textContent).toContain("Body");
  });

  it("submits a valid generated drawable preset command", () => {
    const state = createDrawableState();
    const calls: unknown[] = [];
    const panel = createPanel(state, (command) => calls.push(command));

    setNamedFieldValue(panel, "displayName", "Runtime Oracle");
    setNamedFieldValue(panel, "x", "12");
    setNamedFieldValue(panel, "y", "18");
    setNamedFieldValue(panel, "width", "36");
    setNamedFieldValue(panel, "height", "44");
    findByTestId(panel, editorTestIds.drawableCreateForm)?.emit("submit");

    expect(calls).toEqual([
      {
        displayName: "Runtime Oracle",
        sourceAssetId: "src_generated",
        sourceLayerId: "layer_body",
        partId: "part_root",
        initialBounds: { x: 12, y: 18, width: 36, height: 44 },
        meshMethod: "auto-grid-v1",
        densityHint: "medium"
      }
    ]);
  });

  it("shows a graceful invalid state instead of calling the submit callback", () => {
    const state = createDrawableState();
    const calls: unknown[] = [];
    const panel = createPanel(state, (command) => calls.push(command));

    setNamedFieldValue(panel, "width", "0");
    findByTestId(panel, editorTestIds.drawableCreateForm)?.emit("submit");

    expect(calls).toEqual([]);
    expect(findByTestId(panel, editorTestIds.drawableCreateForm)?.textContent).toContain(
      "Bounds width and height must be greater than zero."
    );
  });

  it("disables submit when drawable authoring is unavailable", () => {
    const state = projectLoadedPackageState({
      identity: {
        packageId: "pkg_without_drawable_defaults",
        packageDisplayName: "No Defaults",
        formatVersion: "open-model-package-v1"
      },
      revision: {
        packageRevision: 0,
        authoringRevision: 0
      }
    });
    const panel = createPanel(state);

    expect(findByTestId(panel, editorTestIds.drawableCreateSubmit)?.disabled).toBe(true);
    expect(findByTestId(panel, editorTestIds.drawableList)?.textContent).toContain("No drawables yet.");
  });
});

const createPanel = (
  state: ReturnType<typeof createDrawableState>,
  onSubmit: Parameters<typeof createDrawableAuthoringPanel>[0]["onCommitCreateDrawable"] = () => {}
): TestElement =>
  createDrawableAuthoringPanel({
    state,
    viewModel: projectEditorWorkflowViewModel(state),
    onCommitCreateDrawable: onSubmit
  }) as unknown as TestElement;

const createDrawableState = () =>
  projectLoadedPackageState({
    identity: {
      packageId: "pkg_drawable_ui",
      packageDisplayName: "Drawable UI",
      formatVersion: "open-model-package-v1"
    },
    revision: {
      packageRevision: 0,
      authoringRevision: 0
    },
    sourceAssets: [
      {
        sourceAssetId: SourceAssetIdSchema.parse("src_generated"),
        kind: "generated-fixture-v1",
        filePath: "assets/generated.json",
        contentHash: "sha256:generated",
        importProfile: "split-png-fallback-v1",
        layers: [
          {
            sourceLayerId: "layer_body",
            sourceAssetId: SourceAssetIdSchema.parse("src_generated"),
            originalName: "Body",
            normalizedName: "body",
            groupPath: ["Root"],
            bounds: { x: 24, y: 16, width: 48, height: 64 },
            visibleInSource: true,
            opacityInSource: 1,
            role: "editableLayer",
            unsupportedFeatures: [],
            mappedDrawableIds: [DrawableIdSchema.parse("draw_body")]
          }
        ],
        diagnostics: []
      }
    ],
    parts: [
      {
        partId: PartIdSchema.parse("part_root"),
        displayName: "Root",
        childPartIds: [],
        drawableIds: [DrawableIdSchema.parse("draw_body")]
      }
    ],
    drawables: [
      {
        drawableId: DrawableIdSchema.parse("draw_body"),
        displayName: "Body",
        partId: PartIdSchema.parse("part_root"),
        sourceAssetId: SourceAssetIdSchema.parse("src_generated"),
        textureId: TextureIdSchema.parse("tex_body"),
        meshId: MeshIdSchema.parse("mesh_body"),
        defaultOpacity: 1,
        runtimeVisibility: true,
        baseDrawOrder: 0,
        sourceProvenanceId: ProvenanceIdSchema.parse("prov_body")
      }
    ],
    meshes: [
      {
        meshId: MeshIdSchema.parse("mesh_body"),
        drawableId: DrawableIdSchema.parse("draw_body"),
        vertices: [
          { x: 24, y: 16 },
          { x: 72, y: 16 },
          { x: 48, y: 80 }
        ],
        uvs: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0.5, y: 1 }
        ],
        triangles: [[0, 1, 2]],
        vertexStableIds: ["v0", "v1", "v2"],
        bounds: { x: 24, y: 16, width: 48, height: 64 },
        generationProvenanceId: ProvenanceIdSchema.parse("prov_body")
      }
    ]
  });

const findByTestId = (root: TestElement, testId: string): TestElement | null =>
  root.queryByPredicate((element) => element.dataset.testid === testId);

const setNamedFieldValue = (root: TestElement, name: string, value: string): void => {
  const field = root.queryByPredicate((element) => element.name === name);
  if (field === null) {
    throw new Error(`Missing form field ${name}`);
  }
  field.value = value;
};

class TestFormData {
  private readonly fields = new Map<string, string>();

  constructor(form: TestElement) {
    for (const field of form.queryAllByPredicate((element) => element.name.length > 0)) {
      this.fields.set(field.name, field.value);
    }
  }

  get(name: string): string | null {
    return this.fields.get(name) ?? null;
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
  htmlFor = "";
  type = "";
  min = "";
  step = "";
  value = "";
  name = "";
  autocomplete = "";
  required = false;
  disabled = false;
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
