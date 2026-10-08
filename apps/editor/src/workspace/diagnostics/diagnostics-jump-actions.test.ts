import {
  DrawableIdSchema,
  DynamicsGroupIdSchema,
  KeyformSetIdSchema,
  ParameterIdSchema,
  RigControlIdSchema
} from "@private-2d-rigging-lab/contracts";
import { describe, expect, it, vi } from "vitest";

import {
  resolveEditorDiagnosticJumpCommands,
  runEditorDiagnosticJump,
  type EditorDiagnosticJumpActions
} from "./diagnostics-jump-actions";
import type { EditorDiagnosticItem } from "../../features/editor-session/model/editor-diagnostics-state";

const DRAWABLE_ID = DrawableIdSchema.parse("draw_diagnostics_jump");
const RIG_CONTROL_ID = RigControlIdSchema.parse("rig_diagnostics_jump");
const PARAMETER_ID = ParameterIdSchema.parse("param_diagnostics_jump");
const DYNAMICS_GROUP_ID = DynamicsGroupIdSchema.parse("dyn_diagnostics_jump");
const DYNAMICS_GROUP_SECOND_ID = DynamicsGroupIdSchema.parse("dyn_diagnostics_jump_second");
const KEYFORM_SET_ID = KeyformSetIdSchema.parse("keyset_diagnostics_jump_missing_target");

describe("diagnostics jump actions", () => {
  it("opens Authoring Mesh tool and selects the Drawable for mesh warnings", () => {
    const actions = createJumpActions();
    const jumped = runEditorDiagnosticJump(
      createDiagnosticItem({
        code: "mesh.drawableMeshMissing",
        target: {
          kind: "drawable",
          id: DRAWABLE_ID,
          label: "Meshless Drawable"
        },
        actionHints: [
          {
            kind: "openMeshTool",
            target: {
              kind: "drawable",
              id: DRAWABLE_ID
            }
          }
        ]
      }),
      actions
    );

    expect(jumped).toBe(true);
    expect(actions.setActiveEntry).toHaveBeenCalledWith("import");
    expect(actions.setActiveTool).toHaveBeenCalledWith("mesh");
    expect(actions.selectDrawable).toHaveBeenCalledWith(DRAWABLE_ID);
  });

  it("opens Authoring Rig tool and selects a Deformer tree target for deformer warnings", () => {
    const actions = createJumpActions();
    const jumped = runEditorDiagnosticJump(
      createDiagnosticItem({
        code: "references.deformerParentMissing",
        target: {
          kind: "deformer",
          id: RIG_CONTROL_ID,
          label: "Parented Deformer"
        },
        actionHints: [
          {
            kind: "openRigTool",
            target: {
              kind: "deformer",
              id: RIG_CONTROL_ID
            }
          }
        ]
      }),
      actions
    );

    expect(jumped).toBe(true);
    expect(actions.setActiveEntry).toHaveBeenCalledWith("import");
    expect(actions.setActiveTool).toHaveBeenCalledWith("rig");
    expect(actions.selectDeformerTreeTarget).toHaveBeenCalledWith({
      kind: "rigControl",
      rigControlId: RIG_CONTROL_ID
    });
  });

  it("opens Parameters and sets the active parameter for parameter warnings", () => {
    const actions = createJumpActions();
    const jumped = runEditorDiagnosticJump(
      createDiagnosticItem({
        code: "references.keyformParameterMissing",
        target: {
          kind: "keyformSet",
          id: KEYFORM_SET_ID
        },
        actionHints: [
          {
            kind: "openParameters",
            target: {
              kind: "parameter",
              id: PARAMETER_ID
            }
          }
        ]
      }),
      actions
    );

    expect(jumped).toBe(true);
    expect(actions.setActiveEntry).toHaveBeenCalledWith("parameters");
    expect(actions.setActiveTool).not.toHaveBeenCalled();
    expect(actions.setActiveParameterId).toHaveBeenCalledWith(PARAMETER_ID);
  });

  it("opens Authoring Dynamics tool and selects the preview group for dynamics warnings", () => {
    const actions = createJumpActions();
    const jumped = runEditorDiagnosticJump(
      createDiagnosticItem({
        code: "dynamics.outputKeyformMissing",
        target: {
          kind: "dynamicsGroup",
          id: DYNAMICS_GROUP_ID,
          label: "Hair Sway"
        },
        actionHints: [
          {
            kind: "openDynamicsTool",
            target: {
              kind: "dynamicsGroup",
              id: DYNAMICS_GROUP_ID
            }
          }
        ]
      }),
      actions
    );

    expect(jumped).toBe(true);
    expect(actions.setActiveEntry).toHaveBeenCalledWith("import");
    expect(actions.setActiveTool).toHaveBeenCalledWith("dynamics");
    expect(actions.setDynamicsToolPreviewGroupId).toHaveBeenCalledWith(DYNAMICS_GROUP_ID);
  });

  it("creates one Dynamics jump command per valid duplicate-output action hint", () => {
    const item = createDiagnosticItem({
      code: "dynamics.outputOwnershipDuplicate",
      target: {
        kind: "parameter",
        id: PARAMETER_ID
      },
      actionHints: [
        {
          kind: "openDynamicsTool",
          target: {
            kind: "dynamicsGroup",
            id: DYNAMICS_GROUP_ID,
            label: "Hair Sway A"
          }
        },
        {
          kind: "openDynamicsTool",
          target: {
            kind: "dynamicsGroup",
            id: DYNAMICS_GROUP_SECOND_ID,
            label: "Hair Sway B"
          }
        }
      ]
    });

    const commands = resolveEditorDiagnosticJumpCommands(item);
    expect(commands.map((command) => command.label)).toEqual([
      "Open Dynamics Group: Hair Sway A",
      "Open Dynamics Group: Hair Sway B"
    ]);

    const firstActions = createJumpActions();
    commands[0]?.run(firstActions);
    expect(firstActions.setActiveEntry).toHaveBeenCalledWith("import");
    expect(firstActions.setActiveTool).toHaveBeenCalledWith("dynamics");
    expect(firstActions.setDynamicsToolPreviewGroupId).toHaveBeenCalledWith(DYNAMICS_GROUP_ID);

    const secondActions = createJumpActions();
    commands[1]?.run(secondActions);
    expect(secondActions.setActiveEntry).toHaveBeenCalledWith("import");
    expect(secondActions.setActiveTool).toHaveBeenCalledWith("dynamics");
    expect(secondActions.setDynamicsToolPreviewGroupId).toHaveBeenCalledWith(
      DYNAMICS_GROUP_SECOND_ID
    );
  });

  it("does not invent a Rig jump for a missing keyform target Deformer", () => {
    const actions = createJumpActions();
    const jumped = runEditorDiagnosticJump(
      createDiagnosticItem({
        code: "references.keyformTargetDeformerMissing",
        target: {
          kind: "keyformSet",
          id: KEYFORM_SET_ID
        },
        actionHints: [
          {
            kind: "openRigTool",
            target: {
              kind: "deformer",
              id: RIG_CONTROL_ID
            }
          }
        ]
      }),
      actions
    );

    expect(jumped).toBe(false);
    expect(actions.setActiveEntry).not.toHaveBeenCalled();
    expect(actions.setActiveTool).not.toHaveBeenCalled();
    expect(actions.selectDeformerTreeTarget).not.toHaveBeenCalled();
  });
});

function createDiagnosticItem(
  patch: Pick<EditorDiagnosticItem, "actionHints" | "code" | "target">
): EditorDiagnosticItem {
  return {
    id: `test.${patch.code}`,
    severity: "warning",
    category: patch.code.startsWith("mesh.")
      ? "mesh"
      : patch.code.startsWith("dynamics.")
        ? "dynamics"
        : "references",
    title: "Test warning",
    message: "Test warning message.",
    ...patch
  };
}

function createJumpActions(): EditorDiagnosticJumpActions {
  return {
    selectDeformerTreeTarget: vi.fn(),
    selectDrawable: vi.fn(),
    setActiveEntry: vi.fn(),
    setActiveParameterId: vi.fn(),
    setActiveTool: vi.fn(),
    setDynamicsToolPreviewGroupId: vi.fn()
  };
}
