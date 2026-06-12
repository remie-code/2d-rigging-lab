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
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it } from "vitest";

import { commitEditKeyformKey } from "./editor-session-commands";
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

describe("editor session history", () => {
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

  it("records existing keyform command commits and restores add, update, and delete", () => {
    let currentSession = createFixtureSession();
    let history = createEmptyEditorSessionHistory();

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
    expect(history.undoStack).toHaveLength(3);

    const undoDelete = undoEditorSessionHistory(history)!;
    expect(findOpacityKeyformValue(undoDelete.session)).toBe(0.25);

    const undoUpdate = undoEditorSessionHistory(undoDelete.history)!;
    expect(findOpacityKeyformValue(undoUpdate.session)).toBe(0.5);

    const undoAdd = undoEditorSessionHistory(undoUpdate.history)!;
    expect(findOpacityKeyformValue(undoAdd.session)).toBeUndefined();

    const redoAdd = redoEditorSessionHistory(undoAdd.history)!;
    expect(findOpacityKeyformValue(redoAdd.session)).toBe(0.5);
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
