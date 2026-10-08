import {
  DynamicsGroupIdSchema,
  ParameterIdSchema,
  type ParameterId
} from "@private-2d-rigging-lab/contracts";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EditorSessionProvider } from "../../features/editor-session/editor-session-context";
import { createEmptyAuthoringSession } from "../../features/editor-session/model/empty-authoring-session";
import { createParameterBarProjection } from "../../features/editor-session/model/parameter-keyform-state";
import { createParameterManagerProjection } from "../../features/editor-session/model/parameter-manager-projection";
import { TooltipProvider } from "../../ui/tooltip";
import { AuthoringWorkspaceContent } from "../authoring-workspace";
import { ParameterBar } from "../panels/parameter-bar";
import {
  ParameterDetailsPanel,
  ParameterManagerScreen,
  ParameterManagerTable,
  setActiveParameterFromManager
} from "./parameter-manager-screen";

describe("ParameterManagerTable", () => {
  it("renders the v0 table columns without a Role column", () => {
    const projection = createParameterManagerProjection(createEmptyAuthoringSession());
    const markup = renderToStaticMarkup(
      createElement(ParameterManagerTable, {
        activeParameterId: ParameterIdSchema.parse("param_face_angle_x"),
        onSelect: () => undefined,
        rows: projection.filteredRows.slice(0, 3),
        selectedParameterId: ParameterIdSchema.parse("param_face_angle_x")
      })
    );

    expect(markup).toContain("<th");
    expect(markup).toContain("Name");
    expect(markup).toContain("Kind");
    expect(markup).toContain("Range");
    expect(markup).toContain("Used");
    expect(markup).not.toContain(">Role<");
    expect(markup).toContain("Face Angle X");
  });

  it("renders the Parameter Manager route from the parameters workspace entry", () => {
    const markup = renderToStaticMarkup(
      createElement(
        TooltipProvider,
        null,
        createElement(
          EditorSessionProvider,
          { initialWorkspaceOpen: true },
          createElement(AuthoringWorkspaceContent, { activeEntry: "parameters" })
        )
      )
    );

    expect(markup).toContain("Parameter Manager");
    expect(markup).toContain("Parameter Bar");
    expect(markup).toContain("Custom");
    expect(markup).not.toContain("From Preset");
  });

  it("blocks deleting a custom parameter referenced only by dynamics and shows dynamics usage", () => {
    const session = createEmptyAuthoringSession();
    const parameterId = ParameterIdSchema.parse("param_custom_driver");
    session.graph.parameters.push({
      parameterId,
      displayName: "Custom Driver",
      valueSource: "authoredInput",
      min: 0,
      default: 0,
      max: 1,
      recommendedUiStep: 0.01
    });
    session.graph.dynamicsGroups.push({
      dynamicsGroupId: DynamicsGroupIdSchema.parse("dyn_smile_follow"),
      displayName: "Smile Follow",
      enabled: true,
      inputs: [
        {
          parameterId,
          kind: "angle",
        scale: 1}
      ],
      chain: {
      rootOffset: { x: 0, y: 0 },
      segmentLengths: [14],
      damping: 2.5,
      gravityScale: 1
    },
      outputs: [
        {
          parameterId: ParameterIdSchema.parse("param_mouth_open"),
          segmentIndex: 1,
          scale: 1,
          limit: 1
        }
      ]
    });
    const projection = createParameterManagerProjection(session);
    const row = projection.rows.find((candidate) => candidate.parameterId === parameterId);
    if (row === undefined) {
      throw new Error("Expected custom dynamics parameter row.");
    }

    const markup = renderToStaticMarkup(
      createElement(ParameterDetailsPanel, {
        activeParameterId: null,
        feedback: null,
        onDelete: () => undefined,
        onSetActive: () => undefined,
        onUpdate: () => undefined,
        row,
        setShowUsage: () => undefined,
        showUsage: true
      })
    );

    expect(row.usageSummary).toBe("Used by 1 target");
    expect(markup).toContain(
      "Delete is disabled while keyforms or dynamics reference this custom parameter."
    );
    expect(markup).toContain("disabled");
    expect(markup).toContain("Dynamics: Smile Follow");
    expect(markup).toContain("driver input parameter");
    expect(markup).toContain("Input 1 / angle");
  });

  it("shares Set Active manager actions with the Parameter Bar projection", () => {
    const session = createEmptyAuthoringSession();
    const projection = createParameterManagerProjection(session);
    const row = projection.rows.find(
      (candidate) => candidate.parameterId === ParameterIdSchema.parse("param_mouth_open")
    );
    if (row === undefined) {
      throw new Error("Expected preset row.");
    }
    let activeParameterId: ParameterId | null = null;

    const feedback = setActiveParameterFromManager(row, (parameterId) => {
      activeParameterId = parameterId;
    });
    const parameterBar = createParameterBarProjection(session, activeParameterId, {});

    expect(feedback).toBe("Mouth Open is active in the Parameter Bar.");
    expect(parameterBar.activeParameter?.parameterId).toBe(row.parameterId);
    expect(parameterBar.activeParameter?.displayName).toBe(row.displayName);
  });

  it("updates the rendered Parameter Bar after a Manager Set Active click through the provider", async () => {
    const root = createFakeDomRoot();
    let reactRoot: Root | null = null;

    try {
      reactRoot = createRoot(root.container as unknown as Element);
      await act(async () => {
        reactRoot?.render(
          createElement(
            EditorSessionProvider,
            null,
            createElement(ParameterManagerScreen),
            createElement(ParameterBar)
          )
        );
      });

      const activeSelect = getFakeElementByAriaLabel(root.container, "Active parameter");
      expect(getFakeReactProps(activeSelect).value).toBe("param_face_angle_x");

      await clickFakeElement(getFakeButtonByText(root.container, "Mouth Open"));
      await clickFakeElement(getFakeButtonByText(root.container, "Set Active"));

      expect(root.container.textContent).toContain("Mouth Open is active in the Parameter Bar.");
      const updatedActiveSelect = getFakeElementByAriaLabel(root.container, "Active parameter");
      const updatedSelectValue = getFakeReactProps(updatedActiveSelect).value;
      expect(updatedSelectValue).toBe("param_mouth_open");
      expect(
        updatedActiveSelect.options.find((option) => option.value === updatedSelectValue)
          ?.textContent
      ).toBe("Mouth Open");
      const parameterSlider = getFakeElementByTestId(root.container, "parameter-slider-thumb");
      expect(parameterSlider.getAttribute("data-parameter-min")).toBe("0");
      expect(parameterSlider.getAttribute("data-parameter-max")).toBe("1");
      expect(parameterSlider.getAttribute("data-parameter-value")).toBe("0");
      expect(getFakeElementByAriaLabel(root.container, "Parameter numeric value").value).toBe("0");
      expect(getFakeButtonByText(root.container, "Active in Parameter Bar")).toBeDefined();
    } finally {
      if (reactRoot !== null) {
        await act(async () => {
          reactRoot?.unmount();
        });
      }
      root.restore();
    }
  });
});

type FakeNode = FakeElement | FakeTextNode;
type FakeReactProps = {
  readonly onClick?: (event: {
    readonly currentTarget: FakeElement;
    readonly target: FakeElement;
    readonly preventDefault: () => void;
    readonly stopPropagation: () => void;
  }) => void;
  readonly value?: number | string | readonly string[];
};

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
  parentNode: FakeElement | null = null;
  namespaceURI = "http://www.w3.org/1999/xhtml";
  nodeValue: string | null = null;
  value = "";
  min = "";
  max = "";
  disabled = false;
  selected = false;
  type = "";

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
    if (name === "value" || name === "min" || name === "max" || name === "type") {
      this[name] = normalized;
    }
    if (name === "disabled") {
      this.disabled = true;
    }
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
    if (name === "disabled") {
      this.disabled = false;
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

async function clickFakeElement(element: FakeElement): Promise<void> {
  const props = getFakeReactProps(element);
  if (props.onClick === undefined) {
    throw new Error(`Element "${element.textContent}" does not have an onClick prop.`);
  }

  await act(async () => {
    props.onClick?.({
      currentTarget: element,
      target: element,
      preventDefault: () => undefined,
      stopPropagation: () => undefined
    });
  });
}

function getFakeButtonByText(root: FakeElement, text: string): FakeElement {
  const button = findFakeElements(root, (element) => element.localName === "button").find(
    (element) => element.textContent.trim() === text
  );
  if (button === undefined) {
    throw new Error(`Button with text "${text}" was not rendered.`);
  }

  return button;
}

function getFakeElementByAriaLabel(root: FakeElement, label: string): FakeElement {
  const element = findFakeElements(root, (candidate) => candidate.getAttribute("aria-label") === label)[0];
  if (element === undefined) {
    throw new Error(`Element with aria-label "${label}" was not rendered.`);
  }

  return element;
}

function getFakeElementByTestId(root: FakeElement, testId: string): FakeElement {
  const element = findFakeElements(root, (candidate) => candidate.getAttribute("data-testid") === testId)[0];
  if (element === undefined) {
    throw new Error(`Element with data-testid "${testId}" was not rendered.`);
  }

  return element;
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
