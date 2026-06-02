import type {
  EditorAddRigControlAngleKeyformCommand,
  EditorAddWarpLattice2dControlPointOffsetsKeyformCommand,
  EditorBindRigControlChildCommand,
  EditorCreateWarpLattice2dRigControlCommand,
  EditorCreateRotation2dRigControlCommand,
  EditorSessionAdapter,
  EditorSessionPersistenceResult
} from "../editor-session/index.js";
import type { EditorSemanticState } from "../editor-state/index.js";
import { applyEditorWorkflowCommitResult } from "./workflow-state-projection.js";

export interface EditorWorkflowAddRigControlAngleKeyformCommand
  extends EditorAddRigControlAngleKeyformCommand {
  readonly commandKind: "addRigControlAngleKeyform";
}

export type EditorWorkflowCreateRotation2dRigControlCommand =
  | EditorCreateRotation2dRigControlCommand
  | EditorWorkflowAddRigControlAngleKeyformCommand;
export type EditorWorkflowBindRigControlChildCommand =
  EditorBindRigControlChildCommand;
export type EditorWorkflowCreateWarpLattice2dRigControlCommand =
  EditorCreateWarpLattice2dRigControlCommand;

export interface EditorWorkflowBindWarpLattice2dChildCommand {
  readonly commandKind: "draftWarpLattice2dBindChild";
  readonly parent: {
    readonly source: "draft" | "package";
    readonly id: string;
  };
  readonly child: EditorWorkflowBindRigControlChildCommand["child"];
}

export interface EditorWorkflowAddWarpLattice2dControlPointOffsetsKeyformCommand
  extends Omit<EditorAddWarpLattice2dControlPointOffsetsKeyformCommand, "rigControlId"> {
  readonly commandKind: "draftWarpLattice2dControlPointOffsetsKeyform";
  readonly target: {
    readonly source: "draft" | "package";
    readonly id: string;
    readonly property: "controlPointOffsets";
  };
}

export interface EditorWorkflowRigControlCommitResult {
  readonly status: "committed" | "rejected";
  readonly result: EditorSessionPersistenceResult;
}

export interface EditorWorkflowRigControlCommitOutcome {
  readonly result: EditorWorkflowRigControlCommitResult;
  readonly state: EditorSemanticState;
  readonly latestSessionPersistenceResult: EditorSessionPersistenceResult;
}

export const commitWorkflowCreateRotation2dRigControl = (input: {
  readonly adapter: EditorSessionAdapter;
  readonly state: EditorSemanticState;
  readonly command: EditorWorkflowCreateRotation2dRigControlCommand;
}): EditorWorkflowRigControlCommitOutcome => {
  const command = input.command;
  if (isAddRigControlAngleKeyformCommand(command)) {
    return commitWorkflowAddRigControlAngleKeyform({
      ...input,
      command
    });
  }

  const result = input.adapter.commitCreateRotation2dRigControl({
    ...command,
    operationId:
      command.operationId ??
      createRigControlOperationId(
        "create_rotation2d_rig_control",
        command.displayName,
        input.adapter.authoringSession.packageRevision
      )
  });

  return projectRigControlCommitOutcome(input.state, input.adapter, result);
};

export const commitWorkflowCreateWarpLattice2dRigControl = (input: {
  readonly adapter: EditorSessionAdapter;
  readonly state: EditorSemanticState;
  readonly command: EditorWorkflowCreateWarpLattice2dRigControlCommand;
}): EditorWorkflowRigControlCommitOutcome => {
  const result = input.adapter.commitCreateWarpLattice2dRigControl({
    ...input.command,
    operationId:
      input.command.operationId ??
      createRigControlOperationId(
        "create_warp_lattice2d_rig_control",
        input.command.displayName,
        input.adapter.authoringSession.packageRevision
      )
  });

  return projectRigControlCommitOutcome(input.state, input.adapter, result);
};

export const commitWorkflowAddRigControlAngleKeyform = (input: {
  readonly adapter: EditorSessionAdapter;
  readonly state: EditorSemanticState;
  readonly command: EditorWorkflowAddRigControlAngleKeyformCommand;
}): EditorWorkflowRigControlCommitOutcome => {
  const result = input.adapter.commitAddRigControlAngleKeyform({
    ...input.command,
    operationId:
      input.command.operationId ??
      createRigControlOperationId(
        "add_rig_control_angle_keyform",
        `${input.command.rigControlId}_${input.command.parameterId}_${input.command.keyValue}`,
        input.adapter.authoringSession.packageRevision
      )
  });

  return projectRigControlCommitOutcome(input.state, input.adapter, result);
};

export const commitWorkflowBindWarpLattice2dChild = (input: {
  readonly adapter: EditorSessionAdapter;
  readonly state: EditorSemanticState;
  readonly command: EditorWorkflowBindWarpLattice2dChildCommand;
}): EditorWorkflowRigControlCommitOutcome => {
  if (input.command.parent.source === "package") {
    const result = input.adapter.commitBindRigControlChild({
      parentRigControlId: input.command.parent.id,
      child: input.command.child,
      operationId: createRigControlOperationId(
        "bind_warp_lattice2d_child",
        `${input.command.parent.id}_${input.command.child.kind}_${input.command.child.id}`,
        input.adapter.authoringSession.packageRevision
      )
    });

    return projectRigControlCommitOutcome(input.state, input.adapter, result);
  }

  const result = input.adapter.commitCreateWarpLattice2dRigControl({
    ...createWarpLattice2dCommandFromDraft(input.state, input.command.child),
    operationId: createRigControlOperationId(
      "create_warp_lattice2d_rig_control_bind_child",
      `${input.command.parent.id}_${input.command.child.kind}_${input.command.child.id}`,
      input.adapter.authoringSession.packageRevision
    )
  });

  return projectRigControlCommitOutcome(input.state, input.adapter, result);
};

export const commitWorkflowAddWarpLattice2dControlPointOffsetsKeyform = (input: {
  readonly adapter: EditorSessionAdapter;
  readonly state: EditorSemanticState;
  readonly command: EditorWorkflowAddWarpLattice2dControlPointOffsetsKeyformCommand;
}): EditorWorkflowRigControlCommitOutcome => {
  const targetRigControlId =
    input.command.target.source === "package"
      ? input.command.target.id
      : createRigControlIdFromDisplayName(input.state.warpLattice2dDraft.displayName);

  if (input.command.target.source === "draft") {
    const created = input.adapter.commitCreateWarpLattice2dRigControl({
      ...createWarpLattice2dCommandFromDraft(input.state),
      operationId: createRigControlOperationId(
        "create_warp_lattice2d_rig_control_for_keyform",
        input.command.target.id,
        input.adapter.authoringSession.packageRevision
      )
    });

    if (created.operationResult.status !== "committed") {
      return projectRigControlCommitOutcome(input.state, input.adapter, created);
    }
  }

  const result = input.adapter.commitAddWarpLattice2dControlPointOffsetsKeyform({
    parameterId: input.command.parameterId,
    rigControlId: targetRigControlId,
    keyValue: input.command.keyValue,
    ...(input.command.compositionMode === undefined
      ? {}
      : { compositionMode: input.command.compositionMode }),
    controlPointOffsets: input.command.controlPointOffsets,
    operationId: createRigControlOperationId(
      "add_warp_lattice2d_control_point_offsets_keyform",
      `${targetRigControlId}_${input.command.parameterId}_${input.command.keyValue}`,
      input.adapter.authoringSession.packageRevision
    )
  });

  return projectRigControlCommitOutcome(input.state, input.adapter, result);
};

export const commitWorkflowBindRigControlChild = (input: {
  readonly adapter: EditorSessionAdapter;
  readonly state: EditorSemanticState;
  readonly command: EditorWorkflowBindRigControlChildCommand;
}): EditorWorkflowRigControlCommitOutcome => {
  const result = input.adapter.commitBindRigControlChild({
    ...input.command,
    operationId:
      input.command.operationId ??
      createRigControlOperationId(
        "bind_rig_control_child",
        `${input.command.parentRigControlId}_${input.command.child.kind}_${input.command.child.id}`,
        input.adapter.authoringSession.packageRevision
      )
  });

  return projectRigControlCommitOutcome(input.state, input.adapter, result);
};

const projectRigControlCommitOutcome = (
  state: EditorSemanticState,
  adapter: EditorSessionAdapter,
  result: EditorSessionPersistenceResult
): EditorWorkflowRigControlCommitOutcome => ({
  latestSessionPersistenceResult: result,
  state: applyEditorWorkflowCommitResult(state, adapter, result),
  result: {
    status: result.operationResult.status === "committed" ? "committed" : "rejected",
    result
  }
});

const createRigControlOperationId = (
  operation: string,
  target: string,
  packageRevision: number
): string =>
  `op_editor_${operation}_${sanitizeRigControlOperationIdToken(target)}_r${packageRevision}`;

const sanitizeRigControlOperationIdToken = (text: string): string =>
  text.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase() || "unnamed";

const createWarpLattice2dCommandFromDraft = (
  state: EditorSemanticState,
  child?: EditorWorkflowBindRigControlChildCommand["child"]
): EditorWorkflowCreateWarpLattice2dRigControlCommand => ({
  displayName: state.warpLattice2dDraft.displayName,
  partId: state.warpLattice2dDraft.partId,
  domainBounds: state.warpLattice2dDraft.domainBounds,
  latticeColumns: state.warpLattice2dDraft.latticeColumns,
  latticeRows: state.warpLattice2dDraft.latticeRows,
  interpolationMethod: state.warpLattice2dDraft.interpolationMethod,
  childDrawableIds: child?.kind === "drawable" ? [child.id] : [],
  childRigControlIds: child?.kind === "rigControl" ? [child.id] : []
});

const createRigControlIdFromDisplayName = (displayName: string): string =>
  `rig_${displayName.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "unnamed"}`;

const isAddRigControlAngleKeyformCommand = (
  command: EditorWorkflowCreateRotation2dRigControlCommand
): command is EditorWorkflowAddRigControlAngleKeyformCommand =>
  "commandKind" in command && command.commandKind === "addRigControlAngleKeyform";
