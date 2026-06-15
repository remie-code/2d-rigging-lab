import {
  createInitialAuthoringRevision,
  type AuthoringSession
} from "@private-2d-rigging-lab/authoring-core";
import {
  DrawableIdSchema,
  KeyformSetIdSchema,
  MeshIdSchema,
  PackageIdSchema,
  ParameterIdSchema,
  PartIdSchema,
  ProvenanceIdSchema,
  RigControlIdSchema,
  SourceAssetIdSchema,
  TextureIdSchema
} from "@private-2d-rigging-lab/contracts";
import { act, createElement, StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it } from "vitest";

import type { EditorSessionCommandResult } from "../../features/editor-session/model/editor-session-commands";
import {
  createEditorSessionGestureCommitController,
  type EditorSessionGestureCommitController
} from "../../features/editor-session/model/editor-session-gesture-commit";
import {
  createEmptyEditorSessionHistory,
  undoEditorSessionHistory
} from "../../features/editor-session/model/editor-session-history";
import {
  createParameterBindingProjection,
  createRigControlParameterBindings
} from "../../features/editor-session/model/parameter-keyform-state";
import type {
  CanvasDeformerOverlayProjection,
  CanvasRenderProjection
} from "./canvas-projection";
import {
  createRotationKeyformAngleUpdateGesture,
  createRotationPivotUpdateGesture,
  createRotationRestAngleUpdateGesture,
  canCommitRotationAngleKeyformUpdate,
  hasRotationAngleKeyforms
} from "./rotation-deformer-gesture";
import {
  hitTestRotationDeformerHandle,
  listRotationDeformerHandlePositions,
  resolveRotationAngleDegreesFromScreenPoint
} from "./rotation-deformer-handles";
import {
  useRotationDeformerInteraction,
  type RotationDeformerInteraction
} from "./use-rotation-deformer-interaction";

const PART_ROOT = PartIdSchema.parse("part_root");
const PART_FACE = PartIdSchema.parse("part_face");
const DRAW_FACE = DrawableIdSchema.parse("draw_face");
const MESH_FACE = MeshIdSchema.parse("mesh_face");
const TEX_FACE = TextureIdSchema.parse("tex_face");
const SOURCE_ASSET = SourceAssetIdSchema.parse("src_fixture");
const PROVENANCE = ProvenanceIdSchema.parse("prov_fixture");
const FACE_ANGLE_X = ParameterIdSchema.parse("param_face_angle_x");
const RIG_FACE_ROTATION = RigControlIdSchema.parse("rig_face_rotation");

describe("Rotation Deformer canvas editing", () => {
  it("computes pivot and angle handle positions and hit-tests them deterministically", () => {
    const overlay = createOverlay({
      pivot: { x: 40, y: 50 },
      restAngleDegrees: 0,
      evaluatedAngleDegrees: 0
    });
    const view = { zoom: 2, pan: { x: 10, y: 20 } };

    const positions = listRotationDeformerHandlePositions({ overlay, view });
    expect(positions).toHaveLength(2);
    expect(positions[0]).toMatchObject({
      kind: "pivot",
      canvasPoint: { x: 40, y: 50 },
      screenPoint: { x: 90, y: 120 }
    });
    expect(positions[1]).toMatchObject({
      kind: "angle",
      canvasPoint: { x: 68, y: 50 },
      screenPoint: { x: 146, y: 120 }
    });

    expect(
      hitTestRotationDeformerHandle({
        overlay,
        view,
        screenPoint: { x: 92, y: 119 }
      })?.kind
    ).toBe("pivot");
    expect(
      hitTestRotationDeformerHandle({
        overlay,
        view,
        screenPoint: { x: 146, y: 123 }
      })?.kind
    ).toBe("angle");
    expect(
      hitTestRotationDeformerHandle({
        overlay,
        view,
        screenPoint: { x: 200, y: 200 }
      })
    ).toBeUndefined();
  });

  it("resolves drag angle from screen space using the current canvas view", () => {
    expect(
      resolveRotationAngleDegreesFromScreenPoint({
        pivot: { x: 40, y: 50 },
        screenPoint: { x: 90, y: 160 },
        view: { zoom: 2, pan: { x: 10, y: 20 } },
        fallbackAngleDegrees: 12
      })
    ).toBe(90);
  });

  it("commits pivot and rest-angle drags once and Undo restores the prior fields", () => {
    const session = createRigFixtureSession();
    const history = createEmptyEditorSessionHistory();
    const nextPivot = { x: 45, y: 55 };
    const pivotController = createEditorSessionGestureCommitController(
      createRotationPivotUpdateGesture({
        rigControlId: RIG_FACE_ROTATION,
        getNextPivot: () => nextPivot
      })
    );

    expect(pivotController.preview({ currentSession: session })).toEqual(nextPivot);
    const pivotOutcome = pivotController.commitOnce({
      currentSession: session,
      history
    });

    if (pivotOutcome?.result.committed !== true) {
      throw new Error(JSON.stringify(pivotOutcome?.result.diagnostics ?? []));
    }
    expect(readRotationRigControl(pivotOutcome.result.session).pivot).toEqual(nextPivot);
    expect(pivotOutcome.history.undoStack).toHaveLength(1);
    expect(
      pivotController.commitOnce({
        currentSession: pivotOutcome.result.session,
        history: pivotOutcome.history
      })
    ).toBeNull();

    const restController = createEditorSessionGestureCommitController(
      createRotationRestAngleUpdateGesture({
        rigControlId: RIG_FACE_ROTATION,
        getNextAngleDegrees: () => -30
      })
    );
    const restOutcome = restController.commitOnce({
      currentSession: pivotOutcome.result.session,
      history: pivotOutcome.history
    });

    if (restOutcome?.result.committed !== true) {
      throw new Error(JSON.stringify(restOutcome?.result.diagnostics ?? []));
    }
    expect(readRotationRigControl(restOutcome.result.session).restAngleDegrees).toBe(-30);
    expect(restOutcome.history.undoStack).toHaveLength(2);

    const undoRest = undoEditorSessionHistory(restOutcome.history);
    expect(undoRest).not.toBeNull();
    expect(readRotationRigControl(undoRest?.session ?? session).restAngleDegrees).toBe(0);
    const undoPivot = undoEditorSessionHistory(undoRest?.history ?? createEmptyEditorSessionHistory());
    expect(undoPivot).not.toBeNull();
    expect(readRotationRigControl(undoPivot?.session ?? session).pivot).toEqual({ x: 50, y: 50 });
  });

  it("updates an exact Rotation angle keyform and blocks ambiguous between-keyform drags", () => {
    const session = createRigFixtureSession();
    session.graph.keyformSets.push(createAngleKeyformSet());
    const binding = requireRotationAngleBinding(session);
    const exactProjection = createParameterBindingProjection(session, binding, FACE_ANGLE_X, {
      [FACE_ANGLE_X]: 30
    });
    const betweenProjection = createParameterBindingProjection(session, binding, FACE_ANGLE_X, {
      [FACE_ANGLE_X]: 0
    });

    expect(hasRotationAngleKeyforms(session, RIG_FACE_ROTATION)).toBe(true);
    expect(canCommitRotationAngleKeyformUpdate(exactProjection)).toBe(true);
    expect(canCommitRotationAngleKeyformUpdate(betweenProjection)).toBe(false);
    expect(betweenProjection.source).toBe("interpolated");

    if (!canCommitRotationAngleKeyformUpdate(exactProjection)) {
      throw new Error("Expected exact angle keyform projection to be editable.");
    }
    const controller = createEditorSessionGestureCommitController(
      createRotationKeyformAngleUpdateGesture({
        binding,
        currentParameterValue: exactProjection.currentParameterValue,
        getNextAngleDegrees: () => 45,
        parameter: exactProjection.parameter
      })
    );
    const outcome = controller.commitOnce({
      currentSession: session,
      history: createEmptyEditorSessionHistory()
    });

    if (outcome?.result.committed !== true) {
      throw new Error(JSON.stringify(outcome?.result.diagnostics ?? []));
    }
    expect(readAngleKey(outcome.result.session, 30)).toBe(45);
    expect(readRotationRigControl(outcome.result.session).restAngleDegrees).toBe(0);
  });

  it("does not commit when a drag is cancelled before pointer-up commit", () => {
    const session = createRigFixtureSession();
    const controller = createEditorSessionGestureCommitController(
      createRotationRestAngleUpdateGesture({
        rigControlId: RIG_FACE_ROTATION,
        getNextAngleDegrees: () => 25
      })
    );
    const history = createEmptyEditorSessionHistory();

    expect(controller.preview({ currentSession: session })).toBe(25);
    expect(controller.hasCommitted()).toBe(false);
    expect(history.undoStack).toHaveLength(0);
    expect(readRotationRigControl(session).restAngleDegrees).toBe(0);
  });

  it("drives hook pointer lifecycle for preview, pointer-up commit, and pointer-cancel", async () => {
    let currentSession = createRigFixtureSession();
    let history = createEmptyEditorSessionHistory();
    let commitCount = 0;
    const projection = createMinimalProjection(createOverlay({
      pivot: { x: 50, y: 50 },
      restAngleDegrees: 0,
      evaluatedAngleDegrees: 0
    }));
    const harness = await renderRotationInteractionProbe({
      session: currentSession,
      projection,
      commitGestureController: (controller) => {
        const outcome = controller.commitOnce({
          currentSession,
          history
        });
        if (outcome?.result.committed === true) {
          currentSession = outcome.result.session;
          history = outcome.history;
          commitCount += 1;
        }

        return outcome?.result ?? null;
      }
    });

    try {
      expect(harness.current().previewActive).toBe(false);

      await act(async () => {
        expect(harness.current().handlePointerDown({
          pointerId: 1,
          screenPoint: { x: 50, y: 50 }
        })).toBe(true);
        expect(harness.current().handlePointerMove({
          pointerId: 1,
          screenPoint: { x: 60, y: 50 }
        })).toBe(true);
      });

      expect(harness.current().previewActive).toBe(true);
      expect(harness.current().renderProjection.deformerOverlay).toMatchObject({
        kind: "rotation",
        pivot: { x: 60, y: 50 }
      });

      await act(async () => {
        expect(harness.current().finishPointerDrag({
          pointerId: 1,
          commit: true
        })).toBe(true);
      });

      expect(commitCount).toBe(1);
      expect(history.undoStack).toHaveLength(1);
      expect(readRotationRigControl(currentSession).pivot).toEqual({ x: 60, y: 50 });
      expect(harness.current().previewActive).toBe(false);
    } finally {
      await harness.cleanup();
    }

    currentSession = createRigFixtureSession();
    history = createEmptyEditorSessionHistory();
    commitCount = 0;
    const cancelHarness = await renderRotationInteractionProbe({
      session: currentSession,
      projection,
      commitGestureController: (controller) => {
        const outcome = controller.commitOnce({
          currentSession,
          history
        });
        if (outcome?.result.committed === true) {
          currentSession = outcome.result.session;
          history = outcome.history;
          commitCount += 1;
        }

        return outcome?.result ?? null;
      }
    });

    try {
      await act(async () => {
        expect(cancelHarness.current().handlePointerDown({
          pointerId: 2,
          screenPoint: { x: 78, y: 50 }
        })).toBe(true);
        expect(cancelHarness.current().handlePointerMove({
          pointerId: 2,
          screenPoint: { x: 50, y: 78 }
        })).toBe(true);
      });
      expect(cancelHarness.current().previewActive).toBe(true);
      expect(cancelHarness.current().renderProjection.deformerOverlay).toMatchObject({
        kind: "rotation",
        evaluatedAngleDegrees: 90
      });

      await act(async () => {
        expect(cancelHarness.current().finishPointerDrag({
          pointerId: 2,
          commit: false
        })).toBe(true);
      });

      expect(commitCount).toBe(0);
      expect(history.undoStack).toHaveLength(0);
      expect(readRotationRigControl(currentSession).restAngleDegrees).toBe(0);
      expect(cancelHarness.current().previewActive).toBe(false);
    } finally {
      await cancelHarness.cleanup();
    }
  });

  it("locks parented Rotation canvas edits with diagnostic state and no commit", async () => {
    let currentSession = createRigFixtureSession({ parented: true });
    let history = createEmptyEditorSessionHistory();
    let commitCount = 0;
    const harness = await renderRotationInteractionProbe({
      session: currentSession,
      projection: createMinimalProjection(createOverlay({
        pivot: { x: 50, y: 50 },
        restAngleDegrees: 0,
        evaluatedAngleDegrees: 0
      })),
      commitGestureController: (controller) => {
        const outcome = controller.commitOnce({
          currentSession,
          history
        });
        if (outcome?.result.committed === true) {
          currentSession = outcome.result.session;
          history = outcome.history;
          commitCount += 1;
        }

        return outcome?.result ?? null;
      }
    });

    try {
      expect(harness.current().angleEditMode).toBe("locked");
      expect(harness.current().angleLockReason).toBe("parentedUnsupported");
      expect(harness.current().rendererState).toMatchObject({
        pivotEditable: false,
        angleEditable: false
      });

      await act(async () => {
        expect(harness.current().handlePointerDown({
          pointerId: 3,
          screenPoint: { x: 50, y: 50 }
        })).toBe(true);
        expect(harness.current().handlePointerMove({
          pointerId: 3,
          screenPoint: { x: 60, y: 50 }
        })).toBe(true);
        expect(harness.current().finishPointerDrag({
          pointerId: 3,
          commit: true
        })).toBe(true);
      });

      expect(commitCount).toBe(0);
      expect(history.undoStack).toHaveLength(0);
      expect(readRotationRigControl(currentSession).pivot).toEqual({ x: 50, y: 50 });
      expect(harness.current().previewActive).toBe(false);
    } finally {
      await harness.cleanup();
    }
  });
});

function createOverlay(input: {
  readonly pivot: { readonly x: number; readonly y: number };
  readonly restAngleDegrees: number;
  readonly evaluatedAngleDegrees: number;
}): CanvasDeformerOverlayProjection {
  return {
    kind: "rotation",
    rigControlId: RIG_FACE_ROTATION,
    displayName: "Face Rotation",
    domainBounds: { x: 0, y: 0, width: 100, height: 100 },
    transformColumns: 2,
    transformRows: 2,
    bezierColumns: 2,
    bezierRows: 2,
    childDrawableIds: [DRAW_FACE],
    childRigControlIds: [],
    pivot: input.pivot,
    restAngleDegrees: input.restAngleDegrees,
    evaluatedAngleDegrees: input.evaluatedAngleDegrees,
    status: "committed"
  };
}

function createMinimalProjection(
  overlay: CanvasDeformerOverlayProjection
): CanvasRenderProjection {
  return {
    canvasBounds: { x: 0, y: 0, width: 128, height: 128 },
    artworkBounds: overlay.domainBounds,
    selectedDrawableIds: new Set(overlay.childDrawableIds),
    drawables: [],
    maskRelations: [],
    hasRenderableArtwork: false,
    contentKey: `rotation-interaction-${overlay.rigControlId}`,
    deformerOverlay: overlay
  };
}

async function renderRotationInteractionProbe(input: {
  readonly session: AuthoringSession;
  readonly projection: CanvasRenderProjection;
  readonly commitGestureController: <
    Preview,
    Result extends EditorSessionCommandResult = EditorSessionCommandResult
  >(
    controller: EditorSessionGestureCommitController<Preview, Result>
  ) => Result | null;
}): Promise<{
  readonly cleanup: () => Promise<void>;
  readonly current: () => RotationDeformerInteraction;
}> {
  const fakeRoot = createFakeDomRoot();
  let current: RotationDeformerInteraction | null = null;
  let reactRoot: Root | null = null;

  reactRoot = createRoot(fakeRoot.container as unknown as Element);
  await act(async () => {
    reactRoot?.render(
      createElement(
        StrictMode,
        null,
        createElement(RotationInteractionProbe, {
          input,
          onRender: (nextInteraction) => {
            current = nextInteraction;
          }
        })
      )
    );
  });

  return {
    current: () => {
      if (current === null) {
        throw new Error("Rotation interaction probe was not rendered.");
      }

      return current;
    },
    cleanup: async () => {
      await act(async () => {
        reactRoot?.unmount();
      });
      fakeRoot.restore();
    }
  };
}

function RotationInteractionProbe({
  input,
  onRender
}: {
  readonly input: {
    readonly session: AuthoringSession;
    readonly projection: CanvasRenderProjection;
    readonly commitGestureController: <
      Preview,
      Result extends EditorSessionCommandResult = EditorSessionCommandResult
    >(
      controller: EditorSessionGestureCommitController<Preview, Result>
    ) => Result | null;
  };
  readonly onRender: (interaction: RotationDeformerInteraction) => void;
}) {
  onRender(useRotationDeformerInteraction({
    activeParameterId: null,
    commitGestureController: input.commitGestureController,
    enabled: true,
    parameterValues: {},
    projection: input.projection,
    session: input.session,
    view: { zoom: 1, pan: { x: 0, y: 0 } }
  }));
  return null;
}

function requireRotationAngleBinding(session: AuthoringSession) {
  const binding = createRigControlParameterBindings(session, RIG_FACE_ROTATION).find(
    (candidate) => candidate.targetProperty === "angleDegrees"
  );
  if (binding === undefined) {
    throw new Error("Expected Rotation angleDegrees binding.");
  }

  return binding;
}

function readRotationRigControl(session: AuthoringSession) {
  const rigControl = session.graph.rigControls.find(
    (candidate) => candidate.rigControlId === RIG_FACE_ROTATION
  );
  if (rigControl?.kind !== "rotation2d") {
    throw new Error("Expected Rotation rig control.");
  }

  return rigControl;
}

function readAngleKey(session: AuthoringSession, value: number): number {
  const key = session.graph.keyformSets
    .find(
      (candidate) =>
        candidate.target.kind === "rigControl" &&
        candidate.target.id === RIG_FACE_ROTATION &&
        candidate.target.property === "angleDegrees"
    )
    ?.keys.find((candidate) => isScalarAngleKey(candidate) && candidate.value === value);
  if (key === undefined || typeof key.statePatch !== "number") {
    throw new Error("Expected Rotation angle key.");
  }

  return key.statePatch;
}

function isScalarAngleKey(
  key: AuthoringSession["graph"]["keyformSets"][number]["keys"][number]
): key is AuthoringSession["graph"]["keyformSets"][number]["keys"][number] & {
  readonly value: number;
  readonly statePatch: number;
} {
  return (
    "value" in key &&
    typeof key.value === "number" &&
    typeof key.statePatch === "number"
  );
}

function createAngleKeyformSet() {
  return {
    keyformSetId: KeyformSetIdSchema.parse(
      "keyset_rigcontrol_rig_face_rotation_angledegrees_face_angle_x"
    ),
    target: {
      kind: "rigControl" as const,
      id: RIG_FACE_ROTATION,
      property: "angleDegrees" as const
    },
    parameterId: FACE_ANGLE_X,
    evaluator: "linear-1d-v1" as const,
    interpolation: "linear-1d-v1" as const,
    compositionMode: "replace" as const,
    compositionOrder: 0,
    keys: [
      { value: -30, statePatch: -20 },
      { value: 30, statePatch: 20 }
    ]
  };
}

function createRigFixtureSession(input: {
  readonly parented?: boolean;
} = {}): AuthoringSession {
  const session = createFixtureSession();
  session.graph.parameters.push({
    parameterId: FACE_ANGLE_X,
    displayName: "Face Angle X",
    valueSource: "authoredInput",
    min: -30,
    default: 0,
    max: 30,
    recommendedUiStep: 1
  });
  if (input.parented === true) {
    session.graph.rigControls.push({
      kind: "rotation2d" as const,
      rigControlId: RigControlIdSchema.parse("rig_parent_rotation"),
      displayName: "Parent Rotation",
      partId: PART_FACE,
      childDrawableIds: [],
      childRigControlIds: [RIG_FACE_ROTATION],
      opacityMultiplier: 1,
      pivot: { x: 64, y: 64 },
      restAngleDegrees: 0,
      restTranslation: { x: 0, y: 0 },
      restScale: { x: 1, y: 1 },
      enabled: true
    });
  }

  session.graph.rigControls.push({
    kind: "rotation2d" as const,
    rigControlId: RIG_FACE_ROTATION,
    displayName: "Face Rotation",
    partId: PART_FACE,
    ...(input.parented === true
      ? { parentId: RigControlIdSchema.parse("rig_parent_rotation") }
      : {}),
    childDrawableIds: [DRAW_FACE],
    childRigControlIds: [],
    opacityMultiplier: 1,
    pivot: { x: 50, y: 50 },
    restAngleDegrees: 0,
    restTranslation: { x: 0, y: 0 },
    restScale: { x: 1, y: 1 },
    enabled: true
  });
  session.graph.rigControlRootIds.push(
    input.parented === true
      ? RigControlIdSchema.parse("rig_parent_rotation")
      : RIG_FACE_ROTATION
  );

  return session;
}

function createFixtureSession(): AuthoringSession {
  return {
    packageIdentity: {
      packageId: PackageIdSchema.parse("pkg_rotation_deformer_editing_fixture"),
      packageDisplayName: "Rotation Deformer Editing Fixture",
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
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 },
            { x: 0, y: 100 }
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
          ],
          vertexStableIds: ["vtx_0", "vtx_1", "vtx_2", "vtx_3"],
          bounds: { x: 0, y: 0, width: 100, height: 100 },
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
