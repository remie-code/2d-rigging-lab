import type {
  AuthoringSession,
  RegisterAuthoringSessionBinaryBytesInput
} from "@private-2d-rigging-lab/authoring-core";
import { registerAuthoringSessionBinaryBytes } from "@private-2d-rigging-lab/authoring-core";
import {
  DrawableIdSchema,
  MeshIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  RigControlIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema,
  TriangleIdSchema,
  VertexIdSchema
} from "@private-2d-rigging-lab/contracts";
import type {
  ButtonHTMLAttributes,
  MouseEvent as ReactMouseEvent,
  ReactNode
} from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { commitTextureAtlasPreview } from "../../features/editor-session/model/texture-atlas-session-command";
import { createEmptyAuthoringSession } from "../../features/editor-session/model/empty-authoring-session";
import { TooltipProvider } from "../../ui/tooltip";
import { AuthoringWorkspaceContent } from "../authoring-workspace";
import { WorkspaceToolbox } from "../toolbox/workspace-toolbox";
import {
  DEFAULT_TEXTURE_ATLAS_TASK_SETTINGS,
  createTextureAtlasTaskPreviewState,
  createTextureAtlasTaskProjection
} from "./atlas-task-projection";
import { AtlasPreview, TextureAtlasTaskScreen } from "./texture-atlas-task-screen";

type BinaryAssetReference = RegisterAuthoringSessionBinaryBytesInput["binaryAssetRef"];

const atlasScreenTestState = vi.hoisted(() => ({
  editorSession: undefined as unknown,
  iconButtons: [] as Array<{
    readonly disabled: boolean;
    readonly label: string;
    readonly onClick?: ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
    readonly pressed?: boolean;
  }>,
  uiStore: {
    activeEntry: "atlas",
    activeTool: "select",
    setActiveEntry: vi.fn(),
    setActiveTool: vi.fn(),
    surfaceLabel: "Atlas test surface"
  }
}));

vi.mock("../../features/editor-session/editor-session-context", async () => {
  const actual = await vi.importActual<
    typeof import("../../features/editor-session/editor-session-context")
  >("../../features/editor-session/editor-session-context");

  return {
    ...actual,
    useEditorSession: () => atlasScreenTestState.editorSession
  };
});

vi.mock("../../state/editor-ui-store", async () => {
  const actual = await vi.importActual<typeof import("../../state/editor-ui-store")>(
    "../../state/editor-ui-store"
  );

  return {
    ...actual,
    useEditorUiStore: (
      selector: (state: {
        readonly activeEntry: string;
        readonly activeTool: string;
        readonly setActiveEntry: (entry: string) => void;
        readonly setActiveTool: (tool: string) => void;
        readonly surfaceLabel: string;
      }) => unknown
    ) => selector(atlasScreenTestState.uiStore)
  };
});

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
    readonly onClick?: ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
    readonly pressed?: boolean;
  }) => {
    atlasScreenTestState.iconButtons.push({
      disabled: disabled === true,
      label,
      ...(onClick === undefined ? {} : { onClick }),
      ...(pressed === undefined ? {} : { pressed })
    });

    return createElement(
      "button",
      {
        "aria-label": label,
        "aria-pressed": pressed,
        disabled,
        type: "button"
      },
      children
    );
  }
}));

vi.mock("../../features/psd-import/components/psd-import-modal", () => ({
  PsdImportModal: () => createElement("div", { "data-testid": "mock-psd-import-modal" })
}));

const PART_ROOT = PartIdSchema.parse("part_atlas_task_root");
const PART_HIDDEN = PartIdSchema.parse("part_atlas_task_hidden");
const PART_POOL = PartIdSchema.parse("part_atlas_task_pool");
const DRAW_BODY = DrawableIdSchema.parse("draw_atlas_task_body");
const DRAW_HIDDEN = DrawableIdSchema.parse("draw_atlas_task_hidden");
const DRAW_POOL = DrawableIdSchema.parse("draw_atlas_task_pool");
const MESH_BODY = MeshIdSchema.parse("mesh_atlas_task_body");
const MESH_HIDDEN = MeshIdSchema.parse("mesh_atlas_task_hidden");
const MESH_POOL = MeshIdSchema.parse("mesh_atlas_task_pool");
const TEX_BODY = TextureIdSchema.parse("tex_atlas_task_body");
const TEX_HIDDEN = TextureIdSchema.parse("tex_atlas_task_hidden");
const TEX_POOL = TextureIdSchema.parse("tex_atlas_task_pool");
const SRC_FIXTURE = SourceAssetIdSchema.parse("src_atlas_task_fixture");
const PROV_FIXTURE = ProvenanceIdSchema.parse("prov_atlas_task_fixture");
const RIG_ROOT = RigControlIdSchema.parse("rig_atlas_task_root");
const TEST_DIGEST_HEX = "0".repeat(64);

describe("TextureAtlasTaskScreen", () => {
  beforeEach(() => {
    atlasScreenTestState.editorSession = createEditorSessionMock(createAtlasFixtureSession());
    atlasScreenTestState.iconButtons.length = 0;
    atlasScreenTestState.uiStore.activeEntry = "atlas";
    atlasScreenTestState.uiStore.activeTool = "select";
    atlasScreenTestState.uiStore.setActiveEntry.mockClear();
    atlasScreenTestState.uiStore.setActiveTool.mockClear();
  });

  it("projects included, excluded, and hidden target rows from Domain A selection", () => {
    const session = createAtlasFixtureSession();
    const projection = createTextureAtlasTaskProjection({
      session,
      editorHiddenPartIds: new Set([PART_HIDDEN]),
      settings: DEFAULT_TEXTURE_ATLAS_TASK_SETTINGS
    });

    expect(projection.summary.includedCount).toBe(2);
    expect(projection.summary.excludedCount).toBe(1);
    expect(projection.summary.warningCount).toBe(0);
    expect(projection.includedRows.map((row) => row.drawableId)).toEqual([
      DRAW_BODY,
      DRAW_HIDDEN
    ]);
    expect(projection.includedRows.find((row) => row.drawableId === DRAW_HIDDEN))
      .toMatchObject({
        currentlyHidden: true,
        hiddenReasonLabel: "Currently hidden"
      });
    expect(projection.excludedRows).toEqual([
      expect.objectContaining({
        drawableId: DRAW_POOL,
        reason: "unboundDrawablePool",
        reasonLabel: "Unbound drawable in Drawable Pool"
      })
    ]);
  });

  it("generates preview state, enables Apply for a valid preview, and guards stale inputs", () => {
    const session = createAtlasFixtureSession();
    const previewState = createTextureAtlasTaskPreviewState({
      session,
      editorHiddenPartIds: new Set([PART_HIDDEN]),
      settings: {
        pageSize: 8,
        paddingPixels: 1,
        edgeExtrusionEnabled: true
      }
    });
    const readyProjection = createTextureAtlasTaskProjection({
      session,
      editorHiddenPartIds: new Set([PART_HIDDEN]),
      settings: {
        pageSize: 8,
        paddingPixels: 1,
        edgeExtrusionEnabled: true
      },
      previewState
    });

    expect(previewState.preview.status).toBe("ready");
    expect(readyProjection.previewStatus).toBe("ready");
    expect(readyProjection.canApply).toBe(true);
    expect(readyProjection.previewPage?.placements).toHaveLength(2);
    expect(readyProjection.previewPage?.image).toMatchObject({
      width: 8,
      height: 8,
      byteLength: 8 * 8 * 4
    });
    expect(readPixel(readyProjection.previewPage!.image.rgbaBytes, 8, 1, 1))
      .toEqual([255, 0, 0, 255]);
    expect(readPixel(readyProjection.previewPage!.image.rgbaBytes, 8, 5, 1))
      .toEqual([0, 255, 0, 255]);

    const staleSettingsProjection = createTextureAtlasTaskProjection({
      session,
      editorHiddenPartIds: new Set([PART_HIDDEN]),
      settings: {
        pageSize: 8,
        paddingPixels: 2,
        edgeExtrusionEnabled: true
      },
      previewState
    });

    expect(staleSettingsProjection.previewStatus).toBe("stale");
    expect(staleSettingsProjection.canApply).toBe(false);
    expect(staleSettingsProjection.warningRows.map((warning) => warning.code))
      .toContain("atlas.apply.stalePreview");

    const changedSession = structuredClone(session);
    changedSession.graph.drawables[0] = {
      ...changedSession.graph.drawables[0]!,
      textureId: TEX_POOL
    };

    const staleTargetProjection = createTextureAtlasTaskProjection({
      session: changedSession,
      editorHiddenPartIds: new Set([PART_HIDDEN]),
      settings: {
        pageSize: 8,
        paddingPixels: 1,
        edgeExtrusionEnabled: true
      },
      previewState
    });

    expect(staleTargetProjection.previewStatus).toBe("stale");
    expect(staleTargetProjection.canApply).toBe(false);
  });

  it("renders actual atlas image data behind placement overlays", () => {
    const session = createAtlasFixtureSession();
    const previewState = createTextureAtlasTaskPreviewState({
      session,
      editorHiddenPartIds: new Set([PART_HIDDEN]),
      settings: {
        pageSize: 8,
        paddingPixels: 1,
        edgeExtrusionEnabled: true
      }
    });
    const readyProjection = createTextureAtlasTaskProjection({
      session,
      editorHiddenPartIds: new Set([PART_HIDDEN]),
      settings: {
        pageSize: 8,
        paddingPixels: 1,
        edgeExtrusionEnabled: true
      },
      previewState
    });

    const markup = renderToStaticMarkup(createElement(AtlasPreview, { projection: readyProjection }));

    expect(markup).toContain('data-testid="atlas-preview-image"');
    expect(markup).toContain('data-atlas-image-bytes="256"');
    expect(markup).toContain('data-atlas-image-signature=');
    expect(markup).toContain('data-testid="atlas-preview-placement"');
    expect(markup).toContain("Body");
    expect(markup).toContain("Hidden Sleeve");
  });

  it("commits Atlas Apply through Operation Core from the editor-session command helper", async () => {
    const session = createAtlasFixtureSession();
    const previewState = createTextureAtlasTaskPreviewState({
      session,
      editorHiddenPartIds: new Set([PART_HIDDEN]),
      settings: {
        pageSize: 8,
        paddingPixels: 1,
        edgeExtrusionEnabled: true
      }
    });

    const result = await commitTextureAtlasPreview(session, previewState.preview, {
      editorHiddenPartIds: new Set([PART_HIDDEN])
    });

    expect(result.committed).toBe(true);
    if (!result.committed) {
      throw new Error("Expected texture atlas apply to commit.");
    }
    expect(result.operationOutcome.result.status).toBe("committed");
    expect(result.operationOutcome.logEntry?.operationType).toBe("applyTextureAtlasPreview");
    expect(JSON.stringify(result.operationOutcome.logEntry?.payload)).not.toContain("textureBytes");
    expect(JSON.stringify(result.operationOutcome.logEntry?.payload)).not.toContain("atlasBytes");
    expect(result.session.packageRevision).toBe(1);
    expect(result.session).not.toBe(session);
    expect(result.session.graph.textureAtlas?.layoutSummary?.atlasTextureId)
      .toBe("tex_generated_atlas_page_0");
    expect(result.session.graph.textureAtlas?.layoutSummary?.generatedByOperationId)
      .toBe(result.operationOutcome.result.operationId);
    expect(findDrawableTextureId(result.session, DRAW_BODY)).toBe("tex_generated_atlas_page_0");
    expect(findDrawableTextureId(result.session, DRAW_HIDDEN)).toBe("tex_generated_atlas_page_0");
    expect(findDrawableTextureId(result.session, DRAW_POOL)).toBe(TEX_POOL);
    expect(result.session.dirty).toBe(true);
    expect(session.graph.textureAtlas?.layoutSummary).toBeUndefined();
  });

  it("renders the dedicated Atlas route with summary, settings, and task lists", () => {
    const markup = renderToStaticMarkup(createElement(TextureAtlasTaskScreen));

    expect(markup).toContain('data-testid="texture-atlas-task-screen"');
    expect(markup).toContain("Texture Atlas");
    expect(markup).toContain("Atlas Preview");
    expect(markup).toContain('data-testid="atlas-included-count">2');
    expect(markup).toContain('data-testid="atlas-excluded-count">1');
    expect(markup).toContain('data-testid="atlas-warning-count">0');
    expect(markup).toContain('data-testid="atlas-page-size"');
    expect(markup).toContain('data-testid="atlas-padding"');
    expect(markup).toContain('data-testid="atlas-edge-extrusion"');
    expect(markup).toContain("Currently hidden");
    expect(markup).toContain("Unbound drawable in Drawable Pool");
    expect(markup).toContain("No atlas warnings");
    expect(markup).toContain('data-testid="atlas-apply"');
    expect(markup).toContain("disabled");
  });

  it("routes the atlas active entry to the dedicated task screen without Parameter Bar", () => {
    const markup = renderToStaticMarkup(
      createElement(
        TooltipProvider,
        null,
        createElement(AuthoringWorkspaceContent, { activeEntry: "atlas" })
      )
    );

    expect(markup).toContain('data-testid="texture-atlas-task-screen"');
    expect(markup).not.toContain('data-testid="canvas-preview-panel"');
    expect(markup).not.toContain('data-testid="viewer-runtime-screen"');
    expect(markup).not.toContain("Parameter Bar");
  });

  it("returns to Authoring Workspace through Back without opening PSD import", () => {
    const editorSession = createEditorSessionMock(createAtlasFixtureSession());
    atlasScreenTestState.editorSession = editorSession;

    renderToStaticMarkup(createElement(TextureAtlasTaskScreen));
    findIconButton("Back to Authoring Workspace").onClick?.(
      {} as ReactMouseEvent<HTMLButtonElement>
    );

    expect(atlasScreenTestState.uiStore.setActiveEntry).toHaveBeenCalledTimes(1);
    expect(atlasScreenTestState.uiStore.setActiveEntry).toHaveBeenCalledWith("import");
    expect(editorSession.openPsdImport).not.toHaveBeenCalled();
  });

  it("opens the dedicated Atlas task from the Toolbox Texture Atlas entry", () => {
    renderToStaticMarkup(createElement(WorkspaceToolbox));

    findIconButton("Texture Atlas").onClick?.({} as ReactMouseEvent<HTMLButtonElement>);

    expect(atlasScreenTestState.uiStore.setActiveEntry).toHaveBeenCalledTimes(1);
    expect(atlasScreenTestState.uiStore.setActiveEntry).toHaveBeenCalledWith("atlas");
    expect((atlasScreenTestState.editorSession as ReturnType<typeof createEditorSessionMock>)
      .openPsdImport).not.toHaveBeenCalled();
  });
});

function createEditorSessionMock(
  session: AuthoringSession,
  editorHiddenPartIds: ReadonlySet<ReturnType<typeof PartIdSchema.parse>> = new Set([PART_HIDDEN])
) {
  return {
    applyTextureAtlasPreview: vi.fn(),
    canRedo: false,
    canUndo: false,
    editorHiddenPartIds,
    openProjectFile: vi.fn(),
    openPsdImport: vi.fn(),
    parameterValues: {},
    projectIdentityLabel: "Atlas Fixture",
    projectSaveStatusLabel: "Saved",
    projectStorage: {
      status: "idle"
    },
    redo: vi.fn(),
    resetActiveParameterValue: vi.fn(),
    saveProject: vi.fn(),
    selectDrawable: vi.fn(),
    session,
    setActiveParameterValue: vi.fn(),
    undo: vi.fn()
  };
}

function createAtlasFixtureSession(): AuthoringSession {
  const session = createEmptyAuthoringSession();
  const bodyBytes = createSolidRgbaBytes(2, 2, [255, 0, 0, 255]);
  const hiddenBytes = createSolidRgbaBytes(2, 2, [0, 255, 0, 255]);
  const poolBytes = createSolidRgbaBytes(2, 2, [0, 0, 255, 255]);
  const bodyRef = createTextureBinaryAssetReference("body", bodyBytes);
  const hiddenRef = createTextureBinaryAssetReference("hidden", hiddenBytes);
  const poolRef = createTextureBinaryAssetReference("pool", poolBytes);

  session.graph.parts = [
    {
      partId: PART_ROOT,
      displayName: "Atlas Root",
      childPartIds: [PART_HIDDEN, PART_POOL],
      drawableIds: [DRAW_BODY],
      children: [
        { kind: "drawable", drawableId: DRAW_BODY },
        { kind: "part", partId: PART_HIDDEN },
        { kind: "part", partId: PART_POOL }
      ]
    },
    {
      partId: PART_HIDDEN,
      displayName: "Hidden Part",
      parentPartId: PART_ROOT,
      childPartIds: [],
      drawableIds: [DRAW_HIDDEN],
      children: [{ kind: "drawable", drawableId: DRAW_HIDDEN }]
    },
    {
      partId: PART_POOL,
      displayName: "Drawable Pool",
      parentPartId: PART_ROOT,
      childPartIds: [],
      drawableIds: [DRAW_POOL],
      children: [{ kind: "drawable", drawableId: DRAW_POOL }]
    }
  ];
  session.graph.drawables = [
    createDrawable(DRAW_BODY, "Body", PART_ROOT, TEX_BODY, MESH_BODY, true, 0),
    createDrawable(DRAW_HIDDEN, "Hidden Sleeve", PART_HIDDEN, TEX_HIDDEN, MESH_HIDDEN, false, 1),
    createDrawable(DRAW_POOL, "Unused Pool Layer", PART_POOL, TEX_POOL, MESH_POOL, true, 2)
  ];
  session.graph.meshes = [
    createQuadMesh(MESH_BODY, DRAW_BODY),
    createQuadMesh(MESH_HIDDEN, DRAW_HIDDEN),
    createQuadMesh(MESH_POOL, DRAW_POOL)
  ];
  session.graph.rigControls = [
    {
      kind: "rotation2d",
      rigControlId: RIG_ROOT,
      displayName: "Atlas Root Rig",
      childDrawableIds: [DRAW_BODY, DRAW_HIDDEN],
      childRigControlIds: [],
      pivot: { x: 0, y: 0 },
      restAngleDegrees: 0,
      restTranslation: { x: 0, y: 0 },
      restScale: { x: 1, y: 1 },
      enabled: true
    }
  ];
  session.graph.drawOrder = [
    { drawableId: DRAW_BODY, baseDrawOrder: 0, stableOrder: 0 },
    { drawableId: DRAW_HIDDEN, baseDrawOrder: 1, stableOrder: 1 },
    { drawableId: DRAW_POOL, baseDrawOrder: 2, stableOrder: 2 }
  ];
  session.graph.rigControlRootIds = [RIG_ROOT];
  session.graph.stableOrder = [PART_ROOT, PART_HIDDEN, PART_POOL, DRAW_BODY, DRAW_HIDDEN, DRAW_POOL];
  session.graph.textureAtlas = {
    schemaVersion: "texture-atlas-v1",
    textures: [
      createTextureEntry(TEX_BODY, "body", bodyRef),
      createTextureEntry(TEX_HIDDEN, "hidden", hiddenRef),
      createTextureEntry(TEX_POOL, "pool", poolRef)
    ]
  };
  session.graph.provenanceRecords = [
    {
      provenanceId: PROV_FIXTURE,
      assetId: SRC_FIXTURE,
      assetKind: "generatedFixture",
      filePath: "assets/sources/generated/atlas-task-fixture.json",
      creator: "texture-atlas-task-test",
      license: "internal-authoring-generated",
      redistributionAllowed: false,
      aiUsed: false,
      transformHistory: [],
      relatedOperationIds: []
    }
  ];
  session.graph.rightsRecords = [
    {
      assetId: SRC_FIXTURE,
      rightsStatus: "cleared",
      license: "internal-authoring-generated",
      redistributionAllowed: false
    }
  ];

  registerTextureBytes(session, bodyRef, bodyBytes, TEX_BODY);
  registerTextureBytes(session, hiddenRef, hiddenBytes, TEX_HIDDEN);
  registerTextureBytes(session, poolRef, poolBytes, TEX_POOL);

  return session;
}

function createDrawable(
  drawableId: ReturnType<typeof DrawableIdSchema.parse>,
  displayName: string,
  partId: ReturnType<typeof PartIdSchema.parse>,
  textureId: ReturnType<typeof TextureIdSchema.parse>,
  meshId: ReturnType<typeof MeshIdSchema.parse>,
  runtimeVisibility: boolean,
  baseDrawOrder: number
) {
  return {
    drawableId,
    displayName,
    partId,
    sourceAssetId: SRC_FIXTURE,
    textureId,
    meshId,
    defaultOpacity: 1,
    runtimeVisibility,
    baseDrawOrder,
    sourceProvenanceId: PROV_FIXTURE
  };
}

function createQuadMesh(
  meshId: ReturnType<typeof MeshIdSchema.parse>,
  drawableId: ReturnType<typeof DrawableIdSchema.parse>
) {
  return {
    meshId,
    drawableId,
    vertices: [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 }
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
    ] as [[number, number, number], [number, number, number]],
    vertexStableIds: [
      VertexIdSchema.parse(`${meshId}_v0`.replace("mesh_", "vtx_")),
      VertexIdSchema.parse(`${meshId}_v1`.replace("mesh_", "vtx_")),
      VertexIdSchema.parse(`${meshId}_v2`.replace("mesh_", "vtx_")),
      VertexIdSchema.parse(`${meshId}_v3`.replace("mesh_", "vtx_"))
    ],
    triangleStableIds: [
      TriangleIdSchema.parse(`${meshId}_t0`.replace("mesh_", "tri_")),
      TriangleIdSchema.parse(`${meshId}_t1`.replace("mesh_", "tri_"))
    ],
    topologyRevision: 0,
    bounds: { x: 0, y: 0, width: 2, height: 2 },
    generationProvenanceId: PROV_FIXTURE
  };
}

function createTextureEntry(
  textureId: ReturnType<typeof TextureIdSchema.parse>,
  token: string,
  binaryAssetRef: BinaryAssetReference
) {
  return {
    textureId,
    filePath: `assets/textures/${token}.raw-rgba`,
    dimensions: {
      width: 2,
      height: 2,
      pixelFormat: "rgba8" as const
    },
    provenanceId: PROV_FIXTURE,
    binaryAssetRef
  };
}

function createTextureBinaryAssetReference(
  token: string,
  bytes: Uint8Array
): BinaryAssetReference {
  return {
    referenceKind: "package-binary-asset-ref-v1",
    binaryAssetId: `bin_atlas_task_${token}`,
    packageRelativePath: `assets/textures/${token}.raw-rgba`,
    digest: {
      algorithm: "sha256",
      hex: TEST_DIGEST_HEX
    },
    byteLength: bytes.byteLength,
    mediaType: "application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8",
    storageStatus: "stored-package-local-v1",
    provenanceId: PROV_FIXTURE,
    rightsAssetId: SRC_FIXTURE
  };
}

function registerTextureBytes(
  session: AuthoringSession,
  binaryAssetRef: BinaryAssetReference,
  bytes: Uint8Array,
  textureId: ReturnType<typeof TextureIdSchema.parse>
): void {
  registerAuthoringSessionBinaryBytes(session, {
    binaryAssetRef,
    bytes,
    role: "texture-raster-v1",
    sourceAssetId: SRC_FIXTURE,
    textureId
  });
}

function createSolidRgbaBytes(
  width: number,
  height: number,
  color: readonly [number, number, number, number]
): Uint8Array {
  const bytes = new Uint8Array(width * height * 4);

  for (let index = 0; index < width * height; index += 1) {
    bytes[index * 4] = color[0];
    bytes[index * 4 + 1] = color[1];
    bytes[index * 4 + 2] = color[2];
    bytes[index * 4 + 3] = color[3];
  }

  return bytes;
}

function readPixel(
  bytes: Uint8Array,
  width: number,
  x: number,
  y: number
): readonly [number, number, number, number] {
  const index = (y * width + x) * 4;

  return [
    bytes[index] ?? 0,
    bytes[index + 1] ?? 0,
    bytes[index + 2] ?? 0,
    bytes[index + 3] ?? 0
  ];
}

function findDrawableTextureId(
  session: AuthoringSession,
  drawableId: ReturnType<typeof DrawableIdSchema.parse>
) {
  return session.graph.drawables.find((drawable) => drawable.drawableId === drawableId)?.textureId;
}

function findIconButton(label: string) {
  const button = atlasScreenTestState.iconButtons.find((candidate) => candidate.label === label);
  if (button === undefined) {
    throw new Error(`Expected icon button: ${label}`);
  }

  return button;
}
