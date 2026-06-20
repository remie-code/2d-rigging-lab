import type {
  AuthoringSession,
  RuntimeExportPreflightResult,
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

import {
  assembleRuntimeExport,
  preflightRuntimeExport
} from "@private-2d-rigging-lab/authoring-core";
import { createEmptyAuthoringSession } from "../../features/editor-session/model/empty-authoring-session";
import { commitTextureAtlasPreview } from "../../features/editor-session/model/texture-atlas-session-command";
import {
  writeRuntimeExportDirectory,
  writeRuntimeExportToPickedDirectory
} from "../../features/runtime-export/model/runtime-export-directory";
import { createRuntimeExportTaskState } from "../../features/runtime-export/model/runtime-export-task-state";
import { createFakeWorkspaceDirectoryHandle } from "../../features/workspace-storage/model/fake-workspace-directory";
import { TooltipProvider } from "../../ui/tooltip";
import { createTextureAtlasTaskPreviewState } from "../atlas/atlas-task-projection";
import { AuthoringWorkspaceContent } from "../authoring-workspace";
import {
  RuntimeExportTaskScreen,
  RuntimeExportTaskView,
  type RuntimeExportWriteStatus
} from "./runtime-export-task-screen";

type BinaryAssetReference = RegisterAuthoringSessionBinaryBytesInput["binaryAssetRef"];

const runtimeExportScreenTestState = vi.hoisted(() => ({
  editorSession: undefined as unknown,
  iconButtons: [] as Array<{
    readonly disabled: boolean;
    readonly label: string;
    readonly onClick?: ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
    readonly pressed?: boolean;
  }>,
  uiStore: {
    activeEntry: "runtimeExport",
    activeTool: "select",
    setActiveEntry: vi.fn(),
    setActiveTool: vi.fn(),
    surfaceLabel: "Runtime Export test surface"
  }
}));

vi.mock("../../features/editor-session/editor-session-context", async () => {
  const actual = await vi.importActual<
    typeof import("../../features/editor-session/editor-session-context")
  >("../../features/editor-session/editor-session-context");

  return {
    ...actual,
    useEditorSession: () => runtimeExportScreenTestState.editorSession
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
    ) => selector(runtimeExportScreenTestState.uiStore)
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
    runtimeExportScreenTestState.iconButtons.push({
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

const PART_ROOT = PartIdSchema.parse("part_runtime_export_root");
const PART_POOL = PartIdSchema.parse("part_runtime_export_pool");
const DRAW_BODY = DrawableIdSchema.parse("draw_runtime_export_body");
const DRAW_POOL = DrawableIdSchema.parse("draw_runtime_export_pool");
const MESH_BODY = MeshIdSchema.parse("mesh_runtime_export_body");
const MESH_POOL = MeshIdSchema.parse("mesh_runtime_export_pool");
const TEX_BODY = TextureIdSchema.parse("tex_runtime_export_body");
const TEX_POOL = TextureIdSchema.parse("tex_runtime_export_pool");
const SRC_FIXTURE = SourceAssetIdSchema.parse("src_runtime_export_editor_fixture");
const PROV_FIXTURE = ProvenanceIdSchema.parse("prov_runtime_export_editor_fixture");
const RIG_ROOT = RigControlIdSchema.parse("rig_runtime_export_root");
const TEST_DIGEST_HEX = "0".repeat(64);
const IDLE_EXPORT_STATUS: RuntimeExportWriteStatus = { status: "idle" };
const SUPPORTED_DIRECTORY_ACCESS = { supported: true } as const;

describe("RuntimeExportTaskScreen", () => {
  beforeEach(() => {
    runtimeExportScreenTestState.editorSession = createEditorSessionMock(
      createRuntimeExportFixtureSession()
    );
    runtimeExportScreenTestState.iconButtons.length = 0;
    runtimeExportScreenTestState.uiStore.activeEntry = "runtimeExport";
    runtimeExportScreenTestState.uiStore.activeTool = "select";
    runtimeExportScreenTestState.uiStore.setActiveEntry.mockClear();
    runtimeExportScreenTestState.uiStore.setActiveTool.mockClear();
  });

  it("routes the Runtime Export active entry to the dedicated task screen without Parameter Bar", () => {
    const markup = renderToStaticMarkup(
      createElement(
        TooltipProvider,
        null,
        createElement(AuthoringWorkspaceContent, { activeEntry: "runtimeExport" })
      )
    );

    expect(markup).toContain('data-testid="runtime-export-task-screen"');
    expect(markup).toContain("Runtime Export");
    expect(markup).not.toContain('data-testid="canvas-preview-panel"');
    expect(markup).not.toContain('data-testid="texture-atlas-task-screen"');
    expect(markup).not.toContain("Parameter Bar");
  });

  it("returns to Authoring Workspace through Back without opening PSD import", () => {
    const editorSession = createEditorSessionMock(createRuntimeExportFixtureSession());
    runtimeExportScreenTestState.editorSession = editorSession;

    renderToStaticMarkup(createElement(RuntimeExportTaskScreen));
    findIconButton("Back to Authoring Workspace").onClick?.(
      {} as ReactMouseEvent<HTMLButtonElement>
    );

    expect(runtimeExportScreenTestState.uiStore.setActiveEntry).toHaveBeenCalledTimes(1);
    expect(runtimeExportScreenTestState.uiStore.setActiveEntry).toHaveBeenCalledWith("workspace");
    expect(editorSession.openPsdImport).not.toHaveBeenCalled();
  });

  it("shows missing atlas as blocked with an Open Texture Atlas action", async () => {
    const session = createRuntimeExportFixtureSession();
    const preflight = await preflightRuntimeExport(session);
    const state = createRuntimeExportTaskState({ session, preflight });
    const markup = renderRuntimeExportView(state);

    expect(markup).toContain("Texture Atlas required");
    expect(markup).toContain("Open Texture Atlas");
    expect(markup).toContain('data-runtime-export-blocker-code="runtimeExport.noCommittedAtlas"');
    expect(markup).toContain('data-testid="runtime-export-open-atlas"');
  });

  it("shows stale atlas as blocked", async () => {
    const session = await createAppliedRuntimeExportFixtureSession();
    session.graph.meshes.find((mesh) => mesh.meshId === MESH_BODY)!.uvs[1] = {
      x: 0.5,
      y: 0
    };

    const preflight = await preflightRuntimeExport(session);
    const state = createRuntimeExportTaskState({ session, preflight });
    const markup = renderRuntimeExportView(state);

    expect(markup).toContain("Texture Atlas is out of date");
    expect(markup).toContain('data-runtime-export-blocker-code="runtimeExport.staleAtlas"');
    expect(markup).toContain("Open Texture Atlas");
  });

  it("routes unavailable atlas binary blockers to Open Texture Atlas", () => {
    const session = createRuntimeExportFixtureSession();
    const preflight: Extract<RuntimeExportPreflightResult, { readonly status: "blocked" }> = {
      status: "blocked",
      blockers: [
        {
          code: "runtimeExport.requiredBinaryUnavailable",
          message: "Committed Texture Atlas required binary is unavailable for Runtime Export.",
          targetPath: "/binaryAssets/assets/textures/atlas_page_0.raw-rgba",
          details: ["binaryAssetId=bin_runtime_export_atlas_page_0"]
        }
      ],
      warnings: [],
      targetSummary: {
        includedDrawableIds: [DRAW_BODY],
        excludedUnboundDrawableIds: [DRAW_POOL],
        includedDrawableCount: 1,
        excludedUnboundDrawableCount: 1,
        atlasPageCount: 1,
        texturePageCount: 1,
        validateWarningCount: 0
      }
    };
    const state = createRuntimeExportTaskState({ session, preflight });
    const markup = renderRuntimeExportView(state);

    expect(markup).toContain(
      "Committed Texture Atlas required binary is unavailable for Runtime Export."
    );
    expect(markup).toContain(
      'data-runtime-export-blocker-code="runtimeExport.requiredBinaryUnavailable"'
    );
    expect(markup).toContain("Open Texture Atlas");
    expect(markup).toContain('data-testid="runtime-export-open-atlas"');
    expect(markup).not.toContain('data-testid="runtime-export-open-validate"');
  });

  it("shows Ready and enables Export Runtime for a valid current atlas", async () => {
    const session = await createAppliedRuntimeExportFixtureSession();
    const preflight = await preflightRuntimeExport(session);
    const state = createRuntimeExportTaskState({ session, preflight });
    const markup = renderRuntimeExportView(state);
    const actionMarkup = getButtonTagByTestId(markup, "runtime-export-action");

    expect(markup).toContain("Ready to export");
    expect(markup).toContain('data-runtime-export-state="ready"');
    expect(markup).toContain('data-testid="runtime-export-included-count">1');
    expect(markup).toContain('data-testid="runtime-export-excluded-count">1');
    expect(actionMarkup).not.toContain('disabled=""');
  });

  it("shows Validate warnings compactly without disabling Export Runtime", async () => {
    const session = await createAppliedRuntimeExportFixtureSession();
    const preflight = await preflightRuntimeExport(session, { validateWarningCount: 2 });
    const state = createRuntimeExportTaskState({ session, preflight });
    const markup = renderRuntimeExportView(state);
    const actionMarkup = getButtonTagByTestId(markup, "runtime-export-action");

    expect(markup).toContain(
      "Validate has warnings. Open Validate to inspect them before exporting."
    );
    expect(markup).toContain('data-testid="runtime-export-validate-warning-count">2');
    expect(markup).toContain('data-testid="runtime-export-warning-open-validate"');
    expect(actionMarkup).not.toContain('disabled=""');
  });

  it("shows Drawable Pool excluded count as non-warning export exclusion", async () => {
    const session = await createAppliedRuntimeExportFixtureSession();
    const preflight = await preflightRuntimeExport(session);
    const state = createRuntimeExportTaskState({ session, preflight });
    const markup = renderRuntimeExportView(state);

    expect(markup).toContain('data-testid="runtime-export-excluded-count">1');
    expect(markup).toContain("Drawable Pool entries are not exported");
    expect(markup).toContain("No Validate warnings");
    expect(markup).toContain('data-testid="runtime-export-validate-warning-count">0');
  });

  it("writes Runtime Export directory files and raw RGBA bytes", async () => {
    const session = await createAppliedRuntimeExportFixtureSession();
    const assembly = await assembleRuntimeExport(session, {
      createdAt: "2026-06-20T00:00:00.000Z"
    });
    if (assembly.status !== "ready") {
      throw new Error("Expected Runtime Export assembly to be ready.");
    }
    const directory = createFakeWorkspaceDirectoryHandle({ name: "runtime-export-test" });
    const textureEntry = assembly.fileSet.find((entry) => "bytes" in entry);
    if (textureEntry === undefined) {
      throw new Error("Expected Runtime Export file-set to include a texture page.");
    }

    const result = await writeRuntimeExportDirectory({
      directory,
      fileSet: assembly.fileSet
    });

    expect(result).toEqual({
      textFileCount: 3,
      texturePageCount: 1,
      totalFileCount: 4
    });
    expect(directory.listFilePaths()).toEqual([
      "assets/textures/atlas_page_0.raw-rgba",
      "runtime-export.json",
      "runtime/atlas.json",
      "runtime/model.json"
    ]);
    expect(directory.readTextFile("runtime-export.json")).toContain(
      "runtime-export-manifest-v0"
    );
    expect(directory.readTextFile("runtime/model.json")).toContain(
      "runtime-export-model-v0"
    );
    expect(directory.readTextFile("runtime/atlas.json")).toContain(
      "runtime-export-atlas-v0"
    );
    expect(directory.readBinaryFile(textureEntry.path)).toEqual(textureEntry.bytes);
  });

  it("disables directory export when unavailable without a Portable JSON fallback", async () => {
    const session = await createAppliedRuntimeExportFixtureSession();
    const preflight = await preflightRuntimeExport(session);
    const state = createRuntimeExportTaskState({ session, preflight });
    const markup = renderToStaticMarkup(
      createElement(RuntimeExportTaskView, {
        directoryAccess: {
          supported: false,
          reason: "show-directory-picker-unavailable"
        },
        exportStatus: IDLE_EXPORT_STATUS,
        onBack: () => undefined,
        onExport: () => undefined,
        onOpenTextureAtlas: () => undefined,
        onOpenValidate: () => undefined,
        state
      })
    );
    const actionMarkup = getButtonTagByTestId(markup, "runtime-export-action");

    expect(markup).toContain("Directory export is unavailable");
    expect(markup).not.toContain("Portable JSON");
    expect(actionMarkup).toContain('disabled=""');
  });

  it("writes picked Runtime Export directories without calling Workspace Save or Portable JSON export", async () => {
    const saveProject = vi.fn();
    const exportPortableProject = vi.fn();
    const session = await createAppliedRuntimeExportFixtureSession();
    const assembly = await assembleRuntimeExport(session);
    if (assembly.status !== "ready") {
      throw new Error("Expected Runtime Export assembly to be ready.");
    }
    const directory = createFakeWorkspaceDirectoryHandle();

    await writeRuntimeExportToPickedDirectory({
      fileSet: assembly.fileSet,
      picker: { pickDirectory: async () => directory }
    });

    expect(directory.readTextFile("runtime-export.json")).toContain(
      "runtime-export-manifest-v0"
    );
    expect(saveProject).not.toHaveBeenCalled();
    expect(exportPortableProject).not.toHaveBeenCalled();
  });
});

function renderRuntimeExportView(state: ReturnType<typeof createRuntimeExportTaskState>): string {
  return renderToStaticMarkup(
    createElement(RuntimeExportTaskView, {
      directoryAccess: SUPPORTED_DIRECTORY_ACCESS,
      exportStatus: IDLE_EXPORT_STATUS,
      onBack: () => undefined,
      onExport: () => undefined,
      onOpenTextureAtlas: () => undefined,
      onOpenValidate: () => undefined,
      state
    })
  );
}

function createEditorSessionMock(session: AuthoringSession) {
  return {
    applyTextureAtlasPreview: vi.fn(),
    canRedo: false,
    canUndo: false,
    closePsdImport: vi.fn(),
    commitPsdImport: vi.fn(),
    createWorkspace: vi.fn(),
    editorHiddenPartIds: new Set(),
    exportPortableProject: vi.fn(),
    hasOpenWorkspace: true,
    openProjectFile: vi.fn(),
    openPsdImport: vi.fn(),
    openWorkspace: vi.fn(),
    parameterValues: {},
    projectIdentityLabel: "Runtime Export Fixture",
    projectSaveStatusLabel: "Saved",
    projectStorage: {
      status: "idle"
    },
    psdImportOpen: false,
    redo: vi.fn(),
    resetActiveParameterValue: vi.fn(),
    resolvePsdImportDestination: vi.fn(() => ({
      label: "Runtime Export Root",
      parentPartId: PART_ROOT
    })),
    saveWorkspaceAs: vi.fn(),
    saveProject: vi.fn(),
    selectDeformerTreeTarget: vi.fn(),
    selectDrawable: vi.fn(),
    session,
    setActiveParameterId: vi.fn(),
    setActiveParameterValue: vi.fn(),
    setDynamicsToolPreviewGroupId: vi.fn(),
    undo: vi.fn(),
    workspaceIdentityLabel: "Runtime Export Fixture",
    workspaceSaveStatusLabel: "Saved",
    workspaceStorage: {
      status: "saved",
      message: "Workspace ready."
    }
  };
}

async function createAppliedRuntimeExportFixtureSession(): Promise<AuthoringSession> {
  const session = createRuntimeExportFixtureSession();
  const previewState = createTextureAtlasTaskPreviewState({
    session,
    settings: {
      pageSize: 8,
      paddingPixels: 1,
      edgeExtrusionEnabled: true
    }
  });
  const result = await commitTextureAtlasPreview(session, previewState.preview);

  if (!result.committed) {
    throw new Error(`Expected Texture Atlas Apply to commit: ${result.warnings.map((warning) => warning.message).join(",")}`);
  }

  return result.session;
}

function createRuntimeExportFixtureSession(): AuthoringSession {
  const session = createEmptyAuthoringSession();
  const bodyBytes = createSolidRgbaBytes(2, 2, [255, 0, 0, 255]);
  const poolBytes = createSolidRgbaBytes(2, 2, [0, 0, 255, 255]);
  const bodyRef = createTextureBinaryAssetReference("body", bodyBytes);
  const poolRef = createTextureBinaryAssetReference("pool", poolBytes);

  session.packageIdentity.packageDisplayName = "Runtime Export Editor Fixture";
  session.graph.parts = [
    {
      partId: PART_ROOT,
      displayName: "Runtime Export Root",
      childPartIds: [PART_POOL],
      drawableIds: [DRAW_BODY],
      children: [
        { kind: "drawable", drawableId: DRAW_BODY },
        { kind: "part", partId: PART_POOL }
      ]
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
    createDrawable(DRAW_BODY, "Runtime Body", PART_ROOT, TEX_BODY, MESH_BODY, true, 0),
    createDrawable(DRAW_POOL, "Unused Pool Layer", PART_POOL, TEX_POOL, MESH_POOL, true, 1)
  ];
  session.graph.meshes = [
    createQuadMesh(MESH_BODY, DRAW_BODY),
    createQuadMesh(MESH_POOL, DRAW_POOL)
  ];
  session.graph.rigControls = [
    {
      kind: "rotation2d",
      rigControlId: RIG_ROOT,
      displayName: "Runtime Root Rig",
      childDrawableIds: [DRAW_BODY],
      childRigControlIds: [],
      pivot: { x: 0, y: 0 },
      restAngleDegrees: 0,
      restTranslation: { x: 0, y: 0 },
      restScale: { x: 1, y: 1 },
      enabled: true
    }
  ];
  session.graph.rigControlRootIds = [RIG_ROOT];
  session.graph.drawOrder = [
    { drawableId: DRAW_BODY, baseDrawOrder: 0, stableOrder: 0 },
    { drawableId: DRAW_POOL, baseDrawOrder: 1, stableOrder: 1 }
  ];
  session.graph.stableOrder = [PART_ROOT, PART_POOL, DRAW_BODY, DRAW_POOL];
  session.graph.textureAtlas = {
    schemaVersion: "texture-atlas-v1",
    textures: [
      createTextureEntry(TEX_BODY, "body", bodyRef),
      createTextureEntry(TEX_POOL, "pool", poolRef)
    ]
  };
  session.graph.provenanceRecords = [
    {
      provenanceId: PROV_FIXTURE,
      assetId: SRC_FIXTURE,
      assetKind: "generatedFixture",
      filePath: "assets/sources/generated/runtime-export-editor-fixture.json",
      creator: "runtime-export-editor-test",
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
    binaryAssetId: `bin_runtime_export_${token}`,
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

function getButtonTagByTestId(markup: string, testId: string): string {
  const testIdIndex = markup.indexOf(`data-testid="${testId}"`);
  if (testIdIndex < 0) {
    throw new Error(`Expected button with test id "${testId}".`);
  }
  const tagStart = markup.lastIndexOf("<button", testIdIndex);
  const tagEnd = markup.indexOf(">", testIdIndex);
  if (tagStart < 0 || tagEnd < 0) {
    throw new Error(`Expected test id "${testId}" to be on a button.`);
  }

  return markup.slice(tagStart, tagEnd);
}

function findIconButton(label: string) {
  const button = runtimeExportScreenTestState.iconButtons.find(
    (candidate) => candidate.label === label
  );
  if (button === undefined) {
    throw new Error(`Expected IconButton ${label}.`);
  }

  return button;
}
