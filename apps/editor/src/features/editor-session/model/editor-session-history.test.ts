import {
  createInitialAuthoringRevision,
  type AuthoringSession
} from "@private-2d-rigging-lab/authoring-core";
import {
  DrawableIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  ParameterIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema,
  type RigControlId
} from "@private-2d-rigging-lab/contracts";
import {
  getLive2dPerformanceStats,
  resetLive2dPerformanceStats
} from "@private-2d-rigging-lab/render-core";
import { afterEach, describe, expect, it } from "vitest";

import {
  commitCreateWarpDeformer,
  commitDeleteRigControl,
  commitEditKeyformKey,
  commitPartNameEdit
} from "./editor-session-commands";
import {
  canRedoEditorSessionHistory,
  canUndoEditorSessionHistory,
  commitEditorSessionCommandWithHistory,
  createEmptyEditorSessionHistory,
  recordEditorSessionCommit,
  redoEditorSessionHistory,
  undoEditorSessionHistory,
  type EditorSessionHistoryState
} from "./editor-session-history";

const PART_ROOT = PartIdSchema.parse("part_root");
const PART_A = PartIdSchema.parse("part_a");
const DRAW_A = DrawableIdSchema.parse("draw_a");
const PARAMETER_ID = ParameterIdSchema.parse("param_face_angle_x");
const TEXTURE_PATH = "assets/textures/history-fixture.raw-rgba";
const TEXTURE_BYTES = new Uint8Array([0x61, 0x62, 0x63, 0x64]);

describe("editor session history", () => {
  afterEach(() => {
    delete (globalThis as Live2dPerformanceTestGlobal).__LIVE2D_PERF__;
    resetLive2dPerformanceStats();
  });

  it("bounds undo depth and clears redo when a new commit is recorded", () => {
    const baseSession = createFixtureSession();
    const revisionOne = withPackageRevision(baseSession, 1);
    const revisionTwo = withPackageRevision(baseSession, 2);
    const revisionThree = withPackageRevision(baseSession, 3);
    const revisionFour = withPackageRevision(baseSession, 4);

    let history = createEmptyEditorSessionHistory(2);
    history = recordEditorSessionCommit(history, {
      before: baseSession,
      after: revisionOne,
      label: "First"
    });
    history = recordEditorSessionCommit(history, {
      before: revisionOne,
      after: revisionTwo,
      label: "Second"
    });
    history = recordEditorSessionCommit(history, {
      before: revisionTwo,
      after: revisionThree,
      label: "Third"
    });

    expect(history.undoStack.map((entry) => entry.label)).toEqual(["Second", "Third"]);

    const undo = undoEditorSessionHistory(history);
    expect(undo?.session.packageRevision).toBe(2);
    expect(undo?.history.redoStack).toHaveLength(1);

    history = recordEditorSessionCommit(undo!.history, {
      before: undo!.session,
      after: revisionFour,
      label: "Branch"
    });

    expect(history.redoStack).toEqual([]);
    expect(redoEditorSessionHistory(history)).toBeNull();
  });

  it("records binary-backed commits without deep cloning unchanged bytes", () => {
    const before = createBinaryBackedFixtureSession();
    const after = withPartDisplayName(before, "Part A Updated");
    const sharedBytes = getFirstBinaryBytes(before);

    const history = recordEditorSessionCommit(createEmptyEditorSessionHistory(), {
      before,
      after,
      label: "Update part"
    });
    const entry = history.undoStack[0]!;

    expect(getFirstBinaryBytes(entry.before)).toBe(sharedBytes);
    expect(getFirstBinaryBytes(entry.after)).toBe(sharedBytes);

    after.graph.parts[1] = {
      ...after.graph.parts[1]!,
      displayName: "Mutated after recording"
    };

    expect(entry.after.graph.parts[1]?.displayName).toBe("Part A Updated");
  });

  it("returns undo and redo graph states with valid shared binary assets", () => {
    const before = createBinaryBackedFixtureSession();
    const after = withPartDisplayName(before, "Part A Updated");
    const sharedBytes = getFirstBinaryBytes(before);
    const history = recordEditorSessionCommit(createEmptyEditorSessionHistory(), {
      before,
      after,
      label: "Update part"
    });

    const undo = undoEditorSessionHistory(history)!;
    expect(undo.session.graph.parts[1]?.displayName).toBe("Part A");
    expect(getFirstBinaryBytes(undo.session)).toBe(sharedBytes);

    const redo = redoEditorSessionHistory(undo.history)!;
    expect(redo.session.graph.parts[1]?.displayName).toBe("Part A Updated");
    expect(getFirstBinaryBytes(redo.session)).toBe(sharedBytes);
  });

  it("keeps binary byte identity shared through multiple graph-only commits", () => {
    let currentSession = createBinaryBackedFixtureSession();
    let history = createEmptyEditorSessionHistory();
    const sharedBytes = getFirstBinaryBytes(currentSession);

    for (const displayName of ["Part A One", "Part A Two", "Part A Three"]) {
      const outcome = commitEditorSessionCommandWithHistory({
        currentSession,
        history,
        label: "Rename part",
        command: (session) => commitPartNameEdit(session, PART_A, displayName)
      });

      expect(outcome.result.committed).toBe(true);
      currentSession = outcome.result.session;
      history = outcome.history;
      expect(getFirstBinaryBytes(currentSession)).toBe(sharedBytes);
    }

    expect(history.undoStack).toHaveLength(3);
    for (const entry of history.undoStack) {
      expect(getFirstBinaryBytes(entry.before)).toBe(sharedBytes);
      expect(getFirstBinaryBytes(entry.after)).toBe(sharedBytes);
    }
  });

  it("records existing keyform command commits and restores add, update, and delete for a binary-backed session", () => {
    let currentSession = createBinaryBackedFixtureSession();
    let history = createEmptyEditorSessionHistory();
    const sharedBytes = getFirstBinaryBytes(currentSession);

    ({ currentSession, history } = applyKeyformCommand(
      currentSession,
      history,
      "addCurrent",
      0.5
    ));
    expect(findOpacityKeyformValue(currentSession)).toBe(0.5);

    ({ currentSession, history } = applyKeyformCommand(
      currentSession,
      history,
      "updateCurrent",
      0.25
    ));
    expect(findOpacityKeyformValue(currentSession)).toBe(0.25);

    ({ currentSession, history } = applyKeyformCommand(
      currentSession,
      history,
      "deleteCurrent"
    ));
    expect(findOpacityKeyformValue(currentSession)).toBeUndefined();
    expect(getFirstBinaryBytes(currentSession)).toBe(sharedBytes);
    expect(history.undoStack).toHaveLength(3);

    const undoDelete = undoEditorSessionHistory(history)!;
    expect(findOpacityKeyformValue(undoDelete.session)).toBe(0.25);
    expect(getFirstBinaryBytes(undoDelete.session)).toBe(sharedBytes);

    const undoUpdate = undoEditorSessionHistory(undoDelete.history)!;
    expect(findOpacityKeyformValue(undoUpdate.session)).toBe(0.5);
    expect(getFirstBinaryBytes(undoUpdate.session)).toBe(sharedBytes);

    const undoAdd = undoEditorSessionHistory(undoUpdate.history)!;
    expect(findOpacityKeyformValue(undoAdd.session)).toBeUndefined();
    expect(getFirstBinaryBytes(undoAdd.session)).toBe(sharedBytes);

    const redoAdd = redoEditorSessionHistory(undoAdd.history)!;
    expect(findOpacityKeyformValue(redoAdd.session)).toBe(0.5);
    expect(getFirstBinaryBytes(redoAdd.session)).toBe(sharedBytes);

    const redoUpdate = redoEditorSessionHistory(redoAdd.history)!;
    expect(findOpacityKeyformValue(redoUpdate.session)).toBe(0.25);
    expect(getFirstBinaryBytes(redoUpdate.session)).toBe(sharedBytes);

    const redoDelete = redoEditorSessionHistory(redoUpdate.history)!;
    expect(findOpacityKeyformValue(redoDelete.session)).toBeUndefined();
    expect(getFirstBinaryBytes(redoDelete.session)).toBe(sharedBytes);
  });

  it("keeps deformer create and delete undoable and redoable for a binary-backed session", () => {
    let currentSession = createBinaryBackedFixtureSession();
    let history = createEmptyEditorSessionHistory();
    const sharedBytes = getFirstBinaryBytes(currentSession);

    const createOutcome = commitEditorSessionCommandWithHistory({
      currentSession,
      history,
      label: "Create Warp Deformer",
      command: (session) =>
        commitCreateWarpDeformer(session, {
          partId: PART_A,
          displayName: "History Warp",
          childDrawableIds: [DRAW_A],
          childRigControlIds: [],
          domainBounds: { x: 0, y: 0, width: 32, height: 32 },
          transformColumns: 5,
          transformRows: 5,
          bezierColumns: 3,
          bezierRows: 3,
          bezierEditType: "cubicBezierSurfaceV1"
        })
    });
    expect(createOutcome.result.committed).toBe(true);
    const rigControlId = createOutcome.result.rigControlId!;
    currentSession = createOutcome.result.session;
    history = createOutcome.history;
    expect(findRigControl(currentSession, rigControlId)).toBeDefined();
    expect(getFirstBinaryBytes(currentSession)).toBe(sharedBytes);

    const deleteOutcome = commitEditorSessionCommandWithHistory({
      currentSession,
      history,
      label: "Delete Deformer",
      command: (session) => commitDeleteRigControl(session, { rigControlId })
    });
    expect(deleteOutcome.result.committed).toBe(true);
    currentSession = deleteOutcome.result.session;
    history = deleteOutcome.history;
    expect(findRigControl(currentSession, rigControlId)).toBeUndefined();
    expect(getFirstBinaryBytes(currentSession)).toBe(sharedBytes);

    const undoDelete = undoEditorSessionHistory(history)!;
    expect(findRigControl(undoDelete.session, rigControlId)).toBeDefined();
    expect(getFirstBinaryBytes(undoDelete.session)).toBe(sharedBytes);

    const undoCreate = undoEditorSessionHistory(undoDelete.history)!;
    expect(findRigControl(undoCreate.session, rigControlId)).toBeUndefined();
    expect(getFirstBinaryBytes(undoCreate.session)).toBe(sharedBytes);

    const redoCreate = redoEditorSessionHistory(undoCreate.history)!;
    expect(findRigControl(redoCreate.session, rigControlId)).toBeDefined();
    expect(getFirstBinaryBytes(redoCreate.session)).toBe(sharedBytes);

    const redoDelete = redoEditorSessionHistory(redoCreate.history)!;
    expect(findRigControl(redoDelete.session, rigControlId)).toBeUndefined();
    expect(getFirstBinaryBytes(redoDelete.session)).toBe(sharedBytes);
  });

  it("keeps history binary pressure counters disabled by default", () => {
    const before = createBinaryBackedFixtureSession();
    const after = withPartDisplayName(before, "Part A Updated");
    resetLive2dPerformanceStats();

    recordEditorSessionCommit(createEmptyEditorSessionHistory(), {
      before,
      after,
      label: "Update part"
    });

    expect(getLive2dPerformanceStats()).toBeUndefined();
  });

  it("records history binary pressure counters when the existing dev perf flag is enabled", () => {
    (globalThis as Live2dPerformanceTestGlobal).__LIVE2D_PERF__ = true;
    resetLive2dPerformanceStats();
    const before = createBinaryBackedFixtureSession();
    const after = withPartDisplayName(before, "Part A Updated");

    recordEditorSessionCommit(createEmptyEditorSessionHistory(), {
      before,
      after,
      label: "Update part"
    });

    expect(getLive2dPerformanceStats()?.counters).toMatchObject({
      "editorHistory.samples": 1,
      "editorHistory.undoDepth": 1,
      "editorHistory.redoDepth": 0,
      "editorHistory.currentBinaryAssetCount": 1,
      "editorHistory.currentBinaryBytes": TEXTURE_BYTES.byteLength,
      "editorHistory.estimatedDeepClonedHistoryBinaryBytes": TEXTURE_BYTES.byteLength * 2,
      "editorHistory.estimatedRetainedSharedHistoryBinaryBytes": TEXTURE_BYTES.byteLength,
      "editorHistory.estimatedAvoidedDuplicateHistoryBinaryBytes": TEXTURE_BYTES.byteLength,
      "editorHistory.retainedSharingRatioBasisPoints": 5000
    });
  });

  it("does not dirty history for rejected command results", () => {
    const currentSession = createFixtureSession();
    const history = createEmptyEditorSessionHistory();

    const outcome = commitEditorSessionCommandWithHistory({
      currentSession,
      history,
      label: "Rejected keyform update",
      command: (session) =>
        commitEditKeyformKey(session, {
          action: "updateCurrent",
          target: { kind: "drawable", id: DRAW_A },
          targetProperty: "opacity",
          parameterId: PARAMETER_ID,
          keyValue: 0,
          interpolation: "linear-1d-v1",
          statePatch: {
            propertyPath: "opacity",
            value: 0.25
          }
        })
    });

    expect(outcome.result.committed).toBe(false);
    expect(outcome.history).toBe(history);
    expect(canUndoEditorSessionHistory(outcome.history)).toBe(false);
    expect(canRedoEditorSessionHistory(outcome.history)).toBe(false);
  });

  it("clears redo when a new keyform commit is made after undo", () => {
    let currentSession = createFixtureSession();
    let history = createEmptyEditorSessionHistory();

    ({ currentSession, history } = applyKeyformCommand(
      currentSession,
      history,
      "addCurrent",
      0.5
    ));
    ({ currentSession, history } = applyKeyformCommand(
      currentSession,
      history,
      "updateCurrent",
      0.25
    ));

    const undoUpdate = undoEditorSessionHistory(history)!;
    currentSession = undoUpdate.session;
    history = undoUpdate.history;
    expect(canRedoEditorSessionHistory(history)).toBe(true);

    ({ currentSession, history } = applyKeyformCommand(
      currentSession,
      history,
      "updateCurrent",
      0.75
    ));

    expect(findOpacityKeyformValue(currentSession)).toBe(0.75);
    expect(canRedoEditorSessionHistory(history)).toBe(false);
  });
});

function applyKeyformCommand(
  currentSession: AuthoringSession,
  history: EditorSessionHistoryState,
  action: "addCurrent" | "updateCurrent" | "deleteCurrent",
  value?: number
): {
  readonly currentSession: AuthoringSession;
  readonly history: EditorSessionHistoryState;
} {
  const payload =
    action === "deleteCurrent"
      ? {
          action,
          target: { kind: "drawable" as const, id: DRAW_A },
          targetProperty: "opacity" as const,
          parameterId: PARAMETER_ID,
          keyValue: 0,
          interpolation: "linear-1d-v1" as const
        }
      : {
          action,
          target: { kind: "drawable" as const, id: DRAW_A },
          targetProperty: "opacity" as const,
          parameterId: PARAMETER_ID,
          keyValue: 0,
          interpolation: "linear-1d-v1" as const,
          statePatch: {
            propertyPath: "opacity" as const,
            value: value ?? 0
          }
        };
  const outcome = commitEditorSessionCommandWithHistory({
    currentSession,
    history,
    label: "Edit keyform",
    command: (session) => commitEditKeyformKey(session, payload)
  });

  expect(outcome.result.committed).toBe(true);

  return {
    currentSession: outcome.result.session,
    history: outcome.history
  };
}

function findOpacityKeyformValue(session: AuthoringSession): number | undefined {
  const keyformSet = session.graph.keyformSets.find(
    (candidate) =>
      candidate.target.kind === "drawable" &&
      candidate.target.id === DRAW_A &&
      candidate.target.property === "opacity"
  );

  const statePatch = keyformSet?.keys.find((key) => "value" in key && key.value === 0)
    ?.statePatch;
  return typeof statePatch === "number" ? statePatch : undefined;
}

function withPackageRevision(session: AuthoringSession, packageRevision: number): AuthoringSession {
  return {
    ...structuredClone(session),
    packageRevision
  };
}

function withPartDisplayName(session: AuthoringSession, displayName: string): AuthoringSession {
  const nextSession: AuthoringSession = {
    ...session,
    packageRevision: session.packageRevision + 1,
    graph: structuredClone(session.graph),
    binaryAssets: session.binaryAssets
  };
  nextSession.graph.parts[1] = {
    ...nextSession.graph.parts[1]!,
    displayName
  };
  return nextSession;
}

function createBinaryBackedFixtureSession(): AuthoringSession {
  const session = createFixtureSession();
  const binaryAssetRef = {
    referenceKind: "package-binary-asset-ref-v1" as const,
    binaryAssetId: "bin_history_fixture_texture",
    packageRelativePath: TEXTURE_PATH,
    digest: {
      algorithm: "sha256" as const,
      hex: "0".repeat(64)
    },
    byteLength: TEXTURE_BYTES.byteLength,
    mediaType: "application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8",
    storageStatus: "stored-package-local-v1" as const,
    provenanceId: ProvenanceIdSchema.parse("prov_a"),
    rightsAssetId: "rights_history_fixture"
  };

  session.graph.textureAtlas = {
    schemaVersion: "texture-atlas-v1",
    textures: [
      {
        textureId: TextureIdSchema.parse("tex_a"),
        filePath: TEXTURE_PATH,
        sourceAssetId: SourceAssetIdSchema.parse("src_fixture"),
        sourceLayerId: "layer_history_fixture",
        provenanceId: ProvenanceIdSchema.parse("prov_a"),
        binaryAssetRef
      }
    ]
  };
  session.binaryAssets = {
    fileEntries: [
      {
        path: TEXTURE_PATH,
        bytes: TEXTURE_BYTES,
        mediaType: "application/vnd.ai-native-live2d.raw-rgba; pixelFormat=rgba8",
        binaryAssetId: "bin_history_fixture_texture"
      }
    ],
    binaryAssetIndex: {
      schemaVersion: "binary-asset-index-v1",
      assets: []
    },
    byteIntakeSummaries: []
  };

  return session;
}

function getFirstBinaryBytes(session: AuthoringSession): Uint8Array {
  const bytes = session.binaryAssets?.fileEntries[0]?.bytes;
  if (bytes === undefined) {
    throw new Error("Expected fixture binary bytes.");
  }

  return bytes;
}

function findRigControl(session: AuthoringSession, rigControlId: RigControlId) {
  return session.graph.rigControls.find(
    (candidate) => candidate.rigControlId === rigControlId
  );
}

function createFixtureSession(): AuthoringSession {
  return {
    packageIdentity: {
      packageId: PackageIdSchema.parse("pkg_editor_session_history_fixture"),
      packageDisplayName: "Editor Session History Fixture",
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
          childPartIds: [PART_A],
          drawableIds: []
        },
        {
          partId: PART_A,
          displayName: "Part A",
          parentPartId: PART_ROOT,
          childPartIds: [],
          drawableIds: [DRAW_A]
        }
      ],
      drawables: [
        {
          drawableId: DRAW_A,
          displayName: "Drawable A",
          partId: PART_A,
          sourceAssetId: SourceAssetIdSchema.parse("src_fixture"),
          textureId: TextureIdSchema.parse("tex_a"),
          meshId: MeshIdSchema.parse("mesh_a"),
          defaultOpacity: 1,
          runtimeVisibility: true,
          baseDrawOrder: 0,
          sourceProvenanceId: ProvenanceIdSchema.parse("prov_a")
        }
      ],
      meshes: [],
      parameters: [],
      keyformSets: [],
      rigControls: [],
      dynamicsGroups: [],
      masks: [],
      drawOrder: [
        {
          drawableId: DRAW_A,
          baseDrawOrder: 0,
          stableOrder: 0
        }
      ],
      rigControlRootIds: [],
      stableOrder: [PART_ROOT, PART_A, DRAW_A],
      sourceAssets: [],
      provenanceRecords: [],
      rightsRecords: []
    }
  };
}

type Live2dPerformanceTestGlobal = typeof globalThis & {
  __LIVE2D_PERF__?: boolean;
};
