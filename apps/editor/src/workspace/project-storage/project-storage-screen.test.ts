import type { AuthoringSession } from "@private-2d-rigging-lab/authoring-core";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProjectStorageState } from "../../features/project-storage/model/project-storage-state";
import { ProjectStorageScreen } from "./project-storage-screen";

const projectStorageTestState = vi.hoisted(() => ({
  editorSession: {
    canRedo: false,
    canUndo: false,
    openProjectFile: vi.fn(),
    openPsdImport: vi.fn(),
    projectIdentityLabel: "Untitled model · rev 0",
    projectSaveStatusLabel: "Saved",
    projectStorage: {
      status: "idle",
      message: "No portable project operation has run in this session.",
      lastAction: null,
      fileName: null,
      errorCode: null,
      issues: [],
      binaryPayloadCount: null,
      binaryFileCount: null,
      completedAt: null
    },
    redo: vi.fn(),
    saveProject: vi.fn(),
    session: {
      packageIdentity: {
        packageId: "pkg_storage_screen",
        packageDisplayName: "Untitled model",
        formatVersion: "open-model-package-v1"
      },
      packageRevision: 0,
      authoringRevision: 0,
      dirty: false,
      graph: {
        coordinateSystem: "canvas-y-down-v1",
        canvasSize: { width: 256, height: 256 },
        parts: [],
        drawables: [],
        meshes: [],
        parameters: [],
        keyformSets: [],
        rigControls: [],
        dynamicsGroups: [],
        masks: [],
        drawOrder: [],
        rigControlRootIds: [],
        stableOrder: [],
        sourceAssets: [],
        provenanceRecords: [],
        rightsRecords: []
      }
    },
    undo: vi.fn()
  },
  setActiveEntry: vi.fn()
}));

vi.mock("../../features/editor-session/editor-session-context", () => ({
  useEditorSession: () => projectStorageTestState.editorSession
}));

vi.mock("../../state/editor-ui-store", () => ({
  useEditorUiStore: (
    selector: (state: {
      readonly surfaceLabel: string;
      readonly activeEntry: string;
      readonly setActiveEntry: (entry: string) => void;
    }) => unknown
  ) =>
    selector({
      surfaceLabel: "Mock Surface",
      activeEntry: "storage",
      setActiveEntry: projectStorageTestState.setActiveEntry
    })
}));

describe("ProjectStorageScreen", () => {
  beforeEach(() => {
    projectStorageTestState.editorSession.projectIdentityLabel = "Untitled model · rev 0";
    projectStorageTestState.editorSession.projectSaveStatusLabel = "Saved";
    projectStorageTestState.editorSession.projectStorage = createIdleStorageState();
    projectStorageTestState.editorSession.session = createStorageSession();
    projectStorageTestState.editorSession.openProjectFile.mockClear();
    projectStorageTestState.editorSession.saveProject.mockClear();
    projectStorageTestState.setActiveEntry.mockClear();
  });

  it("renders the storage workspace task with portable bundle controls and status", () => {
    const markup = renderProjectStorageScreen();

    expect(markup).toContain("Project Storage");
    expect(markup).toContain("Current Project");
    expect(markup).toContain("Untitled model · rev 0");
    expect(markup).toContain("Open portable project bundle file");
    expect(markup).toContain(">Open<");
    expect(markup).toContain(">Save<");
    expect(markup).toContain("No portable project operation has run in this session.");
  });

  it("renders saved portable bundle status details", () => {
    projectStorageTestState.editorSession.projectIdentityLabel = "Saved Project · rev 3";
    projectStorageTestState.editorSession.projectStorage = {
      status: "saved",
      message: "Saved Saved Project revision 3.",
      lastAction: "save",
      fileName: "saved-project-rev3.portable-project.json",
      errorCode: null,
      issues: [],
      binaryPayloadCount: 2,
      binaryFileCount: 2,
      completedAt: "2026-06-15T03:00:00.000Z"
    };
    projectStorageTestState.editorSession.session = createStorageSession({
      packageDisplayName: "Saved Project",
      packageRevision: 3,
      binaryFileCount: 2
    });

    const markup = renderProjectStorageScreen();

    expect(markup).toContain("Saved Project · rev 3");
    expect(markup).toContain("Saved Saved Project revision 3.");
    expect(markup).toContain("saved-project-rev3.portable-project.json");
    expect(markup).toContain("Bundle bytes");
    expect(markup).toContain(">2<");
  });

  it("renders loaded portable bundle status details", () => {
    projectStorageTestState.editorSession.projectIdentityLabel = "Loaded Project · rev 4";
    projectStorageTestState.editorSession.projectStorage = {
      status: "loaded",
      message: "Opened Loaded Project revision 4.",
      lastAction: "open",
      fileName: "loaded-project.portable-project.json",
      errorCode: null,
      issues: [],
      binaryPayloadCount: 1,
      binaryFileCount: 1,
      completedAt: "2026-06-15T04:00:00.000Z"
    };
    projectStorageTestState.editorSession.session = createStorageSession({
      packageDisplayName: "Loaded Project",
      packageRevision: 4,
      binaryFileCount: 1
    });

    const markup = renderProjectStorageScreen();

    expect(markup).toContain("Loaded Project · rev 4");
    expect(markup).toContain("Opened Loaded Project revision 4.");
    expect(markup).toContain("loaded-project.portable-project.json");
    expect(markup).toContain(">open<");
    expect(markup).toContain("Loaded bytes");
  });

  it("renders storage error code, issue code, and target path", () => {
    projectStorageTestState.editorSession.projectSaveStatusLabel = "Storage error";
    projectStorageTestState.editorSession.projectStorage = {
      status: "error",
      message: "Portable bundle digest mismatch.",
      lastAction: "open",
      fileName: "bad-project.portable-project.json",
      errorCode: "digestMismatch",
      issues: [
        {
          code: "portableBundle.digest.mismatch",
          message: "Expected digest did not match payload digest.",
          targetPath: "assets/textures/provider-fixture.png"
        }
      ],
      binaryPayloadCount: null,
      binaryFileCount: null,
      completedAt: "2026-06-15T05:00:00.000Z"
    };

    const markup = renderProjectStorageScreen();

    expect(markup).toContain("Storage Error");
    expect(markup).toContain("digestMismatch");
    expect(markup).toContain("portableBundle.digest.mismatch");
    expect(markup).toContain("Expected digest did not match payload digest.");
    expect(markup).toContain("assets/textures/provider-fixture.png");
    expect(markup).toContain("bad-project.portable-project.json");
  });
});

function renderProjectStorageScreen(): string {
  return renderToStaticMarkup(createElement(ProjectStorageScreen));
}

function createIdleStorageState(): ProjectStorageState {
  return {
    status: "idle",
    message: "No portable project operation has run in this session.",
    lastAction: null,
    fileName: null,
    errorCode: null,
    issues: [],
    binaryPayloadCount: null,
    binaryFileCount: null,
    completedAt: null
  };
}

function createStorageSession(
  options: {
    readonly packageDisplayName?: string;
    readonly packageRevision?: number;
    readonly binaryFileCount?: number;
  } = {}
): AuthoringSession {
  return {
    packageIdentity: {
      packageId: "pkg_storage_screen",
      packageDisplayName: options.packageDisplayName ?? "Untitled model",
      formatVersion: "open-model-package-v1"
    },
    packageRevision: options.packageRevision ?? 0,
    authoringRevision: 0,
    dirty: false,
    binaryAssets: {
      fileEntries: Array.from({ length: options.binaryFileCount ?? 0 }, (_value, index) => ({
        path: `assets/textures/test-${index}.png`,
        bytes: new Uint8Array([index])
      })),
      binaryAssetIndex: {
        schemaVersion: "binary-asset-index-v1",
        assets: []
      }
    },
    graph: {
      coordinateSystem: "canvas-y-down-v1",
      canvasSize: { width: 256, height: 256 },
      parts: [],
      drawables: [],
      meshes: [],
      parameters: [],
      keyformSets: [],
      rigControls: [],
      dynamicsGroups: [],
      masks: [],
      drawOrder: [],
      rigControlRootIds: [],
      stableOrder: [],
      sourceAssets: [],
      provenanceRecords: [],
      rightsRecords: []
    }
  } as AuthoringSession;
}
