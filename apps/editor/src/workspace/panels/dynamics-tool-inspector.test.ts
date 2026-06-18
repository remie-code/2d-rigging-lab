import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import { DynamicsGroupIdSchema, ParameterIdSchema } from "@private-2d-rigging-lab/contracts";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DynamicsToolInspector } from "./dynamics-tool-inspector";
import { createEmptyAuthoringSession } from "../../features/editor-session/model/empty-authoring-session";
import {
  createDynamicsToolPreviewEvaluation,
  createInitialDynamicsToolPreviewState
} from "../../features/editor-session/model/dynamics-tool-state";

const editorSessionMock = vi.hoisted(() => ({ current: undefined as unknown }));

vi.mock("../../features/editor-session/editor-session-context", () => ({
  useEditorSession: () => editorSessionMock.current
}));

const DRIVER_X = ParameterIdSchema.parse("param_dynamics_driver_x");
const DRIVER_Y = ParameterIdSchema.parse("param_dynamics_driver_y");
const OUTPUT = ParameterIdSchema.parse("param_dynamics_output");
const GROUP_ID = DynamicsGroupIdSchema.parse("dyn_inspector_sway");

describe("DynamicsToolInspector", () => {
  it("initially renders only the group list and New Group action", () => {
    const session = createDynamicsSession();
    const preview = {
      ...createInitialDynamicsToolPreviewState(),
      selectedGroupId: GROUP_ID
    };
    editorSessionMock.current = {
      createDynamicsGroup: vi.fn(),
      deleteDynamicsGroup: vi.fn(),
      dynamicsToolPreview: preview,
      dynamicsToolPreviewEvaluation: createDynamicsToolPreviewEvaluation(session, preview),
      resetDynamicsToolPreviewSimulation: vi.fn(),
      session,
      setDynamicsToolPreviewDriverValue: vi.fn(),
      setDynamicsToolPreviewGroupId: vi.fn(),
      updateDynamicsGroup: vi.fn()
    };

    const markup = renderToStaticMarkup(createElement(DynamicsToolInspector));

    expect(markup).toContain('data-testid="dynamics-tool-inspector"');
    expect(markup).toContain('data-testid="dynamics-group-list"');
    expect(markup).toContain("Inspector Sway");
    expect(markup).toContain('data-testid="dynamics-new-draft"');
    expect(markup).not.toContain("Settings");
    expect(markup).not.toContain("Inputs");
    expect(markup).not.toContain("Advanced");
    expect(markup).not.toContain("Pendulum");
    expect(markup).not.toContain("Outputs");
    expect(markup).not.toContain("Validation");
    expect(markup).not.toContain("Preview");
    expect(markup).not.toContain("Apply");
    expect(markup).not.toContain("Delete Group");
  });

  it("moves through group, edit, create, cancel, apply, and delete states", async () => {
    const session = createDynamicsSession();
    const preview = {
      ...createInitialDynamicsToolPreviewState(),
      selectedGroupId: null
    };
    const updateDynamicsGroup = vi.fn(() => ({ committed: true, diagnostics: [] }));
    const deleteDynamicsGroup = vi.fn(() => ({ committed: true, diagnostics: [] }));
    const createDynamicsGroup = vi.fn(() => ({ committed: true, diagnostics: [] }));
    const setDynamicsToolPreviewGroupId = vi.fn();
    const setDynamicsToolPreviewDriverValue = vi.fn();
    const animationFrame = installAnimationFrameMock();
    editorSessionMock.current = {
      createDynamicsGroup,
      deleteDynamicsGroup,
      dynamicsToolPreview: preview,
      dynamicsToolPreviewEvaluation: createDynamicsToolPreviewEvaluation(session, preview),
      resetDynamicsToolPreviewSimulation: vi.fn(),
      session,
      setDynamicsToolPreviewDriverValue,
      setDynamicsToolPreviewGroupId,
      updateDynamicsGroup
    };
    const harness = await renderDynamicsToolInspector();

    try {
      await clickTestId(harness.container, "dynamics-group-row");

      expect(setDynamicsToolPreviewGroupId).toHaveBeenLastCalledWith(GROUP_ID);
      expect(getFakeElementByTestId(harness.container, "dynamics-group-inspector").textContent)
        .toContain("Inspector Sway");
      expect(getFakeElementsByTestId(harness.container, "dynamics-preview-driver")).toHaveLength(2);
      expect(getMaybeFakeElementByTestId(harness.container, "dynamics-input-row")).toBeUndefined();
      expect(getFakeElementByTestId(harness.container, "dynamics-edit-group")).toBeDefined();
      expect(getFakeElementByTestId(harness.container, "dynamics-delete-group")).toBeDefined();

      const driverRange = getFakeInputByType(harness.container, "range");
      driverRange.value = "10";
      getFakeReactProps(driverRange).onChange?.({ currentTarget: driverRange });
      driverRange.value = "20";
      getFakeReactProps(driverRange).onChange?.({ currentTarget: driverRange });
      expect(setDynamicsToolPreviewDriverValue).not.toHaveBeenCalled();
      getFakeReactProps(driverRange).onPointerUp?.();
      expect(setDynamicsToolPreviewDriverValue).toHaveBeenCalledTimes(1);
      expect(setDynamicsToolPreviewDriverValue).toHaveBeenCalledWith(GROUP_ID, DRIVER_X, 20);
      animationFrame.flushAll();
      expect(setDynamicsToolPreviewDriverValue).toHaveBeenCalledTimes(1);

      await clickTestId(harness.container, "dynamics-edit-group");
      expect(getFakeElementByTestId(harness.container, "dynamics-edit-inspector")).toBeDefined();
      expect(getFakeElementsByTestId(harness.container, "dynamics-input-row")).toHaveLength(2);
      expect(getFakeElementByTestId(harness.container, "dynamics-apply-group")).toBeDefined();
      expect(getFakeElementByTestId(harness.container, "dynamics-cancel")).toBeDefined();
      expect(getMaybeFakeElementByTestId(harness.container, "dynamics-preview-reset")).toBeUndefined();
      expect(getMaybeFakeElementByTestId(harness.container, "dynamics-delete-group")).toBeUndefined();

      await clickTestId(harness.container, "dynamics-cancel");
      expect(getFakeElementByTestId(harness.container, "dynamics-group-inspector")).toBeDefined();

      await clickTestId(harness.container, "dynamics-back-to-groups");
      expect(getFakeElementByTestId(harness.container, "dynamics-group-list")).toBeDefined();

      await clickTestId(harness.container, "dynamics-new-draft");
      expect(getFakeElementByTestId(harness.container, "dynamics-create-inspector")).toBeDefined();
      expect(getFakeElementByTestId(harness.container, "dynamics-create-group")).toBeDefined();
      expect(getMaybeFakeElementByTestId(harness.container, "dynamics-delete-group")).toBeUndefined();

      await clickTestId(harness.container, "dynamics-cancel");
      expect(getFakeElementByTestId(harness.container, "dynamics-group-list")).toBeDefined();

      await clickTestId(harness.container, "dynamics-new-draft");
      await clickTestId(harness.container, "dynamics-create-group");
      expect(createDynamicsGroup).toHaveBeenCalledTimes(1);
      expect(getFakeElementByTestId(harness.container, "dynamics-group-list")).toBeDefined();

      await clickTestId(harness.container, "dynamics-group-row");
      await clickTestId(harness.container, "dynamics-edit-group");
      await clickTestId(harness.container, "dynamics-apply-group");
      expect(updateDynamicsGroup).toHaveBeenCalledTimes(1);
      expect(getFakeElementByTestId(harness.container, "dynamics-group-inspector")).toBeDefined();

      await clickTestId(harness.container, "dynamics-delete-group");
      expect(deleteDynamicsGroup).toHaveBeenCalledWith({ dynamicsGroupId: GROUP_ID });
      expect(getFakeElementByTestId(harness.container, "dynamics-group-list")).toBeDefined();
    } finally {
      animationFrame.restore();
      await harness.cleanup();
    }
  });
});

function createDynamicsSession(): AuthoringSession {
  const session = createEmptyAuthoringSession();
  session.graph.parameters.push(
    {
      parameterId: DRIVER_X,
      displayName: "Driver X",
      valueSource: "authoredInput",
      min: -30,
      default: 0,
      max: 30,
      recommendedUiStep: 1
    },
    {
      parameterId: DRIVER_Y,
      displayName: "Driver Y",
      valueSource: "authoredInput",
      min: -20,
      default: 0,
      max: 20,
      recommendedUiStep: 1
    },
    {
      parameterId: OUTPUT,
      displayName: "Output",
      valueSource: "authoredInput",
      min: -10,
      default: 0,
      max: 10,
      recommendedUiStep: 0.1
    }
  );
  session.graph.dynamicsGroups.push({
    dynamicsGroupId: GROUP_ID,
    displayName: "Inspector Sway",
    enabled: true,
    presetId: "hair",
    inputs: [
      {
        parameterId: DRIVER_X,
        kind: "angle",
        influencePercent: 100,
        invert: false,
        normalization: { min: -30, center: 0, max: 30 }
      },
      {
        parameterId: DRIVER_Y,
        kind: "positionX",
        influencePercent: 50,
        invert: false,
        normalization: { min: -20, center: 0, max: 20 }
      }
    ],
    pendulums: [
      {
        length: 0.8,
        sway: 0.7,
        reactionSpeed: 12,
        convergenceSpeed: 4
      }
    ],
    outputs: [
      {
        parameterId: OUTPUT,
        kind: "angle",
        strength: 5,
        invert: false,
        limit: 10
      }
    ]
  });
  return session;
}

async function renderDynamicsToolInspector(): Promise<{
  readonly cleanup: () => Promise<void>;
  readonly container: FakeElement;
}> {
  const fakeRoot = createFakeDomRoot();
  let reactRoot: Root | null = createRoot(fakeRoot.container as unknown as Element);

  await act(async () => {
    reactRoot?.render(createElement(DynamicsToolInspector));
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

async function clickTestId(root: FakeElement, testId: string): Promise<void> {
  const element = getFakeElementByTestId(root, testId);
  await act(async () => {
    getFakeReactProps(element).onClick?.();
  });
}

type FakeReactProps = {
  readonly onBlur?: () => void;
  readonly onChange?: (event: { readonly currentTarget: FakeElement }) => void;
  readonly onClick?: () => void;
  readonly onPointerCancel?: () => void;
  readonly onPointerUp?: () => void;
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
  max = "";
  min = "";
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

  get options(): FakeElement[] {
    return this.childNodes.filter(
      (child): child is FakeElement => child instanceof FakeElement && child.localName === "option"
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
    if (name === "value") {
      this.value = normalized;
    } else if (name === "min") {
      this.min = normalized;
    } else if (name === "max") {
      this.max = normalized;
    } else if (name === "type") {
      this.type = normalized;
    } else if (name === "disabled") {
      this.disabled = true;
    } else if (name === "selected") {
      this.selected = true;
    } else if (name === "checked") {
      this.checked = true;
    }
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
    if (name === "disabled" || name === "selected" || name === "checked") {
      this[name] = false;
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

function getFakeElementByTestId(root: FakeElement, testId: string): FakeElement {
  const element = getMaybeFakeElementByTestId(root, testId);
  if (element === undefined) {
    throw new Error(`Element with data-testid "${testId}" was not rendered.`);
  }

  return element;
}

function getFakeInputByType(root: FakeElement, type: string): FakeElement {
  const input = findFakeElements(
    root,
    (candidate) => candidate.localName === "input" && candidate.type === type
  )[0];
  if (input === undefined) {
    throw new Error(`Input with type "${type}" was not rendered.`);
  }

  return input;
}

function getMaybeFakeElementByTestId(root: FakeElement, testId: string): FakeElement | undefined {
  return getFakeElementsByTestId(root, testId)[0];
}

function getFakeElementsByTestId(root: FakeElement, testId: string): FakeElement[] {
  return findFakeElements(
    root,
    (candidate) => candidate.getAttribute("data-testid") === testId
  );
}

function findFakeElements(
  root: FakeElement,
  predicate: (element: FakeElement) => boolean
): FakeElement[] {
  const matches: FakeElement[] = [];
  if (predicate(root)) {
    matches.push(root);
  }

  root.childNodes.forEach((child) => {
    if (child instanceof FakeElement) {
      matches.push(...findFakeElements(child, predicate));
    }
  });

  return matches;
}

function getFakeReactProps(element: FakeElement): FakeReactProps {
  const key = Object.keys(element).find((candidate) => candidate.startsWith("__reactProps$"));
  if (key === undefined) {
    return {};
  }

  return (element as unknown as Record<string, FakeReactProps>)[key] ?? {};
}

function installAnimationFrameMock(): {
  readonly flushAll: () => void;
  readonly restore: () => void;
} {
  const previousRequestAnimationFrame = globalThis.requestAnimationFrame;
  const previousCancelAnimationFrame = globalThis.cancelAnimationFrame;
  const callbacks = new Map<number, FrameRequestCallback>();
  let nextFrameId = 1;

  globalThis.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
    const frameId = nextFrameId;
    nextFrameId += 1;
    callbacks.set(frameId, callback);
    return frameId;
  });
  globalThis.cancelAnimationFrame = vi.fn((frameId: number) => {
    callbacks.delete(frameId);
  });

  const flushNext = () => {
    const entry = callbacks.entries().next().value;
    if (entry === undefined) {
      return;
    }

    const [frameId, callback] = entry;
    callbacks.delete(frameId);
    callback(0);
  };

  return {
    flushAll: () => {
      while (callbacks.size > 0) {
        flushNext();
      }
    },
    restore: () => {
      globalThis.requestAnimationFrame = previousRequestAnimationFrame;
      globalThis.cancelAnimationFrame = previousCancelAnimationFrame;
    }
  };
}
