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
import { describe, expect, it, vi } from "vitest";

import { commitEditKeyformKey } from "./editor-session-commands";
import {
  createEditorSessionGestureCommit,
  createEditorSessionGestureCommitController,
  commitEditorSessionGestureWithHistory,
  previewEditorSessionGesture
} from "./editor-session-gesture-commit";
import { createEmptyEditorSessionHistory } from "./editor-session-history";

const PART_ROOT = PartIdSchema.parse("part_root");
const PART_A = PartIdSchema.parse("part_a");
const DRAW_A = DrawableIdSchema.parse("draw_a");
const PARAMETER_ID = ParameterIdSchema.parse("param_face_angle_x");

describe("editor session gesture commit contract", () => {
  it("keeps pointermove preview separate from the pointerup commit history entry", () => {
    const currentSession = createFixtureSession();
    const history = createEmptyEditorSessionHistory();
    const preview = vi.fn((session: typeof currentSession) => ({
      packageRevision: session.packageRevision
    }));
    const commit = vi.fn((session: typeof currentSession) =>
      commitEditKeyformKey(session, {
        action: "addCurrent",
        target: { kind: "drawable", id: DRAW_A },
        targetProperty: "opacity",
        parameterId: PARAMETER_ID,
        keyValue: 0,
        interpolation: "linear-1d-v1",
        statePatch: {
          propertyPath: "opacity",
          value: 0.5
        }
      })
    );
    const gesture = createEditorSessionGestureCommit({
      label: "Drag control point",
      preview,
      commit
    });

    expect(
      previewEditorSessionGesture({
        gesture,
        currentSession
      })
    ).toEqual({ packageRevision: 0 });
    expect(preview).toHaveBeenCalledTimes(1);
    expect(commit).not.toHaveBeenCalled();
    expect(history.undoStack).toHaveLength(0);

    const outcome = commitEditorSessionGestureWithHistory({
      gesture,
      currentSession,
      history
    });

    expect(commit).toHaveBeenCalledTimes(1);
    expect(outcome.result.committed).toBe(true);
    expect(outcome.history.undoStack).toHaveLength(1);
    expect(outcome.history.undoStack[0]?.label).toBe("Drag control point");
  });

  it("offers a single-use commit controller for one gesture entry", () => {
    const currentSession = createFixtureSession();
    const history = createEmptyEditorSessionHistory();
    const commit = vi.fn((session: typeof currentSession) =>
      commitEditKeyformKey(session, {
        action: "addCurrent",
        target: { kind: "drawable", id: DRAW_A },
        targetProperty: "opacity",
        parameterId: PARAMETER_ID,
        keyValue: 0,
        interpolation: "linear-1d-v1",
        statePatch: {
          propertyPath: "opacity",
          value: 0.5
        }
      })
    );
    const controller = createEditorSessionGestureCommitController(
      createEditorSessionGestureCommit({
        label: "Drag control point",
        preview: (session) => session.packageRevision,
        commit
      })
    );

    expect(controller.preview({ currentSession })).toBe(0);
    expect(controller.hasCommitted()).toBe(false);

    const firstCommit = controller.commitOnce({
      currentSession,
      history
    });
    const secondCommit = controller.commitOnce({
      currentSession: firstCommit!.result.session,
      history: firstCommit!.history
    });

    expect(firstCommit?.history.undoStack).toHaveLength(1);
    expect(secondCommit).toBeNull();
    expect(commit).toHaveBeenCalledTimes(1);
    expect(controller.hasCommitted()).toBe(true);
  });
});

function createFixtureSession(): AuthoringSession {
  return {
    packageIdentity: {
      packageId: PackageIdSchema.parse("pkg_editor_session_gesture_fixture"),
      packageDisplayName: "Editor Session Gesture Fixture",
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
