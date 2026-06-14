import type {
  AuthoringSession,
  DrawableGeneratedMeshResult
} from "@private-2d-rigging-lab/authoring-core";
import {
  DrawableIdSchema,
  ParameterIdSchema,
  type ParameterId
} from "@private-2d-rigging-lab/contracts";
import { act, createElement, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import {
  EditorSessionProvider,
  logMeshGenerationPreviewDebug,
  useEditorSession
} from "./editor-session-context";

type EditorSessionContextSnapshot = ReturnType<typeof useEditorSession>;
type FakeNode = FakeElement | FakeTextNode;

const CUSTOM_PARAMETER_ID = ParameterIdSchema.parse("param_custom_history");

describe("EditorSessionProvider history integration", () => {
  it("includes v6 adaptive contour diagnostics in mesh preview debug logs", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);

    try {
      logMeshGenerationPreviewDebug({
        session: {
          graph: {
            drawables: [
              {
                drawableId: DrawableIdSchema.parse("draw_body"),
                displayName: "Body"
              }
            ]
          }
        } as AuthoringSession,
        drawableId: DrawableIdSchema.parse("draw_body"),
        presetId: "standard",
        method: "auto-outline-v6d-adaptive-contour-constrainautor",
        densityHint: "medium",
        generated: createGeneratedMeshResultWithAdaptiveContourDiagnostics()
      });

      expect(info).toHaveBeenCalledTimes(1);
      expect(info.mock.calls[0]?.[1]).toMatchObject({
        constrainautorDiagnostics: {
          constraintEdgeCount: 24,
          missingConstraintEdgeCount: 0
        },
        adaptiveDensityDiagnostics: {
          resolvedBoundarySpacing: 12,
          resolvedMaxBoundaryVertices: 128
        }
      });
    } finally {
      info.mockRestore();
    }
  });

  it("records one committed provider action as one Undo entry under StrictMode", async () => {
    const harness = await renderEditorSessionProbe();

    try {
      expect(harness.context().canUndo).toBe(false);

      await act(async () => {
        const result = harness.context().createCustomParameter(createCustomParameterPayload());
        expect(result.committed).toBe(true);
      });

      expect(hasCustomParameter(harness.context())).toBe(true);
      expect(harness.context().canUndo).toBe(true);
      expect(harness.context().canRedo).toBe(false);

      await act(async () => {
        harness.context().undo();
      });

      expect(hasCustomParameter(harness.context())).toBe(false);
      expect(harness.context().canUndo).toBe(false);
      expect(harness.context().canRedo).toBe(true);

      await act(async () => {
        harness.context().redo();
      });

      expect(hasCustomParameter(harness.context())).toBe(true);
      expect(harness.context().canUndo).toBe(true);
      expect(harness.context().canRedo).toBe(false);
    } finally {
      await harness.cleanup();
    }
  });

  it("does not dirty history for active parameter scrub or reset", async () => {
    const harness = await renderEditorSessionProbe();

    try {
      const activeParameterId = requireActiveParameterId(harness.context());

      await act(async () => {
        harness.context().setActiveParameterValue(1);
      });

      expect(harness.context().parameterValues[activeParameterId]).toBe(1);
      expect(harness.context().canUndo).toBe(false);
      expect(harness.context().canRedo).toBe(false);

      await act(async () => {
        harness.context().resetActiveParameterValue();
      });

      expect(harness.context().canUndo).toBe(false);
      expect(harness.context().canRedo).toBe(false);

      await act(async () => {
        const result = harness.context().createCustomParameter(createCustomParameterPayload());
        expect(result.committed).toBe(true);
      });

      expect(harness.context().canUndo).toBe(true);

      await act(async () => {
        harness.context().undo();
      });

      expect(harness.context().canUndo).toBe(false);
      expect(harness.context().canRedo).toBe(true);
    } finally {
      await harness.cleanup();
    }
  });
});

function Probe({
  onRender
}: {
  readonly onRender: (context: EditorSessionContextSnapshot) => void;
}) {
  onRender(useEditorSession());
  return null;
}

async function renderEditorSessionProbe(): Promise<{
  readonly cleanup: () => Promise<void>;
  readonly context: () => EditorSessionContextSnapshot;
}> {
  const fakeRoot = createFakeDomRoot();
  let context: EditorSessionContextSnapshot | null = null;
  let reactRoot: Root | null = null;

  reactRoot = createRoot(fakeRoot.container as unknown as Element);
  await act(async () => {
    reactRoot?.render(
      createElement(
        StrictMode,
        null,
        createElement(
          EditorSessionProvider,
          null,
          createElement(Probe, {
            onRender: (nextContext) => {
              context = nextContext;
            }
          })
        )
      )
    );
  });

  return {
    context: () => {
      if (context === null) {
        throw new Error("Editor session context was not rendered.");
      }

      return context;
    },
    cleanup: async () => {
      await act(async () => {
        reactRoot?.unmount();
      });
      fakeRoot.restore();
    }
  };
}

function createCustomParameterPayload() {
  return {
    parameterId: CUSTOM_PARAMETER_ID,
    displayName: "Custom History",
    valueSource: "authoredInput" as const,
    min: 0,
    default: 0,
    max: 1,
    recommendedUiStep: 0.01
  };
}

function hasCustomParameter(context: EditorSessionContextSnapshot): boolean {
  return context.session.graph.parameters.some(
    (parameter) => parameter.parameterId === CUSTOM_PARAMETER_ID
  );
}

function createGeneratedMeshResultWithAdaptiveContourDiagnostics(): DrawableGeneratedMeshResult {
  return {
    source: "outline-v6d-adaptive-contour-constrainautor-rgba",
    mesh: {
      meshId: "mesh_body",
      drawableId: "draw_body",
      vertices: [],
      uvs: [],
      triangles: [],
      vertexStableIds: [],
      triangleStableIds: [],
      topologyRevision: 0,
      bounds: { x: 0, y: 0, width: 10, height: 10 },
      generationProvenanceId: "prov_generate_body"
    },
    qualityMetrics: {
      maxEdgeLength: 0,
      maxTriangleArea: 0,
      minAngleDegrees: 0,
      maxVertexValence: 0,
      refinementIterationCount: 0,
      triangulationMode: "v6d-adaptive-contour-constrainautor",
      v6Metrics: {
        algorithmId: "auto-outline-v6-alpha-constrained-delaunay",
        methodId: "auto-outline-v6d-adaptive-contour-constrainautor",
        backendId: "v6d-adaptive-contour-constrainautor",
        backendImplementationStatus: "implemented",
        requestedSourceId: "outline-v6d-adaptive-contour-constrainautor-rgba",
        actualSourceId: "outline-v6d-adaptive-contour-constrainautor-rgba",
        outputKind: "backend-output",
        preset: "medium",
        fallbackSteps: [],
        vertexCount: 0,
        triangleCount: 0,
        boundaryVertexCount: 0,
        interiorVertexCount: 0,
        alphaBoundsAvailable: true,
        contourLoopCount: 1,
        holeLikeRegionCount: 0,
        removedTriangleCount: 0,
        outsideOrCrossingTriangleCount: 0,
        multiIslandHandling: "supported",
        holeHandling: "supported",
        provenance: [],
        constrainautorDiagnostics: {
          dependencyGateStatus: "available",
          constraintEdgeCount: 24,
          preservedConstraintEdgeCount: 24,
          missingConstraintEdgeCount: 0,
          constraintRecoveryFailed: false,
          outsideTriangleCount: 0
        },
        adaptiveDensityDiagnostics: {
          adaptiveDensityReferenceArea: 73_936,
          adaptiveDensityEffectiveArea: 73_936,
          adaptiveDensityAreaRatio: 1,
          adaptiveDensityClampedAreaRatio: 1,
          adaptiveDensitySpacingScale: 1,
          adaptiveDensityVertexScale: 1,
          adaptiveDensityBoundaryCapScale: 1,
          resolvedBoundarySpacing: 12,
          resolvedInteriorSpacing: 10,
          resolvedMaxBoundaryVertices: 128,
          resolvedMaxInteriorVertices: 32,
          resolvedInteriorBoundaryClearance: 1.1
        }
      }
    }
  } as DrawableGeneratedMeshResult;
}

function requireActiveParameterId(context: EditorSessionContextSnapshot): ParameterId {
  if (context.activeParameterId === null) {
    throw new Error("Expected an initialized active parameter.");
  }

  return context.activeParameterId;
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
  parentNode: FakeElement | null = null;
  namespaceURI = "http://www.w3.org/1999/xhtml";
  nodeValue: string | null = null;

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
    this.attributes.set(name, String(value));
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
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
