import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import {
  DrawableIdSchema,
  KeyformSetIdSchema,
  MeshIdSchema,
  ParameterIdSchema,
  ProvenanceIdSchema,
  RigControlIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createEmptyAuthoringSession,
  ROOT_PART_ID
} from "../../features/editor-session/model/empty-authoring-session";
import { createParameterBarProjection } from "../../features/editor-session/model/parameter-keyform-state";

const editorSessionMock = vi.hoisted(() => ({ current: undefined as unknown }));
const editorUiStoreMock = vi.hoisted(() => ({
  current: {
    activeTool: "select" as "select" | "mesh" | "rig" | "dynamics"
  }
}));

vi.mock("../../features/editor-session/editor-session-context", () => ({
  useEditorSession: () => editorSessionMock.current
}));

vi.mock("../../state/editor-ui-store", () => ({
  useEditorUiStore: (selector: (state: typeof editorUiStoreMock.current) => unknown) =>
    selector(editorUiStoreMock.current)
}));

import {
  handleParameterSliderTrackPointerDown,
  ParameterBar,
  projectParameterSliderPercent,
  projectParameterSliderValue
} from "./parameter-bar";

const FACE_ANGLE_X = ParameterIdSchema.parse("param_face_angle_x");
const DRAW_FACE = DrawableIdSchema.parse("draw_parameter_bar_face");
const MESH_FACE = MeshIdSchema.parse("mesh_parameter_bar_face");
const TEX_FACE = TextureIdSchema.parse("tex_parameter_bar_face");
const SOURCE_ASSET = SourceAssetIdSchema.parse("src_parameter_bar_fixture");
const PROVENANCE = ProvenanceIdSchema.parse("prov_parameter_bar_fixture");
const RIG_FACE_ROTATION = RigControlIdSchema.parse("rig_parameter_bar_rotation");

describe("ParameterBar custom slider", () => {
  beforeEach(() => {
    editorSessionMock.current = undefined;
    editorUiStoreMock.current.activeTool = "select";
  });

  it("projects slider percentages and pointer values with clamping", () => {
    expect(projectParameterSliderPercent(-30, 30, 0)).toBe(50);
    expect(projectParameterSliderPercent(-30, 30, 90)).toBe(100);
    expect(
      projectParameterSliderValue({
        clientX: 200,
        max: 30,
        min: -30,
        step: 0.01,
        trackLeft: 100,
        trackWidth: 200
      })
    ).toBe(0);
    expect(
      projectParameterSliderValue({
        clientX: 50,
        max: 30,
        min: -30,
        step: 0.01,
        trackLeft: 100,
        trackWidth: 200
      })
    ).toBe(-30);
  });

  it("renders a custom slider without a native range input", () => {
    installEditorSessionMock({
      parameterValues: {},
      session: createDrawableSession()
    });

    const markup = renderToStaticMarkup(createElement(ParameterBar));

    expect(markup).toContain('data-testid="parameter-slider"');
    expect(markup).not.toContain('role="slider"');
    expect(markup).not.toContain('type="range"');
  });

  it("renders a keyform target selector for multi-property rig controls", () => {
    installEditorSessionMock({
      parameterValues: {},
      selection: { kind: "rigControl", id: RIG_FACE_ROTATION },
      session: createRotationSession()
    });

    const markup = renderToStaticMarkup(createElement(ParameterBar));

    expect(markup).toContain('aria-label="Keyform target"');
    expect(markup).toContain("Rotation angle");
    expect(markup).toContain("Translation");
    expect(markup).toContain("Opacity multiplier");
  });

  it("keeps track pointer down as a no-op", async () => {
    const setActiveParameterValue = vi.fn();
    installEditorSessionMock({
      parameterValues: {},
      session: createDrawableSession(),
      setActiveParameterValue
    });
    const harness = await renderParameterBar();

    try {
      const preventDefault = vi.fn();
      const slider = getFakeElementByTestId(harness.container, "parameter-slider");

      getFakeReactProps(slider).onPointerDown?.({
        clientX: 300,
        currentTarget: slider,
        pointerId: 1,
        preventDefault,
        stopPropagation: vi.fn()
      });

      expect(preventDefault).toHaveBeenCalledTimes(1);
      expect(setActiveParameterValue).not.toHaveBeenCalled();
    } finally {
      await harness.cleanup();
    }
  });

  it("scrubs only from the thumb drag path", async () => {
    const setActiveParameterValue = vi.fn();
    installEditorSessionMock({
      parameterValues: {},
      session: createDrawableSession(),
      setActiveParameterValue
    });
    const harness = await renderParameterBar();

    try {
      const track = getFakeElementByTestId(harness.container, "parameter-slider-track");
      track.boundingClientRect = { left: 100, width: 200 };
      const thumb = getFakeElementByTestId(harness.container, "parameter-slider-thumb");

      getFakeReactProps(thumb).onPointerDown?.(
        createPointerEvent({
          clientX: 200,
          currentTarget: thumb,
          pointerId: 7
        })
      );
      setActiveParameterValue.mockClear();

      getFakeReactProps(thumb).onPointerMove?.(
        createPointerEvent({
          clientX: 300,
          currentTarget: thumb,
          pointerId: 7
        })
      );

      expect(setActiveParameterValue).toHaveBeenCalledWith(30);
    } finally {
      await harness.cleanup();
    }
  });

  it("jumps to a keyform value from marker click", async () => {
    const setActiveParameterValue = vi.fn();
    installEditorSessionMock({
      parameterValues: { [FACE_ANGLE_X]: 0 },
      session: createDrawableSessionWithKeyforms(),
      setActiveParameterValue
    });
    const harness = await renderParameterBar();

    try {
      const marker = getFakeElementByAttribute(harness.container, "data-parameter-value", "30");

      getFakeReactProps(marker).onClick?.({
        stopPropagation: vi.fn()
      });

      expect(setActiveParameterValue).toHaveBeenCalledWith(30);
    } finally {
      await harness.cleanup();
    }
  });

  it("is read-only in Dynamics mode and does not scrub or jump values", async () => {
    editorUiStoreMock.current.activeTool = "dynamics";
    const setActiveParameterValue = vi.fn();
    installEditorSessionMock({
      parameterValues: { [FACE_ANGLE_X]: 0 },
      session: createDrawableSessionWithKeyforms(),
      setActiveParameterValue
    });
    const harness = await renderParameterBar();

    try {
      expect(getFakeElementByTestId(harness.container, "parameter-bar-readonly-reason").textContent)
        .toContain("Dynamics preview");

      const track = getFakeElementByTestId(harness.container, "parameter-slider-track");
      track.boundingClientRect = { left: 100, width: 200 };
      const thumb = getFakeElementByTestId(harness.container, "parameter-slider-thumb");
      getFakeReactProps(thumb).onPointerDown?.(
        createPointerEvent({
          clientX: 300,
          currentTarget: thumb,
          pointerId: 8
        })
      );
      getFakeReactProps(thumb).onPointerMove?.(
        createPointerEvent({
          clientX: 300,
          currentTarget: thumb,
          pointerId: 8
        })
      );

      const marker = getFakeElementByAttribute(harness.container, "data-parameter-value", "30");
      getFakeReactProps(marker).onClick?.({
        stopPropagation: vi.fn()
      });

      expect(setActiveParameterValue).not.toHaveBeenCalled();
    } finally {
      await harness.cleanup();
    }
  });

  it("keeps marker and thumb interaction off the keyboard focus path", async () => {
    installEditorSessionMock({
      parameterValues: { [FACE_ANGLE_X]: 0 },
      session: createDrawableSessionWithKeyforms()
    });
    const harness = await renderParameterBar();

    try {
      const marker = getFakeElementByAttribute(harness.container, "data-parameter-value", "30");
      const thumb = getFakeElementByTestId(harness.container, "parameter-slider-thumb");

      expect(marker.localName).toBe("div");
      expect(marker.getAttribute("aria-label")).toBeNull();
      expect(marker.getAttribute("tabindex")).toBeNull();
      expect(marker.getAttribute("role")).toBeNull();
      expect(thumb.localName).toBe("div");
      expect(thumb.getAttribute("aria-label")).toBeNull();
      expect(thumb.getAttribute("tabindex")).toBeNull();
      expect(thumb.getAttribute("role")).toBeNull();
    } finally {
      await harness.cleanup();
    }
  });

  it("uses a track guard that prevents browser-native pointer side effects", () => {
    const preventDefault = vi.fn();

    handleParameterSliderTrackPointerDown({ preventDefault });

    expect(preventDefault).toHaveBeenCalledTimes(1);
  });
});

function installEditorSessionMock({
  parameterValues,
  selection = { kind: "drawable", id: DRAW_FACE },
  session,
  setActiveParameterValue = vi.fn()
}: {
  readonly parameterValues: Readonly<Record<string, number>>;
  readonly selection?: { readonly kind: "drawable"; readonly id: typeof DRAW_FACE } | {
    readonly kind: "rigControl";
    readonly id: typeof RIG_FACE_ROTATION;
  };
  readonly session: AuthoringSession;
  readonly setActiveParameterValue?: (value: number) => void;
}): void {
  editorSessionMock.current = {
    activeParameterId: FACE_ANGLE_X,
    editKeyformKey: vi.fn(),
    openParameterManager: vi.fn(),
    parameterBar: createParameterBarProjection(session, FACE_ANGLE_X, parameterValues),
    parameterOperationFeedback: null,
    parameterValues,
    resetActiveParameterValue: vi.fn(),
    selection,
    session,
    setActiveParameterId: vi.fn(),
    setActiveParameterValue
  };
}

async function renderParameterBar(): Promise<{
  readonly cleanup: () => Promise<void>;
  readonly container: FakeElement;
}> {
  const fakeRoot = createFakeDomRoot();
  let reactRoot: Root | null = createRoot(fakeRoot.container as unknown as Element);

  await act(async () => {
    reactRoot?.render(createElement(ParameterBar));
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

function createDrawableSessionWithKeyforms(): AuthoringSession {
  const session = createDrawableSession();
  session.graph.keyformSets.push({
    keyformSetId: KeyformSetIdSchema.parse("keyset_parameter_bar_drawable_opacity"),
    target: {
      kind: "drawable",
      id: DRAW_FACE,
      property: "opacity"
    },
    parameterId: FACE_ANGLE_X,
    evaluator: "linear-1d-v1",
    interpolation: "linear-1d-v1",
    compositionMode: "replace",
    compositionOrder: 0,
    keys: [
      { value: -30, statePatch: 0.25 },
      { value: 30, statePatch: 1 }
    ]
  });
  return session;
}

function createDrawableSession(): AuthoringSession {
  const session = createEmptyAuthoringSession();
  session.graph.drawables.push({
    drawableId: DRAW_FACE,
    displayName: "Face",
    partId: ROOT_PART_ID,
    sourceAssetId: SOURCE_ASSET,
    textureId: TEX_FACE,
    meshId: MESH_FACE,
    defaultOpacity: 1,
    runtimeVisibility: true,
    baseDrawOrder: 0,
    sourceProvenanceId: PROVENANCE
  });
  session.graph.drawOrder.push({ drawableId: DRAW_FACE, baseDrawOrder: 0, stableOrder: 0 });
  session.graph.stableOrder.push(DRAW_FACE);
  return session;
}

function createRotationSession(): AuthoringSession {
  const session = createDrawableSession();
  session.graph.rigControls.push({
    kind: "rotation2d" as const,
    rigControlId: RIG_FACE_ROTATION,
    displayName: "Face Rotation",
    partId: ROOT_PART_ID,
    childDrawableIds: [DRAW_FACE],
    childRigControlIds: [],
    opacityMultiplier: 1,
    pivot: { x: 10, y: 10 },
    restAngleDegrees: 0,
    restTranslation: { x: 0, y: 0 },
    restScale: { x: 1, y: 1 },
    enabled: true
  });
  session.graph.rigControlRootIds.push(RIG_FACE_ROTATION);
  session.graph.stableOrder.push(RIG_FACE_ROTATION);
  return session;
}

type FakePointerEvent = {
  readonly clientX: number;
  readonly currentTarget: FakeElement;
  readonly pointerId: number;
  readonly preventDefault: () => void;
  readonly stopPropagation: () => void;
};

type FakeReactProps = {
  readonly onClick?: (event: { readonly stopPropagation: () => void }) => void;
  readonly onPointerDown?: (event: FakePointerEvent) => void;
  readonly onPointerMove?: (event: FakePointerEvent) => void;
};

type FakeNode = FakeElement | FakeTextNode;

function createPointerEvent({
  clientX,
  currentTarget,
  pointerId
}: {
  readonly clientX: number;
  readonly currentTarget: FakeElement;
  readonly pointerId: number;
}): FakePointerEvent {
  return {
    clientX,
    currentTarget,
    pointerId,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn()
  };
}

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
  boundingClientRect = { left: 0, width: 100 };
  disabled = false;
  max = "";
  min = "";
  parentNode: FakeElement | null = null;
  namespaceURI = "http://www.w3.org/1999/xhtml";
  nodeValue: string | null = null;
  selected = false;
  type = "";
  value = "";

  private readonly attributes = new Map<string, string>();
  private readonly pointerCaptures = new Set<number>();

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
    }
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
    if (name === "disabled" || name === "selected") {
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

  getBoundingClientRect(): Pick<DOMRect, "left" | "width"> {
    return this.boundingClientRect;
  }

  setPointerCapture(pointerId: number): void {
    this.pointerCaptures.add(pointerId);
  }

  releasePointerCapture(pointerId: number): void {
    this.pointerCaptures.delete(pointerId);
  }

  hasPointerCapture(pointerId: number): boolean {
    return this.pointerCaptures.has(pointerId);
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
  const element = getMaybeFakeElementByAttribute(root, "data-testid", testId);
  if (element === undefined) {
    throw new Error(`Element with data-testid "${testId}" was not rendered.`);
  }

  return element;
}

function getFakeElementByAttribute(
  root: FakeElement,
  attributeName: string,
  attributeValue: string
): FakeElement {
  const element = getMaybeFakeElementByAttribute(root, attributeName, attributeValue);
  if (element === undefined) {
    throw new Error(`Element with ${attributeName}="${attributeValue}" was not rendered.`);
  }

  return element;
}

function getMaybeFakeElementByAttribute(
  root: FakeElement,
  attributeName: string,
  attributeValue: string
): FakeElement | undefined {
  return findFakeElements(
    root,
    (candidate) => candidate.getAttribute(attributeName) === attributeValue
  )[0];
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
