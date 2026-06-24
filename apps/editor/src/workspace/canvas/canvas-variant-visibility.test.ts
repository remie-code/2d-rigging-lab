import {
  createInitialAuthoringRevision,
  createVariantVisibilityPredicate,
  type AuthoringSession
} from "@private-2d-rigging-lab/authoring-core";
import {
  DrawableIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema,
  type DrawableId
} from "@private-2d-rigging-lab/contracts";
import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import {
  EditorSessionProvider,
  useEditorSession
} from "../../features/editor-session/editor-session-context";
import { createCanvasRenderProjection } from "./canvas-projection";

const canvasRendererTestState = vi.hoisted(() => ({
  disposeCanvasBitmapCache: vi.fn(),
  renderCanvasProjection: vi.fn()
}));

vi.mock("./canvas-renderer", () => ({
  createCanvasBitmapCache: () => ({
    layerCanvases: new Map(),
    webglDrawableStack: { disabled: true }
  }),
  disposeCanvasBitmapCache: canvasRendererTestState.disposeCanvasBitmapCache,
  renderCanvasProjection: canvasRendererTestState.renderCanvasProjection
}));

vi.mock("../../ui/icon-button", () => ({
  IconButton: ({
    children,
    disabled,
    label,
    onClick,
    pressed
  }: {
    readonly children: ReactNode;
    readonly disabled?: boolean;
    readonly label: string;
    readonly onClick?: () => void;
    readonly pressed?: boolean;
  }) =>
    createElement(
      "button",
      {
        "aria-label": label,
        "aria-pressed": pressed,
        disabled,
        onClick,
        type: "button"
      },
      children
    )
}));

import { CanvasPreviewPanel } from "../panels/canvas-preview-panel";

const PART_ROOT = PartIdSchema.parse("part_variant_canvas_root");
const DRAW_NEUTRAL = DrawableIdSchema.parse("draw_variant_canvas_neutral");
const DRAW_ASSIGNED = DrawableIdSchema.parse("draw_variant_canvas_assigned");
const DRAW_RUNTIME_HIDDEN = DrawableIdSchema.parse("draw_variant_canvas_runtime_hidden");
const GROUP_OUTFIT = "vgrp_canvas_outfit";
const VAR_DEFAULT = "var_canvas_default";
const VAR_ALT = "var_canvas_alt";
const SOURCE_ASSET = SourceAssetIdSchema.parse("src_variant_canvas");
const PROVENANCE = ProvenanceIdSchema.parse("prov_variant_canvas");
type EditorSessionContextSnapshot = ReturnType<typeof useEditorSession>;

describe("canvas variant visibility", () => {
  it("applies preview active selection through the variant visibility predicate without dirtying session", () => {
    const session = createVariantCanvasSession();
    const before = JSON.stringify(session);
    const predicate = createVariantVisibilityPredicate({
      variantGroups: session.graph.variantGroups ?? [],
      activeSelections: [
        {
          variantGroupId: GROUP_OUTFIT as never,
          activeSelection: {
            kind: "singleSelect",
            variantId: VAR_ALT as never
          }
        }
      ]
    });

    const projection = createCanvasRenderProjection(session, null, {
      variantVisibilityPredicate: predicate
    });

    expect(findDrawable(projection, DRAW_ASSIGNED)?.visible).toBe(false);
    expect(findDrawable(projection, DRAW_NEUTRAL)?.visible).toBe(true);
    expect(findDrawable(projection, DRAW_RUNTIME_HIDDEN)?.visible).toBe(false);
    expect(session.dirty).toBe(false);
    expect(JSON.stringify(session)).toBe(before);
  });

  it("uses default active selection when no preview active selection is supplied", () => {
    const session = createVariantCanvasSession();
    const predicate = createVariantVisibilityPredicate({
      variantGroups: session.graph.variantGroups ?? []
    });

    const projection = createCanvasRenderProjection(session, null, {
      variantVisibilityPredicate: predicate
    });

    expect(findDrawable(projection, DRAW_ASSIGNED)?.visible).toBe(true);
    expect(findDrawable(projection, DRAW_NEUTRAL)?.visible).toBe(true);
  });

  it("flows Provider preview active state through CanvasPreviewPanel without dirtying project state", async () => {
    const harness = await renderCanvasPreviewHarness(createVariantCanvasSession());

    try {
      const beforeSession = JSON.stringify(harness.context().session);

      expect(harness.context().variantPreviewActiveSelections).toEqual([
        {
          variantGroupId: GROUP_OUTFIT,
          activeSelection: {
            kind: "singleSelect",
            variantId: VAR_DEFAULT
          }
        }
      ]);
      expect(harness.canvas().getAttribute("data-renderable-drawable-count")).toBe("2");

      await act(async () => {
        harness.context().setVariantPreviewActiveSelection({
          variantGroupId: GROUP_OUTFIT as never,
          activeSelection: {
            kind: "singleSelect",
            variantId: VAR_ALT as never
          }
        });
      });

      expect(harness.context().variantPreviewActiveSelections).toEqual([
        {
          variantGroupId: GROUP_OUTFIT,
          activeSelection: {
            kind: "singleSelect",
            variantId: VAR_ALT
          }
        }
      ]);
      expect(harness.canvas().getAttribute("data-renderable-drawable-count")).toBe("1");
      expect(harness.context().session.dirty).toBe(false);
      expect(harness.context().canUndo).toBe(false);
      expect(harness.context().session.graph.variantGroups?.[0]?.defaultActive).toEqual({
        kind: "singleSelect",
        variantId: VAR_DEFAULT
      });
      expect(JSON.stringify(harness.context().session)).toBe(beforeSession);
    } finally {
      await harness.cleanup();
    }
  });
});

function findDrawable(
  projection: ReturnType<typeof createCanvasRenderProjection>,
  drawableId: DrawableId
) {
  return projection.drawables.find((drawable) => drawable.drawableId === drawableId);
}

function createVariantCanvasSession(): AuthoringSession {
  const textures = [
    createTexture(DRAW_NEUTRAL),
    createTexture(DRAW_ASSIGNED),
    createTexture(DRAW_RUNTIME_HIDDEN)
  ];

  return {
    packageIdentity: {
      packageId: PackageIdSchema.parse("pkg_variant_canvas"),
      packageDisplayName: "Variant canvas fixture",
      formatVersion: "open-model-package-v1"
    },
    packageRevision: 1,
    authoringRevision: createInitialAuthoringRevision(),
    dirty: false,
    binaryAssets: {
      fileEntries: textures.map((texture) => ({
        path: texture.binaryAssetRef.packageRelativePath,
        bytes: createRgbaBytes(8, 8, texture.seed),
        mediaType: texture.binaryAssetRef.mediaType,
        binaryAssetId: texture.binaryAssetRef.binaryAssetId
      })),
      binaryAssetIndex: {
        schemaVersion: "binary-asset-index-v1",
        assets: textures.map((texture) => ({
          binaryAssetId: texture.binaryAssetRef.binaryAssetId,
          role: "texture-raster-v1",
          packageRelativePath: texture.binaryAssetRef.packageRelativePath,
          digest: texture.binaryAssetRef.digest,
          byteLength: texture.binaryAssetRef.byteLength,
          mediaType: texture.binaryAssetRef.mediaType,
          storageStatus: texture.binaryAssetRef.storageStatus,
          provenanceId: texture.binaryAssetRef.provenanceId,
          rightsAssetId: texture.binaryAssetRef.rightsAssetId,
          sourceAssetId: SOURCE_ASSET,
          textureId: texture.textureId
        }))
      },
      byteIntakeSummaries: []
    },
    graph: {
      coordinateSystem: "canvas-y-down-v1",
      canvasSize: { width: 64, height: 64 },
      parts: [
        {
          partId: PART_ROOT,
          displayName: "Root",
          childPartIds: [],
          drawableIds: [DRAW_NEUTRAL, DRAW_ASSIGNED, DRAW_RUNTIME_HIDDEN]
        }
      ],
      drawables: [
        createDrawable(DRAW_NEUTRAL, "Neutral", true, 0),
        createDrawable(DRAW_ASSIGNED, "Assigned", true, 1),
        createDrawable(DRAW_RUNTIME_HIDDEN, "Runtime Hidden", false, 2)
      ],
      meshes: [
        createMesh(DRAW_NEUTRAL, 0),
        createMesh(DRAW_ASSIGNED, 8),
        createMesh(DRAW_RUNTIME_HIDDEN, 16)
      ],
      parameters: [],
      keyformSets: [],
      rigControls: [],
      dynamicsGroups: [],
      masks: [],
      drawOrder: [
        { drawableId: DRAW_NEUTRAL, baseDrawOrder: 0, stableOrder: 0 },
        { drawableId: DRAW_ASSIGNED, baseDrawOrder: 1, stableOrder: 1 },
        { drawableId: DRAW_RUNTIME_HIDDEN, baseDrawOrder: 2, stableOrder: 2 }
      ],
      rigControlRootIds: [],
      stableOrder: [PART_ROOT, DRAW_NEUTRAL, DRAW_ASSIGNED, DRAW_RUNTIME_HIDDEN],
      sourceAssets: [],
      textureAtlas: {
        schemaVersion: "texture-atlas-v1",
        textures
      },
      provenanceRecords: [],
      rightsRecords: [],
      variantGroups: [
        {
          variantGroupId: GROUP_OUTFIT as never,
          displayName: "Outfit",
          mode: "singleSelect",
          variants: [
            { variantId: VAR_DEFAULT as never, displayName: "Default" },
            { variantId: VAR_ALT as never, displayName: "Alt" }
          ],
          targetDrawableIds: [DRAW_ASSIGNED],
          memberships: [
            {
              drawableId: DRAW_ASSIGNED,
              variantIds: [VAR_DEFAULT as never]
            }
          ],
          defaultActive: {
            kind: "singleSelect",
            variantId: VAR_DEFAULT as never
          }
        }
      ]
    }
  };
}

function createDrawable(
  drawableId: DrawableId,
  displayName: string,
  runtimeVisibility: boolean,
  baseDrawOrder: number
) {
  return {
    drawableId,
    displayName,
    partId: PART_ROOT,
    sourceAssetId: SOURCE_ASSET,
    textureId: createTextureId(drawableId),
    meshId: createMeshId(drawableId),
    defaultOpacity: 1,
    runtimeVisibility,
    baseDrawOrder,
    sourceProvenanceId: PROVENANCE
  };
}

function createMesh(drawableId: DrawableId, offset: number) {
  return {
    meshId: createMeshId(drawableId),
    drawableId,
    vertices: [
      { x: offset, y: offset },
      { x: offset + 8, y: offset },
      { x: offset + 8, y: offset + 8 },
      { x: offset, y: offset + 8 }
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
    bounds: { x: offset, y: offset, width: 8, height: 8 },
    generationProvenanceId: PROVENANCE
  };
}

function createTexture(drawableId: DrawableId) {
  const textureId = createTextureId(drawableId);
  const token = drawableId.replace(/^draw_variant_canvas_/, "");
  const byteLength = 8 * 8 * 4;

  return {
    textureId,
    seed: token.charCodeAt(0),
    filePath: `assets/textures/${drawableId}.rgba`,
    sourceAssetId: SOURCE_ASSET,
    sourceLayerId: `layer_${drawableId}`,
    provenanceId: PROVENANCE,
    binaryAssetRef: {
      referenceKind: "package-binary-asset-ref-v1" as const,
      binaryAssetId: `bin_${token}`,
      packageRelativePath: `assets/textures/${token}.rgba`,
      digest: {
        algorithm: "sha256" as const,
        hex: createDigestHex(token)
      },
      byteLength,
      mediaType: "application/octet-stream; pixelFormat=rgba8",
      storageStatus: "stored-package-local-v1" as const,
      provenanceId: PROVENANCE,
      rightsAssetId: SOURCE_ASSET
    }
  };
}

function createTextureId(drawableId: DrawableId) {
  return TextureIdSchema.parse(`tex_${drawableId}`);
}

function createMeshId(drawableId: DrawableId) {
  return MeshIdSchema.parse(`mesh_${drawableId}`);
}

function createRgbaBytes(width: number, height: number, seed: number): Uint8Array {
  const bytes = new Uint8Array(width * height * 4);
  for (let offset = 0; offset < bytes.length; offset += 4) {
    bytes[offset] = seed;
    bytes[offset + 1] = 64;
    bytes[offset + 2] = 192;
    bytes[offset + 3] = 255;
  }

  return bytes;
}

function createDigestHex(seed: string): string {
  return seed.padEnd(64, seed).slice(0, 64).replaceAll(/[^a-f0-9]/g, "a");
}

function CanvasPreviewProbe({
  onRender
}: {
  readonly onRender: (context: EditorSessionContextSnapshot) => void;
}) {
  onRender(useEditorSession());
  return null;
}

async function renderCanvasPreviewHarness(
  initialSession: AuthoringSession
): Promise<{
  readonly canvas: () => FakeElement;
  readonly cleanup: () => Promise<void>;
  readonly context: () => EditorSessionContextSnapshot;
}> {
  const fakeRoot = createFakeDomRoot();
  let context: EditorSessionContextSnapshot | null = null;
  let reactRoot: Root | null = createRoot(fakeRoot.container as unknown as Element);

  await act(async () => {
    reactRoot?.render(
      createElement(
        EditorSessionProvider,
        {
          initialSession,
          initialWorkspaceOpen: true
        },
        createElement(CanvasPreviewProbe, {
          onRender: (nextContext) => {
            context = nextContext;
          }
        }),
        createElement(CanvasPreviewPanel)
      )
    );
  });

  return {
    canvas: () => getFakeElementByTestId(fakeRoot.container, "canvas-renderer-surface"),
    cleanup: async () => {
      await act(async () => {
        reactRoot?.unmount();
      });
      reactRoot = null;
      fakeRoot.restore();
    },
    context: () => {
      if (context === null) {
        throw new Error("Editor session context was not rendered.");
      }

      return context;
    }
  };
}

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
  clientHeight = 128;
  clientWidth = 128;
  disabled = false;
  height = 0;
  namespaceURI = "http://www.w3.org/1999/xhtml";
  nodeValue: string | null = null;
  parentNode: FakeElement | null = null;
  selected = false;
  tabIndex = 0;
  type = "";
  value = "";
  width = 0;

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
    const normalized = String(value);
    this.attributes.set(name, normalized);
    if (name === "checked") {
      this.checked = true;
    } else if (name === "disabled") {
      this.disabled = true;
    } else if (name === "height") {
      this.height = Number(normalized);
    } else if (name === "selected") {
      this.selected = true;
    } else if (name === "tabindex") {
      this.tabIndex = Number(normalized);
    } else if (name === "type") {
      this.type = normalized;
    } else if (name === "value") {
      this.value = normalized;
    } else if (name === "width") {
      this.width = Number(normalized);
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

  focus(): void {
    this.ownerDocument.activeElement = this;
  }

  getBoundingClientRect(): Pick<DOMRect, "left" | "top" | "width" | "height"> {
    return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight };
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
    readonly addEventListener: () => void;
    readonly removeEventListener: () => void;
    readonly devicePixelRatio: number;
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
      HTMLIFrameElement: class HTMLIFrameElement {},
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      devicePixelRatio: 1
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
  const element = findFakeElements(root, (candidate) =>
    candidate.getAttribute("data-testid") === testId
  )[0];
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
