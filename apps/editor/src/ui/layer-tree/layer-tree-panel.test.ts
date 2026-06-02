import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createLayerTreeDrawablePartDraftFormTestId,
  createLayerTreeDrawablePartDraftSubmitTestId,
  createLayerTreeDrawableRowTestId,
  createLayerTreeDrawableTextureDraftFormTestId,
  createLayerTreeDrawableTextureDraftSubmitTestId,
  createLayerTreeEmptyLeafDeleteDraftTestId,
  createLayerTreePartReparentFormTestId,
  createLayerTreePartReparentSubmitTestId,
  createLayerTreePartGroupTestId,
  createLayerTreePartRenameFormTestId,
  createLayerTreePartRenameSubmitTestId,
  createLayerTreeSelectDrawableTestId,
  createLayerTreeToggleEditorHiddenTestId,
  createLayerTreeToggleLockTestId,
  editorTestIds,
  type LayerTreeDrawableDirectManipulationViewModel,
  type LayerTreeViewModel,
  type LayerTreePartDirectManipulationViewModel,
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

  it("dispatches row-level direct manipulation draft controls", () => {
    const calls: unknown[] = [];
    const panel = createLayerTreePanel({
      viewModel: createLayerTreeViewModel({ includeEmptyPart: true }),
      workflow: createPartTextureWorkflowViewModel(),
      onCreatePart: () => {},
      onUpdatePart: () => {},
      onSetDrawablePart: () => {},
      onSetDrawableTexture: () => {},
      onSelectDrawable: () => {},
      onToggleDrawableLock: () => {},
      onToggleDrawableEditorHidden: () => {},
      onDraftPartRename: (command) => calls.push(["renameDraft", command.partId, command.displayName]),
      onDraftPartReparent: (command) =>
        calls.push(["reparentDraft", command.partId, command.parentPartId]),
      onDraftEmptyLeafPartDelete: (command) => calls.push(["deleteDraft", command.partId]),
      onDraftDrawablePartAssignment: (command) =>
        calls.push(["drawablePartDraft", command.drawableId, command.partId]),
      onDraftDrawableTextureAssignment: (command) =>
        calls.push(["drawableTextureDraft", command.drawableId, command.textureId])
    }) as unknown as TestElement;

    const renameForm = findByTestId(panel, createLayerTreePartRenameFormTestId("part_face"));
    const renameInput = renameForm?.queryByPredicate((element) => element.tagName === "input");
    if (renameInput !== null && renameInput !== undefined) {
      renameInput.value = "Face Draft";
    }
    renameForm?.emit("submit");

    const reparentForm = findByTestId(panel, createLayerTreePartReparentFormTestId("part_face"));
    const reparentSelect = reparentForm?.queryByPredicate((element) => element.tagName === "select");
    if (reparentSelect !== null && reparentSelect !== undefined) {
      reparentSelect.value = "";
    }
    reparentForm?.emit("submit");

    findByTestId(panel, createLayerTreeEmptyLeafDeleteDraftTestId("part_empty"))?.emit("click");

    const drawablePartForm = findByTestId(
      panel,
      createLayerTreeDrawablePartDraftFormTestId("draw_eye")
    );
    const drawablePartSelect = drawablePartForm?.queryByPredicate(
      (element) => element.tagName === "select"
    );
    if (drawablePartSelect !== null && drawablePartSelect !== undefined) {
      drawablePartSelect.value = "part_root";
    }
    drawablePartForm?.emit("submit");

    const drawableTextureForm = findByTestId(
      panel,
      createLayerTreeDrawableTextureDraftFormTestId("draw_eye")
    );
    const drawableTextureSelect = drawableTextureForm?.queryByPredicate(
      (element) => element.tagName === "select"
    );
    if (drawableTextureSelect !== null && drawableTextureSelect !== undefined) {
      drawableTextureSelect.value = "tex_body";
    }
    drawableTextureForm?.emit("submit");

    expect(findByTestId(panel, createLayerTreePartRenameSubmitTestId("part_face"))?.disabled).toBe(false);
    expect(findByTestId(panel, createLayerTreePartReparentSubmitTestId("part_face"))?.disabled).toBe(false);
    expect(findByTestId(panel, createLayerTreeDrawablePartDraftSubmitTestId("draw_eye"))?.disabled).toBe(false);
    expect(findByTestId(panel, createLayerTreeDrawableTextureDraftSubmitTestId("draw_eye"))?.disabled).toBe(false);
    expect(calls).toEqual([
      ["renameDraft", "part_face", "Face Draft"],
      ["reparentDraft", "part_face", null],
      ["deleteDraft", "part_empty"],
      ["drawablePartDraft", "draw_eye", "part_root"],
      ["drawableTextureDraft", "draw_eye", "tex_body"]
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

const createLayerTreeViewModel = (
  options: { readonly includeEmptyPart?: boolean } = {}
): LayerTreeViewModel => {
  const partGroups: LayerTreeViewModel["partGroups"] = [
    {
      partId: "part_root",
      displayName: "Root",
      parentPartId: null,
      depth: 0,
      partStatus: "resolved",
      partLabel: "Root / part_root",
      drawableCount: 1,
      drawableCountLabel: "1 drawable",
      directManipulation: createPartDirectManipulation({
        partId: "part_root",
        displayName: "Root",
        parentPartId: null,
        canDraftReparent: false,
        reparentDisabledMessage: "No other parent available",
        canDraftEmptyLeafDelete: false,
        emptyLeafDeleteDisabledMessage: "Part has child parts"
      }),
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
          stateLabel: "Texture resolved / Runtime visible / Editor visible / Locked / Not selected",
          directManipulation: createDrawableDirectManipulation({
            drawableId: "draw_body",
            partId: "part_root",
            textureId: "tex_body",
            locked: true
          })
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
      directManipulation: createPartDirectManipulation({
        partId: "part_face",
        displayName: "Face",
        parentPartId: "part_root",
        canDraftReparent: true,
        canDraftEmptyLeafDelete: false,
        emptyLeafDeleteDisabledMessage: "Part has drawables"
      }),
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
          stateLabel: "Texture missing / Runtime hidden / Editor hidden / Unlocked / Selected",
          directManipulation: createDrawableDirectManipulation({
            drawableId: "draw_eye",
            partId: "part_face",
            textureId: "tex_missing",
            locked: false
          })
        }
      ]
    },
    ...(options.includeEmptyPart === true
      ? [
          {
            partId: "part_empty",
            displayName: "Empty",
            parentPartId: "part_root",
            depth: 1,
            partStatus: "resolved" as const,
            partLabel: "Empty / part_empty",
            drawableCount: 0,
            drawableCountLabel: "0 drawables",
            directManipulation: createPartDirectManipulation({
              partId: "part_empty",
              displayName: "Empty",
              parentPartId: "part_root",
              canDraftReparent: true,
              canDraftEmptyLeafDelete: true,
              emptyLeafDeleteDisabledMessage: null
            }),
            drawables: []
          }
        ]
      : [])
  ];

  return {
    partGroups,
    hasParts: true,
    hasDrawables: true,
    drawableCount: 2,
    selectedDrawableIds: ["draw_eye"],
    lockedDrawableIds: ["draw_body"],
    editorHiddenDrawableIds: ["draw_eye"],
    missingTextureDrawableIds: ["draw_eye"],
    directManipulationDraftCount: 0,
    partCountLabel: `${partGroups.length} part group${partGroups.length === 1 ? "" : "s"}`,
    drawableCountLabel: "2 drawables",
    selectedCountLabel: "1 selected drawable",
    lockedCountLabel: "1 locked drawable",
    editorHiddenCountLabel: "1 editor-hidden drawable",
    missingTextureCountLabel: "1 missing texture",
    directManipulationDraftCountLabel: "0 direct drafts",
    directManipulationSummaryLabel: "No direct manipulation drafts",
    summaryLabel: `${partGroups.length} part group${partGroups.length === 1 ? "" : "s"} / 2 drawables / 1 selected / 1 locked / 1 editor-hidden / 1 missing texture`
  };
};

const createPartDirectManipulation = (input: {
  readonly partId: string;
  readonly displayName: string;
  readonly parentPartId: string | null;
  readonly canDraftReparent: boolean;
  readonly reparentDisabledMessage?: string | null;
  readonly canDraftEmptyLeafDelete: boolean;
  readonly emptyLeafDeleteDisabledMessage: string | null;
}): LayerTreePartDirectManipulationViewModel => ({
  partId: input.partId,
  currentDisplayName: input.displayName,
  renameValue: input.displayName,
  renameDrafted: false,
  canDraftRename: true,
  renameDisabledMessage: null,
  currentParentPartId: input.parentPartId,
  parentPartId: input.parentPartId,
  parentOptionValue: input.parentPartId ?? "",
  parentOptions: [
    { value: "", partId: null, label: "No parent", disabled: false },
    { value: "part_root", partId: "part_root", label: "Root / part_root", disabled: false },
    { value: "part_face", partId: "part_face", label: "Face / part_face", disabled: false }
  ].filter((option) => option.partId !== input.partId),
  reparentDrafted: false,
  canDraftReparent: input.canDraftReparent,
  reparentDisabledMessage:
    input.reparentDisabledMessage === undefined ? null : input.reparentDisabledMessage,
  emptyLeafDeleteDrafted: false,
  canDraftEmptyLeafDelete: input.canDraftEmptyLeafDelete,
  emptyLeafDeleteDisabledMessage: input.emptyLeafDeleteDisabledMessage,
  statusLabel: "No part direct draft"
});

const createDrawableDirectManipulation = (input: {
  readonly drawableId: string;
  readonly partId: string;
  readonly textureId: string;
  readonly locked: boolean;
}): LayerTreeDrawableDirectManipulationViewModel => ({
  drawableId: input.drawableId,
  currentPartId: input.partId,
  partId: input.partId,
  partOptionValue: input.partId,
  partOptions: [
    { value: "part_root", partId: "part_root", label: "Root / part_root", disabled: false },
    { value: "part_face", partId: "part_face", label: "Face / part_face", disabled: false }
  ],
  partAssignmentDrafted: false,
  canDraftPartAssignment: !input.locked,
  partAssignmentDisabledMessage: input.locked ? "Drawable is locked" : null,
  currentTextureId: input.textureId,
  textureId: input.textureId,
  textureOptionValue: input.textureId,
  textureOptions: [
    {
      value: "tex_body",
      textureId: "tex_body",
      label: "tex_body / assets/textures/body.png",
      disabled: false
    }
  ],
  textureAssignmentDrafted: false,
  canDraftTextureAssignment: !input.locked && input.textureId !== "tex_body",
  textureAssignmentDisabledMessage:
    input.locked || input.textureId === "tex_body" ? "No other texture atlas entry" : null,
  statusLabel: "No drawable direct draft"
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
