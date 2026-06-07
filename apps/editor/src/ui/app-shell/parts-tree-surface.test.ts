import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createDrawableMoveDownTestId,
  createDrawableRowTestId,
  createDrawableVisibilityToggleTestId,
  createLayerTreeDrawableRowTestId,
  createLayerTreeSelectDrawableTestId,
  editorTestIds,
  type LayerTreeDrawableDirectManipulationViewModel,
  type LayerTreePartDirectManipulationViewModel,
  type LayerTreeViewModel,
  type PartTextureWorkflowViewModel
} from "../../editor-state/index.js";
import { createPartsTreeSurface } from "./parts-tree-surface.js";

describe("parts tree surface", () => {
  beforeEach(() => {
    installTestDocument();
  });

  afterEach(() => {
    delete (globalThis as Partial<{ document: Document }>).document;
  });

  it("wraps existing structure and drawable row controls without owning global integration", () => {
    const calls: unknown[] = [];
    const surface = createPartsTreeSurface({
      layerTree: {
        viewModel: createLayerTreeViewModel(),
        workflow: createPartTextureWorkflowViewModel(),
        onCreatePart: () => {},
        onUpdatePart: () => {},
        onSetDrawablePart: () => {},
        onSetDrawableTexture: () => {},
        onSelectDrawable: (drawableId) => calls.push(["select", drawableId]),
        onToggleDrawableLock: (drawableId) => calls.push(["lock", drawableId]),
        onToggleDrawableEditorHidden: (drawableId) => calls.push(["editorHidden", drawableId])
      },
      drawableList: {
        drawables: [
          {
            drawableId: "draw_body",
            displayName: "Body",
            meshId: "mesh_body",
            visible: true,
            baseDrawOrder: 0,
            stableOrder: 0,
            orderIndex: 0,
            visibilityLabel: "Visible",
            canMoveLayerUp: false,
            canMoveLayerDown: true,
            baseDrawOrderLabel: "Draw order 0",
            layerOrderLabel: "Layer 1",
            meshSummaryLabel: "3 vertices / 1 triangle",
            boundsLabel: "x 0 / y 0 / w 20 / h 20"
          },
          {
            drawableId: "draw_eye",
            displayName: "Eye",
            meshId: "mesh_eye",
            visible: false,
            baseDrawOrder: 1,
            stableOrder: 1,
            orderIndex: 1,
            visibilityLabel: "Hidden",
            canMoveLayerUp: true,
            canMoveLayerDown: false,
            baseDrawOrderLabel: "Draw order 1",
            layerOrderLabel: "Layer 2",
            meshSummaryLabel: "4 vertices / 2 triangles",
            boundsLabel: "x 2 / y 2 / w 8 / h 8"
          }
        ],
        layerControls: {
          orderedDrawables: [
            {
              drawableId: "draw_body",
              displayName: "Body",
              visible: true,
              runtimeVisibilityLabel: "Visible",
              baseDrawOrder: 0,
              stableOrder: 0,
              orderIndex: 0,
              orderLabel: "Layer 1 / draw order 0",
              canMoveUp: false,
              canMoveDown: true,
              moveUpLabel: "Move Body up",
              moveDownLabel: "Move Body down",
              visibilityToggleLabel: "Hide Body"
            },
            {
              drawableId: "draw_eye",
              displayName: "Eye",
              visible: false,
              runtimeVisibilityLabel: "Hidden",
              baseDrawOrder: 1,
              stableOrder: 1,
              orderIndex: 1,
              orderLabel: "Layer 2 / draw order 1",
              canMoveUp: true,
              canMoveDown: false,
              moveUpLabel: "Move Eye up",
              moveDownLabel: "Move Eye down",
              visibilityToggleLabel: "Show Eye"
            }
          ],
          hasDrawables: true,
          hasMultipleDrawables: true,
          layerCountLabel: "2 layers",
          lastLayerOperationLabel: "No layer operation committed"
        },
        onToggleRuntimeVisibility: (drawableId) => calls.push(["runtime", drawableId]),
        onMoveLayer: (drawableId, direction) => calls.push(["move", drawableId, direction])
      }
    }) as unknown as TestElement;

    expect(surface.dataset.shellSurfaceId).toBe("authoringWorkspace");
    expect(surface.dataset.shellSurfaceGroup).toBe("parts-tree");
    expect(surface.textContent).toContain("Structure / Parts");
    expect(surface.textContent).toContain("1 selected drawable");
    expect(surface.textContent).toContain("1 editor-hidden drawable");
    expect(surface.textContent).not.toMatch(/operation id|evidence path|raw runtime/i);
    expect(findByTestId(surface, editorTestIds.layerTreePanel)).not.toBeNull();
    expect(findByTestId(surface, editorTestIds.drawableList)).not.toBeNull();
    expect(findByTestId(surface, createLayerTreeDrawableRowTestId("draw_eye"))?.textContent).toContain(
      "Texture missing / Runtime hidden / Editor hidden / Unlocked / Selected"
    );
    expect(findByTestId(surface, createDrawableRowTestId("draw_body"))?.textContent).toContain(
      "Layer 1 / draw order 0"
    );

    findByTestId(surface, createLayerTreeSelectDrawableTestId("draw_eye"))?.emit("click");
    findByTestId(surface, createDrawableVisibilityToggleTestId("draw_body"))?.emit("click");
    findByTestId(surface, createDrawableMoveDownTestId("draw_body"))?.emit("click");

    expect(calls).toEqual([
      ["select", "draw_eye"],
      ["runtime", "draw_body"],
      ["move", "draw_body", "down"]
    ]);
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
    }
  ],
  hasParts: true,
  hasDrawables: true,
  drawableCount: 2,
  selectedDrawableIds: ["draw_eye"],
  lockedDrawableIds: ["draw_body"],
  editorHiddenDrawableIds: ["draw_eye"],
  missingTextureDrawableIds: ["draw_eye"],
  directManipulationDraftCount: 0,
  partCountLabel: "2 part groups",
  drawableCountLabel: "2 drawables",
  selectedCountLabel: "1 selected drawable",
  lockedCountLabel: "1 locked drawable",
  editorHiddenCountLabel: "1 editor-hidden drawable",
  missingTextureCountLabel: "1 missing texture",
  directManipulationDraftCountLabel: "0 direct drafts",
  directManipulationSummaryLabel: "No direct manipulation drafts",
  summaryLabel: "2 part groups / 2 drawables / 1 selected / 1 locked / 1 editor-hidden / 1 missing texture"
});

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
  reparentDisabledMessage: input.reparentDisabledMessage ?? null,
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
  readonly classList = {
    add: (...classNames: string[]) => {
      this.className = [...new Set([...this.className.split(" ").filter(Boolean), ...classNames])].join(" ");
    }
  };
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

  addEventListener(
    type: string,
    listener: (event?: { readonly preventDefault: () => void }) => void
  ): void {
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
