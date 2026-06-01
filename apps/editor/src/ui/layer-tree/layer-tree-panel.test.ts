import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createLayerTreeDrawableRowTestId,
  createLayerTreePartGroupTestId,
  createLayerTreeSelectDrawableTestId,
  createLayerTreeToggleEditorHiddenTestId,
  createLayerTreeToggleLockTestId,
  editorTestIds,
  type LayerTreeViewModel,
  type PartTextureWorkflowViewModel
} from "../../editor-state/index.js";

import { createLayerTreePanel } from "./layer-tree-panel.js";

describe("layer tree panel", () => {
  beforeEach(() => {
    installTestDocument();
  });

  afterEach(() => {
    delete (globalThis as Partial<{ document: Document }>).document;
  });

  it("renders part-grouped drawable state and dispatches draft callbacks", () => {
    const calls: unknown[] = [];
    const panel = createLayerTreePanel({
      viewModel: createLayerTreeViewModel(),
      workflow: createPartTextureWorkflowViewModel(),
      onCreatePart: (command) => calls.push(["createPart", command.displayName, command.parentPartId]),
      onUpdatePart: (command) => calls.push(["updatePart", command.partId, command.displayName]),
      onSetDrawablePart: (command) => calls.push(["setDrawablePart", command.drawableId, command.partId]),
      onSetDrawableTexture: (command) => calls.push(["setDrawableTexture", command.drawableId, command.textureId]),
      onSelectDrawable: (drawableId) => calls.push(["select", drawableId]),
      onToggleDrawableLock: (drawableId) => calls.push(["lock", drawableId]),
      onToggleDrawableEditorHidden: (drawableId) => calls.push(["editorHidden", drawableId])
    }) as unknown as TestElement;

    expect(findByTestId(panel, editorTestIds.layerTreePanel)?.getAttribute("aria-labelledby")).toBe(
      "editor-layer-tree-heading"
    );
    expect(findByTestId(panel, editorTestIds.layerTreeSummary)?.textContent).toBe(
      "2 part groups / 2 drawables / 1 selected / 1 locked / 1 editor-hidden / 1 missing texture"
    );
    expect(findByTestId(panel, createLayerTreePartGroupTestId("part_face"))?.dataset.depth).toBe("1");
    expect(findByTestId(panel, createLayerTreeDrawableRowTestId("draw_eye"))?.textContent).toContain(
      "Texture missing / Runtime hidden / Editor hidden / Unlocked / Selected"
    );
    expect(findByTestId(panel, createLayerTreeSelectDrawableTestId("draw_eye"))?.getAttribute("aria-pressed")).toBe(
      "true"
    );
    expect(findByTestId(panel, createLayerTreeToggleLockTestId("draw_body"))?.getAttribute("aria-pressed")).toBe(
      "true"
    );

    findByTestId(panel, createLayerTreeSelectDrawableTestId("draw_eye"))?.emit("click");
    findByTestId(panel, createLayerTreeToggleLockTestId("draw_body"))?.emit("click");
    findByTestId(panel, createLayerTreeToggleEditorHiddenTestId("draw_eye"))?.emit("click");

    expect(calls).toEqual([
      ["select", "draw_eye"],
      ["lock", "draw_body"],
      ["editorHidden", "draw_eye"]
    ]);
  });

  it("dispatches part and texture workflow forms", () => {
    const calls: unknown[] = [];
    const panel = createLayerTreePanel({
      viewModel: createLayerTreeViewModel(),
      workflow: createPartTextureWorkflowViewModel(),
      onCreatePart: (command) => calls.push(["createPart", command.displayName, command.parentPartId]),
      onUpdatePart: (command) => calls.push(["updatePart", command.partId, command.displayName]),
      onSetDrawablePart: (command) => calls.push(["setDrawablePart", command.drawableId, command.partId]),
      onSetDrawableTexture: (command) => calls.push(["setDrawableTexture", command.drawableId, command.textureId]),
      onSelectDrawable: () => {},
      onToggleDrawableLock: () => {},
      onToggleDrawableEditorHidden: () => {}
    }) as unknown as TestElement;

    findByTestId(panel, editorTestIds.layerTreeCreatePartForm)?.emit("submit");
    findByTestId(panel, editorTestIds.layerTreeUpdatePartForm)?.emit("submit");
    findByTestId(panel, editorTestIds.layerTreeAssignPartForm)?.emit("submit");
    findByTestId(panel, editorTestIds.layerTreeAssignTextureForm)?.emit("submit");

    expect(calls).toEqual([
      ["createPart", "New Part", "part_root"],
      ["updatePart", "part_root", "Root"],
      ["setDrawablePart", "draw_body", "part_root"],
      ["setDrawableTexture", "draw_body", "tex_body"]
    ]);
  });

  it("constrains long texture selector labels for responsive layout", () => {
    const longTextureLabel = "tex_psd_e2e_face / assets/textures/tex_psd_e2e_face.png";
    const workflow: PartTextureWorkflowViewModel = {
      ...createPartTextureWorkflowViewModel(),
      textureOptions: [
        {
          textureId: "tex_psd_e2e_face",
          filePath: "assets/textures/tex_psd_e2e_face.png",
          label: longTextureLabel
        }
      ],
      defaultTextureId: "tex_psd_e2e_face"
    };
    const panel = createLayerTreePanel({
      viewModel: createLayerTreeViewModel(),
      workflow,
      onCreatePart: () => {},
      onUpdatePart: () => {},
      onSetDrawablePart: () => {},
      onSetDrawableTexture: () => {},
      onSelectDrawable: () => {},
      onToggleDrawableLock: () => {},
      onToggleDrawableEditorHidden: () => {}
    }) as unknown as TestElement;

    const textureForm = findByTestId(panel, editorTestIds.layerTreeAssignTextureForm);
    const textureSelect = textureForm?.queryByPredicate(
      (element) => element.tagName === "select" && element.getAttribute("title") === longTextureLabel
    );

    expect(textureForm?.getAttribute("style")).toContain("minmax(min(100%, 12rem), 1fr)");
    expect(textureSelect?.getAttribute("style")).toContain("max-width: 100%");
    expect(textureSelect?.parentElement?.className).toContain("editor-field");
    expect(textureSelect?.parentElement?.getAttribute("style")).toContain("overflow-wrap: anywhere");
  });
});

const createPartTextureWorkflowViewModel = (): PartTextureWorkflowViewModel => ({
  partOptions: [
    { partId: "part_root", displayName: "Root", label: "Root / part_root" },
    { partId: "part_face", displayName: "Face", label: "Face / part_face" }
  ],
  drawableOptions: [
    {
      drawableId: "draw_body",
      displayName: "Body",
      partId: "part_root",
      textureId: "tex_body",
      label: "Body / draw_body"
    },
    {
      drawableId: "draw_eye",
      displayName: "Eye",
      partId: "part_face",
      textureId: "tex_missing",
      label: "Eye / draw_eye"
    }
  ],
  textureOptions: [
    {
      textureId: "tex_body",
      filePath: "assets/textures/body.png",
      label: "tex_body / assets/textures/body.png"
    }
  ],
  canCreatePart: true,
  canUpdatePart: true,
  canAssignDrawablePart: true,
  canAssignDrawableTexture: true,
  defaultCreatePartName: "New Part",
  defaultUpdatePartName: "Root",
  defaultParentPartId: "part_root",
  defaultUpdatePartId: "part_root",
  defaultDrawableId: "draw_body",
  defaultTargetPartId: "part_root",
  defaultTextureId: "tex_body",
  textureAssignmentStatusLabel: "1 texture atlas entry",
  partAssignmentStatusLabel: "2 parts / 2 drawables"
});

const createLayerTreeViewModel = (): LayerTreeViewModel => ({
  partGroups: [
    {
      partId: "part_root",
      displayName: "Root",
      parentPartId: null,
      depth: 0,
      partStatus: "resolved",
      partLabel: "Root / part_root",
      drawableCount: 1,
      drawableCountLabel: "1 drawable",
      drawables: [
        {
          drawableId: "draw_body",
          displayName: "Body",
          partId: "part_root",
          partStatus: "resolved",
          textureId: "tex_body",
          textureStatus: "resolved",
          textureFilePath: "assets/textures/body.png",
          textureLabel: "tex_body / assets/textures/body.png",
          textureStatusLabel: "Texture resolved",
          runtimeVisible: true,
          runtimeVisibilityLabel: "Runtime visible",
          editorHidden: false,
          editorVisibilityLabel: "Editor visible",
          locked: true,
          lockedLabel: "Locked",
          selected: false,
          selectedLabel: "Not selected",
          orderLabel: "Layer 1 / draw order 0",
          stateLabel: "Texture resolved / Runtime visible / Editor visible / Locked / Not selected"
        }
      ]
    },
    {
      partId: "part_face",
      displayName: "Face",
      parentPartId: "part_root",
      depth: 1,
      partStatus: "resolved",
      partLabel: "Face / part_face",
      drawableCount: 1,
      drawableCountLabel: "1 drawable",
      drawables: [
        {
          drawableId: "draw_eye",
          displayName: "Eye",
          partId: "part_face",
          partStatus: "resolved",
          textureId: "tex_missing",
          textureStatus: "missing",
          textureFilePath: null,
          textureLabel: "Missing texture tex_missing",
          textureStatusLabel: "Texture missing",
          runtimeVisible: false,
          runtimeVisibilityLabel: "Runtime hidden",
          editorHidden: true,
          editorVisibilityLabel: "Editor hidden",
          locked: false,
          lockedLabel: "Unlocked",
          selected: true,
          selectedLabel: "Selected",
          orderLabel: "Layer 2 / draw order 1",
          stateLabel: "Texture missing / Runtime hidden / Editor hidden / Unlocked / Selected"
        }
      ]
    }
  ],
  hasParts: true,
  hasDrawables: true,
  drawableCount: 2,
  selectedDrawableIds: ["draw_eye"],
  lockedDrawableIds: ["draw_body"],
  editorHiddenDrawableIds: ["draw_eye"],
  missingTextureDrawableIds: ["draw_eye"],
  partCountLabel: "2 part groups",
  drawableCountLabel: "2 drawables",
  selectedCountLabel: "1 selected drawable",
  lockedCountLabel: "1 locked drawable",
  editorHiddenCountLabel: "1 editor-hidden drawable",
  missingTextureCountLabel: "1 missing texture",
  summaryLabel: "2 part groups / 2 drawables / 1 selected / 1 locked / 1 editor-hidden / 1 missing texture"
});

const findByTestId = (root: TestElement, testId: string): TestElement | null =>
  root.queryByPredicate((element) => element.dataset.testid === testId);

class TestElement {
  readonly children: TestElement[] = [];
  readonly dataset: Record<string, string> = {};
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, Array<(event?: { readonly preventDefault: () => void }) => void>>();
  parentElement: TestElement | null = null;
  className = "";
  id = "";
  type = "";
  value = "";
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

  addEventListener(type: string, listener: (event?: { readonly preventDefault: () => void }) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  emit(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ preventDefault() {} });
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
}

const installTestDocument = (): void => {
  const document = {
    createElement(tagName: string) {
      return new TestElement(tagName);
    }
  };

  (globalThis as unknown as { document: Document }).document = document as unknown as Document;
};
