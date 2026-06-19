import { ParameterIdSchema, type ParameterId } from "@private-2d-rigging-lab/contracts";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { EditorParameter } from "../../features/editor-session/model/parameter-keyform-state";
import { RuntimeControls } from "./runtime-controls";
import {
  createInitialRuntimeControlsState,
  createRuntimeControlsProjection,
  createRuntimeParameterValueMap,
  normalizeRuntimeParameterOverrides,
  resetAllRuntimeParameterOverrides,
  resetRuntimeParameterOverride,
  setRuntimeControlsSearch,
  setRuntimeParameterOverride,
  type ViewerRuntimeControlsState
} from "./runtime-controls-state";

const FACE_ANGLE_X = ParameterIdSchema.parse("param_face_angle_x");
const MOUTH_OPEN = ParameterIdSchema.parse("param_mouth_open");
const HAIR_SWAY = ParameterIdSchema.parse("param_hair_sway_output");
const CUSTOM_BROW = ParameterIdSchema.parse("param_custom_brow");

describe("viewer runtime controls state", () => {
  it("filters editable parameters by display name or id and excludes computedDynamics", () => {
    const parameters = [
      createParameter(FACE_ANGLE_X, "Face Angle X", { min: -30, max: 30 }),
      createParameter(MOUTH_OPEN, "Mouth Open", { min: 0, max: 1 }),
      createParameter(HAIR_SWAY, "Hair Sway Output", {
        min: -1,
        max: 1,
        valueSource: "computedDynamics"
      })
    ];

    const byName = createRuntimeControlsProjection(
      parameters,
      setRuntimeControlsSearch(createInitialRuntimeControlsState(), "mouth")
    );
    expect(byName.rows.map((row) => row.parameterId)).toEqual([MOUTH_OPEN]);
    expect(byName.hiddenComputedParameterCount).toBe(1);

    const byId = createRuntimeControlsProjection(
      parameters,
      setRuntimeControlsSearch(createInitialRuntimeControlsState(), "param_face")
    );
    expect(byId.rows.map((row) => row.parameterId)).toEqual([FACE_ANGLE_X]);
    expect(byId.rows.some((row) => row.parameterId === HAIR_SWAY)).toBe(false);
  });

  it("excludes authored Dynamics output parameters without hiding driver inputs", () => {
    const parameters = [
      createParameter(FACE_ANGLE_X, "Face Angle X", { min: -30, max: 30 }),
      createParameter(HAIR_SWAY, "Hair Sway Output", {
        min: -1,
        max: 1,
        valueSource: "authoredInput"
      })
    ];
    const dynamicsOutputParameterIds = new Set<ParameterId>([HAIR_SWAY]);
    const state: ViewerRuntimeControlsState = {
      parameterOverrides: {
        [FACE_ANGLE_X]: 10,
        [HAIR_SWAY]: 0.5
      },
      search: ""
    };
    const projection = createRuntimeControlsProjection(parameters, state, {
      excludedParameterIds: dynamicsOutputParameterIds
    });

    expect(projection.rows.map((row) => row.parameterId)).toEqual([FACE_ANGLE_X]);
    expect(projection.changedParameterCount).toBe(1);
    expect(projection.hiddenDynamicsOutputParameterCount).toBe(1);
    expect(
      normalizeRuntimeParameterOverrides(parameters, state.parameterOverrides, {
        excludedParameterIds: dynamicsOutputParameterIds
      })
    ).toEqual({
      [FACE_ANGLE_X]: 10
    });
    expect(
      createRuntimeParameterValueMap(parameters, state, {
        excludedParameterIds: dynamicsOutputParameterIds
      })
    ).toEqual({
      [FACE_ANGLE_X]: 10
    });
  });

  it("clamps override updates and removes entries when values return to default", () => {
    const parameter = createParameter(FACE_ANGLE_X, "Face Angle X", {
      defaultValue: 0,
      max: 30,
      min: -30
    });
    const clamped = setRuntimeParameterOverride(
      createInitialRuntimeControlsState(),
      parameter,
      99
    );

    expect(clamped.parameterOverrides[FACE_ANGLE_X]).toBe(30);
    expect(createRuntimeControlsProjection([parameter], clamped).rows[0]?.currentValue).toBe(30);

    const resetByDefault = setRuntimeParameterOverride(clamped, parameter, 0);
    expect(resetByDefault.parameterOverrides[FACE_ANGLE_X]).toBeUndefined();

    const resetByNonFinite = setRuntimeParameterOverride(clamped, parameter, Number.NaN);
    expect(resetByNonFinite.parameterOverrides[FACE_ANGLE_X]).toBeUndefined();
  });

  it("normalizes default-valued entries out of parameterOverrides", () => {
    const parameter = createParameter(MOUTH_OPEN, "Mouth Open", {
      defaultValue: 0,
      max: 1,
      min: 0
    });

    expect(
      normalizeRuntimeParameterOverrides([parameter], {
        [MOUTH_OPEN]: 0
      })
    ).toEqual({});
  });

  it("keeps same-value override updates as no-ops while preserving default removal", () => {
    const parameter = createParameter(FACE_ANGLE_X, "Face Angle X", {
      defaultValue: 0,
      max: 30,
      min: -30
    });
    const changed: ViewerRuntimeControlsState = {
      parameterOverrides: {
        [FACE_ANGLE_X]: 10
      },
      search: "face"
    };

    expect(setRuntimeParameterOverride(changed, parameter, 10)).toBe(changed);

    const removed = setRuntimeParameterOverride(changed, parameter, 0);
    expect(removed).not.toBe(changed);
    expect(removed).toEqual({
      parameterOverrides: {},
      search: "face"
    });

    const unchangedDefault = setRuntimeParameterOverride(removed, parameter, 0);
    expect(unchangedDefault).toBe(removed);
    expect(resetRuntimeParameterOverride(removed, FACE_ANGLE_X)).toBe(removed);
    expect(resetAllRuntimeParameterOverrides(removed)).toBe(removed);
  });

  it("projects changed indication and supports row and all resets", () => {
    const parameters = [
      createParameter(FACE_ANGLE_X, "Face Angle X", { min: -30, max: 30 }),
      createParameter(MOUTH_OPEN, "Mouth Open", { min: 0, max: 1 }),
      createParameter(CUSTOM_BROW, "Custom Brow", { min: -1, max: 1 })
    ];
    const state: ViewerRuntimeControlsState = {
      parameterOverrides: {
        [FACE_ANGLE_X]: 10,
        [MOUTH_OPEN]: 1
      },
      search: ""
    };
    const projection = createRuntimeControlsProjection(parameters, state);

    expect(projection.changedParameterCount).toBe(2);
    expect(
      projection.rows.map((row) => ({
        changed: row.changed,
        id: row.parameterId
      }))
    ).toEqual([
      { changed: true, id: FACE_ANGLE_X },
      { changed: true, id: MOUTH_OPEN },
      { changed: false, id: CUSTOM_BROW }
    ]);

    const rowReset = resetRuntimeParameterOverride(state, FACE_ANGLE_X);
    expect(rowReset.parameterOverrides[FACE_ANGLE_X]).toBeUndefined();
    expect(rowReset.parameterOverrides[MOUTH_OPEN]).toBe(1);

    const allReset = resetAllRuntimeParameterOverrides({
      parameterOverrides: {
        [FACE_ANGLE_X]: 10
      },
      search: "face"
    });
    expect(allReset).toEqual({
      parameterOverrides: {},
      search: "face"
    });
  });

  it("ignores direct override attempts for computedDynamics parameters", () => {
    const computed = createParameter(HAIR_SWAY, "Hair Sway Output", {
      max: 1,
      min: -1,
      valueSource: "computedDynamics"
    });
    const state = setRuntimeParameterOverride(
      {
        parameterOverrides: {
          [HAIR_SWAY]: 0.5
        },
        search: ""
      },
      computed,
      0.75
    );

    expect(state.parameterOverrides[HAIR_SWAY]).toBeUndefined();
    expect(createRuntimeControlsProjection([computed], state).rows).toEqual([]);
  });

  it("ignores direct override attempts for authored Dynamics output parameters", () => {
    const authoredOutput = createParameter(HAIR_SWAY, "Hair Sway Output", {
      max: 1,
      min: -1,
      valueSource: "authoredInput"
    });
    const state = setRuntimeParameterOverride(
      {
        parameterOverrides: {
          [HAIR_SWAY]: 0.5
        },
        search: ""
      },
      authoredOutput,
      0.75,
      {
        excludedParameterIds: new Set([HAIR_SWAY])
      }
    );

    expect(state.parameterOverrides[HAIR_SWAY]).toBeUndefined();
    expect(
      createRuntimeControlsProjection([authoredOutput], state, {
        excludedParameterIds: new Set([HAIR_SWAY])
      }).rows
    ).toEqual([]);
  });

  it("creates runtime parameter values without reading or mutating authoring values", () => {
    const parameter = createParameter(FACE_ANGLE_X, "Face Angle X", {
      max: 30,
      min: -30
    });
    const state: ViewerRuntimeControlsState = {
      parameterOverrides: {
        [FACE_ANGLE_X]: 99
      },
      search: ""
    };

    const runtimeValues = createRuntimeParameterValueMap([parameter], state);

    expect(runtimeValues).toEqual({
      [FACE_ANGLE_X]: 30
    });
    expect(state.parameterOverrides[FACE_ANGLE_X]).toBe(99);
  });
});

function createParameter(
  parameterId: ParameterId,
  displayName: string,
  options: {
    readonly defaultValue?: number;
    readonly max: number;
    readonly min: number;
    readonly recommendedUiStep?: number;
    readonly valueSource?: EditorParameter["valueSource"];
  }
): EditorParameter {
  return {
    parameterId,
    displayName,
    valueSource: options.valueSource ?? "authoredInput",
    min: options.min,
    max: options.max,
    default: options.defaultValue ?? 0,
    recommendedUiStep: options.recommendedUiStep ?? 0.01,
    kind: "custom",
    parameterType: "scalar",
    group: "custom",
    lockedFields: []
  };
}

describe("RuntimeControls UI", () => {
  it("renders a Viewer runtime controls surface without an EditorSession provider", () => {
    const markup = renderRuntimeControls({
      parameters: [
        createParameter(FACE_ANGLE_X, "Face Angle X", { max: 30, min: -30 }),
        createParameter(MOUTH_OPEN, "Mouth Open", { max: 1, min: 0 }),
        createParameter(HAIR_SWAY, "Hair Sway Output", {
          max: 1,
          min: -1,
          valueSource: "computedDynamics"
        })
      ],
      state: createInitialRuntimeControlsState()
    });

    expect(markup).toContain("Runtime Controls");
    expect(markup).toContain('data-testid="viewer-render-source-mode"');
    expect(markup).toContain("Original");
    expect(markup).toContain("Atlas Runtime");
    expect(markup).toContain('aria-label="Search parameters"');
    expect(markup).toContain("Face Angle X");
    expect(markup).toContain("Mouth Open");
    expect(markup).not.toContain("Hair Sway Output");
    expect(markup).not.toContain("Parameter Bar");
    expect(markup).not.toContain("Keyform");
    expect(markup).not.toContain("Favorite");
    expect(markup).not.toContain("Group");
  });

  it("renders render source mode above parameter search and shows a disabled reason", () => {
    const markup = renderRuntimeControls({
      atlasRuntimeDisabledReason: "Apply a texture atlas first.",
      parameters: [
        createParameter(FACE_ANGLE_X, "Face Angle X", { max: 30, min: -30 }),
        createParameter(MOUTH_OPEN, "Mouth Open", { max: 1, min: 0 })
      ],
      state: createInitialRuntimeControlsState()
    });

    expect(markup.indexOf('data-testid="viewer-render-source-mode"')).toBeLessThan(
      markup.indexOf('aria-label="Search parameters"')
    );
    expect(markup).toContain('aria-label="Use Original render source"');
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('data-testid="viewer-render-source-disabled-reason"');
    expect(markup).toContain("Apply a texture atlas first.");
    expect(markup).toContain("Atlas Runtime unavailable: Apply a texture atlas first.");
  });

  it("renders parameter name search below render source mode and filters visible rows", () => {
    const markup = renderRuntimeControls({
      parameters: [
        createParameter(FACE_ANGLE_X, "Face Angle X", { max: 30, min: -30 }),
        createParameter(MOUTH_OPEN, "Mouth Open", { max: 1, min: 0 })
      ],
      state: {
        parameterOverrides: {},
        search: "mouth"
      }
    });

    expect(markup.indexOf('data-testid="viewer-render-source-mode"')).toBeLessThan(
      markup.indexOf('aria-label="Search parameters"')
    );
    expect(markup.indexOf('aria-label="Search parameters"')).toBeLessThan(
      markup.indexOf('data-testid="runtime-parameter-list"')
    );
    expect(markup).toContain("Mouth Open");
    expect(markup).not.toContain("Face Angle X");
  });

  it("marks changed rows and renders compact row reset plus icon-only reset all", () => {
    const markup = renderRuntimeControls({
      parameters: [
        createParameter(FACE_ANGLE_X, "Face Angle X", { max: 30, min: -30 }),
        createParameter(MOUTH_OPEN, "Mouth Open", { max: 1, min: 0 })
      ],
      state: {
        parameterOverrides: {
          [FACE_ANGLE_X]: 10
        },
        search: ""
      }
    });

    expect(markup).toContain('aria-label="Reset all parameter overrides"');
    expect(markup).toContain('title="Reset all"');
    expect(markup).toContain('aria-label="Reset Face Angle X"');
    expect(markup).toContain('data-changed="true"');
    expect(markup).toContain('data-changed="false"');
    expect(markup).toContain("grid-cols-[minmax(6.5rem,0.78fr)_minmax(8rem,1fr)_4rem_1.75rem]");
    expect(markup).toContain("h-7");
    expect(markup).not.toContain("Reset changed");
    expect(markup).not.toContain("Changed");
    expect(markup).not.toContain("-30 to 30");
  });

  it("renders the future playback slot as a non-interactive placeholder", () => {
    const markup = renderRuntimeControls({
      parameters: [createParameter(FACE_ANGLE_X, "Face Angle X", { max: 30, min: -30 })],
      state: createInitialRuntimeControlsState()
    });

    expect(markup).toContain('data-testid="future-playback-slot"');
    expect(markup).toContain('aria-disabled="true"');
    expect(markup).toContain("Motion / Physics");
    expect(markup).toContain("Not configured");
    expect(markup).not.toContain("Play");
    expect(markup).not.toContain("Pause");
  });

  it("renders Reset simulation for configured Dynamics without playback transport controls", () => {
    const markup = renderRuntimeControls({
      hasDynamicsSimulation: true,
      parameters: [createParameter(FACE_ANGLE_X, "Face Angle X", { max: 30, min: -30 })],
      state: createInitialRuntimeControlsState()
    });

    expect(markup).toContain('data-testid="future-playback-slot"');
    expect(markup).toContain('data-testid="viewer-reset-simulation"');
    expect(markup).toContain("Reset simulation");
    expect(markup).not.toContain("Not configured");
    expect(markup).not.toContain("Play");
    expect(markup).not.toContain("Pause");
  });

  it("coalesces runtime slider changes and flushes the final value", async () => {
    const animationFrame = installAnimationFrameMock();
    const onStateChange = vi.fn();
    const harness = await renderRuntimeControlsInteractive({
      onStateChange,
      parameters: [
        createParameter(FACE_ANGLE_X, "Face Angle X", { max: 30, min: -30 })
      ],
      state: createInitialRuntimeControlsState()
    });

    try {
      const range = getFakeInputByType(harness.container, "range");
      range.value = "10";
      getFakeReactProps(range).onChange?.({ currentTarget: range });
      range.value = "20";
      getFakeReactProps(range).onChange?.({ currentTarget: range });

      expect(onStateChange).not.toHaveBeenCalled();
      getFakeReactProps(range).onPointerUp?.();

      expect(onStateChange).toHaveBeenCalledTimes(1);
      expect(onStateChange.mock.calls[0]?.[0]).toEqual({
        parameterOverrides: {
          [FACE_ANGLE_X]: 20
        },
        search: ""
      });
      animationFrame.flushAll();
      expect(onStateChange).toHaveBeenCalledTimes(1);
    } finally {
      animationFrame.restore();
      await harness.cleanup();
    }
  });
});

function renderRuntimeControls({
  atlasRuntimeDisabledReason,
  hasDynamicsSimulation = false,
  parameters,
  renderSourceMode = "original",
  state
}: {
  readonly atlasRuntimeDisabledReason?: string;
  readonly hasDynamicsSimulation?: boolean;
  readonly parameters: readonly EditorParameter[];
  readonly renderSourceMode?: "original" | "atlasRuntime";
  readonly state: ViewerRuntimeControlsState;
}): string {
  return renderToStaticMarkup(
    createElement(RuntimeControls, {
      hasDynamicsSimulation,
      onRenderSourceModeChange: vi.fn(),
      onStateChange: vi.fn(),
      onResetSimulation: vi.fn(),
      parameters,
      renderSourceMode,
      ...(atlasRuntimeDisabledReason === undefined ? {} : { atlasRuntimeDisabledReason }),
      state
    })
  );
}

async function renderRuntimeControlsInteractive({
  onStateChange,
  parameters,
  state
}: {
  readonly onStateChange: (state: ViewerRuntimeControlsState) => void;
  readonly parameters: readonly EditorParameter[];
  readonly state: ViewerRuntimeControlsState;
}): Promise<{
  readonly cleanup: () => Promise<void>;
  readonly container: FakeElement;
}> {
  const fakeRoot = createFakeDomRoot();
  let reactRoot: Root | null = createRoot(fakeRoot.container as unknown as Element);

  await act(async () => {
    reactRoot?.render(
      createElement(RuntimeControls, {
        onRenderSourceModeChange: vi.fn(),
        onStateChange,
        parameters,
        renderSourceMode: "original",
        state
      })
    );
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

type FakeReactProps = {
  readonly onBlur?: () => void;
  readonly onChange?: (event: { readonly currentTarget: FakeElement }) => void;
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
