import { createInitialAuthoringRevision, type AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import {
  DrawableIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  RigControlIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  CommittedRotationDeformerInspector,
  CommittedWarpDeformerInspector,
  DeformerTreeWrapTargetStart,
  RigBatchTargetStart,
  createRotationUpdatePayload,
  createWarpUpdatePayload
} from "./rig-tool-inspector";
import type { DeformerTreeWrapSelectionReadModel } from "../../features/editor-session/model/deformer-tree-wrap-selection";
import type {
  RotationDeformerReadModel,
  WarpDeformerReadModel
} from "../../features/editor-session/model/rig-tool-state";

const PART_ROOT = PartIdSchema.parse("part_root");
const PART_FACE = PartIdSchema.parse("part_face");
const DRAW_FACE = DrawableIdSchema.parse("draw_face");
const DRAW_HAIR = DrawableIdSchema.parse("draw_hair");
const MESH_FACE = MeshIdSchema.parse("mesh_face");
const TEX_FACE = TextureIdSchema.parse("tex_face");
const SOURCE_ASSET = SourceAssetIdSchema.parse("src_fixture");
const PROVENANCE = ProvenanceIdSchema.parse("prov_fixture");
const RIG_FACE_WARP = RigControlIdSchema.parse("rig_face_warp");
const RIG_FACE_ROTATION = RigControlIdSchema.parse("rig_face_rotation");

describe("RigToolInspector committed Warp Deformer", () => {
  it("disables division fields for keyformed Warp Deformers and omits division updates", () => {
    const readModel = createWarpReadModel(true);
    const markup = renderToStaticMarkup(
      createElement(CommittedWarpDeformerInspector, {
        feedback: null,
        onCreateParentRotation: () => undefined,
        onCreateParentWarp: () => undefined,
        onDelete: () => undefined,
        onReparent: () => undefined,
        onUpdate: () => undefined,
        readModel,
        session: createFixtureSession()
      })
    );

    expect(inputMarkup(markup, "Transform columns control points")).toContain("disabled");
    expect(inputMarkup(markup, "Transform rows control points")).toContain("disabled");
    expect(inputMarkup(markup, "Bezier columns")).toContain("disabled");
    expect(inputMarkup(markup, "Bezier rows")).toContain("disabled");
    expect(inputMarkup(markup, "Bezier edit type")).toContain("readOnly");
    expect(markup).toContain("Delete Deformer");
    expect(markup).not.toContain('aria-label="Opacity multiplier"');

    const payload = createWarpUpdatePayload(
      readModel,
      {
        displayName: "Face Warp Edited",
        parentRigControlId: "",
        domainBounds: structuredClone(readModel.domainBounds),
        transformColumns: 8,
        transformRows: 7,
        bezierColumns: 6,
        bezierRows: 5
      },
      true
    );

    expect(payload).toEqual({
      rigControlId: RIG_FACE_WARP,
      displayName: "Face Warp Edited"
    });
    expect(payload).not.toHaveProperty("transformColumns");
    expect(payload).not.toHaveProperty("transformRows");
    expect(payload).not.toHaveProperty("bezierColumns");
    expect(payload).not.toHaveProperty("bezierRows");
  });

  it("renders Delete Deformer and invokes the delete callback", async () => {
    const onDelete = vi.fn();
    const rendered = await renderToFakeDom(
      createElement(CommittedWarpDeformerInspector, {
        feedback: null,
        onCreateParentRotation: () => undefined,
        onCreateParentWarp: () => undefined,
        onDelete,
        onReparent: () => undefined,
        onUpdate: () => undefined,
        readModel: createWarpReadModel(false),
        session: createFixtureSession()
      })
    );

    try {
      clickButtonByText(rendered.container, "Delete Deformer");
      expect(onDelete).toHaveBeenCalledWith(RIG_FACE_WARP);
    } finally {
      await rendered.cleanup();
    }
  });
});

describe("RigToolInspector committed Rotation Deformer", () => {
  it("renders compact editable setup fields and omits duplicate summaries and opacity section", () => {
    const readModel = createRotationReadModel(true);
    const markup = renderToStaticMarkup(
      createElement(CommittedRotationDeformerInspector, {
        feedback: null,
        onCreateParentRotation: () => undefined,
        onCreateParentWarp: () => undefined,
        onDelete: () => undefined,
        onReparent: () => undefined,
        onUpdate: () => undefined,
        readModel,
        session: createFixtureSession()
      })
    );

    expect(hasDisabledAttribute(inputMarkup(markup, "Rotation pivot x"))).toBe(false);
    expect(hasDisabledAttribute(inputMarkup(markup, "Rotation pivot y"))).toBe(false);
    expect(hasDisabledAttribute(inputMarkup(markup, "Rotation rest translation x"))).toBe(false);
    expect(hasDisabledAttribute(inputMarkup(markup, "Rotation rest translation y"))).toBe(false);
    expect(hasDisabledAttribute(inputMarkup(markup, "Rotation rest angle degrees"))).toBe(false);
    expect(markup).toContain("Setup transform");
    expect(markup).toContain("Delete Deformer");
    expect(markup).not.toContain("Bound children");
    expect(markup).not.toContain("Angle keyforms");
    expect(markup).not.toContain("Rotation keyforms present");
    expect(markup).not.toContain("Rest angle is fallback");
    expect(markup).not.toContain('aria-label="Opacity multiplier"');

    const payload = createRotationUpdatePayload(readModel, {
      displayName: "Face Rotation Edited",
      parentRigControlId: "",
      pivot: { x: 12, y: 34 },
      restTranslation: { x: 7, y: -4 },
      restAngleDegrees: -25
    });

    expect(payload).toEqual({
      rigControlId: RIG_FACE_ROTATION,
      displayName: "Face Rotation Edited",
      pivot: { x: 12, y: 34 },
      restTranslation: { x: 7, y: -4 },
      restAngleDegrees: -25
    });
  });

  it("renders Delete Deformer and invokes the delete callback", async () => {
    const onDelete = vi.fn();
    const rendered = await renderToFakeDom(
      createElement(CommittedRotationDeformerInspector, {
        feedback: null,
        onCreateParentRotation: () => undefined,
        onCreateParentWarp: () => undefined,
        onDelete,
        onReparent: () => undefined,
        onUpdate: () => undefined,
        readModel: createRotationReadModel(false),
        session: createFixtureSession()
      })
    );

    try {
      clickButtonByText(rendered.container, "Delete Deformer");
      expect(onDelete).toHaveBeenCalledWith(RIG_FACE_ROTATION);
    } finally {
      await rendered.cleanup();
    }
  });
});

describe("RigToolInspector batch Drawable target start", () => {
  it("shows selected Drawable names and warns for already-bound selections", () => {
    const markup = renderToStaticMarkup(
      createElement(RigBatchTargetStart, {
        onCreateRotation: () => undefined,
        onCreateWarp: () => undefined,
        targets: [
          {
            drawableId: DRAW_FACE,
            displayName: "Face",
            bounds: { x: 10, y: 20, width: 30, height: 40 },
            status: "alreadyBound",
            boundRigControlId: RIG_FACE_WARP
          },
          {
            drawableId: DRAW_HAIR,
            displayName: "Hair",
            bounds: { x: 50, y: 20, width: 30, height: 40 },
            status: "eligible"
          }
        ]
      })
    );

    expect(markup).toContain("Target Drawables");
    expect(markup).toContain("Face");
    expect(markup).toContain("Hair");
    expect(markup).toContain("Already-bound Drawables are excluded");
    expect(markup).toContain('data-testid="rig-tool-bound-drawable-warning"');
    expect(hasDisabledAttribute(buttonMarkup(markup, "Create Rotation Deformer"))).toBe(false);
    expect(hasDisabledAttribute(buttonMarkup(markup, "Create Warp Deformer"))).toBe(false);
    expect(markup).not.toContain("Wrap");
  });

  it("disables create actions when every selected Drawable is already bound", () => {
    const markup = renderToStaticMarkup(
      createElement(RigBatchTargetStart, {
        onCreateRotation: () => undefined,
        onCreateWarp: () => undefined,
        targets: [
          {
            drawableId: DRAW_FACE,
            displayName: "Face",
            bounds: { x: 10, y: 20, width: 30, height: 40 },
            status: "alreadyBound",
            boundRigControlId: RIG_FACE_WARP
          }
        ]
      })
    );

    expect(hasDisabledAttribute(buttonMarkup(markup, "Create Rotation Deformer"))).toBe(true);
    expect(hasDisabledAttribute(buttonMarkup(markup, "Create Warp Deformer"))).toBe(true);
    expect(markup).not.toContain("Wrap");
  });
});

describe("RigToolInspector Deformer Tree wrap target start", () => {
  it("shows selected Deformer Tree target names with enabled create actions", () => {
    const markup = renderToStaticMarkup(
      createElement(DeformerTreeWrapTargetStart, {
        feedback: null,
        onCreateRotation: () => undefined,
        onCreateWarp: () => undefined,
        readModel: createCoherentWrapReadModel()
      })
    );

    expect(markup).toContain("Target Selection");
    expect(markup).toContain("Face Warp");
    expect(markup).toContain("Hair");
    expect(markup).toContain("Root Deformer");
    expect(markup).toContain("Pool Drawable");
    expect(markup).not.toContain('data-testid="rig-tool-wrap-selection-warning"');
    expect(hasDisabledAttribute(buttonMarkup(markup, "Create Rotation Deformer"))).toBe(false);
    expect(hasDisabledAttribute(buttonMarkup(markup, "Create Warp Deformer"))).toBe(false);
  });

  it("disables create actions and shows a warning for incoherent selections", () => {
    const markup = renderToStaticMarkup(
      createElement(DeformerTreeWrapTargetStart, {
        feedback: null,
        onCreateRotation: () => undefined,
        onCreateWarp: () => undefined,
        readModel: {
          ...createCoherentWrapReadModel(),
          status: "incoherent",
          canCreate: false,
          warning: "Selection includes a Deformer and one of its descendants. Select direct siblings instead.",
          wrapChildren: []
        }
      })
    );

    expect(markup).toContain('data-testid="rig-tool-wrap-selection-warning"');
    expect(markup).toContain("Select direct siblings instead");
    expect(hasDisabledAttribute(buttonMarkup(markup, "Create Rotation Deformer"))).toBe(true);
    expect(hasDisabledAttribute(buttonMarkup(markup, "Create Warp Deformer"))).toBe(true);
  });
});

function inputMarkup(markup: string, ariaLabel: string): string {
  const escapedLabel = ariaLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = markup.match(new RegExp(`<input[^>]*aria-label="${escapedLabel}"[^>]*>`));
  if (match === null) {
    throw new Error(`Expected input with aria-label ${ariaLabel}.`);
  }

  return match[0];
}

function buttonMarkup(markup: string, buttonText: string): string {
  const escapedText = buttonText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = markup.match(new RegExp(`<button[^>]*>[\\s\\S]*?${escapedText}[\\s\\S]*?</button>`));
  if (match === null) {
    throw new Error(`Expected button with text ${buttonText}.`);
  }

  return match[0];
}

function hasDisabledAttribute(markup: string): boolean {
  return /\sdisabled(?:=""|(?=[\s/>]))/.test(markup);
}

async function renderToFakeDom(element: ReactElement): Promise<{
  readonly container: FakeElement;
  readonly cleanup: () => Promise<void>;
}> {
  const fakeRoot = createFakeDomRoot();
  let root: Root | null = createRoot(fakeRoot.container as unknown as Element);

  await act(async () => {
    root?.render(element);
  });

  return {
    container: fakeRoot.container,
    cleanup: async () => {
      await act(async () => {
        root?.unmount();
      });
      root = null;
      fakeRoot.restore();
    }
  };
}

function clickButtonByText(container: FakeElement, text: string): void {
  const button = findElement(container, (element) =>
    element.localName === "button" && element.textContent.includes(text)
  );
  if (button === null) {
    throw new Error(`Expected button with text ${text}.`);
  }

  button.dispatchEvent(new FakeDomEvent("click"));
}

function findElement(
  element: FakeElement,
  predicate: (element: FakeElement) => boolean
): FakeElement | null {
  if (predicate(element)) {
    return element;
  }

  for (const child of element.childNodes) {
    if (child instanceof FakeElement) {
      const match = findElement(child, predicate);
      if (match !== null) {
        return match;
      }
    }
  }

  return null;
}

type FakeNode = FakeElement | FakeTextNode;

class FakeDomEvent {
  readonly bubbles = true;
  cancelBubble = false;
  currentTarget: FakeElement | null = null;
  defaultPrevented = false;
  target: FakeElement | null = null;

  constructor(readonly type: string) {}

  preventDefault(): void {
    this.defaultPrevented = true;
  }

  stopPropagation(): void {
    this.cancelBubble = true;
  }
}

class FakeTextNode {
  readonly nodeType = 3;
  readonly nodeName = "#text";
  parentNode: FakeElement | null = null;
  nodeValue: string;

  constructor(text: string, readonly ownerDocument: FakeDocument) {
    this.nodeValue = text;
  }

  get textContent(): string {
    return this.nodeValue;
  }

  set textContent(value: string) {
    this.nodeValue = value;
  }
}

class FakeElement {
  readonly nodeType = 1;
  readonly style: Record<string, string> = {};
  readonly childNodes: FakeNode[] = [];
  readonly listeners = new Map<string, Set<EventListener>>();
  parentNode: FakeElement | null = null;
  namespaceURI = "http://www.w3.org/1999/xhtml";
  nodeValue: string | null = null;

  private readonly attributes = new Map<string, string>();

  constructor(readonly localName: string, readonly ownerDocument: FakeDocument) {}

  get tagName(): string {
    return this.localName.toUpperCase();
  }

  get nodeName(): string {
    return this.tagName;
  }

  get firstChild(): FakeNode | null {
    return this.childNodes[0] ?? null;
  }

  get multiple(): boolean {
    return this.attributes.has("multiple");
  }

  set multiple(value: boolean) {
    if (value) {
      this.attributes.set("multiple", "");
    } else {
      this.attributes.delete("multiple");
    }
  }

  get options(): FakeElement[] {
    return this.childNodes.filter(
      (child): child is FakeElement => child instanceof FakeElement && child.localName === "option"
    );
  }

  get selected(): boolean {
    return this.attributes.has("selected");
  }

  set selected(value: boolean) {
    if (value) {
      this.attributes.set("selected", "");
    } else {
      this.attributes.delete("selected");
    }
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

  get value(): string {
    return this.attributes.get("value") ?? this.textContent;
  }

  set value(value: string) {
    this.attributes.set("value", String(value));
  }

  addEventListener(type: string, listener: EventListener): void {
    const listeners = this.listeners.get(type) ?? new Set<EventListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event: FakeDomEvent): boolean {
    if (event.target === null) {
      event.target = this;
    }

    let current: FakeElement | null = this;
    while (current !== null) {
      event.currentTarget = current;
      current.listeners.get(event.type)?.forEach((listener) => {
        listener.call(current, event as unknown as Event);
      });
      if (!event.bubbles || event.cancelBubble) {
        break;
      }
      current = current.parentNode;
    }

    event.currentTarget = null;
    return !event.defaultPrevented;
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

function createCoherentWrapReadModel(): DeformerTreeWrapSelectionReadModel {
  return {
    status: "coherent",
    canCreate: true,
    targets: [
      {
        kind: "rigControl",
        source: "rigControl",
        id: RIG_FACE_WARP,
        displayName: "Face Warp",
        detail: "Root Deformer",
        status: "included"
      },
      {
        kind: "drawable",
        source: "poolDrawable",
        id: DRAW_HAIR,
        displayName: "Hair",
        detail: "Pool Drawable",
        status: "included"
      }
    ],
    warning: null,
    wrapChildren: [
      { kind: "rigControl", id: RIG_FACE_WARP },
      { kind: "drawable", id: DRAW_HAIR }
    ],
    bounds: { x: 10, y: 20, width: 70, height: 40 },
    warpDomainBounds: { x: 9, y: 19, width: 72, height: 42 }
  };
}

function createWarpReadModel(hasKeyforms: boolean): WarpDeformerReadModel {
  return {
    kind: "warpDeformer",
    storageKind: "warpLattice2d",
    rigControlId: RIG_FACE_WARP,
    displayName: "Face Warp",
    childDrawableIds: [DRAW_FACE],
    childRigControlIds: [],
    opacityMultiplier: 1,
    hasKeyforms,
    keyformSetCount: hasKeyforms ? 1 : 0,
    keyformKeyCount: hasKeyforms ? 3 : 0,
    domainBounds: { x: 10, y: 20, width: 30, height: 40 },
    transformGrid: {
      columns: 5,
      rows: 5,
      pointCountSemantics: "controlPointCount"
    },
    bezierEditSurface: {
      columns: 3,
      rows: 3,
      editType: "cubicBezierSurfaceV1"
    },
    evaluationBoundary: {
      transformEvaluation: "bilinearGridV1",
      bezierEvaluation: "storedNotEvaluatedV0"
    },
    bezierSurfaceStatus: "stored"
  };
}

function createRotationReadModel(hasKeyforms: boolean): RotationDeformerReadModel {
  return {
    kind: "rotationDeformer",
    storageKind: "rotation2d",
    rigControlId: RIG_FACE_ROTATION,
    displayName: "Face Rotation",
    childDrawableIds: [DRAW_FACE],
    childRigControlIds: [],
    opacityMultiplier: 1,
    hasKeyforms,
    keyformSetCount: hasKeyforms ? 1 : 0,
    keyformKeyCount: hasKeyforms ? 3 : 0,
    pivot: { x: 16, y: 24 },
    restTranslation: { x: 1, y: -2 },
    restAngleDegrees: 10
  };
}

function createFixtureSession(): AuthoringSession {
  return {
    packageIdentity: {
      packageId: PackageIdSchema.parse("pkg_rig_tool_inspector_fixture"),
      packageDisplayName: "Rig Tool Inspector Fixture",
      formatVersion: "open-model-package-v1"
    },
    packageRevision: 0,
    authoringRevision: createInitialAuthoringRevision(),
    dirty: false,
    graph: {
      coordinateSystem: "canvas-y-down-v1",
      canvasSize: { width: 128, height: 128 },
      parts: [
        {
          partId: PART_ROOT,
          displayName: "Root",
          childPartIds: [PART_FACE],
          drawableIds: []
        },
        {
          partId: PART_FACE,
          displayName: "Face Part",
          parentPartId: PART_ROOT,
          childPartIds: [],
          drawableIds: [DRAW_FACE]
        }
      ],
      drawables: [
        {
          drawableId: DRAW_FACE,
          displayName: "Face",
          partId: PART_FACE,
          sourceAssetId: SOURCE_ASSET,
          textureId: TEX_FACE,
          meshId: MESH_FACE,
          defaultOpacity: 1,
          runtimeVisibility: true,
          baseDrawOrder: 0,
          sourceProvenanceId: PROVENANCE
        }
      ],
      meshes: [
        {
          meshId: MESH_FACE,
          drawableId: DRAW_FACE,
          vertices: [
            { x: 10, y: 20 },
            { x: 40, y: 20 },
            { x: 40, y: 60 },
            { x: 10, y: 60 }
          ],
          uvs: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 1, y: 1 },
            { x: 0, y: 1 }
          ],
          triangles: [
            [0, 1, 2],
            [0, 2, 3]
          ] as [number, number, number][],
          vertexStableIds: ["vtx_0", "vtx_1", "vtx_2", "vtx_3"],
          bounds: { x: 10, y: 20, width: 30, height: 40 },
          generationProvenanceId: PROVENANCE
        }
      ],
      parameters: [],
      keyformSets: [],
      rigControls: [],
      dynamicsGroups: [],
      masks: [],
      drawOrder: [{ drawableId: DRAW_FACE, baseDrawOrder: 0, stableOrder: 0 }],
      rigControlRootIds: [],
      stableOrder: [PART_ROOT, PART_FACE, DRAW_FACE],
      sourceAssets: [],
      provenanceRecords: [],
      rightsRecords: []
    }
  };
}
