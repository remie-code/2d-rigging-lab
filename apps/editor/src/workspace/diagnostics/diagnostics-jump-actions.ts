import type {
  DrawableId,
  DynamicsGroupId,
  ParameterId,
  RigControlId
} from "@private-2d-rigging-lab/contracts";

import type {
  EditorDiagnosticActionHint,
  EditorDiagnosticItem,
  EditorDiagnosticTarget
} from "../../features/editor-session/model/editor-diagnostics-state";
import type { DeformerTreeSelectionTarget } from "../../features/editor-session/model/editor-selection";
import type { WorkspaceEntryId, WorkspaceToolId } from "../../state/editor-ui-store";

export type EditorDiagnosticJumpKind =
  | "meshTool"
  | "rigTool"
  | "parameters"
  | "dynamicsTool";

export interface EditorDiagnosticJumpActions {
  readonly setActiveEntry: (entry: WorkspaceEntryId) => void;
  readonly setActiveTool: (tool: WorkspaceToolId) => void;
  readonly selectDrawable: (drawableId: DrawableId) => void;
  readonly selectDeformerTreeTarget: (target: DeformerTreeSelectionTarget) => void;
  readonly setActiveParameterId: (parameterId: ParameterId) => void;
  readonly setDynamicsToolPreviewGroupId: (dynamicsGroupId: DynamicsGroupId | null) => void;
}

export interface EditorDiagnosticJumpCommand {
  readonly kind: EditorDiagnosticJumpKind;
  readonly label: string;
  readonly target: EditorDiagnosticTarget;
  readonly run: (actions: EditorDiagnosticJumpActions) => void;
}

export function resolveEditorDiagnosticJumpCommands(
  item: EditorDiagnosticItem
): readonly EditorDiagnosticJumpCommand[] {
  const hintCommands = (item.actionHints ?? [])
    .map((hint) => createCommandFromHint(item, hint))
    .filter(isDefined);

  if (hintCommands.length > 0) {
    return disambiguateCommandLabels(hintCommands);
  }

  const fallbackCommand = createFallbackCommand(item.target);
  return fallbackCommand === null ? [] : [fallbackCommand];
}

export function resolveEditorDiagnosticJumpCommand(
  item: EditorDiagnosticItem
): EditorDiagnosticJumpCommand | null {
  return resolveEditorDiagnosticJumpCommands(item)[0] ?? null;
}

export function runEditorDiagnosticJump(
  item: EditorDiagnosticItem,
  actions: EditorDiagnosticJumpActions
): boolean {
  const command = resolveEditorDiagnosticJumpCommand(item);
  if (command === null) {
    return false;
  }

  command.run(actions);
  return true;
}

function createCommandFromHint(
  item: EditorDiagnosticItem,
  hint: EditorDiagnosticActionHint
): EditorDiagnosticJumpCommand | null {
  if (hint.kind === "openMeshTool" && hint.target.kind === "drawable") {
    return createMeshToolCommand(hint.target);
  }

  if (
    hint.kind === "openRigTool" &&
    hint.target.kind === "deformer" &&
    item.code !== "references.keyformTargetDeformerMissing"
  ) {
    return createRigToolCommand(hint.target);
  }

  if (hint.kind === "openParameters" && hint.target.kind === "parameter") {
    return createParametersCommand(hint.target);
  }

  if (hint.kind === "openDynamicsTool" && hint.target.kind === "dynamicsGroup") {
    return createDynamicsToolCommand(hint.target);
  }

  return null;
}

function createFallbackCommand(target: EditorDiagnosticTarget): EditorDiagnosticJumpCommand | null {
  if (target.kind === "drawable") {
    return createMeshToolCommand(target);
  }

  if (target.kind === "deformer") {
    return createRigToolCommand(target);
  }

  if (target.kind === "parameter") {
    return createParametersCommand(target);
  }

  if (target.kind === "dynamicsGroup") {
    return createDynamicsToolCommand(target);
  }

  return null;
}

function createMeshToolCommand(target: EditorDiagnosticTarget): EditorDiagnosticJumpCommand {
  return {
    kind: "meshTool",
    label: "Open Mesh Tool",
    target,
    run: (actions) => {
      actions.setActiveEntry("workspace");
      actions.setActiveTool("mesh");
      actions.selectDrawable(target.id as DrawableId);
    }
  };
}

function createRigToolCommand(target: EditorDiagnosticTarget): EditorDiagnosticJumpCommand {
  return {
    kind: "rigTool",
    label: "Open Rig Tool",
    target,
    run: (actions) => {
      actions.setActiveEntry("workspace");
      actions.setActiveTool("rig");
      actions.selectDeformerTreeTarget({
        kind: "rigControl",
        rigControlId: target.id as RigControlId
      });
    }
  };
}

function createParametersCommand(target: EditorDiagnosticTarget): EditorDiagnosticJumpCommand {
  return {
    kind: "parameters",
    label: "Open Parameter",
    target,
    run: (actions) => {
      actions.setActiveEntry("parameters");
      actions.setActiveParameterId(target.id as ParameterId);
    }
  };
}

function createDynamicsToolCommand(target: EditorDiagnosticTarget): EditorDiagnosticJumpCommand {
  return {
    kind: "dynamicsTool",
    label: "Open Dynamics Group",
    target,
    run: (actions) => {
      actions.setActiveEntry("workspace");
      actions.setActiveTool("dynamics");
      actions.setDynamicsToolPreviewGroupId(target.id as DynamicsGroupId);
    }
  };
}

function disambiguateCommandLabels(
  commands: readonly EditorDiagnosticJumpCommand[]
): readonly EditorDiagnosticJumpCommand[] {
  if (commands.length <= 1) {
    return commands;
  }

  return commands.map((command) => ({
    ...command,
    label: `${command.label}: ${formatTargetLabel(command.target)}`
  }));
}

function formatTargetLabel(target: EditorDiagnosticTarget): string {
  return target.label ?? target.id;
}

function isDefined<TValue>(value: TValue | null | undefined): value is TValue {
  return value !== null && value !== undefined;
}
