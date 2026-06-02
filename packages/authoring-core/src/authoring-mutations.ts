import type { ParameterDto } from "@private-2d-rigging-lab/package-format";

import { incrementAuthoringRevision } from "./authoring-revision.js";
import type { AuthoringRevision } from "./authoring-revision.js";
import type { AuthoringSession } from "./authoring-session.js";
import { hasParameter } from "./graph-selectors.js";

export type AuthoringMutationErrorCode =
  | "duplicate_parameter"
  | "duplicate_source_asset"
  | "duplicate_source_layer"
  | "duplicate_drawable"
  | "duplicate_mesh"
  | "duplicate_part"
  | "missing_parent_part"
  | "part_cycle"
  | "duplicate_child_part"
  | "no_op_part_update"
  | "duplicate_keyform_set"
  | "missing_part"
  | "missing_source_asset"
  | "blocked_rights"
  | "provenance_asset_mismatch"
  | "rights_asset_mismatch"
  | "source_binary_ref_path_mismatch"
  | "source_binary_ref_provenance_mismatch"
  | "source_binary_ref_rights_mismatch"
  | "source_layer_asset_mismatch"
  | "missing_source_layer"
  | "missing_provenance_record"
  | "missing_rights_record"
  | "texture_preview_texture_mismatch"
  | "texture_preview_source_asset_mismatch"
  | "texture_preview_source_layer_mismatch"
  | "texture_preview_provenance_mismatch"
  | "texture_binary_ref_path_mismatch"
  | "texture_binary_ref_provenance_mismatch"
  | "texture_binary_ref_rights_mismatch"
  | "missing_drawable"
  | "missing_texture"
  | "no_op_drawable_part_update"
  | "no_op_drawable_texture_update"
  | "missing_draw_order_entry"
  | "duplicate_draw_order_entry"
  | "no_op_draw_order_update"
  | "no_op_runtime_visibility_update"
  | "missing_mask_drawable"
  | "missing_mask_target_drawable"
  | "duplicate_mask_drawable"
  | "duplicate_mask_target_drawable"
  | "empty_mask_relation"
  | "self_mask_relation"
  | "no_op_mask_relation_update"
  | "missing_mesh"
  | "missing_vertex"
  | "empty_vertex_delta"
  | "duplicate_vertex_delta"
  | "no_op_mesh_vertex_update"
  | "missing_parameter"
  | "missing_keyform_target"
  | "unsupported_keyform_target_property"
  | "unsupported_keyform_composition_mode"
  | "invalid_warp_lattice_control_point_offsets_patch"
  | "duplicate_keyform_grid_axis_parameter"
  | "duplicate_keyform_grid_coordinate"
  | "duplicate_dynamics_group"
  | "missing_dynamics_group"
  | "missing_dynamics_driver_parameter"
  | "missing_dynamics_output_parameter"
  | "invalid_dynamics_driver_parameter_source"
  | "invalid_dynamics_output_parameter_source"
  | "duplicate_dynamics_driver"
  | "duplicate_dynamics_output_parameter"
  | "dynamics_output_used_as_driver"
  | "no_op_dynamics_group_update"
  | "duplicate_rig_control"
  | "missing_rig_control"
  | "invalid_rig_control_child_kind"
  | "invalid_rig_control_child_id"
  | "duplicate_rig_control_child"
  | "rig_control_self_child"
  | "rig_control_cycle"
  | "rig_control_child_already_parented"
  | "no_op_rig_control_child_binding"
  | "invalid_warp_lattice_bind_space"
  | "invalid_warp_lattice_domain_bounds"
  | "invalid_warp_lattice_grid"
  | "invalid_warp_lattice_rest_control_points"
  | "invalid_warp_lattice_interpolation";

export class AuthoringMutationError extends Error {
  readonly code: AuthoringMutationErrorCode;

  constructor(code: AuthoringMutationErrorCode, message: string) {
    super(message);
    this.name = "AuthoringMutationError";
    this.code = code;
  }
}

export interface CreateParameterMutationResult {
  readonly session: AuthoringSession;
  readonly parameter: ParameterDto;
  readonly authoringRevision: AuthoringRevision;
}

export const createParameter = (
  session: AuthoringSession,
  parameter: ParameterDto
): CreateParameterMutationResult => {
  if (hasParameter(session.graph, parameter.parameterId)) {
    throw new AuthoringMutationError(
      "duplicate_parameter",
      `Parameter already exists: ${parameter.parameterId}`
    );
  }

  const storedParameter = structuredClone(parameter);
  session.graph.parameters.push(storedParameter);
  if (!session.graph.stableOrder.includes(storedParameter.parameterId)) {
    session.graph.stableOrder.push(storedParameter.parameterId);
  }

  session.authoringRevision = incrementAuthoringRevision(session.authoringRevision);
  session.dirty = true;

  return {
    session,
    parameter: storedParameter,
    authoringRevision: session.authoringRevision
  };
};
