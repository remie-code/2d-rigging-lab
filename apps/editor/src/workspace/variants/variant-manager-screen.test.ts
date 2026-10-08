import type { ButtonHTMLAttributes, ReactNode } from "react";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import {
  DrawableIdSchema,
  MeshIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  RigControlIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema,
  type DrawableId,
  type PartId
} from "@private-2d-rigging-lab/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createEmptyAuthoringSession,
  ROOT_PART_ID
} from "../../features/editor-session/model/empty-authoring-session";
import { VariantManagerScreen } from "./variant-manager-screen";

const PART_FACE = PartIdSchema.parse("part_variant_screen_face");
const PART_CLOTHES = PartIdSchema.parse("part_variant_screen_clothes");
const DRAW_BASE = DrawableIdSchema.parse("draw_variant_screen_base");
const DRAW_HOODIE = DrawableIdSchema.parse("draw_variant_screen_hoodie");
const DRAW_BUTTON = DrawableIdSchema.parse("draw_variant_screen_draft_button");
const DRAW_SMILE = DrawableIdSchema.parse("draw_variant_screen_smile");
const RIG_BODY = RigControlIdSchema.parse("rig_variant_screen_body");
const GROUP_OUTFIT = "vgrp_outfit";
const GROUP_EXPRESSION = "vgrp_expression";
const VAR_DEFAULT = "var_outfit_default";
const VAR_HOODIE = "var_outfit_hoodie";
const VAR_SMILE = "var_expression_smile";
const SOURCE_ASSET = SourceAssetIdSchema.parse("src_variant_screen");
const PROVENANCE = ProvenanceIdSchema.parse("prov_variant_screen");

const variantManagerTestState = vi.hoisted(() => ({
  editorSession: {
    addVariantTargetDrawable: vi.fn(),
    createVariant: vi.fn(),
    createVariantGroup: vi.fn(),
    deleteVariant: vi.fn(),
    deleteVariantGroup: vi.fn(),
    removeVariantTargetDrawable: vi.fn(),
    resetVariantPreviewActiveSelections: vi.fn(),
    session: undefined as unknown,
    setVariantDefaultActiveSelection: vi.fn(),
    setVariantMembership: vi.fn(),
    setVariantPreviewActiveSelection: vi.fn(),
    updateVariant: vi.fn(),
    updateVariantGroup: vi.fn(),
    variantPreviewActiveSelections: []
  },
  iconButtons: [] as Array<{
    readonly label: string;
    readonly onClick?: ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
  }>,
  uiStore: {
    setActiveEntry: vi.fn()
  }
}));

vi.mock("../../features/editor-session/editor-session-context", () => ({
  useEditorSession: () => variantManagerTestState.editorSession
}));

vi.mock("../../state/editor-ui-store", () => ({
  useEditorUiStore: (
    selector: (state: typeof variantManagerTestState.uiStore) => unknown
  ) => selector(variantManagerTestState.uiStore)
}));

vi.mock("../../ui/icon-button", () => ({
  IconButton: ({
    children,
    label,
    onClick
  }: {
    readonly children: ReactNode;
    readonly label: string;
    readonly onClick?: ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
  }) => {
    variantManagerTestState.iconButtons.push({
      label,
      ...(onClick === undefined ? {} : { onClick })
    });

    return createElement("button", { "aria-label": label, type: "button" }, children);
  }
}));

vi.mock("../panels/canvas-preview-panel", () => ({
  CanvasPreviewPanel: () => createElement("section", null, "Canvas / Preview")
}));

describe("VariantManagerScreen", () => {
  beforeEach(() => {
    variantManagerTestState.iconButtons.splice(0, variantManagerTestState.iconButtons.length);
    variantManagerTestState.editorSession.session = createEmptyAuthoringSession();
    variantManagerTestState.editorSession.variantPreviewActiveSelections = [];
    installCommittedVariantCommandMocks();
    variantManagerTestState.uiStore.setActiveEntry.mockClear();
  });

  it("opens as an empty manager for an existing workspace without variants", () => {
    const markup = renderToStaticMarkup(createElement(VariantManagerScreen));

    expect(markup).toContain("Variant / Expression Manager");
    expect(markup).toContain("Existing workspace has no Variant Groups.");
    expect(markup).toContain("No Variant Groups.");
  });

  it("returns to the neutral Authoring Workspace from Back", () => {
    renderToStaticMarkup(createElement(VariantManagerScreen));

    const backButton = variantManagerTestState.iconButtons.find(
      (button) => button.label === "Back to Authoring Workspace"
    );
    expect(backButton).toBeDefined();

    backButton?.onClick?.({} as never);

    expect(variantManagerTestState.uiStore.setActiveEntry).toHaveBeenCalledTimes(1);
    expect(variantManagerTestState.uiStore.setActiveEntry).toHaveBeenCalledWith("workspace");
  });

  it("wires group create and delete events to Variant session commands", async () => {
    const harness = await renderVariantManagerScreen(createVariantPickerSession());

    try {
      const groupInput = findFakeElements(
        harness.container,
        (element) => element.localName === "input"
      )[0];
      const modeSelect = findFakeElements(
        harness.container,
        (element) => element.localName === "select"
      )[0];
      if (groupInput === undefined || modeSelect === undefined) {
        throw new Error("Expected group create controls.");
      }

      await changeFakeElementValue(groupInput, "Accessory");
      await changeFakeElementValue(modeSelect, "multiToggle");
      await submitFakeFormByButtonText(harness.container, "New Group");

      expect(variantManagerTestState.editorSession.createVariantGroup).toHaveBeenCalledWith({
        variantGroupId: "vgrp_accessory",
        displayName: "Accessory",
        mode: "multiToggle"
      });

      await clickFakeElement(getFakeButtonByText(harness.container, "Delete Group"));

      expect(variantManagerTestState.editorSession.deleteVariantGroup).toHaveBeenCalledWith({
        variantGroupId: GROUP_OUTFIT
      });
      expect(variantManagerTestState.editorSession.removeVariantTargetDrawable)
        .not.toHaveBeenCalled();
    } finally {
      await harness.cleanup();
    }
  });

  it("wires Group settings rename and mode update after React clears event currentTarget", async () => {
    const harness = await renderVariantManagerScreen(createVariantPickerSession());

    try {
      await changeFakeElementValue(getFakeInputByValue(harness.container, "Outfit"), "Outerwear");

      const [, groupModeSelect] = getVariantGroupModeSelects(harness.container);
      await changeFakeElementValue(groupModeSelect, "multiToggle");
      await submitFakeFormByButtonText(harness.container, "Save Group");

      expect(variantManagerTestState.editorSession.updateVariantGroup).toHaveBeenCalledWith({
        variantGroupId: GROUP_OUTFIT,
        displayName: "Outerwear",
        mode: "multiToggle"
      });
    } finally {
      await harness.cleanup();
    }
  });

  it("wires variant create, rename, delete, and last-delete disabled state", async () => {
    const harness = await renderVariantManagerScreen(createVariantPickerSession());

    try {
      await changeFakeElementValue(
        getFakeElementByAriaLabel(harness.container, "New Variant name"),
        "Jacket"
      );
      await submitFakeFormByButtonText(harness.container, "Variant");

      expect(variantManagerTestState.editorSession.createVariant).toHaveBeenCalledWith({
        variantGroupId: GROUP_OUTFIT,
        variantId: "var_jacket",
        displayName: "Jacket"
      });

      const hoodieInput = getFakeInputByValue(harness.container, "Hoodie");
      await changeFakeElementValue(hoodieInput, "Hoodie Alt");
      await blurFakeElement(getFakeInputByValue(harness.container, "Hoodie Alt"));

      expect(variantManagerTestState.editorSession.updateVariant).toHaveBeenCalledWith({
        variantGroupId: GROUP_OUTFIT,
        variantId: VAR_HOODIE,
        displayName: "Hoodie Alt"
      });

      const variantDeleteButtons = findFakeElements(
        harness.container,
        (element) => element.localName === "button" && element.textContent.trim() === "Delete"
      );
      const hoodieDeleteButton = variantDeleteButtons[1] ?? variantDeleteButtons[0];
      if (hoodieDeleteButton === undefined) {
        throw new Error("Expected a Variant delete button.");
      }
      await clickFakeElement(hoodieDeleteButton);

      expect(variantManagerTestState.editorSession.deleteVariant).toHaveBeenCalledWith({
        variantGroupId: GROUP_OUTFIT,
        variantId: VAR_HOODIE
      });
    } finally {
      await harness.cleanup();
    }

    const singleVariantHarness = await renderVariantManagerScreen(createSingleVariantSession());
    try {
      expect(getFakeButtonByText(singleVariantHarness.container, "Delete").disabled).toBe(true);
    } finally {
      await singleVariantHarness.cleanup();
    }
  });

  it("renders picker eligibility states and adds only selected eligible drawables", async () => {
    const harness = await renderVariantManagerScreen(createVariantPickerSession());

    try {
      await clickFakeElement(getFakeButtonByText(harness.container, "Add Drawables"));

      const picker = getFakeElementByTestId(harness.container, "variant-drawable-picker");
      expect(picker.textContent).toContain("eligible 1 / total 4");
      expect(picker.textContent).toContain("Clotheseligible 1 / total 3");
      expect(picker.textContent).not.toContain("Hoodieeligible");

      await clickFakeElement(getFakeButtonContainingText(harness.container, "Clothes"));
      await clickFakeElement(getFakeButtonContainingText(harness.container, "Face"));

      const baseCheckbox = getFakeCheckboxInLabel(harness.container, "Base Clothes");
      const hoodieCheckbox = getFakeCheckboxInLabel(harness.container, "Hoodie");
      const draftCheckbox = getFakeCheckboxInLabel(harness.container, "Draft Button");
      const smileCheckbox = getFakeCheckboxInLabel(harness.container, "Smile");

      expect(baseCheckbox.disabled).toBe(true);
      expect(baseCheckbox.checked).toBe(true);
      expect(hoodieCheckbox.disabled).toBe(false);
      expect(hoodieCheckbox.checked).toBe(false);
      expect(draftCheckbox.disabled).toBe(true);
      expect(draftCheckbox.checked).toBe(false);
      expect(smileCheckbox.disabled).toBe(true);
      expect(smileCheckbox.checked).toBe(false);
      expect(getFakeLabelContainingText(harness.container, "Smile").textContent)
        .toContain("already in other group: Expression");

      await changeFakeCheckbox(hoodieCheckbox, true);
      expect(getFakeCheckboxInLabel(harness.container, "Hoodie").checked).toBe(true);

      await clickFakeElement(getFakeButtonByText(harness.container, "Add selected"));

      expect(variantManagerTestState.editorSession.addVariantTargetDrawable)
        .toHaveBeenCalledTimes(1);
      expect(variantManagerTestState.editorSession.addVariantTargetDrawable).toHaveBeenCalledWith({
        variantGroupId: GROUP_OUTFIT,
        drawableId: DRAW_HOODIE
      });
    } finally {
      await harness.cleanup();
    }
  });

  it("wires membership, default active, and preview active controls", async () => {
    const harness = await renderVariantManagerScreen(createVariantPickerSession());

    try {
      await changeFakeCheckbox(
        getFakeElementByAriaLabel(harness.container, "Base Clothes in Hoodie"),
        true
      );

      expect(variantManagerTestState.editorSession.setVariantMembership).toHaveBeenCalledWith({
        variantGroupId: GROUP_OUTFIT,
        drawableId: DRAW_BASE,
        variantId: VAR_HOODIE,
        member: true
      });

      const [defaultActiveSelect, previewActiveSelect] =
        getVariantActiveSelectionSelects(harness.container);
      await changeFakeElementValue(defaultActiveSelect, VAR_HOODIE);
      await changeFakeElementValue(previewActiveSelect, VAR_HOODIE);

      expect(variantManagerTestState.editorSession.setVariantDefaultActiveSelection)
        .toHaveBeenCalledWith({
          variantGroupId: GROUP_OUTFIT,
          defaultActive: {
            kind: "singleSelect",
            variantId: VAR_HOODIE
          }
        });
      expect(variantManagerTestState.editorSession.setVariantPreviewActiveSelection)
        .toHaveBeenCalledWith({
          variantGroupId: GROUP_OUTFIT,
          activeSelection: {
            kind: "singleSelect",
            variantId: VAR_HOODIE
          }
        });
    } finally {
      await harness.cleanup();
    }
  });
});

function installCommittedVariantCommandMocks(): void {
  const commandResult = () => ({
    committed: true,
    diagnostics: [],
    session: variantManagerTestState.editorSession.session
  });

  variantManagerTestState.editorSession.addVariantTargetDrawable
    .mockImplementation(commandResult);
  variantManagerTestState.editorSession.createVariant.mockImplementation(commandResult);
  variantManagerTestState.editorSession.createVariantGroup.mockImplementation(commandResult);
  variantManagerTestState.editorSession.deleteVariant.mockImplementation(commandResult);
  variantManagerTestState.editorSession.deleteVariantGroup.mockImplementation(commandResult);
  variantManagerTestState.editorSession.removeVariantTargetDrawable
    .mockImplementation(commandResult);
  variantManagerTestState.editorSession.resetVariantPreviewActiveSelections
    .mockImplementation(() => undefined);
  variantManagerTestState.editorSession.setVariantDefaultActiveSelection
    .mockImplementation(commandResult);
  variantManagerTestState.editorSession.setVariantMembership.mockImplementation(commandResult);
  variantManagerTestState.editorSession.setVariantPreviewActiveSelection
    .mockImplementation(() => undefined);
  variantManagerTestState.editorSession.updateVariant.mockImplementation(commandResult);
  variantManagerTestState.editorSession.updateVariantGroup.mockImplementation(commandResult);
}

async function renderVariantManagerScreen(
  session: AuthoringSession
): Promise<{
  readonly cleanup: () => Promise<void>;
  readonly container: FakeElement;
}> {
  variantManagerTestState.editorSession.session = session;
  const fakeRoot = createFakeDomRoot();
  let reactRoot: Root | null = createRoot(fakeRoot.container as unknown as Element);

  await act(async () => {
    reactRoot?.render(createElement(VariantManagerScreen));
  });

  return {
    container: fakeRoot.container,
    cleanup: async () => {
      await act(async () => {
        reactRoot?.unmount();
      });
      reactRoot = null;
      fakeRoot.restore();
    }
  };
}

function createVariantPickerSession(): AuthoringSession {
  const session = createEmptyAuthoringSession();
  session.graph.parts = [
    {
      partId: ROOT_PART_ID,
      displayName: "Project Root",
      childPartIds: [PART_FACE, PART_CLOTHES],
      drawableIds: []
    },
    {
      partId: PART_FACE,
      displayName: "Face",
      parentPartId: ROOT_PART_ID,
      childPartIds: [],
      drawableIds: [DRAW_SMILE]
    },
    {
      partId: PART_CLOTHES,
      displayName: "Clothes",
      parentPartId: ROOT_PART_ID,
      childPartIds: [],
      drawableIds: [DRAW_BASE, DRAW_HOODIE, DRAW_BUTTON]
    }
  ];
  session.graph.drawables = [
    createDrawable(DRAW_SMILE, PART_FACE, "Smile"),
    createDrawable(DRAW_BASE, PART_CLOTHES, "Base Clothes"),
    createDrawable(DRAW_HOODIE, PART_CLOTHES, "Hoodie"),
    createDrawable(DRAW_BUTTON, PART_CLOTHES, "Draft Button")
  ];
  session.graph.rigControls = [
    {
      kind: "warpLattice2d",
      rigControlId: RIG_BODY,
      displayName: "Body Warp",
      partId: PART_CLOTHES,
      childDrawableIds: [DRAW_BASE, DRAW_HOODIE, DRAW_SMILE],
      childRigControlIds: [],
      bindSpace: "rigControlLocalRest",
      domainBounds: { x: 0, y: 0, width: 100, height: 100 },
      latticeColumns: 2,
      latticeRows: 2,
      restControlPoints: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 0, y: 100 },
        { x: 100, y: 100 }
      ],
      interpolationMethod: "bilinear-grid-v1",
      enabled: true
    }
  ];
  session.graph.variantGroups = [
    {
      variantGroupId: GROUP_OUTFIT as never,
      displayName: "Outfit",
      mode: "singleSelect",
      variants: [
        { variantId: VAR_DEFAULT as never, displayName: "Default" },
        { variantId: VAR_HOODIE as never, displayName: "Hoodie" }
      ],
      targetDrawableIds: [DRAW_BASE],
      memberships: [
        {
          drawableId: DRAW_BASE,
          variantIds: [VAR_DEFAULT as never]
        }
      ],
      defaultActive: {
        kind: "singleSelect",
        variantId: VAR_DEFAULT as never
      }
    },
    {
      variantGroupId: GROUP_EXPRESSION as never,
      displayName: "Expression",
      mode: "singleSelect",
      variants: [{ variantId: VAR_SMILE as never, displayName: "Smile" }],
      targetDrawableIds: [DRAW_SMILE],
      memberships: [
        {
          drawableId: DRAW_SMILE,
          variantIds: [VAR_SMILE as never]
        }
      ],
      defaultActive: {
        kind: "singleSelect",
        variantId: VAR_SMILE as never
      }
    }
  ];
  return session;
}

function createSingleVariantSession(): AuthoringSession {
  const session = createVariantPickerSession();
  const group = session.graph.variantGroups?.[0];
  if (group === undefined) {
    throw new Error("Expected fixture group.");
  }

  session.graph.variantGroups = [
    {
      ...group,
      variants: [{ variantId: VAR_DEFAULT as never, displayName: "Default" }],
      targetDrawableIds: [],
      memberships: [],
      defaultActive: {
        kind: "singleSelect",
        variantId: VAR_DEFAULT as never
      }
    }
  ];
  return session;
}

function createDrawable(drawableId: DrawableId, partId: PartId, displayName: string) {
  const token = drawableId.replace(/^draw_variant_screen_/, "");
  return {
    drawableId,
    displayName,
    partId,
    sourceAssetId: SOURCE_ASSET,
    textureId: TextureIdSchema.parse(`tex_variant_screen_${token}`),
    meshId: MeshIdSchema.parse(`mesh_variant_screen_${token}`),
    defaultOpacity: 1,
    runtimeVisibility: true,
    baseDrawOrder: 0,
    sourceProvenanceId: PROVENANCE
  };
}

type FakeReactProps = {
  readonly checked?: boolean;
  readonly disabled?: boolean;
  readonly onBlur?: (event: { readonly currentTarget: FakeElement }) => void;
  readonly onChange?: (event: { readonly currentTarget: FakeElement }) => void;
  readonly onClick?: (event: {
    readonly currentTarget: FakeElement;
    readonly target: FakeElement;
    readonly preventDefault: () => void;
    readonly stopPropagation: () => void;
  }) => void;
  readonly onSubmit?: (event: {
    readonly currentTarget: FakeElement;
    readonly preventDefault: () => void;
  }) => void;
  readonly value?: number | string | readonly string[];
};

type FakeNode = FakeElement | FakeTextNode;

class FakeTextNode {
  readonly nodeType = 3;
  readonly nodeName = "#text";
  readonly ownerDocument: FakeDocument;
  parentNode: FakeElement | null = null;
  data: string;
  nodeValue: string;

  constructor(text: string, ownerDocument: FakeDocument) {
    this.data = text;
    this.nodeValue = text;
    this.ownerDocument = ownerDocument;
  }

  get textContent(): string {
    return this.nodeValue;
  }

  set textContent(value: string) {
    this.data = value;
    this.nodeValue = value;
  }
}

class FakeElement {
  readonly nodeType = 1;
  readonly ownerDocument: FakeDocument;
  readonly style: Record<string, string> = {};
  readonly childNodes: FakeNode[] = [];
  readonly listeners = new Map<string, Set<EventListener>>();
  checked = false;
  disabled = false;
  namespaceURI = "http://www.w3.org/1999/xhtml";
  nodeValue: string | null = null;
  parentNode: FakeElement | null = null;
  selected = false;
  type = "";
  value = "";

  private readonly attributes = new Map<string, string>();

  constructor(
    readonly localName: string,
    ownerDocument: FakeDocument
  ) {
    this.ownerDocument = ownerDocument;
  }

  get tagName(): string {
    return this.localName.toUpperCase();
  }

  get nodeName(): string {
    return this.tagName;
  }

  get firstChild(): FakeNode | null {
    return this.childNodes[0] ?? null;
  }

  get options(): readonly FakeElement[] {
    return this.childNodes.filter(
      (child): child is FakeElement =>
        child instanceof FakeElement && child.localName === "option"
    );
  }

  get textContent(): string {
    return this.childNodes.map((child) => child.textContent).join("");
  }

  set textContent(value: string) {
    this.childNodes.splice(0, this.childNodes.length);
    this.appendChild(this.ownerDocument.createTextNode(value));
  }

  appendChild(node: FakeNode): FakeNode {
    node.parentNode?.removeChild(node);
    this.childNodes.push(node);
    node.parentNode = this;
    return node;
  }

  insertBefore(node: FakeNode, before: FakeNode | null): FakeNode {
    if (before === null) {
      return this.appendChild(node);
    }

    node.parentNode?.removeChild(node);
    const index = this.childNodes.indexOf(before);
    if (index < 0) {
      return this.appendChild(node);
    }

    this.childNodes.splice(index, 0, node);
    node.parentNode = this;
    return node;
  }

  removeChild(node: FakeNode): FakeNode {
    const index = this.childNodes.indexOf(node);
    if (index >= 0) {
      this.childNodes.splice(index, 1);
    }
    node.parentNode = null;
    return node;
  }

  setAttribute(name: string, value: string): void {
    const normalized = String(value);
    this.attributes.set(name, normalized);
    if (name === "checked") {
      this.checked = true;
    } else if (name === "disabled") {
      this.disabled = true;
    } else if (name === "selected") {
      this.selected = true;
    } else if (name === "type") {
      this.type = normalized;
    } else if (name === "value") {
      this.value = normalized;
    }
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
    if (name === "checked") {
      this.checked = false;
    } else if (name === "disabled") {
      this.disabled = false;
    } else if (name === "selected") {
      this.selected = false;
    }
  }

  addEventListener(type: string, listener: EventListener): void {
    const listeners = this.listeners.get(type) ?? new Set<EventListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  contains(node: FakeNode): boolean {
    if (node === this) {
      return true;
    }

    return this.childNodes.some(
      (child) => child instanceof FakeElement && child.contains(node)
    );
  }
}

class FakeDocument {
  readonly nodeType = 9;
  readonly nodeName = "#document";
  readonly namespaceURI = "http://www.w3.org/1999/xhtml";
  readonly documentElement: FakeElement;
  readonly body: FakeElement;
  readonly defaultView: {
    readonly document: FakeDocument;
    readonly Element: typeof FakeElement;
    readonly HTMLElement: typeof FakeElement;
    readonly SVGElement: typeof FakeElement;
    readonly HTMLIFrameElement: new () => object;
  };
  activeElement: FakeElement | null = null;

  constructor() {
    this.documentElement = new FakeElement("html", this);
    this.body = new FakeElement("body", this);
    this.documentElement.appendChild(this.body);
    this.defaultView = {
      document: this,
      Element: FakeElement,
      HTMLElement: FakeElement,
      SVGElement: FakeElement,
      HTMLIFrameElement: class HTMLIFrameElement {}
    };
  }

  createElement(tagName: string): FakeElement {
    return new FakeElement(tagName.toLowerCase(), this);
  }

  createElementNS(namespaceURI: string, tagName: string): FakeElement {
    const element = this.createElement(tagName);
    element.namespaceURI = namespaceURI;
    return element;
  }

  createTextNode(text: string): FakeTextNode {
    return new FakeTextNode(text, this);
  }

  addEventListener(): void {
    return undefined;
  }

  removeEventListener(): void {
    return undefined;
  }
}

type ReactActGlobal = typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
};

function createFakeDomRoot(): {
  readonly container: FakeElement;
  readonly restore: () => void;
} {
  const document = new FakeDocument();
  const reactActGlobal = globalThis as ReactActGlobal;
  const previous = {
    document: globalThis.document,
    window: globalThis.window,
    Element: globalThis.Element,
    HTMLElement: globalThis.HTMLElement,
    HTMLIFrameElement: globalThis.HTMLIFrameElement,
    SVGElement: globalThis.SVGElement,
    IS_REACT_ACT_ENVIRONMENT: reactActGlobal.IS_REACT_ACT_ENVIRONMENT
  };

  globalThis.document = document as unknown as Document;
  globalThis.window = document.defaultView as unknown as Window & typeof globalThis;
  globalThis.Element = FakeElement as unknown as typeof Element;
  globalThis.HTMLElement = FakeElement as unknown as typeof HTMLElement;
  globalThis.HTMLIFrameElement =
    document.defaultView.HTMLIFrameElement as unknown as typeof HTMLIFrameElement;
  globalThis.SVGElement = FakeElement as unknown as typeof SVGElement;
  reactActGlobal.IS_REACT_ACT_ENVIRONMENT = true;

  return {
    container: document.createElement("div"),
    restore: () => {
      globalThis.document = previous.document;
      globalThis.window = previous.window;
      globalThis.Element = previous.Element;
      globalThis.HTMLElement = previous.HTMLElement;
      globalThis.HTMLIFrameElement = previous.HTMLIFrameElement;
      globalThis.SVGElement = previous.SVGElement;
      reactActGlobal.IS_REACT_ACT_ENVIRONMENT = previous.IS_REACT_ACT_ENVIRONMENT;
    }
  };
}

async function changeFakeElementValue(element: FakeElement, value: string): Promise<void> {
  element.value = value;
  await act(async () => {
    const event = { currentTarget: element as FakeElement | null };
    getFakeReactProps(element).onChange?.(event as never);
    event.currentTarget = null;
  });
}

async function changeFakeCheckbox(element: FakeElement, checked: boolean): Promise<void> {
  element.checked = checked;
  await act(async () => {
    const event = { currentTarget: element as FakeElement | null };
    getFakeReactProps(element).onChange?.(event as never);
    event.currentTarget = null;
  });
}

async function blurFakeElement(element: FakeElement): Promise<void> {
  await act(async () => {
    getFakeReactProps(element).onBlur?.({ currentTarget: element });
  });
}

async function clickFakeElement(element: FakeElement): Promise<void> {
  await act(async () => {
    getFakeReactProps(element).onClick?.({
      currentTarget: element,
      target: element,
      preventDefault: () => undefined,
      stopPropagation: () => undefined
    });
  });
}

async function submitFakeFormByButtonText(root: FakeElement, buttonText: string): Promise<void> {
  const button = getFakeButtonByText(root, buttonText);
  let current = button.parentNode;
  while (current !== null && current.localName !== "form") {
    current = current.parentNode;
  }

  if (current === null) {
    throw new Error(`Button "${buttonText}" was not inside a form.`);
  }

  await act(async () => {
    getFakeReactProps(current).onSubmit?.({
      currentTarget: current,
      preventDefault: () => undefined
    });
  });
}

function getVariantActiveSelectionSelects(root: FakeElement): readonly [FakeElement, FakeElement] {
  const selects = findFakeElements(
    root,
    (element) =>
      element.localName === "select" &&
      element.options.some((option) => option.value === VAR_HOODIE)
  );
  if (selects.length !== 2) {
    throw new Error(`Expected two active selection selects, got ${selects.length}.`);
  }

  return [selects[0]!, selects[1]!];
}

function getVariantGroupModeSelects(root: FakeElement): readonly [FakeElement, FakeElement] {
  const selects = findFakeElements(
    root,
    (element) =>
      element.localName === "select" &&
      element.options.some((option) => option.value === "singleSelect") &&
      element.options.some((option) => option.value === "multiToggle")
  );
  if (selects.length !== 2) {
    throw new Error(`Expected two Variant Group mode selects, got ${selects.length}.`);
  }

  return [selects[0]!, selects[1]!];
}

function getFakeInputByValue(root: FakeElement, value: string): FakeElement {
  const input = findFakeElements(
    root,
    (element) => element.localName === "input" && element.value === value
  )[0];
  if (input === undefined) {
    throw new Error(`Input with value "${value}" was not rendered.`);
  }

  return input;
}

function getFakeElementByAriaLabel(root: FakeElement, label: string): FakeElement {
  const element = findFakeElements(
    root,
    (candidate) => candidate.getAttribute("aria-label") === label
  )[0];
  if (element === undefined) {
    throw new Error(`Element with aria-label "${label}" was not rendered.`);
  }

  return element;
}

function getFakeElementByTestId(root: FakeElement, testId: string): FakeElement {
  const element = findFakeElements(
    root,
    (candidate) => candidate.getAttribute("data-testid") === testId
  )[0];
  if (element === undefined) {
    throw new Error(`Element with data-testid "${testId}" was not rendered.`);
  }

  return element;
}

function getFakeButtonByText(root: FakeElement, text: string): FakeElement {
  const button = findFakeElements(
    root,
    (element) => element.localName === "button" && element.textContent.trim() === text
  )[0];
  if (button === undefined) {
    throw new Error(`Button with text "${text}" was not rendered.`);
  }

  return button;
}

function getFakeButtonContainingText(root: FakeElement, text: string): FakeElement {
  const button = findFakeElements(
    root,
    (element) => element.localName === "button" && element.textContent.includes(text)
  )[0];
  if (button === undefined) {
    throw new Error(`Button containing text "${text}" was not rendered.`);
  }

  return button;
}

function getFakeLabelContainingText(root: FakeElement, text: string): FakeElement {
  const label = findFakeElements(
    root,
    (element) => element.localName === "label" && element.textContent.includes(text)
  )[0];
  if (label === undefined) {
    throw new Error(`Label containing text "${text}" was not rendered.`);
  }

  return label;
}

function getFakeCheckboxInLabel(root: FakeElement, text: string): FakeElement {
  const label = findFakeElements(
    root,
    (element) =>
      element.localName === "label" &&
      element.textContent.includes(text) &&
      findFakeElements(
        element,
        (candidate) => candidate.localName === "input" && candidate.type === "checkbox"
      ).length > 0
  )[0];
  if (label === undefined) {
    throw new Error(`Checkbox label for "${text}" was not rendered.`);
  }

  const input = findFakeElements(
    label,
    (element) => element.localName === "input" && element.type === "checkbox"
  )[0];
  if (input === undefined) {
    throw new Error(`Checkbox for "${text}" was not rendered.`);
  }

  return input;
}

function findFakeElements(
  root: FakeElement,
  predicate: (element: FakeElement) => boolean
): readonly FakeElement[] {
  const matches: FakeElement[] = [];

  const visit = (element: FakeElement) => {
    if (predicate(element)) {
      matches.push(element);
    }
    element.childNodes.forEach((child) => {
      if (child instanceof FakeElement) {
        visit(child);
      }
    });
  };

  visit(root);
  return matches;
}

function getFakeReactProps(element: FakeElement): FakeReactProps {
  const key = Object.keys(element).find((candidate) => candidate.startsWith("__reactProps$"));
  if (key === undefined) {
    return {};
  }

  return (element as unknown as Record<string, FakeReactProps>)[key] ?? {};
}
